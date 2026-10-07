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
}

/** Mirrors the backend CreateShiftDto, dates as ISO strings. */
export interface ShiftInput {
  title: string;
  startsAt: string;
  endsAt: string;
  requiredVolunteers: number;
}
