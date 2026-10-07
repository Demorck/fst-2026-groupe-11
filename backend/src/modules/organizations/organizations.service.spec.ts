import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MembershipStatus,
  OrganizationRole,
  Role,
} from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrganizationsService } from './organizations.service.js';

const manager = {
  status: MembershipStatus.ACCEPTED,
  role: OrganizationRole.MANAGER,
};

// Every model method is a mock; each test sets the ones it reads
function setup() {
  const prisma = {
    organization: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    organizationMember: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    user: { findUnique: vi.fn() },
    event: { findUnique: vi.fn(), findMany: vi.fn() },
    eventOrganization: { count: vi.fn() },
    shiftAssignment: { deleteMany: vi.fn() },
  };
  return prisma;
}

async function build(prisma: ReturnType<typeof setup>) {
  const module = await Test.createTestingModule({
    providers: [
      OrganizationsService,
      { provide: PrismaService, useValue: prisma },
    ],
  }).compile();
  return module.get(OrganizationsService);
}

// An organization the user manages, for the methods that start by checking it
function asManager(prisma: ReturnType<typeof setup>) {
  prisma.organization.findUnique.mockResolvedValue({ id: 'o1' });
  prisma.organizationMember.findUnique.mockResolvedValueOnce(manager);
}

describe('OrganizationsService', () => {
  describe('create', () => {
    it('makes the author an accepted manager, without loading the logo', async () => {
      const prisma = setup();
      prisma.organization.create.mockResolvedValue({
        id: 'o1',
        name: 'BDE',
        logoContentType: null,
      });

      const result = await (await build(prisma)).create({ name: 'BDE' }, 'u1');

      const args = prisma.organization.create.mock.calls[0][0];
      expect(args.data.members.create).toEqual({
        userId: 'u1',
        role: OrganizationRole.MANAGER,
        status: MembershipStatus.ACCEPTED,
      });
      expect(args.omit).toEqual({ logo: true });
      expect(result).toEqual({ id: 'o1', name: 'BDE', hasLogo: false });
    });

    it('throws 409 when the name is already used', async () => {
      const prisma = setup();
      prisma.organization.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        (await build(prisma)).create({ name: 'BDE' }, 'u1'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('invite', () => {
    const invite = async (
      prisma: ReturnType<typeof setup>,
      user: object | null,
      existing: object | null = null,
    ) => {
      asManager(prisma);
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.organizationMember.findUnique.mockResolvedValueOnce(existing);
      prisma.organizationMember.upsert.mockResolvedValue({ id: 'm1' });
      return (await build(prisma)).invite('o1', 'b@x.fr', 'u1');
    };

    it('invites a volunteer as a pending volunteer', async () => {
      const prisma = setup();

      await invite(prisma, { id: 'u2', role: Role.VOLUNTEER });

      expect(prisma.organizationMember.upsert.mock.calls[0][0].create).toEqual({
        organizationId: 'o1',
        userId: 'u2',
        role: OrganizationRole.VOLUNTEER,
        invitedById: 'u1',
      });
    });

    it('invites another organizer as a co-manager', async () => {
      const prisma = setup();

      await invite(prisma, { id: 'u2', role: Role.ORGANIZER });

      expect(
        prisma.organizationMember.upsert.mock.calls[0][0].create.role,
      ).toBe(OrganizationRole.MANAGER);
    });

    it('refuses a participant', async () => {
      const prisma = setup();

      await expect(
        invite(prisma, { id: 'u2', role: Role.PARTICIPANT }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws 404 for an unknown e-mail', async () => {
      await expect(invite(setup(), null)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it.each([MembershipStatus.PENDING, MembershipStatus.ACCEPTED])(
      'throws 409 when the user is already %s',
      async (status) => {
        await expect(
          invite(setup(), { id: 'u2', role: Role.VOLUNTEER }, { status }),
        ).rejects.toBeInstanceOf(ConflictException);
      },
    );

    it('sends a declined invitation again on the same row', async () => {
      const prisma = setup();

      await invite(
        prisma,
        { id: 'u2', role: Role.VOLUNTEER },
        { status: MembershipStatus.DECLINED },
      );

      expect(
        prisma.organizationMember.upsert.mock.calls[0][0].update.status,
      ).toBe(MembershipStatus.PENDING);
    });

    it('refuses a volunteer member and an unknown organization', async () => {
      const prisma = setup();
      prisma.organization.findUnique.mockResolvedValue({ id: 'o1' });
      prisma.organizationMember.findUnique.mockResolvedValue({
        status: MembershipStatus.ACCEPTED,
        role: OrganizationRole.VOLUNTEER,
      });
      await expect(
        (await build(prisma)).invite('o1', 'b@x.fr', 'u1'),
      ).rejects.toBeInstanceOf(ForbiddenException);

      const missing = setup();
      missing.organization.findUnique.mockResolvedValue(null);
      await expect(
        (await build(missing)).invite('o1', 'b@x.fr', 'u1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('answering an invitation', () => {
    it('lets the invited user accept it', async () => {
      const prisma = setup();
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: 'm1',
        userId: 'u2',
        status: MembershipStatus.PENDING,
      });
      prisma.organizationMember.update.mockResolvedValue({ id: 'm1' });

      await (await build(prisma)).accept('m1', 'u2');

      expect(prisma.organizationMember.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: MembershipStatus.ACCEPTED },
        }),
      );
    });

    it("hides someone else's invitation behind a 404", async () => {
      const prisma = setup();
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: 'm1',
        userId: 'u2',
        status: MembershipStatus.PENDING,
      });

      await expect(
        (await build(prisma)).decline('m1', 'intruder'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.organizationMember.update).not.toHaveBeenCalled();
    });

    it('throws 409 when it was already answered', async () => {
      const prisma = setup();
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: 'm1',
        userId: 'u2',
        status: MembershipStatus.ACCEPTED,
      });

      await expect(
        (await build(prisma)).accept('m1', 'u2'),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('findOne', () => {
    const member = (
      id: string,
      userId: string,
      role: OrganizationRole,
      status: MembershipStatus,
    ) => ({
      id,
      userId,
      role,
      status,
      user: { id: userId, name: `Name ${userId}`, email: `${userId}@x.fr` },
    });
    const organization = {
      id: 'o1',
      name: 'BDE',
      logoContentType: 'image/png',
      members: [
        member(
          'm1',
          'boss',
          OrganizationRole.MANAGER,
          MembershipStatus.ACCEPTED,
        ),
        member(
          'm2',
          'vol',
          OrganizationRole.VOLUNTEER,
          MembershipStatus.ACCEPTED,
        ),
        member(
          'm3',
          'wait',
          OrganizationRole.VOLUNTEER,
          MembershipStatus.PENDING,
        ),
      ],
    };

    it('shows managers every invitation and the e-mails', async () => {
      const prisma = setup();
      prisma.organization.findUnique.mockResolvedValue(organization);

      const result = await (await build(prisma)).findOne('o1', 'boss');

      expect(result.hasLogo).toBe(true);
      expect(result.role).toBe(OrganizationRole.MANAGER);
      expect(result.members.map((m) => m.status)).toContain(
        MembershipStatus.PENDING,
      );
      expect(result.members[0].user).toHaveProperty('email');
    });

    it('shows volunteers only the accepted members, without e-mails', async () => {
      const prisma = setup();
      prisma.organization.findUnique.mockResolvedValue(organization);

      const result = await (await build(prisma)).findOne('o1', 'vol');

      expect(result.members).toHaveLength(2);
      expect(result.members.every((m) => !('email' in m.user))).toBe(true);
    });

    it('refuses non-members and pending invitees with 403, unknown ids with 404', async () => {
      const prisma = setup();
      prisma.organization.findUnique.mockResolvedValue(organization);
      const service = await build(prisma);

      await expect(service.findOne('o1', 'stranger')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      await expect(service.findOne('o1', 'wait')).rejects.toBeInstanceOf(
        ForbiddenException,
      );

      prisma.organization.findUnique.mockResolvedValue(null);
      await expect(service.findOne('o1', 'boss')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('logo', () => {
    it('stores the bytes with their detected type, for a manager', async () => {
      const prisma = setup();
      asManager(prisma);
      prisma.organization.update.mockResolvedValue({
        id: 'o1',
        logoContentType: 'image/png',
      });

      const result = await (
        await build(prisma)
      ).setLogo('o1', 'u1', Buffer.from([1, 2, 3]), 'image/png');

      const { data, omit } = prisma.organization.update.mock.calls[0][0];
      expect(data.logoContentType).toBe('image/png');
      expect(Array.from(data.logo)).toEqual([1, 2, 3]);
      expect(omit).toEqual({ logo: true });
      expect(result.hasLogo).toBe(true);
    });

    it('answers 404 when there is no logo', async () => {
      const prisma = setup();
      prisma.organization.findUnique.mockResolvedValue({
        logo: null,
        logoContentType: null,
      });

      await expect((await build(prisma)).getLogo('o1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('assertManagesAll', () => {
    it('passes when the user manages every organization, ignoring duplicates', async () => {
      const prisma = setup();
      prisma.organizationMember.count.mockResolvedValue(2);

      await expect(
        (await build(prisma)).assertManagesAll('u1', ['o1', 'o2', 'o1']),
      ).resolves.toBeUndefined();
      expect(prisma.organizationMember.count.mock.calls[0][0].where).toEqual({
        userId: 'u1',
        organizationId: { in: ['o1', 'o2'] },
        role: OrganizationRole.MANAGER,
        status: MembershipStatus.ACCEPTED,
      });
    });

    it('throws 403 when one of them is not managed', async () => {
      const prisma = setup();
      prisma.organizationMember.count.mockResolvedValue(1);

      await expect(
        (await build(prisma)).assertManagesAll('u1', ['o1', 'o2']),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('event rules', () => {
    it.each([
      [1, true],
      [0, false],
    ])(
      'canManageEvent with %i matching organization -> %s',
      async (count, expected) => {
        const prisma = setup();
        prisma.eventOrganization.count.mockResolvedValue(count);

        expect(await (await build(prisma)).canManageEvent('u1', 'e1')).toBe(
          expected,
        );
      },
    );

    it('reports ASSIGNED, AVAILABLE and nothing for unrelated events', async () => {
      const prisma = setup();
      prisma.event.findMany.mockResolvedValue([
        { id: 'e1', shifts: [{ id: 's1' }] },
        { id: 'e2', shifts: [] },
      ]);

      const statuses = await (
        await build(prisma)
      ).volunteerStatuses('u1', ['e1', 'e2', 'e3']);

      expect(statuses.get('e1')).toBe('ASSIGNED');
      expect(statuses.get('e2')).toBe('AVAILABLE');
      expect(statuses.has('e3')).toBe(false);
    });

    it('skips the query without events', async () => {
      const prisma = setup();

      expect(
        (await (await build(prisma)).volunteerStatuses('u1', [])).size,
      ).toBe(0);
      expect(prisma.event.findMany).not.toHaveBeenCalled();
    });
  });

  describe('removeVolunteerParticipation', () => {
    it('removes the volunteer from every shift of the event', async () => {
      const prisma = setup();
      prisma.event.findUnique.mockResolvedValue({ id: 'e1' });
      prisma.eventOrganization.count.mockResolvedValue(1);
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 2 });

      const result = await (
        await build(prisma)
      ).removeVolunteerParticipation('boss', 'e1', 'vol');

      expect(result).toEqual({ removed: 2 });
      expect(prisma.shiftAssignment.deleteMany).toHaveBeenCalledWith({
        where: { volunteerId: 'vol', shift: { eventId: 'e1' } },
      });
    });

    it('throws 403 when no organization of the manager has this volunteer', async () => {
      const prisma = setup();
      prisma.event.findUnique.mockResolvedValue({ id: 'e1' });
      prisma.eventOrganization.count.mockResolvedValue(0);

      await expect(
        (await build(prisma)).removeVolunteerParticipation('boss', 'e1', 'vol'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.shiftAssignment.deleteMany).not.toHaveBeenCalled();
    });

    it('throws 404 for an unknown event or a volunteer not registered', async () => {
      const prisma = setup();
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(
        (await build(prisma)).removeVolunteerParticipation('boss', 'e1', 'vol'),
      ).rejects.toBeInstanceOf(NotFoundException);

      prisma.event.findUnique.mockResolvedValue({ id: 'e1' });
      prisma.eventOrganization.count.mockResolvedValue(1);
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 0 });
      await expect(
        (await build(prisma)).removeVolunteerParticipation('boss', 'e1', 'vol'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
