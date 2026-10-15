import { describe, expect, test } from 'vitest';
import { DAYS, exerciseByKey, getDay, getSlot, isKnownKey } from '../src/program';

// Эталон — таблицы «Программа тренировок 2026-27 3 дня.docx» (редакция 15.10.2026).
const DOC: Record<string, [string, number, number, number, number][]> = {
  tue: [
    ['Подтягивания с весом', 4, 6, 8, 90],
    ['Жим в тренажёре на наклонной (головой вверх)', 4, 8, 10, 90],
    ['Тяга нижнего блока к поясу сидя', 3, 8, 10, 75],
    ['Жим гантелей сидя, нейтральный хват', 4, 8, 10, 75],
    ['Тяга каната к лицу', 3, 15, 15, 45],
    ['Приседания в Смите', 4, 8, 10, 105],
    ['Сгибание ног лёжа', 3, 10, 12, 60],
  ],
  thu: [
    ['Боковой подъём на тумбу', 4, 12, 15, 45],
    ['Румынская тяга на одной ноге', 4, 12, 15, 45],
    ['Подъёмы на носок на одной ноге стоя', 3, 12, 15, 30],
    ['Жим в тренажёре одной рукой', 4, 12, 15, 30],
    ['Тяга гантели одной рукой с упором в скамью', 4, 12, 15, 30],
    ['Разведения на нижнем блоке одной рукой', 3, 15, 15, 30],
    ['Обратные разведения в тренажёре', 3, 15, 15, 45],
  ],
  sat: [
    ['Жим ногами', 4, 10, 12, 90],
    ['Ягодичный мост со штангой', 4, 10, 12, 75],
    ['Жим гантелей на наклонной 30° (головой вверх)', 3, 10, 12, 75],
    ['Тяга в рычажном тренажёре', 4, 8, 10, 75],
    ['Отжимания на брусьях', 4, 8, 10, 75],
    ['Разведения гантелей в стороны', 4, 12, 15, 45],
    ['Разведения в наклоне', 3, 15, 15, 45],
  ],
};

describe('программа: фулбоди 3 дня', () => {
  test('Вт тяжёлый, Чт лёгкий, Сб тяжёлый', () => {
    expect(DAYS.map((d) => [d.id, d.kind])).toEqual([['tue', 'heavy'], ['thu', 'light'], ['sat', 'heavy']]);
  });

  test.each(Object.keys(DOC))('день %s совпадает с документом', (id) => {
    const day = getDay(id as 'tue');
    expect(day.slots.map((s) => [s.exercise.name, s.sets, s.repMin, s.repMax, s.restSec])).toEqual(DOC[id]);
    day.slots.forEach((s, i) => {
      expect(s).toMatchObject({ order: i + 1, day: id });
      expect(s.exercise.muscles).toBeTruthy();
    });
  });

  test('подходов в неделю 25 + 25 + 26 = 76', () => {
    const perDay = DAYS.map((d) => d.slots.reduce((n, s) => n + s.sets, 0));
    expect(perDay).toEqual([25, 25, 26]);
    expect(perDay.reduce((a, b) => a + b)).toBe(76);
  });

  test('id слота = ключ основного упражнения (кроме жима одной рукой); ключи уникальны, включая замены', () => {
    const slots = DAYS.flatMap((d) => d.slots);
    slots.filter((s) => s.id !== 'f3-1arm-press').forEach((s) => expect(s.exercise.key).toBe(s.id));
    const keys = slots.flatMap((s) => [s.exercise.key, ...(s.substitutes ?? []).map((x) => x.key)]);
    expect(new Set(slots.map((s) => s.id)).size).toBe(slots.length);
    expect(new Set(keys).size).toBe(keys.length);
    keys.forEach((k) => {
      expect(isKnownKey(k)).toBe(true);
      expect(exerciseByKey(k).exercise.key).toBe(k);
    });
  });

  test('четверг — на одну ногу / одну руку', () => {
    expect(getDay('thu').slots.map((s) => s.exercise.perSide ?? '-')).toEqual(['leg', 'leg', 'leg', 'arm', 'arm', 'arm', '-']);
  });

  test('замены в четверг — кнопками, как в документе', () => {
    const subs = DAYS.flatMap((d) => d.slots).flatMap((s) => (s.substitutes ?? []).map((x) => [s.id, x.key, x.name, x.equipment]));
    expect(subs).toEqual([
      ['f3-1arm-press', 'f3-1arm-press', 'Жим гантели одной рукой лёжа на горизонтальной', 'dumbbell'],
      ['f3-1arm-press', 'f3-1arm-press~sub', 'Сведения в кроссовере одной рукой', 'machine'],
      ['f3-1arm-row', 'f3-1arm-row~sub', 'Тяга блока одной рукой (нижнего сидя или верхнего)', 'machine'],
      ['f3-cable-lat', 'f3-cable-lat~sub', 'Разведения гантелью одной рукой с наклоном в сторону', 'dumbbell'],
    ]);
  });

  test('15.10: жим одной рукой — в тренажёре; жим гантели стал заменой и сохранил ключ и записи', () => {
    const press = getSlot('f3-1arm-press');
    expect(press.exercise).toMatchObject({ key: 'f3-1arm-machine-press', name: 'Жим в тренажёре одной рукой', equipment: 'machine', perSide: 'arm' });
    expect(exerciseByKey('f3-1arm-machine-press').slot).toBe(press);
    expect(exerciseByKey('f3-1arm-press')).toMatchObject({ slot: press, exercise: { equipment: 'dumbbell' } });
    expect(exerciseByKey('f3-1arm-press~sub').slot).toBe(press);
    expect(press.exercise.technique).toContain('Начинайте со слабой руки');
  });

  test('разведения: повторения до 20, потом вес', () => {
    const raises = DAYS.flatMap((d) => d.slots).filter((s) => s.exercise.name.toLowerCase().includes('разведения'));
    expect(raises.map((s) => s.id)).toEqual(['f3-cable-lat', 'f3-reverse-fly', 'f3-lat-raise', 'f3-rear-delt']);
    raises.forEach((s) => expect(s.progressTo).toBe(20));
    expect(getSlot('f3-face-pull').progressTo).toBeUndefined();
  });

  test('разминка по дням', () => {
    const w = (id: 'tue' | 'thu' | 'sat') => getDay(id).warmup.join(' ');
    for (const d of DAYS) expect(d.warmup[0]).toContain('Эллипс');
    expect(w('tue')).toContain('Перед приседаниями в Смите');
    expect(w('thu')).toContain('перед боковым подъёмом');
    expect(w('sat')).toContain('перед жимом гантелей на наклонной');
  });

  test('неизвестный ключ или день — ошибка', () => {
    expect(() => getSlot('nope')).toThrow();
    expect(() => exerciseByKey('nope')).toThrow();
    expect(isKnownKey('nope')).toBe(false);
    expect(() => getDay('xyz' as 'tue')).toThrow();
  });
});
