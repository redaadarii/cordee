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
} from '@nestjs/common';
import {
  type CreateLabelInput,
  createLabelSchema,
  type CreateProjectInput,
  createProjectSchema,
  type CreateStatusInput,
  createStatusSchema,
  type UpdateLabelInput,
  updateLabelSchema,
  type UpdateProjectInput,
  updateProjectSchema,
  type UpdateStatusInput,
  updateStatusSchema,
} from '@cordee/shared';
import { UserId } from '../common/auth.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ProjectsService } from './projects.service.js';
import { ReportsService } from './reports.service.js';

@Controller()
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly reports: ReportsService,
  ) {}

  @Get('workspaces/:workspaceId/projects')
  list(@UserId() userId: string, @Param('workspaceId', ParseUUIDPipe) workspaceId: string) {
    return this.projects.list(userId, workspaceId);
  }

  @Post('workspaces/:workspaceId/projects')
  create(
    @UserId() userId: string,
    @Param('workspaceId', ParseUUIDPipe) workspaceId: string,
    @Body(new ZodPipe(createProjectSchema)) body: CreateProjectInput,
  ) {
    return this.projects.create(userId, workspaceId, body);
  }

  @Get('projects/:projectId')
  detail(@UserId() userId: string, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.projects.detail(userId, projectId);
  }

  @Patch('projects/:projectId')
  update(
    @UserId() userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodPipe(updateProjectSchema)) body: UpdateProjectInput,
  ) {
    return this.projects.update(userId, projectId, body);
  }

  @Post('projects/:projectId/statuses')
  createStatus(
    @UserId() userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodPipe(createStatusSchema)) body: CreateStatusInput,
  ) {
    return this.projects.createStatus(userId, projectId, body);
  }

  @Patch('projects/:projectId/statuses/:statusId')
  updateStatus(
    @UserId() userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('statusId', ParseUUIDPipe) statusId: string,
    @Body(new ZodPipe(updateStatusSchema)) body: UpdateStatusInput,
  ) {
    return this.projects.updateStatus(userId, projectId, statusId, body);
  }

  @HttpCode(204)
  @Delete('projects/:projectId/statuses/:statusId')
  removeStatus(
    @UserId() userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('statusId', ParseUUIDPipe) statusId: string,
  ) {
    return this.projects.removeStatus(userId, projectId, statusId);
  }

  @Post('projects/:projectId/labels')
  createLabel(
    @UserId() userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodPipe(createLabelSchema)) body: CreateLabelInput,
  ) {
    return this.projects.createLabel(userId, projectId, body);
  }

  @Patch('projects/:projectId/labels/:labelId')
  updateLabel(
    @UserId() userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
    @Body(new ZodPipe(updateLabelSchema)) body: UpdateLabelInput,
  ) {
    return this.projects.updateLabel(userId, projectId, labelId, body);
  }

  @HttpCode(204)
  @Delete('projects/:projectId/labels/:labelId')
  removeLabel(
    @UserId() userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('labelId', ParseUUIDPipe) labelId: string,
  ) {
    return this.projects.removeLabel(userId, projectId, labelId);
  }

  @Get('projects/:projectId/reports')
  report(@UserId() userId: string, @Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.reports.project(userId, projectId);
  }
}
