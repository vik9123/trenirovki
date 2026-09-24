import { describe, expect, test } from 'vitest';
import { DAYS, exerciseByKey, getDay, getSlot, isCurrentKey, RETIRED } from '../src/program';

// Эталон — листы «Пн/Вт/Чт/Пт» файла «Дневник тренировок 2026-27.xlsx» (редакция 24.09.2026)
const EXCEL: Record<string, [string, number, number, number, number][]> = {
  mon: [
    ['Жим гантелей на наклонной 30°', 4, 8, 10, 105],
    ['Подтягивания с весом', 4, 6, 8, 105],
    ['Отжимания на брусьях', 4, 8, 10, 90],
    ['Тяга Т-грифа', 3, 8, 10, 90],
    ['Сгибания на скамье Скотта', 3, 8, 10, 60],
    ['Разгибание на верхнем блоке', 3, 10, 12, 60],
    ['Гиперэкстензия', 4, 12, 12, 45],
  ],
  tue: [
    ['Боковой подъём на тумбу', 4, 10, 12, 75],
    ['Румынская тяга на одной ноге', 4, 10, 12, 75],
    ['Жим ногами', 3, 15, 20, 75],
    ['Сгибание ног лёжа', 4, 15, 15, 45],
    ['Подъёмы на носки стоя', 4, 15, 20, 45],
    ['Разведения гантелей в стороны', 4, 15, 15, 45],
    ['Разведения в наклоне', 4, 15, 20, 45],
    ['Прогулка фермера', 3, 30, 40, 60],
  ],
  thu: [
    ['Тяга вертикального блока', 4, 12, 15, 75],
    ['Жим гантелей на горизонтальной', 4, 12, 15, 75],
    ['Тяга сидя в тренажёре', 4, 12, 15, 75],
    ['Сведения в кроссовере', 3, 15, 20, 45],
    ['Французский жим', 4, 12, 15, 45],
    ['Молотковые сгибания', 3, 12, 15, 45],
    ['Разведения гантелей в стороны', 4, 15, 15, 45],
    ['Гиперэкстензия', 4, 15, 20, 45],
  ],
  fri: [
    ['Приседания со штангой', 4, 8, 10, 120],
    ['Ягодичный мост со штангой', 4, 10, 12, 105],
    ['Разгибание ног', 4, 10, 12, 60],
    ['Сгибание ног лёжа', 4, 10, 12, 60],
    ['Подъёмы на носки сидя', 4, 12, 12, 45],
    ['Тяга к подбородку', 4, 10, 12, 60],
    ['Разведения в наклоне', 4, 12, 15, 45],
  ],
};

describe('программа', () => {
  test('дни идут в порядке Пн, Вт, Чт, Пт', () => {
    expect(DAYS.map((d) => d.id)).toEqual(['mon', 'tue', 'thu', 'fri']);
    expect(DAYS.map((d) => d.kind)).toEqual(['heavy', 'light', 'light', 'heavy']);
  });

  test.each(Object.keys(EXCEL))('день %s совпадает с Excel', (id) => {
    const day = getDay(id as 'mon');
    const actual = day.slots.map((s) => [s.exercise.name, s.sets, s.repMin, s.repMax, s.restSec]);
    expect(actual).toEqual(EXCEL[id]);
    day.slots.forEach((s, i) => {
      expect(s.order).toBe(i + 1);
      expect(s.day).toBe(id);
    });
  });

  test('подходов в неделю 25 + 30 + 30 + 28 = 113', () => {
    const perDay = DAYS.map((d) => d.slots.reduce((n, s) => n + s.sets, 0));
    expect(perDay).toEqual([25, 30, 30, 28]);
    expect(perDay.reduce((a, b) => a + b)).toBe(113);
  });

  test('id слотов и ключи упражнений уникальны, включая замены и прежние упражнения', () => {
    const ids = DAYS.flatMap((d) => d.slots.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    const keys = [
      ...DAYS.flatMap((d) => d.slots.flatMap((s) => [s.exercise.key, ...(s.substitute ? [s.substitute.key] : [])])),
      ...RETIRED.map((r) => r.exercise.key),
    ];
    expect(new Set(keys).size).toBe(keys.length);
    keys.forEach((k) => expect(exerciseByKey(k).exercise.key).toBe(k));
  });

  test('программа от 24.09: во вторник упражнения на одну ногу с новыми ключами', () => {
    const stepUp = getSlot('tue-1');
    const slRdl = getSlot('tue-2');
    expect(stepUp.exercise).toMatchObject({ key: 'tue-stepup', equipment: 'dumbbell', perSide: true, bodyweightFirst: 2 });
    expect(slRdl.exercise).toMatchObject({ key: 'tue-sl-rdl', equipment: 'dumbbell', perSide: true });
    expect(slRdl.exercise.bodyweightFirst).toBeUndefined();
    expect(stepUp.exercise.technique).toContain('Первые две недели без гантелей');
  });

  test('прежние упражнения вторника остаются в справочнике для истории', () => {
    expect(RETIRED.map((r) => [r.exercise.key, r.exercise.name, r.slotId])).toEqual([
      ['tue-1', 'Приседания в Смите', 'tue-1'],
      ['tue-2', 'Румынская тяга в Смите', 'tue-2'],
    ]);
    const old = exerciseByKey('tue-1');
    expect(old.retired).toBe(true);
    expect(old.slot.id).toBe('tue-1');
    expect(old.exercise.equipment).toBe('smith');
    expect(exerciseByKey('tue-stepup').retired).toBe(false);
    expect(isCurrentKey(getSlot('tue-1'), 'tue-1')).toBe(false);
    expect(isCurrentKey(getSlot('tue-1'), 'tue-stepup')).toBe(true);
    expect(isCurrentKey(getSlot('mon-4'), 'mon-4~sub')).toBe(true);
  });

  test('Т-гриф можно заменить на тягу гантели', () => {
    const tbar = getSlot('mon-4');
    expect(tbar.substitute).toEqual(
      expect.objectContaining({ key: 'mon-4~sub', name: 'Тяга гантели в упоре одной рукой', equipment: 'dumbbell' }),
    );
    expect(exerciseByKey('mon-4~sub').slot.id).toBe('mon-4');
    expect(exerciseByKey('mon-4~sub').exercise.equipment).toBe('dumbbell');
  });

  test('прогулка фермера — секунды, без тоннажа, можно пропустить', () => {
    const farmer = getSlot('tue-8');
    expect(farmer.unit).toBe('sec');
    expect(farmer.countsTonnage).toBe(false);
    expect(farmer.skippable).toBe(true);
    expect(farmer.exercise.equipment).toBe('dumbbell');
    const others = DAYS.flatMap((d) => d.slots).filter((s) => s.id !== 'tue-8');
    others.forEach((s) => {
      expect(s.unit).toBe('reps');
      expect(s.countsTonnage).toBe(true);
    });
  });

  test('неизвестный ключ — ошибка', () => {
    expect(() => getSlot('nope')).toThrow();
    expect(() => exerciseByKey('nope')).toThrow();
  });
});
