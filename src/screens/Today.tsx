import { useState } from 'preact/hooks';
import * as repo from '../data/repo';
import { DAYS, getDay, type DayId } from '../program';
import { plannedSets, suggestDay, weekLabel, WEEKS } from '../logic/cycle';
import { formatKg, plural } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { go } from '../router';

const BACKUP_EVERY_MS = 7 * 86_400_000;
const SETS: [string, string, string] = ['подход', 'подхода', 'подходов'];

async function load() {
  const cycle = await repo.getActiveCycle();
  const sessions = await repo.weekSessions(cycle.id!, cycle.currentWeek);
  const tonnages = new Map<number, number>();
  for (const s of sessions) tonnages.set(s.id!, await repo.sessionTonnage(s.id!));
  const open = await repo.openSession();
  const settings = await repo.getSettings();
  const anySessions = (await repo.allSessions()).length > 0;
  return { cycle, sessions, tonnages, open, settings, anySessions };
}

export function Today() {
  const { data, error, reload } = useAsync(load);
  const [busy, setBusy] = useState(false);
  if (error) return <div class="screen"><p class="empty">Ошибка: {error}</p></div>;
  if (!data) return <div class="screen" />;
  const { cycle, sessions, tonnages, open, settings, anySessions } = data;

  const label = weekLabel(cycle.currentWeek, cycle.number);
  const byDay = new Map(sessions.map((s) => [s.day, s]));
  const doneDays = sessions.filter((s) => s.finishedAt).map((s) => s.day);
  const next = suggestDay(doneDays, new Date().getDay());
  const needBackup = anySessions && (!settings.lastBackupAt || Date.now() - settings.lastBackupAt > BACKUP_EVERY_MS);

  async function begin(day: DayId) {
    if (busy) return;
    setBusy(true);
    try {
      go(`/w/${await repo.startSession(day)}`);
    } finally {
      setBusy(false);
    }
  }

  async function skipWeek() {
    const left = DAYS.length - doneDays.length;
    const msg = cycle.currentWeek === WEEKS
      ? 'Завершить цикл? Несделанные тренировки этой недели останутся пустыми.'
      : `Перейти к неделе ${cycle.currentWeek + 1}? Не сделано тренировок: ${left}.`;
    if (!confirm(msg)) return;
    await repo.advanceWeek(cycle.id!);
    reload();
  }

  async function newCycle() {
    await repo.startNewCycle();
    reload();
  }

  const setsFor = (day: DayId) => {
    const d = getDay(day);
    return d.slots.reduce((n, s) => n + plannedSets(d, s, cycle.currentWeek, cycle.number), 0);
  };

  return (
    <div class="screen">
      {needBackup && (
        <div class="banner">
          <span>{settings.lastBackupAt ? 'Резервной копии больше недели' : 'Резервной копии ещё нет'}</span>
          <a href="#/more">Сделать</a>
        </div>
      )}

      <div class="card">
        <div class="spread">
          <div>
            <div class="muted small">Цикл {cycle.number}</div>
            <div style="font-size:24px;font-weight:800">Неделя {cycle.currentWeek} из {WEEKS}</div>
          </div>
          {label && <span class="chip accent">{label}</span>}
        </div>
        <div class="weekbar" aria-hidden="true">
          {Array.from({ length: WEEKS }, (_, i) => (
            <i class={i + 1 < cycle.currentWeek || cycle.finishedAt ? 'past' : i + 1 === cycle.currentWeek ? 'now' : ''} />
          ))}
        </div>
        {label === 'калибровка' && (
          <p class="muted small" style="margin:12px 0 0">Задача недели — записать рабочие веса, а не показать результат. Везде, где 4 подхода, делайте 3.</p>
        )}
        {label === 'разгрузка' && (
          <p class="muted small" style="margin:12px 0 0">Подходов вдвое меньше, веса те же.</p>
        )}
      </div>

      {cycle.finishedAt ? (
        <div class="card stack" style="margin-top:14px">
          <div style="font-size:20px;font-weight:700">Цикл {cycle.number} завершён</div>
          <p class="muted" style="margin:6px 0 0">Новый цикл начнётся с последних рабочих весов, без калибровки.</p>
          <button class="btn primary big block" onClick={newCycle}>Начать цикл {cycle.number + 1}</button>
        </div>
      ) : (
        <div style="margin-top:14px">
          {open ? (
            <a class="btn primary big block" href={`#/w/${open.id}`}>Продолжить: {getDay(open.day).title}</a>
          ) : next ? (
            <button class="btn primary big block" disabled={busy} onClick={() => begin(next)}>
              <span style="display:flex;flex-direction:column;line-height:1.2">
                <span>Начать: {getDay(next).title}</span>
                <span style="font-size:13px;font-weight:600;opacity:.75">
                  {plural(getDay(next).slots.length, ['упражнение', 'упражнения', 'упражнений'])} · {plural(setsFor(next), SETS)}
                </span>
              </span>
            </button>
          ) : null}
        </div>
      )}

      <h2>Эта неделя</h2>
      <div class="days">
        {DAYS.map((d) => {
          const s = byDay.get(d.id);
          const state = s?.finishedAt ? 'done' : s ? 'progress' : '';
          const status = s?.finishedAt
            ? `✓ ${formatKg(tonnages.get(s.id!) ?? 0)} кг`
            : s
              ? 'Идёт'
              : cycle.finishedAt
                ? '—'
                : plural(setsFor(d.id), SETS);
          return (
            <button
              class={`day ${state}`}
              disabled={!s && !!cycle.finishedAt}
              onClick={() => (s ? go(`/w/${s.id}`) : begin(d.id))}
            >
              <div class="spread">
                <b>{d.short}</b>
                <span class={`chip ${d.kind}`}>{d.kind === 'heavy' ? 'тяжёлый' : 'лёгкий'}</span>
              </div>
              <div>
                <div class="small">{d.title.split('— ')[1].split(',')[0]}</div>
                <div class="status num">{status}</div>
              </div>
            </button>
          );
        })}
      </div>

      {!cycle.finishedAt && (
        <button class="link" style="margin-top:14px" onClick={skipWeek}>
          {cycle.currentWeek === WEEKS ? 'Завершить цикл' : 'Перейти к следующей неделе'}
        </button>
      )}
    </div>
  );
}
