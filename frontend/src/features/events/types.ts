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
  /** Only for a logged in volunteer of one of the organizations, or already on a shift. */
  volunteerStatus: VolunteerStatus | null;
}

export const formatEventDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
