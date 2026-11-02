import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { OrganizationsService } from '../../organizations/organizations.service.js';
import { CommunicationService } from './communication.service.js';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider.interface.js';
import { MockLlmProvider } from './mock-llm.provider.js';

const EVENT = {
  title: 'Soirée de rentrée',
  description: 'DJ et buvette, entrée gratuite',
  startsAt: new Date('2027-09-10T18:00:00Z'),
  endsAt: new Date('2027-09-10T23:00:00Z'),
  location: 'Campus Aiguillettes',
  capacity: 100,
  category: 'PARTY',
  organizations: [
    { organization: { name: 'BDE Nancy' } },
    { organization: { name: 'Club Sport' } },
  ],
};

async function build({
  denied = null as Error | null,
  llm = new MockLlmProvider() as LlmProvider,
} = {}) {
  const findUniqueOrThrow = vi.fn().mockResolvedValue(EVENT);
  const assertCanManageEvent = vi.fn(() => {
    if (denied) throw denied;
  });
  const generate = vi.spyOn(llm, 'generate');
  const module = await Test.createTestingModule({
    providers: [
      CommunicationService,
      { provide: LLM_PROVIDER, useValue: llm },
      { provide: PrismaService, useValue: { event: { findUniqueOrThrow } } },
      { provide: OrganizationsService, useValue: { assertCanManageEvent } },
    ],
  }).compile();
  return {
    service: module.get(CommunicationService),
    findUniqueOrThrow,
    assertCanManageEvent,
    generate,
  };
}

describe('CommunicationService', () => {
  it('generates a description and a post with the mock provider', async () => {
    const { service } = await build();

    const result = await service.generate('e1', 'u1');

    expect(result.description).toMatch(/^\[mock\] .*description/);
    expect(result.post).toMatch(/^\[mock\] .*post/);
  });

  it('builds both prompts from the event fields and its organizations', async () => {
    const { service, generate } = await build();

    await service.generate('e1', 'u1');

    expect(generate).toHaveBeenCalledTimes(2);
    for (const [prompt] of generate.mock.calls) {
      expect(prompt).toContain('Soirée de rentrée');
      expect(prompt).toContain('Catégorie : Soirée');
      expect(prompt).toContain('Campus Aiguillettes');
      expect(prompt).toContain('100 places');
      expect(prompt).toContain('BDE Nancy, Club Sport');
      expect(prompt).toContain('DJ et buvette, entrée gratuite');
      // Paris time, not the UTC of the server: 18:00Z is 20:00 in September
      expect(prompt).toContain('20:00');
    }
  });

  it('trims the texts of the provider', async () => {
    const llm: LlmProvider = {
      generate: (prompt) =>
        Promise.resolve(prompt.includes('post') ? '\n Post \n' : ' Texte\n'),
    };
    const { service } = await build({ llm });

    expect(await service.generate('e1', 'u1')).toEqual({
      description: 'Texte',
      post: 'Post',
    });
  });

  it.each([
    ['an unknown event', new NotFoundException()],
    ['a user who does not manage the event', new ForbiddenException()],
  ])(
    'refuses %s before reading it or calling the provider',
    async (_case, denied) => {
      const { service, assertCanManageEvent, findUniqueOrThrow, generate } =
        await build({ denied });

      await expect(service.generate('e1', 'u2')).rejects.toBe(denied);
      expect(assertCanManageEvent).toHaveBeenCalledWith('u2', 'e1');
      expect(findUniqueOrThrow).not.toHaveBeenCalled();
      expect(generate).not.toHaveBeenCalled();
    },
  );
});
