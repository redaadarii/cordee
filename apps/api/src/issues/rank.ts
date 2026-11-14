import { generateKeyBetween } from 'fractional-indexing';

/**
 * Rang d'une carte entre deux voisines. `null` signifie « pas de voisine de ce côté ».
 * Les clés sont des chaînes qui se trient par ordre d'octets (colonne en collation "C").
 */
export function rankBetween(previous: string | null, next: string | null): string {
  return generateKeyBetween(previous, next);
}
