import { db, type Back, type BodyweightRow, type CycleRow, type SessionRow, type SetRow, type SettingsRow, type SkipRow } from './db';
import { DAYS, exerciseByKey, getDay, getSlot, isCurrentKey, type DayId } from '../program';
import { isDeload, plannedSets, WEEKS } from '../logic/cycle';
import { DEFAULT_STEPS, suggest, type Past, type Suggestion } from '../logic/progression';
import { tonnage } from '../logic/tonnage';
import { isoDate } from '../lib/format';
import { SCHEMA_VERSION, type Backup } from '../logic/backup';

// ---------- настройки ----------

export async function getSettings(): Promise<SettingsRow> {
  const s = await db.settings.get('main');
  return { id: 'main', sound: true, ...s, steps: { ...DEFAULT_STEPS, ...s?.steps } };
}

export async function saveSettings(patch: Partial<Omit<SettingsRow, 'id'>>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...patch, id: 'main' });
}

// ---------- циклы ----------

/** Последний цикл; при первом запуске создаёт цикл 1. */
export async function getActiveCycle(): Promise<CycleRow> {
  const last = await db.cycles.orderBy('number').last();
  if (last) return last;
  const cycle: CycleRow = { number: 1, startedAt: Date.now(), currentWeek: 1 };
  cycle.id = await db.cycles.add(cycle);
  return cycle;
}

export async function allCycles(): Promise<CycleRow[]> {
  return db.cycles.orderBy('number').toArray();
}

export async function advanceWeek(cycleId: number, now = new Date()): Promise<void> {
  const c = await db.cycles.get(cycleId);
  if (!c || c.finishedAt) return;
  if (c.currentWeek < WEEKS) await db.cycles.update(cycleId, { currentWeek: c.currentWeek + 1 });
  else await db.cycles.update(cycleId, { finishedAt: now.getTime() });
}

export async function startNewCycle(now = new Date()): Promise<CycleRow> {
  const last = await db.cycles.orderBy('number').last();
  const cycle: CycleRow = { number: (last?.number ?? 0) + 1, startedAt: now.getTime(), currentWeek: 1 };
  cycle.id = await db.cycles.add(cycle);
  return cycle;
}

// ---------- тренировки ----------

export async function weekSessions(cycleId: number, week: number): Promise<SessionRow[]> {
  return db.sessions.where({ cycleId, week }).toArray();
}

/** Незавершённая тренировка, если есть. */
export async function openSession(): Promise<SessionRow | undefined> {
  const all = await db.sessions.orderBy('startedAt').reverse().toArray();
  return all.find((s) => !s.finishedAt);
}

export async function allSessions(): Promise<SessionRow[]> {
  return db.sessions.orderBy('startedAt').reverse().toArray();
}

export async function sessionBundle(id: number) {
  const session = await db.sessions.get(id);
  if (!session) throw new Error('Тренировка не найдена');
  const cycle = (await db.cycles.get(session.cycleId))!;
  const sets = (await db.sets.where({ sessionId: id }).toArray()).sort(bySlotThenIndex);
  const skips = await db.skips.where({ sessionId: id }).toArray();
  return { session, cycle, sets, skips };
}

function bySlotThenIndex(a: SetRow, b: SetRow) {
  const sa = getSlot(a.slotId).order;
  const sb = getSlot(b.slotId).order;
  return sa - sb || a.index - b.index;
}

/**
 * Завершённые тренировки с упражнением, раньше данной (если указана), по возрастанию времени.
 * includeDeload — учитывать ли неделю разгрузки.
 */
async function pastSessions(exerciseKey: string, beforeSessionId: number | undefined, includeDeload: boolean) {
  const rows = await db.sets.where({ exerciseKey }).toArray();
  if (!rows.length) return { rows, sessions: [] as SessionRow[] };
  const before = beforeSessionId ? await db.sessions.get(beforeSessionId) : undefined;
  const ids = [...new Set(rows.map((r) => r.sessionId))];
  const sessions = (await db.sessions.bulkGet(ids))
    .filter(
      (s): s is SessionRow =>
        !!s && !!s.finishedAt && (includeDeload || !isDeload(s.week)) && s.id !== beforeSessionId && (!before || s.startedAt < before.startedAt),
    )
    .sort((a, b) => a.startedAt - b.startedAt);
  return { rows, sessions };
}

