import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  OrganizationRole,
  Role,
} from '@/generated/prisma/enums.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import type { ImageType } from './image-type.js';

/** What a volunteer can do on an event, from the organizations that run it. */
export type VolunteerStatus = 'ASSIGNED' | 'AVAILABLE';

// The logo can weigh 512 KB: it is never loaded with the other fields, `hasLogo` tells whether to fetch it
const omitLogo = { logo: true } as const;

const toPublic = <T extends { logoContentType: string | null }>({
  logoContentType,
  ...organization
}: T) => ({ ...organization, hasLogo: logoContentType !== null });

const isUniqueViolation = (error: unknown) =>
  (error as { code?: string }).code === 'P2002';

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
      where: { userId, status: MembershipStatus.PENDING },
      include: { organization: { omit: omitLogo } },
      orderBy: { createdAt: 'asc' },
    });
    return invitations.map(({ id, role, createdAt, organization }) => ({
      id,
      role,
      createdAt,
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
      // Pending and declined invitations, and members' e-mails, are for managers only
      members: members
        .filter(
          (member) => manager || member.status === MembershipStatus.ACCEPTED,
        )
        .map(({ id: memberId, role, status, user }) => ({
          id: memberId,
          role,
          status,
          user: {
            id: user.id,
            name: user.name,
            ...(manager && { email: user.email }),
          },
        })),
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
    if (!user) throw new NotFoundException('No account with this email');
    if (user.role === Role.PARTICIPANT) {
      throw new BadRequestException('Participants cannot join an organization');
    }
    // An organizer joins as a co-manager, a volunteer as a volunteer
    const role =
      user.role === Role.ORGANIZER
        ? OrganizationRole.MANAGER
        : OrganizationRole.VOLUNTEER;

    const where = {
      organizationId_userId: { organizationId, userId: user.id },
    };
    const existing = await this.prisma.organizationMember.findUnique({ where });
    if (existing && existing.status !== MembershipStatus.DECLINED) {
      throw new ConflictException(
        existing.status === MembershipStatus.ACCEPTED
          ? 'Already a member'
          : 'Already invited',
      );
    }
    // A declined invitation is sent again on the same row
    return this.prisma.organizationMember.upsert({
      where,
      create: { organizationId, userId: user.id, role, invitedById: inviterId },
      update: {
        status: MembershipStatus.PENDING,
        role,
        invitedById: inviterId,
      },
      select: { id: true, role: true, status: true },
    });
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
   * organization that the manager manages and that runs the event.
   */
  async removeVolunteerParticipation(
    managerId: string,
    eventId: string,
    volunteerId: string,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true },
    });
    if (!event) throw new NotFoundException('Event not found');

    const shared = await this.prisma.eventOrganization.count({
      where: {
        eventId,
        organization: {
          AND: [
            { members: { some: managerOf(managerId) } },
            { members: { some: volunteerOf(volunteerId) } },
          ],
        },
      },
    });
    if (shared === 0) {
      throw new ForbiddenException(
        'Not a volunteer of one of your organizations',
      );
    }

    const { count } = await this.prisma.shiftAssignment.deleteMany({
      where: { volunteerId, shift: { eventId } },
    });
    if (count === 0) {
      throw new NotFoundException('Not registered on this event');
    }
    return { removed: count };
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
