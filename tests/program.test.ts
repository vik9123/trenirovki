import { describe, expect, test } from 'vitest';
import { DAYS, exerciseByKey, getDay, getSlot, isCurrentKey, RETIRED, slotIdForKey } from '../src/program';

// Эталон — листы «Пн/Вт/Чт/Пт» файла «Дневник тренировок 2026-27.xlsx» (редакция 12.10.2026,
// «со специализацией на плечи»). Названия — как в таблицах «Программы тренировок 2026-27.docx».
const EXCEL: Record<string, [string, number, number, number, number][]> = {
  mon: [
    ['Жим гантелей на наклонной 30°', 4, 8, 10, 105],
    ['Подтягивания с весом', 4, 6, 8, 105],
    ['Отжимания на брусьях', 4, 8, 10, 90],
    ['Тяга в рычажном тренажёре', 3, 8, 10, 90],
    ['Подъём рук в стороны в тренажёре', 4, 12, 15, 45],
    ['Сгибания на скамье Скотта', 3, 8, 10, 60],
    ['Гиперэкстензия', 4, 12, 12, 45],
  ],
  tue: [
    ['Разведения на нижнем блоке одной рукой', 4, 15, 15, 45],
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
    ['Тяга в тренажёре сидя к поясу', 4, 12, 15, 75],
    ['Сведения в кроссовере', 3, 15, 20, 45],
    ['Французский жим', 3, 12, 15, 45],
    ['Молотковые сгибания', 3, 12, 15, 45],
    ['Y-разведения лёжа грудью на наклонной', 4, 12, 15, 45],
    ['Разведения в наклоне', 4, 15, 15, 45],
  ],
  fri: [
    ['Жим гантелей сидя, нейтральный хват', 4, 8, 10, 105],
    ['Разведения гантелей в стороны', 3, 12, 15, 45],
    ['Разведения в наклоне', 4, 12, 15, 45],
    ['Приседания в Смите', 4, 8, 10, 120],
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

  test('подходов в неделю 26 + 27 + 29 + 28 = 110 (Чт 29, Пт 28 — как в таблицах и заголовках docx)', () => {
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
      ['mon-1', 'Жим гантелей на наклонной 30°'], ['mon-lat-machine', 'Подъём рук в стороны в тренажёре'],
      ['mon-5', 'Сгибания на скамье Скотта'], ['mon-7', 'Гиперэкстензия'],
      ['tue-face-pull', 'Тяга каната к лицу'], ['tue-stepup', 'Боковой подъём на тумбу'], ['tue-sl-rdl', 'Румынская тяга на одной ноге'],
      ['tue-3', 'Жим ногами'], ['tue-4', 'Сгибание ног лёжа'], ['tue-5', 'Подъёмы на носки стоя'],
      ['thu-3', 'Тяга в тренажёре сидя к поясу'], // то же упражнение, новое название
      ['thu-5', 'Французский жим'], ['thu-rear-delt', 'Разведения в наклоне'],
      ['fri-db-press', 'Жим гантелей сидя, нейтральный хват'], ['fri-lat', 'Разведения гантелей в стороны'],
      ['fri-7', 'Разведения в наклоне'], ['fri-2', 'Ягодичный мост со штангой'], ['fri-5', 'Подъёмы на носки сидя'],
    ];
    for (const [key, name] of keep) {
      expect(exerciseByKey(key)).toMatchObject({ retired: false, exercise: { name } });
    }
  });

  test('новые упражнения 12.10 — новые ключи', () => {
    expect(getSlot('mon-lever-row').exercise).toMatchObject({ name: 'Тяга в рычажном тренажёре', equipment: 'machine' });
    expect(getSlot('tue-cable-lat').exercise).toMatchObject({ name: 'Разведения на нижнем блоке одной рукой', equipment: 'machine', perSide: 'arm' });
    expect(getSlot('thu-y-raise').exercise).toMatchObject({ name: 'Y-разведения лёжа грудью на наклонной', equipment: 'dumbbell' });
    expect(getSlot('fri-smith-squat').exercise).toMatchObject({ name: 'Приседания в Смите', equipment: 'smith' });
    expect(getSlot('thu-rear-delt').exercise.inheritsFrom).toBe('tue-7');
  });

  test('замена теперь у подъёма рук в тренажёре — разведения гантелей сидя', () => {
    expect(getSlot('mon-lat-machine').substitute).toEqual(
      expect.objectContaining({ key: 'mon-lat-machine~sub', name: 'Разведения гантелей сидя', equipment: 'dumbbell' }),
    );
    expect(DAYS.flatMap((d) => d.slots).filter((s) => s.substitute).map((s) => s.id)).toEqual(['mon-lat-machine']);
  });

  test('разведения растят повторения до 20; вторничные можно пропустить', () => {
    const raises = DAYS.flatMap((d) => d.slots).filter((s) => s.exercise.name.includes('азведения'));
    expect(raises.map((s) => s.id).sort()).toEqual(['fri-7', 'fri-lat', 'thu-rear-delt', 'thu-y-raise', 'tue-cable-lat']);
    raises.forEach((s) => expect(s.progressTo).toBe(20));
    expect(getSlot('mon-lat-machine').progressTo).toBeUndefined();
    expect(getSlot('tue-cable-lat').skippable).toBe(true);
    expect(getSlot('tue-cable-lat').exercise.technique).toContain('убирается первым');
  });

  test('упражнения на одну ногу и одну руку; боковой подъём первые две недели без гантелей', () => {
    expect(getSlot('tue-stepup').exercise).toMatchObject({ perSide: 'leg', bodyweightFirst: 2 });
    expect(getSlot('tue-sl-rdl').exercise).toMatchObject({ perSide: 'leg' });
    expect(getSlot('tue-cable-lat').exercise).toMatchObject({ perSide: 'arm' });
  });

  test('разминка: манжета во Вт и Пт; в пятницу — подходы ногам перед приседом в Смите', () => {
    for (const d of DAYS) {
      expect(d.warmup[0]).toContain('Эллипс');
      expect(d.warmup.some((w) => w.includes('вращательной манжеты'))).toBe(d.id === 'tue' || d.id === 'fri');
    }
    expect(getDay('fri').warmup.some((w) => w.includes('Перед приседаниями в Смите'))).toBe(true);
    expect(getSlot('fri-smith-squat').exercise.technique).toContain('прибавляйте по 10 кг');
    expect(getSlot('fri-2').exercise.technique).toBeUndefined();
    expect(getSlot('mon-7').exercise.technique).toContain('вернуть гиперэкстензию в четверг');
  });

  test('убранные упражнения остаются в справочнике', () => {
    expect(RETIRED.map((r) => [r.id, r.exercise.name, r.day, r.retiredAfter])).toEqual([
      ['tue-1', 'Приседания в Смите', 'tue', '2026-09-23'],
      ['tue-2', 'Румынская тяга в Смите', 'tue', '2026-09-23'],
      ['mon-6', 'Разгибание на верхнем блоке', 'mon', '2026-09-27'],
      ['tue-7', 'Разведения в наклоне', 'tue', '2026-09-27'],
      ['tue-8', 'Прогулка фермера', 'tue', '2026-09-27'],
      ['thu-8', 'Гиперэкстензия', 'thu', '2026-09-27'],
      ['fri-6', 'Тяга к подбородку', 'fri', '2026-09-27'],
      ['mon-4', 'Тяга Т-грифа', 'mon', '2026-10-11'],
      ['tue-6', 'Разведения гантелей в стороны', 'tue', '2026-10-11'],
      ['thu-7', 'Разведения гантелей в стороны', 'thu', '2026-10-11'],
      ['fri-1', 'Приседания со штангой', 'fri', '2026-10-11'],
    ]);
    expect(getSlot('tue-8')).toMatchObject({ unit: 'sec', countsTonnage: false });
    expect(exerciseByKey('mon-4~sub')).toMatchObject({ retired: true, exercise: { name: 'Тяга гантели в упоре одной рукой' } });
    expect(isCurrentKey(getSlot('mon-4'), 'mon-4~sub')).toBe(false);
    expect(isCurrentKey(getSlot('mon-lat-machine'), 'mon-lat-machine~sub')).toBe(true);
    DAYS.flatMap((d) => d.slots).forEach((s) => {
      expect(s.unit).toBe('reps');
      expect(s.countsTonnage).toBe(true);
    });
  });

  test('slotIdForKey: запись с ключом упражнения → постоянный id слота', () => {
    expect(slotIdForKey('tue-stepup')).toBe('tue-stepup');
    expect(slotIdForKey('mon-4~sub')).toBe('mon-4');
    expect(slotIdForKey('mon-lat-machine~sub')).toBe('mon-lat-machine');
  });

  test('неизвестный ключ — ошибка', () => {
    expect(() => getSlot('nope')).toThrow();
    expect(() => exerciseByKey('nope')).toThrow();
  });
});
