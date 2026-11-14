import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { UserId } from '../common/auth.js';
import { NotificationsService } from './notifications.service.js';

@Controller('me/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@UserId() userId: string) {
    return this.notifications.list(userId);
  }

  @HttpCode(204)
  @Post('read')
  markAllRead(@UserId() userId: string) {
    return this.notifications.markAllRead(userId);
  }
}
