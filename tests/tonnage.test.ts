import { describe, expect, test } from 'vitest';
import { tonnage } from '../src/logic/tonnage';
import { formatKg, formatDuration, plural } from '../src/lib/format';

describe('тоннаж', () => {
  test('24×10 + 24×9 + 24×8 + 24×8 = 840', () => {
    const sets = [10, 9, 8, 8].map((value) => ({ weight: 24, value, done: true }));
    expect(tonnage(sets)).toBe(840);
  });

  test('невыполненные подходы не считаются', () => {
    expect(tonnage([
      { weight: 24, value: 10, done: true },
      { weight: 24, value: 10, done: false },
    ])).toBe(240);
  });


  test('пустой список — 0', () => {
    expect(tonnage([])).toBe(0);
  });
});

describe('форматирование', () => {
  test.each([
    [26, '26'],
    [1.25, '1,25'],
    [62.5, '62,5'],
    [12500, '12 500'],
    [0, '0'],
  ])('%d кг → «%s»', (n, s) => {
    expect(formatKg(n)).toBe(s);
  });

  test('длительность', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(3_725_000)).toBe('1:02:05');
  });
});

describe('склонение', () => {
  test.each([
    [1, '1 подход'], [2, '2 подхода'], [5, '5 подходов'], [11, '11 подходов'],
    [21, '21 подход'], [24, '24 подхода'], [25, '25 подходов'], [112, '112 подходов'],
  ])('%i', (n, s) => {
    expect(plural(n, ['подход', 'подхода', 'подходов'])).toBe(s);
  });
});
