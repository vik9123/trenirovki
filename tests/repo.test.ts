import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { beforeEach, describe, expect, test } from 'vitest';
import { db, resetDb } from '../src/data/db';
import * as repo from '../src/data/repo';
import { getSlot, type DayId } from '../src/program';

let clock = new Date(2026, 9, 20, 10).getTime(); // вт 20.10.2026
const tick = (days = 1) => new Date((clock += days * 86_400_000));

beforeEach(() => {
  resetDb(`test-${Math.random()}`);
  clock = new Date(2026, 9, 20, 10).getTime();
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
  for (const d of ['tue', 'thu', 'sat'] as DayId[]) await doDay(d, weight);
}

describe('цикл', () => {
  test('первый запуск создаёт цикл 1, неделя 1', async () => {
    const c = await repo.getActiveCycle();
    expect(c).toMatchObject({ number: 1, currentWeek: 1 });
    expect((await repo.getActiveCycle()).id).toBe(c.id);
  });

  test('вторник недели 1 — 21 подход с весом 0 и нижней границей', async () => {
    const id = await repo.startSession('tue', tick(0));
    const { sets, session } = await repo.sessionBundle(id);
    expect(session).toMatchObject({ week: 1, day: 'tue', date: '2026-10-20' });
    expect(sets).toHaveLength(21);
    expect(sets.every((s) => s.weight === 0 && !s.done)).toBe(true);
    expect(sets.filter((s) => s.slotId === 'f3-pullups').map((s) => s.value)).toEqual([6, 6, 6]);
    expect(repo.sessionSlots({ sets }).map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  test('повторный старт того же дня недели возвращает ту же тренировку', async () => {
    const a = await repo.startSession('tue', tick(0));
    expect(await repo.startSession('tue', tick(0))).toBe(a);
  });

  test('незавершённая тренировка находится через openSession', async () => {
    expect(await repo.openSession()).toBeUndefined();
    const id = await repo.startSession('thu', tick(0));
    expect((await repo.openSession())?.id).toBe(id);
  });

  test('после всех 3 дней неделя переключается сама', async () => {
    await doDay('tue', 20);
    await doDay('thu', 20);
    expect((await repo.getActiveCycle()).currentWeek).toBe(1);
    await doDay('sat', 20);
    expect((await repo.getActiveCycle()).currentWeek).toBe(2);
  });

  test('advanceWeek вручную и закрытие цикла после недели 8', async () => {
    const c = await repo.getActiveCycle();
    for (let i = 0; i < 7; i++) await repo.advanceWeek(c.id!);
    expect((await repo.getActiveCycle()).currentWeek).toBe(8);
    await repo.advanceWeek(c.id!);
    expect((await repo.getActiveCycle()).finishedAt).toBeTypeOf('number');
    await expect(repo.startSession('tue', tick(0))).rejects.toThrow();
  });

  test('новый цикл: номер 2, неделя 1 полного объёма, веса — последние рабочие', async () => {
    await doDay('tue', 24, (max) => max - 1);
    const c = await repo.getActiveCycle();
    for (let i = 0; i < 8; i++) await repo.advanceWeek(c.id!);
    expect(await repo.startNewCycle()).toMatchObject({ number: 2, currentWeek: 1 });
    const { sets } = await repo.sessionBundle(await repo.startSession('tue', tick(0)));
    expect(sets).toHaveLength(25);
    expect(sets.find((s) => s.slotId === 'f3-seated-press')!.weight).toBe(24);
  });
});

describe('подсказки из истории', () => {
  test('неделя 2: верх набран в калибровке → вес + шаг', async () => {
    await doWeek(20);
    const id = await repo.startSession('tue', tick(0));
    const press = (await repo.sessionBundle(id)).sets.filter((s) => s.slotId === 'f3-seated-press');
    expect(press.map((s) => s.weight)).toEqual([22, 22, 22, 22]); // гантели +2
    expect(press.map((s) => s.value)).toEqual([8, 8, 8, 8]);
    expect((await repo.suggestionFor(id, 'f3-seated-press')).hint).toBe('Верх набран → +2 кг');
  });

  test('разгрузка не используется как «прошлый раз»', async () => {
    const c = await repo.getActiveCycle();
    for (let i = 0; i < 6; i++) await repo.advanceWeek(c.id!); // неделя 7
    await doDay('tue', 30, (max) => max - 1);
    await repo.advanceWeek(c.id!); // неделя 8
    await doDay('tue', 10);
    const past = await repo.lastPast('f3-seated-press');
    expect(past?.week).toBe(7);
    expect(past?.past.sets[0].weight).toBe(30);
  });

  test('замена в четверг ведёт свою историю и запоминается', async () => {
    const id = await repo.startSession('thu', tick(0));
    await repo.swapExercise(id, 'f3-1arm-row', 'f3-1arm-row~sub');
    let { sets } = await repo.sessionBundle(id);
    const rows = sets.filter((s) => s.slotId === 'f3-1arm-row');
    expect(rows.every((s) => s.exerciseKey === 'f3-1arm-row~sub')).toBe(true);
    for (const s of rows) await repo.updateSet(s.id!, { weight: 25, value: 15, done: true });
    await repo.finishSession(id, { wellbeing: 4, back: 'ok', note: 'скамья занята' }, tick(0));
    expect(await repo.lastPast('f3-1arm-row')).toBeNull();
    expect((await repo.lastPast('f3-1arm-row~sub'))?.past.sets[0].weight).toBe(25);

    await repo.advanceWeek((await repo.getActiveCycle()).id!);
    ({ sets } = await repo.sessionBundle(await repo.startSession('thu', tick(1))));
    const next = sets.filter((s) => s.slotId === 'f3-1arm-row');
    expect(next[0].exerciseKey).toBe('f3-1arm-row~sub');
    expect(next[0].weight).toBe(30); // блок +5
  });

  test('вернуть основное упражнение после замены', async () => {
    const id = await repo.startSession('thu', tick(0));
    await repo.swapExercise(id, 'f3-cable-lat', 'f3-cable-lat~sub');
    await repo.swapExercise(id, 'f3-cable-lat', 'f3-cable-lat');
    const rows = (await repo.sessionBundle(id)).sets.filter((s) => s.slotId === 'f3-cable-lat');
    expect(rows.map((s) => s.exerciseKey)).toEqual(['f3-cable-lat', 'f3-cable-lat', 'f3-cable-lat']);
    await expect(repo.swapExercise(id, 'f3-reverse-fly', 'f3-reverse-fly~sub')).rejects.toThrow();
    await expect(repo.swapExercise(id, 'f3-cable-lat', 'f3-1arm-row~sub')).rejects.toThrow();
  });

  test('жим одной рукой: основное — тренажёр, две замены, у каждой своя история', async () => {
    const id = await repo.startSession('thu', tick(0));
    let rows = (await repo.sessionBundle(id)).sets.filter((s) => s.slotId === 'f3-1arm-press');
    expect(rows.map((s) => s.exerciseKey)).toEqual(['f3-1arm-machine-press', 'f3-1arm-machine-press', 'f3-1arm-machine-press']);
    await repo.swapExercise(id, 'f3-1arm-press', 'f3-1arm-press');
    rows = (await repo.sessionBundle(id)).sets.filter((s) => s.slotId === 'f3-1arm-press');
    expect(rows.every((s) => s.exerciseKey === 'f3-1arm-press')).toBe(true);
    for (const s of rows) await repo.updateSet(s.id!, { weight: 14, value: 12, done: true });
    await repo.swapExercise(id, 'f3-1arm-press', 'f3-1arm-press~sub');
    rows = (await repo.sessionBundle(id)).sets.filter((s) => s.slotId === 'f3-1arm-press');
    expect(rows.every((s) => s.exerciseKey === 'f3-1arm-press~sub' && s.weight === 0)).toBe(true);
  });

  test('записи жима гантели от прежней редакции остаются его историей', async () => {
    const cycle = await repo.getActiveCycle();
    const old = (await db.sessions.add({ cycleId: cycle.id!, week: 1, day: 'thu', date: '2026-10-15', startedAt: tick(0).getTime(), finishedAt: tick(0).getTime() })) as number;
    for (let i = 1; i <= 3; i++) {
      await db.sets.add({ sessionId: old, slotId: 'f3-1arm-press', exerciseKey: 'f3-1arm-press', index: i, weight: 14, value: 13, pain: false, done: true });
    }
    expect((await repo.sessionBundle(old)).sets.map((s) => getSlot(s.slotId).order)).toEqual([4, 4, 4]);
    expect(await repo.exerciseHistory('f3-1arm-press')).toEqual([{ date: '2026-10-15', top: 14, total: 39 }]);
    expect(await repo.lastPast('f3-1arm-machine-press')).toBeNull();
  });

  test('повторное завершение сохраняет самочувствие, не трогая время конца', async () => {
    const id = await repo.startSession('tue', tick(0));
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
    const id = await doDay('tue', 20);
    await repo.deleteSession(id);
    expect(await repo.allSessions()).toHaveLength(0);
    expect(await db.sets.count()).toBe(0);
  });

  test('история упражнения: рабочий вес и сумма повторений', async () => {
    await doDay('tue', 20);
    expect(await repo.exerciseHistory('f3-pullups')).toEqual([{ date: '2026-10-20', top: 20, total: 24 }]);
  });

  test('сводка по неделям: тоннаж по дням и средний вес тела', async () => {
    await repo.addBodyweight('2026-10-20', 81);
    await repo.addBodyweight('2026-10-22', 80);
    await doWeek(10);
    const rows = await repo.weeklySummary((await repo.getActiveCycle()).id!);
    expect(rows).toHaveLength(8);
    const w1 = rows[0];
    // Вт неделя 1: по 3 подхода, верх диапазона: 8 + 10 + 10 + 10 + 15 + 10 + 12
    expect(w1.byDay.tue).toBe(10 * 3 * (8 + 10 + 10 + 10 + 15 + 10 + 12));
    expect(w1.total).toBe(w1.byDay.tue + w1.byDay.thu + w1.byDay.sat);
    expect(w1.bodyweight).toBe(80.5);
    expect(rows[1]).toMatchObject({ total: 0, bodyweight: null });
  });

  test('вес тела: одна запись на дату, свежие сверху', async () => {
    await repo.addBodyweight('2026-10-20', 81);
    await repo.addBodyweight('2026-10-20', 80.6);
    await repo.addBodyweight('2026-10-27', 80.2);
    const list = await repo.bodyweights();
    expect(list.map((b) => [b.date, b.kg])).toEqual([['2026-10-27', 80.2], ['2026-10-20', 80.6]]);
    await repo.deleteBodyweight(list[0].id!);
    expect(await repo.bodyweights()).toHaveLength(1);
  });

  test('настройки по умолчанию и шаг из настроек в подсказке', async () => {
    const s = await repo.getSettings();
    expect(s).toMatchObject({ sound: true, steps: { dumbbell: 2 } });
    await repo.saveSettings({ sound: false, steps: { ...s.steps, dumbbell: 1 } });
    expect(await repo.getSettings()).toMatchObject({ sound: false, steps: { dumbbell: 1 } });
    await doWeek(20);
    const { sets } = await repo.sessionBundle(await repo.startSession('tue', tick(0)));
    expect(sets.find((x) => x.slotId === 'f3-seated-press')!.weight).toBe(21);
  });
});

describe('обновление базы', () => {
  test('версия 3: прежний журнал стирается, вес тела и настройки остаются', async () => {
    const name = `upgrade-${Math.random()}`;
    const v2 = new Dexie(name);
    v2.version(2).stores({
      cycles: '++id, number',
      sessions: '++id, cycleId, [cycleId+week], startedAt',
      sets: '++id, sessionId, exerciseKey, slotId',
      skips: '++id, sessionId',
      bodyweight: '++id, &date',
      settings: 'id',
    });
    await v2.table('cycles').add({ number: 1, startedAt: 1, currentWeek: 4 });
    await v2.table('sessions').add({ cycleId: 1, week: 3, day: 'old', date: '2026-10-09', startedAt: 1, finishedAt: 2 });
    await v2.table('sets').add({ sessionId: 1, slotId: 'old-1', exerciseKey: 'old-1', index: 1, weight: 50, value: 10, pain: false, done: true });
    await v2.table('skips').add({ sessionId: 1, slotId: 'old-2' });
    await v2.table('bodyweight').add({ date: '2026-10-10', kg: 80.4 });
    await v2.table('settings').put({ id: 'main', sound: false, steps: { barbell: 2.5, smith: 2.5, dumbbell: 1, machine: 5, added: 1.25 } });
    v2.close();

    resetDb(name);
    expect(await db.cycles.count()).toBe(0);
    expect(await db.sessions.count()).toBe(0);
    expect(await db.sets.count()).toBe(0);
    expect(db.tables.map((t) => t.name).sort()).toEqual(['bodyweight', 'cycles', 'sessions', 'sets', 'settings']);
    expect((await repo.bodyweights()).map((b) => b.kg)).toEqual([80.4]);
    expect(await repo.getSettings()).toMatchObject({ sound: false, steps: { dumbbell: 1 } });
    expect(await repo.getActiveCycle()).toMatchObject({ number: 1, currentWeek: 1 });
  });
});
