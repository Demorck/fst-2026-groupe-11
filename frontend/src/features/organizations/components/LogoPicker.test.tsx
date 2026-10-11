import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import DialogHost from '../../../components/DialogHost.tsx';
import LogoPicker from './LogoPicker.tsx';

const png = new File(['x'], 'logo.png', { type: 'image/png' });

const renderPicker = (onPick = vi.fn(), file: File | null = null) => {
  render(
    <>
      <LogoPicker current={<span>BN</span>} file={file} onPick={onPick} />
      <DialogHost />
    </>,
  );
  return onPick;
};

describe('LogoPicker', () => {
  it('says what can be done and what is accepted', () => {
    renderPicker();

    expect(screen.getByText(/Glissez une image ici/)).toBeInTheDocument();
    expect(screen.getByText(/PNG, JPEG ou WebP, 512 Ko maximum/)).toBeVisible();
    expect(screen.getByText('BN')).toBeInTheDocument();
  });

  it('hands over the chosen file', async () => {
    const onPick = renderPicker();

    await userEvent.upload(screen.getByLabelText(/Logo/), png);

    expect(onPick).toHaveBeenCalledWith(png);
  });

  it('takes a dropped file', () => {
    const onPick = renderPicker();

    fireEvent.drop(screen.getByText(/Glissez une image ici/), {
      dataTransfer: { files: [png] },
    });

    expect(onPick).toHaveBeenCalledWith(png);
  });

  it('refuses a file that is too heavy or not an image, without handing it over', async () => {
    const onPick = renderPicker();
    const heavy = new File([new Uint8Array(513 * 1024)], 'big.png', {
      type: 'image/png',
    });

    fireEvent.drop(screen.getByText(/Glissez une image ici/), {
      dataTransfer: { files: [heavy] },
    });
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('512 Ko');
    await userEvent.click(screen.getByRole('button', { name: 'Compris' }));

    fireEvent.drop(screen.getByText(/Glissez une image ici/), {
      dataTransfer: {
        files: [new File(['<svg/>'], 'a.svg', { type: 'image/svg+xml' })],
      },
    });
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'PNG, JPEG',
    );
    expect(onPick).not.toHaveBeenCalled();
  });

  it('shows the name of a file chosen but not sent yet', () => {
    renderPicker(vi.fn(), png);

    expect(screen.getByText('logo.png')).toBeInTheDocument();
    expect(screen.getByText('Choisir un autre fichier')).toBeInTheDocument();
  });
});
