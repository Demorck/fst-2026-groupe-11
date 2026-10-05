import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    // real round trip to postgres so the front can tell if the whole chain works
    const [{ now }] = await this.prisma.$queryRaw<
      { now: Date }[]
    >`SELECT now() AS now`;
    const users = await this.prisma.user.count();
    return { status: 'ok', databaseTime: now, users };
  }
}
