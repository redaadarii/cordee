import type { AuthDto, InvitationPreviewDto, WorkspaceDto } from '@cordee/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ApiError } from '@/lib/api';
import { useSession, useWorkspaceChoice } from '@/stores/session';
import { Button } from '@/ui/Button';
import { Field, FormError, Input } from '@/ui/Field';
import { AuthLayout } from './AuthLayout';

export function InvitePage() {
  const { token } = useParams() as { token: string };
  const navigate = useNavigate();
  const client = useQueryClient();
  const { status, user, open, signOut } = useSession();
  const chooseWorkspace = useWorkspaceChoice((state) => state.choose);
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);

  const { data: invitation, error: loadError } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => api.get<InvitationPreviewDto>(`/invitations/${token}`),
    retry: false,
  });

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError(null);
    try {
      await action();
      void navigate('/', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'Connexion au serveur impossible.'));
    } finally {
      setPending(false);
    }
  }

  const accept = () =>
    run(async () => {
      const workspace = await api.post<WorkspaceDto>(`/invitations/${token}/accept`);
      chooseWorkspace(workspace.id);
      await client.invalidateQueries({ queryKey: ['workspaces'] });
    });

  function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    void run(async () => {
      open(
        await api.post<AuthDto>('/auth/register', {
          ...form,
          email: invitation!.email,
          invitationToken: token,
        }),
      );
    });
  }

  if (loadError) {
    return (
      <AuthLayout
        title="Invitation introuvable"
        intro="Ce lien a expiré, a déjà servi ou a été annulé. Demandez à la personne qui vous a invité d'en renvoyer un."
      >
        <p className="mt-6 text-sm">
          <Link to="/login" className="font-medium text-gentiane hover:underline">
            Aller à la connexion
          </Link>
        </p>
      </AuthLayout>
    );
  }
  if (!invitation || status === 'loading') return null;

  const title = `Rejoindre ${invitation.workspaceName}`;

  if (status === 'signed-in' && user) {
    const rightAccount = user.email === invitation.email;
    return (
      <AuthLayout
        title={title}
        intro={
          rightAccount
            ? `Vous êtes connecté en tant que ${user.name}.`
            : `Cette invitation est destinée à ${invitation.email}, mais vous êtes connecté avec ${user.email}.`
        }
      >
        <div className="mt-8 space-y-4">
          <FormError message={error?.message} />
          {rightAccount ? (
            <Button variant="primary" disabled={pending} onClick={accept} className="h-10 w-full">
              Rejoindre l'espace
            </Button>
          ) : (
            <Button onClick={() => void signOut()} className="h-10 w-full">
              Changer de compte
            </Button>
          )}
        </div>
      </AuthLayout>
    );
  }

  if (invitation.hasAccount) {
    return (
      <AuthLayout title={title} intro={`Un compte existe déjà pour ${invitation.email}. Connectez-vous, puis rouvrez ce lien.`}>
        <Link
          to="/login"
          className="mt-8 flex h-10 items-center justify-center rounded-lg bg-gentiane text-sm font-medium text-on-accent hover:bg-gentiane-deep"
        >
          Se connecter
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={title} intro="Créez votre compte pour accéder aux projets de l'équipe.">
      <form onSubmit={register} className="mt-8 space-y-4" noValidate>
        <Field label="Adresse e-mail">
          <Input value={invitation.email} readOnly className="bg-neve text-ink-2" />
        </Field>
        <Field label="Nom complet" error={error?.fields.name}>
          <Input name="name" autoComplete="name" required autoFocus />
        </Field>
        <Field label="Mot de passe" error={error?.fields.password}>
          <Input name="password" type="password" autoComplete="new-password" required />
        </Field>
        {error && Object.keys(error.fields).length === 0 && <FormError message={error.message} />}
        <Button type="submit" variant="primary" disabled={pending} className="h-10 w-full">
          Créer mon compte et rejoindre
        </Button>
      </form>
    </AuthLayout>
  );
}
