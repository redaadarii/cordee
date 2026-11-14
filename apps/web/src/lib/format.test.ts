import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { daysUntil, formatSize, fromDateInput, isOverdue, plural, toDateInput } from './format';

describe('format', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 15, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('compte les jours calendaires, pas les tranches de 24 h', () => {
    expect(daysUntil(new Date(2026, 10, 15, 1, 0).toISOString())).toBe(1);
    expect(daysUntil(new Date(2026, 10, 14, 23, 0).toISOString())).toBe(0);
    expect(daysUntil(new Date(2026, 10, 12).toISOString())).toBe(-2);
  });

  it("n'affiche pas en retard un ticket dû aujourd'hui", () => {
    expect(isOverdue(new Date(2026, 10, 14, 8, 0).toISOString())).toBe(false);
    expect(isOverdue(new Date(2026, 10, 13).toISOString())).toBe(true);
    expect(isOverdue(null)).toBe(false);
  });

  it('accorde le pluriel', () => {
    expect(plural(1, 'ticket')).toBe('1 ticket');
    expect(plural(0, 'ticket')).toBe('0 ticket');
    expect(plural(3, 'jour restant', 'jours restants')).toBe('3 jours restants');
  });

  it('garde le même jour à l’aller-retour avec un champ date', () => {
    const iso = fromDateInput('2026-12-01')!;
    expect(toDateInput(iso)).toBe('2026-12-01');
    expect(fromDateInput('')).toBeNull();
  });

  it('formate les tailles de fichier', () => {
    expect(formatSize(512)).toBe('512 o');
    expect(formatSize(20_480)).toBe('20 Ko');
    expect(formatSize(3.5 * 1024 * 1024)).toBe('3,5 Mo');
  });
});
