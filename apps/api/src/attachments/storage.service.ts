import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '../config/env.js';

/**
 * Stockage des fichiers sur disque. Les trois méthodes sont tout ce que le reste
 * du code connaît : passer à S3 ou MinIO revient à réécrire cette classe.
 */
@Injectable()
export class StorageService {
  private readonly root = resolve(env.UPLOAD_DIR);

  async save(content: Buffer): Promise<string> {
    const key = randomUUID();
    await mkdir(this.root, { recursive: true });
    await writeFile(join(this.root, key), content);
    return key;
  }

  read(key: string): Readable {
    return createReadStream(join(this.root, key));
  }

  async remove(key: string): Promise<void> {
    await rm(join(this.root, key), { force: true });
  }
}
