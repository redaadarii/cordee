import clsx from 'clsx';
import { Link } from 'react-router';
import { PriorityIcon, StatusDot, TypeIcon } from '@/features/issues/meta';
import { useMyIssues } from '@/features/issues/queries';
import { daysUntil, formatDay, isOverdue, plural } from '@/lib/format';
import { useCurrentUser } from '@/stores/session';

function dueLabel(iso: string) {
  const days = daysUntil(iso);
  if (days < 0) return `En retard de ${plural(-days, 'jour')}`;
  if (days === 0) return "Pour aujourd'hui";
  if (days === 1) return 'Pour demain';
  return `Pour le ${formatDay(iso)}`;
}

export function MyWorkPage() {
  const user = useCurrentUser();
  const { data: issues, isPending } = useMyIssues();
  const late = issues?.filter((issue) => isOverdue(issue.dueDate)).length ?? 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight">Bonjour {user.name.split(' ')[0]}</h1>
      <p className="mt-1 text-ink-2">
        {isPending
          ? 'Chargement de vos tickets…'
          : issues!.length === 0
            ? "Aucun ticket ne vous est confié pour l'instant."
            : `${plural(issues!.length, 'ticket ouvert', 'tickets ouverts')} à votre nom${late ? `, dont ${late} en retard` : ''}.`}
      </p>

      {issues && issues.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-line-strong p-8 text-center">
          <p className="text-ink-2">Les tickets qu'on vous confie apparaissent ici, tous projets confondus.</p>
          <Link to="/projects" className="mt-3 inline-block font-medium text-gentiane hover:underline">
            Voir les projets
          </Link>
        </div>
      )}

      {issues && issues.length > 0 && (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {issues.map((issue) => (
            <li key={issue.id}>
              <Link
                to={`/p/${issue.projectId}/board?issue=${issue.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-neve"
              >
                <TypeIcon type={issue.type} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{issue.title}</span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-2">
                    <span className="tabular">{issue.key}</span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="size-2 rounded-[2px]" style={{ backgroundColor: issue.project.color }} />
                      {issue.project.name}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <StatusDot category={issue.statusCategory} />
                      {issue.statusName}
                    </span>
                    {issue.dueDate && (
                      <span className={clsx(isOverdue(issue.dueDate) && 'font-medium text-rhodo')}>
                        {dueLabel(issue.dueDate)}
                      </span>
                    )}
                  </span>
                </span>
                <PriorityIcon priority={issue.priority} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
