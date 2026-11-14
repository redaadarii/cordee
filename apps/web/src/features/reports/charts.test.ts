import { describe, expect, it } from 'vitest';
import { ticks } from './charts';

describe('ticks', () => {
  it('produit des graduations rondes qui couvrent le maximum', () => {
    expect(ticks(8)).toEqual([0, 2, 4, 6, 8]);
    expect(ticks(18)).toEqual([0, 5, 10, 15, 20]);
    expect(ticks(3)).toEqual([0, 1, 2, 3]);
  });

  it('ne fabrique jamais un axe vide', () => {
    expect(ticks(0)).toEqual([0, 1]);
  });
});
