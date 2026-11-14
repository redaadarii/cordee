import type { ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-gentiane text-on-accent hover:bg-gentiane-deep disabled:bg-line-strong disabled:text-ink-3',
  secondary: 'bg-surface text-ink border border-line-strong hover:border-ink-3 disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-ink/5 hover:text-ink',
  danger: 'text-rhodo hover:bg-rhodo-soft',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
}

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }: Props) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors',
        size === 'md' ? 'h-9 px-3.5 text-sm' : 'h-8 px-2.5 text-[13px]',
        VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}
