import * as repo from '../data/repo';
import { getDay } from '../program';
import { formatDate, formatDuration, formatKg } from '../lib/format';
import { useAsync } from '../lib/useAsync';

const BACK = { ok: 'поясница ок', ache: 'поясница ноет', pain: 'поясница болит' } as const;

async function load() {
  const sessions = await repo.allSessions();
  const cycles = new Map((await repo.allCycles()).map((c) => [c.id!, c.number]));
  return Promise.all(sessions.map(async (s) => ({ s, cycle: cycles.get(s.cycleId), t: await repo.sessionTonnage(s.id!) })));
}

export function History() {
  const { data } = useAsync(load);
  return (
    <div class="screen">
      <h1>История</h1>
      {data && !data.length && <div class="empty">Тренировок пока нет</div>}
      {data?.map(({ s, cycle, t }) => (
        <a class="list-item" href={`#/w/${s.id}`} style="display:block;margin-bottom:10px">
          <div class="card">
            <div class="spread">
              <b>{formatDate(s.date)} · {getDay(s.day).short}</b>
              <span class={`chip ${s.finishedAt ? getDay(s.day).kind : 'accent'}`}>{s.finishedAt ? getDay(s.day).title.split('— ')[1] : 'не завершена'}</span>
            </div>
            <div class="muted small num" style="margin-top:6px">
              Цикл {cycle} · неделя {s.week} · {formatKg(t)} кг
              {s.finishedAt ? ` · ${formatDuration(s.finishedAt - s.startedAt)}` : ''}
            </div>
            {s.finishedAt && s.wellbeing && (
              <div class="small" style="margin-top:4px">
                Самочувствие {s.wellbeing}/5{s.back ? ` · ${BACK[s.back]}` : ''}
                {s.note ? <span class="muted"> · {s.note}</span> : null}
              </div>
            )}
          </div>
        </a>
      ))}
    </div>
  );
}
