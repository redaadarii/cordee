import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  ActivityDto,
  ActivityType,
  CreateIssueInput,
  IssueDetailDto,
  IssueDto,
  IssueFilters,
  MoveIssueInput,
  MyIssueDto,
  UpdateIssueInput,
} from '@cordee/shared';
import { and, asc, desc, eq, gt, ilike, inArray, isNull, ne, notInArray, type SQL, sql } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import { AttachmentsService } from '../attachments/attachments.service.js';
import { type Database, InjectDb, type Transaction } from '../database/database.module.js';
import {
  activities,
  issueLabels,
  issues,
  labels,
  memberships,
  projects,
  sprints,
  statuses,
  users,
} from '../database/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ProjectEvents } from '../realtime/project-events.js';
import { rankBetween } from './rank.js';

type IssueRow = typeof issues.$inferSelect;
type Executor = Database | Transaction;

const userColumns = { id: true, name: true, email: true } as const;

@Injectable()
export class IssuesService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: AccessService,
    private readonly events: ProjectEvents,
    private readonly notifications: NotificationsService,
    private readonly attachments: AttachmentsService,
  ) {}

  async findMany(where: SQL | undefined, db: Executor = this.db): Promise<IssueDto[]> {
    const rows = await db.query.issues.findMany({
      where,
      with: {
        project: { columns: { key: true } },
        assignee: { columns: userColumns },
        labels: { columns: { labelId: true } },
      },
      extras: {
        commentCount:
          sql<number>`(select count(*)::int from comments where comments.issue_id = ${issues.id})`.as(
            'comment_count',
          ),
      },
      orderBy: asc(issues.rank),
    });

    return rows.map((row) => ({
      id: row.id,
      key: `${row.project.key}-${row.number}`,
      number: row.number,
      projectId: row.projectId,
      title: row.title,
      type: row.type,
      priority: row.priority,
      statusId: row.statusId,
      sprintId: row.sprintId,
      parentId: row.parentId,
      assignee: row.assignee,
      rank: row.rank,
      estimate: row.estimate,
      dueDate: row.dueDate?.toISOString() ?? null,
      labelIds: row.labels.map((label) => label.labelId),
      commentCount: row.commentCount,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async list(userId: string, projectId: string, filters: IssueFilters): Promise<IssueDto[]> {
    await this.access.project(userId, projectId);
    return this.findMany(
      and(
        eq(issues.projectId, projectId),
        filters.statusId ? eq(issues.statusId, filters.statusId) : undefined,
        filters.assigneeId ? eq(issues.assigneeId, filters.assigneeId) : undefined,
        filters.type ? eq(issues.type, filters.type) : undefined,
        filters.sprintId === 'none'
          ? isNull(issues.sprintId)
          : filters.sprintId
            ? eq(issues.sprintId, filters.sprintId)
            : undefined,
        filters.q ? ilike(issues.title, `%${filters.q.replace(/[%_\\]/g, '\\$&')}%`) : undefined,
      ),
    );
  }

  async mine(userId: string): Promise<MyIssueDto[]> {
    const rows = await this.db
      .select({
        id: issues.id,
        projectName: projects.name,
        projectColor: projects.color,
        statusName: statuses.name,
        statusCategory: statuses.category,
      })
      .from(issues)
      .innerJoin(projects, eq(projects.id, issues.projectId))
      .innerJoin(statuses, eq(statuses.id, issues.statusId))
      .innerJoin(
        memberships,
        and(eq(memberships.workspaceId, projects.workspaceId), eq(memberships.userId, userId)),
      )
      .where(
        and(
          eq(issues.assigneeId, userId),
          isNull(projects.archivedAt),
          notInArray(statuses.category, ['DONE', 'CANCELED']),
        ),
      );
    if (rows.length === 0) return [];

    const context = new Map(rows.map((row) => [row.id, row]));
    const found = await this.findMany(inArray(issues.id, [...context.keys()]));
    return found
      .map((issue) => {
        const extra = context.get(issue.id)!;
        return {
          ...issue,
          project: { name: extra.projectName, color: extra.projectColor },
          statusName: extra.statusName,
          statusCategory: extra.statusCategory,
        };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async detail(userId: string, issueId: string): Promise<IssueDetailDto> {
    const { issue, project } = await this.access.issue(userId, issueId);
    const [dto] = await this.findMany(eq(issues.id, issueId));
    const [reporter] = await this.db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, issue.reporterId));
    const children = await this.db
      .select({
        id: issues.id,
        number: issues.number,
        title: issues.title,
        statusId: issues.statusId,
        type: issues.type,
      })
      .from(issues)
      .where(eq(issues.parentId, issueId))
      .orderBy(asc(issues.number));

    return {
      ...dto!,
      description: issue.description,
      reporter: reporter!,
      attachments: await this.attachments.listFor(issueId),
      children: children.map(({ number, ...child }) => ({
        ...child,
        key: `${project.key}-${number}`,
      })),
    };
  }

  async activity(userId: string, issueId: string): Promise<ActivityDto[]> {
    await this.access.issue(userId, issueId);
    const rows = await this.db.query.activities.findMany({
      where: eq(activities.issueId, issueId),
      with: { actor: { columns: userColumns } },
      orderBy: desc(activities.createdAt),
      limit: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      actor: row.actor,
      from: row.from,
      to: row.to,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async create(userId: string, projectId: string, input: CreateIssueInput): Promise<IssueDto> {
    const { project } = await this.access.project(userId, projectId, 'MEMBER');

    const issueId = await this.db.transaction(async (tx) => {
      const status = await this.resolveStatus(tx, projectId, input.statusId);
      await this.assertReferences(tx, project, input);

      const [counter] = await tx
        .update(projects)
        .set({ issueCounter: sql`${projects.issueCounter} + 1` })
        .where(eq(projects.id, projectId))
        .returning({ number: projects.issueCounter });

      const [created] = await tx
        .insert(issues)
        .values({
          projectId,
          number: counter!.number,
          title: input.title,
          description: input.description,
          type: input.type,
          priority: input.priority,
          statusId: status.id,
          sprintId: input.sprintId,
          parentId: input.parentId,
          assigneeId: input.assigneeId,
          reporterId: userId,
          rank: await this.rankAtEnd(tx, status.id),
          estimate: input.estimate,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          completedAt: status.category === 'DONE' ? new Date() : null,
        })
        .returning({ id: issues.id });

      if (input.labelIds?.length) {
        await tx
          .insert(issueLabels)
          .values(input.labelIds.map((labelId) => ({ issueId: created!.id, labelId })));
      }
      await tx.insert(activities).values({ issueId: created!.id, actorId: userId, type: 'CREATED' });
      return created!.id;
    });

    if (input.assigneeId) {
      await this.notifications.notify('ASSIGNED', issueId, userId, [input.assigneeId]);
    }
    const [dto] = await this.findMany(eq(issues.id, issueId));
    this.events.publish({ type: 'issue.created', projectId, issue: dto!, actorId: userId });
    return dto!;
  }

  async update(userId: string, issueId: string, input: UpdateIssueInput): Promise<IssueDto> {
    const { issue, project } = await this.access.issue(userId, issueId, 'MEMBER');

    await this.db.transaction(async (tx) => {
      await this.assertReferences(tx, project, input, issueId);
      const { labelIds, dueDate, ...fields } = input;
      const changes: Partial<IssueRow> = { ...fields };
      if (dueDate !== undefined) changes.dueDate = dueDate ? new Date(dueDate) : null;

      const log: { type: ActivityType; from: string | null; to: string | null }[] = [];

      if (input.statusId && input.statusId !== issue.statusId) {
        const status = await this.resolveStatus(tx, project.id, input.statusId);
        changes.rank = await this.rankAtEnd(tx, status.id);
        changes.completedAt = status.category === 'DONE' ? new Date() : null;
        log.push({ type: 'STATUS_CHANGED', from: issue.statusId, to: status.id });
      }
      if (input.assigneeId !== undefined && input.assigneeId !== issue.assigneeId) {
        log.push({ type: 'ASSIGNED', from: issue.assigneeId, to: input.assigneeId });
      }
      if (input.priority && input.priority !== issue.priority) {
        log.push({ type: 'PRIORITY_CHANGED', from: issue.priority, to: input.priority });
      }
      if (input.sprintId !== undefined && input.sprintId !== issue.sprintId) {
        log.push({ type: 'SPRINT_CHANGED', from: issue.sprintId, to: input.sprintId });
      }
      if (input.title && input.title !== issue.title) {
        log.push({ type: 'RENAMED', from: issue.title, to: input.title });
      }

      if (Object.keys(changes).length > 0) {
        await tx.update(issues).set(changes).where(eq(issues.id, issueId));
      }
      if (labelIds) {
        await tx.delete(issueLabels).where(eq(issueLabels.issueId, issueId));
        if (labelIds.length) {
          await tx.insert(issueLabels).values(labelIds.map((labelId) => ({ issueId, labelId })));
        }
      }
      if (log.length) {
        await tx
          .insert(activities)
          .values(log.map((entry) => ({ ...entry, issueId, actorId: userId })));
      }
    });

    if (input.assigneeId && input.assigneeId !== issue.assigneeId) {
      await this.notifications.notify('ASSIGNED', issueId, userId, [input.assigneeId]);
    }
    const [dto] = await this.findMany(eq(issues.id, issueId));
    this.events.publish({ type: 'issue.updated', projectId: project.id, issue: dto!, actorId: userId });
    return dto!;
  }

  async move(userId: string, issueId: string, input: MoveIssueInput): Promise<IssueDto> {
    const { issue, project } = await this.access.issue(userId, issueId, 'MEMBER');

    await this.db.transaction(async (tx) => {
      const status = await this.resolveStatus(tx, project.id, input.statusId);

      let previousRank: string | null = null;
      if (input.afterIssueId) {
        const [above] = await tx
          .select({ rank: issues.rank })
          .from(issues)
          .where(and(eq(issues.id, input.afterIssueId), eq(issues.statusId, status.id)));
        if (!above) throw new BadRequestException("La carte de référence n'est pas dans cette colonne");
        previousRank = above.rank;
      }

      const [below] = await tx
        .select({ rank: issues.rank })
        .from(issues)
        .where(
          and(
            eq(issues.statusId, status.id),
            ne(issues.id, issueId),
            previousRank ? gt(issues.rank, previousRank) : undefined,
          ),
        )
        .orderBy(asc(issues.rank))
        .limit(1);

      const statusChanged = status.id !== issue.statusId;
      await tx
        .update(issues)
        .set({
          statusId: status.id,
          rank: rankBetween(previousRank, below?.rank ?? null),
          ...(statusChanged && { completedAt: status.category === 'DONE' ? new Date() : null }),
        })
        .where(eq(issues.id, issueId));

      if (statusChanged) {
        await tx.insert(activities).values({
          issueId,
          actorId: userId,
          type: 'STATUS_CHANGED',
          from: issue.statusId,
          to: status.id,
        });
      }
    });

    const [dto] = await this.findMany(eq(issues.id, issueId));
    this.events.publish({ type: 'issue.moved', projectId: project.id, issue: dto!, actorId: userId });
    return dto!;
  }

  async remove(userId: string, issueId: string): Promise<void> {
    const { project } = await this.access.issue(userId, issueId, 'MEMBER');
    await this.db.delete(issues).where(eq(issues.id, issueId));
    this.events.publish({ type: 'issue.deleted', projectId: project.id, issueId, actorId: userId });
  }

  private async resolveStatus(tx: Executor, projectId: string, statusId?: string) {
    const [status] = await tx
      .select()
      .from(statuses)
      .where(and(eq(statuses.projectId, projectId), statusId ? eq(statuses.id, statusId) : undefined))
      .orderBy(asc(statuses.position))
      .limit(1);
    if (!status) throw new BadRequestException('Statut inconnu dans ce projet');
    return status;
  }

  private async rankAtEnd(tx: Executor, statusId: string): Promise<string> {
    const [last] = await tx
      .select({ rank: issues.rank })
      .from(issues)
      .where(eq(issues.statusId, statusId))
      .orderBy(desc(issues.rank))
      .limit(1);
    return rankBetween(last?.rank ?? null, null);
  }

  // Les identifiants reçus du client doivent tous appartenir au projet (ou à son espace
  // pour l'assigné) : sans ce contrôle on pourrait rattacher un ticket au sprint d'un autre.
  private async assertReferences(
    tx: Executor,
    project: typeof projects.$inferSelect,
    input: UpdateIssueInput,
    issueId?: string,
  ) {
    if (input.assigneeId) {
      const [member] = await tx
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(
            eq(memberships.userId, input.assigneeId),
            eq(memberships.workspaceId, project.workspaceId),
          ),
        );
      if (!member) throw new BadRequestException("L'assigné ne fait pas partie de l'espace");
    }
    if (input.sprintId) {
      const [sprint] = await tx
        .select({ id: sprints.id })
        .from(sprints)
        .where(and(eq(sprints.id, input.sprintId), eq(sprints.projectId, project.id)));
      if (!sprint) throw new BadRequestException('Sprint inconnu dans ce projet');
    }
    if (input.parentId) {
      if (input.parentId === issueId) {
        throw new BadRequestException('Un ticket ne peut pas être son propre parent');
      }
      const [parent] = await tx
        .select({ id: issues.id })
        .from(issues)
        .where(and(eq(issues.id, input.parentId), eq(issues.projectId, project.id)));
      if (!parent) throw new BadRequestException('Ticket parent inconnu dans ce projet');
    }
    if (input.labelIds?.length) {
      const found = await tx
        .select({ id: labels.id })
        .from(labels)
        .where(and(inArray(labels.id, input.labelIds), eq(labels.projectId, project.id)));
      if (found.length !== new Set(input.labelIds).size) {
        throw new BadRequestException('Étiquette inconnue dans ce projet');
      }
    }
  }
}
