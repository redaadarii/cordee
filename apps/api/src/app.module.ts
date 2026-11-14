import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from './access/access.module.js';
import { AttachmentsModule } from './attachments/attachments.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CommentsModule } from './comments/comments.module.js';
import { AuthGuard } from './common/auth.js';
import { env } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { IssuesModule } from './issues/issues.module.js';
import { MailModule } from './mail/mail.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { ProjectsModule } from './projects/projects.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { SprintsModule } from './sprints/sprints.module.js';
import { WorkspacesModule } from './workspaces/workspaces.module.js';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 300 }],
      // Limite HTTP uniquement ; désactivée pour les tests de bout en bout,
      // qui créent plusieurs comptes d'affilée.
      skipIf: (ctx) => ctx.getType() !== 'http' || env.NODE_ENV === 'test',
    }),
    DatabaseModule,
    MailModule,
    AccessModule,
    AuthModule,
    RealtimeModule,
    WorkspacesModule,
    ProjectsModule,
    IssuesModule,
    SprintsModule,
    CommentsModule,
    AttachmentsModule,
    NotificationsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
