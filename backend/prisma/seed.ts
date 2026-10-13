// Demo data for local development: `npm run db:seed` (also run by `npm run setup`).
// Idempotent: ids, emails and ticket codes are fixed, so it can be run again at any time.
// When a feature adds data to the database, extend this file (see CLAUDE.md, "Données de démo").
import 'dotenv/config';
import { crc32, deflateSync } from 'node:zlib';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client.js';
import {
  EventCategory,
  MembershipStatus,
  OrganizationAction,
  OrganizationRole,
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
    email: 'benevole4@gevent.test',
    name: 'Béatrice Bénévole',
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

// A plain PNG logo (colored square with a white disc), so logos can be seen without uploading one
function logoPng(size: number, [r, g, b]: number[]) {
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, checksum]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // RGB
  const rows = Array.from({ length: size }, (_, y) => {
    const row = Buffer.alloc(1 + size * 3); // first byte: filter type 0
    for (let x = 0; x < size; x++) {
      const inDisc = Math.hypot(x - size / 2, y - size / 2) < size * 0.28;
      row.set(inDisc ? [255, 255, 255] : [r, g, b], 1 + x * 3);
    }
    return row;
  });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const { MANAGER, VOLUNTEER } = OrganizationRole;
const { ACCEPTED, PENDING, DECLINED, CANCELLED, REMOVED, LEFT } =
  MembershipStatus;

// Members: [user, role, status]. Covers: co-management, a pending and a declined invitation,
// a volunteer in two organizations, and an organization without logo (initials are shown instead).
const ORGANIZATIONS = [
  {
    key: 'bde',
    name: 'BDE Nancy',
    description: 'Le bureau des étudiants : soirées, rentrée et vie de campus.',
    logoColor: [22, 163, 74],
    members: [
      ['orga', MANAGER, ACCEPTED],
      ['orga2', MANAGER, PENDING], // co-manager invitation to accept
      ['benevole1', VOLUNTEER, ACCEPTED],
      ['benevole2', VOLUNTEER, ACCEPTED],
      ['benevole3', VOLUNTEER, PENDING], // volunteer invitation to accept
      ['benevole4', VOLUNTEER, LEFT], // left: her past hours stay on her attestation
    ],
  },
  {
    key: 'sport',
    name: 'Club Sport Université',
    description: 'Tournois et entraînements ouverts à tous.',
    logoColor: [234, 88, 12],
    members: [
      ['orga', MANAGER, ACCEPTED],
      ['benevole2', VOLUNTEER, ACCEPTED],
      ['benevole3', VOLUNTEER, ACCEPTED],
      ['benevole1', VOLUNTEER, REMOVED], // removed by orga: past hours stay too
      ['benevole4', VOLUNTEER, CANCELLED], // invitation withdrawn
    ],
  },
  {
    key: 'num',
    name: 'Association Numérique',
    description: 'Ateliers de code et conférences sur le numérique.',
    logoColor: null,
    members: [
      ['orga2', MANAGER, ACCEPTED],
      ['benevole3', VOLUNTEER, DECLINED], // declined: can be invited again
      ['benevole4', VOLUNTEER, PENDING], // invited 10 days ago: expired, to invite again
    ],
  },
] as const;

// Invitations older than the 7 days of validity (organization key and user key)
const EXPIRED_INVITATIONS = new Set(['num:benevole4']);

// Event number -> organizations running it. The futsal tournament has two (two bubbles on its card).
const EVENT_ORGANIZATIONS: Record<number, string[]> = {
  1: ['bde'],
  2: ['bde', 'sport'],
  3: ['bde'],
  4: ['num'],
  5: ['bde'],
  6: ['bde'],
  7: ['sport'],
  8: ['num'],
  9: ['bde'],
};

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
  // Nobody booked nor on a shift (only a cancelled ticket): can be deleted
  {
    id: eventId(9),
    title: 'Pique-nique de fin d’année',
    category: EventCategory.OTHER,
    location: 'Parc de la Pépinière',
    capacity: 60,
    organizer: 'orga',
    ...at(45 * DAY, 4 * HOUR),
  },
];

