import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { db, resetDb } from '../src/data/db';
import * as repo from '../src/data/repo';
import { getSlot, type DayId } from '../src/program';

let clock = new Date(2026, 8, 28, 10).getTime(); // пн 28.09.2026
const tick = (days = 1) => new Date((clock += days * 86_400_000));

beforeEach(() => {
  resetDb(`test-${Math.random()}`);
  clock = new Date(2026, 8, 28, 10).getTime();
});

/** Выполнить тренировку: все подходы — вес и значение, по умолчанию верх диапазона. */
async function doDay(day: DayId, weight: number, value?: (repMax: number) => number) {
  const id = await repo.startSession(day, tick(0));
  const { sets } = await repo.sessionBundle(id);
  for (const s of sets) {
    const slot = getSlot(s.slotId);
    await repo.updateSet(s.id!, { weight, value: value ? value(slot.repMax) : slot.repMax, done: true });
  }
  await repo.finishSession(id, { wellbeing: 4, back: 'ok', note: '' }, tick(0));
  tick(1);
  return id;
}

async function doWeek(weight: number) {
  for (const d of ['mon', 'tue', 'thu', 'fri'] as DayId[]) await doDay(d, weight);
}

describe('цикл', () => {
  test('первый запуск создаёт цикл 1, неделя 1', async () => {
    const c = await repo.getActiveCycle();
    expect(c).toMatchObject({ number: 1, currentWeek: 1 });
    expect((await repo.getActiveCycle()).id).toBe(c.id);
  });

  test('понедельник недели 1 — 21 подход с весом 0 и нижней границей', async () => {
    const id = await repo.startSession('mon', tick(0));
    const { sets, session } = await repo.sessionBundle(id);
    expect(session).toMatchObject({ week: 1, day: 'mon', date: '2026-09-28' });
    expect(sets).toHaveLength(21);
    expect(sets.every((s) => s.weight === 0 && !s.done)).toBe(true);
    expect(sets.filter((s) => s.slotId === 'mon-1').map((s) => s.value)).toEqual([8, 8, 8]);
  });

  test('повторный старт того же дня недели возвращает ту же тренировку', async () => {
    const a = await repo.startSession('mon', tick(0));
    const b = await repo.startSession('mon', tick(0));
    expect(b).toBe(a);
  });

  test('незавершённая тренировка находится через openSession', async () => {
    expect(await repo.openSession()).toBeUndefined();
    const id = await repo.startSession('tue', tick(0));
    expect((await repo.openSession())?.id).toBe(id);
  });

  test('после всех 4 дней неделя переключается сама', async () => {
    await doWeek(20);
    expect((await repo.getActiveCycle()).currentWeek).toBe(2);
  });

  test('advanceWeek вручную и закрытие цикла после недели 8', async () => {
    const c = await repo.getActiveCycle();
    for (let i = 0; i < 7; i++) await repo.advanceWeek(c.id!);
    expect((await repo.getActiveCycle()).currentWeek).toBe(8);
    await repo.advanceWeek(c.id!);
    const closed = await repo.getActiveCycle();
    expect(closed.currentWeek).toBe(8);
    expect(closed.finishedAt).toBeTypeOf('number');
    await expect(repo.startSession('mon', tick(0))).rejects.toThrow();
  });

  test('новый цикл: номер 2, неделя 1 полного объёма, веса — последние рабочие', async () => {
    await doDay('mon', 24, (max) => max - 1);
    const c = await repo.getActiveCycle();
    for (let i = 0; i < 8; i++) await repo.advanceWeek(c.id!);
    const c2 = await repo.startNewCycle();
    expect(c2).toMatchObject({ number: 2, currentWeek: 1 });
    const id = await repo.startSession('mon', tick(0));
    const { sets } = await repo.sessionBundle(id);
    expect(sets).toHaveLength(25);
    expect(sets.find((s) => s.slotId === 'mon-1')!.weight).toBe(24);
  });
});

