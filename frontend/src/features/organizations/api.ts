import { apiFetch } from '../../api/client.ts';
import type {
  Attestation,
  AuditEntry,
  HoursRow,
  Invitation,
  MyOrganization,
  OrganizationDetail,
  OrganizationSummary,
  PublicOrganization,
} from './types.ts';

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export const createOrganization = (input: {
  name: string;
  description?: string;
}) => apiFetch<OrganizationSummary>('/organizations', json('POST', input));

export const getMyOrganizations = () =>
  apiFetch<MyOrganization[]>('/organizations/mine');

export const getInvitations = () =>
  apiFetch<Invitation[]>('/organizations/invitations');

export const answerInvitation = (id: string, answer: 'accept' | 'decline') =>
  apiFetch<unknown>(`/organizations/invitations/${id}/${answer}`, {
    method: 'POST',
  });

export const getOrganization = (id: string) =>
  apiFetch<OrganizationDetail>(`/organizations/${id}`);

export const inviteMember = (id: string, email: string) =>
  apiFetch<unknown>(
    `/organizations/${id}/invitations`,
    json('POST', { email }),
  );

/** Sends the image bytes as they are: the API reads the raw body, not a form. */
export const uploadLogo = (id: string, file: File) =>
  apiFetch<OrganizationSummary>(`/organizations/${id}/logo`, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });

export const getPublicOrganization = (id: string) =>
  apiFetch<PublicOrganization>(`/organizations/${id}/public`);

export const getHours = (id: string) =>
  apiFetch<HoursRow[]>(`/organizations/${id}/hours`);

export const getAudit = (id: string) =>
  apiFetch<AuditEntry[]>(`/organizations/${id}/audit`);

export const getAttestation = (id: string, userId: string) =>
  apiFetch<Attestation>(`/organizations/${id}/members/${userId}/attestation`);

export const cancelInvitation = (id: string, memberId: string) =>
  apiFetch<unknown>(`/organizations/${id}/invitations/${memberId}`, {
    method: 'DELETE',
  });

export const removeMember = (id: string, memberId: string) =>
  apiFetch<{ removedShifts: number }>(
    `/organizations/${id}/members/${memberId}`,
    { method: 'DELETE' },
  );

export const leaveOrganization = (id: string) =>
  apiFetch<{ removedShifts: number }>(`/organizations/${id}/leave`, {
    method: 'POST',
  });
