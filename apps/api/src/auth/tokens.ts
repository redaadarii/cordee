import { createHash, randomBytes } from 'node:crypto';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

/** Jeton aléatoire à remettre à l'utilisateur ; on ne garde que son empreinte en base. */
export function createToken() {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: sha256(token) };
}
