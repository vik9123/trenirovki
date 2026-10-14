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
    bodyweight: await db.bodyweight.toArray(),
    settings: await db.settings.toArray(),
  };
}

describe('резервная копия', () => {
  test('экспорт → JSON → импорт в чистую базу даёт те же данные', async () => {
    const id = await repo.startSession('thu', new Date(2026, 9, 22, 9));
    await repo.swapExercise(id, 'f3-1arm-press', true);
    const { sets } = await repo.sessionBundle(id);
    await repo.updateSet(sets[0].id!, { weight: 10, value: 12, rir: 2, pain: true, done: true });
    await repo.finishSession(id, { wellbeing: 5, back: 'ok', note: 'хорошо' }, new Date(2026, 9, 22, 10));
    await repo.addBodyweight('2026-10-22', 81.2);
    await repo.saveSettings({ sound: false });
    const before = await snapshot();

    const text = JSON.stringify(await repo.exportBackup(new Date(2026, 9, 22, 11)));
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.summary).toBe('Тренировок: 1, подходов: 21, записей веса тела: 1. Период: 2026-10-22 — 2026-10-22.');

    resetDb(`restore-${Math.random()}`);
    await repo.startSession('tue'); // мусор, который должен исчезнуть
    await repo.importBackup(parsed.backup);
    expect(await snapshot()).toEqual(before);
  });

  test.each([
    ['не JSON', 'Файл повреждён: это не JSON'],
    ['{"app":"other","schemaVersion":2}', 'Это не резервная копия журнала тренировок'],
    ['{"app":"trenirovki","schemaVersion":1,"cycles":[]}', 'Копия от прежней программы тренировок — восстановить её нельзя'],
    ['{"app":"trenirovki","schemaVersion":3}', 'Копия сделана более новой версией приложения (формат 3) — обновите приложение'],
    ['{"app":"trenirovki","schemaVersion":2,"cycles":[]}', 'В копии не хватает раздела «sessions»'],
    [
      '{"app":"trenirovki","schemaVersion":2,"cycles":[],"sessions":[],"bodyweight":[],"sets":[{"exerciseKey":"old-1"}]}',
      'В копии упражнения, которых нет в программе, — восстановить её нельзя',
    ],
  ])('ошибка: %s', (text, error) => {
    expect(parseBackup(text)).toEqual({ ok: false, error });
  });

  test('имя файла', () => {
    expect(backupFileName(new Date(2026, 9, 3))).toBe('trenirovki-backup-2026-10-03.json');
  });
});
