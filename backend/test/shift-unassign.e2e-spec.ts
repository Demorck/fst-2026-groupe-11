import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { Role } from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const shiftId = '44444444-4444-4444-8444-444444444444';

describe('DELETE /shifts/:id/assignments/me (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const prisma = {
    shiftAssignment: {
      findUnique: vi.fn(),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
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
    await app.init();
    jwt = app.get(JwtService);
    prisma.shiftAssignment.findUnique.mockReset();
    prisma.shiftAssignment.deleteMany.mockClear();
  });

  afterEach(async () => {
    await app.close();
  });

  const leave = async (role?: Role) => {
    const req = request(app.getHttpServer()).delete(
      `/api/shifts/${shiftId}/assignments/me`,
    );
    return role
      ? req.set(
          'Authorization',
          `Bearer ${await jwt.signAsync({ sub: 'u1', role })}`,
        )
      : req;
  };

  it.each([Role.VOLUNTEER, Role.ORGANIZER])(
    'removes the own assignment of a %s: 204',
    async (role) => {
      prisma.shiftAssignment.findUnique.mockResolvedValue({
        shift: { startsAt: new Date(Date.now() + 86_400_000) },
      });

      const res = await leave(role);

      expect(res.status).toBe(204);
      // The volunteer comes from the token, never from the request
      expect(prisma.shiftAssignment.deleteMany).toHaveBeenCalledWith({
        where: { shiftId, volunteerId: 'u1' },
      });
    },
  );

  it('answers 404 when not registered on the shift', async () => {
    prisma.shiftAssignment.findUnique.mockResolvedValue(null);

    expect((await leave(Role.VOLUNTEER)).status).toBe(404);
    expect(prisma.shiftAssignment.deleteMany).not.toHaveBeenCalled();
  });

  it('refuses a participant and an anonymous request', async () => {
    expect((await leave(Role.PARTICIPANT)).status).toBe(403);
    expect((await leave()).status).toBe(401);
  });
});
