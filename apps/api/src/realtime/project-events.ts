import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { ProjectEvent } from '@cordee/shared';

export const PROJECT_EVENT = 'project.event';
export const USER_NOTIFIED = 'user.notified';

/** Les services métier publient ici ; ils ne connaissent pas le transport temps réel. */
@Injectable()
export class ProjectEvents {
  constructor(private readonly emitter: EventEmitter2) {}

  publish(event: ProjectEvent) {
    this.emitter.emit(PROJECT_EVENT, event);
  }

  notified(userIds: string[]) {
    for (const userId of userIds) this.emitter.emit(USER_NOTIFIED, userId);
  }
}
