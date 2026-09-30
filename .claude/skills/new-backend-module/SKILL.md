---
name: new-backend-module
description: Crée ou complète un module NestJS de domaine (controller, service, DTO, spec) dans backend/src/modules. À utiliser pour ajouter une fonctionnalité d'API à events, tickets, volunteers, dashboard, users ou auth.
argument-hint: '<domaine> [ressource]'
---

# Nouveau module backend

Les modules de domaine existent déjà comme coquilles vides (`@Module({})`) et sont déjà enregistrés dans `AppModule`. Le travail consiste à les remplir, pas à les recréer.

## Étapes

1. Lire le modèle `backend/src/modules/health/` et le module cible `backend/src/modules/<domaine>/<domaine>.module.ts`.
2. Vérifier que le modèle Prisma du domaine existe dans `backend/prisma/schema.prisma`. Sinon, lancer d'abord `/db-migration`.
3. Créer les fichiers à la main (pas de `nest g resource` : imports sans `.js`) :
   - `dto/create-<ressource>.dto.ts` : champs décorés class-validator **et** `@ApiProperty()`.
   - `<domaine>.service.ts` : logique métier, accès base via `PrismaService`.
   - `<domaine>.controller.ts` : `@ApiTags('<domaine>')`, `@Controller('<domaine>')` (sans préfixe `api`).
4. Déclarer `controllers` et `providers` dans `<domaine>.module.ts` ; exporter le service s'il sert à un autre module.
5. Écrire `<domaine>.service.spec.ts` (cas métier de `.claude/rules/testing.md`).
6. Lancer `npm run lint && npm test && npm run build`, puis vérifier la route dans Swagger (`/api/docs`).

## Gabarits (imports relatifs en `.js`)

```ts
// events.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { CreateEventDto } from './dto/create-event.dto.js';

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateEventDto) {
    return this.prisma.event.create({ data: dto });
  }
}
```

```ts
// dto/create-event.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateEventDto {
  @ApiProperty() @IsString() title: string;
  @ApiProperty() @IsInt() @Min(1) capacity: number;
}
```

```ts
// events.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CreateEventDto } from './dto/create-event.dto.js';
import { EventsService } from './events.service.js';

@ApiTags('events')
@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post()
  create(@Body() dto: CreateEventDto) {
    return this.events.create(dto);
  }
}
```

```ts
// events.service.spec.ts
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service.js';
import { EventsService } from './events.service.js';

describe('EventsService', () => {
  it('creates an event', async () => {
    const create = vi.fn().mockResolvedValue({ id: '1' });
    const module = await Test.createTestingModule({
      providers: [EventsService, { provide: PrismaService, useValue: { event: { create } } }],
    }).compile();

    await module.get(EventsService).create({ title: 'Gala', capacity: 50 });
    expect(create).toHaveBeenCalledOnce();
  });
});
```
