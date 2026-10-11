/** Mirrors GET /events/:id/shifts, dates as ISO strings. */
export interface Shift {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  requiredVolunteers: number;
  eventId: string;
  registered: number;
  /** True when the logged in user is signed up */
  assigned: boolean;
  /** Who signed up: only sent to the managers of the event */
  volunteers?: ShiftVolunteer[];
}

export interface ShiftVolunteer {
  id: string;
  name: string;
  /** The organizations of the event they belong to, empty once they left them */
  organizations: { id: string; name: string }[];
  /** The manager may take them off the event (the API still decides) */
  removable: boolean;
}

/** Mirrors the backend CreateShiftDto, dates as ISO strings. */
export interface ShiftInput {
  title: string;
  startsAt: string;
  endsAt: string;
  requiredVolunteers: number;
}
