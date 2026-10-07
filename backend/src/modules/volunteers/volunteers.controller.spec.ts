import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { Role } from '../../generated/prisma/enums.js';
import { VolunteersController } from './volunteers.controller.js';

const proto = VolunteersController.prototype;
const rolesOf = (handler: () => unknown) =>
  new Reflector().get<Role[]>(ROLES_KEY, handler);

describe('VolunteersController roles', () => {
  it('lets volunteers and organizers list the shifts, not participants', () => {
    expect(rolesOf(proto.list)).toEqual([Role.VOLUNTEER, Role.ORGANIZER]);
  });

  it.each(['create', 'update', 'remove'] as const)(
    'reserves %s to organizers',
    (method) => {
      expect(rolesOf(proto[method])).toEqual([Role.ORGANIZER]);
    },
  );
});
