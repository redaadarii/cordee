import { Injectable } from '@nestjs/common';
import type { ProjectReportDto } from '@cordee/shared';
import { and, asc, eq, gt, isNotNull } from 'drizzle-orm';
import { AccessService } from '../access/access.service.js';
import { type Database, InjectDb } from '../database/database.module.js';
import { issues, sprints, statuses, users } from '../database/schema.js';

const DAY = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

@Injectable()
export class ReportsService {
  constructor(
    @InjectDb() private readonly db: Database,
    private readonly access: AccessService,
  ) {}

  async project(userId: string, projectId: string): Promise<ProjectReportDto> {
    await this.access.project(userId, projectId);

    const [statusRows, sprintRows, issueRows] = await Promise.all([
      this.db.select().from(statuses).where(eq(statuses.projectId, projectId)).orderBy(asc(statuses.position)),
      this.db.select().from(sprints).where(eq(sprints.projectId, projectId)).orderBy(asc(sprints.completedAt)),
      this.db
        .select({
          statusId: issues.statusId,
          sprintId: issues.sprintId,
          estimate: issues.estimate,
          createdAt: issues.createdAt,
          completedAt: issues.completedAt,
          assigneeId: issues.assigneeId,
          assigneeName: users.name,
          assigneeEmail: users.email,
        })
        .from(issues)
        .leftJoin(users, eq(users.id, issues.assigneeId))
        .where(eq(issues.projectId, projectId)),
    ]);

    const category = new Map(statusRows.map((status) => [status.id, status.category]));
    const isDone = (issue: (typeof issueRows)[number]) => category.get(issue.statusId) === 'DONE';
    const isOpen = (issue: (typeof issueRows)[number]) =>
      !['DONE', 'CANCELED'].includes(category.get(issue.statusId)!);

    const workload = new Map<string, ProjectReportDto['byAssignee'][number]>();
    for (const issue of issueRows.filter(isOpen)) {
      const key = issue.assigneeId ?? '';
      const entry = workload.get(key) ?? {
        user: issue.assigneeId
          ? { id: issue.assigneeId, name: issue.assigneeName!, email: issue.assigneeEmail! }
          : null,
        open: 0,
        points: 0,
      };
      entry.open += 1;
      entry.points += issue.estimate ?? 0;
      workload.set(key, entry);
    }

    return {
      burndown: this.burndown(sprintRows, issueRows.filter((issue) => issue.sprintId), issueRows.filter(isDone)),
      velocity: sprintRows
        .filter((sprint) => sprint.state === 'COMPLETED')
        .map((sprint) => {
          const done = issueRows.filter((issue) => issue.sprintId === sprint.id && isDone(issue));
          return {
            sprintName: sprint.name,
            issues: done.length,
            points: done.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0),
          };
        }),
      byStatus: statusRows.map((status) => ({
        statusId: status.id,
        name: status.name,
        category: status.category,
        count: issueRows.filter((issue) => issue.statusId === status.id).length,
      })),
      byAssignee: [...workload.values()].sort((a, b) => b.open - a.open),
      cycleTime: await this.cycleTime(projectId),
    };
  }

  // Le périmètre du sprint n'est pas historisé : la courbe part du nombre de tickets
  // actuellement dans le sprint, et un ticket ajouté en cours de route relève tous les jours passés.
  private burndown(
    sprintRows: (typeof sprints.$inferSelect)[],
    planned: { sprintId: string | null }[],
    done: { sprintId: string | null; completedAt: Date | null }[],
  ): ProjectReportDto['burndown'] {
    const sprint = sprintRows.find((candidate) => candidate.state === 'ACTIVE');
    if (!sprint?.startDate) return null;

    const total = planned.filter((issue) => issue.sprintId === sprint.id).length;
    const closedAt = done
      .filter((issue) => issue.sprintId === sprint.id && issue.completedAt)
      .map((issue) => issue.completedAt!.getTime());
    const start = startOfDay(sprint.startDate);
    const today = startOfDay(new Date());
    const end = startOfDay(sprint.endDate && sprint.endDate > today ? sprint.endDate : today);
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));

    const points = Array.from({ length: days + 1 }, (_, day) => {
      const date = new Date(start.getTime() + day * DAY);
      const endOfDay = date.getTime() + DAY;
      return {
        date: date.toISOString(),
        remaining: date <= today ? total - closedAt.filter((time) => time < endOfDay).length : null,
        ideal: Math.round(total * (1 - day / days) * 10) / 10,
      };
    });
    return { sprintName: sprint.name, total, points };
  }

  private async cycleTime(projectId: string): Promise<ProjectReportDto['cycleTime']> {
    const rows = await this.db
      .select({ createdAt: issues.createdAt, completedAt: issues.completedAt })
      .from(issues)
      .where(
        and(
          eq(issues.projectId, projectId),
          isNotNull(issues.completedAt),
          gt(issues.completedAt, new Date(Date.now() - 90 * DAY)),
        ),
      );
    if (rows.length === 0) return null;

    const durations = rows
      .map((row) => (row.completedAt!.getTime() - row.createdAt.getTime()) / DAY)
      .sort((a, b) => a - b);
    const middle = Math.floor(durations.length / 2);
    const median = durations.length % 2 ? durations[middle]! : (durations[middle - 1]! + durations[middle]!) / 2;
    return { medianDays: Math.round(median * 10) / 10, sampleSize: durations.length };
  }
}
