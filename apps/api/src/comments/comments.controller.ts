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
import { type CreateCommentInput, createCommentSchema } from '@cordee/shared';
import { UserId } from '../common/auth.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { CommentsService } from './comments.service.js';

@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('issues/:issueId/comments')
  list(@UserId() userId: string, @Param('issueId', ParseUUIDPipe) issueId: string) {
    return this.comments.list(userId, issueId);
  }

  @Post('issues/:issueId/comments')
  create(
    @UserId() userId: string,
    @Param('issueId', ParseUUIDPipe) issueId: string,
    @Body(new ZodPipe(createCommentSchema)) body: CreateCommentInput,
  ) {
    return this.comments.create(userId, issueId, body);
  }

  @Patch('comments/:commentId')
  update(
    @UserId() userId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body(new ZodPipe(createCommentSchema)) body: CreateCommentInput,
  ) {
    return this.comments.update(userId, commentId, body);
  }

  @HttpCode(204)
  @Delete('comments/:commentId')
  remove(@UserId() userId: string, @Param('commentId', ParseUUIDPipe) commentId: string) {
    return this.comments.remove(userId, commentId);
  }
}
