import type { AuthDto, UserDto } from '@cordee/shared';
import { type FormEvent, type ReactNode, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useSession } from '@/stores/session';
import { type ThemeChoice, useTheme } from '@/stores/theme';
import { Button } from '@/ui/Button';
import { Field, FormError, Input } from '@/ui/Field';

const THEMES: { value: ThemeChoice; label: string }[] = [
  { value: 'system', label: 'Comme le système' },
  { value: 'light', label: 'Clair' },
  { value: 'dark', label: 'Sombre' },
];

export function AccountPage() {
  const { user, open } = useSession();
  const { choice, choose } = useTheme();
  const [profile, setProfile] = useState<{ saved?: boolean; error?: ApiError }>({});
  const [password, setPassword] = useState<{ saved?: boolean; error?: ApiError }>({});

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = new FormData(event.currentTarget).get('name') as string;
    try {
      const updated = await api.patch<UserDto>('/auth/me', { name });
      useSession.setState({ user: updated });
      setProfile({ saved: true });
    } catch (error) {
      setProfile({ error: error as ApiError });
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    try {
      open(await api.post<AuthDto>('/auth/password', Object.fromEntries(new FormData(form))));
      form.reset();
      setPassword({ saved: true });
    } catch (error) {
      setPassword({ error: error as ApiError });
    }
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-8">
      <h1 className="text-2xl font-bold tracking-tight">Mon compte</h1>

      <Card title="Profil">
        <form onSubmit={saveProfile} className="space-y-4">
          <Field label="Adresse e-mail">
            <Input value={user.email} readOnly className="bg-neve text-ink-2" />
          </Field>
          <Field label="Nom complet" error={profile.error?.fields.name}>
            <Input name="name" defaultValue={user.name} required />
          </Field>
          <Footer saved={profile.saved} savedLabel="Profil enregistré.">
            <Button type="submit" variant="primary">
              Enregistrer le profil
            </Button>
          </Footer>
        </form>
      </Card>

      <Card title="Mot de passe">
        <form onSubmit={changePassword} className="space-y-4">
          <Field label="Mot de passe actuel" error={password.error?.fields.currentPassword}>
            <Input name="currentPassword" type="password" autoComplete="current-password" required />
          </Field>
          <Field label="Nouveau mot de passe" error={password.error?.fields.newPassword}>
            <Input name="newPassword" type="password" autoComplete="new-password" required />
          </Field>
          {password.error && Object.keys(password.error.fields).length === 0 && (
            <FormError message={password.error.message} />
          )}
          <Footer saved={password.saved} savedLabel="Mot de passe changé. Vos autres sessions sont fermées.">
            <Button type="submit" variant="primary">
              Changer le mot de passe
            </Button>
          </Footer>
        </form>
      </Card>

      <Card title="Apparence">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Thème">
          {THEMES.map((theme) => (
            <label key={theme.value} className="cursor-pointer">
              <input
                type="radio"
                name="theme"
                checked={choice === theme.value}
                onChange={() => choose(theme.value)}
                className="peer sr-only"
              />
              <span className="block rounded-lg border border-line-strong px-3.5 py-2 text-sm font-medium peer-checked:border-gentiane peer-checked:bg-gentiane-soft peer-checked:text-gentiane peer-focus-visible:ring-2 peer-focus-visible:ring-gentiane">
                {theme.label}
              </span>
            </label>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Footer({ saved, savedLabel, children }: { saved?: boolean; savedLabel: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {children}
      {saved && (
        <p role="status" className="text-sm text-lichen">
          {savedLabel}
        </p>
      )}
    </div>
  );
}
