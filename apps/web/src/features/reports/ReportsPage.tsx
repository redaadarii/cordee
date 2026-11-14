import type { ProjectReportDto } from '@cordee/shared';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { StatusDot } from '@/features/issues/meta';
import { useProjectContext } from '@/features/projects/ProjectLayout';
import { api } from '@/lib/api';
import { formatDay, plural } from '@/lib/format';
import { Avatar } from '@/ui/Avatar';
import { BarChart, LineChart } from './charts';

const longDay = new Intl.DateTimeFormat('fr', { weekday: 'long', day: 'numeric', month: 'long' });
const decimal = new Intl.NumberFormat('fr', { maximumFractionDigits: 1 });

export function ReportsPage() {
  const { project } = useProjectContext();
  const { data: report } = useQuery({
    queryKey: ['reports', project.id],
    queryFn: () => api.get<ProjectReportDto>(`/projects/${project.id}/reports`),
    staleTime: 0,
  });

  if (!report) return null;
  const { burndown, velocity, byStatus, byAssignee, cycleTime } = report;
  const total = byStatus.reduce((sum, status) => sum + status.count, 0);
  const done = byStatus.filter((s) => s.category === 'DONE').reduce((sum, s) => sum + s.count, 0);
  const open = byAssignee.reduce((sum, entry) => sum + entry.open, 0);
  const maxStatus = Math.max(1, ...byStatus.map((status) => status.count));
  const maxLoad = Math.max(1, ...byAssignee.map((entry) => entry.open));
  const today = burndown?.points.findLastIndex((point) => point.remaining !== null) ?? -1;
  const recentVelocity = velocity.slice(-8);
  const usesPoints = recentVelocity.some((sprint) => sprint.points > 0);

  return (
    <div className="mx-auto h-full max-w-5xl space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Tickets ouverts" value={String(open)} />
        <Stat label="Tickets terminés" value={String(done)} detail={total ? `sur ${total}` : undefined} />
        <Stat
          label="Délai médian"
          value={cycleTime ? `${decimal.format(cycleTime.medianDays)} j` : 'n/d'}
          detail={
            cycleTime
              ? `de la création à la clôture, ${plural(cycleTime.sampleSize, 'ticket')} sur 90 jours`
              : 'aucun ticket terminé sur 90 jours'
          }
        />
        <Stat
          label="Sprint en cours"
          value={burndown && today >= 0 ? `${burndown.points[today]!.remaining} restants` : 'Aucun'}
          detail={burndown ? `${burndown.sprintName}, ${plural(burndown.total, 'ticket')}` : undefined}
        />
      </dl>

      <Panel
        title={burndown ? `Burndown de ${burndown.sprintName}` : 'Burndown'}
        hint="Tickets restant à terminer, jour par jour, face à une progression régulière. Le périmètre du sprint n'est pas historisé : un ticket ajouté en cours de route relève toute la courbe."
      >
        {burndown && burndown.total > 0 ? (
          <>
            <LineChart
              actualLabel="Restant"
              referenceLabel="Rythme idéal"
              xLabels={[...new Set([0, today, burndown.points.length - 1])].filter((index) => index >= 0)}
              points={burndown.points.map((point) => ({
                label: formatDay(point.date),
                title: longDay.format(new Date(point.date)),
                actual: point.remaining,
                reference: point.ideal,
              }))}
            />
            <DataTable
              caption="Burndown en tableau"
              head={['Jour', 'Restant', 'Rythme idéal']}
              rows={burndown.points.map((point) => [
                formatDay(point.date),
                point.remaining ?? 'à venir',
                decimal.format(point.ideal),
              ])}
            />
          </>
        ) : (
          <Empty>Démarrez un sprint contenant des tickets pour suivre son avancement ici.</Empty>
        )}
      </Panel>

      <Panel
        title="Vélocité"
        hint={`${usesPoints ? 'Points' : 'Tickets'} terminés par sprint clôturé${velocity.length > 8 ? ', sur les 8 derniers' : ''}.`}
      >
        {recentVelocity.length > 0 ? (
          <>
            <BarChart
              unit={usesPoints ? 'Points terminés' : 'Tickets terminés'}
              bars={recentVelocity.map((sprint) => ({
                label: sprint.sprintName,
                value: usesPoints ? sprint.points : sprint.issues,
                detail: `${plural(sprint.issues, 'ticket terminé', 'tickets terminés')}, ${plural(sprint.points, 'point')}`,
              }))}
            />
            <DataTable
              caption="Vélocité en tableau"
              head={['Sprint', 'Tickets terminés', 'Points']}
              rows={recentVelocity.map((sprint) => [sprint.sprintName, sprint.issues, sprint.points])}
            />
          </>
        ) : (
          <Empty>La vélocité apparaît après la clôture d'un premier sprint.</Empty>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Répartition par statut">
          <ul className="space-y-2.5">
            {byStatus.map((status) => (
              <MeterRow
                key={status.statusId}
                label={
                  <>
                    <StatusDot category={status.category} /> <span className="truncate">{status.name}</span>
                  </>
                }
                value={status.count}
                max={maxStatus}
              />
            ))}
          </ul>
        </Panel>

        <Panel title="Charge par personne" hint="Tickets ouverts, et points estimés entre parenthèses.">
          {byAssignee.length > 0 ? (
            <ul className="space-y-2.5">
              {byAssignee.map((entry) => (
                <MeterRow
                  key={entry.user?.id ?? 'none'}
                  label={
                    entry.user ? (
                      <>
                        <Avatar name={entry.user.name} size="sm" /> <span className="truncate">{entry.user.name}</span>
                      </>
                    ) : (
                      <span className="text-ink-2">Non assigné</span>
                    )
                  }
                  value={entry.open}
                  suffix={entry.points ? ` (${entry.points})` : ''}
                  max={maxLoad}
                />
              ))}
            </ul>
          ) : (
            <Empty>Aucun ticket ouvert.</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <dt className="text-[13px] text-ink-2">{label}</dt>
      <dd className="tabular mt-1 text-2xl font-bold tracking-tight">{value}</dd>
      {detail && <dd className="mt-0.5 text-xs text-ink-3">{detail}</dd>}
    </div>
  );
}

function Panel({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 max-w-2xl text-[13px] text-ink-2">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg border border-dashed border-line-strong px-4 py-8 text-center text-sm text-ink-3">{children}</p>
);

interface MeterRowProps {
  label: ReactNode;
  value: number;
  max: number;
  suffix?: string;
}

function MeterRow({ label, value, max, suffix = '' }: MeterRowProps) {
  return (
    <li className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm">
      <span className="flex min-w-0 items-center gap-2">{label}</span>
      <span className="h-2 overflow-hidden rounded-full bg-neve">
        <span className="block h-full rounded-full bg-gentiane" style={{ width: `${(value / max) * 100}%` }} />
      </span>
      <span className="tabular w-14 text-right font-medium">
        {value}
        <span className="font-normal text-ink-3">{suffix}</span>
      </span>
    </li>
  );
}

function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-[13px]">
      <summary className="cursor-pointer font-medium text-gentiane">{caption}</summary>
      <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-line">
        <table className="tabular w-full text-left">
          <thead className="bg-neve text-ink-2">
            <tr>
              {head.map((cell) => (
                <th key={cell} scope="col" className="px-3 py-1.5 font-medium">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((row) => (
              <tr key={String(row[0])}>
                {row.map((cell, index) => (
                  <td key={index} className="px-3 py-1.5">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
