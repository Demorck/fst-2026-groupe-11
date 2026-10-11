export type TicketStatus = 'RESERVED' | 'CANCELLED';

/** Mirrors the backend Ticket model, dates as ISO strings. */
export interface Ticket {
  id: string;
  code: string;
  status: TicketStatus;
  checkedInAt: string | null;
  participantId: string;
  eventId: string;
  createdAt: string;
  updatedAt: string;
}

/** A ticket of `GET /me/tickets`, with the main info of its event. */
export interface MyTicket extends Pick<
  Ticket,
  'id' | 'code' | 'status' | 'checkedInAt' | 'createdAt'
> {
  event: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    location: string;
  };
}

/** A ticket of `GET /events/:eventId/tickets`, as the check-in page shows it. */
export interface CheckinTicket extends Pick<
  Ticket,
  'id' | 'code' | 'status' | 'checkedInAt'
> {
  participant: { id: string; name: string; email: string };
}
