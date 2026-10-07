import CreateEventForm from '../features/events/components/CreateEventForm.tsx';

export default function CreateEventPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Créer un événement</h1>
        <p className="page-subtitle">
          Tous les champs sont obligatoires sauf l'image.
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-7">
        <CreateEventForm />
        <aside className="flex-1 basis-72">
          <p className="alert-note">
            Les créneaux bénévoles se configurent après la création, depuis le
            dashboard.
          </p>
        </aside>
      </div>
    </div>
  );
}
