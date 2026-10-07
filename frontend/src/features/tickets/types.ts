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
