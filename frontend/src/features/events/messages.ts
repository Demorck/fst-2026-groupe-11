// The API answers in English, the interface speaks French
export const EVENT_ERRORS: Record<string, string> = {
  'endsAt must be after startsAt': 'La fin doit être après le début.',
  'Capacity is below the number of reserved tickets':
    'La capacité ne peut pas descendre sous le nombre de billets déjà réservés.',
  'Volunteers of a removed organization are on a shift':
    "Une organisation retirée a des bénévoles inscrits sur un créneau : désinscrivez-les d'abord.",
  'You do not manage one of these organizations':
    'Vous ne pouvez ajouter ou retirer que les organisations que vous gérez.',
  'Event has tickets or volunteers':
    "Des billets sont réservés ou des bénévoles inscrits : l'événement ne peut plus être supprimé.",
  'Not a manager of this event': 'Vous ne gérez pas cet événement.',
  'Event not found': "Cet événement n'existe plus.",
};
