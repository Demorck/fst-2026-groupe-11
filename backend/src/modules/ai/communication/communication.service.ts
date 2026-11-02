import { Inject, Injectable } from '@nestjs/common';
import type { EventCategory } from '@/generated/prisma/enums.js';
import { PrismaService } from '@/prisma/prisma.service.js';
import { OrganizationsService } from '../../organizations/organizations.service.js';
import type { CommunicationResponseDto } from '../dto/communication.dto.js';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider.interface.js';

// Same labels as CATEGORY_LABELS in frontend/src/features/events/types.ts (no shared package)
const CATEGORY_LABELS: Record<EventCategory, string> = {
  CONFERENCE: 'Conférence',
  PARTY: 'Soirée',
  SPORT: 'Sport',
  CULTURE: 'Culture',
  WORKSHOP: 'Atelier',
  OTHER: 'Autre',
};

// The server runs in UTC (Docker) but the audience reads Paris time
const formatDate = (date: Date) =>
  date.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'full',
    timeStyle: 'short',
  });

// Without this the model happily makes up prices, speakers or a dress code
const RULES =
  "Écris en français. N'invente aucune information absente ci-dessous (prix, intervenants, programme). " +
  'Réponds uniquement avec le texte, sans titre, sans guillemets ni markdown.';

@Injectable()
export class CommunicationService {
  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly prisma: PrismaService,
    private readonly organizations: OrganizationsService,
  ) {}

  /** Drafts a marketing description and a social media post, for a manager of the event to edit */
  async generate(
    eventId: string,
    userId: string,
  ): Promise<CommunicationResponseDto> {
    await this.organizations.assertCanManageEvent(userId, eventId);
    const event = await this.prisma.event.findUniqueOrThrow({
      where: { id: eventId },
      select: {
        title: true,
        description: true,
        startsAt: true,
        endsAt: true,
        location: true,
        capacity: true,
        category: true,
        organizations: { select: { organization: { select: { name: true } } } },
      },
    });

    const facts = [
      `Titre : ${event.title}`,
      `Catégorie : ${CATEGORY_LABELS[event.category]}`,
      `Début : ${formatDate(event.startsAt)}`,
      `Fin : ${formatDate(event.endsAt)}`,
      `Lieu : ${event.location}`,
      `Capacité : ${event.capacity} places`,
      `Organisé par : ${event.organizations.map((o) => o.organization.name).join(', ')}`,
      `Notes de l'organisateur : ${event.description}`,
    ].join('\n');
    // Two calls rather than one asking for JSON: plain text is what every model returns reliably
    const [description, post] = await Promise.all([
      this.llm.generate(
        `Rédige la description marketing de l'événement « ${event.title} » pour sa page d'inscription : ` +
          `deux ou trois paragraphes courts, ton chaleureux, pour donner envie de réserver. ${RULES}\n\n${facts}`,
      ),
      this.llm.generate(
        `Rédige un post pour les réseaux sociaux qui annonce l'événement « ${event.title} » : ` +
          `280 caractères maximum, deux ou trois hashtags, une invitation à réserver. ${RULES}\n\n${facts}`,
      ),
    ]);
    return { description: description.trim(), post: post.trim() };
  }
}
