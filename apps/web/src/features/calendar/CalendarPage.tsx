import type { IssueDto } from '@cordee/shared';
import clsx from 'clsx';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { TypeIcon } from '@/features/issues/meta';
import { useIssues } from '@/features/issues/queries';
import { useOpenIssue, useProjectContext } from '@/features/projects/ProjectLayout';
import { plural } from '@/lib/format';
import { Button } from '@/ui/Button';

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const monthLabel = new Intl.DateTimeFormat('fr', { month: 'long', year: 'numeric' });
const dayLabel = new Intl.DateTimeFormat('fr', { weekday: 'long', day: 'numeric', month: 'long' });
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export function CalendarPage() {
  const { project } = useProjectContext();
  const { data: issues = [] } = useIssues(project.id);
  const openIssue = useOpenIssue();
  const [today] = useState(() => dayKey(new Date()));
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const closed = new Set(
    project.statuses.filter((s) => s.category === 'DONE' || s.category === 'CANCELED').map((s) => s.id),
  );
  const byDay = new Map<string, IssueDto[]>();
  for (const issue of issues) {
    if (!issue.dueDate) continue;
    const key = dayKey(new Date(issue.dueDate));
    byDay.set(key, [...(byDay.get(key) ?? []), issue]);
  }

  // Grille de semaines complètes, du lundi au dimanche.
  const offset = (month.getDay() + 6) % 7;
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((offset + daysInMonth) / 7) * 7 },
    (_, index) => new Date(month.getFullYear(), month.getMonth(), index - offset + 1),
  );
  const shift = (delta: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + delta, 1));
  const inMonth = cells.filter((date) => date.getMonth() === month.getMonth());
  const dueThisMonth = inMonth.reduce((sum, date) => sum + (byDay.get(dayKey(date))?.length ?? 0), 0);
  const undated = issues.filter((issue) => !issue.dueDate && !closed.has(issue.statusId)).length;

  const chip = (issue: IssueDto) => (
    <button
      key={issue.id}
      type="button"
      onClick={() => openIssue(issue.id)}
      title={`${issue.key} ${issue.title}`}
      className={clsx(
        'flex w-full items-center gap-1.5 rounded-md border px-1.5 py-1 text-left text-xs hover:border-line-strong',
        closed.has(issue.statusId)
          ? 'border-transparent bg-neve text-ink-3 line-through'
          : 'border-line bg-surface font-medium',
      )}
    >
      <TypeIcon type={issue.type} size={12} />
      <span className="truncate">{issue.title}</span>
    </button>
  );

  return (
    <div className="flex h-full flex-col px-4 py-4 sm:px-6">
      <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="min-w-40 text-lg font-semibold first-letter:uppercase">{monthLabel.format(month)}</h2>
        <div className="flex gap-1">
          <Button size="sm" onClick={() => shift(-1)} aria-label="Mois précédent">
            <ChevronLeft size={16} />
          </Button>
          <Button size="sm" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>
            Aujourd'hui
          </Button>
          <Button size="sm" onClick={() => shift(1)} aria-label="Mois suivant">
            <ChevronRight size={16} />
          </Button>
        </div>
        <p className="text-[13px] text-ink-2">
          {plural(dueThisMonth, 'échéance')} ce mois-ci
          {undated > 0 && `, ${plural(undated, 'ticket ouvert', 'tickets ouverts')} sans échéance`}
        </p>
      </div>

      {/* Grille mensuelle à partir de la tablette. */}
      <div className="mt-3 hidden min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface md:flex">
        <div className="grid shrink-0 grid-cols-7 border-b border-line text-[13px] font-medium text-ink-2">
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="px-2 py-1.5">
              {weekday}
            </div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 overflow-y-auto">
          {cells.map((date) => {
            const dayIssues = byDay.get(dayKey(date)) ?? [];
            const outside = date.getMonth() !== month.getMonth();
            return (
              <div
                key={date.toISOString()}
                className={clsx('min-h-24 border-r border-b border-line p-1.5 [&:nth-child(7n)]:border-r-0', outside && 'bg-neve/60')}
              >
                <p
                  className={clsx(
                    'tabular mb-1 flex size-6 items-center justify-center rounded-full text-xs',
                    dayKey(date) === today ? 'bg-gentiane font-semibold text-on-accent' : outside ? 'text-ink-3' : 'text-ink-2',
                  )}
                >
                  {date.getDate()}
                </p>
                <div className="space-y-1">{dayIssues.map(chip)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sur téléphone, une grille de 7 colonnes est illisible : agenda des jours qui ont une échéance. */}
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto md:hidden">
        {dueThisMonth === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-3">
            Aucune échéance ce mois-ci.
          </p>
        ) : (
          <ul className="space-y-3">
            {inMonth
              .filter((date) => byDay.has(dayKey(date)))
              .map((date) => (
                <li key={date.toISOString()}>
                  <p className={clsx('mb-1 text-[13px] font-medium first-letter:uppercase', dayKey(date) === today ? 'text-gentiane' : 'text-ink-2')}>
                    {dayLabel.format(date)}
                  </p>
                  <div className="space-y-1">{byDay.get(dayKey(date))!.map(chip)}</div>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
