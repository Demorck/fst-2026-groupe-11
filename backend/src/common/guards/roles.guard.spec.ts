import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../decorators/roles.decorator.js';
import { Role } from '@/generated/prisma/enums.js';
import { RolesGuard } from './roles.guard.js';

class Restricted {
  @Roles(Role.ORGANIZER, Role.VOLUNTEER)
  handler() {}
}

class Open {
  handler() {}
}

function contextFor(target: typeof Restricted | typeof Open, role?: Role) {
  return {
    getHandler: () => target.prototype.handler,
    getClass: () => target,
    switchToHttp: () => ({
      getRequest: () => ({ user: role && { id: 'u1', role } }),
    }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());

  it('lets everyone through when the route has no @Roles', () => {
    expect(guard.canActivate(contextFor(Open, Role.PARTICIPANT))).toBe(true);
  });

  it('allows any of the listed roles', () => {
    expect(guard.canActivate(contextFor(Restricted, Role.ORGANIZER))).toBe(
      true,
    );
    expect(guard.canActivate(contextFor(Restricted, Role.VOLUNTEER))).toBe(
      true,
    );
  });

  it('throws 403 for a role that is not listed', () => {
    expect(() =>
      guard.canActivate(contextFor(Restricted, Role.PARTICIPANT)),
    ).toThrow(ForbiddenException);
  });

  it('throws 403 when no user is attached to the request', () => {
    expect(() => guard.canActivate(contextFor(Restricted))).toThrow(
      ForbiddenException,
    );
  });
});
