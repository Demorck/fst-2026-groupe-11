import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import DateTimeField from './DateTimeField.tsx';

function Harness({ initial = '', min }: { initial?: string; min?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <>
      <DateTimeField
        label="Début"
        value={value}
        onChange={setValue}
        min={min}
      />
      <output data-testid="value">{value}</output>
    </>
  );
}

const value = () => screen.getByTestId('value').textContent;

describe('DateTimeField', () => {
  it('shows the value in the French format', () => {
    render(<Harness initial="2026-11-20T20:00" />);

    expect(screen.getByLabelText('Début')).toHaveValue('20/11/2026 20:00');
  });

  it('takes a typed date once it is complete', async () => {
    render(<Harness />);

    await userEvent.type(screen.getByLabelText('Début'), '05/12/2026 18:30');

    expect(value()).toBe('2026-12-05T18:30');
  });

  it('empties the value when the field is cleared', async () => {
    render(<Harness initial="2026-11-20T20:00" />);
    const field = screen.getByLabelText('Début');

    await userEvent.clear(field);
    await userEvent.tab();

    expect(value()).toBe('');
  });

  it('picks a day then a time in the calendar', async () => {
    render(<Harness initial="2026-11-20T20:00" />);

    await userEvent.click(
      screen.getByRole('button', { name: /Choisir la date et l'heure/ }),
    );
    const calendar = screen.getByRole('dialog');
    expect(within(calendar).getByText('novembre 2026')).toBeInTheDocument();
    await userEvent.click(
      within(calendar).getByRole('button', { name: 'samedi 21 novembre 2026' }),
    );
    expect(value()).toBe('2026-11-21T20:00');

    await userEvent.click(
      within(calendar).getByRole('option', { name: '18:45' }),
    );

    expect(value()).toBe('2026-11-21T18:45');
    expect(screen.getByLabelText('Début')).toHaveValue('21/11/2026 18:45');
  });

  it('moves from month to month', async () => {
    render(<Harness initial="2026-11-20T20:00" />);

    await userEvent.click(
      screen.getByRole('button', { name: /Choisir la date et l'heure/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Mois suivant' }));

    expect(screen.getByText('décembre 2026')).toBeInTheDocument();
  });

  it('disables the days before the minimum', async () => {
    render(<Harness initial="2026-11-20T20:00" min="2026-11-18T10:00" />);

    await userEvent.click(
      screen.getByRole('button', { name: /Choisir la date et l'heure/ }),
    );

    expect(
      screen.getByRole('button', { name: 'mardi 17 novembre 2026' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'mercredi 18 novembre 2026' }),
    ).toBeEnabled();
  });

  it('closes with Escape and gives the focus back to the field', async () => {
    render(<Harness />);

    await userEvent.click(
      screen.getByRole('button', { name: /Choisir la date et l'heure/ }),
    );
    await userEvent.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByLabelText('Début')).toHaveFocus();
  });

  it('flags a text that is not a date, so the form cannot be submitted', async () => {
    render(<Harness initial="2026-11-20T20:00" />);
    const field = screen.getByLabelText('Début') as HTMLInputElement;

    await userEvent.clear(field);
    await userEvent.type(field, '20/11');

    expect(field.validity.customError).toBe(true);
    expect(value()).toBe('2026-11-20T20:00');

    await userEvent.clear(field);
    await userEvent.type(field, '05/12/2026 18:30');
    expect(field.validity.valid).toBe(true);
  });

  it('never takes a typed date below the minimum', async () => {
    render(<Harness min="2026-11-18T10:00" />);

    await userEvent.type(screen.getByLabelText('Début'), '01/11/2026 08:00');

    expect(value()).toBe('2026-11-18T10:00');
  });
});
