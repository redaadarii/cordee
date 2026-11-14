import {
  hasRole,
  type LabelDto,
  STATUS_CATEGORIES,
  type StatusCategory,
  type StatusDto,
  type UpdateStatusInput,
} from '@cordee/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useState } from 'react';
import { CATEGORY_LABELS, StatusDot } from '@/features/issues/meta';
import { useProjectContext } from '@/features/projects/ProjectLayout';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/ui/Button';
import { Field, FormError, Input, Select, Textarea } from '@/ui/Field';

const COLORS = ['#3d4db7', '#2f7d5b', '#b7791f', '#c8375b', '#7a5ac2', '#1f7a8c'];

function useProjectMutation<Input>(projectId: string, run: (input: Input) => Promise<unknown>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['project', projectId] });
      void client.invalidateQueries({ queryKey: ['projects'] });
      void client.invalidateQueries({ queryKey: ['issues', projectId] });
    },
  });
}

export function SettingsPage() {
  const { project } = useProjectContext();
  const isAdmin = hasRole(project.role, 'ADMIN');

  return (
    <div className="mx-auto h-full max-w-3xl space-y-6 overflow-y-auto px-4 py-6 sm:px-6">
      {isAdmin && <General />}
      {isAdmin && <Columns />}
      <Labels />
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-[13px] text-ink-2">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function General() {
  const { project } = useProjectContext();
  const [color, setColor] = useState(project.color);
  const [saved, setSaved] = useState(false);
  const update = useProjectMutation(project.id, (input: object) => api.patch(`/projects/${project.id}`, input));
  const archived = !!project.archivedAt;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    setSaved(false);
    update.mutate(
      { name: form.name, description: form.description || undefined, color },
      { onSuccess: () => setSaved(true) },
    );
  }

  return (
    <Card title="Général">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="Nom">
            <Input name="name" defaultValue={project.name} required minLength={2} maxLength={80} />
          </Field>
          <Field label="Clé">
            <Input value={project.key} readOnly className="tabular bg-neve text-ink-2" />
          </Field>
        </div>
        <Field label="Description">
          <Textarea name="description" rows={2} defaultValue={project.description ?? ''} />
        </Field>
        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Couleur</legend>
          <div className="flex gap-2">
            {COLORS.map((option) => (
              <label key={option} className="cursor-pointer">
                <input
                  type="radio"
                  name="color"
                  checked={color.toLowerCase() === option}
                  onChange={() => setColor(option)}
                  className="peer sr-only"
                />
                <span
                  className="block size-7 rounded-full ring-offset-2 ring-offset-surface peer-checked:ring-2 peer-checked:ring-ink peer-focus-visible:ring-2 peer-focus-visible:ring-gentiane"
                  style={{ backgroundColor: option }}
                />
              </label>
            ))}
          </div>
        </fieldset>
        {update.error instanceof ApiError && <FormError message={update.error.message} />}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            Enregistrer
          </Button>
          {saved && (
            <p role="status" className="text-sm text-lichen">
              Projet enregistré.
            </p>
          )}
        </div>
      </form>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
        <p className="max-w-md text-[13px] text-ink-2">
          {archived
            ? 'Ce projet est archivé : il ne figure plus dans le menu ni dans « Mon travail ».'
            : "Archiver retire le projet du menu et de « Mon travail ». Rien n'est supprimé, et c'est réversible."}
        </p>
        <Button onClick={() => update.mutate({ archived: !archived })} disabled={update.isPending}>
          {archived ? 'Désarchiver le projet' : 'Archiver le projet'}
        </Button>
      </div>
    </Card>
  );
}

function Columns() {
  const { project } = useProjectContext();
  const base = `/projects/${project.id}/statuses`;
  const update = useProjectMutation(project.id, ({ id, ...changes }: UpdateStatusInput & { id: string }) =>
    api.patch(`${base}/${id}`, changes),
  );
  const remove = useProjectMutation(project.id, (id: string) => api.delete(`${base}/${id}`));
  const create = useProjectMutation(project.id, (input: { name: string; category: StatusCategory }) =>
    api.post(base, input),
  );
  const failure = [update.error, remove.error, create.error].find((error) => error instanceof ApiError);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    create.mutate(Object.fromEntries(new FormData(form)) as { name: string; category: StatusCategory }, {
      onSuccess: () => form.reset(),
    });
  }

  return (
    <Card
      title="Colonnes du tableau"
      hint="La catégorie dit ce que la colonne signifie, quel que soit son nom : elle sert au calcul de l'avancement. La limite signale une colonne « en cours » trop chargée."
    >
      {failure && (
        <div className="mb-3">
          <FormError message={failure.message} />
        </div>
      )}
      <ul className="divide-y divide-line rounded-lg border border-line">
        {project.statuses.map((status, index) => (
          <StatusRow
            key={status.id}
            status={status}
            isFirst={index === 0}
            isLast={index === project.statuses.length - 1}
            onChange={(changes) => update.mutate({ id: status.id, ...changes })}
            onRemove={() => remove.mutate(status.id)}
          />
        ))}
      </ul>

      <form onSubmit={add} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input name="name" required maxLength={40} placeholder="Nouvelle colonne" aria-label="Nom de la nouvelle colonne" />
        <Select name="category" defaultValue="IN_PROGRESS" aria-label="Catégorie" className="sm:w-40">
          {STATUS_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {CATEGORY_LABELS[category]}
            </option>
          ))}
        </Select>
        <Button type="submit" disabled={create.isPending} className="h-10">
          Ajouter la colonne
        </Button>
      </form>
    </Card>
  );
}

