import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import {
  MembershipStatus,
  OrganizationRole,
  Role,
} from '../src/generated/prisma/enums.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

const ORG = '11111111-1111-4111-8111-111111111111';
const EVENT = '22222222-2222-4222-8222-222222222222';
const USER = '33333333-3333-4333-8333-333333333333';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

describe('Organizations (e2e)', () => {
  let app: INestApplication<App>;
  let jwt: JwtService;
  const prisma = {
    organization: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    organizationMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    event: { findUnique: vi.fn() },
    eventOrganization: { count: vi.fn(), findFirst: vi.fn() },
    organizationAuditLog: { create: vi.fn(), findMany: vi.fn() },
    shiftAssignment: { deleteMany: vi.fn(), findMany: vi.fn() },
    $transaction: vi.fn(),
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
    // Same pipe as main.ts: DTO validation is part of what is tested here
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    jwt = app.get(JwtService);
    vi.clearAllMocks();
    prisma.$transaction.mockImplementation((arg: unknown) =>
      typeof arg === 'function' ? arg(prisma) : Promise.all(arg as unknown[]),
    );
  });

  afterEach(async () => {
    await app.close();
  });

  const as = async (role: Role) =>
    `Bearer ${await jwt.signAsync({ sub: USER, role })}`;
  const api = () => request(app.getHttpServer());

  it('lets an organizer create an organization, refuses a participant and anonymous', async () => {
    prisma.organization.create.mockResolvedValue({
      id: ORG,
      name: 'BDE',
      logoContentType: null,
    });
    const send = (auth?: string) => {
      const req = api().post('/api/organizations').send({ name: 'BDE' });
      return auth ? req.set('Authorization', auth) : req;
    };

    expect((await send()).status).toBe(401);
    expect((await send(await as(Role.PARTICIPANT))).status).toBe(403);
    const created = await send(await as(Role.ORGANIZER));
    expect(created.status).toBe(201);
    expect(created.body.hasLogo).toBe(false);
  });

  it('rejects an invalid name with 400', async () => {
    const res = await api()
      .post('/api/organizations')
      .set('Authorization', await as(Role.ORGANIZER))
      .send({ name: '   ' });

    expect(res.status).toBe(400);
  });

  it('serves "mine" before the :id route', async () => {
    prisma.organizationMember.findMany.mockResolvedValue([]);

    const res = await api()
      .get('/api/organizations/mine')
      .set('Authorization', await as(Role.VOLUNTEER));

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  describe('logo', () => {
    const asManager = () => {
      prisma.organization.findUnique.mockResolvedValue({ id: ORG });
      prisma.organizationMember.findUnique.mockResolvedValue({
        status: MembershipStatus.ACCEPTED,
        role: OrganizationRole.MANAGER,
      });
      prisma.organization.update.mockImplementation(({ data }) => ({
        id: ORG,
        logoContentType: data.logoContentType,
      }));
    };
    const put = async (body: Buffer | string) =>
      api()
        .put(`/api/organizations/${ORG}/logo`)
        .set('Authorization', await as(Role.ORGANIZER))
        .set('Content-Type', 'image/png')
        .send(body);

    it('is public and served with safe headers', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        logo: new Uint8Array(PNG),
        logoContentType: 'image/png',
      });

      const res = await api().get(`/api/organizations/${ORG}/logo`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['cache-control']).toContain('max-age');
      expect(res.body).toEqual(PNG);
    });

    it('answers 404 when there is no logo', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        logo: null,
        logoContentType: null,
      });

      expect((await api().get(`/api/organizations/${ORG}/logo`)).status).toBe(
        404,
      );
    });

    it('stores a png sent by a manager', async () => {
      asManager();

      const res = await put(PNG);

      expect(res.status).toBe(200);
      expect(res.body.hasLogo).toBe(true);
      expect(
        prisma.organization.update.mock.calls[0][0].data.logoContentType,
      ).toBe('image/png');
    });

    it('refuses content that is not an image, whatever its Content-Type', async () => {
      asManager();

      expect((await put('<svg onload="alert(1)"/>')).status).toBe(400);
      expect(prisma.organization.update).not.toHaveBeenCalled();
    });

    it('refuses a logo over 512 KB with 413', async () => {
      asManager();

      const res = await put(Buffer.concat([PNG, Buffer.alloc(513 * 1024)]));

      expect(res.status).toBe(413);
    });

    it('refuses a volunteer', async () => {
      const res = await api()
        .put(`/api/organizations/${ORG}/logo`)
        .set('Authorization', await as(Role.VOLUNTEER))
        .set('Content-Type', 'image/png')
        .send(PNG);

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /events/:eventId/volunteers/:volunteerId', () => {
    const remove = async (role: Role) =>
      api()
        .delete(`/api/events/${EVENT}/volunteers/${USER}`)
        .set('Authorization', await as(role));

    it('is reserved to organizers', async () => {
      expect((await remove(Role.VOLUNTEER)).status).toBe(403);
    });

    it('removes the participation of a volunteer of a shared organization', async () => {
      prisma.event.findUnique.mockResolvedValue({ id: EVENT, title: 'Gala' });
      prisma.eventOrganization.findFirst.mockResolvedValue({
        organizationId: ORG,
      });
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 1 });

      const res = await remove(Role.ORGANIZER);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ removed: 1 });
    });
  });

  describe('membership lifecycle', () => {
    const MEMBER = '44444444-4444-4444-8444-444444444444';
    const asManager = () => {
      prisma.organization.findUnique.mockResolvedValue({ id: ORG });
      prisma.organizationMember.findUnique.mockResolvedValue({
        status: MembershipStatus.ACCEPTED,
        role: OrganizationRole.MANAGER,
      });
    };

    it('lets a manager cancel an invitation and logs it', async () => {
      asManager();
      prisma.organizationMember.findFirst.mockResolvedValue({
        id: MEMBER,
        userId: 'u9',
        status: MembershipStatus.PENDING,
      });
      prisma.organizationMember.update.mockResolvedValue({});

      const res = await api()
        .delete(`/api/organizations/${ORG}/invitations/${MEMBER}`)
        .set('Authorization', await as(Role.ORGANIZER));

      expect(res.status).toBe(200);
      expect(prisma.organizationAuditLog.create).toHaveBeenCalled();
    });

    it('refuses a volunteer for cancelling, removing and reading the audit log', async () => {
      const auth = await as(Role.VOLUNTEER);

      for (const [method, path] of [
        ['delete', `/api/organizations/${ORG}/invitations/${MEMBER}`],
        ['delete', `/api/organizations/${ORG}/members/${MEMBER}`],
        ['get', `/api/organizations/${ORG}/audit`],
      ] as const) {
        const res = await api()[method](path).set('Authorization', auth);
        expect(res.status, path).toBe(403);
      }
    });

    it('lets a volunteer leave, answering with the removed shifts', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: MEMBER,
        userId: USER,
        role: OrganizationRole.VOLUNTEER,
        status: MembershipStatus.ACCEPTED,
      });
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 2 });

      const res = await api()
        .post(`/api/organizations/${ORG}/leave`)
        .set('Authorization', await as(Role.VOLUNTEER));

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ removedShifts: 2 });
    });

    it('refuses the last manager leaving with 409', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: MEMBER,
        userId: USER,
        role: OrganizationRole.MANAGER,
        status: MembershipStatus.ACCEPTED,
      });
      prisma.organizationMember.count.mockResolvedValue(0);

      const res = await api()
        .post(`/api/organizations/${ORG}/leave`)
        .set('Authorization', await as(Role.ORGANIZER));

      expect(res.status).toBe(409);
    });

    it('gives managers the audit log', async () => {
      asManager();
      prisma.organizationAuditLog.findMany.mockResolvedValue([
        { id: 'a1', actor: { id: 'x', name: 'X' }, targetUser: null },
      ]);

      const res = await api()
        .get(`/api/organizations/${ORG}/audit`)
        .set('Authorization', await as(Role.ORGANIZER));

      expect(res.status).toBe(200);
      expect(res.body[0].target).toBeNull();
    });
  });

  describe('public page, hours and attestation', () => {
    it('serves the public page without any token', async () => {
      prisma.organization.findUnique.mockResolvedValue({
        id: ORG,
        name: 'BDE',
        logoContentType: null,
        _count: { members: 3 },
        events: [],
      });

      const res = await api().get(`/api/organizations/${ORG}/public`);

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        name: 'BDE',
        memberCount: 3,
        upcomingEvents: [],
      });
    });

    it('answers 404 on the public page of an unknown organization', async () => {
      prisma.organization.findUnique.mockResolvedValue(null);

      expect((await api().get(`/api/organizations/${ORG}/public`)).status).toBe(
        404,
      );
    });

    it.each([
      ['hours', `/api/organizations/${ORG}/hours`],
      ['attestation', `/api/organizations/${ORG}/members/${USER}/attestation`],
    ])(
      'keeps %s private: 401 without token, 403 for a participant',
      async (_name, path) => {
        expect((await api().get(path)).status).toBe(401);
        expect(
          (
            await api()
              .get(path)
              .set('Authorization', await as(Role.PARTICIPANT))
          ).status,
        ).toBe(403);
      },
    );

    it('gives a volunteer of the organization their own hours', async () => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        status: MembershipStatus.ACCEPTED,
        role: OrganizationRole.VOLUNTEER,
      });
      prisma.organizationMember.findMany.mockResolvedValue([]);
      prisma.shiftAssignment.findMany.mockResolvedValue([]);

      const res = await api()
        .get(`/api/organizations/${ORG}/hours`)
        .set('Authorization', await as(Role.VOLUNTEER));

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });
});
