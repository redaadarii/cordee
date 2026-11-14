import { hasRole } from '@cordee/shared';
import { Plus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ApiError } from '@/lib/api';
import { plural } from '@/lib/format';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field, FormError, Input, Textarea } from '@/ui/Field';
import { useCreateProject, useProjects, useWorkspace } from './queries';

const COLORS = ['#3d4db7', '#2f7d5b', '#b7791f', '#c8375b', '#7a5ac2', '#1f7a8c'];

export function ProjectsPage() {
  const workspace = useWorkspace();
  const { data: projects, isPending } = useProjects();
  const [creating, setCreating] = useState(false);
  const canCreate = !!workspace && hasRole(workspace.role, 'ADMIN');
  const active = projects?.filter((project) => !project.archivedAt) ?? [];
  const archived = projects?.filter((project) => project.archivedAt) ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projets</h1>
          <p className="mt-1 text-ink-2">{workspace?.name}</p>
        </div>
        {canCreate && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> Nouveau projet
          </Button>
        )}
      </div>

      {!isPending && projects?.length === 0 && (
        <div className="mt-8 rounded-xl border border-dashed border-line-strong p-10 text-center">
          <p className="font-medium">Aucun projet dans cet espace</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
            {canCreate
              ? 'Un projet regroupe un tableau, un backlog et des sprints. Créez le premier pour commencer.'
              : "Un administrateur de l'espace doit créer le premier projet."}
          </p>
          {canCreate && (
            <Button variant="primary" className="mt-4" onClick={() => setCreating(true)}>
              Créer un projet
            </Button>
          )}
        </div>
      )}

      {active.length > 0 && (
        <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {active.map((project) => (
            <li key={project.id}>
              <Link to={`/p/${project.id}`} className="flex items-center gap-4 px-4 py-4 hover:bg-neve">
                <span
                  className="tabular flex size-10 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                  style={{ backgroundColor: project.color }}
                >
                  {project.key}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{project.name}</span>
                  {project.description && (
                    <span className="block truncate text-sm text-ink-2">{project.description}</span>
                  )}
                </span>
                <span className="tabular shrink-0 text-sm text-ink-2">
                  {plural(project.openIssueCount, 'ticket ouvert', 'tickets ouverts')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {archived.length > 0 && (
        <>
          <h2 className="mt-8 font-semibold">Projets archivés</h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {archived.map((project) => (
              <li key={project.id}>
                <Link to={`/p/${project.id}/settings`} className="flex items-center gap-3 px-4 py-3 text-ink-2 hover:bg-neve">
                  <span className="tabular text-[13px]">{project.key}</span>
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <span className="text-[13px]">Ouvrir les réglages</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}

      {creating && <CreateProjectDialog onClose={() => setCreating(false)} />}
    </div>
  );
}

function suggestKey(name: string) {
  const words = name
    .normalize('NFD')
    .replace(/[^a-zA-Z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const key = words.length > 1 ? words.map((word) => word[0]).join('') : (words[0] ?? '').slice(0, 3);
  return key.toUpperCase().slice(0, 4);
}

function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const create = useCreateProject();
  const [name, setName] = useState('');
  const [key, setKey] = useState<string | null>(null);
  const [color, setColor] = useState(COLORS[0]);
  const error = create.error instanceof ApiError ? create.error : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const description = new FormData(event.currentTarget).get('description') as string;
    create.mutate(
      { name, key: key ?? suggestKey(name), color, description: description || undefined },
      { onSuccess: (project) => void navigate(`/p/${project.id}`) },
    );
  }

  return (
    <Dialog title="Nouveau projet" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[1fr_7rem] gap-3">
          <Field label="Nom" error={error?.fields.name}>
            <Input value={name} onChange={(event) => setName(event.target.value)} required autoFocus />
          </Field>
          <Field label="Clé" error={error?.fields.key}>
            <Input
              value={key ?? suggestKey(name)}
              onChange={(event) => setKey(event.target.value.toUpperCase())}
              maxLength={6}
              required
              className="tabular uppercase"
            />
          </Field>
        </div>
        <p className="-mt-2 text-[13px] text-ink-3">
          La clé préfixe les tickets ({key ?? (suggestKey(name) || 'APP')}-1) et ne peut plus changer ensuite.
        </p>
        <Field label="Description (facultative)">
          <Textarea name="description" rows={2} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Couleur</legend>
          <div className="flex gap-2">
            {COLORS.map((option) => (
              <label key={option} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  checked={color === option}
                  onChange={() => setColor(option)}
                  className="peer sr-only"
                />
                <span
                  className="block size-7 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-gentiane"
                  style={{ backgroundColor: option }}
                />
              </label>
            ))}
          </div>
        </fieldset>
        {error && Object.keys(error.fields).length === 0 && <FormError message={error.message} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={create.isPending || !name.trim()}>
            Créer le projet
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
