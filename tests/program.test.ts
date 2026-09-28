import { describe, expect, test } from 'vitest';
import { DAYS, exerciseByKey, getDay, getSlot, isCurrentKey, RETIRED, slotIdForKey } from '../src/program';

// Эталон — листы «Пн/Вт/Чт/Пт» файла «Дневник тренировок 2026-27.xlsx» (редакция 28.09.2026,
// «со специализацией на плечи»). Названия — как в таблицах «Программы тренировок 2026-27.docx».
const EXCEL: Record<string, [string, number, number, number, number][]> = {
  mon: [
    ['Жим гантелей на наклонной 30°', 4, 8, 10, 105],
    ['Подтягивания с весом', 4, 6, 8, 105],
    ['Отжимания на брусьях', 4, 8, 10, 90],
    ['Тяга Т-грифа', 3, 8, 10, 90],
    ['Подъём рук в стороны в тренажёре', 4, 12, 15, 45],
    ['Сгибания на скамье Скотта', 3, 8, 10, 60],
    ['Гиперэкстензия', 4, 12, 12, 45],
  ],
  tue: [
    ['Разведения гантелей в стороны', 4, 15, 15, 45],
    ['Тяга каната к лицу', 4, 15, 15, 45],
    ['Боковой подъём на тумбу', 4, 10, 12, 75],
    ['Румынская тяга на одной ноге', 4, 10, 12, 75],
    ['Жим ногами', 3, 15, 20, 75],
    ['Сгибание ног лёжа', 4, 15, 15, 45],
    ['Подъёмы на носки стоя', 4, 15, 20, 45],
  ],
  thu: [
    ['Тяга вертикального блока', 4, 12, 15, 75],
    ['Жим гантелей на горизонтальной', 4, 12, 15, 75],
    ['Тяга сидя в тренажёре', 4, 12, 15, 75],
    ['Сведения в кроссовере', 3, 15, 20, 45],
    ['Французский жим', 3, 12, 15, 45],
    ['Молотковые сгибания', 3, 12, 15, 45],
    ['Разведения гантелей в стороны', 4, 12, 15, 45],
    ['Разведения в наклоне', 4, 15, 15, 45],
  ],
  fri: [
    ['Приседания со штангой', 4, 8, 10, 120],
    ['Жим гантелей сидя, нейтральный хват', 4, 8, 10, 105],
    ['Разведения гантелей в стороны', 3, 12, 15, 45],
    ['Разведения в наклоне', 4, 12, 15, 45],
    ['Ягодичный мост со штангой', 3, 10, 12, 105],
    ['Разгибание ног', 3, 10, 12, 60],
    ['Сгибание ног лёжа', 3, 10, 12, 60],
    ['Подъёмы на носки сидя', 4, 12, 12, 45],
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
      expect(s.retiredAfter).toBeUndefined();
      expect(s.exercise.muscles).toBeTruthy();
    });
  });

  test('подходов в неделю 26 + 27 + 29 + 28 = 110 (по таблицам; в заголовках docx Чт/Пт перепутаны)', () => {
    const perDay = DAYS.map((d) => d.slots.reduce((n, s) => n + s.sets, 0));
    expect(perDay).toEqual([26, 27, 29, 28]);
    expect(perDay.reduce((a, b) => a + b)).toBe(110);
  });

  test('id слота = ключ основного упражнения; ключи уникальны, включая замены и убранные', () => {
    const all = [...DAYS.flatMap((d) => d.slots), ...RETIRED];
    all.forEach((s) => expect(s.exercise.key).toBe(s.id));
    const keys = all.flatMap((s) => [s.exercise.key, ...(s.substitute ? [s.substitute.key] : [])]);
    expect(new Set(keys).size).toBe(keys.length);
    keys.forEach((k) => expect(exerciseByKey(k).exercise.key).toBe(k));
  });

  test('упражнения, которые остались, сохранили ключи — история продолжается', () => {
    const keep: [string, string][] = [
      ['mon-1', 'Жим гантелей на наклонной 30°'], ['mon-4', 'Тяга Т-грифа'], ['mon-5', 'Сгибания на скамье Скотта'], ['mon-7', 'Гиперэкстензия'],
      ['tue-6', 'Разведения гантелей в стороны'], ['tue-3', 'Жим ногами'], ['tue-4', 'Сгибание ног лёжа'], ['tue-5', 'Подъёмы на носки стоя'],
      ['tue-stepup', 'Боковой подъём на тумбу'], ['tue-sl-rdl', 'Румынская тяга на одной ноге'],
      ['thu-5', 'Французский жим'], ['thu-7', 'Разведения гантелей в стороны'],
      ['fri-1', 'Приседания со штангой'], ['fri-2', 'Ягодичный мост со штангой'], ['fri-7', 'Разведения в наклоне'], ['fri-5', 'Подъёмы на носки сидя'],
    ];
    for (const [key, name] of keep) {
      expect(exerciseByKey(key)).toMatchObject({ retired: false, exercise: { name } });
    }
  });

  test('новые упражнения — новые ключи', () => {
    expect(getSlot('mon-lat-machine').exercise).toMatchObject({ name: 'Подъём рук в стороны в тренажёре', equipment: 'machine' });
    expect(getSlot('tue-face-pull').exercise).toMatchObject({ name: 'Тяга каната к лицу', equipment: 'machine' });
    expect(getSlot('fri-db-press').exercise).toMatchObject({ name: 'Жим гантелей сидя, нейтральный хват', equipment: 'dumbbell' });
    expect(getSlot('fri-lat').exercise.name).toBe('Разведения гантелей в стороны');
    expect(getSlot('thu-rear-delt').exercise).toMatchObject({ name: 'Разведения в наклоне', inheritsFrom: 'tue-7' });
  });

  test('разведения растят повторения до 20; вторничные можно пропустить', () => {
    const raises = DAYS.flatMap((d) => d.slots).filter((s) => s.exercise.name.startsWith('Разведения'));
    expect(raises.map((s) => s.id).sort()).toEqual(['fri-7', 'fri-lat', 'thu-7', 'thu-rear-delt', 'tue-6']);
    raises.forEach((s) => expect(s.progressTo).toBe(20));
    expect(getSlot('mon-lat-machine').progressTo).toBeUndefined();
    expect(getSlot('tue-6').skippable).toBe(true);
    expect(getSlot('tue-6').exercise.technique).toContain('убирается первым');
  });

  test('упражнения на одну ногу; боковой подъём первые две недели без гантелей', () => {
    expect(getSlot('tue-stepup').exercise).toMatchObject({ perSide: true, bodyweightFirst: 2 });
    expect(getSlot('tue-sl-rdl').exercise).toMatchObject({ perSide: true });
  });

  test('разминка: вращательная манжета во вторник и пятницу', () => {
    for (const d of DAYS) {
      expect(d.warmup[0]).toContain('Эллипс');
      expect(d.warmup.some((w) => w.includes('вращательной манжеты'))).toBe(d.id === 'tue' || d.id === 'fri');
    }
    expect(getSlot('fri-2').exercise.technique).toContain('разминочный подход');
  });

  test('убранные упражнения остаются в справочнике', () => {
    expect(RETIRED.map((r) => [r.id, r.exercise.name, r.day, r.order])).toEqual([
      ['tue-1', 'Приседания в Смите', 'tue', 1],
      ['tue-2', 'Румынская тяга в Смите', 'tue', 2],
      ['mon-6', 'Разгибание на верхнем блоке', 'mon', 6],
      ['tue-7', 'Разведения в наклоне', 'tue', 7],
      ['tue-8', 'Прогулка фермера', 'tue', 8],
      ['thu-8', 'Гиперэкстензия', 'thu', 8],
      ['fri-6', 'Тяга к подбородку', 'fri', 6],
    ]);
    const farmer = getSlot('tue-8');
    expect(farmer).toMatchObject({ unit: 'sec', countsTonnage: false });
    expect(exerciseByKey('tue-8').retired).toBe(true);
    expect(isCurrentKey(getSlot('tue-6'), 'tue-6')).toBe(true);
    expect(isCurrentKey(getSlot('tue-8'), 'tue-8')).toBe(false);
    expect(isCurrentKey(getSlot('mon-4'), 'mon-4~sub')).toBe(true);
    // все, кроме прогулки фермера, идут в тоннаж
    DAYS.flatMap((d) => d.slots).forEach((s) => {
      expect(s.unit).toBe('reps');
      expect(s.countsTonnage).toBe(true);
    });
  });

  test('slotIdForKey: запись с ключом упражнения → постоянный id слота', () => {
    expect(slotIdForKey('tue-stepup')).toBe('tue-stepup');
    expect(slotIdForKey('mon-4~sub')).toBe('mon-4');
    expect(slotIdForKey('tue-8')).toBe('tue-8');
  });

  test('Т-гриф можно заменить на тягу гантели', () => {
    expect(getSlot('mon-4').substitute).toEqual(
      expect.objectContaining({ key: 'mon-4~sub', name: 'Тяга гантели в упоре одной рукой', equipment: 'dumbbell' }),
    );
  });

  test('неизвестный ключ — ошибка', () => {
    expect(() => getSlot('nope')).toThrow();
    expect(() => exerciseByKey('nope')).toThrow();
  });
});
