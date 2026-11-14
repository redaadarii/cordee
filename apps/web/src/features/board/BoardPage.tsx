import type { IssueDto, StatusDto } from '@cordee/shared';
import {
  closestCorners,
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clsx from 'clsx';
import { generateKeyBetween } from 'fractional-indexing';
import { Plus } from 'lucide-react';
import { type FormEvent, useMemo, useState } from 'react';
import { StatusDot } from '@/features/issues/meta';
import { byRank, useCreateIssue, useIssues, useMoveIssue } from '@/features/issues/queries';
import { useOpenIssue, useProjectContext } from '@/features/projects/ProjectLayout';
import { upsertIssue } from '@/lib/realtime';
import { Avatar } from '@/ui/Avatar';
import { Select } from '@/ui/Field';
import { IssueCard } from './IssueCard';
import { Rope } from './Rope';

type Columns = Record<string, string[]>;

export function BoardPage() {
  const { project, canEdit } = useProjectContext();
  const { data: issues = [], isPending } = useIssues(project.id);
  const move = useMoveIssue(project.id);
  const openIssue = useOpenIssue();

  const activeSprint = project.sprints.find((sprint) => sprint.state === 'ACTIVE');
  const [scope, setScope] = useState<'sprint' | 'all'>('sprint');
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ issueId: string; columns: Columns } | null>(null);

  const sprintScope = scope === 'sprint' && activeSprint;
  const completedSprintIds = new Set(
    project.sprints.filter((sprint) => sprint.state === 'COMPLETED').map((sprint) => sprint.id),
  );
  const inScope = issues.filter((issue) =>
    sprintScope ? issue.sprintId === activeSprint.id : !completedSprintIds.has(issue.sprintId ?? ''),
  );
  const visible = inScope.filter((issue) => !assigneeId || issue.assignee?.id === assigneeId);
  const byId = useMemo(() => new Map(issues.map((issue) => [issue.id, issue])), [issues]);

  const settled: Columns = Object.fromEntries(
    project.statuses.map((status) => [
      status.id,
      visible
        .filter((issue) => issue.statusId === status.id)
        .sort(byRank)
        .map((issue) => issue.id),
    ]),
  );
  const columns = drag?.columns ?? settled;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Un appui long sur mobile, pour que le défilement du tableau reste possible.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    // Espace saisit et dépose la carte ; Entrée reste libre pour ouvrir le ticket.
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ['Space'], cancel: ['Escape'], end: ['Space'] },
    }),
  );

  const columnOf = (state: Columns, id: string) =>
    id in state ? id : Object.keys(state).find((statusId) => state[statusId].includes(id));

  function onDragOver({ active, over }: DragOverEvent) {
    if (!over || !drag) return;
    const from = columnOf(drag.columns, String(active.id));
    const to = columnOf(drag.columns, String(over.id));
    if (!from || !to || from === to) return;

    const target = drag.columns[to];
    const overIndex = target.indexOf(String(over.id));
    const insertAt = overIndex === -1 ? target.length : overIndex;
    setDrag({
      ...drag,
      columns: {
        ...drag.columns,
        [from]: drag.columns[from].filter((id) => id !== active.id),
        [to]: [...target.slice(0, insertAt), String(active.id), ...target.slice(insertAt)],
      },
    });
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    const state = drag;
    setDrag(null);
    if (!state || !over) return;

    const issueId = String(active.id);
    const statusId = columnOf(state.columns, issueId)!;
    let order = state.columns[statusId];
    const overIndex = order.indexOf(String(over.id));
    if (overIndex !== -1) order = arrayMove(order, order.indexOf(issueId), overIndex);

    const index = order.indexOf(issueId);
    const afterIssueId = order[index - 1] ?? null;
    const before = settled[statusId];
    const unchanged =
      byId.get(issueId)!.statusId === statusId && (before[before.indexOf(issueId) - 1] ?? null) === afterIssueId;
    if (unchanged) return;

    // Même calcul de rang que le serveur : la carte ne bouge pas quand la réponse arrive.
    const rank = generateKeyBetween(
      byId.get(afterIssueId ?? '')?.rank ?? null,
      byId.get(order[index + 1] ?? '')?.rank ?? null,
    );
    upsertIssue({ ...byId.get(issueId)!, statusId, rank });
    move.mutate({ issueId, statusId, afterIssueId });
  }

  // Pendant un sprint, la colonne Backlog n'a d'intérêt que si un ticket du sprint y traîne.
  const shownStatuses = project.statuses.filter(
    (status) => !sprintScope || status.category !== 'BACKLOG' || settled[status.id].length > 0,
  );
  const assignees = [...new Map(inScope.flatMap((issue) => (issue.assignee ? [[issue.assignee.id, issue.assignee]] : []))).values()];
  const dragged = drag ? byId.get(drag.issueId) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-3 px-4 pt-4 sm:px-6">
        {sprintScope && <Rope sprint={activeSprint} issues={inScope} statuses={project.statuses} />}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {activeSprint && (
            <Select
              value={scope}
              onChange={(event) => setScope(event.target.value as 'sprint' | 'all')}
              aria-label="Tickets affichés"
              className="h-8 w-auto text-[13px]"
            >
              <option value="sprint">{activeSprint.name}</option>
              <option value="all">Tous les tickets</option>
            </Select>
          )}
          {assignees.length > 1 && (
            <div className="flex items-center gap-1" role="group" aria-label="Filtrer par personne">
              {assignees.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  aria-pressed={assigneeId === user.id}
                  onClick={() => setAssigneeId(assigneeId === user.id ? null : user.id)}
                  className={clsx(
                    'rounded-full p-0.5 transition',
                    assigneeId === user.id ? 'ring-2 ring-gentiane' : assigneeId && 'opacity-40 hover:opacity-100',
                  )}
                >
                  <Avatar name={user.name} size="lg" />
                </button>
              ))}
              {assigneeId && (
                <button
                  type="button"
                  onClick={() => setAssigneeId(null)}
                  className="ml-1 text-[13px] font-medium text-gentiane hover:underline"
                >
                  Tout le monde
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={({ active }) => setDrag({ issueId: String(active.id), columns: settled })}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDrag(null)}
      >
        <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-3 pb-4 sm:snap-none sm:px-6">
          {shownStatuses.map((status) => (
            <Column
              key={status.id}
              status={status}
              issues={columns[status.id].flatMap((id) => byId.get(id) ?? [])}
              canEdit={canEdit}
              loading={isPending}
              sprintId={sprintScope ? activeSprint.id : null}
              onOpen={openIssue}
            />
          ))}
        </div>
        <DragOverlay>
          {dragged && (
            <div className="w-[min(18rem,80vw)]">
              <IssueCard issue={dragged} labels={project.labels} lifted />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface ColumnProps {
  status: StatusDto;
  issues: IssueDto[];
  canEdit: boolean;
  loading: boolean;
  sprintId: string | null;
  onOpen: (issueId: string) => void;
}

function Column({ status, issues, canEdit, loading, sprintId, onOpen }: ColumnProps) {
  const { project } = useProjectContext();
  const { setNodeRef, isOver } = useDroppable({ id: status.id });
  const overLimit = status.wipLimit !== null && issues.length > status.wipLimit;

  return (
    <section
      aria-label={status.name}
      className={clsx(
        'flex max-h-full w-[85vw] shrink-0 snap-center flex-col rounded-xl bg-ink/[0.045] sm:w-72',
        isOver && 'ring-2 ring-gentiane/40',
      )}
    >
      <header className="flex items-center gap-2 px-3 pt-3 pb-2">
        <StatusDot category={status.category} />
        <h2 className="truncate text-sm font-semibold">{status.name}</h2>
        <span
          className={clsx(
            'tabular rounded-full px-1.5 text-xs font-medium',
            overLimit ? 'bg-meleze-soft text-meleze' : 'text-ink-3',
          )}
          title={overLimit ? `Limite de ${status.wipLimit} tickets dépassée` : undefined}
        >
          {issues.length}
          {status.wipLimit !== null && ` / ${status.wipLimit}`}
        </span>
      </header>

      <SortableContext items={issues.map((issue) => issue.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="min-h-16 flex-1 space-y-2 overflow-y-auto px-2 pb-2">
          {issues.map((issue) => (
            <SortableCard key={issue.id} issue={issue} disabled={!canEdit} onOpen={onOpen} />
          ))}
          {!loading && issues.length === 0 && (
            <li className="px-1 py-3 text-center text-[13px] text-ink-3">Aucun ticket</li>
          )}
        </ul>
      </SortableContext>

      {canEdit && <QuickAdd projectId={project.id} statusId={status.id} sprintId={sprintId} />}
    </section>
  );
}

function SortableCard({ issue, disabled, onOpen }: { issue: IssueDto; disabled: boolean; onOpen: (id: string) => void }) {
  const { project } = useProjectContext();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: issue.id,
    disabled,
  });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={clsx('touch-manipulation', isDragging && 'opacity-30')}
    >
      <button
        type="button"
        onClick={() => onOpen(issue.id)}
        className="block w-full rounded-card text-left"
        {...attributes}
        {...listeners}
      >
        <IssueCard issue={issue} labels={project.labels} />
      </button>
    </li>
  );
}

function QuickAdd({ projectId, statusId, sprintId }: { projectId: string; statusId: string; sprintId: string | null }) {
  const create = useCreateIssue(projectId);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    create.mutate({ title, statusId, sprintId }, { onSuccess: () => setTitle('') });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="m-2 mt-0 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-ink/5 hover:text-ink"
      >
        <Plus size={15} /> Ajouter un ticket
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="p-2 pt-0">
      <input
        autoFocus
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={() => !title.trim() && setOpen(false)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        placeholder="Titre, puis Entrée"
        aria-label="Titre du nouveau ticket"
        className="h-9 w-full rounded-lg border border-gentiane bg-surface px-2.5 text-sm outline-none ring-2 ring-gentiane/20"
      />
    </form>
  );
}
