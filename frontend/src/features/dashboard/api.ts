import { apiFetch } from '../../api/client.ts';
import type { DashboardData, EventStats } from './types.ts';

export const getDashboard = (organizationId?: string) =>
  apiFetch<DashboardData>(
    `/dashboard${organizationId ? `?organizationId=${encodeURIComponent(organizationId)}` : ''}`,
  );

export const getEventStats = (eventId: string) =>
  apiFetch<EventStats>(`/events/${eventId}/stats`);
