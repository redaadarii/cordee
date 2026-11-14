import type { AuthDto } from '@cordee/shared';

const BASE = '/api/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly fields: Record<string, string>;

  constructor(status: number, message: string, fields: Record<string, string> = {}) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

let accessToken: string | null = null;
let onSessionLost: () => void = () => {};
let refreshInFlight: Promise<AuthDto | null> | null = null;

export const getAccessToken = () => accessToken;
export const setAccessToken = (token: string | null) => (accessToken = token);
export const setSessionLostHandler = (handler: () => void) => (onSessionLost = handler);

// Plusieurs requêtes peuvent expirer en même temps : une seule rotation du jeton,
// sinon la seconde rejouerait un jeton déjà tourné et fermerait la session.
export function refreshSession(): Promise<AuthDto | null> {
  refreshInFlight ??= fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' })
    .then(async (res) => {
      if (!res.ok) return null;
      const session = (await res.json()) as AuthDto;
      accessToken = session.accessToken;
      return session;
    })
    .catch(() => null)
    .finally(() => (refreshInFlight = null));
  return refreshInFlight;
}

async function send(method: string, path: string, body?: unknown) {
  const isForm = body instanceof FormData;
  return fetch(BASE + path, {
    method,
    credentials: 'include',
    headers: {
      ...(body !== undefined && !isForm && { 'content-type': 'application/json' }),
      ...(accessToken && { authorization: `Bearer ${accessToken}` }),
    },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
}

async function sendWithSession(method: string, path: string, body?: unknown) {
  let res = await send(method, path, body);

  if (res.status === 401 && !path.startsWith('/auth/')) {
    if (await refreshSession()) {
      res = await send(method, path, body);
    } else {
      accessToken = null;
      onSessionLost();
    }
  }

  return res;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await sendWithSession(method, path, body);
  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    const fields = Object.fromEntries(
      ((payload?.errors ?? []) as { path: string; message: string }[]).map((e) => [e.path, e.message]),
    );
    const message =
      res.status === 413
        ? 'Ce fichier dépasse la taille autorisée.'
        : (payload?.message ?? 'Le serveur ne répond pas. Réessayez.');
    throw new ApiError(res.status, message, fields);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: (path: string) => request<void>('DELETE', path),
  upload: <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return request<T>('POST', path, form);
  },
  // Les téléchargements passent par fetch pour porter le jeton d'accès,
  // qu'un simple lien <a href> n'enverrait pas.
  download: async (path: string, filename: string) => {
    const res = await sendWithSession('GET', path);
    if (!res.ok) throw new ApiError(res.status, 'Téléchargement impossible.');
    const url = URL.createObjectURL(await res.blob());
    const link = Object.assign(document.createElement('a'), { href: url, download: filename });
    link.click();
    URL.revokeObjectURL(url);
  },
};
