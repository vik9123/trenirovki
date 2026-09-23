import type { BodyweightRow, CycleRow, SessionRow, SetRow, SettingsRow, SkipRow } from '../data/db';
import { isoDate } from '../lib/format';

export const SCHEMA_VERSION = 1;

export interface Backup {
  app: 'trenirovki';
  schemaVersion: 1;
  exportedAt: string;
  cycles: CycleRow[];
  sessions: SessionRow[];
  sets: SetRow[];
  skips: SkipRow[];
  bodyweight: BodyweightRow[];
  settings: SettingsRow | null;
}

const TABLES = ['cycles', 'sessions', 'sets', 'skips', 'bodyweight'] as const;

export type ParseResult = { ok: true; backup: Backup; summary: string } | { ok: false; error: string };

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
  if (b.schemaVersion !== SCHEMA_VERSION) {
    return { ok: false, error: `Копия сделана более новой версией приложения (формат ${b.schemaVersion}) — обновите приложение` };
  }
  for (const t of TABLES) {
    if (!Array.isArray(b[t])) return { ok: false, error: `В копии не хватает раздела «${t}»` };
  }
  const backup = b as Backup;
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
