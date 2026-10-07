import type {
  OrganizationSummary,
  VolunteerStatus,
} from '../organizations/types.ts';

export const EVENT_CATEGORIES = [
  'CONFERENCE',
  'PARTY',
  'SPORT',
  'CULTURE',
  'WORKSHOP',
  'OTHER',
] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<EventCategory, string> = {
  CONFERENCE: 'Conférence',
  PARTY: 'Soirée',
  SPORT: 'Sport',
  CULTURE: 'Culture',
  WORKSHOP: 'Atelier',
  OTHER: 'Autre',
};

/** Banner tint and ink of each category, as in the mockup. */
export const CATEGORY_STYLES: Record<
  EventCategory,
  { tint: string; ink: string }
> = {
  CONFERENCE: { tint: '#E4E6FB', ink: '#2A2DA8' },
  PARTY: { tint: '#FDE5D8', ink: '#9A3412' },
  SPORT: { tint: '#DDF3E6', ink: '#166534' },
  CULTURE: { tint: '#F3E3F7', ink: '#6B21A8' },
  WORKSHOP: { tint: '#FFF1C7', ink: '#854D0E' },
  OTHER: { tint: '#ECEDF1', ink: '#3F4350' },
};

/** Mirrors the backend CreateEventDto, dates as ISO strings. */
export interface CreateEventInput {
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  location: string;
  capacity: number;
  category: EventCategory;
  imageUrl?: string;
  /** At least one, among the organizations the author manages. */
  organizationIds: string[];
}

export interface EventDetail extends Omit<
  CreateEventInput,
  'imageUrl' | 'organizationIds'
> {
  id: string;
  organizerId: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Event as returned by GET /events and GET /events/:id. */
export interface EventWithSeats extends EventDetail {
  organizer: { id: string; name: string };
  remainingSeats: number;
  organizations: OrganizationSummary[];
  /** Volunteers the shifts of the event need, have and still miss. */
  volunteers: { required: number; registered: number; missing: number };
  /** Only for a logged in volunteer of one of the organizations, or already on a shift. */
  volunteerStatus: VolunteerStatus | null;
}

export const formatEventDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });

export const formatShortDay = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
