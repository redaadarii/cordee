import { describe, expect, it } from 'vitest';
import { rankBetween } from './rank.js';

const byteOrder = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

describe('rankBetween', () => {
  it('place une carte entre ses deux voisines', () => {
    const first = rankBetween(null, null);
    const last = rankBetween(first, null);
    const middle = rankBetween(first, last);
    expect([last, middle, first].sort(byteOrder)).toEqual([first, middle, last]);
  });

  it('reste ordonné après de nombreuses insertions au même endroit', () => {
    const top = rankBetween(null, null);
    let next = rankBetween(top, null);
    const inserted: string[] = [];
    for (let i = 0; i < 200; i++) {
      next = rankBetween(top, next);
      inserted.push(next);
    }
    expect([...inserted].sort(byteOrder)).toEqual([...inserted].reverse());
    expect(inserted.every((rank) => rank > top)).toBe(true);
  });
});
