import clsx from 'clsx';
import { FolderKanban, LogOut, Menu, Plus, Search, UserRound, Users, X } from 'lucide-react';
import type { WorkspaceDto } from '@cordee/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, Suspense, useEffect, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { NotificationsMenu } from '@/features/notifications/NotificationsMenu';
import { useProjects, useWorkspace, useWorkspaces } from '@/features/projects/queries';
import { CommandPalette } from '@/features/search/CommandPalette';
import { api } from '@/lib/api';
import { useNotificationRealtime } from '@/lib/realtime';
import { useSession, useWorkspaceChoice } from '@/stores/session';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field, Input } from '@/ui/Field';
import { Logo } from '@/ui/Logo';

const navLink = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
    isActive ? 'bg-white/10 font-medium text-white' : 'text-white/65 hover:bg-white/5 hover:text-white',
  );

export function AppShell() {
  const { status, user, signOut } = useSession();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const [path, setPath] = useState(location.pathname);
  // Changer de page referme le menu sur téléphone.
  if (location.pathname !== path) {
    setPath(location.pathname);
    setMenuOpen(false);
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (status === 'loading') {
    return (
      <div className="grid min-h-dvh place-items-center bg-ardoise text-white">
        <Logo />
      </div>
    );
  }
  if (status === 'signed-out' || !user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-dvh overflow-hidden">
      {menuOpen && (
        <button
          type="button"
          aria-label="Fermer le menu"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-ardoise/50 lg:hidden"
        />
      )}

      <aside
        className={clsx(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-ardoise text-white transition-transform lg:static lg:translate-x-0',
          menuOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Logo />
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Fermer le menu"
            className="rounded-md p-1 text-white/60 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <WorkspaceSwitcher />

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <NavLink to="/" end className={navLink}>
            <UserRound size={16} /> Mon travail
          </NavLink>
          <NavLink to="/projects" className={navLink}>
            <FolderKanban size={16} /> Projets
          </NavLink>
          <NavLink to="/members" className={navLink}>
            <Users size={16} /> Membres
          </NavLink>
          <ProjectLinks />
        </nav>

        <div className="flex items-center gap-2.5 border-t border-white/10 p-3">
          <Link to="/account" title="Mon compte" className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 hover:bg-white/10">
            <Avatar name={user.name} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{user.name}</span>
              <span className="block truncate text-xs text-white/50">{user.email}</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Se déconnecter"
            title="Se déconnecter"
            className="rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-5">
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Ouvrir le menu"
            className="rounded-md p-2 text-ink-2 hover:bg-ink/5 lg:hidden"
          >
            <Menu size={20} />
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-neve px-3 text-sm text-ink-3 hover:border-line-strong sm:max-w-sm"
          >
            <Search size={15} className="shrink-0" />
            <span className="truncate">Chercher un ticket</span>
            <kbd className="ml-auto hidden rounded border border-line-strong bg-surface px-1.5 text-[11px] font-medium text-ink-2 sm:block">
              Ctrl K
            </kbd>
          </button>
          <div className="ml-auto">
            <NotificationsMenu />
          </div>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>
      </div>

      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <RealtimeNotifications />
    </div>
  );
}

function RealtimeNotifications() {
  useNotificationRealtime();
  return null;
}

function WorkspaceSwitcher() {
  const { data: workspaces } = useWorkspaces();
  const current = useWorkspace();
  const choose = useWorkspaceChoice((state) => state.choose);
  const [creating, setCreating] = useState(false);

  if (!workspaces || !current) return <div className="h-[52px]" />;
  return (
    <div className="flex gap-1.5 px-3 pb-3">
      <label className="sr-only" htmlFor="workspace">
        Espace de travail
      </label>
      <select
        id="workspace"
        value={current.id}
        onChange={(event) => choose(event.target.value)}
        className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-ardoise-2 px-2.5 text-sm font-medium text-white"
      >
        {workspaces.map((workspace) => (
          <option key={workspace.id} value={workspace.id}>
            {workspace.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={() => setCreating(true)}
        aria-label="Créer un espace de travail"
        title="Créer un espace de travail"
        className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
      >
        <Plus size={16} />
      </button>
      {creating && <CreateWorkspaceDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function CreateWorkspaceDialog({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const choose = useWorkspaceChoice((state) => state.choose);
  const create = useMutation({
    mutationFn: (name: string) => api.post<WorkspaceDto>('/workspaces', { name }),
    onSuccess: async (workspace) => {
      await client.invalidateQueries({ queryKey: ['workspaces'] });
      choose(workspace.id);
      onClose();
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.mutate(new FormData(event.currentTarget).get('name') as string);
  }

  return (
    <Dialog title="Nouvel espace de travail" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="-mt-2 text-sm text-ink-2">
          Un espace regroupe des projets et des membres. Vous en serez le propriétaire.
        </p>
        <Field label="Nom">
          <Input name="name" required minLength={2} maxLength={60} autoFocus placeholder="Mon équipe" />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={create.isPending}>
            Créer l'espace
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ProjectLinks() {
  const { data: projects } = useProjects();
  const active = projects?.filter((project) => !project.archivedAt) ?? [];
  if (active.length === 0) return null;

  return (
    <>
      <p className="mt-6 mb-1.5 px-2.5 text-xs font-medium text-white/40">Vos projets</p>
      {active.map((project) => (
        <NavLink key={project.id} to={`/p/${project.id}`} className={navLink}>
          <span className="size-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: project.color }} />
          <span className="truncate">{project.name}</span>
          {project.openIssueCount > 0 && (
            <span className="tabular ml-auto text-xs text-white/40">{project.openIssueCount}</span>
          )}
        </NavLink>
      ))}
    </>
  );
}
