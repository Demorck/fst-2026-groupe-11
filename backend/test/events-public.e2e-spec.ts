import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('GET /events stays public (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const findMany = vi.fn();

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({ event: { findMany } })
      .compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwt = app.get(JwtService);
    findMany.mockReset();
    findMany.mockResolvedValue([]);
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers a visitor without token', async () => {
    expect((await request(app.getHttpServer()).get('/api/events')).status).toBe(
      200,
    );
  });

  it('treats an invalid token as a visitor instead of answering 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/events')
      .set('Authorization', 'Bearer not-a-token');

    expect(res.status).toBe(200);
  });

  it('looks up the volunteer status only for a logged in volunteer', async () => {
    const asVolunteer = await jwt.signAsync({
      sub: 'u1',
      role: Role.VOLUNTEER,
    });
    await request(app.getHttpServer())
      .get('/api/events')
      .set('Authorization', `Bearer ${asVolunteer}`);
    // the list itself, then the status lookup (skipped when the list is empty)
    expect(findMany).toHaveBeenCalledTimes(1);

    findMany.mockReset();
    findMany.mockResolvedValue([
      {
        id: 'e1',
        capacity: 5,
        _count: { tickets: 0 },
        organizations: [],
        shifts: [],
      },
    ]);
    await request(app.getHttpServer())
      .get('/api/events')
      .set('Authorization', `Bearer ${asVolunteer}`);
    expect(findMany).toHaveBeenCalledTimes(2);

    findMany.mockClear();
    const asParticipant = await jwt.signAsync({
      sub: 'u2',
      role: Role.PARTICIPANT,
    });
    await request(app.getHttpServer())
      .get('/api/events')
      .set('Authorization', `Bearer ${asParticipant}`);
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
