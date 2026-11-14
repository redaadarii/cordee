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
  type CreateIssueInput,
  createIssueSchema,
  type IssueFilters,
  issueFiltersSchema,
  type MoveIssueInput,
  moveIssueSchema,
  type UpdateIssueInput,
  updateIssueSchema,
} from '@cordee/shared';
import { UserId } from '../common/auth.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { IssuesService } from './issues.service.js';

@Controller()
export class IssuesController {
  constructor(private readonly issues: IssuesService) {}

  @Get('me/issues')
  mine(@UserId() userId: string) {
    return this.issues.mine(userId);
  }

  @Get('projects/:projectId/issues')
  list(
    @UserId() userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query(new ZodPipe(issueFiltersSchema)) filters: IssueFilters,
  ) {
    return this.issues.list(userId, projectId, filters);
  }

  @Post('projects/:projectId/issues')
  create(
    @UserId() userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodPipe(createIssueSchema)) body: CreateIssueInput,
  ) {
    return this.issues.create(userId, projectId, body);
  }

  @Get('issues/:issueId')
  detail(@UserId() userId: string, @Param('issueId', ParseUUIDPipe) issueId: string) {
    return this.issues.detail(userId, issueId);
  }

  @Get('issues/:issueId/activity')
  activity(@UserId() userId: string, @Param('issueId', ParseUUIDPipe) issueId: string) {
    return this.issues.activity(userId, issueId);
  }

  @Patch('issues/:issueId')
  update(
    @UserId() userId: string,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body(new ZodPipe(updateIssueSchema)) body: UpdateIssueInput,
  ) {
    return this.issues.update(userId, issueId, body);
  }

  @HttpCode(200)
  @Post('issues/:issueId/move')
  move(
    @UserId() userId: string,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body(new ZodPipe(moveIssueSchema)) body: MoveIssueInput,
  ) {
    return this.issues.move(userId, issueId, body);
  }

  @HttpCode(204)
  @Delete('issues/:issueId')
  remove(@UserId() userId: string, @Param('issueId', ParseUUIDPipe) issueId: string) {
    return this.issues.remove(userId, issueId);
  }
}
