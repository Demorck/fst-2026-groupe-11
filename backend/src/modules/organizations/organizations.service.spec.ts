import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  MembershipStatus,
  OrganizationAction,
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
      findFirst: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      count: vi.fn(),
    },
    organizationAuditLog: { create: vi.fn(), findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    event: { findUnique: vi.fn(), findMany: vi.fn() },
    eventOrganization: { count: vi.fn(), findFirst: vi.fn() },
    shiftAssignment: { deleteMany: vi.fn(), findMany: vi.fn() },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(),
  };
  // Both forms: a callback receives the same mocks, an array is already a list of calls
  prisma.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? arg(prisma) : Promise.all(arg as unknown[]),
  );
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

    // The answer is the same whoever the e-mail belongs to, so it cannot be used to probe for accounts
    it('answers the same and invites nobody for a participant', async () => {
      const prisma = setup();

      await expect(
        invite(prisma, { id: 'u2', role: Role.PARTICIPANT }),
      ).resolves.toEqual({ sent: true });
      expect(prisma.organizationMember.upsert).not.toHaveBeenCalled();
    });

    it('answers the same and invites nobody for an unknown e-mail', async () => {
      const prisma = setup();

      await expect(invite(prisma, null)).resolves.toEqual({ sent: true });
      expect(prisma.organizationMember.upsert).not.toHaveBeenCalled();
    });

    it.each([MembershipStatus.PENDING, MembershipStatus.ACCEPTED])(
      'answers the same and invites nobody when the user is already %s',
      async (status) => {
        const prisma = setup();

        await expect(
          invite(
            prisma,
            { id: 'u2', role: Role.VOLUNTEER },
            { status, invitedAt: new Date() },
          ),
        ).resolves.toEqual({ sent: true });
        expect(prisma.organizationMember.upsert).not.toHaveBeenCalled();
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
        invitedAt: new Date(),
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
      invitedAt: new Date(),
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
    const asSharedOrganization = (prisma: ReturnType<typeof setup>) => {
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', title: 'Futsal' });
      prisma.eventOrganization.findFirst.mockResolvedValue({
        organizationId: 'o1',
      });
    };

    it('removes the volunteer from every shift of the event and logs it', async () => {
      const prisma = setup();
      asSharedOrganization(prisma);
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 2 });

      const result = await (
        await build(prisma)
      ).removeVolunteerParticipation('boss', 'e1', 'vol');

      expect(result).toEqual({ removed: 2 });
      expect(prisma.shiftAssignment.deleteMany).toHaveBeenCalledWith({
        where: {
          volunteerId: 'vol',
          shift: { eventId: 'e1', startsAt: { gt: expect.any(Date) } },
        },
      });
      expect(prisma.organizationAuditLog.create).toHaveBeenCalledWith({
        data: {
          organizationId: 'o1',
          action: OrganizationAction.PARTICIPATION_REMOVED,
          actorId: 'boss',
          targetUserId: 'vol',
          eventId: 'e1',
          details: { eventTitle: 'Futsal', removedShifts: 2 },
        },
      });
    });

    it('throws 403 when no organization of the manager has this volunteer', async () => {
      const prisma = setup();
      prisma.event.findUnique.mockResolvedValue({ id: 'e1', title: 'Futsal' });
      prisma.eventOrganization.findFirst.mockResolvedValue(null);

      await expect(
        (await build(prisma)).removeVolunteerParticipation('boss', 'e1', 'vol'),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.shiftAssignment.deleteMany).not.toHaveBeenCalled();
    });

    it('throws 404 for an unknown event, and logs nothing for a volunteer not registered', async () => {
      const prisma = setup();
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(
        (await build(prisma)).removeVolunteerParticipation('boss', 'e1', 'vol'),
      ).rejects.toBeInstanceOf(NotFoundException);

      asSharedOrganization(prisma);
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 0 });
      await expect(
        (await build(prisma)).removeVolunteerParticipation('boss', 'e1', 'vol'),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.organizationAuditLog.create).not.toHaveBeenCalled();
    });
  });

  describe('invitation lifecycle', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const pending = (ageDays: number) => ({
      id: 'm1',
      userId: 'u2',
      status: MembershipStatus.PENDING,
      invitedAt: new Date(Date.now() - ageDays * DAY),
    });

    it('lists only the invitations younger than 7 days', async () => {
      const prisma = setup();
      prisma.organizationMember.findMany.mockResolvedValue([]);

      await (await build(prisma)).listInvitations('u2');

      const { where } = prisma.organizationMember.findMany.mock.calls[0][0];
      const cutoff = where.invitedAt.gt as Date;
      expect(Date.now() - cutoff.getTime()).toBeGreaterThan(6.99 * DAY);
      expect(Date.now() - cutoff.getTime()).toBeLessThan(7.01 * DAY);
    });

    it.each(['accept', 'decline'] as const)(
      'refuses to %s an expired invitation with 409',
      async (answer) => {
        const prisma = setup();
        prisma.organizationMember.findUnique.mockResolvedValue(pending(8));

        await expect((await build(prisma))[answer]('m1', 'u2')).rejects.toThrow(
          'Invitation expired',
        );
        expect(prisma.organizationMember.update).not.toHaveBeenCalled();
      },
    );

    it('invites again someone whose invitation expired, restarting the 7 days', async () => {
      const prisma = setup();
      asManager(prisma);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: Role.VOLUNTEER,
      });
      prisma.organizationMember.findUnique.mockResolvedValueOnce(pending(10));
      prisma.organizationMember.upsert.mockResolvedValue({ id: 'm1' });

      await (await build(prisma)).invite('o1', 'b@x.fr', 'u1');

      const { update } = prisma.organizationMember.upsert.mock.calls[0][0];
      expect(update.status).toBe(MembershipStatus.PENDING);
      expect(Date.now() - update.invitedAt.getTime()).toBeLessThan(1000);
    });

    it.each([
      MembershipStatus.CANCELLED,
      MembershipStatus.REMOVED,
      MembershipStatus.LEFT,
    ])('invites again someone whose membership is %s', async (status) => {
      const prisma = setup();
      asManager(prisma);
      prisma.user.findUnique.mockResolvedValue({
        id: 'u2',
        role: Role.VOLUNTEER,
      });
      prisma.organizationMember.findUnique.mockResolvedValueOnce({
        status,
        invitedAt: new Date(),
      });
      prisma.organizationMember.upsert.mockResolvedValue({ id: 'm1' });

      await (await build(prisma)).invite('o1', 'b@x.fr', 'u1');

      expect(prisma.organizationMember.upsert).toHaveBeenCalled();
    });

    it('cancels a pending invitation and logs it', async () => {
      const prisma = setup();
      asManager(prisma);
      prisma.organizationMember.findFirst.mockResolvedValue(pending(1));
      prisma.organizationMember.update.mockResolvedValue({
        id: 'm1',
        status: MembershipStatus.CANCELLED,
      });

      const result = await (
        await build(prisma)
      ).cancelInvitation('o1', 'm1', 'boss');

      expect(result).toEqual({ id: 'm1', status: MembershipStatus.CANCELLED });

      expect(prisma.organizationMember.update).toHaveBeenCalledWith({
        where: { id: 'm1' },
        data: { status: MembershipStatus.CANCELLED },
        select: { id: true, status: true },
      });
      expect(prisma.organizationAuditLog.create.mock.calls[0][0].data).toEqual({
        organizationId: 'o1',
        action: OrganizationAction.INVITATION_CANCELLED,
        actorId: 'boss',
        targetUserId: 'u2',
      });
    });

    it('refuses to cancel an invitation that is not pending, or unknown', async () => {
      const prisma = setup();
      asManager(prisma);
      prisma.organizationMember.findFirst.mockResolvedValue({
        ...pending(1),
        status: MembershipStatus.ACCEPTED,
      });
      await expect(
        (await build(prisma)).cancelInvitation('o1', 'm1', 'boss'),
      ).rejects.toBeInstanceOf(ConflictException);

      const missing = setup();
      asManager(missing);
      missing.organizationMember.findFirst.mockResolvedValue(null);
      await expect(
        (await build(missing)).cancelInvitation('o1', 'm1', 'boss'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('ending a membership', () => {
    const volunteer = {
      id: 'm2',
      userId: 'vol',
      role: OrganizationRole.VOLUNTEER,
      status: MembershipStatus.ACCEPTED,
    };

    it('removes a member, takes them off their upcoming shifts and logs it', async () => {
      const prisma = setup();
      asManager(prisma);
      prisma.organizationMember.findFirst.mockResolvedValue(volunteer);
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 3 });

      const result = await (
        await build(prisma)
      ).removeMember('o1', 'm2', 'boss');

      expect(result).toEqual({ removedShifts: 3 });
      expect(prisma.organizationMember.update).toHaveBeenCalledWith({
        where: { id: 'm2' },
        data: { status: MembershipStatus.REMOVED },
      });
      expect(
        prisma.organizationAuditLog.create.mock.calls[0][0].data,
      ).toMatchObject({
        action: OrganizationAction.MEMBER_REMOVED,
        actorId: 'boss',
        targetUserId: 'vol',
        details: { removedShifts: 3 },
      });
    });

    it('only removes upcoming shifts that no other organization of the member covers', async () => {
      const prisma = setup();
      asManager(prisma);
      prisma.organizationMember.findFirst.mockResolvedValue(volunteer);
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 0 });

      await (await build(prisma)).removeMember('o1', 'm2', 'boss');

      const { where } = prisma.shiftAssignment.deleteMany.mock.calls[0][0];
      expect(where.volunteerId).toBe('vol');
      expect(where.shift.startsAt.gt).toBeInstanceOf(Date);
      expect(where.shift.event.organizations).toEqual({
        some: { organizationId: 'o1' },
      });
      // the update runs first, so 'o1' is no longer one of the member's organizations
      expect(
        prisma.organizationMember.update.mock.invocationCallOrder[0],
      ).toBeLessThan(
        prisma.shiftAssignment.deleteMany.mock.invocationCallOrder[0],
      );
      expect(
        where.shift.event.NOT.organizations.some.organization.members.some,
      ).toEqual({
        userId: 'vol',
        role: OrganizationRole.VOLUNTEER,
        status: MembershipStatus.ACCEPTED,
      });
    });

    it('refuses to remove oneself, an unknown or former member', async () => {
      const prisma = setup();
      asManager(prisma);
      prisma.organizationMember.findFirst.mockResolvedValue({
        ...volunteer,
        userId: 'boss',
      });
      await expect(
        (await build(prisma)).removeMember('o1', 'm2', 'boss'),
      ).rejects.toBeInstanceOf(BadRequestException);

      const gone = setup();
      asManager(gone);
      gone.organizationMember.findFirst.mockResolvedValue({
        ...volunteer,
        status: MembershipStatus.LEFT,
      });
      await expect(
        (await build(gone)).removeMember('o1', 'm2', 'boss'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('lets a member leave', async () => {
      const prisma = setup();
      prisma.organizationMember.findUnique.mockResolvedValue(volunteer);
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 1 });

      await (await build(prisma)).leave('o1', 'vol');

      expect(prisma.organizationMember.update).toHaveBeenCalledWith({
        where: { id: 'm2' },
        data: { status: MembershipStatus.LEFT },
      });
      expect(
        prisma.organizationAuditLog.create.mock.calls[0][0].data,
      ).toMatchObject({
        action: OrganizationAction.MEMBER_LEFT,
        actorId: 'vol',
        targetUserId: 'vol',
      });
    });

    it('refuses to lose the last manager by leaving, checked under a lock', async () => {
      const prisma = setup();
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: 'm1',
        userId: 'boss2',
        role: OrganizationRole.MANAGER,
        status: MembershipStatus.ACCEPTED,
      });
      prisma.organizationMember.count.mockResolvedValue(0);

      await expect((await build(prisma)).leave('o1', 'boss2')).rejects.toThrow(
        'Last manager of the organization',
      );
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.organizationMember.update).not.toHaveBeenCalled();
    });

    describe('creator and co-managers', () => {
      const comanager = {
        id: 'm3',
        userId: 'boss2',
        role: OrganizationRole.MANAGER,
        status: MembershipStatus.ACCEPTED,
        invitedById: 'creator',
      };
      const asCreator = (prisma: ReturnType<typeof setup>) => {
        prisma.organization.findUnique.mockResolvedValue({ id: 'o1' });
        prisma.organizationMember.findUnique.mockResolvedValueOnce({
          ...manager,
          invitedById: null,
        });
      };

      const creator = {
        id: 'm1',
        userId: 'creator',
        role: OrganizationRole.MANAGER,
        status: MembershipStatus.ACCEPTED,
        invitedById: null,
      };

      it('keeps the creator from leaving while co-managers remain', async () => {
        const prisma = setup();
        prisma.organizationMember.findUnique.mockResolvedValue(creator);
        prisma.organizationMember.count.mockResolvedValue(1);

        await expect(
          (await build(prisma)).leave('o1', 'creator'),
        ).rejects.toThrow('The creator cannot leave while co-managers remain');
        expect(prisma.organizationMember.update).not.toHaveBeenCalled();
      });

      it('lets the creator leave once no co-manager is left', async () => {
        const prisma = setup();
        prisma.organizationMember.findUnique.mockResolvedValue(creator);
        prisma.organizationMember.count.mockResolvedValue(0);
        prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 0 });

        await expect(
          (await build(prisma)).leave('o1', 'creator'),
        ).resolves.toEqual({ removedShifts: 0 });
        expect(prisma.organizationMember.update).toHaveBeenCalledWith({
          where: { id: 'm1' },
          data: { status: MembershipStatus.LEFT },
        });
      });

      it('never removes the creator', async () => {
        const prisma = setup();
        asManager(prisma);
        prisma.organizationMember.findFirst.mockResolvedValue({
          ...comanager,
          id: 'm1',
          userId: 'creator',
          invitedById: null,
        });

        await expect(
          (await build(prisma)).removeMember('o1', 'm1', 'boss2'),
        ).rejects.toThrow('The creator cannot be removed');
        expect(prisma.organizationMember.update).not.toHaveBeenCalled();
      });

      it('does not let a co-manager remove another manager', async () => {
        const prisma = setup();
        asManager(prisma);
        prisma.organizationMember.findFirst.mockResolvedValue(comanager);

        await expect(
          (await build(prisma)).removeMember('o1', 'm3', 'boss'),
        ).rejects.toThrow('Only the creator can remove a manager');
        expect(prisma.organizationMember.update).not.toHaveBeenCalled();
      });

      it('lets a co-manager remove a volunteer', async () => {
        const prisma = setup();
        asManager(prisma);
        prisma.organizationMember.findFirst.mockResolvedValue(volunteer);
        prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 0 });

        await expect(
          (await build(prisma)).removeMember('o1', 'm2', 'boss'),
        ).resolves.toEqual({ removedShifts: 0 });
      });

      it('lets the creator remove a co-manager', async () => {
        const prisma = setup();
        asCreator(prisma);
        prisma.organizationMember.findFirst.mockResolvedValue(comanager);
        prisma.organizationMember.count.mockResolvedValue(1);
        prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 0 });

        await expect(
          (await build(prisma)).removeMember('o1', 'm3', 'creator'),
        ).resolves.toEqual({ removedShifts: 0 });
        expect(prisma.organizationMember.update).toHaveBeenCalledWith({
          where: { id: 'm3' },
          data: { status: MembershipStatus.REMOVED },
        });
      });
    });

    it('lets a manager leave when another manager remains', async () => {
      const prisma = setup();
      prisma.organizationMember.findUnique.mockResolvedValue({
        id: 'm1',
        userId: 'boss',
        role: OrganizationRole.MANAGER,
        status: MembershipStatus.ACCEPTED,
      });
      prisma.organizationMember.count.mockResolvedValue(1);
      prisma.shiftAssignment.deleteMany.mockResolvedValue({ count: 0 });

      await expect((await build(prisma)).leave('o1', 'boss')).resolves.toEqual({
        removedShifts: 0,
      });
    });

    it('refuses to leave an organization one does not belong to', async () => {
      const prisma = setup();
      prisma.organizationMember.findUnique.mockResolvedValue({
        ...volunteer,
        status: MembershipStatus.REMOVED,
      });

      await expect(
        (await build(prisma)).leave('o1', 'vol'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('audit log', () => {
    it('gives managers the latest entries with who and whom', async () => {
      const prisma = setup();
      asManager(prisma);
      prisma.organizationAuditLog.findMany.mockResolvedValue([
        {
          id: 'a1',
          action: OrganizationAction.MEMBER_REMOVED,
          actor: { id: 'boss', name: 'Océane' },
          targetUser: { id: 'vol', name: 'Bastien' },
        },
      ]);

      const entries = await (await build(prisma)).listAudit('o1', 'boss');

      expect(entries[0].target).toEqual({ id: 'vol', name: 'Bastien' });
      expect(entries[0]).not.toHaveProperty('targetUser');
      const args = prisma.organizationAuditLog.findMany.mock.calls[0][0];
      expect(args.take).toBe(100);
      expect(args.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('is refused to a volunteer', async () => {
      const prisma = setup();
      prisma.organization.findUnique.mockResolvedValue({ id: 'o1' });
      prisma.organizationMember.findUnique.mockResolvedValue({
        status: MembershipStatus.ACCEPTED,
        role: OrganizationRole.VOLUNTEER,
      });

      await expect(
        (await build(prisma)).listAudit('o1', 'vol'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('public page', () => {
    it('shows the organization with its upcoming events and their remaining seats', async () => {
      const prisma = setup();
      prisma.organization.findUnique.mockResolvedValue({
        id: 'o1',
        name: 'BDE',
        logoContentType: null,
        _count: { members: 4 },
        events: [
          {
            event: {
              id: 'e1',
              title: 'Gala',
              capacity: 50,
              _count: { tickets: 12 },
            },
          },
        ],
      });

      const page = await (await build(prisma)).findPublic('o1');

      expect(page).toEqual({
        id: 'o1',
        name: 'BDE',
        hasLogo: false,
        memberCount: 4,
        upcomingEvents: [
          { id: 'e1', title: 'Gala', capacity: 50, remainingSeats: 38 },
        ],
      });
      const args = prisma.organization.findUnique.mock.calls[0][0];
      expect(args.omit).toEqual({ logo: true });
      expect(args.include.events.where.event.startsAt.gte).toBeInstanceOf(Date);
    });

    it('answers 404 for an unknown organization', async () => {
      const prisma = setup();
      prisma.organization.findUnique.mockResolvedValue(null);

      await expect(
        (await build(prisma)).findPublic('o1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('volunteer hours', () => {
    const at = (hour: number) =>
      new Date(Date.UTC(2026, 5, 1) + hour * 3_600_000);
    const volunteers = [
      {
        userId: 'v1',
        status: MembershipStatus.ACCEPTED,
        user: { id: 'v1', name: 'Bastien' },
      },
      {
        userId: 'v2',
        status: MembershipStatus.LEFT,
        user: { id: 'v2', name: 'Bérénice' },
      },
      {
        userId: 'v3',
        status: MembershipStatus.ACCEPTED,
        user: { id: 'v3', name: 'Basile' },
      },
    ];
    const assignments = [
      { volunteerId: 'v1', shift: { startsAt: at(9), endsAt: at(11) } },
      { volunteerId: 'v1', shift: { startsAt: at(14), endsAt: at(15.5) } },
      { volunteerId: 'v2', shift: { startsAt: at(9), endsAt: at(10) } },
    ];

    const asMember = (
      prisma: ReturnType<typeof setup>,
      role: OrganizationRole,
    ) => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        status: MembershipStatus.ACCEPTED,
        role,
      });
      prisma.organizationMember.findMany.mockResolvedValue(volunteers);
      prisma.shiftAssignment.findMany.mockResolvedValue(assignments);
    };

    it('gives a manager the hours of every volunteer, former ones included', async () => {
      const prisma = setup();
      asMember(prisma, OrganizationRole.MANAGER);

      const rows = await (await build(prisma)).listHours('o1', 'boss');

      expect(rows).toEqual([
        {
          userId: 'v1',
          name: 'Bastien',
          status: 'ACCEPTED',
          shifts: 2,
          hours: 3.5,
        },
        { userId: 'v2', name: 'Bérénice', status: 'LEFT', shifts: 1, hours: 1 },
        {
          userId: 'v3',
          name: 'Basile',
          status: 'ACCEPTED',
          shifts: 0,
          hours: 0,
        },
      ]);
      const where = prisma.organizationMember.findMany.mock.calls[0][0].where;
      expect(where.status).toEqual({
        in: [
          MembershipStatus.ACCEPTED,
          MembershipStatus.LEFT,
          MembershipStatus.REMOVED,
        ],
      });
      expect(where).not.toHaveProperty('userId');
    });

    it('counts only shifts already over, on events of the organization', async () => {
      const prisma = setup();
      asMember(prisma, OrganizationRole.MANAGER);

      await (await build(prisma)).listHours('o1', 'boss');

      const { shift } = prisma.shiftAssignment.findMany.mock.calls[0][0].where;
      expect(shift.endsAt.lt).toBeInstanceOf(Date);
      expect(shift.event).toEqual({
        organizations: { some: { organizationId: 'o1' } },
      });
    });

    it('restricts a volunteer to their own row', async () => {
      const prisma = setup();
      asMember(prisma, OrganizationRole.VOLUNTEER);

      await (await build(prisma)).listHours('o1', 'v1');

      expect(
        prisma.organizationMember.findMany.mock.calls[0][0].where.userId,
      ).toBe('v1');
    });

    it('refuses someone who is not an accepted member', async () => {
      const prisma = setup();
      prisma.organizationMember.findUnique.mockResolvedValue({
        status: MembershipStatus.REMOVED,
        role: OrganizationRole.VOLUNTEER,
      });

      await expect(
        (await build(prisma)).listHours('o1', 'v1'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('attestation', () => {
    const at = (hour: number) =>
      new Date(Date.UTC(2026, 5, 1) + hour * 3_600_000);
    const arrange = (
      prisma: ReturnType<typeof setup>,
      status: MembershipStatus,
    ) => {
      prisma.organizationMember.findUnique.mockResolvedValue({
        status,
        user: { id: 'v1', name: 'Bastien' },
      });
      prisma.organization.findUnique.mockResolvedValue({
        id: 'o1',
        name: 'BDE',
        logoContentType: null,
      });
      prisma.shiftAssignment.findMany.mockResolvedValue([
        {
          shift: {
            title: 'Accueil',
            startsAt: at(9),
            endsAt: at(11),
            event: { id: 'e1', title: 'Gala' },
          },
        },
        {
          shift: {
            title: 'Rangement',
            startsAt: at(22),
            endsAt: at(23.5),
            event: { id: 'e1', title: 'Gala' },
          },
        },
      ]);
    };

    it('lets a volunteer get their own, with the total and each shift', async () => {
      const prisma = setup();
      arrange(prisma, MembershipStatus.ACCEPTED);

      const result = await (await build(prisma)).attestation('o1', 'v1', 'v1');

      expect(result.totalHours).toBe(3.5);
      expect(result.volunteer).toEqual({ id: 'v1', name: 'Bastien' });
      expect(result.shifts[0]).toMatchObject({
        eventTitle: 'Gala',
        shiftTitle: 'Accueil',
        hours: 2,
      });
      expect(result.organization.hasLogo).toBe(false);
    });

    it('stays available to someone who left', async () => {
      const prisma = setup();
      arrange(prisma, MembershipStatus.LEFT);

      await expect(
        (await build(prisma)).attestation('o1', 'v1', 'v1'),
      ).resolves.toMatchObject({ totalHours: 3.5 });
    });

    it('lets a manager get another volunteer’s, and refuses a plain member', async () => {
      const prisma = setup();
      arrange(prisma, MembershipStatus.ACCEPTED);
      prisma.organization.findUnique
        .mockResolvedValueOnce({ id: 'o1' }) // assertManager
        .mockResolvedValueOnce({
          id: 'o1',
          name: 'BDE',
          logoContentType: null,
        });
      prisma.organizationMember.findUnique
        .mockResolvedValueOnce({
          status: MembershipStatus.ACCEPTED,
          role: OrganizationRole.MANAGER,
        })
        .mockResolvedValueOnce({
          status: MembershipStatus.ACCEPTED,
          user: { id: 'v1', name: 'Bastien' },
        });
      await expect(
        (await build(prisma)).attestation('o1', 'v1', 'boss'),
      ).resolves.toMatchObject({ totalHours: 3.5 });

      const other = setup();
      other.organization.findUnique.mockResolvedValue({ id: 'o1' });
      other.organizationMember.findUnique.mockResolvedValue({
        status: MembershipStatus.ACCEPTED,
        role: OrganizationRole.VOLUNTEER,
      });
      await expect(
        (await build(other)).attestation('o1', 'v1', 'v2'),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('answers 404 for someone who never belonged to the organization', async () => {
      const prisma = setup();
      prisma.organizationMember.findUnique.mockResolvedValue({
        status: MembershipStatus.DECLINED,
      });

      await expect(
        (await build(prisma)).attestation('o1', 'v1', 'v1'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
