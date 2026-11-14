import {
  ISSUE_PRIORITIES,
  ISSUE_TYPES,
  type IssuePriority,
  type IssueType,
  type ProjectDetailDto,
} from '@cordee/shared';
import { type FormEvent, useState } from 'react';
import { ApiError } from '@/lib/api';
import { Button } from '@/ui/Button';
import { Dialog } from '@/ui/Dialog';
import { Field, FormError, Input, Select, Textarea } from '@/ui/Field';
import { PRIORITY_LABELS, TYPE_LABELS } from './meta';
import { useCreateIssue } from './queries';

export function CreateIssueDialog({ project, onClose }: { project: ProjectDetailDto; onClose: () => void }) {
  const create = useCreateIssue(project.id);
  const [title, setTitle] = useState('');
  const activeSprint = project.sprints.find((sprint) => sprint.state === 'ACTIVE');
  const openSprints = project.sprints.filter((sprint) => sprint.state !== 'COMPLETED');

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget)) as Record<string, string>;
    create.mutate(
      {
        title,
        description: form.description || undefined,
        type: form.type as IssueType,
        priority: form.priority as IssuePriority,
        statusId: form.statusId,
        assigneeId: form.assigneeId || null,
        sprintId: form.sprintId || null,
      },
      { onSuccess: onClose },
    );
  }

  return (
    <Dialog title={`Nouveau ticket dans ${project.name}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Titre">
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Ce qu'il faut faire, en une phrase"
            required
            autoFocus
          />
        </Field>
        <Field label="Description (facultative)">
          <Textarea name="description" rows={3} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select name="type" defaultValue="TASK">
              {ISSUE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priorité">
            <Select name="priority" defaultValue="NONE">
              {ISSUE_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Statut">
            <Select name="statusId" defaultValue={project.statuses[0]?.id}>
              {project.statuses.map((status) => (
                <option key={status.id} value={status.id}>
                  {status.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Assigné à">
            <Select name="assigneeId" defaultValue="">
              <option value="">Personne</option>
              {project.members.map(({ user }) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {openSprints.length > 0 && (
          <Field label="Sprint">
            <Select name="sprintId" defaultValue={activeSprint?.id ?? ''}>
              <option value="">Backlog (hors sprint)</option>
              {openSprints.map((sprint) => (
                <option key={sprint.id} value={sprint.id}>
                  {sprint.name}
                  {sprint.state === 'ACTIVE' ? ' (en cours)' : ''}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {create.error instanceof ApiError && <FormError message={create.error.message} />}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>Annuler</Button>
          <Button type="submit" variant="primary" disabled={create.isPending || !title.trim()}>
            Créer le ticket
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
