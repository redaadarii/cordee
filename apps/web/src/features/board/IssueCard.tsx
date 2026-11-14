import type { IssueDto, LabelDto } from '@cordee/shared';
import clsx from 'clsx';
import { CalendarClock, MessageSquare } from 'lucide-react';
import { PriorityIcon, TypeIcon } from '@/features/issues/meta';
import { formatDay, isOverdue } from '@/lib/format';
import { Avatar } from '@/ui/Avatar';

interface Props {
  issue: IssueDto;
  labels: LabelDto[];
  lifted?: boolean;
}

export function IssueCard({ issue, labels, lifted }: Props) {
  const issueLabels = labels.filter((label) => issue.labelIds.includes(label.id));
  const overdue = isOverdue(issue.dueDate);

  return (
    <div
      className={clsx(
        'rounded-card border bg-surface p-3 text-left',
        lifted ? 'rotate-[1.5deg] border-gentiane shadow-lift' : 'border-line shadow-card hover:border-line-strong',
      )}
    >
      <p className="text-sm leading-snug font-medium">{issue.title}</p>

      {issueLabels.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {issueLabels.map((label) => (
            <li
              key={label.id}
              className="rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ backgroundColor: `${label.color}1f`, color: label.color }}
            >
              {label.name}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-2.5 flex items-center gap-2 text-xs text-ink-2">
        <TypeIcon type={issue.type} size={14} />
        <span className="tabular">{issue.key}</span>
        {issue.priority !== 'NONE' && <PriorityIcon priority={issue.priority} />}
        {issue.dueDate && (
          <span className={clsx('inline-flex items-center gap-1', overdue && 'font-semibold text-rhodo')}>
            <CalendarClock size={13} /> {formatDay(issue.dueDate)}
          </span>
        )}
        <span className="ml-auto flex items-center gap-2">
          {issue.commentCount > 0 && (
            <span className="tabular inline-flex items-center gap-1" title="Commentaires">
              <MessageSquare size={13} /> {issue.commentCount}
            </span>
          )}
          {issue.estimate !== null && (
            <span className="tabular rounded-full bg-neve px-1.5 py-0.5 font-medium" title="Estimation en points">
              {issue.estimate}
            </span>
          )}
          {issue.assignee && <Avatar name={issue.assignee.name} />}
        </span>
      </div>
    </div>
  );
}
