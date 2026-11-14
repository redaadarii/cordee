const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
const shortDate = new Intl.DateTimeFormat('fr', { day: 'numeric', month: 'short' });

export function timeAgo(iso: string): string {
  const minutes = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return relative.format(days, 'day');
  return shortDate.format(new Date(iso));
}

export const formatDay = (iso: string) => shortDate.format(new Date(iso));

export function daysUntil(iso: string): number {
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  return Math.round((startOfDay(new Date(iso)) - startOfDay(new Date())) / 86_400_000);
}

export const isOverdue = (iso: string | null) => iso !== null && daysUntil(iso) < 0;

export const plural = (count: number, singular: string, pluralForm = `${singular}s`) =>
  `${count} ${count > 1 ? pluralForm : singular}`;

export const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
export const fromDateInput = (value: string) => (value ? new Date(`${value}T12:00:00`).toISOString() : null);

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} Mo`;
}
