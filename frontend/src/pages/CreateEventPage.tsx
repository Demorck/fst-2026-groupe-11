import CreateEventForm from '../features/events/components/CreateEventForm.tsx';

export default function CreateEventPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Créer un événement</h1>
      <CreateEventForm />
    </div>
  );
}
