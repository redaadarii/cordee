import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  type OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { ProjectEvent } from '@cordee/shared';
import type { Server, Socket } from 'socket.io';
import { AccessService } from '../access/access.service.js';
import { env } from '../config/env.js';
import { PROJECT_EVENT, USER_NOTIFIED } from './project-events.js';

@WebSocketGateway({ cors: { origin: env.WEB_ORIGIN, credentials: true } })
export class RealtimeGateway implements OnGatewayConnection {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  private readonly server: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly access: AccessService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string }>(socket.handshake.auth.token);
      socket.data.userId = payload.sub;
      await socket.join(`user:${payload.sub}`);
    } catch {
      socket.disconnect(true);
    }
  }

  @SubscribeMessage('project:join')
  async join(@ConnectedSocket() socket: Socket, @MessageBody() projectId: string) {
    try {
      await this.access.project(socket.data.userId, projectId);
      await socket.join(`project:${projectId}`);
      return { ok: true };
    } catch (error) {
      this.logger.debug(`Abonnement refusé au projet ${projectId}: ${String(error)}`);
      return { ok: false };
    }
  }

  @SubscribeMessage('project:leave')
  async leave(@ConnectedSocket() socket: Socket, @MessageBody() projectId: string) {
    await socket.leave(`project:${projectId}`);
  }

  @OnEvent(PROJECT_EVENT)
  broadcast(event: ProjectEvent) {
    this.server.to(`project:${event.projectId}`).emit('project:event', event);
  }

  @OnEvent(USER_NOTIFIED)
  notify(userId: string) {
    this.server.to(`user:${userId}`).emit('notification');
  }
}
