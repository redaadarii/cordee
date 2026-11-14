import { Injectable } from '@nestjs/common';
import type { NotificationDto, NotificationType } from '@cordee/shared';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { type Database, InjectDb } from '../database/database.module.js';
import { notifications } from '../database/schema.js';
import { ProjectEvents } from '../realtime/project-events.js';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly events: ProjectEvents,
  ) {}

  async notify(type: NotificationType, issueId: string, actorId: string, recipientIds: string[]) {
    // On ne se notifie pas soi-même.
    const recipients = [...new Set(recipientIds)].filter((id) => id !== actorId);
    if (recipients.length === 0) return;
    await this.db
      .insert(notifications)
      .values(recipients.map((userId) => ({ userId, actorId, issueId, type })));
    this.events.notified(recipients);
  }

  async list(userId: string): Promise<NotificationDto[]> {
    const rows = await this.db.query.notifications.findMany({
      where: eq(notifications.userId, userId),
      with: {
        actor: { columns: { id: true, name: true, email: true } },
        issue: {
          columns: { id: true, number: true, title: true, projectId: true },
          with: { project: { columns: { key: true } } },
        },
      },
      orderBy: desc(notifications.createdAt),
      limit: 30,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      actor: row.actor,
      issue: {
        id: row.issue.id,
        key: `${row.issue.project.key}-${row.issue.number}`,
        title: row.issue.title,
        projectId: row.issue.projectId,
      },
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async markAllRead(userId: string): Promise<void> {
    await this.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  }
}
