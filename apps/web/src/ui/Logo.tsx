// Quatre grimpeurs reliés par la même corde ; le premier, en tête, a atteint le relais.
export function Logo({ withName = true, tone = 'light' }: { withName?: boolean; tone?: 'light' | 'auto' }) {
  // `light` : sur le menu ardoise ; `auto` : suit la couleur du texte de la page.
  const knot = tone === 'light' ? '#ffffff' : 'var(--color-ink)';
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 32 24" className="h-6 w-8" aria-hidden="true">
        <path
          d="M4 20 L12 12 L18 16 L28 4"
          fill="none"
          stroke="#8e9bea"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="4" cy="20" r="2.6" fill={knot} />
        <circle cx="12" cy="12" r="2.6" fill={knot} />
        <circle cx="18" cy="16" r="2.6" fill={knot} />
        <circle cx="28" cy="4" r="2.6" fill="#e0a63a" />
      </svg>
      {withName && <span className="text-[17px] font-bold tracking-tight">Cordée</span>}
    </span>
  );
}
