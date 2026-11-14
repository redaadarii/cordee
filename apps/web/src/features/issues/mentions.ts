import type { MemberDto } from '@cordee/shared';

// Le « @ » en cours de saisie, juste avant le curseur.
export const PENDING_MENTION = /(^|\s)@([\p{L}\p{N} .'-]{0,40})$/u;

/** Texte tapé après un « @ » encore ouvert, ou `null` s'il n'y en a pas. */
export function pendingMention(text: string, caret: number): string | null {
  return PENDING_MENTION.exec(text.slice(0, caret))?.[2] ?? null;
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Met les mentions en gras pour le rendu Markdown, en une seule passe : les noms
 * les plus longs sont essayés d'abord, pour que « @Anne Martin » ne soit pas pris
 * pour « @Anne », et un nom déjà mis en gras n'est pas retraité.
 */
export function highlightMentions(body: string, members: MemberDto[]): string {
  if (members.length === 0) return body;
  const names = members.map((member) => member.user.name).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`@(${names.map(escape).join('|')})`, 'gu');
  return body.replace(pattern, (mention) => `**${mention}**`);
}
