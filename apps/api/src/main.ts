import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module.js';
import { env } from './config/env.js';

const app = await NestFactory.create<NestExpressApplication>(AppModule);

// Derrière nginx ou un autre reverse proxy : l'IP du client sert à la limitation de débit.
app.set('trust proxy', 1);

app.setGlobalPrefix('api/v1');
app.use(helmet());
app.use(cookieParser());
app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
app.enableShutdownHooks();

await app.listen(env.PORT);
