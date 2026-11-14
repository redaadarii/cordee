import { Global, Module } from '@nestjs/common';
import { ProjectEvents } from './project-events.js';
import { RealtimeGateway } from './realtime.gateway.js';

@Global()
@Module({ providers: [RealtimeGateway, ProjectEvents], exports: [ProjectEvents] })
export class RealtimeModule {}
