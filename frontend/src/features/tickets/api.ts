import { apiFetch } from '../../api/client.ts';
import type { MyTicket, Ticket } from './types.ts';

export const reserveTicket = (eventId: string) =>
  apiFetch<Ticket>(`/events/${eventId}/tickets`, { method: 'POST' });

export const getMyTickets = () => apiFetch<MyTicket[]>('/me/tickets');
