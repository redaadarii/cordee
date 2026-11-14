import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateSprintInput, SprintDto, UpdateSprintInput } from '@cordee/shared';
import { and, eq, inArray, notInArray } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import { type Database, InjectDb } from '../database/database.module.js';
import { issues, sprints, statuses } from '../database/schema.js';
import { ProjectEvents } from '../realtime/project-events.js';

type SprintRow = typeof sprints.$inferSelect;

export const toSprintDto = (sprint: SprintRow): SprintDto => ({
  id: sprint.id,
  name: sprint.name,
  goal: sprint.goal,
  state: sprint.state,
  startDate: sprint.startDate?.toISOString() ?? null,
  endDate: sprint.endDate?.toISOString() ?? null,
});

const toDates = ({ startDate, endDate, ...rest }: UpdateSprintInput) => ({
  ...rest,
  ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
  ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
});

@Injectable()
export class SprintsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: AccessService,
    private readonly events: ProjectEvents,
  ) {}

  async create(userId: string, projectId: string, input: CreateSprintInput): Promise<SprintDto> {
    await this.access.project(userId, projectId, 'MEMBER');
    const [sprint] = await this.db
      .insert(sprints)
      .values({ projectId, name: input.name, ...toDates(input) })
      .returning();
    this.changed(projectId, userId);
    return toSprintDto(sprint!);
  }

  async update(userId: string, sprintId: string, input: UpdateSprintInput): Promise<SprintDto> {
    const sprint = await this.find(userId, sprintId);
    const [updated] = await this.db
      .update(sprints)
      .set(toDates(input))
      .where(eq(sprints.id, sprintId))
      .returning();
    this.changed(sprint.projectId, userId);
    return toSprintDto(updated!);
  }

  async start(userId: string, sprintId: string): Promise<SprintDto> {
    const sprint = await this.find(userId, sprintId);
    if (sprint.state !== 'PLANNED') throw new ConflictException('Ce sprint a déjà démarré');

    const [active] = await this.db
      .select({ name: sprints.name })
      .from(sprints)
      .where(and(eq(sprints.projectId, sprint.projectId), eq(sprints.state, 'ACTIVE')));
    if (active) throw new ConflictException(`Terminez d'abord « ${active.name} »`);

    const startDate = sprint.startDate ?? new Date();
    const [updated] = await this.db
      .update(sprints)
      .set({
        state: 'ACTIVE',
        startDate,
        endDate: sprint.endDate ?? new Date(startDate.getTime() + 14 * 86_400_000),
      })
      .where(eq(sprints.id, sprintId))
      .returning();
    this.changed(sprint.projectId, userId);
    return toSprintDto(updated!);
  }

  /** Clôture le sprint ; les tickets non terminés retournent au backlog. */
  async complete(userId: string, sprintId: string): Promise<SprintDto> {
    const sprint = await this.find(userId, sprintId);
    if (sprint.state !== 'ACTIVE') throw new ConflictException("Ce sprint n'est pas en cours");

    const updated = await this.db.transaction(async (tx) => {
      const unfinished = tx
        .select({ id: statuses.id })
        .from(statuses)
        .where(
          and(
            eq(statuses.projectId, sprint.projectId),
            notInArray(statuses.category, ['DONE', 'CANCELED']),
          ),
        );
      await tx
        .update(issues)
        .set({ sprintId: null })
        .where(and(eq(issues.sprintId, sprintId), inArray(issues.statusId, unfinished)));

      const [row] = await tx
        .update(sprints)
        .set({ state: 'COMPLETED', completedAt: new Date() })
        .where(eq(sprints.id, sprintId))
        .returning();
      return row!;
    });

    this.changed(sprint.projectId, userId);
    return toSprintDto(updated);
  }

  async remove(userId: string, sprintId: string): Promise<void> {
    const sprint = await this.find(userId, sprintId);
    if (sprint.state !== 'PLANNED') {
      throw new ConflictException('Seul un sprint non démarré peut être supprimé');
    }
    await this.db.delete(sprints).where(eq(sprints.id, sprintId));
    this.changed(sprint.projectId, userId);
  }

  private async find(userId: string, sprintId: string): Promise<SprintRow> {
    const [sprint] = await this.db.select().from(sprints).where(eq(sprints.id, sprintId));
    if (!sprint) throw new NotFoundException('Sprint introuvable');
    await this.access.project(userId, sprint.projectId, 'MEMBER');
    return sprint;
  }

  private changed(projectId: string, actorId: string) {
    this.events.publish({ type: 'board.changed', projectId, actorId });
  }
}
