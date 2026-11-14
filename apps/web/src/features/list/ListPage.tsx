import { ISSUE_PRIORITIES, ISSUE_TYPES, type IssueDto } from '@cordee/shared';
import clsx from 'clsx';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { useState } from 'react';
import { PRIORITY_LABELS, PriorityIcon, StatusDot, TYPE_LABELS, TypeIcon } from '@/features/issues/meta';
import { useIssues } from '@/features/issues/queries';
import { useOpenIssue, useProjectContext } from '@/features/projects/ProjectLayout';
import { formatDay, isOverdue, plural } from '@/lib/format';
import { Avatar } from '@/ui/Avatar';
import { Input, Select } from '@/ui/Field';

type SortKey = 'number' | 'title' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'updatedAt';

const COLUMNS: { key: SortKey; label: string; className?: string }[] = [
  { key: 'number', label: 'Clé', className: 'w-28' },
  { key: 'title', label: 'Titre' },
  { key: 'status', label: 'Statut', className: 'w-36' },
  { key: 'priority', label: 'Priorité', className: 'w-28' },
  { key: 'assignee', label: 'Assigné', className: 'w-44' },
  { key: 'dueDate', label: 'Échéance', className: 'w-28' },
];

export function ListPage() {
  const { project } = useProjectContext();
  const { data: issues = [], isPending } = useIssues(project.id);
  const openIssue = useOpenIssue();
  const [filters, setFilters] = useState({ q: '', statusId: '', type: '', priority: '', assigneeId: '', labelId: '' });
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: 'updatedAt', descending: true });

  const statusById = new Map(project.statuses.map((status) => [status.id, status]));
  const set = (key: keyof typeof filters) => (event: { target: { value: string } }) =>
    setFilters({ ...filters, [key]: event.target.value });

  const value = (issue: IssueDto): string | number => {
    switch (sort.key) {
      case 'status':
        return statusById.get(issue.statusId)?.position ?? 0;
      case 'priority':
        return ISSUE_PRIORITIES.indexOf(issue.priority);
      case 'assignee':
        return issue.assignee?.name ?? '￿';
      case 'dueDate':
        return issue.dueDate ?? '￿';
      default:
        return issue[sort.key];
    }
  };

  const needle = filters.q.trim().toLowerCase();
  const rows = issues
    .filter(
      (issue) =>
        (!needle || issue.title.toLowerCase().includes(needle) || issue.key.toLowerCase().includes(needle)) &&
        (!filters.statusId || issue.statusId === filters.statusId) &&
        (!filters.type || issue.type === filters.type) &&
        (!filters.priority || issue.priority === filters.priority) &&
        (!filters.labelId || issue.labelIds.includes(filters.labelId)) &&
        (!filters.assigneeId ||
          (filters.assigneeId === 'none' ? !issue.assignee : issue.assignee?.id === filters.assigneeId)),
    )
    .sort((a, b) => {
      const [x, y] = [value(a), value(b)];
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'fr');
      return sort.descending ? -order : order;
    });
  const filtered = Object.values(filters).some(Boolean);

  return (
    <div className="flex h-full flex-col px-4 py-4 sm:px-6">
      <div className="grid shrink-0 grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Input value={filters.q} onChange={set('q')} placeholder="Filtrer par titre ou clé" aria-label="Filtrer par titre ou clé" className="col-span-2 h-9 sm:col-span-1" />
        <Select value={filters.statusId} onChange={set('statusId')} aria-label="Statut" className="h-9 text-[13px]">
          <option value="">Tous les statuts</option>
          {project.statuses.map((status) => (
            <option key={status.id} value={status.id}>
              {status.name}
            </option>
          ))}
        </Select>
        <Select value={filters.type} onChange={set('type')} aria-label="Type" className="h-9 text-[13px]">
          <option value="">Tous les types</option>
          {ISSUE_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <Select value={filters.priority} onChange={set('priority')} aria-label="Priorité" className="h-9 text-[13px]">
          <option value="">Toutes les priorités</option>
          {ISSUE_PRIORITIES.map((priority) => (
            <option key={priority} value={priority}>
              {PRIORITY_LABELS[priority]}
            </option>
          ))}
        </Select>
        <Select value={filters.assigneeId} onChange={set('assigneeId')} aria-label="Assigné" className="h-9 text-[13px]">
          <option value="">Tout le monde</option>
          <option value="none">Non assigné</option>
          {project.members.map(({ user }) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </Select>
        <Select value={filters.labelId} onChange={set('labelId')} aria-label="Étiquette" className="h-9 text-[13px]">
          <option value="">Toutes les étiquettes</option>
          {project.labels.map((label) => (
            <option key={label.id} value={label.id}>
              {label.name}
            </option>
          ))}
        </Select>
      </div>

      <p className="tabular mt-3 shrink-0 text-[13px] text-ink-2" role="status">
        {isPending ? 'Chargement…' : plural(rows.length, 'ticket')}
        {filtered && !isPending && ` sur ${issues.length}`}
        {filtered && (
          <button
            type="button"
            onClick={() => setFilters({ q: '', statusId: '', type: '', priority: '', assigneeId: '', labelId: '' })}
            className="ml-3 font-medium text-gentiane hover:underline"
          >
            Effacer les filtres
          </button>
        )}
      </p>

      <div className="mt-2 min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[60rem] table-fixed text-left text-sm">
          <thead className="sticky top-0 z-[1] bg-surface text-[13px] text-ink-2 shadow-[0_1px_0_var(--color-line)]">
            <tr>
              {COLUMNS.map((column) => {
                const active = sort.key === column.key;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : undefined}
                    className={clsx('px-3 py-2 font-medium', column.className)}
                  >
                    <button
                      type="button"
                      onClick={() => setSort({ key: column.key, descending: active && !sort.descending })}
                      className="inline-flex items-center gap-1 hover:text-ink"
                    >
                      {column.label}
                      {active && (sort.descending ? <ArrowDown size={13} /> : <ArrowUp size={13} />)}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((issue) => {
              const status = statusById.get(issue.statusId);
              return (
                <tr key={issue.id} onClick={() => openIssue(issue.id)} className="cursor-pointer hover:bg-neve">
                  <td className="tabular px-3 py-2.5 whitespace-nowrap text-ink-2">
                    <span className="inline-flex items-center gap-2">
                      <TypeIcon type={issue.type} size={14} /> {issue.key}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button type="button" className="block w-full truncate text-left font-medium hover:underline">
                      {issue.title}
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    {status && (
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot category={status.category} /> <span className="truncate">{status.name}</span>
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-1.5 text-ink-2">
                      <PriorityIcon priority={issue.priority} /> {PRIORITY_LABELS[issue.priority]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    {issue.assignee ? (
                      <span className="flex items-center gap-2">
                        <Avatar name={issue.assignee.name} size="sm" />
                        <span className="truncate">{issue.assignee.name}</span>
                      </span>
                    ) : (
                      <span className="text-ink-3">Personne</span>
                    )}
                  </td>
                  <td className={clsx('tabular px-3 py-2.5', isOverdue(issue.dueDate) && !['DONE', 'CANCELED'].includes(status?.category ?? '') ? 'font-medium text-rhodo' : 'text-ink-2')}>
                    {issue.dueDate ? formatDay(issue.dueDate) : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isPending && rows.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-ink-3">
            {filtered ? 'Aucun ticket ne correspond à ces filtres.' : 'Ce projet ne contient encore aucun ticket.'}
          </p>
        )}
      </div>
    </div>
  );
}
