import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CommunicationGenerator from './CommunicationGenerator.tsx';

const drafts = {
  description: 'Une soirée à ne pas manquer.',
  post: 'Venez ! #BDE',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const stubFetch = (...responses: Response[]) => {
  const fetch = vi.fn();
  for (const response of responses) fetch.mockResolvedValueOnce(response);
  vi.stubGlobal('fetch', fetch);
  return fetch;
};

const renderGenerator = () => {
  const onSaved = vi.fn();
  render(<CommunicationGenerator eventId="e1" onSaved={onSaved} />);
  return { onSaved, user: userEvent.setup() };
};

const generate = (user: ReturnType<typeof userEvent.setup>) =>
  user.click(screen.getByRole('button', { name: 'Générer la communication' }));

describe('CommunicationGenerator', () => {
  it('shows the generated description and post in editable fields', async () => {
    const fetch = stubFetch(json(drafts));
    const { user } = renderGenerator();

    await generate(user);

    const description = await screen.findByLabelText('Description');
    expect(description).toHaveValue(drafts.description);
    expect(screen.getByLabelText('Post réseau social')).toHaveValue(
      drafts.post,
    );
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('/api/ai/communication');
    expect(JSON.parse(init.body)).toEqual({ eventId: 'e1' });
    await user.type(description, ' Inscrivez-vous !');
    expect(description).toHaveValue(
      'Une soirée à ne pas manquer. Inscrivez-vous !',
    );
  });

  it('replaces the drafts when regenerating', async () => {
    stubFetch(
      json(drafts),
      json({ description: 'Autre texte', post: 'Autre post' }),
    );
    const { user } = renderGenerator();
    await generate(user);
    await screen.findByLabelText('Description');

    await user.click(screen.getByRole('button', { name: 'Régénérer' }));

    expect(await screen.findByDisplayValue('Autre texte')).toBeInTheDocument();
    expect(screen.getByLabelText('Post réseau social')).toHaveValue(
      'Autre post',
    );
  });

  it('saves the edited description on the event', async () => {
    const saved = { id: 'e1', description: 'Texte relu' };
    const fetch = stubFetch(json(drafts), json(saved));
    const { user, onSaved } = renderGenerator();
    await generate(user);
    const description = await screen.findByLabelText('Description');
    await user.clear(description);
    await user.type(description, 'Texte relu');

    await user.click(
      screen.getByRole('button', { name: 'Enregistrer comme description' }),
    );

    await vi.waitFor(() => expect(onSaved).toHaveBeenCalledWith(saved));
    const [url, init] = fetch.mock.calls[1];
    expect(url).toBe('/api/events/e1');
    expect(init.method).toBe('PATCH');
    expect(JSON.parse(init.body)).toEqual({ description: 'Texte relu' });
  });

  it('cannot save an empty description', async () => {
    stubFetch(json(drafts));
    const { user } = renderGenerator();
    await generate(user);
    await user.clear(await screen.findByLabelText('Description'));

    expect(
      screen.getByRole('button', { name: 'Enregistrer comme description' }),
    ).toBeDisabled();
  });

  it('copies the post to the clipboard', async () => {
    stubFetch(json(drafts));
    const { user } = renderGenerator();
    await generate(user);
    await screen.findByLabelText('Post réseau social');

    await user.click(screen.getByRole('button', { name: 'Copier le post' }));

    expect(await navigator.clipboard.readText()).toBe(drafts.post);
  });

  it('explains in French that the AI did not answer, and lets retry', async () => {
    stubFetch(
      json({ message: 'The AI provider did not answer' }, 502),
      json(drafts),
    );
    const { user } = renderGenerator();

    await generate(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Le service d'IA n'a pas répondu",
    );
    await generate(user);
    expect(await screen.findByLabelText('Description')).toHaveValue(
      drafts.description,
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
