import { useEffect, useState } from 'preact/hooks';
import * as repo from '../data/repo';
import type { Back, SetRow } from '../data/db';
import { exerciseByKey, getDay, TRANSITION_REST_SEC, type Slot } from '../program';
import { plannedSets, weekLabel } from '../logic/cycle';
import type { Past, Suggestion } from '../logic/progression';
import { tonnage } from '../logic/tonnage';
import { formatDate, formatKg } from '../lib/format';
import { readLocal, writeLocal } from '../lib/storage';
import { unlockAudio } from '../lib/sound';
import { useAsync } from '../lib/useAsync';
import { useWakeLock } from '../lib/wakelock';
import { go } from '../router';
import { IconBack, IconCheck, IconList, IconMenu, IconNext } from '../ui/icons';
import { Clock } from '../ui/Clock';
import { RestBar, type Rest } from '../ui/RestBar';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';

type Bundle = Awaited<ReturnType<typeof repo.sessionBundle>>;

async function load(id: number) {
  await repo.refreshRetired(id);
  const [bundle, settings] = await Promise.all([repo.sessionBundle(id), repo.getSettings()]);
  return { ...bundle, settings };
}

const range = (s: Slot) => (s.repMin === s.repMax ? `${s.repMin}` : `${s.repMin}-${s.repMax}`) + (s.unit === 'sec' ? ' с' : '');

function pastText(p: Past, unit: Slot['unit']): string {
  const done = p.sets.filter((s) => s.done);
  if (!done.length) return '';
  const u = unit === 'sec' ? ' с' : '';
  if (done.every((s) => s.weight === done[0].weight)) {
    return `${formatKg(done[0].weight)} кг × ${done.map((s) => s.value).join(', ')}${u}`;
  }
  return done.map((s) => `${formatKg(s.weight)}×${s.value}${u}`).join(', ');
}

function hintClass(h: Suggestion): string {
  if (h.hint.startsWith('Калибровка')) return 'cal';
  if (h.hint.includes('боль')) return 'pain';
  return h.increased ? 'up' : '';
}

