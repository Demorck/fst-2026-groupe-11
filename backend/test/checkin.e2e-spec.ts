import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const EVENT = '22222222-2222-4222-8222-222222222222';
const TICKET = '33333333-3333-4333-8333-333333333333';

describe('Check-in (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const prisma = {
    event: { findUnique: vi.fn().mockResolvedValue({ id: EVENT }) },
    ticket: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({
        eventId: EVENT,
        status: 'RESERVED',
        checkedInAt: null,
      }),
      update: vi.fn().mockResolvedValue({ id: TICKET }),
    },
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

  const send = async (method: 'get' | 'post', path: string, role?: Role) => {
    const req = request(app.getHttpServer())[method](path);
    return role
      ? req.set(
          'Authorization',
          `Bearer ${await jwt.signAsync({ sub: 'u1', role })}`,
        )
      : req;
  };

  it.each([
    ['get', `/api/events/${EVENT}/tickets`],
    ['post', `/api/tickets/${TICKET}/checkin`],
  ] as const)(
    'is reserved to organizers: 401 anonymous, 403 volunteer and participant (%s %s)',
    async (method, path) => {
      expect((await send(method, path)).status).toBe(401);
      expect((await send(method, path, Role.VOLUNTEER)).status).toBe(403);
      expect((await send(method, path, Role.PARTICIPANT)).status).toBe(403);
    },
  );

  it('refuses an organizer who does not manage the event', async () => {
    prisma.eventOrganization.count.mockResolvedValue(0);

    const list = await send(
      'get',
      `/api/events/${EVENT}/tickets`,
      Role.ORGANIZER,
    );
    const checkin = await send(
      'post',
      `/api/tickets/${TICKET}/checkin`,
      Role.ORGANIZER,
    );

    expect(list.status).toBe(403);
    expect(checkin.status).toBe(403);
  });

  it('lets a manager search the tickets and check one in', async () => {
    prisma.eventOrganization.count.mockResolvedValue(1);

    const list = await send(
      'get',
      `/api/events/${EVENT}/tickets?search=abc`,
      Role.ORGANIZER,
    );
    const checkin = await send(
      'post',
      `/api/tickets/${TICKET}/checkin`,
      Role.ORGANIZER,
    );

    expect(list.status).toBe(200);
    expect(checkin.status).toBe(200);
    expect(checkin.body).toEqual({ id: TICKET });
  });
});