/**
 * Прошлый раз для упражнения: последняя завершённая тренировка с ним,
 * кроме недели разгрузки. before — считать «прошлым» только то, что было раньше этой тренировки.
 */
export async function lastPast(exerciseKey: string, beforeSessionId?: number): Promise<{ past: Past; week: number } | null> {
  const { rows, sessions } = await pastSessions(exerciseKey, beforeSessionId, false);
  const last = sessions[sessions.length - 1];
  if (!last) return null;
  const sets = rows
    .filter((r) => r.sessionId === last.id)
    .sort((a, b) => a.index - b.index)
    .map(({ weight, value, done, pain }) => ({ weight, value, done, pain }));
  return { past: { sets }, week: last.week };
}

/**
 * Какое упражнение слота делали в последний раз: основное или замену.
 * Упражнения, убранные из программы, не возвращаются — берётся основное.
 */
async function lastKeyForSlot(slotId: string): Promise<string> {
  const slot = getSlot(slotId);
  const rows = (await db.sets.where({ slotId }).toArray()).filter((r) => isCurrentKey(slot, r.exerciseKey));
  if (!rows.length) return slot.exercise.key;
  const sessions = new Map(
    (await db.sessions.bulkGet([...new Set(rows.map((r) => r.sessionId))]))
      .filter((s): s is SessionRow => !!s?.finishedAt)
      .map((s) => [s.id!, s]),
  );
  let best: { key: string; at: number } | null = null;
  for (const r of rows) {
    const s = sessions.get(r.sessionId);
    if (s && (!best || s.startedAt > best.at)) best = { key: r.exerciseKey, at: s.startedAt };
  }
  return best?.key ?? slot.exercise.key;
}

async function suggestion(session: SessionRow, cycle: CycleRow, slotId: string, exerciseKey: string): Promise<Suggestion> {
  const day = getDay(session.day);
  const slot = getSlot(slotId);
  const { exercise } = exerciseByKey(exerciseKey);
  const settings = await getSettings();
  const last = await lastPast(exerciseKey, session.id);
  const intro = exercise.bodyweightFirst
    ? (await pastSessions(exerciseKey, session.id, true)).sessions.length < exercise.bodyweightFirst
    : false;
  return suggest({
    slot,
    kind: day.kind,
    equipment: exercise.equipment,
    count: plannedSets(day, slot, session.week, cycle.number),
    past: last?.past ?? null,
    deload: isDeload(session.week),
    steps: settings.steps,
    bodyweightOnly: intro,
  });
}

async function createSlotRows(session: SessionRow, cycle: CycleRow, slotId: string, exerciseKey: string) {
  const s = await suggestion(session, cycle, slotId, exerciseKey);
  await db.sets.bulkAdd(
    s.values.map((value, i) => ({
      sessionId: session.id!,
      slotId,
      exerciseKey,
      index: i + 1,
      weight: s.weight,
      value,
      pain: false,
      done: false,
    })),
  );
}

/** Начать тренировку дня в текущей неделе. Если она уже есть — вернуть её. */
export async function startSession(dayId: DayId, now = new Date()): Promise<number> {
  const cycle = await getActiveCycle();
  if (cycle.finishedAt) throw new Error('Цикл завершён — начните новый');
  const existing = (await weekSessions(cycle.id!, cycle.currentWeek)).find((s) => s.day === dayId);
  if (existing) return existing.id!;

  const session: SessionRow = {
    cycleId: cycle.id!,
    week: cycle.currentWeek,
    day: dayId,
    date: isoDate(now),
    startedAt: now.getTime(),
  };
  const id = (await db.sessions.add(session)) as number;
  session.id = id;
  for (const slot of getDay(dayId).slots) {
    await createSlotRows(session, cycle, slot.id, await lastKeyForSlot(slot.id));
  }
  return id;
}

