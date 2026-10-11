import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TicketStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { OrganizationsService } from '../organizations/organizations.service.js';
import { TICKET_CODE_ALPHABET } from './ticket-code.js';
import { TicketsService } from './tickets.service.js';

const eventId = 'e1';
const participantId = 'p1';
const noOrganizations = { provide: OrganizationsService, useValue: {} };

function setup({
  capacity = 2,
  event = true,
  existing = null as { id: string; status: TicketStatus } | null,
  booked = 0,
} = {}) {
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue(event ? [{ capacity }] : []),
    ticket: {
      findUnique: vi.fn().mockResolvedValue(existing),
      count: vi.fn().mockResolvedValue(booked),
      create: vi.fn().mockResolvedValue({ id: 't1' }),
      update: vi.fn().mockResolvedValue({ id: 't1' }),
    },
  };
  const $transaction = vi.fn((callback: (tx: unknown) => unknown) =>
    callback(tx),
  );
  return { tx, $transaction };
}

async function build(prisma: ReturnType<typeof setup>) {
  const module = await Test.createTestingModule({
    providers: [
      TicketsService,
      {
        provide: PrismaService,
        useValue: { $transaction: prisma.$transaction },
      },
      noOrganizations,
    ],
  }).compile();
  return module.get(TicketsService);
}

describe('TicketsService.reserve', () => {
  it('creates a ticket with a readable code', async () => {
    const prisma = setup();

    await (await build(prisma)).reserve(eventId, participantId);

    const { data } = prisma.tx.ticket.create.mock.calls[0][0];
    expect(data).toMatchObject({ eventId, participantId });
    expect(data.code).toMatch(new RegExp(`^[${TICKET_CODE_ALPHABET}]+$`));
  });

  it('throws 404 for an unknown event', async () => {
    const prisma = setup({ event: false });

    await expect(
      (await build(prisma)).reserve(eventId, participantId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.tx.ticket.create).not.toHaveBeenCalled();
  });

  it('throws 409 when the event is full', async () => {
    const prisma = setup({ capacity: 2, booked: 2 });

    await expect(
      (await build(prisma)).reserve(eventId, participantId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tx.ticket.create).not.toHaveBeenCalled();
  });

  it('counts only reserved tickets against the capacity', async () => {
    const prisma = setup();

    await (await build(prisma)).reserve(eventId, participantId);

    expect(prisma.tx.ticket.count).toHaveBeenCalledWith({
      where: { eventId, status: TicketStatus.RESERVED },
    });
  });

  it('throws 409 when the participant already has a ticket', async () => {
    const prisma = setup({
      existing: { id: 't1', status: TicketStatus.RESERVED },
    });

    await expect(
      (await build(prisma)).reserve(eventId, participantId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tx.ticket.create).not.toHaveBeenCalled();
  });

  it('reactivates a cancelled ticket instead of creating a second row', async () => {
    const prisma = setup({
      existing: { id: 't1', status: TicketStatus.CANCELLED },
    });

    await (await build(prisma)).reserve(eventId, participantId);

    expect(prisma.tx.ticket.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { status: TicketStatus.RESERVED, checkedInAt: null },
    });
    expect(prisma.tx.ticket.create).not.toHaveBeenCalled();
  });

  it('refuses to reactivate a cancelled ticket when the event is full', async () => {
    const prisma = setup({
      capacity: 1,
      booked: 1,
      existing: { id: 't1', status: TicketStatus.CANCELLED },
    });

    await expect(
      (await build(prisma)).reserve(eventId, participantId),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.tx.ticket.update).not.toHaveBeenCalled();
  });

  describe('code collision', () => {
    const collision = { code: 'P2002' };

    it('retries with a new code', async () => {
      const prisma = setup();
      prisma.tx.ticket.create
        .mockRejectedValueOnce(collision)
        .mockResolvedValueOnce({ id: 't1' });

      await expect(
        (await build(prisma)).reserve(eventId, participantId),
      ).resolves.toEqual({ id: 't1' });
      expect(prisma.tx.ticket.create).toHaveBeenCalledTimes(2);
    });

    it('gives up after 3 attempts', async () => {
      const prisma = setup();
      prisma.tx.ticket.create.mockRejectedValue(collision);

      await expect(
        (await build(prisma)).reserve(eventId, participantId),
      ).rejects.toBe(collision);
      expect(prisma.tx.ticket.create).toHaveBeenCalledTimes(3);
    });

    it('does not retry other errors', async () => {
      const prisma = setup();
      const failure = new Error('db down');
      prisma.tx.ticket.create.mockRejectedValue(failure);

      await expect(
        (await build(prisma)).reserve(eventId, participantId),
      ).rejects.toBe(failure);
      expect(prisma.tx.ticket.create).toHaveBeenCalledTimes(1);
    });
  });
});

describe('TicketsService.listForUser', () => {
  it('lists the active tickets of the user ordered by event start', async () => {
    const findMany = vi.fn().mockResolvedValue([{ id: 't1' }]);
    const module = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: PrismaService, useValue: { ticket: { findMany } } },
        noOrganizations,
      ],
    }).compile();

    const result = await module.get(TicketsService).listForUser(participantId);

    expect(result).toEqual([{ id: 't1' }]);
    const args = findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      participantId,
      status: TicketStatus.RESERVED,
    });
    expect(args.orderBy).toEqual({ event: { startsAt: 'asc' } });
    expect(args.select.event.select.title).toBe(true);
  });
});

