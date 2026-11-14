import type { IssueDto, SprintDto } from '@cordee/shared';
import { type FormEvent, type ReactNode, useState } from 'react';
import { PriorityIcon, StatusDot, TypeIcon } from '@/features/issues/meta';
import { byRank, useIssues, useUpdateIssue } from '@/features/issues/queries';
import { useOpenIssue, useProjectContext } from '@/features/projects/ProjectLayout';
import { useSprintActions } from '@/features/projects/queries';
import { ApiError } from '@/lib/api';
import { formatDay, plural } from '@/lib/format';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { FormError, Input } from '@/ui/Field';

export function BacklogPage() {
  const { project, canEdit } = useProjectContext();
  const { data: issues = [] } = useIssues(project.id);
  const actions = useSprintActions(project.id);
  const [newSprint, setNewSprint] = useState('');

  const openSprints = project.sprints
    .filter((sprint) => sprint.state !== 'COMPLETED')
    .sort((a, b) => (a.state === 'ACTIVE' ? -1 : b.state === 'ACTIVE' ? 1 : a.name.localeCompare(b.name, 'fr', { numeric: true })));
  const doneStatusIds = new Set(
    project.statuses.filter((s) => s.category === 'DONE' || s.category === 'CANCELED').map((s) => s.id),
  );
  const position = new Map(project.statuses.map((status) => [status.id, status.position]));
  const byColumn = (a: IssueDto, b: IssueDto) =>
    position.get(a.statusId)! - position.get(b.statusId)! || byRank(a, b);
  const inSprint = (sprintId: string) => issues.filter((issue) => issue.sprintId === sprintId).sort(byColumn);
  const backlog = issues.filter((issue) => !issue.sprintId && !doneStatusIds.has(issue.statusId)).sort(byColumn);
  const hasActive = openSprints.some((sprint) => sprint.state === 'ACTIVE');
  const failure = [actions.start.error, actions.complete.error, actions.create.error].find(
    (error) => error instanceof ApiError,
  );

  function createSprint(event: FormEvent) {
    event.preventDefault();
    if (!newSprint.trim()) return;
    actions.create.mutate({ name: newSprint }, { onSuccess: () => setNewSprint('') });
  }

  return (
    <div className="mx-auto h-full max-w-5xl space-y-6 overflow-y-auto px-4 py-5 sm:px-6">
      {failure && <FormError message={failure.message} />}

      {openSprints.map((sprint) => {
        const sprintIssues = inSprint(sprint.id);
        const remaining = sprintIssues.filter((issue) => !doneStatusIds.has(issue.statusId)).length;
        return (
          <Section
            key={sprint.id}
            title={sprint.name}
            badge={sprint.state === 'ACTIVE' ? 'En cours' : undefined}
            subtitle={sprintSubtitle(sprint, sprintIssues)}
            action={
              canEdit &&
              (sprint.state === 'ACTIVE' ? (
                <Button
                  size="sm"
                  disabled={actions.complete.isPending}
                  onClick={() => {
                    const warning = remaining
                      ? `${plural(remaining, 'ticket non terminé retournera', 'tickets non terminés retourneront')} au backlog.`
                      : 'Tous les tickets sont terminés.';
                    if (window.confirm(`Terminer ${sprint.name} ? ${warning}`)) actions.complete.mutate(sprint.id);
                  }}
                >
                  Terminer le sprint
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="primary"
                  disabled={hasActive || sprintIssues.length === 0 || actions.start.isPending}
                  title={
                    hasActive
                      ? 'Un autre sprint est déjà en cours'
                      : sprintIssues.length === 0
                        ? 'Ajoutez des tickets avant de démarrer'
                        : undefined
                  }
                  onClick={() => actions.start.mutate(sprint.id)}
                >
                  Démarrer le sprint
                </Button>
              ))
            }
            empty="Ce sprint est vide. Envoyez-y des tickets depuis le backlog."
          >
            {sprintIssues.map((issue) => (
              <Row key={issue.id} issue={issue} sprints={openSprints} />
            ))}
          </Section>
        );
      })}

      <Section
        title="Backlog"
        subtitle={plural(backlog.length, 'ticket')}
        empty="Le backlog est vide. Les tickets créés hors sprint arrivent ici."
        action={
          canEdit && (
            <form onSubmit={createSprint} className="flex gap-2">
              <Input
                value={newSprint}
                onChange={(event) => setNewSprint(event.target.value)}
                placeholder="Nom du sprint"
                aria-label="Nom du nouveau sprint"
                className="h-8 w-28 text-[13px] sm:w-36"
              />
              <Button type="submit" size="sm" disabled={!newSprint.trim() || actions.create.isPending}>
                Créer un sprint
              </Button>
            </form>
          )
        }
      >
        {backlog.map((issue) => (
          <Row key={issue.id} issue={issue} sprints={openSprints} />
        ))}
      </Section>
    </div>
  );
}

