import { describe, expect, test } from 'vitest';
import { getSlot } from '../src/program';
import { DEFAULT_STEPS, suggest, type Past } from '../src/logic/progression';

const sets = (weight: number, values: number[], extra: Partial<{ done: boolean; pain: boolean }> = {}): Past => ({
  sets: values.map((value) => ({ weight, value, done: true, pain: false, ...extra })),
});

const base = { steps: DEFAULT_STEPS, deload: false };

describe('подсказка прогрессии', () => {
  test('нет истории — калибровка: вес 0, нижняя граница', () => {
    const slot = getSlot('f3-seated-press'); // 4 × 8-10
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'dumbbell', count: 3, past: null });
    expect(s).toEqual({ weight: 0, values: [8, 8, 8], hint: 'Калибровка: подберите рабочий вес', increased: false });
  });

  test('тяжёлый день, верх набран во всех подходах → + шаг гантелей, назад к нижней границе', () => {
    const slot = getSlot('f3-seated-press');
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'dumbbell', count: 4, past: sets(18, [10, 10, 10, 10]) });
    expect(s).toMatchObject({ weight: 20, values: [8, 8, 8, 8], increased: true, hint: 'Верх набран → +2 кг' });
  });

  test('тяжёлый день, верх не набран → держим вес, повторения как в прошлый раз', () => {
    const slot = getSlot('f3-seated-press');
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'dumbbell', count: 4, past: sets(18, [10, 9, 8, 8]) });
    expect(s).toMatchObject({ weight: 18, values: [10, 9, 8, 8], increased: false, hint: 'Держим вес, добиваем до 10' });
  });

  test('подходов сделано меньше плана — верх не набран', () => {
    const slot = getSlot('f3-smith-squat');
    const past = sets(80, [10, 10, 10, 10]);
    past.sets[3].done = false;
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'smith', count: 4, past });
    expect(s.weight).toBe(80);
    expect(s.increased).toBe(false);
  });

  test('рабочий вес — максимум среди выполненных подходов', () => {
    const slot = getSlot('f3-smith-squat'); // 4 × 8-10
    const past: Past = {
      sets: [
        { weight: 75, value: 10, done: true, pain: false },
        { weight: 80, value: 9, done: true, pain: false },
        { weight: 100, value: 0, done: false, pain: false },
      ],
    };
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'smith', count: 4, past });
    expect(s.weight).toBe(80);
    expect(s.values).toEqual([10, 9, 8, 8]);
  });

  test('Смит: шаг 2,5 кг', () => {
    const slot = getSlot('f3-smith-squat');
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'smith', count: 4, past: sets(60, [10, 10, 10, 10]) });
    expect(s.weight).toBe(62.5);
    expect(s.hint).toBe('Верх набран → +2,5 кг');
  });

  test('доп. вес (подтягивания): шаг 1,25 кг', () => {
    const slot = getSlot('f3-pullups'); // 4 × 6-8
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'added', count: 4, past: sets(5, [8, 8, 8, 8]) });
    expect(s.weight).toBe(6.25);
    expect(s.values).toEqual([6, 6, 6, 6]);
  });

  test('фиксированные повторения (канат 3 × 15)', () => {
    const slot = getSlot('f3-face-pull');
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'machine', count: 3, past: sets(20, [15, 15, 15]) });
    expect(s).toMatchObject({ weight: 25, values: [15, 15, 15], increased: true });
  });

  test('лёгкий день, верх не набран → держим вес, +1 повтор', () => {
    const slot = getSlot('f3-1arm-press'); // 4 × 12-15
    const s = suggest({ ...base, slot, kind: 'light', equipment: 'dumbbell', count: 4, past: sets(16, [14, 13, 13, 12]) });
    expect(s).toMatchObject({ weight: 16, values: [14, 13, 13, 12], hint: 'Держим вес, +1 повтор' });
  });

  test('лёгкий день, верх набран → + шаг, назад к нижней границе', () => {
    const slot = getSlot('f3-1arm-press');
    const s = suggest({ ...base, slot, kind: 'light', equipment: 'dumbbell', count: 4, past: sets(16, [15, 15, 15, 16]) });
    expect(s).toMatchObject({ weight: 18, values: [12, 12, 12, 12], hint: 'Верх набран → +2 кг, назад к 12' });
  });

  test('боль в прошлый раз → не повышаем, даже если верх набран', () => {
    const slot = getSlot('f3-seated-press');
    const past = sets(18, [10, 10, 10, 10]);
    past.sets[2].pain = true;
    const s = suggest({ ...base, slot, kind: 'heavy', equipment: 'dumbbell', count: 4, past });
    expect(s).toMatchObject({ weight: 18, increased: false, hint: 'В прошлый раз была боль — держим вес' });
  });

  test('разгрузка важнее всего: вес прежний, подходов меньше', () => {
    const slot = getSlot('f3-seated-press');
    const s = suggest({ ...base, deload: true, slot, kind: 'heavy', equipment: 'dumbbell', count: 2, past: sets(18, [10, 10, 10, 10]) });
    expect(s).toMatchObject({ weight: 18, values: [10, 10], hint: 'Разгрузка: веса те же, подходов меньше' });
  });

  test('шаг берётся из настроек и по переданному снаряду (замена на блок)', () => {
    const slot = getSlot('f3-1arm-row');
    const steps = { ...DEFAULT_STEPS, machine: 2.5 };
    const s = suggest({ ...base, steps, slot, kind: 'light', equipment: 'machine', count: 4, past: sets(20, [15, 15, 15, 15]) });
    expect(s.weight).toBe(22.5);
    expect(s.hint).toBe('Верх набран → +2,5 кг, назад к 12');
  });

  test('разведения (лёгкий день, 3 × 15): 15 набрано — вес держим, повторения до 20', () => {
    const slot = getSlot('f3-cable-lat');
    const s = suggest({ ...base, slot, kind: 'light', equipment: 'machine', count: 3, past: sets(5, [15, 15, 15]) });
    expect(s).toMatchObject({ weight: 5, values: [15, 15, 15], hint: 'Держим вес, +1 повтор (до 20)' });
  });

  test('разведения: 20 во всех подходах → + шаг, назад к нижней границе', () => {
    const slot = getSlot('f3-cable-lat');
    const s = suggest({ ...base, slot, kind: 'light', equipment: 'machine', count: 3, past: sets(5, [20, 20, 20]) });
    expect(s).toMatchObject({ weight: 10, values: [15, 15, 15], hint: '20 повторений набраны → +5 кг, назад к 15' });
  });

  test('разведения в тяжёлый день (Сб, 4 × 12-15): добиваем до 20, а не до 15', () => {
    const slot = getSlot('f3-lat-raise');
    const hold = suggest({ ...base, slot, kind: 'heavy', equipment: 'dumbbell', count: 4, past: sets(8, [15, 15, 15, 15]) });
    expect(hold).toMatchObject({ weight: 8, hint: 'Держим вес, добиваем до 20' });
    const up = suggest({ ...base, slot, kind: 'heavy', equipment: 'dumbbell', count: 4, past: sets(8, [20, 20, 20, 20]) });
    expect(up).toMatchObject({ weight: 10, values: [12, 12, 12, 12], hint: '20 повторений набраны → +2 кг, назад к 12' });
  });
});
