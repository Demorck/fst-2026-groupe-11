import { apiFetch } from '../../api/client.ts';
import type { Shift, ShiftInput } from './types.ts';

export const listShifts = (eventId: string) =>
  apiFetch<Shift[]>(`/events/${eventId}/shifts`);

export const createShift = (eventId: string, input: ShiftInput) =>
  apiFetch<Shift>(`/events/${eventId}/shifts`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

export const updateShift = (id: string, input: ShiftInput) =>
  apiFetch<Shift>(`/shifts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

export const deleteShift = (id: string) =>
  apiFetch<void>(`/shifts/${id}`, { method: 'DELETE' });