function sprintSubtitle(sprint: SprintDto, issues: IssueDto[]) {
  const points = issues.reduce((sum, issue) => sum + (issue.estimate ?? 0), 0);
  const parts = [plural(issues.length, 'ticket')];
  if (points) parts.push(plural(points, 'point'));
  if (sprint.startDate && sprint.endDate) parts.push(`du ${formatDay(sprint.startDate)} au ${formatDay(sprint.endDate)}`);
  return parts.join(', ');
}

interface SectionProps {
  title: string;
  subtitle: string;
  badge?: string;
  action?: ReactNode;
  empty: string;
  children: ReactNode[];
}

function Section({ title, subtitle, badge, action, empty, children }: SectionProps) {
  return (
    <section>
      <header className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="font-semibold">{title}</h2>
        {badge && (
          <span className="rounded-full bg-gentiane-soft px-2 py-0.5 text-xs font-medium text-gentiane">{badge}</span>
        )}
        <span className="text-[13px] text-ink-2">{subtitle}</span>
        <div className="ml-auto">{action}</div>
      </header>
      {children.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-sm text-ink-3">
          {empty}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">{children}</ul>
      )}
    </section>
  );
}

function Row({ issue, sprints }: { issue: IssueDto; sprints: SprintDto[] }) {
  const { project, canEdit } = useProjectContext();
  const openIssue = useOpenIssue();
  const update = useUpdateIssue(project.id);
  const status = project.statuses.find((candidate) => candidate.id === issue.statusId);

  return (
    <li className="flex items-center gap-2 pr-2 hover:bg-neve sm:gap-3 sm:pr-3">
      <button
        type="button"
        onClick={() => openIssue(issue.id)}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3 text-left sm:pl-4"
      >
        <TypeIcon type={issue.type} />
        <span className="tabular hidden w-16 shrink-0 text-[13px] text-ink-3 sm:block">{issue.key}</span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{issue.title}</span>
        {status && (
          <span className="hidden shrink-0 items-center gap-1.5 text-[13px] text-ink-2 md:inline-flex">
            <StatusDot category={status.category} /> {status.name}
          </span>
        )}
        <PriorityIcon priority={issue.priority} />
        {issue.estimate !== null && (
          <span className="tabular w-6 shrink-0 rounded-full bg-neve py-0.5 text-center text-xs font-medium text-ink-2">
            {issue.estimate}
          </span>
        )}
        {issue.assignee ? <Avatar name={issue.assignee.name} /> : <span className="size-6 shrink-0" />}
      </button>
      {canEdit && sprints.length > 0 && (
        <select
          value={issue.sprintId ?? ''}
          onChange={(event) => update.mutate({ issueId: issue.id, changes: { sprintId: event.target.value || null } })}
          aria-label={`Sprint de ${issue.key}`}
          className="h-8 w-24 shrink-0 rounded-lg border border-line bg-surface px-1.5 text-[13px] text-ink-2 hover:border-line-strong sm:w-28"
        >
          <option value="">Backlog</option>
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}
