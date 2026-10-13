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

export const joinShift = (id: string) =>
  apiFetch<void>(`/shifts/${id}/assignments`, { method: 'POST' });

/** A manager takes a volunteer off every upcoming shift of the event. */
export const removeFromEvent = (eventId: string, volunteerId: string) =>
  apiFetch<{ removed: number }>(
    `/events/${eventId}/volunteers/${volunteerId}`,
    { method: 'DELETE' },
  );

export const leaveShift = (id: string) =>
  apiFetch<void>(`/shifts/${id}/assignments/me`, { method: 'DELETE' });
