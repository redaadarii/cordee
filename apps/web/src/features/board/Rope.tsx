import type { IssueDto, SprintDto, StatusDto } from '@cordee/shared';
import clsx from 'clsx';
import { daysUntil, plural } from '@/lib/format';

interface Props {
  sprint: SprintDto;
  issues: IssueDto[];
  statuses: StatusDto[];
}

/**
 * La voie du sprint : une corde qui monte de gauche à droite, un nœud par ticket.
 * Les tickets terminés sont derrière le premier de cordée, les autres restent à gravir.
 */
export function Rope({ sprint, issues, statuses }: Props) {
  const category = new Map(statuses.map((status) => [status.id, status.category]));
  const done = issues.filter((issue) => category.get(issue.statusId) === 'DONE').length;
  const active = issues.filter((issue) => category.get(issue.statusId) === 'IN_PROGRESS').length;
  const total = issues.length;

  // Coordonnées en pourcentage : la corde s'étire avec le conteneur, les nœuds restent ronds.
  const points = Array.from({ length: total }, (_, index) => {
    const t = total <= 1 ? 0.5 : index / (total - 1);
    return { x: 2 + t * 96, y: 84 - t * 66 + Math.sin(t * Math.PI * 3) * 11 };
  });
  const path = (count: number) =>
    points
      .slice(0, count)
      .map((p, index) => `${index === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');

  const remaining = sprint.endDate ? daysUntil(sprint.endDate) : null;
  const deadline =
    remaining === null
      ? null
      : remaining < 0
        ? `Fin dépassée de ${plural(-remaining, 'jour')}`
        : remaining === 0
          ? "Se termine aujourd'hui"
          : `${plural(remaining, 'jour restant', 'jours restants')}`;

  return (
    <section
      aria-label={`Avancement de ${sprint.name}`}
      className="flex flex-col gap-x-6 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center"
    >
      <div className="min-w-0 sm:w-56 sm:shrink-0">
        <p className="truncate text-sm font-semibold">{sprint.name}</p>
        <p className="truncate text-[13px] text-ink-2">{sprint.goal ?? deadline ?? 'Sprint en cours'}</p>
      </div>

      {total > 0 && (
        <div
          className="relative h-12 w-full min-w-0 shrink-0 sm:w-auto sm:flex-1"
          role="img"
          aria-label={`${done} tickets terminés sur ${total}, ${active} en cours`}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
            <path d={path(total)} fill="none" className="stroke-line-strong" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {done + active > 1 && (
              <path d={path(done + active)} fill="none" className="stroke-gentiane-pale" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            )}
            {done > 1 && (
              <path d={path(done)} fill="none" className="stroke-lichen" strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            )}
          </svg>
          {points.map((p, index) => (
            <span
              key={index}
              style={{ left: `${p.x}%`, top: `${p.y}%` }}
              className={clsx(
                'absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2',
                index === total - 1 ? 'size-3' : 'size-2.5',
                index < done
                  ? 'border-lichen bg-lichen'
                  : index < done + active
                    ? 'border-gentiane bg-gentiane'
                    : index === total - 1
                      ? 'border-meleze bg-surface'
                      : 'border-line-strong bg-surface',
              )}
            />
          ))}
        </div>
      )}

      <p className="tabular shrink-0 text-[13px] text-ink-2 sm:text-right">
        <span className="font-semibold text-ink">
          {done} / {total}
        </span>{' '}
        {total > 1 ? 'terminés' : 'terminé'}
        {sprint.goal && deadline && <span className="block">{deadline}</span>}
      </p>
    </section>
  );
}
