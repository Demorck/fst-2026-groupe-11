export type OrganizationRole = 'MANAGER' | 'VOLUNTEER';
export type MembershipStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';
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
  /** The e-mail is only sent to managers. */
  user: { id: string; name: string; email?: string };
}

export interface OrganizationDetail extends MyOrganization {
  members: Member[];
}

/** `updatedAt` busts the browser cache when the logo changes. */
export const logoUrl = ({ id, updatedAt }: OrganizationSummary) =>
  `/api/organizations/${id}/logo?v=${encodeURIComponent(updatedAt)}`;
