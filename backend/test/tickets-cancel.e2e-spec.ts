import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { Role, TicketStatus } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const eventId = '11111111-1111-4111-8111-111111111111';

describe('DELETE /events/:eventId/tickets (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const tx = {
    $queryRaw: vi
      .fn()
      .mockResolvedValue([{ startsAt: new Date(Date.now() + 86_400_000) }]),
    ticket: {
      findUnique: vi.fn().mockResolvedValue({
        id: 't1',
        status: TicketStatus.RESERVED,
        checkedInAt: null,
      }),
      update: vi.fn().mockResolvedValue({ id: 't1', status: 'CANCELLED' }),
    },
  };

  beforeEach(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $transaction: (callback: (tx: unknown) => unknown) => callback(tx),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    jwt = app.get(JwtService);
    tx.ticket.findUnique.mockClear();
    tx.ticket.update.mockClear();
  });

  afterEach(async () => {
    await app.close();
  });

  const cancel = async (role?: Role) => {
    const req = request(app.getHttpServer()).delete(
      `/api/events/${eventId}/tickets`,
    );
    return role
      ? req.set(
          'Authorization',
          `Bearer ${await jwt.signAsync({ sub: 'u1', role })}`,
        )
      : req;
  };

  it.each([Role.PARTICIPANT, Role.VOLUNTEER, Role.ORGANIZER])(
    'cancels the ticket of a logged in %s',
    async (role) => {
      const res = await cancel(role);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: 't1', status: 'CANCELLED' });
      // only the ticket of the user can be looked up: the id comes from the token
      expect(tx.ticket.findUnique.mock.calls[0][0].where).toEqual({
        eventId_participantId: { eventId, participantId: 'u1' },
      });
    },
  );

  it('rejects an anonymous request', async () => {
    expect((await cancel()).status).toBe(401);
  });
});
