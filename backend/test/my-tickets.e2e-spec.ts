import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('GET /me/tickets (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const findMany = vi.fn().mockResolvedValue([{ id: 't1', code: 'ABCD2345' }]);

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ ticket: { findMany } })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwt = app.get(JwtService);
    findMany.mockClear();
  });

  afterEach(async () => {
    await app.close();
  });

  const get = async (role?: Role) => {
    const req = request(app.getHttpServer()).get('/api/me/tickets');
    return role
      ? req.set(
          'Authorization',
          `Bearer ${await jwt.signAsync({ sub: 'u1', role })}`,
        )
      : req;
  };

  it.each([Role.PARTICIPANT, Role.VOLUNTEER, Role.ORGANIZER])(
    'returns the tickets of a logged in %s',
    async (role) => {
      const res = await get(role);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([{ id: 't1', code: 'ABCD2345' }]);
      expect(findMany.mock.calls[0][0].where.participantId).toBe('u1');
    },
  );

  it('rejects an anonymous request', async () => {
    expect((await get()).status).toBe(401);
  });
});
