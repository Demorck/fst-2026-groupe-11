export const ROLES = ['PARTICIPANT', 'VOLUNTEER', 'ORGANIZER'] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  PARTICIPANT: 'Participant',
  VOLUNTEER: 'Bénévole',
  ORGANIZER: 'Organisateur',
};

export interface RegisterInput {
  email: string;
  name: string;
  password: string;
  role: Role;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}