/**
 * Незавершённая тренировка, начатая по прежней программе: упражнения, убранные из программы
 * и ещё не начатые (ни одного отмеченного подхода), заменяются действующими.
 */
export async function refreshRetired(sessionId: number): Promise<boolean> {
  const { session, sets } = await sessionBundle(sessionId);
  if (session.finishedAt) return false;
  let changed = false;
  for (const slot of getDay(session.day).slots) {
    const rows = sets.filter((r) => r.slotId === slot.id);
    if (rows.length && !rows.some((r) => r.done) && exerciseByKey(rows[0].exerciseKey).retired) {
      await replaceSlotRows(sessionId, slot.id, slot.exercise.key);
      changed = true;
    }
  }
  return changed;
}

export async function suggestionFor(sessionId: number, slotId: string): Promise<Suggestion> {
  const { session, cycle, sets } = await sessionBundle(sessionId);
  const key = sets.find((s) => s.slotId === slotId)?.exerciseKey ?? getSlot(slotId).exercise.key;
  return suggestion(session, cycle, slotId, key);
}

export async function updateSet(id: number, patch: Partial<SetRow>): Promise<void> {
  await db.sets.update(id, patch);
}

async function replaceSlotRows(sessionId: number, slotId: string, exerciseKey: string | null) {
  const { session, cycle } = await sessionBundle(sessionId);
  await db.sets.where({ sessionId }).filter((s) => s.slotId === slotId).delete();
  if (exerciseKey) await createSlotRows(session, cycle, slotId, exerciseKey);
}

/** Переключить слот на замену из документа или обратно. Подходы слота создаются заново. */
export async function swapExercise(sessionId: number, slotId: string, useSubstitute: boolean): Promise<void> {
  const slot = getSlot(slotId);
  if (useSubstitute && !slot.substitute) throw new Error('У упражнения нет замены');
  await replaceSlotRows(sessionId, slotId, useSubstitute ? slot.substitute!.key : slot.exercise.key);
}

export async function setSkipped(sessionId: number, slotId: string, skipped: boolean): Promise<void> {
  const existing = await db.skips.where({ sessionId }).filter((s) => s.slotId === slotId).toArray();
  if (skipped) {
    await replaceSlotRows(sessionId, slotId, null);
    if (!existing.length) await db.skips.add({ sessionId, slotId });
  } else {
    await db.skips.bulkDelete(existing.map((s) => s.id!));
    await replaceSlotRows(sessionId, slotId, await lastKeyForSlot(slotId));
  }
}

export interface Feel {
  wellbeing: number;
  back: Back;
  note: string;
}

/** Завершить (или пересохранить) тренировку. Когда сделаны все 4 дня недели — неделя переключается. */
export async function finishSession(id: number, feel: Feel, now = new Date()): Promise<void> {
  const session = await db.sessions.get(id);
  if (!session) throw new Error('Тренировка не найдена');
  await db.sessions.update(id, { ...feel, finishedAt: session.finishedAt ?? now.getTime() });
  if (session.finishedAt) return;

  const cycle = await db.cycles.get(session.cycleId);
  if (!cycle || cycle.finishedAt || cycle.currentWeek !== session.week) return;
  const done = new Set((await weekSessions(cycle.id!, session.week)).filter((s) => s.finishedAt).map((s) => s.day));
  if (DAYS.every((d) => done.has(d.id))) await advanceWeek(cycle.id!, now);
}

export async function deleteSession(id: number): Promise<void> {
  await db.transaction('rw', db.sessions, db.sets, db.skips, async () => {
    await db.sets.where({ sessionId: id }).delete();
    await db.skips.where({ sessionId: id }).delete();
    await db.sessions.delete(id);
  });
}

export async function sessionTonnage(id: number): Promise<number> {
  return tonnage(await db.sets.where({ sessionId: id }).toArray());
}

// ---------- вес тела ----------

export async function addBodyweight(date: string, kg: number): Promise<void> {
  const existing = await db.bodyweight.where({ date }).first();
  if (existing) await db.bodyweight.update(existing.id!, { kg });
  else await db.bodyweight.add({ date, kg });
}

