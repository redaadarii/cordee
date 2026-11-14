import type { IssuePriority, IssueType, StatusCategory } from '@cordee/shared';
import clsx from 'clsx';
import { Bookmark, Bug, CheckSquare, Zap } from 'lucide-react';

export const TYPE_LABELS: Record<IssueType, string> = {
  EPIC: 'Épopée',
  STORY: 'Récit',
  TASK: 'Tâche',
  BUG: 'Anomalie',
};

export const PRIORITY_LABELS: Record<IssuePriority, string> = {
  URGENT: 'Urgente',
  HIGH: 'Haute',
  MEDIUM: 'Moyenne',
  LOW: 'Basse',
  NONE: 'Aucune',
};

export const CATEGORY_LABELS: Record<StatusCategory, string> = {
  BACKLOG: 'Backlog',
  TODO: 'À faire',
  IN_PROGRESS: 'En cours',
  DONE: 'Terminé',
  CANCELED: 'Annulé',
};

export const CATEGORY_DOT: Record<StatusCategory, string> = {
  BACKLOG: 'border-2 border-dashed border-ink-3',
  TODO: 'border-2 border-ink-3',
  IN_PROGRESS: 'bg-gentiane',
  DONE: 'bg-lichen',
  CANCELED: 'bg-line-strong',
};

const TYPE_ICONS: Record<IssueType, { icon: typeof Bug; className: string }> = {
  EPIC: { icon: Zap, className: 'text-[#7a5ac2]' },
  STORY: { icon: Bookmark, className: 'text-lichen' },
  TASK: { icon: CheckSquare, className: 'text-gentiane' },
  BUG: { icon: Bug, className: 'text-rhodo' },
};

export function TypeIcon({ type, size = 15 }: { type: IssueType; size?: number }) {
  const { icon: Icon, className } = TYPE_ICONS[type];
  return (
    <span title={TYPE_LABELS[type]} className={clsx('inline-flex shrink-0', className)}>
      <Icon size={size} strokeWidth={2.2} aria-label={TYPE_LABELS[type]} />
    </span>
  );
}

const BARS: Record<Exclude<IssuePriority, 'URGENT'>, number> = { HIGH: 3, MEDIUM: 2, LOW: 1, NONE: 0 };

// La priorité se lit à la hauteur des barres, pas seulement à la couleur.
export function PriorityIcon({ priority }: { priority: IssuePriority }) {
  const label = `Priorité ${PRIORITY_LABELS[priority].toLowerCase()}`;
  if (priority === 'URGENT') {
    return (
      <span
        title={label}
        aria-label={label}
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-rhodo text-[11px] leading-none font-bold text-on-accent"
      >
        !
      </span>
    );
  }
  const filled = BARS[priority];
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" role="img" aria-label={label}>
      <title>{label}</title>
      {[0, 1, 2].map((bar) => (
        <rect
          key={bar}
          x={2 + bar * 4.5}
          y={10 - bar * 3.5}
          width="3"
          height={4 + bar * 3.5}
          rx="1"
          className={bar < filled ? 'fill-ink-2' : 'fill-line-strong'}
        />
      ))}
    </svg>
  );
}

export function StatusDot({ category }: { category: StatusCategory }) {
  return <span className={clsx('inline-block size-2.5 shrink-0 rounded-full', CATEGORY_DOT[category])} />;
}
