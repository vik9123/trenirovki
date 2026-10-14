import type { BodyweightRow, CycleRow, SessionRow, SetRow, SettingsRow } from '../data/db';
import { isoDate } from '../lib/format';
import { getDay, isKnownKey, type DayId } from '../program';

export const SCHEMA_VERSION = 2;

export interface Backup {
  app: 'trenirovki';
  schemaVersion: 2;
  exportedAt: string;
  cycles: CycleRow[];
  sessions: SessionRow[];
  sets: SetRow[];
  bodyweight: BodyweightRow[];
  settings: SettingsRow | null;
}

const TABLES = ['cycles', 'sessions', 'sets', 'bodyweight'] as const;

export type ParseResult = { ok: true; backup: Backup; summary: string } | { ok: false; error: string };

function knownDay(d: DayId): boolean {
  try {
    getDay(d);
    return true;
  } catch {
    return false;
  }
}

export function parseBackup(text: string): ParseResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: 'Файл повреждён: это не JSON' };
  }
  const b = data as Partial<Backup> & Record<string, unknown>;
  if (!b || typeof b !== 'object' || b.app !== 'trenirovki') {
    return { ok: false, error: 'Это не резервная копия журнала тренировок' };
  }
  if (typeof b.schemaVersion === 'number' && b.schemaVersion < SCHEMA_VERSION) {
    return { ok: false, error: 'Копия от прежней программы тренировок — восстановить её нельзя' };
  }
  if (b.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, error: `Копия сделана более новой версией приложения (формат ${b.schemaVersion}) — обновите приложение` };
  }
  for (const t of TABLES) {
    if (!Array.isArray(b[t])) return { ok: false, error: `В копии не хватает раздела «${t}»` };
  }
  const backup = b as Backup;
  if (!backup.sets.every((s) => isKnownKey(s.exerciseKey)) || !backup.sessions.every((s) => knownDay(s.day))) {
    return { ok: false, error: 'В копии упражнения, которых нет в программе, — восстановить её нельзя' };
  }
  const dates = backup.sessions.map((s) => s.date).sort();
  const period = dates.length ? ` Период: ${dates[0]} — ${dates[dates.length - 1]}.` : '';
  const summary =
    `Тренировок: ${backup.sessions.length}, подходов: ${backup.sets.length}, ` +
    `записей веса тела: ${backup.bodyweight.length}.${period}`;
  return { ok: true, backup, summary };
}

export function backupFileName(d: Date): string {
  return `trenirovki-backup-${isoDate(d)}.json`;
}
