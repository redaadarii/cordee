import clsx from 'clsx';

const TINTS = ['#3d4db7', '#2f7d5b', '#b7791f', '#c8375b', '#7a5ac2', '#1f7a8c', '#8a5a44'];

function tint(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length];
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      title={name}
      aria-label={name}
      style={{ backgroundColor: tint(name) }}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none',
        size === 'sm' && 'size-5 text-[9px]',
        size === 'md' && 'size-6 text-[10px]',
        size === 'lg' && 'size-8 text-xs',
      )}
    >
      {initials(name)}
    </span>
  );
}
