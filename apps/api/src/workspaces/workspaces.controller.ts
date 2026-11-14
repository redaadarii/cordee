import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  type AddMemberInput,
  addMemberSchema,
  type CreateWorkspaceInput,
  createWorkspaceSchema,
  type UpdateMemberInput,
  updateMemberSchema,
} from '@cordee/shared';
import { Public, UserId } from '../common/auth.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { WorkspacesService } from './workspaces.service.js';

@Controller()
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Get('workspaces')
  list(@UserId() userId: string) {
    return this.workspaces.listMine(userId);
  }

  @Post('workspaces')
  create(
    @UserId() userId: string,
    @Body(new ZodPipe(createWorkspaceSchema)) body: CreateWorkspaceInput,
  ) {
    return this.workspaces.create(userId, body);
  }

  @Get('workspaces/:workspaceId/members')
  members(@UserId() userId: string, @Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.workspaces.members(userId, workspaceId);
  }

  @Post('workspaces/:workspaceId/members')
  addMember(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ZodPipe(addMemberSchema)) body: AddMemberInput,
  ) {
    return this.workspaces.addMember(userId, workspaceId, body);
  }

  @Get('workspaces/:workspaceId/search')
  search(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Query('q') q = '',
  ) {
    return this.workspaces.search(userId, workspaceId, q);
  }

  @Patch('workspaces/:workspaceId')
  rename(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ZodPipe(createWorkspaceSchema)) body: CreateWorkspaceInput,
  ) {
    return this.workspaces.rename(userId, workspaceId, body.name);
  }

  @Patch('workspaces/:workspaceId/members/:memberId')
  updateMember(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
    @Body(new ZodPipe(updateMemberSchema)) body: UpdateMemberInput,
  ) {
    return this.workspaces.updateMember(userId, workspaceId, memberId, body.role);
  }

  @HttpCode(204)
  @Delete('workspaces/:workspaceId/members/:memberId')
  removeMember(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('memberId', ParseUUIDPipe) memberId: string,
  ) {
    return this.workspaces.removeMember(userId, workspaceId, memberId);
  }

  @Get('workspaces/:workspaceId/invitations')
  invitations(@UserId() userId: string, @Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.workspaces.listInvitations(userId, workspaceId);
  }

  @HttpCode(204)
  @Delete('workspaces/:workspaceId/invitations/:invitationId')
  revokeInvitation(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Param('invitationId', ParseUUIDPipe) invitationId: string,
  ) {
    return this.workspaces.revokeInvitation(userId, workspaceId, invitationId);
  }

  @Public()
  @Get('invitations/:token')
  previewInvitation(@Param('token') token: string) {
    return this.workspaces.previewInvitation(token);
  }

  @HttpCode(200)
  @Post('invitations/:token/accept')
  acceptInvitation(@UserId() userId: string, @Param('token') token: string) {
    return this.workspaces.acceptInvitation(userId, token);
  }
}
