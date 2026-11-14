import type { IssueDto } from '@cordee/shared';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { TypeIcon } from '@/features/issues/meta';
import { useProjects, useWorkspace } from '@/features/projects/queries';
import { api } from '@/lib/api';

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const workspace = useWorkspace();
  const { data: projects = [] } = useProjects();
  const dialog = useRef<HTMLDialogElement>(null);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    dialog.current!.showModal();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(term.trim()), 180);
    return () => clearTimeout(timer);
  }, [term]);

  const { data: issues = [], isFetching } = useQuery({
    queryKey: ['search', workspace?.id, debounced],
    queryFn: () =>
      api.get<IssueDto[]>(`/workspaces/${workspace!.id}/search?q=${encodeURIComponent(debounced)}`),
    enabled: !!workspace && debounced.length > 0,
  });

  const matchingProjects = projects.filter(
    (project) => !debounced || project.name.toLowerCase().includes(debounced.toLowerCase()),
  );
  const results = [
    ...(debounced ? issues : []).map((issue) => ({
      id: issue.id,
      to: `/p/${issue.projectId}/board?issue=${issue.id}`,
      label: issue.title,
      hint: issue.key,
      icon: <TypeIcon type={issue.type} />,
    })),
    ...matchingProjects.map((project) => ({
      id: project.id,
      to: `/p/${project.id}`,
      label: project.name,
      hint: 'Projet',
      icon: <span className="size-3 rounded-[3px]" style={{ backgroundColor: project.color }} />,
    })),
  ];

  function go(to: string) {
    onClose();
    void navigate(to);
  }

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onMouseDown={(event) => event.target === dialog.current && onClose()}
      className="mx-auto mt-[12vh] mb-auto w-[min(36rem,calc(100vw-1.5rem))] rounded-2xl bg-surface p-0 text-ink shadow-lift"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <Search size={17} className="text-ink-3" />
        <input
          autoFocus
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setCursor(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') setCursor((cursor + 1) % Math.max(results.length, 1));
            else if (event.key === 'ArrowUp') setCursor((cursor - 1 + results.length) % Math.max(results.length, 1));
            else if (event.key === 'Enter' && results[cursor]) go(results[cursor].to);
            else return;
            event.preventDefault();
          }}
          placeholder="Titre d'un ticket, clé (APP-12) ou nom de projet"
          aria-label="Chercher"
          className="h-13 flex-1 bg-transparent py-4 text-[15px] outline-none placeholder:text-ink-3"
        />
      </div>

      <ul className="max-h-[50vh] overflow-y-auto p-2">
        {results.map((result, index) => (
          <li key={result.id}>
            <button
              type="button"
              onClick={() => go(result.to)}
              onMouseEnter={() => setCursor(index)}
              className={clsx(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm',
                index === cursor && 'bg-gentiane-soft',
              )}
            >
              <span className="flex w-4 justify-center">{result.icon}</span>
              <span className="min-w-0 flex-1 truncate">{result.label}</span>
              <span className="tabular shrink-0 text-xs text-ink-3">{result.hint}</span>
            </button>
          </li>
        ))}
        {results.length === 0 && (
          <li className="px-3 py-8 text-center text-sm text-ink-3">
            {isFetching ? 'Recherche…' : debounced ? `Aucun ticket ni projet pour « ${debounced} ».` : 'Aucun projet dans cet espace.'}
          </li>
        )}
      </ul>
    </dialog>
  );
}
