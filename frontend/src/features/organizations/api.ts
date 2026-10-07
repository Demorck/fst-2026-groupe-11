import { apiFetch } from '../../api/client.ts';
import type {
  Invitation,
  MyOrganization,
  OrganizationDetail,
  OrganizationSummary,
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
