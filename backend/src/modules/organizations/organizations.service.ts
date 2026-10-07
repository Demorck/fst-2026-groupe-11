import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  OrganizationAction,
  OrganizationRole,
  Role,
  TicketStatus,
} from '@/generated/prisma/enums.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import type { ImageType } from './image-type.js';
import { omitLogo, toPublic } from './public-organization.js';

/** What a volunteer can do on an event, from the organizations that run it. */
export type VolunteerStatus = 'ASSIGNED' | 'AVAILABLE';

const SHOWN_TO_MANAGERS: MembershipStatus[] = [
  MembershipStatus.ACCEPTED,
  MembershipStatus.PENDING,
  MembershipStatus.DECLINED,
];

// Members whose past shifts still count for the hours and the attestation, even after they left
const WITH_HISTORY: MembershipStatus[] = [
  MembershipStatus.ACCEPTED,
  MembershipStatus.LEFT,
  MembershipStatus.REMOVED,
];

const hoursBetween = (start: Date, end: Date) =>
  Math.round(((end.getTime() - start.getTime()) / 3_600_000) * 100) / 100;

const isUniqueViolation = (error: unknown) =>
  (error as { code?: string }).code === 'P2002';

/** A pending invitation is valid for 7 days, then it is expired (computed on read, no scheduled job). */
export const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const isExpired = (invitedAt: Date) =>
  Date.now() - invitedAt.getTime() > INVITATION_TTL_MS;
const validSince = () => new Date(Date.now() - INVITATION_TTL_MS);

const INVITE_ANSWER = { sent: true };

