import ConfirmButton from '../../../components/ConfirmButton.tsx';
import type { Shift, ShiftVolunteer } from '../types.ts';

/** Every volunteer of the event once, with their organizations: the manager's view of the team. */
export default function EventVolunteers({
  shifts,
  onRemove,
}: {
  shifts: Shift[];
  onRemove: (volunteer: ShiftVolunteer) => Promise<void>;
}) {
  const team = new Map<string, { volunteer: ShiftVolunteer; shifts: number }>();
  for (const volunteer of shifts.flatMap((s) => s.volunteers ?? [])) {
    const entry = team.get(volunteer.id) ?? { volunteer, shifts: 0 };
    entry.shifts += 1;
    team.set(volunteer.id, entry);
  }

  return (
    <section aria-labelledby="event-volunteers" className="card space-y-4">
      <h2 id="event-volunteers" className="text-lg font-semibold">
        Bénévoles inscrits
      </h2>
      {team.size === 0 ? (
        <p className="text-muted">Personne n'est encore inscrit.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {[...team.values()].map(({ volunteer, shifts: count }) => (
            <li
              key={volunteer.id}
              className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold">{volunteer.name}</p>
                <p className="text-sm text-muted">
                  {volunteer.organizations.length > 0
                    ? volunteer.organizations.map((o) => o.name).join(' · ')
                    : "Plus membre d'une organisation de l'événement"}
                </p>
                <p className="text-sm text-muted">
                  {count} {count > 1 ? 'créneaux' : 'créneau'}
                </p>
              </div>
              {volunteer.removable && (
                <ConfirmButton
                  label="Retirer de l'événement"
                  ariaLabel={`Retirer ${volunteer.name} de l'événement`}
                  question={`Retirer ${volunteer.name} de l'événement ?`}
                  details="Ses créneaux à venir sur cet événement seront libérés. Ses heures passées restent."
                  compact
                  onConfirm={() => onRemove(volunteer)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
