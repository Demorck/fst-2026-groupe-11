import { Role } from '@/generated/prisma/enums.js';
import { hasRole } from './roles.js';

describe('hasRole', () => {
  it.each([
    [Role.ORGANIZER, Role.ORGANIZER, true],
    [Role.ORGANIZER, Role.VOLUNTEER, true],
    [Role.ORGANIZER, Role.PARTICIPANT, true],
    [Role.VOLUNTEER, Role.VOLUNTEER, true],
    [Role.VOLUNTEER, Role.PARTICIPANT, true],
    [Role.VOLUNTEER, Role.ORGANIZER, false],
    [Role.PARTICIPANT, Role.PARTICIPANT, true],
    [Role.PARTICIPANT, Role.VOLUNTEER, false],
    [Role.PARTICIPANT, Role.ORGANIZER, false],
  ])('%s asking for %s: %s', (user, required, expected) => {
    expect(hasRole(user, required)).toBe(expected);
  });
});
