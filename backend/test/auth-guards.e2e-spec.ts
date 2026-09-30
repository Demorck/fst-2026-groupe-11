import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { CurrentUser } from '../src/common/decorators/current-user.decorator.js';
import {
  type AuthUser,
  JwtAuthGuard,
} from '../src/common/guards/jwt-auth.guard.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

// Routes that only exist here: the guards are shared, no domain controller uses them yet
@Controller('guards-demo')
class DemoController {
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) {
    return user;
  }
}

describe('Auth guards (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [DemoController],
    })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwt = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  const get = (path: string, token?: string) => {
    const req = request(app.getHttpServer()).get(`/api/guards-demo/${path}`);
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
  };

  it('returns 401 without a token', () => get('me').expect(401));

  it('returns 401 with an invalid token', () =>
    get('me', 'not-a-jwt').expect(401));

  it('returns 401 with an expired token', async () => {
    const token = await jwt.signAsync(
      { sub: 'u1', role: Role.ORGANIZER },
      { expiresIn: -10 },
    );
    await get('me', token).expect(401);
  });

  it('exposes the token owner through @CurrentUser', async () => {
    const token = await jwt.signAsync({ sub: 'u1', role: Role.PARTICIPANT });
    const { body } = await get('me', token).expect(200);
    expect(body).toEqual({ id: 'u1', role: Role.PARTICIPANT });
  });
});
