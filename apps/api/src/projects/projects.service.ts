import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateLabelInput,
  CreateProjectInput,
  CreateStatusInput,
  LabelDto,
  ProjectDetailDto,
  ProjectDto,
  StatusDto,
  UpdateLabelInput,
  UpdateProjectInput,
  UpdateStatusInput,
} from '@cordee/shared';
import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import { type Database, InjectDb } from '../database/database.module.js';
import { issues, labels, projects, sprints, statuses } from '../database/schema.js';
import { ProjectEvents } from '../realtime/project-events.js';
import { toSprintDto } from '../sprints/sprints.service.js';
import { WorkspacesService } from '../workspaces/workspaces.service.js';

const DEFAULT_STATUSES: CreateStatusInput[] = [
  { name: 'Backlog', category: 'BACKLOG' },
  { name: 'À faire', category: 'TODO' },
  { name: 'En cours', category: 'IN_PROGRESS', wipLimit: 4 },
  { name: 'En revue', category: 'IN_PROGRESS' },
  { name: 'Terminé', category: 'DONE' },
];

const openIssueCount = sql<number>`(
  select count(*)::int from issues i
  inner join statuses s on s.id = i.status_id
  where i.project_id = projects.id and s.category not in ('DONE', 'CANCELED')
)`;

const projectColumns = {
  id: projects.id,
  workspaceId: projects.workspaceId,
  name: projects.name,
  key: projects.key,
  description: projects.description,
  color: projects.color,
  archivedAt: projects.archivedAt,
  openIssueCount,
};

type ProjectRow = Omit<ProjectDto, 'archivedAt'> & { archivedAt: Date | null };

const toProjectDto = (row: ProjectRow): ProjectDto => ({
  ...row,
  archivedAt: row.archivedAt?.toISOString() ?? null,
});

