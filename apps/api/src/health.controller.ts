import { Controller, Get } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { Public } from './common/auth.js';
import { type Database, InjectDb } from './database/database.module.js';

@Controller('health')
export class HealthController {
  constructor(@InjectDb() private readonly db: Database) {}

  @Public()
  @Get()
  async check() {
    await this.db.execute(sql`select 1`);
    return { status: 'ok' };
  }
}
