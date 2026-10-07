import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '../../generated/prisma/enums.js';
import type { AuthenticatedRequest } from './jwt-auth.guard.js';

/**
 * For public routes that show more to a logged in user (e.g. the volunteer badge on events).
 * A missing, invalid or expired token is not an error: the request goes on as anonymous.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme === 'Bearer' && token) {
      try {
        const { sub, role } = await this.jwt.verifyAsync<{
          sub: string;
          role: Role;
        }>(token);
        request.user = { id: sub, role };
      } catch {
        // anonymous
      }
    }
    return true;
  }
}