@Injectable()
export class ProjectsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: AccessService,
    private readonly workspaces: WorkspacesService,
    private readonly events: ProjectEvents,
  ) {}

  async list(userId: string, workspaceId: string): Promise<ProjectDto[]> {
    await this.access.workspace(userId, workspaceId);
    const rows = await this.db
      .select(projectColumns)
      .from(projects)
      .where(eq(projects.workspaceId, workspaceId))
      .orderBy(asc(projects.name));
    return rows.map(toProjectDto);
  }

  async create(userId: string, workspaceId: string, input: CreateProjectInput): Promise<ProjectDto> {
    await this.access.workspace(userId, workspaceId, 'ADMIN');

    const projectId = await this.db.transaction(async (tx) => {
      const [project] = await tx
        .insert(projects)
        .values({ workspaceId, ...input })
        .onConflictDoNothing()
        .returning({ id: projects.id });
      if (!project) throw new ConflictException(`La clé ${input.key} est déjà prise dans cet espace`);

      await tx
        .insert(statuses)
        .values(DEFAULT_STATUSES.map((status, position) => ({ ...status, position, projectId: project.id })));
      return project.id;
    });

    return this.findOne(projectId);
  }

  async detail(userId: string, projectId: string): Promise<ProjectDetailDto> {
    const { project, role } = await this.access.project(userId, projectId);
    const [summary, statusRows, labelRows, sprintRows, members] = await Promise.all([
      this.findOne(projectId),
      this.listStatuses(projectId),
      this.db
        .select({ id: labels.id, name: labels.name, color: labels.color })
        .from(labels)
        .where(eq(labels.projectId, projectId))
        .orderBy(asc(labels.name)),
      this.db
        .select()
        .from(sprints)
        .where(eq(sprints.projectId, projectId))
        .orderBy(desc(sprints.createdAt)),
      this.workspaces.listMembers(project.workspaceId),
    ]);
    return {
      ...summary,
      statuses: statusRows,
      labels: labelRows,
      sprints: sprintRows.map(toSprintDto),
      members,
      role,
    };
  }

  async update(userId: string, projectId: string, input: UpdateProjectInput): Promise<ProjectDto> {
    await this.access.project(userId, projectId, 'ADMIN');
    const { archived, ...fields } = input;
    await this.db
      .update(projects)
      .set({ ...fields, ...(archived !== undefined && { archivedAt: archived ? new Date() : null }) })
      .where(eq(projects.id, projectId));
    return this.findOne(projectId);
  }

  async createStatus(userId: string, projectId: string, input: CreateStatusInput): Promise<StatusDto> {
    await this.access.project(userId, projectId, 'ADMIN');
    const [{ next } = { next: 0 }] = await this.db
      .select({ next: sql<number>`coalesce(max(${statuses.position}), -1) + 1` })
      .from(statuses)
      .where(eq(statuses.projectId, projectId));
    const [status] = await this.db
      .insert(statuses)
      .values({ ...input, projectId, position: next })
      .returning();
    this.events.publish({ type: 'board.changed', projectId, actorId: userId });
    return this.toStatusDto(status!);
  }

  async updateStatus(
    userId: string,
    projectId: string,
    statusId: string,
    input: UpdateStatusInput,
  ): Promise<StatusDto[]> {
    await this.access.project(userId, projectId, 'ADMIN');
    const { position, ...fields } = input;

    await this.db.transaction(async (tx) => {
      const current = await tx
        .select()
        .from(statuses)
        .where(eq(statuses.projectId, projectId))
        .orderBy(asc(statuses.position));
      const index = current.findIndex((status) => status.id === statusId);
      if (index === -1) throw new NotFoundException('Statut introuvable');

      if (Object.keys(fields).length > 0) {
        await tx.update(statuses).set(fields).where(eq(statuses.id, statusId));
      }
      if (position !== undefined && position !== index) {
        const [moved] = current.splice(index, 1);
        current.splice(Math.min(position, current.length), 0, moved!);
        for (const [newPosition, status] of current.entries()) {
          if (status.position !== newPosition) {
            await tx.update(statuses).set({ position: newPosition }).where(eq(statuses.id, status.id));
          }
        }
      }
    });

    this.events.publish({ type: 'board.changed', projectId, actorId: userId });
    return this.listStatuses(projectId);
  }

  async removeStatus(userId: string, projectId: string, statusId: string): Promise<void> {
    await this.access.project(userId, projectId, 'ADMIN');
    const [usage] = await this.db
      .select({ total: count() })
      .from(issues)
      .where(eq(issues.statusId, statusId));
    if (usage!.total > 0) {
      throw new ConflictException('Déplacez les tickets de cette colonne avant de la supprimer');
    }
    const remaining = await this.listStatuses(projectId);
    if (remaining.length <= 1) throw new ConflictException('Un projet garde au moins une colonne');

    await this.db
      .delete(statuses)
      .where(and(eq(statuses.id, statusId), eq(statuses.projectId, projectId)));
    this.events.publish({ type: 'board.changed', projectId, actorId: userId });
  }

  async createLabel(userId: string, projectId: string, input: CreateLabelInput): Promise<LabelDto> {
    await this.access.project(userId, projectId, 'MEMBER');
    const [label] = await this.db
      .insert(labels)
      .values({ ...input, projectId })
      .onConflictDoNothing()
      .returning({ id: labels.id, name: labels.name, color: labels.color });
    if (!label) throw new ConflictException('Cette étiquette existe déjà');
    this.events.publish({ type: 'board.changed', projectId, actorId: userId });
    return label;
  }

  async updateLabel(
    userId: string,
    projectId: string,
    labelId: string,
    input: UpdateLabelInput,
  ): Promise<LabelDto> {
    await this.access.project(userId, projectId, 'MEMBER');
    const [label] = await this.db
      .update(labels)
      .set(input)
      .where(and(eq(labels.id, labelId), eq(labels.projectId, projectId)))
      .returning({ id: labels.id, name: labels.name, color: labels.color });
    if (!label) throw new NotFoundException('Étiquette introuvable');
    this.events.publish({ type: 'board.changed', projectId, actorId: userId });
    return label;
  }

  async removeLabel(userId: string, projectId: string, labelId: string): Promise<void> {
    await this.access.project(userId, projectId, 'MEMBER');
    await this.db.delete(labels).where(and(eq(labels.id, labelId), eq(labels.projectId, projectId)));
    this.events.publish({ type: 'board.changed', projectId, actorId: userId });
  }

  private async findOne(projectId: string): Promise<ProjectDto> {
    const [row] = await this.db.select(projectColumns).from(projects).where(eq(projects.id, projectId));
    return toProjectDto(row!);
  }

  private async listStatuses(projectId: string): Promise<StatusDto[]> {
    const rows = await this.db
      .select()
      .from(statuses)
      .where(eq(statuses.projectId, projectId))
      .orderBy(asc(statuses.position));
    return rows.map(this.toStatusDto);
  }

  private toStatusDto(status: typeof statuses.$inferSelect): StatusDto {
    return {
      id: status.id,
      name: status.name,
      category: status.category,
      position: status.position,
      wipLimit: status.wipLimit,
    };
  }
}
