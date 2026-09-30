import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { Role } from '../../generated/prisma/enums.js';

export interface AuthUser {
  id: string;
  role: Role;
}

export type AuthenticatedRequest = Request & { user?: AuthUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException();
    }
    try {
      const { sub, role } = await this.jwt.verifyAsync<{
        sub: string;
        role: Role;
      }>(token);
      request.user = { id: sub, role };
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
