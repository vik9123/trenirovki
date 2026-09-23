import { describe, expect, test } from 'vitest';
import { DAYS, exerciseByKey, getDay, getSlot } from '../src/program';

// Эталон — листы «Пн/Вт/Чт/Пт» файла «Дневник тренировок 2026-27.xlsx»
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
    ['Приседания в Смите', 4, 12, 15, 90],
    ['Румынская тяга в Смите', 4, 12, 15, 90],
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

  test('id слотов уникальны, ключ упражнения = id слота', () => {
    const ids = DAYS.flatMap((d) => d.slots.map((s) => s.id));
    expect(new Set(ids).size).toBe(ids.length);
    DAYS.flatMap((d) => d.slots).forEach((s) => expect(s.exercise.key).toBe(s.id));
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
