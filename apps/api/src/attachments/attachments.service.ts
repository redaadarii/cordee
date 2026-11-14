import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type AttachmentDto, hasRole } from '@cordee/shared';
import { asc, eq } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import { type Database, InjectDb } from '../database/database.module.js';
import { attachments } from '../database/schema.js';
import { ProjectEvents } from '../realtime/project-events.js';
import { StorageService } from './storage.service.js';

@Injectable()
export class AttachmentsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: AccessService,
    private readonly storage: StorageService,
    private readonly events: ProjectEvents,
  ) {}

  async listFor(issueId: string): Promise<AttachmentDto[]> {
    const rows = await this.db.query.attachments.findMany({
      where: eq(attachments.issueId, issueId),
      with: { uploader: { columns: { id: true, name: true, email: true } } },
      orderBy: asc(attachments.createdAt),
    });
    return rows.map((row) => ({
      id: row.id,
      filename: row.filename,
      mimeType: row.mimeType,
      size: row.size,
      uploader: row.uploader,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async upload(userId: string, issueId: string, file: Express.Multer.File | undefined): Promise<AttachmentDto> {
    const { project } = await this.access.issue(userId, issueId, 'MEMBER');
    if (!file) throw new BadRequestException('Aucun fichier reçu');

    const storageKey = await this.storage.save(file.buffer);
    const [created] = await this.db
      .insert(attachments)
      .values({
        issueId,
        uploaderId: userId,
        // multer lit le nom en latin1 ; les navigateurs l'envoient en UTF-8.
        filename: Buffer.from(file.originalname, 'latin1').toString('utf8').slice(0, 200),
        mimeType: file.mimetype || 'application/octet-stream',
        size: file.size,
        storageKey,
      })
      .returning({ id: attachments.id });

    this.events.publish({ type: 'issue.touched', projectId: project.id, issueId, actorId: userId });
    const all = await this.listFor(issueId);
    return all.find((attachment) => attachment.id === created!.id)!;
  }

  async open(userId: string, attachmentId: string) {
    const attachment = await this.find(attachmentId);
    await this.access.issue(userId, attachment.issueId);
    return { attachment, stream: this.storage.read(attachment.storageKey) };
  }

  async remove(userId: string, attachmentId: string): Promise<void> {
    const attachment = await this.find(attachmentId);
    const { project, role } = await this.access.issue(userId, attachment.issueId, 'MEMBER');
    if (attachment.uploaderId !== userId && !hasRole(role, 'ADMIN')) {
      throw new ForbiddenException('Seul son auteur ou un administrateur peut supprimer ce fichier');
    }
    await this.db.delete(attachments).where(eq(attachments.id, attachmentId));
    await this.storage.remove(attachment.storageKey);
    this.events.publish({
      type: 'issue.touched',
      projectId: project.id,
      issueId: attachment.issueId,
      actorId: userId,
    });
  }

  private async find(attachmentId: string) {
    const [attachment] = await this.db.select().from(attachments).where(eq(attachments.id, attachmentId));
    if (!attachment) throw new NotFoundException('Fichier introuvable');
    return attachment;
  }
}
