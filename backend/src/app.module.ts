import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { AiModule } from './modules/ai/ai.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { EventsModule } from './modules/events/events.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { TicketsModule } from './modules/tickets/tickets.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { VolunteersModule } from './modules/volunteers/volunteers.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    AuthModule,
    UsersModule,
    EventsModule,
    TicketsModule,
    VolunteersModule,
    DashboardModule,
    AiModule,
    HealthModule,
  ],
})
export class AppModule {}