export async function bodyweights(): Promise<BodyweightRow[]> {
  return db.bodyweight.orderBy('date').reverse().toArray();
}

export async function deleteBodyweight(id: number): Promise<void> {
  await db.bodyweight.delete(id);
}

// ---------- прогресс ----------

/** По каждой завершённой тренировке с упражнением: рабочий вес и сумма повторений (секунд). */
export async function exerciseHistory(exerciseKey: string): Promise<{ date: string; top: number; total: number }[]> {
  const rows = (await db.sets.where({ exerciseKey }).toArray()).filter((r) => r.done);
  const bySession = new Map<number, SetRow[]>();
  for (const r of rows) bySession.set(r.sessionId, [...(bySession.get(r.sessionId) ?? []), r]);
  const sessions = (await db.sessions.bulkGet([...bySession.keys()])).filter((s): s is SessionRow => !!s?.finishedAt);
  return sessions
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => {
      const list = bySession.get(s.id!)!;
      return {
        date: s.date,
        top: Math.max(...list.map((r) => r.weight)),
        total: list.reduce((n, r) => n + r.value, 0),
      };
    });
}

export interface WeekSummary {
  week: number;
  byDay: Record<DayId, number>;
  total: number;
  bodyweight: number | null;
}

/**
 * Сводка как лист «Сводка» в Excel. Вес тела недели — среднее по записям
 * от первой тренировки этой недели до первой тренировки следующей.
 */
export async function weeklySummary(cycleId: number): Promise<WeekSummary[]> {
  const sessions = await db.sessions.where({ cycleId }).toArray();
  const weights = await db.bodyweight.toArray();
  const firstDate = (w: number) =>
    sessions.filter((s) => s.week === w).map((s) => s.date).sort()[0] as string | undefined;

  const result: WeekSummary[] = [];
  for (let week = 1; week <= WEEKS; week++) {
    const byDay: Record<DayId, number> = { mon: 0, tue: 0, thu: 0, fri: 0 };
    for (const s of sessions.filter((x) => x.week === week)) {
      byDay[s.day] += await sessionTonnage(s.id!);
    }
    const start = firstDate(week);
    let bodyweight: number | null = null;
    if (start) {
      let end: string | undefined;
      for (let w = week + 1; w <= WEEKS && !end; w++) end = firstDate(w);
      const inRange = weights.filter((b) => b.date >= start && (!end || b.date < end));
      if (inRange.length) bodyweight = Math.round((inRange.reduce((n, b) => n + b.kg, 0) / inRange.length) * 10) / 10;
    }
    const total = Math.round((byDay.mon + byDay.tue + byDay.thu + byDay.fri) * 100) / 100;
    result.push({ week, byDay, total, bodyweight });
  }
  return result;
}

export type { CycleRow, SessionRow, SetRow, SkipRow, BodyweightRow, SettingsRow };

// ---------- резервная копия ----------

export async function exportBackup(now = new Date()): Promise<Backup> {
  return {
    app: 'trenirovki',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    cycles: await db.cycles.toArray(),
    sessions: await db.sessions.toArray(),
    sets: await db.sets.toArray(),
    skips: await db.skips.toArray(),
    bodyweight: await db.bodyweight.toArray(),
    settings: (await db.settings.get('main')) ?? null,
  };
}

/** Заменяет все данные содержимым копии. */
export async function importBackup(b: Backup): Promise<void> {
  const tables = [db.cycles, db.sessions, db.sets, db.skips, db.bodyweight, db.settings];
  await db.transaction('rw', tables, async () => {
    for (const t of tables) await t.clear();
    await db.cycles.bulkAdd(b.cycles);
    await db.sessions.bulkAdd(b.sessions);
    await db.sets.bulkAdd(b.sets);
    await db.skips.bulkAdd(b.skips);
    await db.bodyweight.bulkAdd(b.bodyweight);
    if (b.settings) await db.settings.put(b.settings);
  });
}
