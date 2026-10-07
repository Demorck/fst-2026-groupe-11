import CreateEventForm from '../features/events/components/CreateEventForm.tsx';

export default function CreateEventPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Créer un événement</h1>
        <p className="mt-2 text-gray-600">
          Tous les champs sont obligatoires sauf l'image.
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-7">
        <CreateEventForm />
        <aside className="flex-1 basis-72">
          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Les créneaux bénévoles se configurent après la création, depuis le
            dashboard.
          </p>
        </aside>
      </div>
    </div>
  );
}
