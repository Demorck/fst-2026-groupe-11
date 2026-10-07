// Demo data for local development: `npm run db:seed` (also run by `npm run setup`).
// Idempotent: ids, emails and ticket codes are fixed, so it can be run again at any time.
// When a feature adds data to the database, extend this file (see CLAUDE.md, "Données de démo").
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  EventCategory,
  Role,
  TicketStatus,
} from '../src/generated/prisma/enums.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('The demo seed must never run in production');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

// Dev-only password shared by every demo account, listed in README.md
const PASSWORD = 'password123';

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
// Dates are relative to now so "upcoming" events stay upcoming whenever the seed is rerun
const at = (offsetMs: number, durationMs = 3 * HOUR) => ({
  startsAt: new Date(Date.now() + offsetMs),
  endsAt: new Date(Date.now() + offsetMs + durationMs),
});

const USERS = [
  { email: 'orga@gevent.test', name: 'Océane Orga', role: Role.ORGANIZER },
  { email: 'orga2@gevent.test', name: 'Omar Orga', role: Role.ORGANIZER },
  {
    email: 'benevole1@gevent.test',
    name: 'Bastien Bénévole',
    role: Role.VOLUNTEER,
  },
  {
    email: 'benevole2@gevent.test',
    name: 'Bérénice Bénévole',
    role: Role.VOLUNTEER,
  },
  {
    email: 'benevole3@gevent.test',
    name: 'Basile Bénévole',
    role: Role.VOLUNTEER,
  },
  {
    email: 'participant1@gevent.test',
    name: 'Paul Participant',
    role: Role.PARTICIPANT,
  },
  {
    email: 'participant2@gevent.test',
    name: 'Pauline Participante',
    role: Role.PARTICIPANT,
  },
  {
    email: 'participant3@gevent.test',
    name: 'Pierre Participant',
    role: Role.PARTICIPANT,
  },
  {
    email: 'participant4@gevent.test',
    name: 'Perrine Participante',
    role: Role.PARTICIPANT,
  },
  {
    email: 'participant5@gevent.test',
    name: 'Philippe Participant',
    role: Role.PARTICIPANT,
  },
  // No ticket on purpose: use it to try the reservation
  {
    email: 'participant6@gevent.test',
    name: 'Prune Participante',
    role: Role.PARTICIPANT,
  },
];

const eventId = (n: number) =>
  `aaaaaaaa-0000-4000-8000-${String(n).padStart(12, '0')}`;
const shiftId = (n: number) =>
  `bbbbbbbb-0000-4000-8000-${String(n).padStart(12, '0')}`;

const EVENTS = [
  // Upcoming
  {
    id: eventId(1),
    title: 'Soirée de rentrée',
    category: EventCategory.PARTY,
    location: 'Salle des fêtes, Nancy',
    capacity: 100,
    organizer: 'orga',
    ...at(7 * DAY, 5 * HOUR),
  },
  {
    id: eventId(2),
    title: 'Tournoi de futsal',
    category: EventCategory.SPORT,
    location: 'Gymnase Raymond Poincaré',
    capacity: 24,
    organizer: 'orga',
    ...at(14 * DAY, 6 * HOUR),
  },
  // Full on purpose: reservation must be refused
  {
    id: eventId(3),
    title: 'Conférence IA et société',
    category: EventCategory.CONFERENCE,
    location: 'Amphi B, Faculté des sciences',
    capacity: 2,
    organizer: 'orga',
    ...at(21 * DAY, 2 * HOUR),
  },
  // No ticket and another organizer: reservation and ownership checks
  {
    id: eventId(4),
    title: 'Atelier code créatif',
    category: EventCategory.WORKSHOP,
    location: 'Salle info 12',
    capacity: 30,
    organizer: 'orga2',
    ...at(30 * DAY, 3 * HOUR),
  },
  // Starts soon, nobody checked in yet: try the check-in
  {
    id: eventId(5),
    title: 'Soirée jeux de société',
    category: EventCategory.CULTURE,
    location: 'Maison de l’étudiant',
    capacity: 40,
    organizer: 'orga',
    ...at(2 * HOUR, 4 * HOUR),
  },
  // Past: registration history for the attendance prediction
  {
    id: eventId(6),
    title: 'Gala de l’association',
    category: EventCategory.PARTY,
    location: 'Château de Montaigu',
    capacity: 80,
    organizer: 'orga',
    ...at(-60 * DAY, 5 * HOUR),
  },
  {
    id: eventId(7),
    title: 'Tournoi de futsal (édition précédente)',
    category: EventCategory.SPORT,
    location: 'Gymnase Raymond Poincaré',
    capacity: 24,
    organizer: 'orga',
    ...at(-120 * DAY, 6 * HOUR),
  },
  {
    id: eventId(8),
    title: 'Conférence cybersécurité',
    category: EventCategory.CONFERENCE,
    location: 'Amphi B, Faculté des sciences',
    capacity: 50,
    organizer: 'orga2',
    ...at(-90 * DAY, 2 * HOUR),
  },
];

