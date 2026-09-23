import Dexie, { type EntityTable } from 'dexie';
import type { DayId } from '../program';
import type { Steps } from '../logic/progression';

export type Back = 'ok' | 'ache' | 'pain';

export interface CycleRow {
  id?: number;
  number: number;
  startedAt: number;
  currentWeek: number;
  finishedAt?: number;
}

export interface SessionRow {
  id?: number;
  cycleId: number;
  week: number;
  day: DayId;
  /** Локальная дата ГГГГ-ММ-ДД. */
  date: string;
  startedAt: number;
  finishedAt?: number;
  wellbeing?: number;
  back?: Back;
  note?: string;
}

export interface SetRow {
  id?: number;
  sessionId: number;
  slotId: string;
  /** Ключ упражнения: id слота или ключ замены. */
  exerciseKey: string;
  index: number;
  weight: number;
  /** Повторения или секунды. */
  value: number;
  /** Запас повторений: 0, 1, 2, 3 (= «3+»). */
  rir?: number;
  pain: boolean;
  done: boolean;
}

export interface SkipRow {
  id?: number;
  sessionId: number;
  slotId: string;
}

export interface BodyweightRow {
  id?: number;
  date: string;
  kg: number;
}

export interface SettingsRow {
  id: 'main';
  steps: Steps;
  sound: boolean;
  lastBackupAt?: number;
}

export class JournalDB extends Dexie {
  cycles!: EntityTable<CycleRow, 'id'>;
  sessions!: EntityTable<SessionRow, 'id'>;
  sets!: EntityTable<SetRow, 'id'>;
  skips!: EntityTable<SkipRow, 'id'>;
  bodyweight!: EntityTable<BodyweightRow, 'id'>;
  settings!: EntityTable<SettingsRow, 'id'>;

  constructor(name = 'trenirovki') {
    super(name);
    this.version(1).stores({
      cycles: '++id, number',
      sessions: '++id, cycleId, [cycleId+week], startedAt',
      sets: '++id, sessionId, exerciseKey, slotId',
      skips: '++id, sessionId',
      bodyweight: '++id, &date',
      settings: 'id',
    });
  }
}

export let db = new JournalDB();

/** Для тестов: переключиться на чистую базу с другим именем. */
export function resetDb(name?: string): void {
  db.close();
  db = new JournalDB(name);
}
