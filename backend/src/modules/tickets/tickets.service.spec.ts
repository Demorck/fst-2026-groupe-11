import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TicketStatus } from '../../generated/prisma/enums.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { TICKET_CODE_ALPHABET } from './ticket-code.js';
import { TicketsService } from './tickets.service.js';

const eventId = 'e1';
const participantId = 'p1';

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
