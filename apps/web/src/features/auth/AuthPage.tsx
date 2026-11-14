import type { AuthDto } from '@cordee/shared';
import { type FormEvent, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/stores/session';
import { Button } from '@/ui/Button';
import { Field, FormError, Input } from '@/ui/Field';
import { AuthLayout } from './AuthLayout';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { status, open } = useSession();
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);
  const [params] = useSearchParams();

  if (status === 'signed-in') return <Navigate to="/" replace />;
  const registering = mode === 'register';

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.currentTarget));
    setPending(true);
    setError(null);
    try {
      open(await api.post<AuthDto>(registering ? '/auth/register' : '/auth/login', form));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'Connexion au serveur impossible.'));
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthLayout
      title={registering ? 'Créez votre espace' : 'Reprenez la voie'}
      intro={
        registering
          ? 'Un espace de travail est créé avec votre compte. Vous inviterez votre équipe ensuite.'
          : 'Connectez-vous pour retrouver vos projets.'
      }
    >
      {!registering && params.has('reset') && (
        <p role="status" className="mt-6 rounded-lg bg-lichen-soft px-3 py-2 text-sm text-lichen">
          Mot de passe modifié. Connectez-vous avec le nouveau.
        </p>
      )}
      <form key={mode} onSubmit={submit} className="mt-8 space-y-4" noValidate>
        {registering && (
          <Field label="Nom complet" error={error?.fields.name}>
            <Input name="name" autoComplete="name" required autoFocus />
          </Field>
        )}
        <Field label="Adresse e-mail" error={error?.fields.email}>
          <Input name="email" type="email" autoComplete="email" required autoFocus={!registering} />
        </Field>
        <Field label="Mot de passe" error={error?.fields.password}>
          <Input
            name="password"
            type="password"
            autoComplete={registering ? 'new-password' : 'current-password'}
            required
          />
        </Field>
        {!registering && (
          <p className="-mt-1 text-right text-sm">
            <Link to="/forgot-password" className="font-medium text-gentiane hover:underline">
              Mot de passe oublié ?
            </Link>
          </p>
        )}
        {error && Object.keys(error.fields).length === 0 && <FormError message={error.message} />}
        <Button type="submit" variant="primary" disabled={pending} className="h-10 w-full">
          {registering ? 'Créer mon compte' : 'Se connecter'}
        </Button>
      </form>

      <p className="mt-6 text-sm text-ink-2">
        {registering ? 'Déjà un compte ?' : 'Pas encore de compte ?'}{' '}
        <Link to={registering ? '/login' : '/register'} className="font-medium text-gentiane hover:underline">
          {registering ? 'Se connecter' : 'Créer un compte'}
        </Link>
      </p>
    </AuthLayout>
  );
}
