import type { NotificationDto } from '@cordee/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { Avatar } from '@/ui/Avatar';

const VERBS: Record<NotificationDto['type'], string> = {
  ASSIGNED: 'vous a confié',
  COMMENTED: 'a commenté',
  MENTIONED: 'vous a mentionné dans',
};

export function NotificationsMenu() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const { data = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationDto[]>('/me/notifications'),
  });
  const unread = data.filter((notification) => !notification.readAt).length;

  const markRead = useMutation({
    mutationFn: () => api.post('/me/notifications/read'),
    onSuccess: () => client.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !container.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', close);
    };
  }, [open]);

  function toggle() {
    setOpen(!open);
    if (!open && unread > 0) markRead.mutate();
  }

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-ink-2 hover:bg-ink/5 hover:text-ink"
      >
        <Bell size={19} />
        {unread > 0 && (
          <span className="tabular absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rhodo px-1 text-[10px] font-bold text-on-accent">
            {unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-lift">
          <p className="border-b border-line px-4 py-3 text-sm font-semibold">Notifications</p>
          {data.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-3">
              Rien pour l'instant. Vous serez prévenu quand un ticket vous est confié ou commenté.
            </p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {data.map((notification) => (
                <li key={notification.id}>
                  <Link
                    to={`/p/${notification.issue.projectId}/board?issue=${notification.issue.id}`}
                    onClick={() => setOpen(false)}
                    className="flex gap-3 px-4 py-3 hover:bg-neve"
                  >
                    <Avatar name={notification.actor.name} size="lg" />
                    <span className="min-w-0 text-sm">
                      <span className="font-medium">{notification.actor.name}</span> {VERBS[notification.type]}{' '}
                      <span className="tabular font-medium">{notification.issue.key}</span>
                      <span className="block truncate text-ink-2">{notification.issue.title}</span>
                      <span className="text-xs text-ink-3">{timeAgo(notification.createdAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
