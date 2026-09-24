import { useState } from 'preact/hooks';
import * as repo from '../data/repo';
import { DAYS, RETIRED } from '../program';
import { formatDate, formatKg } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { LineChart, StackedBars } from '../ui/Chart';

const DAY_NAMES = DAYS.map((d) => d.short);

export function Progress() {
  const cycles = useAsync(async () => {
    const all = await repo.allCycles();
    return all.length ? all : [await repo.getActiveCycle()];
  });
  const [cycleId, setCycleId] = useState<number | null>(null);
  const current = cycleId ?? cycles.data?.[cycles.data.length - 1]?.id ?? null;
  const summary = useAsync(() => (current ? repo.weeklySummary(current) : Promise.resolve([])), [current]);

  const options = DAYS.flatMap((d) =>
    d.slots.flatMap((s) => [
      { key: s.exercise.key, label: `${d.short} · ${s.exercise.name}`, day: d.title },
      ...(s.substitute ? [{ key: s.substitute.key, label: `${d.short} · ${s.substitute.name}`, day: d.title }] : []),
    ]),
  );
  const [exKey, setExKey] = useState(options[0].key);
  const history = useAsync(() => repo.exerciseHistory(exKey), [exKey]);
  const isSec = exKey === 'tue-8';

  const rows = summary.data ?? [];
  const hasData = rows.some((r) => r.total > 0);

  return (
    <div class="screen">
      <h1>Прогресс</h1>

      {cycles.data && cycles.data.length > 1 && (
        <select value={String(current)} onChange={(e) => setCycleId(Number((e.target as HTMLSelectElement).value))} style="margin-bottom:12px">
          {cycles.data.map((c) => <option value={String(c.id)}>Цикл {c.number}</option>)}
        </select>
      )}

      <div class="card">
        <div class="spread" style="margin-bottom:8px">
          <b>Тоннаж по неделям, кг</b>
        </div>
        {hasData ? (
          <StackedBars rows={rows.map((r) => ({ label: String(r.week), values: DAYS.map((d) => r.byDay[d.id]) }))} series={DAY_NAMES} />
        ) : (
          <div class="empty">Пока нет данных — завершите первую тренировку</div>
        )}
        <p class="faint small" style="margin:10px 0 0">Тоннаж нужен, чтобы сравнивать недели между собой, а не как абсолютная цифра.</p>
      </div>

      <h2>Сводка</h2>
      <div class="card scroll-x" style="padding:8px 12px">
        <table class="table num">
          <thead>
            <tr><th>Нед.</th>{DAY_NAMES.map((d) => <th>{d}</th>)}<th>Итого</th><th>Вес тела</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr>
                <td>{r.week}</td>
                {DAYS.map((d) => <td>{r.byDay[d.id] ? formatKg(Math.round(r.byDay[d.id])) : '—'}</td>)}
                <td><b>{r.total ? formatKg(Math.round(r.total)) : '—'}</b></td>
                <td>{r.bodyweight ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Упражнение</h2>
      <select value={exKey} onChange={(e) => setExKey((e.target as HTMLSelectElement).value)}>
        {DAYS.map((d) => (
          <optgroup label={d.title}>
            {options.filter((o) => o.day === d.title).map((o) => <option value={o.key}>{o.label.split(' · ')[1]}</option>)}
          </optgroup>
        ))}
        <optgroup label="Прежние упражнения">
          {RETIRED.map((r) => <option value={r.exercise.key}>{r.exercise.name} (до {r.until.split('-').reverse().join('.')})</option>)}
        </optgroup>
      </select>
      <div class="card" style="margin-top:12px">
        <b>Рабочий вес, кг</b>
        {history.data && history.data.length ? (
          <>
            <LineChart
              unit="кг"
              points={history.data.map((h) => ({
                label: h.date.slice(8, 10) + '.' + h.date.slice(5, 7),
                value: h.top,
                note: `${formatDate(h.date)}: ${formatKg(h.top)} кг, всего ${h.total} ${isSec ? 'с' : 'повт.'}`,
              }))}
            />
            <table class="table num" style="margin-top:12px">
              <thead><tr><th>Дата</th><th>Вес, кг</th><th>{isSec ? 'Секунд' : 'Повторений'}</th></tr></thead>
              <tbody>
                {history.data.slice(-8).reverse().map((h) => (
                  <tr><td>{formatDate(h.date)}</td><td>{formatKg(h.top)}</td><td>{h.total}</td></tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <div class="empty">Это упражнение ещё не делали</div>
        )}
      </div>
    </div>
  );
}
