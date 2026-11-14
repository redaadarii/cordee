import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('accepte le bon mot de passe et rejette les autres', async () => {
    const hash = await hashPassword('une phrase de passe');
    expect(await verifyPassword('une phrase de passe', hash)).toBe(true);
    expect(await verifyPassword('une phrase de passe ', hash)).toBe(false);
  });

  it('sale chaque empreinte', async () => {
    expect(await hashPassword('identique')).not.toBe(await hashPassword('identique'));
  });

  it('rejette une empreinte mal formée', async () => {
    expect(await verifyPassword('x', 'bcrypt$abc')).toBe(false);
  });
});