interface StatusRowProps {
  status: StatusDto;
  isFirst: boolean;
  isLast: boolean;
  onChange: (changes: UpdateStatusInput) => void;
  onRemove: () => void;
}

function StatusRow({ status, isFirst, isLast, onChange, onRemove }: StatusRowProps) {
  const iconButton = 'rounded-md p-1.5 text-ink-2 hover:bg-ink/5 hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <li className="flex flex-wrap items-center gap-2 px-3 py-2">
      <StatusDot category={status.category} />
      <Input
        key={status.name}
        defaultValue={status.name}
        maxLength={40}
        aria-label="Nom de la colonne"
        onBlur={(event) => {
          const name = event.target.value.trim();
          if (name && name !== status.name) onChange({ name });
          else event.target.value = status.name;
        }}
        className="h-9 min-w-32 flex-1"
      />
      <Select
        value={status.category}
        onChange={(event) => onChange({ category: event.target.value as StatusCategory })}
        aria-label={`Catégorie de ${status.name}`}
        className="h-9 w-32 text-[13px]"
      >
        {STATUS_CATEGORIES.map((category) => (
          <option key={category} value={category}>
            {CATEGORY_LABELS[category]}
          </option>
        ))}
      </Select>
      <Input
        key={`wip-${status.wipLimit}`}
        type="number"
        min={1}
        max={99}
        defaultValue={status.wipLimit ?? ''}
        placeholder="Limite"
        aria-label={`Limite d'en-cours de ${status.name}`}
        onBlur={(event) => {
          const wipLimit = event.target.value === '' ? null : Number(event.target.value);
          if (wipLimit !== status.wipLimit) onChange({ wipLimit });
        }}
        className="h-9 w-20"
      />
      <div className="flex">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => onChange({ position: status.position - 1 })}
          aria-label={`Monter ${status.name}`}
          className={iconButton}
        >
          <ArrowUp size={16} />
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => onChange({ position: status.position + 1 })}
          aria-label={`Descendre ${status.name}`}
          className={iconButton}
        >
          <ArrowDown size={16} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm(`Supprimer la colonne « ${status.name} » ?`)) onRemove();
          }}
          aria-label={`Supprimer ${status.name}`}
          className={`${iconButton} hover:bg-rhodo-soft hover:text-rhodo`}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}

function Labels() {
  const { project, canEdit } = useProjectContext();
  const base = `/projects/${project.id}/labels`;
  const update = useProjectMutation(project.id, ({ id, ...changes }: Partial<LabelDto> & { id: string }) =>
    api.patch(`${base}/${id}`, changes),
  );
  const remove = useProjectMutation(project.id, (id: string) => api.delete(`${base}/${id}`));
  const create = useProjectMutation(project.id, (input: { name: string; color: string }) => api.post(base, input));
  const failure = [update.error, remove.error, create.error].find((error) => error instanceof ApiError);

  function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    create.mutate(Object.fromEntries(new FormData(form)) as { name: string; color: string }, {
      onSuccess: () => form.reset(),
    });
  }

  const colorInput = 'size-9 shrink-0 cursor-pointer rounded-lg border border-line-strong bg-surface p-1';

  return (
    <Card title="Étiquettes" hint="Elles se posent sur les tickets depuis leur fiche et s'affichent sur les cartes.">
      {failure && (
        <div className="mb-3">
          <FormError message={failure.message} />
        </div>
      )}
      {project.labels.length === 0 ? (
        <p className="text-sm text-ink-3">Aucune étiquette pour l'instant.</p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {project.labels.map((label) => (
            <li key={label.id} className="flex items-center gap-2 px-3 py-2">
              <input
                type="color"
                defaultValue={label.color}
                disabled={!canEdit}
                aria-label={`Couleur de ${label.name}`}
                onBlur={(event) => event.target.value !== label.color && update.mutate({ id: label.id, color: event.target.value })}
                className={colorInput}
              />
              <Input
                key={label.name}
                defaultValue={label.name}
                maxLength={30}
                disabled={!canEdit}
                aria-label="Nom de l'étiquette"
                onBlur={(event) => {
                  const name = event.target.value.trim();
                  if (name && name !== label.name) update.mutate({ id: label.id, name });
                  else event.target.value = label.name;
                }}
                className="h-9 flex-1"
              />
              {canEdit && (
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    if (window.confirm(`Supprimer l'étiquette « ${label.name} » ? Elle sera retirée de tous les tickets.`)) {
                      remove.mutate(label.id);
                    }
                  }}
                >
                  Supprimer
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={add} className="mt-3 flex gap-2">
          <input type="color" name="color" defaultValue="#3d4db7" aria-label="Couleur" className={colorInput} />
          <Input name="name" required maxLength={30} placeholder="Nouvelle étiquette" aria-label="Nom de la nouvelle étiquette" className="h-9" />
          <Button type="submit" disabled={create.isPending}>
            Ajouter
          </Button>
        </form>
      )}
    </Card>
  );
}
