import { hasRole, type ProjectDetailDto } from '@cordee/shared';
import clsx from 'clsx';
import { Plus } from 'lucide-react';
import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet, useOutletContext, useParams, useSearchParams } from 'react-router';
import { CreateIssueDialog } from '@/features/issues/CreateIssueDialog';
import { IssueDrawer } from '@/features/issues/IssueDrawer';
import { useProjectRealtime } from '@/lib/realtime';
import { Button } from '@/ui/Button';
import { useProject } from './queries';

interface ProjectContext {
  project: ProjectDetailDto;
  canEdit: boolean;
}

export const useProjectContext = () => useOutletContext<ProjectContext>();

export function useOpenIssue() {
  const [, setParams] = useSearchParams();
  return (issueId: string | null) =>
    setParams((params) => {
      if (issueId) params.set('issue', issueId);
      else params.delete('issue');
      return params;
    });
}

const tab = ({ isActive }: { isActive: boolean }) =>
  clsx(
    '-mb-px shrink-0 border-b-2 px-1 pb-2.5 text-sm font-medium',
    isActive ? 'border-gentiane text-ink' : 'border-transparent text-ink-2 hover:text-ink',
  );

export function ProjectLayout() {
  const { projectId } = useParams() as { projectId: string };
  const { data: project, error } = useProject(projectId);
  const [params] = useSearchParams();
  const openIssue = useOpenIssue();
  const [creating, setCreating] = useState(false);
  useProjectRealtime(projectId);

  const canEdit = !!project && hasRole(project.role, 'MEMBER');
  const openIssueId = params.get('issue');

  useEffect(() => {
    if (!canEdit) return;
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement).closest('input, textarea, select, [contenteditable]');
      if (event.key === 'c' && !typing && !event.metaKey && !event.ctrlKey && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        setCreating(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit]);

  if (error) {
    return (
      <p className="p-8 text-ink-2">Ce projet n'existe pas ou vous n'y avez pas accès.</p>
    );
  }
  if (!project) return null;

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-line bg-surface px-4 pt-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span
            className="tabular flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
            style={{ backgroundColor: project.color }}
          >
            {project.key}
          </span>
          <h1 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight">
            {project.name}
            {project.archivedAt && (
              <span className="ml-2 rounded-full bg-neve px-2 py-0.5 align-middle text-xs font-medium text-ink-2">
                Archivé
              </span>
            )}
          </h1>
          {canEdit && (
            <Button variant="primary" onClick={() => setCreating(true)} title="Raccourci : C">
              <Plus size={16} />
              <span className="hidden sm:inline">Nouveau ticket</span>
              <span className="sm:hidden">Ticket</span>
            </Button>
          )}
        </div>
        <nav className="-mx-4 mt-3 flex gap-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <NavLink to="board" className={tab}>
            Tableau
          </NavLink>
          <NavLink to="backlog" className={tab}>
            Backlog
          </NavLink>
          <NavLink to="list" className={tab}>
            Liste
          </NavLink>
          <NavLink to="calendar" className={tab}>
            Calendrier
          </NavLink>
          <NavLink to="reports" className={tab}>
            Rapports
          </NavLink>
          {canEdit && (
            <NavLink to="settings" className={tab}>
              Réglages
            </NavLink>
          )}
        </nav>
      </div>

      <div className="min-h-0 flex-1">
        <Suspense fallback={null}>
          <Outlet context={{ project, canEdit } satisfies ProjectContext} />
        </Suspense>
      </div>

      {openIssueId && (
        <IssueDrawer
          key={openIssueId}
          issueId={openIssueId}
          project={project}
          canEdit={canEdit}
          onClose={() => openIssue(null)}
        />
      )}
      {creating && <CreateIssueDialog project={project} onClose={() => setCreating(false)} />}
    </div>
  );
}
