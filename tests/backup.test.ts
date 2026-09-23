import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, test } from 'vitest';
import { db, resetDb } from '../src/data/db';
import * as repo from '../src/data/repo';
import { backupFileName, parseBackup } from '../src/logic/backup';

beforeEach(() => resetDb(`backup-${Math.random()}`));

async function snapshot() {
  return {
    cycles: await db.cycles.toArray(),
    sessions: await db.sessions.toArray(),
    sets: await db.sets.toArray(),
    skips: await db.skips.toArray(),
    bodyweight: await db.bodyweight.toArray(),
    settings: await db.settings.toArray(),
  };
}

describe('резервная копия', () => {
  test('экспорт → JSON → импорт в чистую базу даёт те же данные', async () => {
    const id = await repo.startSession('tue', new Date(2026, 8, 29, 9));
    await repo.setSkipped(id, 'tue-8', true);
    const { sets } = await repo.sessionBundle(id);
    await repo.updateSet(sets[0].id!, { weight: 40, value: 15, rir: 2, pain: true, done: true });
    await repo.finishSession(id, { wellbeing: 5, back: 'ok', note: 'хорошо' }, new Date(2026, 8, 29, 10));
    await repo.addBodyweight('2026-09-29', 81.2);
    await repo.saveSettings({ sound: false });
    const before = await snapshot();

    const text = JSON.stringify(await repo.exportBackup(new Date(2026, 8, 29, 11)));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary).toBe('Тренировок: 1, подходов: 21, записей веса тела: 1. Период: 2026-09-29 — 2026-09-29.');

    resetDb(`restore-${Math.random()}`);
    await repo.startSession('mon'); // мусор, который должен исчезнуть
    await repo.importBackup(parsed.backup);
    expect(await snapshot()).toEqual(before);
  });

  test.each([
    ['не JSON', 'Файл повреждён: это не JSON'],
    ['{"app":"other","schemaVersion":1}', 'Это не резервная копия журнала тренировок'],
    ['{"app":"trenirovki","schemaVersion":2}', 'Копия сделана более новой версией приложения (формат 2) — обновите приложение'],
    ['{"app":"trenirovki","schemaVersion":1,"cycles":[]}', 'В копии не хватает раздела «sessions»'],
  ])('ошибка: %s', (text, error) => {
    expect(parseBackup(text)).toEqual({ ok: false, error });
  });

  test('имя файла', () => {
    expect(backupFileName(new Date(2026, 8, 3))).toBe('trenirovki-backup-2026-09-03.json');
  });
});
