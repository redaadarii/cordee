import type { ReactNode } from 'react';
import { Logo } from '@/ui/Logo';

interface Props {
  title: string;
  intro: ReactNode;
  children: ReactNode;
}

export function AuthLayout({ title, intro, children }: Props) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <main className="flex flex-col justify-center px-6 py-10 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Logo tone="auto" />
          <h1 className="mt-10 text-[28px] leading-tight font-bold tracking-tight">{title}</h1>
          <p className="mt-2 text-ink-2">{intro}</p>
          {children}
        </div>
      </main>

      <aside className="relative hidden overflow-hidden bg-[#14212b] text-white lg:block">
        <Ridge />
        <div className="absolute inset-x-0 bottom-0 p-12">
          <p className="max-w-md text-[26px] leading-snug font-semibold tracking-tight">
            Une équipe avance au rythme de sa corde : chacun sait où en sont les autres.
          </p>
          <p className="mt-3 max-w-md text-[15px] text-white/60">
            Tableau, backlog et sprints au même endroit, mis à jour en direct pour toute l'équipe.
          </p>
        </div>
      </aside>
    </div>
  );
}

// La voie d'un sprint : chaque relais est un ticket, le dernier est le sommet.
function Ridge() {
  const route = 'M40 520 L150 440 L240 470 L340 360 L430 390 L540 260 L620 290 L720 150';
  const anchors = [
    [40, 520],
    [150, 440],
    [240, 470],
    [340, 360],
    [430, 390],
    [540, 260],
    [620, 290],
  ];
  return (
    <svg viewBox="0 0 760 640" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
      <path d="M0 640 L0 500 L170 330 L300 430 L470 200 L600 300 L760 90 L760 640 Z" fill="#1f303d" />
      <path d="M0 640 L0 590 L210 470 L360 540 L560 380 L760 470 L760 640 Z" fill="#182733" />
      <path
        d={route}
        fill="none"
        stroke="#8e9bea"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={1}
        style={{ strokeDasharray: 1, ['--rope-length' as string]: 1, animation: 'rope-draw 1.6s ease-out both' }}
      />
      {anchors.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="6" fill="#fff" />
      ))}
      <circle cx="720" cy="150" r="8" fill="#e0a63a" />
    </svg>
  );
}
