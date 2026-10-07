import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { CurrentUser } from '@/common/decorators/current-user.decorator.js';
import { Roles } from '@/common/decorators/roles.decorator.js';
import { type AuthUser, JwtAuthGuard } from '@/common/guards/jwt-auth.guard.js';
import { RolesGuard } from '@/common/guards/roles.guard.js';
import { Role } from '@/generated/prisma/enums.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { InviteMemberDto } from './dto/invite-member.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { detectImageType, LOGO_MAX_BYTES } from './image-type.js';
import { OrganizationsService } from './organizations.service.js';
import { readBody } from './read-body.js';

@ApiTags('organizations')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Non connecté' })
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ORGANIZER, Role.VOLUNTEER)
@ApiForbiddenResponse({ description: 'Réservé aux organisateurs et bénévoles' })
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post()
  @Roles(Role.ORGANIZER)
  @ApiCreatedResponse({
    description: "Organisation créée, l'auteur en est gestionnaire",
  })
  @ApiConflictResponse({ description: 'Nom déjà utilisé' })
  create(@Body() dto: CreateOrganizationDto, @CurrentUser() user: AuthUser) {
    return this.organizations.create(dto, user.id);
  }

  // Static routes come before ':id'
  @Get('mine')
  listMine(@CurrentUser() user: AuthUser) {
    return this.organizations.listMine(user.id);
  }

  @Get('invitations')
  listInvitations(@CurrentUser() user: AuthUser) {
    return this.organizations.listInvitations(user.id);
  }

  @Post('invitations/:invitationId/accept')
  @HttpCode(200)
  @ApiNotFoundResponse({ description: 'Invitation introuvable' })
  @ApiConflictResponse({ description: 'Invitation déjà traitée' })
  accept(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizations.accept(invitationId, user.id);
  }

  @Post('invitations/:invitationId/decline')
  @HttpCode(200)
  @ApiNotFoundResponse({ description: 'Invitation introuvable' })
  @ApiConflictResponse({ description: 'Invitation déjà traitée' })
  decline(
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizations.decline(invitationId, user.id);
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: 'Organisation introuvable' })
  @ApiForbiddenResponse({ description: "Pas membre de l'organisation" })
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizations.findOne(id, user.id);
  }

  @Patch(':id')
  @Roles(Role.ORGANIZER)
  @ApiForbiddenResponse({
    description: "Réservé aux gestionnaires de l'organisation",
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizations.update(id, dto, user.id);
  }

  @Post(':id/invitations')
  @Roles(Role.ORGANIZER)
  @ApiCreatedResponse({
    description: 'Invitation envoyée, en attente de réponse',
  })
  @ApiConflictResponse({ description: 'Déjà membre ou déjà invité' })
  @ApiForbiddenResponse({
    description: "Réservé aux gestionnaires de l'organisation",
  })
  invite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: InviteMemberDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizations.invite(id, dto.email, user.id);
  }

  @Delete(':id/invitations/:memberId')
  @HttpCode(204)
  @Roles(Role.ORGANIZER)
  @ApiForbiddenResponse({
    description: "Réservé aux gestionnaires de l'organisation",
  })
  @ApiNotFoundResponse({ description: 'Invitation introuvable' })
  @ApiConflictResponse({
    description: "Ce n'est pas une invitation en attente",
  })
  async cancelInvitation(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentUser() user: AuthUser,
  ) {
    await this.organizations.cancelInvitation(id, memberId, user.id);
  }

  @Delete(':id/members/:memberId')
  @Roles(Role.ORGANIZER)
  @ApiOkResponse({
    description: 'Membre retiré ; nombre de créneaux à venir retirés avec lui',
  })
  @ApiForbiddenResponse({
    description: "Réservé aux gestionnaires de l'organisation",
  })
  @ApiConflictResponse({
    description: "Dernier gestionnaire de l'organisation",
  })
  removeMember(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.organizations.removeMember(id, memberId, user.id);
  }

  @Post(':id/leave')
  @HttpCode(200)
  @ApiOkResponse({ description: "Vous avez quitté l'organisation" })
  @ApiConflictResponse({
    description: "Dernier gestionnaire de l'organisation",
  })
  leave(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.organizations.leave(id, user.id);
  }

  @Get(':id/audit')
  @Roles(Role.ORGANIZER)
  @ApiOkResponse({ description: 'Journal : retraits et invitations annulées' })
  @ApiForbiddenResponse({
    description: "Réservé aux gestionnaires de l'organisation",
  })
  audit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.organizations.listAudit(id, user.id);
  }

  @Put(':id/logo')
  @Roles(Role.ORGANIZER)
  @ApiConsumes('image/png', 'image/jpeg', 'image/webp')
  @ApiBody({
    description: "Octets de l'image (PNG, JPEG ou WebP, 512 Ko maximum)",
    schema: { type: 'string', format: 'binary' },
  })
  @ApiForbiddenResponse({
    description: "Réservé aux gestionnaires de l'organisation",
  })
  async setLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
    @CurrentUser() user: AuthUser,
  ) {
    const bytes = await readBody(req, LOGO_MAX_BYTES);
    const contentType = detectImageType(bytes);
    if (!contentType) {
      throw new BadRequestException('Logo must be a PNG, JPEG or WebP image');
    }
    return this.organizations.setLogo(id, user.id, bytes, contentType);
  }
}

// Public: the logo is an <img src> on the event pages, which do not send the token
@ApiTags('organizations')
@Controller('organizations')
export class OrganizationLogoController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get(':id/logo')
  @Header('Cache-Control', 'public, max-age=300')
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'")
  @ApiNotFoundResponse({ description: 'Pas de logo' })
  async getLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { bytes, contentType } = await this.organizations.getLogo(id);
    res.type(contentType);
    return new StreamableFile(bytes);
  }
}
