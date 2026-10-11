import { useDocumentTitle } from '../hooks/useDocumentTitle.ts';
import CreateEventForm from '../features/events/components/CreateEventForm.tsx';

export default function CreateEventPage() {
  useDocumentTitle('Créer un événement');
  return (
    <div className="space-y-7">
      <div>
        <h1 className="page-title">Créer un événement</h1>
        <p className="page-subtitle">
          Tous les champs sont obligatoires sauf l'image.
        </p>
      </div>
      <CreateEventForm />
    </div>
  );
}
