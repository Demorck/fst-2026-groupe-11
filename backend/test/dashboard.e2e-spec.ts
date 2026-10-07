import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const EVENT = '22222222-2222-4222-8222-222222222222';

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const prisma = {
    organizationMember: { findMany: vi.fn().mockResolvedValue([]) },
    event: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn() },
    eventOrganization: { count: vi.fn() },
  };

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    jwt = app.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  const get = async (path: string, role?: Role) => {
    const req = request(app.getHttpServer()).get(path);
    return role
      ? req.set(
          'Authorization',
          `Bearer ${await jwt.signAsync({ sub: 'u1', role })}`,
        )
      : req;
  };

  it.each(['/api/dashboard', `/api/events/${EVENT}/stats`])(
    'is reserved to organizers: 401 anonymous, 403 volunteer and participant (%s)',
    async (path) => {
      expect((await get(path)).status).toBe(401);
      expect((await get(path, Role.VOLUNTEER)).status).toBe(403);
      expect((await get(path, Role.PARTICIPANT)).status).toBe(403);
    },
  );

  it('answers an organizer who manages nothing with an empty dashboard', async () => {
    const res = await get('/api/dashboard', Role.ORGANIZER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ organizations: [], events: [] });
  });

  it('rejects an organization id that is not a UUID', async () => {
    const res = await get('/api/dashboard?organizationId=nope', Role.ORGANIZER);

    expect(res.status).toBe(400);
  });

  it('refuses the stats of an event the organizer does not manage', async () => {
    prisma.event.findUnique.mockResolvedValue({
      id: EVENT,
      capacity: 10,
      organizations: [],
      tickets: [],
      shifts: [],
    });
    prisma.eventOrganization.count.mockResolvedValue(0);

    const res = await get(`/api/events/${EVENT}/stats`, Role.ORGANIZER);

    expect(res.status).toBe(403);
  });
});
