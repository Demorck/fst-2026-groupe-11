import { Role } from '@/generated/prisma/enums.js';

// Rights are inherited upwards: ORGANIZER has VOLUNTEER's, which has PARTICIPANT's
const RANK: Record<Role, number> = {
  [Role.PARTICIPANT]: 0,
  [Role.VOLUNTEER]: 1,
  [Role.ORGANIZER]: 2,
};

export const hasRole = (userRole: Role, required: Role) =>
  RANK[userRole] >= RANK[required];
