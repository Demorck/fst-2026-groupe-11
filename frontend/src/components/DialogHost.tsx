import { closeDialog, useDialogs } from './dialogs.ts';
import Modal from './Modal.tsx';

/** Shows the pending confirmation or error, and the toasts. Mounted once, in the layout. */
export default function DialogHost() {
  const { dialog, toasts } = useDialogs();

  function answer(confirmed: boolean) {
    if (!dialog) return;
    if (dialog.kind === 'confirm') dialog.resolve(confirmed);
    else dialog.resolve();
    closeDialog();
  }

  return (
    <>
      {dialog?.kind === 'confirm' && (
        <Modal
          key={dialog.id}
          title={dialog.title}
          role="alertdialog"
          onClose={() => answer(false)}
        >
          {dialog.message && (
            <p className="mt-2 text-muted">{dialog.message}</p>
          )}
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => answer(false)}
            >
              Annuler
            </button>
            <button
              type="button"
              data-autofocus
              className={`btn ${dialog.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
              onClick={() => answer(true)}
            >
              {dialog.confirmLabel}
            </button>
          </div>
        </Modal>
      )}
      {dialog?.kind === 'alert' && (
        <Modal
          key={dialog.id}
          title={dialog.title}
          role="alertdialog"
          onClose={() => answer(true)}
        >
          <p className="mt-2 text-muted">{dialog.message}</p>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              data-autofocus
              className="btn btn-primary"
              onClick={() => answer(true)}
            >
              Compris
            </button>
          </div>
        </Modal>
      )}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4"
      >
        {toasts.map(({ id, message }) => (
          <p
            key={id}
            className="toast rounded-full bg-ink px-5 py-3 text-center text-sm font-medium text-white shadow-lg"
          >
            {message}
          </p>
        ))}
      </div>
    </>
  );
}