// [shift number, event number, title, required volunteers, offset from the event start, volunteers]
const SHIFTS: [number, number, string, number, number, string[]][] = [
  [1, 1, 'Accueil', 2, 0, ['benevole1', 'benevole2']], // covered
  [2, 2, 'Accueil', 2, 0, ['benevole1']], // partly covered
  [3, 2, 'Buvette', 3, 2 * HOUR, ['benevole1', 'benevole2', 'benevole3']], // covered
  [4, 2, 'Rangement', 2, 4 * HOUR, []], // nobody yet
  [5, 5, 'Accueil', 1, 0, ['benevole1']],
];

// [event number, participant, status, checked in]
const TICKETS: [number, string, TicketStatus, boolean][] = [
  [1, 'participant1', TicketStatus.RESERVED, false],
  [1, 'participant2', TicketStatus.RESERVED, false],
  [1, 'participant3', TicketStatus.RESERVED, false],
  [2, 'participant1', TicketStatus.RESERVED, false],
  [3, 'participant1', TicketStatus.RESERVED, false],
  [3, 'participant2', TicketStatus.RESERVED, false],
  [5, 'participant1', TicketStatus.RESERVED, false],
  [5, 'participant2', TicketStatus.RESERVED, false],
  [5, 'participant3', TicketStatus.RESERVED, false],
  [5, 'participant4', TicketStatus.CANCELLED, false],
  [6, 'participant1', TicketStatus.RESERVED, true],
  [6, 'participant2', TicketStatus.RESERVED, true],
  [6, 'participant3', TicketStatus.RESERVED, true],
  [6, 'participant4', TicketStatus.RESERVED, false], // booked but did not come
  [6, 'participant5', TicketStatus.CANCELLED, false],
  [7, 'participant1', TicketStatus.RESERVED, true],
  [7, 'participant2', TicketStatus.RESERVED, true],
  [8, 'participant3', TicketStatus.RESERVED, true],
  [8, 'participant4', TicketStatus.RESERVED, true],
  [8, 'participant5', TicketStatus.RESERVED, false],
];

// Readable fixed codes made of the ticket alphabet (no 0/O/1/I/L), e.g. DEMXAAAB
const ticketCode = (n: number) =>
  `DEMX${Array.from(String(n).padStart(4, '0'), (digit) => 'ABCDEFGHJK'[+digit]).join('')}`;

async function main() {
  const passwordHash = await argon2.hash(PASSWORD);

  const users = new Map<string, string>();
  for (const { email, ...data } of USERS) {
    const user = await prisma.user.upsert({
      where: { email },
      create: { email, passwordHash, ...data },
      update: { passwordHash, ...data },
    });
    users.set(email.split('@')[0], user.id);
  }
  const userId = (key: string) => users.get(key)!;

  for (const { organizer, ...event } of EVENTS) {
    const data = {
      ...event,
      description: `${event.title} : événement de démonstration.`,
      organizerId: userId(organizer),
    };
    await prisma.event.upsert({
      where: { id: event.id },
      create: data,
      update: data,
    });
  }

  for (const [
    n,
    eventNumber,
    title,
    requiredVolunteers,
    offset,
    volunteers,
  ] of SHIFTS) {
    const event = EVENTS.find(({ id }) => id === eventId(eventNumber))!;
    const data = {
      title,
      requiredVolunteers,
      eventId: event.id,
      startsAt: new Date(event.startsAt.getTime() + offset),
      endsAt: new Date(event.startsAt.getTime() + offset + 2 * HOUR),
    };
    await prisma.shift.upsert({
      where: { id: shiftId(n) },
      create: { id: shiftId(n), ...data },
      update: data,
    });
    for (const volunteer of volunteers) {
      const volunteerId = userId(volunteer);
      await prisma.shiftAssignment.upsert({
        where: { shiftId_volunteerId: { shiftId: shiftId(n), volunteerId } },
        create: { shiftId: shiftId(n), volunteerId },
        update: {},
      });
    }
  }

  for (const [
    i,
    [eventNumber, participant, status, checkedIn],
  ] of TICKETS.entries()) {
    const event = EVENTS.find(({ id }) => id === eventId(eventNumber))!;
    const ids = { eventId: event.id, participantId: userId(participant) };
    const start = event.startsAt.getTime();
    await prisma.ticket.upsert({
      where: { eventId_participantId: ids },
      create: {
        ...ids,
        code: ticketCode(i + 1),
        status,
        // Booked a few days ahead, so past events give a realistic history
        createdAt: new Date(
          Math.min(
            Date.now() - (1 + (i % 3)) * DAY,
            start - (2 + (i % 5)) * DAY,
          ),
        ),
        checkedInAt: checkedIn ? new Date(start + 10 * 60 * 1000) : null,
      },
      // Keeps what was done while testing (new status, check-in)
      update: {},
    });
  }

  console.log(
    `Seed done: ${USERS.length} users, ${EVENTS.length} events, ${SHIFTS.length} shifts, ${TICKETS.length} tickets.`,
  );
  console.log(
    `Demo accounts: <name>@gevent.test, password "${PASSWORD}" (see README.md).`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
