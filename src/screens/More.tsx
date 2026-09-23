import { useState } from 'preact/hooks';
import * as repo from '../data/repo';
import { backupFileName, parseBackup, type Backup } from '../logic/backup';
import { DEFAULT_STEPS } from '../logic/progression';
import { EQUIPMENT_LABEL, type Equipment } from '../program';
import { formatDate, formatKg, isoDate, parseNumber } from '../lib/format';
import { useAsync } from '../lib/useAsync';
import { Sheet } from '../ui/Sheet';
import { Stepper } from '../ui/Stepper';

async function load() {
  const [weights, settings] = await Promise.all([repo.bodyweights(), repo.getSettings()]);
  return { weights, settings };
}

export function More() {
  const { data, reload } = useAsync(load);
  const [date, setDate] = useState(isoDate(new Date()));
  const [kg, setKg] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [restore, setRestore] = useState<{ backup: Backup; summary: string } | null>(null);
  if (!data) return <div class="screen" />;
  const { weights, settings } = data;

  async function addWeight(e: Event) {
    e.preventDefault();
    const n = parseNumber(kg);
    if (!n || n < 20 || n > 300) return setMsg('Введите вес тела в килограммах');
    await repo.addBodyweight(date, n);
    setKg('');
    setMsg(null);
    reload();
  }

  async function saveBackup() {
    const b = await repo.exportBackup();
    const name = backupFileName(new Date());
    const file = new File([JSON.stringify(b)], name, { type: 'application/json' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Журнал тренировок — резервная копия' });
      } else {
        const url = URL.createObjectURL(file);
        const a = Object.assign(document.createElement('a'), { href: url, download: name });
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return; // закрыли окно «Поделиться»
      throw e;
    }
    await repo.saveSettings({ lastBackupAt: Date.now() });
    setMsg(`Копия сохранена: ${name}`);
    reload();
  }

  async function pickFile(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const r = parseBackup(await file.text());
    if (!r.ok) return setMsg(r.error);
    setRestore({ backup: r.backup, summary: r.summary });
  }

  async function doRestore() {
    if (!restore) return;
    await repo.importBackup(restore.backup);
    setRestore(null);
    setMsg('Данные восстановлены из копии');
    reload();
  }

  async function setStep(eq: Equipment, v: number) {
    if (v <= 0) return;
    await repo.saveSettings({ steps: { ...settings.steps, [eq]: v } });
    reload();
  }

  return (
    <div class="screen">
      <h1>Ещё</h1>
      {msg && <div class="banner" role="status"><span>{msg}</span><button class="link" onClick={() => setMsg(null)}>OK</button></div>}

      <h2>Вес тела</h2>
      <form class="card" onSubmit={addWeight}>
        <div class="row">
          <input class="text" type="date" value={date} max={isoDate(new Date())} onInput={(e) => setDate((e.target as HTMLInputElement).value)} aria-label="Дата" />
          <input class="text num" type="text" inputMode="decimal" placeholder="кг" value={kg} onInput={(e) => setKg((e.target as HTMLInputElement).value)} aria-label="Вес тела, кг" style="max-width:110px" />
        </div>
        <button class="btn primary block" style="margin-top:10px" type="submit">Записать</button>
        {weights.length > 0 && (
          <table class="table num" style="margin-top:12px">
            <tbody>
              {weights.slice(0, 10).map((w) => (
                <tr>
                  <td>{formatDate(w.date)}</td>
                  <td>{formatKg(w.kg)} кг</td>
                  <td style="width:60px"><button type="button" class="link" style="color:var(--danger)" onClick={async () => { await repo.deleteBodyweight(w.id!); reload(); }}>удалить</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </form>

      <h2>Резервная копия</h2>
      <div class="card stack">
        <p class="muted small" style="margin:0">
          Журнал хранится только на этом телефоне. Если удалить приложение или очистить данные браузера — записи пропадут.
          Раз в неделю сохраняйте копию в «Файлы», облако или отправьте себе.
        </p>
        <div class="small num">
          {settings.lastBackupAt ? `Последняя копия: ${formatDate(isoDate(new Date(settings.lastBackupAt)))}` : 'Копий ещё не было'}
        </div>
        <button class="btn primary block" onClick={saveBackup}>Сохранить копию</button>
        <label class="btn block">
          Восстановить из файла
          <input type="file" accept="application/json,.json" style="display:none" onChange={pickFile} />
        </label>
      </div>

      <h2>Шаг веса в подсказках</h2>
      <div class="card stack">
        {(Object.keys(DEFAULT_STEPS) as Equipment[]).map((eq) => (
          <div class="spread">
            <span class="small" style="flex:1">{EQUIPMENT_LABEL[eq]}</span>
            <div style="width:170px"><Stepper label={EQUIPMENT_LABEL[eq]} value={settings.steps[eq]} step={0.25} unit="кг" onChange={(v) => setStep(eq, v)} /></div>
          </div>
        ))}
      </div>

      <h2>Звук</h2>
      <div class="card spread">
        <span>Сигнал в конце отдыха</span>
        <div class="seg" style="width:150px">
          <button class={settings.sound ? 'on' : ''} onClick={async () => { await repo.saveSettings({ sound: true }); reload(); }}>Вкл</button>
          <button class={!settings.sound ? 'on' : ''} onClick={async () => { await repo.saveSettings({ sound: false }); reload(); }}>Выкл</button>
        </div>
      </div>

      <p class="faint small" style="margin-top:24px;text-align:center">
        Журнал тренировок · сезон 2026/27 · v{__APP_VERSION__}<br />
        Программа не заменяет консультацию врача.
      </p>

      {restore && (
        <Sheet title="Восстановить из копии?" onClose={() => setRestore(null)}>
          <p>{restore.summary}</p>
          <p class="hint pain">Все текущие данные на телефоне будут заменены данными из копии.</p>
          <div class="stack" style="margin-top:16px">
            <button class="btn primary block" onClick={doRestore}>Заменить данные</button>
            <button class="btn block" onClick={() => setRestore(null)}>Отмена</button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