// The creator is the only member nobody invited
const isCreator = ({ invitedById }: { invitedById: string | null }) =>
  invitedById === null;

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrganizationDto, userId: string) {
    try {
      const organization = await this.prisma.organization.create({
        data: {
          ...dto,
          members: {
            create: {
              userId,
              role: OrganizationRole.MANAGER,
              status: MembershipStatus.ACCEPTED,
            },
          },
        },
        omit: omitLogo,
      });
      return toPublic(organization);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Organization name already used');
      }
      throw error;
    }
  }

  /** Organizations the user belongs to (invitation accepted), with their role in each. */
  async listMine(userId: string) {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId, status: MembershipStatus.ACCEPTED },
      include: { organization: { omit: omitLogo } },
      orderBy: { organization: { name: 'asc' } },
    });
    return memberships.map(({ role, organization }) => ({
      ...toPublic(organization),
      role,
    }));
  }

  async listInvitations(userId: string) {
    const invitations = await this.prisma.organizationMember.findMany({
      where: {
        userId,
        status: MembershipStatus.PENDING,
        invitedAt: { gt: validSince() },
      },
      include: { organization: { omit: omitLogo } },
      orderBy: { invitedAt: 'asc' },
    });
    return invitations.map(({ id, role, invitedAt, organization }) => ({
      id,
      role,
      createdAt: invitedAt,
      organization: toPublic(organization),
    }));
  }

  accept(invitationId: string, userId: string) {
    return this.answer(invitationId, userId, MembershipStatus.ACCEPTED);
  }

  decline(invitationId: string, userId: string) {
    return this.answer(invitationId, userId, MembershipStatus.DECLINED);
  }

  async findOne(id: string, userId: string) {
    const found = await this.prisma.organization.findUnique({
      where: { id },
      omit: omitLogo,
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!found) throw new NotFoundException('Organization not found');

    const { members, ...organization } = found;
    const me = members.find((member) => member.userId === userId);
    if (me?.status !== MembershipStatus.ACCEPTED) {
      throw new ForbiddenException('Not a member of this organization');
    }
    const manager = me.role === OrganizationRole.MANAGER;
    return {
      ...toPublic(organization),
      role: me.role,
      // Pending and declined invitations, and members' e-mails, are for managers only.
      // Cancelled invitations and people who left or were removed live in the audit log.
      members: members
        .filter(({ status }) =>
          manager
            ? SHOWN_TO_MANAGERS.includes(status)
            : status === MembershipStatus.ACCEPTED,
        )
        .map(
          ({ id: memberId, role, status, invitedAt, invitedById, user }) => ({
            id: memberId,
            role,
            status,
            isCreator: isCreator({ invitedById }),
            expired:
              status === MembershipStatus.PENDING && isExpired(invitedAt),
            user: {
              id: user.id,
              name: user.name,
              ...(manager && { email: user.email }),
            },
          }),
        ),
    };
  }

  async update(id: string, dto: UpdateOrganizationDto, userId: string) {
    await this.assertManager(id, userId);
    try {
      return toPublic(
        await this.prisma.organization.update({
          where: { id },
          data: dto,
          omit: omitLogo,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Organization name already used');
      }
      throw error;
    }
  }

  async invite(organizationId: string, email: string, inviterId: string) {
    await this.assertManager(organizationId, inviterId);

    const user = await this.prisma.user.findUnique({ where: { email } });
    // Same answer whoever the email belongs to, so it cannot be used to probe for accounts
    if (!user || user.role === Role.PARTICIPANT) return INVITE_ANSWER;
    // An organizer joins as a co-manager, a volunteer as a volunteer
    const role =
      user.role === Role.ORGANIZER
        ? OrganizationRole.MANAGER
        : OrganizationRole.VOLUNTEER;

    const where = {
      organizationId_userId: { organizationId, userId: user.id },
    };
    const existing = await this.prisma.organizationMember.findUnique({ where });
    const accepted = existing?.status === MembershipStatus.ACCEPTED;
    const waiting =
      existing?.status === MembershipStatus.PENDING &&
      !isExpired(existing.invitedAt);
    if (accepted || waiting) return INVITE_ANSWER;
    // Declined, cancelled, expired, left or removed: the invitation goes again on the same row
    await this.prisma.organizationMember.upsert({
      where,
      create: { organizationId, userId: user.id, role, invitedById: inviterId },
      update: {
        status: MembershipStatus.PENDING,
        role,
        invitedById: inviterId,
        invitedAt: new Date(),
      },
    });
    return INVITE_ANSWER;
  }

  /** Public page of an organization: who they are and what they run next. */
  async findPublic(id: string) {
    const found = await this.prisma.organization.findUnique({
      where: { id },
      omit: omitLogo,
      include: {
        _count: {
          select: { members: { where: { status: MembershipStatus.ACCEPTED } } },
        },
        events: {
          where: { event: { startsAt: { gte: new Date() } } },
          orderBy: { event: { startsAt: 'asc' } },
          take: 20,
          select: {
            event: {
              select: {
                id: true,
                title: true,
                startsAt: true,
                location: true,
                category: true,
                capacity: true,
                _count: {
                  select: {
                    tickets: { where: { status: TicketStatus.RESERVED } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!found) throw new NotFoundException('Organization not found');

    const { _count, events, ...organization } = found;
    return {
      ...toPublic(organization),
      memberCount: _count.members,
      upcomingEvents: events.map(({ event: { _count: seats, ...event } }) => ({
        ...event,
        remainingSeats: event.capacity - seats.tickets,
      })),
    };
  }

  /**
   * Volunteer hours of the organization: the length of their past shifts on its events. A manager
   * sees every volunteer, a volunteer only themself. An event run by two organizations counts for both.
   */
  async listHours(organizationId: string, userId: string) {
    const me = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (me?.status !== MembershipStatus.ACCEPTED) {
      throw new ForbiddenException('Not a member of this organization');
    }
    const manager = me.role === OrganizationRole.MANAGER;

    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: OrganizationRole.VOLUNTEER,
        status: { in: WITH_HISTORY },
        ...(!manager && { userId }),
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { user: { name: 'asc' } },
    });
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        volunteerId: { in: members.map((member) => member.userId) },
        shift: {
          endsAt: { lt: new Date() },
          event: { organizations: { some: { organizationId } } },
        },
      },
      select: {
        volunteerId: true,
        shift: { select: { startsAt: true, endsAt: true } },
      },
    });

    return members.map(({ userId: volunteerId, status, user }) => {
      const done = assignments.filter((a) => a.volunteerId === volunteerId);
      return {
        userId: volunteerId,
        name: user.name,
        status,
        shifts: done.length,
        hours:
          Math.round(
            done.reduce(
              (sum, { shift }) =>
                sum + hoursBetween(shift.startsAt, shift.endsAt),
              0,
            ) * 100,
          ) / 100,
      };
    });
  }

  /** Detail behind the hours of one volunteer, to print. A manager, or the volunteer themself. */
  async attestation(
    organizationId: string,
    volunteerId: string,
    requesterId: string,
  ) {
    if (requesterId !== volunteerId) {
      await this.assertManager(organizationId, requesterId);
    }
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId: volunteerId } },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!member || !WITH_HISTORY.includes(member.status)) {
      throw new NotFoundException('Volunteer not found in this organization');
    }
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      omit: omitLogo,
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: {
        volunteerId,
        shift: {
          endsAt: { lt: new Date() },
          event: { organizations: { some: { organizationId } } },
        },
      },
      orderBy: { shift: { startsAt: 'asc' } },
      select: {
        shift: {
          select: {
            title: true,
            startsAt: true,
            endsAt: true,
            event: { select: { id: true, title: true } },
          },
        },
      },
    });
    const shifts = assignments.map(({ shift }) => ({
      eventId: shift.event.id,
      eventTitle: shift.event.title,
      shiftTitle: shift.title,
      startsAt: shift.startsAt,
      endsAt: shift.endsAt,
      hours: hoursBetween(shift.startsAt, shift.endsAt),
    }));
    return {
      organization: toPublic(organization),
      volunteer: member.user,
      issuedAt: new Date(),
      totalHours:
        Math.round(shifts.reduce((sum, shift) => sum + shift.hours, 0) * 100) /
        100,
      shifts,
    };
  }

  async cancelInvitation(
    organizationId: string,
    memberId: string,
    actorId: string,
  ) {
    await this.assertManager(organizationId, actorId);
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) throw new NotFoundException('Invitation not found');
    if (member.status !== MembershipStatus.PENDING) {
      throw new ConflictException('Not a pending invitation');
    }
    const [cancelled] = await this.prisma.$transaction([
      this.prisma.organizationMember.update({
        where: { id: memberId },
        data: { status: MembershipStatus.CANCELLED },
        select: { id: true, status: true },
      }),
      this.prisma.organizationAuditLog.create({
        data: {
          organizationId,
          action: OrganizationAction.INVITATION_CANCELLED,
          actorId,
          targetUserId: member.userId,
        },
      }),
    ]);
    return cancelled;
  }

  /** A manager removes a member. */
  async removeMember(
    organizationId: string,
    memberId: string,
    actorId: string,
  ) {
    const actor = await this.assertManager(organizationId, actorId);
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member || member.status !== MembershipStatus.ACCEPTED) {
      throw new NotFoundException('Member not found');
    }
    if (member.userId === actorId) {
      throw new BadRequestException('Use leave to quit an organization');
    }
    if (isCreator(member)) {
      throw new ForbiddenException('The creator cannot be removed');
    }
    if (member.role === OrganizationRole.MANAGER && !isCreator(actor)) {
      throw new ForbiddenException('Only the creator can remove a manager');
    }
    return this.endMembership(
      organizationId,
      member,
      MembershipStatus.REMOVED,
      actorId,
      OrganizationAction.MEMBER_REMOVED,
    );
  }

  /** A member quits the organization. */
  async leave(organizationId: string, userId: string) {
    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (!member || member.status !== MembershipStatus.ACCEPTED) {
      throw new NotFoundException('Not a member of this organization');
    }
    return this.endMembership(
      organizationId,
      member,
      MembershipStatus.LEFT,
      userId,
      OrganizationAction.MEMBER_LEFT,
    );
  }

  /** The 100 latest removals and cancelled invitations, for the managers. */
  async listAudit(organizationId: string, userId: string) {
    await this.assertManager(organizationId, userId);
    const entries = await this.prisma.organizationAuditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        actor: { select: { id: true, name: true } },
        targetUser: { select: { id: true, name: true } },
      },
    });
    return entries.map(({ targetUser, ...entry }) => ({
      ...entry,
      target: targetUser,
    }));
  }

  async setLogo(
    id: string,
    userId: string,
    bytes: Buffer,
    contentType: ImageType,
  ) {
    await this.assertManager(id, userId);
    return toPublic(
      await this.prisma.organization.update({
        where: { id },
        data: { logo: new Uint8Array(bytes), logoContentType: contentType },
        omit: omitLogo,
      }),
    );
  }

  async getLogo(id: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: { logo: true, logoContentType: true },
    });
    if (!organization?.logo || !organization.logoContentType) {
      throw new NotFoundException('No logo');
    }
    return {
      bytes: organization.logo,
      contentType: organization.logoContentType,
    };
  }

  /** Throws 403 unless the user manages every one of these organizations. */
  async assertManagesAll(userId: string, organizationIds: string[]) {
    const ids = [...new Set(organizationIds)];
    const managed = await this.prisma.organizationMember.count({
      where: {
        userId,
        organizationId: { in: ids },
        role: OrganizationRole.MANAGER,
        status: MembershipStatus.ACCEPTED,
      },
    });
    if (managed !== ids.length) {
      throw new ForbiddenException(
        'You do not manage one of these organizations',
      );
    }
  }

  /** True when the user is a manager of at least one organization running the event. */
  async canManageEvent(userId: string, eventId: string) {
    const count = await this.prisma.eventOrganization.count({
      where: {
        eventId,
        organization: { members: { some: managerOf(userId) } },
      },
    });
    return count > 0;
  }

  /** True when the user is a volunteer of at least one organization running the event. */
  async isVolunteerOfEvent(userId: string, eventId: string) {
    const count = await this.prisma.eventOrganization.count({
      where: {
        eventId,
        organization: { members: { some: volunteerOf(userId) } },
      },
    });
    return count > 0;
  }

  /**
   * For each event, whether the user already works on it (ASSIGNED) or could (AVAILABLE).
   * Events the user has nothing to do with are absent from the map.
   */
  async volunteerStatuses(userId: string, eventIds: string[]) {
    if (eventIds.length === 0) return new Map<string, VolunteerStatus>();
    const assigned = {
      shifts: { some: { assignments: { some: { volunteerId: userId } } } },
    };
    const events = await this.prisma.event.findMany({
      where: {
        id: { in: eventIds },
        OR: [
          {
            organizations: {
              some: {
                organization: { members: { some: volunteerOf(userId) } },
              },
            },
          },
          assigned,
        ],
      },
      select: {
        id: true,
        shifts: {
          where: { assignments: { some: { volunteerId: userId } } },
          select: { id: true },
          take: 1,
        },
      },
    });
    return new Map<string, VolunteerStatus>(
      events.map(({ id, shifts }) => [
        id,
        shifts.length > 0 ? 'ASSIGNED' : 'AVAILABLE',
      ]),
    );
  }

  /**
   * A manager removes a volunteer from every shift of an event. Allowed only for a volunteer of an
   * organization that the manager manages and that runs the event. Logged in that organization.
   */
  async removeVolunteerParticipation(
    managerId: string,
    eventId: string,
    volunteerId: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, title: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const shared = await this.prisma.eventOrganization.findFirst({
      where: {
        eventId,
        organization: {
          AND: [
            { members: { some: managerOf(managerId) } },
            { members: { some: volunteerOf(volunteerId) } },
          ],
        },
      },
      select: { organizationId: true },
    });
    if (!shared) {
      throw new ForbiddenException(
        'Not a volunteer of one of your organizations',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const { count } = await tx.shiftAssignment.deleteMany({
        // Past shifts stay: they count for the hours and the attestation
        where: {
          volunteerId,
          shift: { eventId, startsAt: { gt: new Date() } },
        },
      });
      if (count === 0) {
        throw new NotFoundException('Not registered on this event');
      }
      await tx.organizationAuditLog.create({
        data: {
          organizationId: shared.organizationId,
          action: OrganizationAction.PARTICIPATION_REMOVED,
          actorId: managerId,
          targetUserId: volunteerId,
          eventId,
          details: { eventTitle: event.title, removedShifts: count },
        },
      });
      return { removed: count };
    });
  }

  /**
   * Ends a membership and takes the member off the upcoming shifts they can no longer do: those of
   * events that no other organization of theirs runs. Past shifts stay (hours, attestation).
   */
  private async endMembership(
    organizationId: string,
    member: {
      id: string;
      userId: string;
      role: OrganizationRole;
      invitedById: string | null;
    },
    status: MembershipStatus,
    actorId: string,
    action: OrganizationAction,
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (member.role === OrganizationRole.MANAGER) {
        // Managers leaving at the same time wait for each other, so the last one cannot slip through
        await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${organizationId} FOR UPDATE`;
        const otherManagers = await tx.organizationMember.count({
          where: {
            organizationId,
            role: OrganizationRole.MANAGER,
            status: MembershipStatus.ACCEPTED,
            id: { not: member.id },
          },
        });
        // The creator hands the organization over first, then may leave as its only manager
        if (isCreator(member) && otherManagers > 0) {
          throw new ConflictException(
            'The creator cannot leave while co-managers remain',
          );
        }
        if (!isCreator(member) && otherManagers === 0) {
          throw new ConflictException('Last manager of the organization');
        }
      }
      // First, so that this organization no longer counts as one the member belongs to
      await tx.organizationMember.update({
        where: { id: member.id },
        data: { status },
      });
      const { count } = await tx.shiftAssignment.deleteMany({
        where: {
          volunteerId: member.userId,
          shift: {
            startsAt: { gt: new Date() },
            event: {
              organizations: { some: { organizationId } },
              NOT: {
                organizations: {
                  some: {
                    organization: {
                      members: { some: volunteerOf(member.userId) },
                    },
                  },
                },
              },
            },
          },
        },
      });
      await tx.organizationAuditLog.create({
        data: {
          organizationId,
          action,
          actorId,
          targetUserId: member.userId,
          details: { removedShifts: count },
        },
      });
      return { removedShifts: count };
    });
  }

  private async answer(
    invitationId: string,
    userId: string,
    status: MembershipStatus,
  ) {
    const invitation = await this.prisma.organizationMember.findUnique({
      where: { id: invitationId },
    });
    // Another user's invitation looks like a missing one
    if (invitation?.userId !== userId) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== MembershipStatus.PENDING) {
      throw new ConflictException('Invitation already answered');
    }
    if (isExpired(invitation.invitedAt)) {
      throw new ConflictException('Invitation expired');
    }
    return this.prisma.organizationMember.update({
      where: { id: invitationId },
      data: { status },
      select: { id: true, role: true, status: true },
    });
  }

  private async assertManager(organizationId: string, userId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');

    const member = await this.prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
    if (
      member?.status !== MembershipStatus.ACCEPTED ||
      member.role !== OrganizationRole.MANAGER
    ) {
      throw new ForbiddenException('Not a manager of this organization');
    }
    return member;
  }
}

const managerOf = (userId: string) => ({
  userId,
  role: OrganizationRole.MANAGER,
  status: MembershipStatus.ACCEPTED,
});

const volunteerOf = (userId: string) => ({
  userId,
  role: OrganizationRole.VOLUNTEER,
  status: MembershipStatus.ACCEPTED,
});
