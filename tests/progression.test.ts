import { describe, expect, test } from 'vitest';
import { getSlot } from '../src/program';
import { DEFAULT_STEPS, suggest, type Past } from '../src/logic/progression';

const sets = (weight: number, values: number[], extra: Partial<{ done: boolean; pain: boolean }> = {}): Past => ({
  sets: values.map((value) => ({ weight, value, done: true, pain: false, ...extra })),
});

const base = { steps: DEFAULT_STEPS, deload: false };

describe('подсказка прогрессии', () => {
  test('нет истории — калибровка: вес 0, нижняя граница', () => {
    const slot = getSlot('mon-1');
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'dumbbell', count: 3, past: null });
    expect(s).toEqual({ weight: 0, values: [8, 8, 8], hint: 'Калибровка: подберите рабочий вес', increased: false });
  });

  test('тяжёлый день, верх набран во всех подходах → + шаг гантелей, назад к нижней границе', () => {
    const slot = getSlot('mon-1'); // 4 × 8-10
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'dumbbell', count: 4, past: sets(24, [10, 10, 10, 10]) });
    expect(s.weight).toBe(26);
    expect(s.values).toEqual([8, 8, 8, 8]);
    expect(s.increased).toBe(true);
    expect(s.hint).toBe('Верх набран → +2 кг');
  });

  test('тяжёлый день, верх не набран (пример из Excel) → держим вес', () => {
    const slot = getSlot('mon-1');
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'dumbbell', count: 4, past: sets(24, [10, 9, 8, 8]) });
    expect(s.weight).toBe(24);
    expect(s.values).toEqual([10, 9, 8, 8]);
    expect(s.increased).toBe(false);
    expect(s.hint).toBe('Держим вес, добиваем до 10');
  });

  test('подходов сделано меньше плана — верх не набран', () => {
    const slot = getSlot('fri-1');
    const past = sets(100, [10, 10, 10, 10]);
    past.sets[3].done = false;
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'barbell', count: 4, past });
    expect(s.weight).toBe(100);
    expect(s.increased).toBe(false);
  });

  test('рабочий вес — максимум среди выполненных подходов', () => {
    const slot = getSlot('fri-1');
    const past: Past = {
      sets: [
        { weight: 95, value: 10, done: true, pain: false },
        { weight: 100, value: 9, done: true, pain: false },
        { weight: 120, value: 0, done: false, pain: false },
      ],
    };
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'barbell', count: 4, past });
    expect(s.weight).toBe(100);
    expect(s.values).toEqual([10, 9, 8, 8]); // четвёртого подхода не было — нижняя граница
  });

  test('штанга: шаг 2,5 кг', () => {
    const slot = getSlot('fri-1'); // 4 × 8-10
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'barbell', count: 4, past: sets(60, [10, 10, 10, 10]) });
    expect(s.weight).toBe(62.5);
    expect(s.hint).toBe('Верх набран → +2,5 кг');
  });

  test('фиксированные повторения 4 × 12 — как тяжёлое правило', () => {
    const slot = getSlot('mon-7'); // гиперэкстензия 4 × 12, added
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'added', count: 4, past: sets(10, [12, 12, 12, 12]) });
    expect(s.weight).toBe(11.25);
    expect(s.values).toEqual([12, 12, 12, 12]);
  });

  test('лёгкий день, верх не набран → держим вес, +1 повтор', () => {
    const slot = getSlot('thu-1'); // тяга вертикального блока 4 × 12-15
    const s = suggest({ ...base, slot, kind: 'light', equipment: 'machine', count: 4, past: sets(40, [14, 13, 13, 12]) });
    expect(s.weight).toBe(40);
    expect(s.values).toEqual([14, 13, 13, 12]);
    expect(s.hint).toBe('Держим вес, +1 повтор');
  });

  test('лёгкий день, верх набран → + шаг, назад к нижней границе', () => {
    const slot = getSlot('thu-1');
    const s = suggest({ ...base, slot, kind: 'light', equipment: 'machine', count: 4, past: sets(40, [15, 15, 15, 16]) });
    expect(s.weight).toBe(45);
    expect(s.values).toEqual([12, 12, 12, 12]);
    expect(s.hint).toBe('Верх набран → +5 кг, назад к 12');
  });

  test('прогулка фермера: 40 с во всех подходах → +2 кг, назад к 30 с', () => {
    const slot = getSlot('tue-8');
    const s = suggest({ ...base, slot, kind: 'light', equipment: 'dumbbell', count: 3, past: sets(24, [40, 40, 40]) });
    expect(s.weight).toBe(26);
    expect(s.values).toEqual([30, 30, 30]);
    expect(s.hint).toBe('40 с набраны → +2 кг, назад к 30 с');
  });

  test('боль в прошлый раз → не повышаем, даже если верх набран', () => {
    const slot = getSlot('mon-1');
    const past = sets(24, [10, 10, 10, 10]);
    past.sets[2].pain = true;
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'dumbbell', count: 4, past });
    expect(s.weight).toBe(24);
    expect(s.increased).toBe(false);
    expect(s.hint).toBe('В прошлый раз была боль — держим вес');
  });

  test('разгрузка важнее всего: вес прежний, подходов меньше', () => {
    const slot = getSlot('mon-1');
    const s = suggest({ ...base, deload: true, slot, kind: 'heavy', equipment: 'dumbbell', count: 2, past: sets(24, [10, 10, 10, 10]) });
    expect(s.weight).toBe(24);
    expect(s.values).toEqual([10, 10]);
    expect(s.hint).toBe('Разгрузка: веса те же, подходов меньше');
  });

  test('шаг берётся из настроек и по переданному снаряду (замена)', () => {
    const slot = getSlot('mon-4'); // Т-гриф 3 × 8-10, замена — гантель
    const steps = { ...DEFAULT_STEPS, dumbbell: 1 };
    const s = suggest({ ...base, steps, slot, kind: 'heavy', equipment: 'dumbbell', count: 3, past: sets(30, [10, 10, 10]) });
    expect(s.weight).toBe(31);
    expect(s.hint).toBe('Верх набран → +1 кг');
  });

  test('боковой подъём: первые тренировки без гантелей — вес 0, повторения растут', () => {
    const slot = getSlot('tue-1'); // 4 × 10-12, на ногу
    const first = suggest({ ...base, slot, kind: 'light', equipment: 'dumbbell', count: 3, past: null, bodyweightOnly: true });
    expect(first).toEqual({ weight: 0, values: [10, 10, 10], hint: 'Первые две недели — без гантелей', increased: false });
    const second = suggest({ ...base, slot, kind: 'light', equipment: 'dumbbell', count: 4, past: sets(0, [12, 12, 12]), bodyweightOnly: true });
    expect(second.weight).toBe(0);
    expect(second.values).toEqual([12, 12, 12, 10]);
    expect(second.hint).toBe('Первые две недели — без гантелей');
  });

  test('после вводных тренировок — обычное правило: верх набран → первая гантель', () => {
    const slot = getSlot('tue-1');
    const s = suggest({ ...base, slot, kind: 'light', equipment: 'dumbbell', count: 4, past: sets(0, [12, 12, 12, 12]) });
    expect(s.weight).toBe(2);
    expect(s.values).toEqual([10, 10, 10, 10]);
    expect(s.hint).toBe('Верх набран → +2 кг, назад к 10');
  });
});
