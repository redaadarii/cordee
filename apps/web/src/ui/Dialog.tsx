import { X } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// <dialog> natif : piège du focus, Échap et arrière-plan inerte sans dépendance.
export function Dialog({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => event.target === ref.current && onClose()}
      className="m-auto w-[min(32rem,calc(100vw-1.5rem))] rounded-2xl bg-surface p-0 text-ink shadow-lift"
    >
      <div className="p-5 sm:p-6">
        <header className="mb-5 flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="rounded-md p-1 text-ink-3 hover:bg-ink/5 hover:text-ink"
          >
            <X size={18} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
