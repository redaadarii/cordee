import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET doit faire au moins 32 caractères'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  // Sans SMTP_URL, les e-mails sont écrits dans la console (et dans MAIL_OUTBOX_FILE s'il est défini).
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default('Cordée <no-reply@cordee.local>'),
  MAIL_OUTBOX_FILE: z.string().optional(),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(10),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error('Configuration invalide :\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