export function Workout({ id }: { id: number }) {
  const { data, error, setData } = useAsync(() => load(id), [id]);
  const [idx, setIdxRaw] = useState<number>(() => readLocal<number>(`idx:${id}`) ?? 0);
  const [hint, setHint] = useState<Suggestion | null>(null);
  const [prev, setPrev] = useState<{ past: Past; week: number } | null>(null);
  const [tech, setTech] = useState(false);
  const [sheet, setSheet] = useState<'toc' | 'finish' | 'menu' | null>(null);
  const [rest, setRestRaw] = useState<Rest | null>(() => readLocal<Rest>(`rest:${id}`));

  const finished = !!data?.session.finishedAt;
  useWakeLock(!!data && !finished);

  const setIdx = (i: number) => {
    setIdxRaw(i);
    setTech(false);
    writeLocal(`idx:${id}`, i);
    window.scrollTo(0, 0);
  };
  const setRest = (r: Rest | null) => {
    setRestRaw(r);
    writeLocal(`rest:${id}`, r);
  };

  const day = data ? getDay(data.session.day) : null;
  const slot = day ? day.slots[Math.min(idx, day.slots.length - 1)] : null;
  const rows = data && slot ? data.sets.filter((s) => s.slotId === slot.id) : [];
  const key = rows[0]?.exerciseKey ?? slot?.id ?? '';
  const skipped = !!(data && slot && data.skips.some((s) => s.slotId === slot.id));

  useEffect(() => {
    if (!slot || !data) return;
    let alive = true;
    setHint(null);
    setPrev(null);
    if (skipped) return;
    void repo.suggestionFor(id, slot.id).then((h) => alive && setHint(h));
    void repo.lastPast(key, id).then((p) => alive && setPrev(p));
    return () => {
      alive = false;
    };
  }, [id, slot?.id, key, skipped, !!data]);

  if (error) return <div class="screen"><p class="empty">Ошибка: {error}</p><a class="btn block" href="#/">На главную</a></div>;
  if (!data || !day || !slot) return <div class="screen" />;

  const { session, cycle, settings } = data;
  const { exercise, retired } = exerciseByKey(key);
  const count = skipped ? plannedSets(day, slot, session.week, cycle.number) : rows.length;
  const last = idx >= day.slots.length - 1;
  const label = weekLabel(session.week, cycle.number);

  const patchLocal = (changes: Map<number, Partial<SetRow>>) =>
    setData((d) => d && { ...d, sets: d.sets.map((s) => (changes.has(s.id!) ? { ...s, ...changes.get(s.id!) } : s)) });

  async function patchSet(row: SetRow, patch: Partial<SetRow>) {
    const changes = new Map<number, Partial<SetRow>>([[row.id!, patch]]);
    // Новый вес переносится в следующие невыполненные подходы этого упражнения.
    if (patch.weight !== undefined && !row.done) {
      rows.filter((r) => r.index > row.index && !r.done).forEach((r) => changes.set(r.id!, { weight: patch.weight }));
    }
    patchLocal(changes);
    for (const [sid, p] of changes) await repo.updateSet(sid, p);
  }

  async function toggleDone(row: SetRow) {
    const done = !row.done;
    if (done) unlockAudio();
    await patchSet(row, { done });
    if (!done || finished) return;
    const isLast = row.index === Math.max(...rows.map((r) => r.index));
    const sec = isLast ? TRANSITION_REST_SEC : slot!.restSec;
    setRest({ endAt: Date.now() + sec * 1000, total: sec * 1000, label: isLast ? 'переход' : 'отдых' });
  }

  async function reloadBundle() {
    const b: Bundle = await repo.sessionBundle(id);
    setData((d) => d && { ...d, ...b });
  }

  async function swap(useSub: boolean) {
    await repo.swapExercise(id, slot!.id, useSub);
    await reloadBundle();
  }

  async function skip(v: boolean) {
    await repo.setSkipped(id, slot!.id, v);
    await reloadBundle();
  }

  async function remove() {
    if (!confirm('Удалить эту тренировку со всеми подходами? Отменить нельзя.')) return;
    await repo.deleteSession(id);
    writeLocal(`rest:${id}`, null);
    writeLocal(`idx:${id}`, null);
    go(finished ? '/history' : '/');
  }

  const doneCount = (slotId: string) => data.sets.filter((s) => s.slotId === slotId && s.done).length;
  const totalCount = (slotId: string) => data.sets.filter((s) => s.slotId === slotId).length;

  return (
    <div class="screen no-nav">
      <div class="topbar">
        <button class="icon-btn" aria-label="Назад" onClick={() => go(finished ? '/history' : '/')}><IconBack /></button>
        <div class="title">
          <b>{day.short} — {day.title.split('— ')[1]}</b>
          <span class="num">
            {finished ? formatDate(session.date) : `Цикл ${cycle.number} · нед. ${session.week}${label ? ` · ${label}` : ''}`} · <Clock start={session.startedAt} end={session.finishedAt} />
          </span>
        </div>
        <button class="icon-btn" aria-label="Упражнения" onClick={() => setSheet('toc')}><IconList /></button>
        <button class="icon-btn" aria-label="Меню" onClick={() => setSheet('menu')}><IconMenu /></button>
      </div>

      <div class="ex-head">
        <div class="faint small" style="margin-bottom:4px">Упражнение {idx + 1} из {day.slots.length}</div>
        <h1>{exercise.name}</h1>
        <div class="ex-meta num">
          <span>{count} × {range(slot)}{exercise.perSide ? ' на ногу' : ''}</span>
          <span>отдых {slot.restSec} с</span>
          {retired ? <span>прежняя программа</span> : exercise.key !== slot.exercise.key && <span>вместо: {slot.exercise.name}</span>}
        </div>
        <div class="ex-actions">
          {exercise.technique && <button class="btn" onClick={() => setTech(!tech)}>ℹ Техника</button>}
          {slot.substitute && !skipped && !retired && (
            <button class="btn" onClick={() => swap(exercise.key === slot.exercise.key)}>
              {exercise.key === slot.exercise.key ? `Заменить на «${slot.substitute.name}»` : `Вернуть «${slot.exercise.name}»`}
            </button>
          )}
          {slot.skippable && !skipped && <button class="btn" onClick={() => skip(true)}>Пропустить</button>}
        </div>
        {tech && exercise.technique && <div class="technique">{exercise.technique}</div>}
      </div>

      {skipped ? (
        <div class="skipped">
          <p style="margin-top:0">Упражнение пропущено в этой тренировке.</p>
          <button class="btn" onClick={() => skip(false)}>Вернуть</button>
        </div>
      ) : (
        <>
          {hint && <div class={`hint ${hintClass(hint)}`}>{hint.hint}</div>}
          {prev && pastText(prev.past, slot.unit) && (
            <div class="prev num">Прошлый раз (нед. {prev.week}): {pastText(prev.past, slot.unit)}</div>
          )}
          <div class="sets">
            {rows.map((r) => (
              <div class={`set ${r.done ? 'done' : ''}`} key={r.id}>
                <div class="set-main">
                  <div class="set-no num">{r.index}</div>
                  <Stepper label={`Подход ${r.index}, вес`} value={r.weight} step={settings.steps[exercise.equipment]} unit="кг" onChange={(v) => patchSet(r, { weight: v })} />
                  <Stepper
                    label={`Подход ${r.index}, ${slot.unit === 'sec' ? 'секунды' : 'повторения'}`}
                    value={r.value}
                    step={slot.unit === 'sec' ? 5 : 1}
                    unit={slot.unit === 'sec' ? 'сек' : 'повт'}
                    onChange={(v) => patchSet(r, { value: v })}
                  />
                  <button class={`check ${r.done ? 'on' : ''}`} aria-pressed={r.done} aria-label={`Подход ${r.index} выполнен`} onClick={() => toggleDone(r)}>
                    <IconCheck />
                  </button>
                </div>
                <div class="set-extra">
                  <span class="lbl">запас</span>
                  {[0, 1, 2, 3].map((v) => (
                    <button class={`pill num ${r.rir === v ? 'on' : ''}`} aria-pressed={r.rir === v} onClick={() => patchSet(r, { rir: r.rir === v ? undefined : v })}>
                      {v === 3 ? '3+' : v}
                    </button>
                  ))}
                  <button class={`pill pain ${r.pain ? 'on' : ''}`} aria-pressed={r.pain} aria-label="Боль" onClick={() => patchSet(r, { pain: !r.pain })}>
                    ⚡ боль
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div class="dock">
        <div class="dock-inner">
          {rest && !finished && (
            <RestBar
              rest={rest}
              sound={settings.sound}
              onAdd={() => setRest({ ...rest, endAt: rest.endAt + 15_000, total: rest.total + 15_000 })}
              onStop={() => setRest(null)}
            />
          )}
          <div class="navrow">
            <button class="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><IconBack /> Назад</button>
            {last ? (
              <button class="btn primary" onClick={() => setSheet('finish')}>{finished ? 'Самочувствие' : 'Завершить'}</button>
            ) : (
              <button class="btn primary" onClick={() => setIdx(idx + 1)}>Далее <IconNext /></button>
            )}
          </div>
        </div>
      </div>

      {sheet === 'toc' && (
        <Sheet title="Упражнения" onClose={() => setSheet(null)}>
          <div class="toc">
            {day.slots.map((s, i) => {
              const sk = data.skips.some((x) => x.slotId === s.id);
              const d = doneCount(s.id);
              const t = totalCount(s.id);
              const name = exerciseByKey(data.sets.find((x) => x.slotId === s.id)?.exerciseKey ?? s.id).exercise.name;
              return (
                <button class={`item ${i === idx ? 'cur' : ''} ${t && d === t ? 'full' : ''}`} onClick={() => { setIdx(i); setSheet(null); }}>
                  <span>{i + 1}. {name}</span>
                  <span class="num">{sk ? 'пропущено' : `${d}/${t}`}</span>
                </button>
              );
            })}
          </div>
          <button class="btn primary block" style="margin-top:16px" onClick={() => setSheet('finish')}>
            {finished ? 'Самочувствие и заметка' : 'Завершить тренировку'}
          </button>
        </Sheet>
      )}

      {sheet === 'menu' && (
        <Sheet title="Тренировка" onClose={() => setSheet(null)}>
          <div class="stack">
            <div class="muted num">Тоннаж: {formatKg(tonnage(data.sets))} кг</div>
            <div class="muted small">{day.note}</div>
            <button class="btn block" onClick={() => setSheet('finish')}>{finished ? 'Самочувствие и заметка' : 'Завершить тренировку'}</button>
            <button class="btn danger block" onClick={remove}>Удалить тренировку</button>
          </div>
        </Sheet>
      )}

      {sheet === 'finish' && (
        <FinishSheet
          sets={data.sets}
          initial={{ wellbeing: session.wellbeing, back: session.back, note: session.note ?? '' }}
          finished={finished}
          onClose={() => setSheet(null)}
          onSave={async (feel) => {
            await repo.finishSession(id, feel);
            setRest(null);
            writeLocal(`idx:${id}`, null);
            go(finished ? '/history' : '/');
          }}
        />
      )}
    </div>
  );
}

function FinishSheet(props: {
  sets: SetRow[];
  initial: { wellbeing?: number; back?: Back; note: string };
  finished: boolean;
  onClose: () => void;
  onSave: (f: repo.Feel) => Promise<void>;
}) {
  const [wellbeing, setWellbeing] = useState<number | undefined>(props.initial.wellbeing);
  const [back, setBack] = useState<Back | undefined>(props.initial.back);
  const [note, setNote] = useState(props.initial.note);
  const [saving, setSaving] = useState(false);
  const notDone = props.sets.filter((s) => !s.done).length;

  return (
    <Sheet title={props.finished ? 'Самочувствие' : 'Завершить тренировку'} onClose={props.onClose}>
      {!props.finished && notDone > 0 && (
        <div class="hint cal" style="margin-top:0">Не отмечено подходов: {notDone}. Они не войдут в тоннаж и в подсказки.</div>
      )}
      <div class="field">
        <span>Самочувствие</span>
        <div class="seg">
          {[1, 2, 3, 4, 5].map((v) => (
            <button class={wellbeing === v ? 'on' : ''} aria-pressed={wellbeing === v} onClick={() => setWellbeing(v)}>{v}</button>
          ))}
        </div>
      </div>
      <div class="field">
        <span>Поясница</span>
        <div class="seg">
          {([['ok', 'ок'], ['ache', 'ноет'], ['pain', 'болит']] as const).map(([v, l]) => (
            <button class={back === v ? 'on' : ''} aria-pressed={back === v} onClick={() => setBack(v)}>{l}</button>
          ))}
        </div>
      </div>
      <label class="field">
        <span>Заметка: что не пошло</span>
        <textarea value={note} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
      </label>
      <button
        class="btn primary big block"
        style="margin-top:18px"
        disabled={saving || !wellbeing || !back}
        onClick={async () => {
          setSaving(true);
          await props.onSave({ wellbeing: wellbeing!, back: back!, note: note.trim() });
        }}
      >
        {props.finished ? 'Сохранить' : 'Завершить'}
      </button>
      {(!wellbeing || !back) && <p class="faint small" style="text-align:center">Отметьте самочувствие и поясницу</p>}
    </Sheet>
  );
}
