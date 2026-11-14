import {
  type AddMemberResult,
  hasRole,
  type InvitationDto,
  type MemberDto,
  type WorkspaceDto,
  type WorkspaceRole,
} from '@cordee/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { useMembers, useWorkspace } from '@/features/projects/queries';
import { api, ApiError } from '@/lib/api';
import { formatDay } from '@/lib/format';
import { useCurrentUser } from '@/stores/session';
import { Avatar } from '@/ui/Avatar';
import { Button } from '@/ui/Button';
import { FormError, Input, Select } from '@/ui/Field';

const ROLE_LABELS: Record<WorkspaceRole, string> = {
  OWNER: 'Propriétaire',
  ADMIN: 'Administrateur',
  MEMBER: 'Membre',
  GUEST: 'Invité (lecture seule)',
};
const ASSIGNABLE: WorkspaceRole[] = ['ADMIN', 'MEMBER', 'GUEST'];

export function MembersPage() {
  const workspace = useWorkspace();
  const me = useCurrentUser();
  const client = useQueryClient();
  const { data: members = [] } = useMembers();
  const [notice, setNotice] = useState<string | null>(null);
  const canManage = !!workspace && hasRole(workspace.role, 'ADMIN');
  const base = `/workspaces/${workspace?.id}`;

  const { data: invitations = [] } = useQuery({
    queryKey: ['invitations', workspace?.id],
    queryFn: () => api.get<InvitationDto[]>(`${base}/invitations`),
    enabled: canManage,
  });

  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['members'] });
    void client.invalidateQueries({ queryKey: ['invitations'] });
    void client.invalidateQueries({ queryKey: ['project'] });
  };

  const invite = useMutation({
    mutationFn: (input: { email: string; role: string }) => api.post<AddMemberResult>(`${base}/members`, input),
    onSuccess: (result) => {
      setNotice(
        result.status === 'added'
          ? `${result.member.user.name} a rejoint l'espace.`
          : `Invitation envoyée à ${result.invitation.email}. Le lien est valable 7 jours.`,
      );
      refresh();
    },
  });
  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch<MemberDto[]>(`${base}/members/${userId}`, { role }),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api.delete(`${base}/members/${userId}`),
    onSuccess: refresh,
  });
  const revoke = useMutation({
    mutationFn: (invitationId: string) => api.delete(`${base}/invitations/${invitationId}`),
    onSuccess: refresh,
  });
  const rename = useMutation({
    mutationFn: (name: string) => api.patch<WorkspaceDto>(base, { name }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['workspaces'] }),
  });

  function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setNotice(null);
    invite.mutate(Object.fromEntries(new FormData(form)) as { email: string; role: string }, {
      onSuccess: () => form.reset(),
    });
  }

  if (!workspace) return null;
  const failure = [invite.error, changeRole.error, remove.error].find((error) => error instanceof ApiError);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight">Membres</h1>
      <p className="mt-1 text-ink-2">Les personnes qui ont accès aux projets de {workspace.name}.</p>

      {canManage && (
        <>
          <form
            key={workspace.id}
            onSubmit={(event) => {
              event.preventDefault();
              rename.mutate(new FormData(event.currentTarget).get('name') as string);
            }}
            className="mt-6 flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-end"
          >
            <label className="flex-1">
              <span className="mb-1.5 block text-[13px] font-medium text-ink-2">Nom de l'espace</span>
              <Input name="name" defaultValue={workspace.name} required minLength={2} maxLength={60} />
            </label>
            <Button type="submit" disabled={rename.isPending} className="h-10">
              Renommer
            </Button>
          </form>

          <form onSubmit={submitInvite} className="mt-4 rounded-xl border border-line bg-surface p-4">
            <p className="text-sm font-medium">Inviter quelqu'un</p>
            <p className="mt-0.5 text-[13px] text-ink-2">
              Avec un compte Cordée, la personne rejoint l'espace tout de suite. Sinon, elle reçoit un lien par e-mail.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Input name="email" type="email" required placeholder="prenom@entreprise.com" aria-label="Adresse e-mail" />
              <Select name="role" defaultValue="MEMBER" aria-label="Rôle" className="sm:w-56">
                {ASSIGNABLE.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="primary" disabled={invite.isPending} className="h-10">
                Inviter
              </Button>
            </div>
            {notice && !invite.error && (
              <p role="status" className="mt-3 text-sm text-lichen">
                {notice}
              </p>
            )}
          </form>
        </>
      )}

      {failure && (
        <div className="mt-4">
          <FormError message={failure.message} />
        </div>
      )}

      <ul className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
        {members.map(({ user, role }) => {
          const isMe = user.id === me.id;
          const editable = canManage && !isMe && role !== 'OWNER';
          return (
            <li key={user.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
              <Avatar name={user.name} size="lg" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {user.name} {isMe && <span className="font-normal text-ink-3">(vous)</span>}
                </span>
                <span className="block truncate text-[13px] text-ink-2">{user.email}</span>
              </span>
              {editable ? (
                <>
                  <Select
                    value={role}
                    onChange={(event) => changeRole.mutate({ userId: user.id, role: event.target.value })}
                    aria-label={`Rôle de ${user.name}`}
                    className="h-9 w-auto text-[13px]"
                  >
                    {ASSIGNABLE.map((option) => (
                      <option key={option} value={option}>
                        {ROLE_LABELS[option]}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (window.confirm(`Retirer ${user.name} de l'espace ? Ses tickets ne seront plus assignés.`)) {
                        remove.mutate(user.id);
                      }
                    }}
                  >
                    Retirer
                  </Button>
                </>
              ) : (
                <span className="text-[13px] text-ink-2">{ROLE_LABELS[role]}</span>
              )}
            </li>
          );
        })}
      </ul>

      {invitations.length > 0 && (
        <>
          <h2 className="mt-8 font-semibold">Invitations en attente</h2>
          <ul className="mt-2 divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{invitation.email}</span>
                  <span className="block text-[13px] text-ink-2">
                    {ROLE_LABELS[invitation.role]}, lien valable jusqu'au {formatDay(invitation.expiresAt)}
                  </span>
                </span>
                <Button variant="danger" size="sm" onClick={() => revoke.mutate(invitation.id)}>
                  Annuler l'invitation
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
