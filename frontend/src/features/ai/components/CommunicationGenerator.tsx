import { useRef, useState } from 'react';
import { confirm, toast } from '../../../components/dialogs.ts';
import { updateEvent } from '../../events/api.ts';
import { EVENT_ERRORS } from '../../events/messages.ts';
import type { EventWithAccess } from '../../events/types.ts';
import { generateCommunication } from '../api.ts';
import type { CommunicationDrafts } from '../types.ts';

// The API speaks English, the organizer reads French
const ERRORS: Record<string, string> = {
  ...EVENT_ERRORS,
  'The AI provider did not answer':
    "Le service d'IA n'a pas répondu. Réessayez dans un instant.",
};

// What the prompt asks for: the model often goes beyond it
const POST_MAX = 280;

/** Drafts the communication of an event with the AI: nothing is published until the manager saves it */
export default function CommunicationGenerator({
  eventId,
  onSaved,
}: {
  eventId: string;
  onSaved: (event: EventWithAccess) => void;
}) {
  const [drafts, setDrafts] = useState<CommunicationDrafts | null>(null);
  // What the API returned last: tells whether the manager edited the drafts since
  const generated = useRef<CommunicationDrafts | null>(null);
  const [pending, setPending] = useState<'generate' | 'save' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: 'generate' | 'save', task: () => Promise<void>) {
    setPending(action);
    setError(null);
    try {
      await task();
    } catch (err) {
      const message = (err as Error).message;
      setError(ERRORS[message] ?? message);
    } finally {
      setPending(null);
    }
  }

  async function generate() {
    const edited =
      drafts &&
      (drafts.description !== generated.current?.description ||
        drafts.post !== generated.current?.post);
    if (
      edited &&
      !(await confirm({
        title: 'Remplacer les brouillons ?',
        message: 'Les modifications faites à la main seront perdues.',
        confirmLabel: 'Régénérer',
        tone: 'primary',
      }))
    ) {
      return;
    }
    await run('generate', async () => {
      const result = await generateCommunication(eventId);
      generated.current = result;
      setDrafts(result);
    });
  }

  const save = () =>
    run('save', async () => {
      const description = drafts!.description.trim();
      onSaved(await updateEvent(eventId, { description }));
      toast('Description enregistrée.');
    });

  // try/catch and not .catch(): outside a secure context navigator.clipboard is undefined and throws synchronously
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast('Post copié.');
    } catch {
      setError('Copie impossible : sélectionnez le texte à la main.');
    }
  }

  return (
    <section aria-labelledby="communication" className="card space-y-4 p-5">
      <div className="space-y-1">
        <h2 id="communication" className="text-lg font-semibold">
          Communication
        </h2>
        <p className="text-sm text-muted">
          L'IA rédige une description et un post à partir des infos de
          l'événement. Relisez-les et modifiez-les avant de les publier.
        </p>
      </div>
      {error && (
        <p role="alert" className="alert-error">
          {error}
        </p>
      )}
      {drafts && (
        <div aria-busy={pending === 'generate'} className="space-y-4">
          <label className="block space-y-1">
            <span className="text-sm font-medium">Description</span>
            <textarea
              rows={8}
              value={drafts.description}
              onChange={(e) =>
                setDrafts({ ...drafts, description: e.target.value })
              }
              className="field"
            />
          </label>
          <p className="text-sm text-muted">
            La prochaine génération repartira de la description enregistrée :
            n'y gardez que des informations exactes.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={pending !== null || !drafts.description.trim()}
            onClick={save}
          >
            {pending === 'save'
              ? 'Enregistrement...'
              : 'Enregistrer comme description'}
          </button>
          <label className="block space-y-1">
            <span className="text-sm font-medium">Post réseau social</span>
            <textarea
              rows={4}
              value={drafts.post}
              onChange={(e) => setDrafts({ ...drafts, post: e.target.value })}
              aria-describedby="post-length"
              className="field"
            />
          </label>
          <p
            id="post-length"
            className={`text-right text-sm ${drafts.post.length > POST_MAX ? 'text-danger' : 'text-muted'}`}
          >
            {drafts.post.length} / {POST_MAX} caractères
          </p>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void copy(drafts.post)}
          >
            Copier le post
          </button>
        </div>
      )}
      <button
        type="button"
        className={`btn btn-sm ${drafts ? 'btn-secondary' : 'btn-primary'}`}
        disabled={pending !== null}
        onClick={() => void generate()}
      >
        {pending === 'generate'
          ? 'Génération...'
          : drafts
            ? 'Régénérer'
            : 'Générer la communication'}
      </button>
    </section>
  );
}
