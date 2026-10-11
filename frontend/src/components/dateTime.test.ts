import { describe, expect, it } from 'vitest';
import {
  formatDisplay,
  monthGrid,
  parseDisplay,
  parseValue,
} from './dateTime.ts';

describe('dateTime', () => {
  it('formats a value the way it is typed in France', () => {
    expect(formatDisplay('2026-11-20T20:05')).toBe('20/11/2026 20:05');
    expect(formatDisplay('')).toBe('');
  });

  it.each([
    ['20/11/2026 20:05', '2026-11-20T20:05'],
    ['1/2/2026 9:30', '2026-02-01T09:30'],
    ['2026-12-01T19:00', '2026-12-01T19:00'],
  ])('reads %s', (text, value) => {
    expect(parseDisplay(text)).toBe(value);
  });

  it.each(['', '20/11/2026', '31/02/2026 10:00', '20/11/2026 25:00', 'demain'])(
    'refuses %j',
    (text) => {
      expect(parseDisplay(text)).toBeNull();
    },
  );

  it('rejects an impossible stored value', () => {
    expect(parseValue('2026-02-30T10:00')).toBeNull();
  });

  it('lays a month out in six weeks starting on a Monday', () => {
    const grid = monthGrid(2026, 10); // 1 October 2026 is a Thursday

    expect(grid).toHaveLength(42);
    expect(grid[0].key).toBe('2026-09-28');
    expect(grid[3]).toMatchObject({ key: '2026-10-01', inMonth: true });
    expect(grid[0].inMonth).toBe(false);
  });
});
