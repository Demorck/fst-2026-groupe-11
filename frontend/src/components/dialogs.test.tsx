import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DialogHost from './DialogHost.tsx';
import Modal from './Modal.tsx';
import { alertDialog, confirm, toast } from './dialogs.ts';

describe('dialogs', () => {
  it('resolves a confirmation with the answer of the user', async () => {
    render(<DialogHost />);

    const answer = confirm({ title: 'Supprimer ?', message: 'Définitif.' });
    const dialog = await screen.findByRole('alertdialog', {
      name: 'Supprimer ?',
    });
    expect(dialog).toHaveTextContent('Définitif.');
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Confirmer' }),
    );

    await expect(answer).resolves.toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it.each([
    [
      'the cancel button',
      () => userEvent.click(screen.getByRole('button', { name: 'Annuler' })),
    ],
    ['Escape', () => userEvent.keyboard('{Escape}')],
  ])('resolves false on %s', async (_, dismiss) => {
    render(<DialogHost />);
    const answer = confirm({ title: 'Quitter ?' });
    await screen.findByRole('alertdialog');

    await dismiss();

    await expect(answer).resolves.toBe(false);
  });

  it('puts the focus on the confirm button, and gives it back on close', async () => {
    render(
      <>
        <button type="button">Ouvrir</button>
        <DialogHost />
      </>,
    );
    const opener = screen.getByRole('button', { name: 'Ouvrir' });
    opener.focus();

    const answer = confirm({ title: 'Quitter ?' });
    expect(
      await screen.findByRole('button', { name: 'Confirmer' }),
    ).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await answer;

    expect(opener).toHaveFocus();
  });

  it('keeps the focus inside while it is open', async () => {
    render(<DialogHost />);
    void confirm({ title: 'Quitter ?' });
    const confirmButton = await screen.findByRole('button', {
      name: 'Confirmer',
    });

    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus();
    await userEvent.tab();
    expect(confirmButton).toHaveFocus();
  });

  it('shows an error until it is read, then the next request', async () => {
    render(<DialogHost />);

    const read = alertDialog({ message: 'Complet.' });
    const next = confirm({ title: 'Et ensuite ?' });
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Complet.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Compris' }));

    await read;
    expect(
      await screen.findByRole('alertdialog', { name: 'Et ensuite ?' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Annuler' }));
    await expect(next).resolves.toBe(false);
  });

  it('shows a toast, then removes it', async () => {
    vi.useFakeTimers();
    render(<DialogHost />);

    act(() => toast('Créneau ajouté.'));
    expect(screen.getByText('Créneau ajouté.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.queryByText('Créneau ajouté.')).toBeNull();
    vi.useRealTimers();
  });

  it('shows two identical alerts one after the other, with the focus on each', async () => {
    render(<DialogHost />);

    const first = alertDialog({ message: 'Déjà commencé.' });
    const second = alertDialog({ message: 'Déjà commencé.' });
    await userEvent.click(
      await screen.findByRole('button', { name: 'Compris' }),
    );
    await first;

    const again = await screen.findByRole('button', { name: 'Compris' });
    await waitFor(() => expect(again).toHaveFocus());
    await userEvent.click(again);
    await second;
  });

  it('gives the page its scroll back when stacked modals close in any order', () => {
    const modal = (title: string) => (
      <Modal key={title} title={title} onClose={() => {}}>
        <button type="button">{title}</button>
      </Modal>
    );
    const { rerender } = render(
      <>
        {modal('A')}
        {modal('B')}
      </>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    // The one below closes first, then the one on top
    rerender(<>{modal('B')}</>);
    expect(document.body.style.overflow).toBe('hidden');
    rerender(<></>);
    expect(document.body.style.overflow).toBe('');
  });

  it('lets Escape close only the modal on top', async () => {
    const closed: string[] = [];
    render(
      <>
        <Modal title="Dessous" onClose={() => closed.push('under')}>
          <button type="button">A</button>
        </Modal>
        <Modal title="Dessus" onClose={() => closed.push('top')}>
          <button type="button">B</button>
        </Modal>
      </>,
    );

    await userEvent.keyboard('{Escape}');

    expect(closed).toEqual(['top']);
  });
});
