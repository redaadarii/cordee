import {
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  type CreateSprintInput,
  createSprintSchema,
  type UpdateSprintInput,
  updateSprintSchema,
} from '@cordee/shared';
import { UserId } from '../common/auth.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { SprintsService } from './sprints.service.js';

@Controller()
export class SprintsController {
  constructor(private readonly sprints: SprintsService) {}

  @Post('projects/:projectId/sprints')
  create(
    @UserId() userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body(new ZodPipe(createSprintSchema)) body: CreateSprintInput,
  ) {
    return this.sprints.create(userId, projectId, body);
  }

  @Patch('sprints/:sprintId')
  update(
    @UserId() userId: string,
    @Param('sprintId', ParseUUIDPipe) sprintId: string,
    @Body(new ZodPipe(updateSprintSchema)) body: UpdateSprintInput,
  ) {
    return this.sprints.update(userId, sprintId, body);
  }

  @HttpCode(200)
  @Post('sprints/:sprintId/start')
  start(@UserId() userId: string, @Param('sprintId', ParseUUIDPipe) sprintId: string) {
    return this.sprints.start(userId, sprintId);
  }

  @HttpCode(200)
  @Post('sprints/:sprintId/complete')
  complete(@UserId() userId: string, @Param('sprintId', ParseUUIDPipe) sprintId: string) {
    return this.sprints.complete(userId, sprintId);
  }

  @HttpCode(204)
  @Delete('sprints/:sprintId')
  remove(@UserId() userId: string, @Param('sprintId', ParseUUIDPipe) sprintId: string) {
    return this.sprints.remove(userId, sprintId);
  }
}