describe('подсказки из истории', () => {
  test('неделя 2: верх набран в калибровке → вес + шаг', async () => {
    await doWeek(20);
    const id = await repo.startSession('mon', tick(0));
    const { sets } = await repo.sessionBundle(id);
    const bench = sets.filter((s) => s.slotId === 'mon-1');
    expect(bench).toHaveLength(4);
    expect(bench.map((s) => s.weight)).toEqual([22, 22, 22, 22]); // гантели +2
    expect(bench.map((s) => s.value)).toEqual([8, 8, 8, 8]);
    const hint = await repo.suggestionFor(id, 'mon-1');
    expect(hint.hint).toBe('Верх набран → +2 кг');
  });

  test('разгрузка не используется как «прошлый раз»', async () => {
    const c = await repo.getActiveCycle();
    for (let i = 0; i < 6; i++) await repo.advanceWeek(c.id!); // неделя 7
    await doDay('mon', 30, (max) => max - 1);
    await repo.advanceWeek(c.id!); // неделя 8
    await doDay('mon', 10);
    const past = await repo.lastPast('mon-1');
    expect(past?.week).toBe(7);
    expect(past?.past.sets[0].weight).toBe(30);
  });

  test('замена ведёт свою историю и запоминается', async () => {
    const id = await repo.startSession('mon', tick(0));
    await repo.swapExercise(id, 'mon-4', true);
    let { sets } = await repo.sessionBundle(id);
    const rows = sets.filter((s) => s.slotId === 'mon-4');
    expect(rows.every((s) => s.exerciseKey === 'mon-4~sub')).toBe(true);
    for (const s of rows) await repo.updateSet(s.id!, { weight: 30, value: 10, done: true });
    await repo.finishSession(id, { wellbeing: 3, back: 'ache', note: 'поясница' }, tick(0));
    expect(await repo.lastPast('mon-4')).toBeNull();
    expect((await repo.lastPast('mon-4~sub'))?.past.sets[0].weight).toBe(30);

    const c = await repo.getActiveCycle();
    await repo.advanceWeek(c.id!);
    const id2 = await repo.startSession('mon', tick(1));
    ({ sets } = await repo.sessionBundle(id2));
    const next = sets.filter((s) => s.slotId === 'mon-4');
    expect(next[0].exerciseKey).toBe('mon-4~sub');
    expect(next[0].weight).toBe(32);
  });

  test('пропуск упражнения убирает подходы, возврат — создаёт заново', async () => {
    const id = await repo.startSession('tue', tick(0));
    await repo.setSkipped(id, 'tue-8', true);
    let b = await repo.sessionBundle(id);
    expect(b.sets.filter((s) => s.slotId === 'tue-8')).toHaveLength(0);
    expect(b.skips.map((s) => s.slotId)).toEqual(['tue-8']);
    await repo.setSkipped(id, 'tue-8', false);
    b = await repo.sessionBundle(id);
    expect(b.sets.filter((s) => s.slotId === 'tue-8')).toHaveLength(3);
    expect(b.skips).toHaveLength(0);
  });

  test('повторное завершение сохраняет самочувствие, не трогая время конца', async () => {
    const id = await repo.startSession('mon', tick(0));
    await repo.finishSession(id, { wellbeing: 4, back: 'ok', note: '' }, tick(0));
    const first = (await repo.sessionBundle(id)).session.finishedAt;
    await repo.finishSession(id, { wellbeing: 2, back: 'pain', note: 'правка' }, tick(1));
    const s = (await repo.sessionBundle(id)).session;
    expect(s.finishedAt).toBe(first);
    expect(s).toMatchObject({ wellbeing: 2, back: 'pain', note: 'правка' });
  });
});

describe('история и сводка', () => {
  test('удаление тренировки удаляет её подходы', async () => {
    const id = await doDay('mon', 20);
    await repo.deleteSession(id);
    expect(await repo.allSessions()).toHaveLength(0);
    expect(await db.sets.count()).toBe(0);
  });

  test('история упражнения: рабочий вес и сумма повторений', async () => {
    await doDay('mon', 20);
    const h = await repo.exerciseHistory('mon-1');
    expect(h).toEqual([{ date: '2026-09-28', top: 20, total: 30 }]);
  });

  test('сводка по неделям: тоннаж по дням и средний вес тела', async () => {
    await repo.addBodyweight('2026-09-28', 81);
    await repo.addBodyweight('2026-09-30', 80);
    await doWeek(10);
    const rows = await repo.weeklySummary((await repo.getActiveCycle()).id!);
    expect(rows).toHaveLength(8);
    const w1 = rows[0];
    // Пн неделя 1: 21 подход по 10 кг × верх диапазона
    const monExpected = 10 * (3 * 10 + 3 * 8 + 3 * 10 + 3 * 10 + 3 * 10 + 3 * 12 + 3 * 12);
    expect(w1.byDay.mon).toBe(monExpected);
    expect(w1.total).toBe(w1.byDay.mon + w1.byDay.tue + w1.byDay.thu + w1.byDay.fri);
    expect(w1.bodyweight).toBe(80.5);
    expect(rows[1].total).toBe(0);
    expect(rows[1].bodyweight).toBeNull();
  });

  test('вес тела: одна запись на дату, свежие сверху', async () => {
    await repo.addBodyweight('2026-09-28', 81);
    await repo.addBodyweight('2026-09-28', 80.6);
    await repo.addBodyweight('2026-10-05', 80.2);
    const list = await repo.bodyweights();
    expect(list.map((b) => [b.date, b.kg])).toEqual([['2026-10-05', 80.2], ['2026-09-28', 80.6]]);
    await repo.deleteBodyweight(list[0].id!);
    expect(await repo.bodyweights()).toHaveLength(1);
  });

  test('настройки по умолчанию и сохранение', async () => {
    const s = await repo.getSettings();
    expect(s.steps.dumbbell).toBe(2);
    expect(s.sound).toBe(true);
    await repo.saveSettings({ sound: false, steps: { ...s.steps, dumbbell: 1 } });
    const s2 = await repo.getSettings();
    expect(s2.sound).toBe(false);
    expect(s2.steps.dumbbell).toBe(1);
  });

  test('шаг из настроек влияет на подсказку', async () => {
    const s = await repo.getSettings();
    await repo.saveSettings({ steps: { ...s.steps, dumbbell: 1 } });
    await doWeek(20);
    const id = await repo.startSession('mon', tick(0));
    const { sets } = await repo.sessionBundle(id);
    expect(sets.find((x) => x.slotId === 'mon-1')!.weight).toBe(21);
  });
});
