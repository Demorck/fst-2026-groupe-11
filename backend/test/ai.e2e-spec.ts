import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/generated/prisma/enums.js';
import { LLM_PROVIDER } from '../src/modules/ai/communication/llm-provider.interface.js';
import { MockLlmProvider } from '../src/modules/ai/communication/mock-llm.provider.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const EVENT_ID = '11111111-1111-4111-8111-111111111111';

const BODY = {
  category: 'PARTY',
  startsAt: '2027-07-10T18:00:00.000Z',
  capacity: 100,
};

describe('AI (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const prisma = {
    event: {
      findMany: vi.fn().mockResolvedValue([
        {
          category: 'PARTY',
          capacity: 80,
          startsAt: new Date('2025-07-10T18:00:00Z'),
          _count: { tickets: 40 },
        },
      ]),
      count: vi.fn(),
      findUnique: vi.fn(),
    },
    // canManageEvent counts the organizations of the event the user manages
    eventOrganization: { count: vi.fn() },
  };

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      // Whatever LLM_PROVIDER says in the local backend/.env: tests never reach the network
      .overrideProvider(LLM_PROVIDER)
      .useValue(new MockLlmProvider())
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

  const post = async (body: object, role?: Role) => {
    const req = request(app.getHttpServer())
      .post('/api/ai/attendance-prediction')
      .send(body);
    return role
      ? req.set(
          'Authorization',
          `Bearer ${await jwt.signAsync({ sub: 'u1', role })}`,
        )
      : req;
  };

  it('is reserved to organizers: 401 anonymous, 403 volunteer and participant', async () => {
    expect((await post(BODY)).status).toBe(401);
    expect((await post(BODY, Role.VOLUNTEER)).status).toBe(403);
    expect((await post(BODY, Role.PARTICIPANT)).status).toBe(403);
  });

  it('answers an organizer with the estimate computed from the history', async () => {
    const res = await post(BODY, Role.ORGANIZER);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      estimate: 50,
      fillRate: 0.5,
      confidence: 'LOW',
      sampleSize: 1,
      warning: null,
    });
  });

  it.each([
    ['an unknown category', { ...BODY, category: 'NOPE' }],
    ['a null capacity', { ...BODY, capacity: 0 }],
    ['a missing date', { category: 'PARTY', capacity: 100 }],
  ])('rejects %s', async (_label, body) => {
    expect((await post(body, Role.ORGANIZER)).status).toBe(400);
  });

  describe('POST /ai/communication', () => {
    const generate = async (body: object, role = Role.ORGANIZER) =>
      request(app.getHttpServer())
        .post('/api/ai/communication')
        .set(
          'Authorization',
          `Bearer ${await jwt.signAsync({ sub: 'u1', role })}`,
        )
        .send(body);

    beforeEach(() => {
      prisma.event.findUnique.mockResolvedValue({
        title: 'Soirée de rentrée',
        description: 'DJ et buvette',
        startsAt: new Date('2027-09-10T18:00:00Z'),
        endsAt: new Date('2027-09-10T23:00:00Z'),
        location: 'Campus',
        capacity: 100,
        category: 'PARTY',
        organizations: [{ organization: { name: 'BDE Nancy' } }],
      });
      prisma.event.count.mockResolvedValue(1);
      prisma.eventOrganization.count.mockResolvedValue(1);
    });

    it('drafts a description and a post for a manager of the event, with the mock', async () => {
      const res = await generate({ eventId: EVENT_ID });

      expect(res.status).toBe(200);
      expect(res.body.description).toMatch(/^\[mock\] /);
      expect(res.body.post).toMatch(/^\[mock\] /);
    });

    it('refuses an organizer who does not manage the event', async () => {
      prisma.eventOrganization.count.mockResolvedValue(0);

      expect((await generate({ eventId: EVENT_ID })).status).toBe(403);
    });

    it('refuses volunteers and participants', async () => {
      const body = { eventId: EVENT_ID };
      expect((await generate(body, Role.VOLUNTEER)).status).toBe(403);
      expect((await generate(body, Role.PARTICIPANT)).status).toBe(403);
    });

    it('answers 404 for an unknown event and 400 for an invalid id', async () => {
      prisma.event.count.mockResolvedValue(0);

      expect((await generate({ eventId: EVENT_ID })).status).toBe(404);
      expect((await generate({ eventId: 'nope' })).status).toBe(400);
    });
  });
});
