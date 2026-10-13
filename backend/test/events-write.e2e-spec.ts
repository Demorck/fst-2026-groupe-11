import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const EVENT = '22222222-2222-4222-8222-222222222222';

describe('PATCH and DELETE /events/:id (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([
      {
        startsAt: new Date('2026-12-01T19:00:00Z'),
        endsAt: new Date('2026-12-01T23:00:00Z'),
      },
    ]),
    ticket: { count: vi.fn().mockResolvedValue(0), deleteMany: vi.fn() },
    shiftAssignment: { count: vi.fn().mockResolvedValue(0) },
    event: { update: vi.fn(), delete: vi.fn() },
  };
  const prisma = {
    event: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({
        id: EVENT,
        capacity: 10,
        organizations: [],
        shifts: [],
        _count: { tickets: 0 },
      }),
    },
    eventOrganization: { count: vi.fn() },
    $transaction: (callback: (t: typeof tx) => unknown) => callback(tx),
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

  const send = async (
    method: 'patch' | 'delete',
    role?: Role,
    path = `/api/events/${EVENT}`,
  ) => {
    const req = request(app.getHttpServer())[method](path).send({});
    return role
      ? req.set(
          'Authorization',
          `Bearer ${await jwt.signAsync({ sub: 'u1', role })}`,
        )
      : req;
  };

  it.each(['patch', 'delete'] as const)(
    '%s is reserved to organizers who manage the event',
    async (method) => {
      expect((await send(method)).status).toBe(401);
      expect((await send(method, Role.VOLUNTEER)).status).toBe(403);
      prisma.eventOrganization.count.mockResolvedValue(0);
      expect((await send(method, Role.ORGANIZER)).status).toBe(403);
      expect(
        (await send(method, Role.ORGANIZER, '/api/events/not-a-uuid')).status,
      ).toBe(400);
    },
  );

  it('lets a manager edit then delete the event', async () => {
    prisma.eventOrganization.count.mockResolvedValue(1);

    const patch = await request(app.getHttpServer())
      .patch(`/api/events/${EVENT}`)
      .set(
        'Authorization',
        `Bearer ${await jwt.signAsync({ sub: 'u1', role: Role.ORGANIZER })}`,
      )
      .send({ title: 'Nouveau titre', capacity: 0 });
    expect(patch.status).toBe(400);

    expect((await send('patch', Role.ORGANIZER)).status).toBe(200);
    expect((await send('delete', Role.ORGANIZER)).status).toBe(204);
  });
});
