export type OrganizationRole = 'MANAGER' | 'VOLUNTEER';
export type MembershipStatus =
  'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'REMOVED' | 'LEFT';
/** What a volunteer can do on an event: already works on it, or could. */
export type VolunteerStatus = 'ASSIGNED' | 'AVAILABLE';

export const ROLE_LABELS: Record<OrganizationRole, string> = {
  MANAGER: 'Gestionnaire',
  VOLUNTEER: 'Bénévole',
};

export const STATUS_LABELS: Record<MembershipStatus, string> = {
  PENDING: 'Invitation en attente',
  ACCEPTED: 'Membre',
  DECLINED: 'Invitation refusée',
  CANCELLED: 'Invitation annulée',
  REMOVED: 'Retiré',
  LEFT: 'Parti',
};

/** Public fields of an organization, as sent in lists and on events. */
export interface OrganizationSummary {
  id: string;
  name: string;
  description: string | null;
  hasLogo: boolean;
  updatedAt: string;
}

/** Item of `GET /organizations/mine`: the organization and my role in it. */
export interface MyOrganization extends OrganizationSummary {
  role: OrganizationRole;
}

export interface Invitation {
  id: string;
  role: OrganizationRole;
  createdAt: string;
  organization: OrganizationSummary;
}

export interface Member {
  id: string;
  role: OrganizationRole;
  status: MembershipStatus;
  /** The one nobody invited: cannot be removed, and the only one who removes managers. */
  isCreator: boolean;
  /** A pending invitation older than 7 days: to cancel or send again. */
  expired?: boolean;
  /** The e-mail is only sent to managers. */
  user: { id: string; name: string; email?: string };
}

export interface OrganizationDetail extends MyOrganization {
  members: Member[];
}

/** `updatedAt` busts the browser cache when the logo changes. */
export const logoUrl = ({ id, updatedAt }: OrganizationSummary) =>
  `/api/organizations/${id}/logo?v=${encodeURIComponent(updatedAt)}`;

/** `GET /organizations/:id/public`: open to everyone. */
export interface PublicOrganization extends OrganizationSummary {
  memberCount: number;
  upcomingEvents: {
    id: string;
    title: string;
    startsAt: string;
    location: string;
    category: string;
    capacity: number;
    remainingSeats: number;
  }[];
}

/** One volunteer's past hours in an organization. */
export interface HoursRow {
  userId: string;
  name: string;
  status: MembershipStatus;
  shifts: number;
  hours: number;
}

export interface AuditEntry {
  id: string;
  action:
    | 'INVITATION_CANCELLED'
    | 'MEMBER_REMOVED'
    | 'MEMBER_LEFT'
    | 'PARTICIPATION_REMOVED';
  createdAt: string;
  actor: { id: string; name: string };
  target: { id: string; name: string } | null;
  details: { removedShifts?: number; eventTitle?: string } | null;
}

export interface Attestation {
  organization: OrganizationSummary;
  volunteer: { id: string; name: string };
  issuedAt: string;
  totalHours: number;
  shifts: {
    eventId: string;
    eventTitle: string;
    shiftTitle: string;
    startsAt: string;
    endsAt: string;
    hours: number;
  }[];
}
