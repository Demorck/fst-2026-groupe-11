import { apiFetch } from '../../api/client.ts';
import type { CheckinTicket, MyTicket, Ticket } from './types.ts';

export const reserveTicket = (eventId: string) =>
  apiFetch<Ticket>(`/events/${eventId}/tickets`, { method: 'POST' });

export const getMyTickets = () => apiFetch<MyTicket[]>('/me/tickets');

/** Tickets of an event for its managers, filtered by participant name or ticket code. */
export const getEventTickets = (eventId: string, search: string) =>
  apiFetch<CheckinTicket[]>(
    `/events/${encodeURIComponent(eventId)}/tickets?search=${encodeURIComponent(search)}`,
  );

export const checkIn = (ticketId: string) =>
  apiFetch<CheckinTicket>(`/tickets/${encodeURIComponent(ticketId)}/checkin`, {
    method: 'POST',
  });
