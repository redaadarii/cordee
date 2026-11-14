import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { env } from '../config/env.js';
import * as schema from './schema.js';

export const DB = Symbol('DB');
const POOL = Symbol('POOL');

export type Database = NodePgDatabase<typeof schema>;
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export const InjectDb = () => Inject(DB);

@Global()
@Module({
  providers: [
    { provide: POOL, useFactory: () => new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 }) },
    { provide: DB, inject: [POOL], useFactory: (pool: pg.Pool) => drizzle(pool, { schema }) },
  ],
  exports: [DB],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: pg.Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
