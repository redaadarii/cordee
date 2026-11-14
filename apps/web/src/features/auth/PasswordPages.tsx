import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/ui/Button';
import { Field, FormError, Input } from '@/ui/Field';
import { AuthLayout } from './AuthLayout';

const backToLogin = (
  <p className="mt-6 text-sm">
    <Link to="/login" className="font-medium text-gentiane hover:underline">
      Retour à la connexion
    </Link>
  </p>
);

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = new FormData(event.currentTarget).get('email') as string;
    setPending(true);
    setError(undefined);
    try {
      await api.post('/auth/forgot-password', { email });
      setSentTo(email);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Connexion au serveur impossible.');
    } finally {
      setPending(false);
    }
  }

  if (sentTo) {
    return (
      <AuthLayout
        title="Consultez votre boîte"
        intro={`Si un compte existe pour ${sentTo}, un lien valable une heure vient de lui être envoyé.`}
      >
        {backToLogin}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Mot de passe oublié" intro="Indiquez votre adresse, nous vous envoyons un lien pour en choisir un nouveau.">
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Adresse e-mail">
          <Input name="email" type="email" autoComplete="email" required autoFocus />
        </Field>
        <FormError message={error} />
        <Button type="submit" variant="primary" disabled={pending} className="h-10 w-full">
          Envoyer le lien
        </Button>
      </form>
      {backToLogin}
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<ApiError | null>(null);
  const [pending, setPending] = useState(false);
  const token = params.get('token');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get('password') as string;
    setPending(true);
    setError(null);
    try {
      await api.post('/auth/reset-password', { token, password });
      void navigate('/login?reset=1', { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught : new ApiError(0, 'Connexion au serveur impossible.'));
    } finally {
      setPending(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Lien incomplet" intro="Ce lien ne contient pas de jeton. Demandez-en un nouveau.">
        <p className="mt-6 text-sm">
          <Link to="/forgot-password" className="font-medium text-gentiane hover:underline">
            Demander un nouveau lien
          </Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Nouveau mot de passe" intro="Choisissez-en un d'au moins 10 caractères. Vos autres sessions seront fermées.">
      <form onSubmit={submit} className="mt-8 space-y-4">
        <Field label="Nouveau mot de passe" error={error?.fields.password}>
          <Input name="password" type="password" autoComplete="new-password" required autoFocus />
        </Field>
        {error && !error.fields.password && <FormError message={error.message} />}
        <Button type="submit" variant="primary" disabled={pending} className="h-10 w-full">
          Enregistrer le mot de passe
        </Button>
      </form>
      {backToLogin}
    </AuthLayout>
  );
}