// [shift number, event number, title, required volunteers, offset from the event start, volunteers]
const SHIFTS: [number, number, string, number, number, string[]][] = [
  [1, 1, 'Accueil', 2, 0, ['benevole1', 'benevole2']], // covered
  [2, 2, 'Accueil', 2, 0, ['benevole1']], // partly covered
  [3, 2, 'Buvette', 3, 2 * HOUR, ['benevole1', 'benevole2', 'benevole3']], // covered
  [4, 2, 'Rangement', 2, 4 * HOUR, []], // nobody yet
  [5, 5, 'Accueil', 1, 0, ['benevole1']],
  // Past shifts: hours and attestations (benevole1 and benevole4 have left or were removed, hours stay)
  [6, 6, 'Accueil', 3, 0, ['benevole1', 'benevole2', 'benevole4']],
  [7, 6, 'Rangement', 2, 3 * HOUR, ['benevole1', 'benevole4']],
  [8, 7, 'Buvette', 2, 0, ['benevole1', 'benevole2']],
  // Starts in a few hours and nobody yet: flagged as incomplete on the dashboard
  [9, 5, 'Rangement', 2, 3 * HOUR, []],
  // An organizer works a shift too (organizer inherits volunteer): a manager of the BDE
  [10, 1, 'Buvette', 1, 2 * HOUR, ['orga']],
  // Past, worked by a manager: listed in the hours of the BDE with an attestation, like a volunteer
  [11, 6, 'Logistique', 1, 1 * HOUR, ['orga']],
  // Empty shift of an event that can still be deleted
  [12, 9, 'Installation', 2, 0, []],
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
  // Volunteers and organizers book tickets too (they inherit the participant rights)
  [1, 'benevole1', TicketStatus.RESERVED, false], // volunteer, event of their own organization
  [5, 'benevole3', TicketStatus.RESERVED, false], // volunteer, event of an organization they have not joined
  [2, 'orga', TicketStatus.RESERVED, false], // organizer, event they manage
  [9, 'participant5', TicketStatus.CANCELLED, false], // does not prevent deleting the event
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

  const organizations = new Map<string, string>();
  for (const { key, members, logoColor, ...fields } of ORGANIZATIONS) {
    const data = {
      ...fields,
      logo: logoColor ? new Uint8Array(logoPng(128, [...logoColor])) : null,
      logoContentType: logoColor ? 'image/png' : null,
    };
    const organization = await prisma.organization.upsert({
      where: { name: fields.name },
      create: data,
      update: data,
    });
    organizations.set(key, organization.id);
    // The first member created the organization; everybody else was invited by them. The app finds
    // the creator as the only member nobody invited (invitedById null), so this must be set.
    const creator = members[0][0];
    for (const [user, role, status] of members) {
      const ids = { organizationId: organization.id, userId: userId(user) };
      const invitedById = user === creator ? null : userId(creator);
      await prisma.organizationMember.upsert({
        where: { organizationId_userId: ids },
        create: {
          ...ids,
          role,
          status,
          invitedById,
          ...(EXPIRED_INVITATIONS.has(`${key}:${user}`) && {
            invitedAt: new Date(Date.now() - 10 * DAY),
          }),
        },
        // Keeps the answer given while testing an invitation
        update: { role, invitedById },
      });
    }
  }

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

  for (const [eventNumber, keys] of Object.entries(EVENT_ORGANIZATIONS)) {
    for (const key of keys) {
      const ids = {
        eventId: eventId(Number(eventNumber)),
        organizationId: organizations.get(key)!,
      };
      await prisma.eventOrganization.upsert({
        where: { eventId_organizationId: ids },
        create: ids,
        update: {},
      });
    }
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

  // The audit log has no natural key: fixed ids keep a rerun from duplicating the entries
  const auditId = (n: number) =>
    `cccccccc-0000-4000-8000-${String(n).padStart(12, '0')}`;
  const AUDIT = [
    [1, 'sport', OrganizationAction.MEMBER_REMOVED, 'orga', 'benevole1', 12],
    [2, 'bde', OrganizationAction.MEMBER_LEFT, 'benevole4', 'benevole4', 20],
    [
      3,
      'sport',
      OrganizationAction.INVITATION_CANCELLED,
      'orga',
      'benevole4',
      3,
    ],
  ] as const;
  for (const [n, org, action, actor, target, daysAgo] of AUDIT) {
    const data = {
      organizationId: organizations.get(org)!,
      action,
      actorId: userId(actor),
      targetUserId: userId(target),
      details:
        action === OrganizationAction.INVITATION_CANCELLED
          ? undefined
          : { removedShifts: 0 },
      createdAt: new Date(Date.now() - daysAgo * DAY),
    };
    await prisma.organizationAuditLog.upsert({
      where: { id: auditId(n) },
      create: { id: auditId(n), ...data },
      update: {},
    });
  }

  console.log(
    `Seed done: ${USERS.length} users, ${ORGANIZATIONS.length} organizations, ${EVENTS.length} events, ${SHIFTS.length} shifts, ${TICKETS.length} tickets.`,
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