async function buildCheckin({
  event = { id: eventId } as { id: string } | null,
  ticket = {
    eventId,
    status: TicketStatus.RESERVED,
    checkedInAt: null,
  } as {
    eventId: string;
    status: TicketStatus;
    checkedInAt: Date | null;
  } | null,
  manager = true,
} = {}) {
  const prisma = {
    event: { findUnique: vi.fn().mockResolvedValue(event) },
    ticket: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(ticket),
      update: vi.fn().mockResolvedValue({ id: 't1' }),
    },
  };
  const canManageEvent = vi.fn().mockResolvedValue(manager);
  const module = await Test.createTestingModule({
    providers: [
      TicketsService,
      { provide: PrismaService, useValue: prisma },
      { provide: OrganizationsService, useValue: { canManageEvent } },
    ],
  }).compile();
  return { service: module.get(TicketsService), prisma, canManageEvent };
}

describe('TicketsService.listForEvent', () => {
  it('lists every ticket of the event for a manager', async () => {
    const { service, prisma, canManageEvent } = await buildCheckin();

    await service.listForEvent(eventId, 'u1');

    expect(canManageEvent).toHaveBeenCalledWith('u1', eventId);
    expect(prisma.ticket.findMany.mock.calls[0][0].where).toEqual({ eventId });
  });

  it('searches by participant name or ticket code, ignoring case', async () => {
    const { service, prisma } = await buildCheckin();

    await service.listForEvent(eventId, 'u1', '  ali ');

    expect(prisma.ticket.findMany.mock.calls[0][0].where.OR).toEqual([
      { participant: { name: { contains: 'ali', mode: 'insensitive' } } },
      { code: { contains: 'ali', mode: 'insensitive' } },
    ]);
  });

  it('throws 404 for an unknown event', async () => {
    const { service } = await buildCheckin({ event: null });

    await expect(service.listForEvent(eventId, 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws 403 to someone who does not manage the event', async () => {
    const { service, prisma } = await buildCheckin({ manager: false });

    await expect(service.listForEvent(eventId, 'u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.ticket.findMany).not.toHaveBeenCalled();
  });
});

describe('TicketsService.checkIn', () => {
  it('records the check-in time only if the ticket is not checked in yet', async () => {
    const { service, prisma } = await buildCheckin();

    await service.checkIn('t1', 'u1');

    const { where, data } = prisma.ticket.update.mock.calls[0][0];
    expect(where).toEqual({
      id: 't1',
      checkedInAt: null,
      status: TicketStatus.RESERVED,
    });
    expect(data.checkedInAt).toBeInstanceOf(Date);
  });

  it('throws 409 when the ticket is already checked in', async () => {
    const { service, prisma } = await buildCheckin();
    prisma.ticket.update.mockRejectedValue({ code: 'P2025' });

    await expect(service.checkIn('t1', 'u1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('refuses a cancelled ticket', async () => {
    const { service, prisma } = await buildCheckin({
      ticket: { eventId, status: TicketStatus.CANCELLED, checkedInAt: null },
    });

    await expect(service.checkIn('t1', 'u1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });

  it('throws 404 for an unknown ticket', async () => {
    const { service } = await buildCheckin({ ticket: null });

    await expect(service.checkIn('t1', 'u1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws 403 to someone who does not manage the event', async () => {
    const { service, prisma } = await buildCheckin({ manager: false });

    await expect(service.checkIn('t1', 'u1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.ticket.update).not.toHaveBeenCalled();
  });
});
