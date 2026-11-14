import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { type CommentDto, type CreateCommentInput, hasRole } from '@cordee/shared';
import { asc, eq } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import { type Database, InjectDb } from '../database/database.module.js';
import { comments, memberships, users } from '../database/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ProjectEvents } from '../realtime/project-events.js';

@Injectable()
export class CommentsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: AccessService,
    private readonly notifications: NotificationsService,
    private readonly events: ProjectEvents,
  ) {}

  async list(userId: string, issueId: string): Promise<CommentDto[]> {
    await this.access.issue(userId, issueId);
    const rows = await this.db.query.comments.findMany({
      where: eq(comments.issueId, issueId),
      with: { author: { columns: { id: true, name: true, email: true } } },
      orderBy: asc(comments.createdAt),
    });
    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      author: row.author,
      createdAt: row.createdAt.toISOString(),
      editedAt: row.editedAt?.toISOString() ?? null,
    }));
  }

  async create(userId: string, issueId: string, input: CreateCommentInput): Promise<CommentDto> {
    const { issue, project } = await this.access.issue(userId, issueId, 'MEMBER');
    const [created] = await this.db
      .insert(comments)
      .values({ issueId, authorId: userId, body: input.body })
      .returning({ id: comments.id });

    const mentioned = await this.mentionedMembers(project.workspaceId, input.body);
    const followers = [issue.reporterId, issue.assigneeId].filter(
      (id): id is string => !!id && !mentioned.includes(id),
    );
    await this.notifications.notify('MENTIONED', issueId, userId, mentioned);
    await this.notifications.notify('COMMENTED', issueId, userId, followers);
    this.events.publish({ type: 'comment.created', projectId: project.id, issueId, actorId: userId });

    return this.findOne(userId, issueId, created!.id);
  }

  async update(userId: string, commentId: string, input: CreateCommentInput): Promise<CommentDto> {
    const { comment, project } = await this.find(userId, commentId);
    if (comment.authorId !== userId) {
      throw new ForbiddenException('Seul son auteur peut modifier un commentaire');
    }
    await this.db
      .update(comments)
      .set({ body: input.body, editedAt: new Date() })
      .where(eq(comments.id, commentId));

    // Seules les personnes ajoutées à la modification sont prévenues.
    const before = await this.mentionedMembers(project.workspaceId, comment.body);
    const after = await this.mentionedMembers(project.workspaceId, input.body);
    await this.notifications.notify(
      'MENTIONED',
      comment.issueId,
      userId,
      after.filter((id) => !before.includes(id)),
    );
    this.changed(project.id, comment.issueId, userId);
    return this.findOne(userId, comment.issueId, commentId);
  }

  async remove(userId: string, commentId: string): Promise<void> {
    const { comment, project, role } = await this.find(userId, commentId);
    if (comment.authorId !== userId && !hasRole(role, 'ADMIN')) {
      throw new ForbiddenException('Seul son auteur ou un administrateur peut supprimer un commentaire');
    }
    await this.db.delete(comments).where(eq(comments.id, commentId));
    this.changed(project.id, comment.issueId, userId);
  }

  private async find(userId: string, commentId: string) {
    const [comment] = await this.db.select().from(comments).where(eq(comments.id, commentId));
    if (!comment) throw new NotFoundException('Commentaire introuvable');
    const { project, role } = await this.access.issue(userId, comment.issueId, 'MEMBER');
    return { comment, project, role };
  }

  private async findOne(userId: string, issueId: string, commentId: string) {
    const all = await this.list(userId, issueId);
    return all.find((comment) => comment.id === commentId)!;
  }

  // Une mention s'écrit « @Prénom Nom ». Les noms les plus longs passent d'abord,
  // pour que « @Anne Martin » ne soit pas pris pour « @Anne ».
  private async mentionedMembers(workspaceId: string, body: string): Promise<string[]> {
    if (!body.includes('@')) return [];
    const members = await this.db
      .select({ id: users.id, name: users.name })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.workspaceId, workspaceId));

    let remaining = body;
    const mentioned: string[] = [];
    for (const member of members.sort((a, b) => b.name.length - a.name.length)) {
      if (remaining.includes(`@${member.name}`)) {
        mentioned.push(member.id);
        remaining = remaining.replaceAll(`@${member.name}`, '');
      }
    }
    return mentioned;
  }

  private changed(projectId: string, issueId: string, actorId: string) {
    this.events.publish({ type: 'comment.created', projectId, issueId, actorId });
  }
}
