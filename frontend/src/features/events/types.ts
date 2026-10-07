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
}

export interface EventDetail extends Omit<CreateEventInput, 'imageUrl'> {
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
}

export const formatEventDate = (iso: string) =>
  new Date(iso).toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short',
  });
