import type {
  MyOrganization,
  OrganizationSummary,
} from '../organizations/types.ts';

/** Indicators of one event, as sent by `GET /dashboard` and `GET /events/:id/stats`. */
export interface EventIndicators {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  location: string;
  category: string;
  capacity: number;
  organizations: OrganizationSummary[];
  reserved: number;
  /** 0 to 1 */
  fillRate: number;
  checkedIn: number;
  volunteers: { required: number; registered: number; missing: number };
  risks: { lowFill: boolean; incompleteShifts: boolean };
}

export interface EventStats extends EventIndicators {
  shifts: {
    id: string;
    title: string;
    startsAt: string;
    endsAt: string;
    requiredVolunteers: number;
    registered: number;
  }[];
}

export interface DashboardData {
  /** The organizations the user manages: the choices of the selector. */
  organizations: MyOrganization[];
  events: EventIndicators[];
}
