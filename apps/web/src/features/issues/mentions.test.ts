import type { MemberDto } from '@cordee/shared';
import { describe, expect, it } from 'vitest';
import { highlightMentions, pendingMention } from './mentions';

const member = (name: string): MemberDto => ({ user: { id: name, name, email: `${name}@test.dev` }, role: 'MEMBER' });

describe('pendingMention', () => {
  it('repère un « @ » ouvert juste avant le curseur', () => {
    expect(pendingMention('Bonjour @Ya', 11)).toBe('Ya');
    expect(pendingMention('@', 1)).toBe('');
  });

  it('ignore une adresse e-mail et un « @ » plus loin que le curseur', () => {
    expect(pendingMention('écrire à salma@cordee.dev', 25)).toBeNull();
    expect(pendingMention('texte @Ya', 5)).toBeNull();
  });
});

describe('highlightMentions', () => {
  it('préfère le nom complet le plus long', () => {
    const members = [member('Anne'), member('Anne Martin')];
    expect(highlightMentions('Merci @Anne Martin et @Anne', members)).toBe('Merci **@Anne Martin** et **@Anne**');
  });

  it('laisse le texte intact sans mention connue', () => {
    expect(highlightMentions('Pas de @Personne ici', [member('Inès Tazi')])).toBe('Pas de @Personne ici');
  });
});
