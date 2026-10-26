import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const BODY = {
  category: 'PARTY',
  startsAt: '2027-07-10T18:00:00.000Z',
  capacity: 100,
};

describe('AI attendance prediction (e2e)', () => {
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
    },
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
});
