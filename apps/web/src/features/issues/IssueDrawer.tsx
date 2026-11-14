import {
  type ActivityDto,
  type AttachmentDto,
  hasRole,
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  type IssuePriority,
  type IssueType,
  type ProjectDetailDto,
  type UpdateIssueInput,
} from '@cordee/shared';
import clsx from 'clsx';
import { Download, Paperclip, Trash2, X } from 'lucide-react';
import {
  type FormEvent,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { api, ApiError } from '@/lib/api';
import { formatSize, fromDateInput, timeAgo, toDateInput } from '@/lib/format';
import { useCurrentUser } from '@/stores/session';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { FormError, Input, Select, Textarea } from '@/ui/Field';
import { highlightMentions } from './mentions';
import { MentionTextarea } from './MentionTextarea';
import { PRIORITY_LABELS, TYPE_LABELS, TypeIcon } from './meta';
import {
  useActivity,
  useAddComment,
  useAttachmentActions,
  useCommentActions,
  useComments,
  useDeleteIssue,
  useIssue,
  useIssues,
  useUpdateIssue,
} from './queries';

// Le rendu Markdown pèse lourd : il n'est chargé qu'à l'ouverture d'un ticket.
const Markdown = lazy(() => import('@/ui/Markdown'));

interface Props {
  issueId: string;
  project: ProjectDetailDto;
  canEdit: boolean;
  onClose: () => void;
}

export function IssueDrawer({ issueId, project, canEdit, onClose }: Props) {
  const { data: issue, error } = useIssue(issueId);
  const update = useUpdateIssue(project.id);
  const remove = useDeleteIssue(project.id);
  const [tab, setTab] = useState<'comments' | 'activity'>('comments');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('dialog[open]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const save = (changes: UpdateIssueInput) => update.mutate({ issueId, changes });

  return (
    <>
      <button
        type="button"
        aria-label="Fermer le ticket"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-ardoise/30"
      />
      <aside
        role="dialog"
        aria-label={issue ? `${issue.key} ${issue.title}` : 'Ticket'}
        className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-surface shadow-panel sm:max-w-[34rem]"
        style={{ animation: 'panel-in 160ms ease-out' }}
      >
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line px-4">
          {issue && <TypeIcon type={issue.type} />}
          <span className="tabular text-sm font-medium text-ink-2">{issue?.key}</span>
          <div className="ml-auto flex items-center gap-1">
            {canEdit && issue && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  if (window.confirm(`Supprimer ${issue.key} ? Cette action est définitive.`)) {
                    remove.mutate(issueId, { onSuccess: onClose });
                  }
                }}
              >
                <Trash2 size={14} /> Supprimer
              </Button>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="rounded-md p-1.5 text-ink-3 hover:bg-ink/5 hover:text-ink"
            >
              <X size={18} />
            </button>
          </div>
        </header>

        {error && <p className="p-6 text-ink-2">Ce ticket n'existe plus.</p>}

        {issue && (
          <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6">
            <EditableText
              value={issue.title}
              disabled={!canEdit}
              onSave={(title) => title && save({ title })}
              label="Titre"
              className="text-xl leading-snug font-bold tracking-tight"
            />
            <Description
              value={issue.description ?? ''}
              canEdit={canEdit}
              onSave={(description) => save({ description })}
            />

            <dl className="mt-6 grid grid-cols-[7.5rem_1fr] items-center gap-x-3 gap-y-2.5 border-y border-line py-5 text-sm">
              <Property label="Statut">
                <Select
                  value={issue.statusId}
                  disabled={!canEdit}
                  onChange={(event) => save({ statusId: event.target.value })}
                  className="h-9"
                >
                  {project.statuses.map((status) => (
                    <option key={status.id} value={status.id}>
                      {status.name}
                    </option>
                  ))}
                </Select>
              </Property>
              <Property label="Assigné à">
                <Select
                  value={issue.assignee?.id ?? ''}
                  disabled={!canEdit}
                  onChange={(event) => save({ assigneeId: event.target.value || null })}
                  className="h-9"
                >
                  <option value="">Personne</option>
                  {project.members.map(({ user }) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </Select>
              </Property>
              <Property label="Priorité">
                <Select
                  value={issue.priority}
                  disabled={!canEdit}
                  onChange={(event) => save({ priority: event.target.value as IssuePriority })}
                  className="h-9"
                >
                  {ISSUE_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </Select>
              </Property>
              <Property label="Type">
                <Select
                  value={issue.type}
                  disabled={!canEdit}
                  onChange={(event) => save({ type: event.target.value as IssueType })}
                  className="h-9"
                >
                  {ISSUE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </Select>
              </Property>
              <Property label="Étiquettes">
                <LabelPicker
                  project={project}
                  selected={issue.labelIds}
                  disabled={!canEdit}
                  onChange={(labelIds) => save({ labelIds })}
                />
              </Property>
              <Property label="Ticket parent">
                <ParentSelect
                  project={project}
                  issueId={issueId}
                  value={issue.parentId}
                  disabled={!canEdit}
                  onChange={(parentId) => save({ parentId })}
                />
              </Property>
              <Property label="Sprint">
                <Select
                  value={issue.sprintId ?? ''}
                  disabled={!canEdit}
                  onChange={(event) => save({ sprintId: event.target.value || null })}
                  className="h-9"
                >
                  <option value="">Backlog (hors sprint)</option>
                  {project.sprints
                    .filter((sprint) => sprint.state !== 'COMPLETED' || sprint.id === issue.sprintId)
                    .map((sprint) => (
                      <option key={sprint.id} value={sprint.id}>
                        {sprint.name}
                      </option>
                    ))}
                </Select>
              </Property>
              <Property label="Estimation">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={issue.estimate ?? ''}
                  disabled={!canEdit}
                  placeholder="Points"
                  onBlur={(event) => {
                    const estimate = event.target.value === '' ? null : Number(event.target.value);
                    if (estimate !== issue.estimate) save({ estimate });
                  }}
                  className="h-9"
                />
              </Property>
              <Property label="Échéance">
                <Input
                  type="date"
                  value={toDateInput(issue.dueDate)}
                  disabled={!canEdit}
                  onChange={(event) => save({ dueDate: fromDateInput(event.target.value) })}
                  className="h-9"
                />
              </Property>
              <Property label="Créé par">
                <span className="flex items-center gap-2 py-1.5">
                  <Avatar name={issue.reporter.name} size="sm" /> {issue.reporter.name}
                  <span className="text-ink-3">{timeAgo(issue.createdAt)}</span>
                </span>
              </Property>
            </dl>

            {issue.children.length > 0 && (
              <section className="mt-5">
                <h3 className="text-sm font-semibold">Sous-tickets</h3>
                <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
                  {issue.children.map((child) => (
                    <li key={child.id} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                      <TypeIcon type={child.type} size={14} />
                      <span className="tabular text-ink-3">{child.key}</span>
                      <span className="min-w-0 flex-1 truncate">{child.title}</span>
                      <span className="shrink-0 text-[13px] text-ink-2">
                        {project.statuses.find((status) => status.id === child.statusId)?.name}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <Attachments issueId={issueId} attachments={issue.attachments} project={project} canEdit={canEdit} />

            <div className="mt-6 flex gap-5 border-b border-line" role="tablist">
              {(['comments', 'activity'] as const).map((name) => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={tab === name}
                  onClick={() => setTab(name)}
                  className={clsx(
                    '-mb-px border-b-2 pb-2 text-sm font-medium',
                    tab === name ? 'border-gentiane text-ink' : 'border-transparent text-ink-2 hover:text-ink',
                  )}
                >
                  {name === 'comments' ? `Commentaires (${issue.commentCount})` : 'Historique'}
                </button>
              ))}
            </div>
            {tab === 'comments' ? (
              <Comments issueId={issueId} project={project} canEdit={canEdit} />
            ) : (
              <History issueId={issueId} project={project} />
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function Property({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-2">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

interface EditableProps {
  value: string;
  label: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  multiline?: boolean;
  placeholder?: string;
  className?: string;
}

// Champ qui ressemble à du texte tant qu'on n'y touche pas ; enregistre en quittant le champ.
function EditableText({ value, label, onSave, disabled, multiline, placeholder, className }: EditableProps) {
  const [draft, setDraft] = useState(value);
  const [saved, setSaved] = useState(value);
  const field = useRef<HTMLTextAreaElement>(null);
  // La valeur a changé côté serveur (un collègue, ou notre propre enregistrement) : on repart d'elle.
  if (value !== saved) {
    setSaved(value);
    setDraft(value);
  }

  useLayoutEffect(() => {
    const textarea = field.current!;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight + 2}px`;
  }, [draft]);

  return (
    <textarea
      ref={field}
      value={draft}
      rows={multiline ? 2 : 1}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={label}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (!multiline && event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
      onBlur={() => {
        const next = draft.trim();
        if (next !== value) onSave(next);
      }}
      className={clsx(
        '-mx-2 block w-[calc(100%+1rem)] resize-none overflow-hidden rounded-lg border border-transparent bg-transparent px-2 py-1 placeholder:text-ink-3 hover:border-line focus:border-gentiane focus:outline-none disabled:hover:border-transparent',
        className,
      )}
    />
  );
}

function Description({ value, canEdit, onSave }: { value: string; canEdit: boolean; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);

  if (draft !== null) {
    return (
      <div className="mt-3">
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={Math.min(16, Math.max(5, draft.split('\n').length + 1))}
          aria-label="Description"
          placeholder="Markdown accepté : **gras**, listes, `code`, cases à cocher…"
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" onClick={() => setDraft(null)}>
            Annuler
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              if (draft.trim() !== value) onSave(draft.trim());
              setDraft(null);
            }}
          >
            Enregistrer la description
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group mt-3">
      {value ? (
        <Suspense fallback={<p className="whitespace-pre-wrap text-[15px]">{value}</p>}>
          <Markdown>{value}</Markdown>
        </Suspense>
      ) : (
        <p className="text-[15px] text-ink-3">Pas de description.</p>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => setDraft(value)}
          className="mt-1.5 text-[13px] font-medium text-gentiane hover:underline"
        >
          {value ? 'Modifier la description' : 'Ajouter une description'}
        </button>
      )}
    </div>
  );
}

interface LabelPickerProps {
  project: ProjectDetailDto;
  selected: string[];
  disabled: boolean;
  onChange: (labelIds: string[]) => void;
}

function LabelPicker({ project, selected, disabled, onChange }: LabelPickerProps) {
  const chosen = project.labels.filter((label) => selected.includes(label.id));
  const chips = chosen.map((label) => (
    <span
      key={label.id}
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: `${label.color}26`, color: label.color }}
    >
      {label.name}
    </span>
  ));

  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (details.current && !details.current.contains(event.target as Node)) details.current.open = false;
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  if (project.labels.length === 0) {
    return <span className="block py-1.5 text-ink-3">Aucune étiquette dans ce projet</span>;
  }
  if (disabled) return <div className="flex flex-wrap gap-1 py-1.5">{chips.length ? chips : 'Aucune'}</div>;

  return (
    <details ref={details} className="relative">
      <summary className="flex min-h-9 cursor-pointer list-none flex-wrap items-center gap-1 rounded-lg border border-line-strong px-2 py-1 hover:border-ink-3">
        {chips.length ? chips : <span className="px-1 text-ink-3">Aucune</span>}
      </summary>
      <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-lift">
        {project.labels.map((label) => (
          <li key={label.id}>
            <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-neve">
              <input
                type="checkbox"
                checked={selected.includes(label.id)}
                onChange={(event) =>
                  onChange(
                    event.target.checked ? [...selected, label.id] : selected.filter((id) => id !== label.id),
                  )
                }
                className="accent-gentiane"
              />
              <span className="size-2.5 rounded-full" style={{ backgroundColor: label.color }} />
              {label.name}
            </label>
          </li>
        ))}
      </ul>
    </details>
  );
}

interface ParentSelectProps {
  project: ProjectDetailDto;
  issueId: string;
  value: string | null;
  disabled: boolean;
  onChange: (parentId: string | null) => void;
}

function ParentSelect({ project, issueId, value, disabled, onChange }: ParentSelectProps) {
  const { data: issues = [] } = useIssues(project.id);
  // Ni lui-même, ni ses propres sous-tickets : pas de boucle.
  const candidates = issues
    .filter((candidate) => candidate.id !== issueId && candidate.parentId !== issueId)
    .sort((a, b) => a.number - b.number);

  return (
    <Select
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value || null)}
      className="h-9"
    >
      <option value="">Aucun</option>
      {candidates.map((candidate) => (
        <option key={candidate.id} value={candidate.id}>
          {candidate.key} {candidate.title}
        </option>
      ))}
    </Select>
  );
}

interface AttachmentsProps {
  issueId: string;
  attachments: AttachmentDto[];
  project: ProjectDetailDto;
  canEdit: boolean;
}

function Attachments({ issueId, attachments, project, canEdit }: AttachmentsProps) {
  const me = useCurrentUser();
  const { upload, remove } = useAttachmentActions(issueId);
  const input = useRef<HTMLInputElement>(null);
  const [downloadError, setDownloadError] = useState<string>();
  const isAdmin = hasRole(project.role, 'ADMIN');
  const error = upload.error instanceof ApiError ? upload.error.message : downloadError;

  if (attachments.length === 0 && !canEdit) return null;

  return (
    <section className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Pièces jointes</h3>
        {canEdit && (
          <>
            <input
              ref={input}
              type="file"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) upload.mutate(file);
                event.target.value = '';
              }}
            />
            <Button size="sm" disabled={upload.isPending} onClick={() => input.current?.click()}>
              <Paperclip size={14} /> {upload.isPending ? 'Envoi…' : 'Joindre un fichier'}
            </Button>
          </>
        )}
      </div>
      {error && (
        <div className="mt-2">
          <FormError message={error} />
        </div>
      )}
      {attachments.length > 0 && (
        <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
          {attachments.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{attachment.filename}</span>
                <span className="block text-xs text-ink-3">
                  {formatSize(attachment.size)}, ajouté par {attachment.uploader.name} {timeAgo(attachment.createdAt)}
                </span>
              </span>
              <button
                type="button"
                aria-label={`Télécharger ${attachment.filename}`}
                title="Télécharger"
                onClick={() => {
                  setDownloadError(undefined);
                  api
                    .download(`/attachments/${attachment.id}`, attachment.filename)
                    .catch((caught: Error) => setDownloadError(caught.message));
                }}
                className="rounded-md p-1.5 text-ink-2 hover:bg-ink/5 hover:text-ink"
              >
                <Download size={16} />
              </button>
              {canEdit && (attachment.uploader.id === me.id || isAdmin) && (
                <button
                  type="button"
                  aria-label={`Supprimer ${attachment.filename}`}
                  title="Supprimer"
                  onClick={() => {
                    if (window.confirm(`Supprimer ${attachment.filename} ?`)) remove.mutate(attachment.id);
                  }}
                  className="rounded-md p-1.5 text-ink-2 hover:bg-rhodo-soft hover:text-rhodo"
                >
                  <Trash2 size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Comments({ issueId, project, canEdit }: { issueId: string; project: ProjectDetailDto; canEdit: boolean }) {
  const me = useCurrentUser();
  const { data: comments = [] } = useComments(issueId);
  const add = useAddComment(issueId, project.id);
  const { update, remove } = useCommentActions(issueId, project.id);
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const isAdmin = hasRole(project.role, 'ADMIN');

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!body.trim()) return;
    add.mutate(body, { onSuccess: () => setBody('') });
  }

  function saveEdit() {
    if (!editing?.body.trim()) return;
    update.mutate({ commentId: editing.id, body: editing.body }, { onSuccess: () => setEditing(null) });
  }

  return (
    <div className="pt-4">
      <ul className="space-y-4">
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-3">
            <Avatar name={comment.author.name} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-medium">{comment.author.name}</span>{' '}
                <span className="text-ink-3">
                  {timeAgo(comment.createdAt)}
                  {comment.editedAt && ' (modifié)'}
                </span>
              </p>
              {editing?.id === comment.id ? (
                <div className="mt-1">
                  <MentionTextarea
                    value={editing.body}
                    onChange={(value) => setEditing({ id: comment.id, body: value })}
                    onSubmit={saveEdit}
                    members={project.members}
                    label="Modifier le commentaire"
                    autoFocus
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <Button size="sm" onClick={() => setEditing(null)}>
                      Annuler
                    </Button>
                    <Button size="sm" variant="primary" disabled={update.isPending} onClick={saveEdit}>
                      Enregistrer
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mt-0.5">
                    <Suspense fallback={<p className="whitespace-pre-wrap text-[15px]">{comment.body}</p>}>
                      <Markdown>{highlightMentions(comment.body, project.members)}</Markdown>
                    </Suspense>
                  </div>
                  {canEdit && (comment.author.id === me.id || isAdmin) && (
                    <p className="mt-1 flex gap-3 text-[13px] font-medium text-ink-3">
                      {comment.author.id === me.id && (
                        <button
                          type="button"
                          onClick={() => setEditing({ id: comment.id, body: comment.body })}
                          className="hover:text-ink hover:underline"
                        >
                          Modifier
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Supprimer ce commentaire ?')) remove.mutate(comment.id);
                        }}
                        className="hover:text-rhodo hover:underline"
                      >
                        Supprimer
                      </button>
                    </p>
                  )}
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      {comments.length === 0 && <p className="text-sm text-ink-3">Aucun commentaire sur ce ticket.</p>}

      {canEdit && (
        <form onSubmit={submit} className="mt-5">
          <MentionTextarea
            value={body}
            onChange={setBody}
            onSubmit={submit}
            members={project.members}
            placeholder="Écrire un commentaire. @ pour mentionner quelqu'un."
            label="Nouveau commentaire"
          />
          <div className="mt-2 flex items-center justify-end gap-3">
            <span className="hidden text-xs text-ink-3 sm:inline">Ctrl + Entrée pour envoyer</span>
            <Button type="submit" variant="primary" size="sm" disabled={add.isPending || !body.trim()}>
              Commenter
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function describe(entry: ActivityDto, project: ProjectDetailDto): string {
  const status = (id: string | null) => project.statuses.find((s) => s.id === id)?.name ?? 'un statut supprimé';
  const member = (id: string | null) => project.members.find((m) => m.user.id === id)?.user.name ?? 'un ancien membre';
  const sprint = (id: string | null) => project.sprints.find((s) => s.id === id)?.name ?? 'un sprint supprimé';

  switch (entry.type) {
    case 'CREATED':
      return 'a créé le ticket';
    case 'STATUS_CHANGED':
      return `a déplacé le ticket de « ${status(entry.from)} » vers « ${status(entry.to)} »`;
    case 'ASSIGNED':
      return entry.to ? `a confié le ticket à ${member(entry.to)}` : "a retiré l'assignation";
    case 'PRIORITY_CHANGED':
      return `a passé la priorité à « ${PRIORITY_LABELS[entry.to as IssuePriority].toLowerCase()} »`;
    case 'SPRINT_CHANGED':
      return entry.to ? `a placé le ticket dans ${sprint(entry.to)}` : 'a renvoyé le ticket au backlog';
    case 'RENAMED':
      return `a renommé le ticket (avant : « ${entry.from} »)`;
  }
}

function History({ issueId, project }: { issueId: string; project: ProjectDetailDto }) {
  const { data: entries = [] } = useActivity(issueId);
  return (
    <ol className="space-y-3 pt-4">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-2.5 text-sm">
          <Avatar name={entry.actor.name} size="sm" />
          <p className="min-w-0">
            <span className="font-medium">{entry.actor.name}</span> {describe(entry, project)}{' '}
            <span className="text-ink-3">{timeAgo(entry.createdAt)}</span>
          </p>
        </li>
      ))}
    </ol>
  );
}
