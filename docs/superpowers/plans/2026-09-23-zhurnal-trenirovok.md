# Журнал тренировок — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** офлайн-PWA «Журнал тренировок» по зашитой программе верх/низ, тяжёлый/лёгкий, опубликованное на GitHub Pages.

**Architecture:** чистая логика (программа, недели цикла, прогрессия, тоннаж, резервная копия) — отдельные модули без DOM, покрытые Vitest. Слой данных — Dexie (IndexedDB) с функциями-репозиториями, тоже под тестами (fake-indexeddb). Экраны на Preact читают/пишут только через репозиторий; маршрутизация по `location.hash`.

**Tech Stack:** Vite 8, Preact 10 + @preact/preset-vite, TypeScript 5.9, Dexie 4, uPlot 1.6, vite-plugin-pwa 1.3, Vitest 5 + fake-indexeddb + happy-dom.

**Spec:** `docs/superpowers/specs/2026-09-23-zhurnal-trenirovok-design.md`

## Global Constraints

- Интерфейс только на русском; тёмная тема; кнопки не меньше 48 px.
- Работает полностью офлайн после первой загрузки; никаких сетевых запросов с данными журнала.
- `base` сборки: `/trenirovki/`; адрес публикации `https://vik9123.github.io/trenirovki/`.
- Шаги веса по умолчанию: barbell 2,5; smith 2,5; dumbbell 2; machine 5; added 1,25 кг.
- Недели цикла 1: 90 / 102 / 113×5 / 60 подходов; цикл 2+: 113×7 / 60.
- Файл резервной копии: `trenirovki-backup-ГГГГ-ММ-ДД.json`, `schemaVersion: 1`.
- Коммиты заканчиваются строкой `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Файлы

| Файл | Ответственность |
|---|---|
| `src/program.ts` | типы программы и сама программа (4 дня, слоты, техника) |
| `src/logic/cycle.ts` | подходы по неделям, метка недели, выбор следующего дня |
| `src/logic/progression.ts` | подсказка веса/повторений по прошлому разу |
| `src/logic/tonnage.ts` | тоннаж подходов/тренировки |
| `src/logic/backup.ts` | формат резервной копии, проверка |
| `src/data/db.ts` | схема Dexie, типы записей |
| `src/data/repo.ts` | все операции с данными для экранов |
| `src/ui/*.tsx` | компоненты: Stepper, RestBar, Chart, Nav, Sheet |
| `src/screens/*.tsx` | Today, Workout, History, Progress, More |
| `src/lib/sound.ts`, `src/lib/wakelock.ts`, `src/lib/format.ts` | звук, Wake Lock, форматирование |
| `src/app.tsx`, `src/main.tsx`, `src/styles.css` | корень, роутер, стили |
| `tests/*.test.ts` | тесты логики и репозитория |
| `.github/workflows/deploy.yml` | сборка и публикация на Pages |

---

### Task 1: Каркас проекта

**Files:** Create `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/app.tsx`, `.gitignore`, `tests/smoke.test.ts`

**Produces:** `npm test` (vitest run), `npm run build` (tsc --noEmit && vite build), `npm run dev`.

- [ ] Step 1: `npm init`, установить `preact dexie uplot` и dev `vite @preact/preset-vite typescript@5.9 vitest fake-indexeddb happy-dom vite-plugin-pwa`.
- [ ] Step 2: `vite.config.ts`: `base: '/trenirovki/'`, плагин preact, `test: { environment: 'node' }`.
- [ ] Step 3: `tsconfig.json`: `strict`, `jsx: react-jsx`, `jsxImportSource: preact`, `moduleResolution: bundler`, `types: ["vite/client"]`.
- [ ] Step 4: smoke-тест `expect(1+1).toBe(2)`; `npm test` → PASS; `npm run build` → OK.
- [ ] Step 5: commit `chore: каркас Vite + Preact + Vitest`.

### Task 2: Программа

**Files:** Create `src/program.ts`, `tests/program.test.ts`

**Produces:**
```ts
export type DayId = 'mon' | 'tue' | 'thu' | 'fri';
export type Equipment = 'barbell' | 'smith' | 'dumbbell' | 'machine' | 'added';
export interface Exercise { key: string; name: string; equipment: Equipment; technique?: string }
export interface Slot {
  id: string; day: DayId; order: number; exercise: Exercise;
  sets: number; repMin: number; repMax: number; restSec: number;
  unit: 'reps' | 'sec'; countsTonnage: boolean; substitute?: Exercise; skippable?: boolean;
}
export interface Day { id: DayId; title: string; short: string; kind: 'heavy' | 'light'; note: string; slots: Slot[] }
export const DAYS: Day[];            // порядок mon, tue, thu, fri
export function getDay(id: DayId): Day;
export function getSlot(id: string): Slot;
export function exerciseByKey(key: string): { slot: Slot; exercise: Exercise };
export const TRANSITION_REST_SEC = 90;
```
Ключ основного упражнения = `slot.id`; ключ замены = `${slot.id}~sub`.

- [ ] Step 1: тест — таблица из Excel (название, подходы, диапазон, отдых для всех 30 слотов, по дням), суммы подходов 25/30/30/28 = 113, у `mon-4` замена «Тяга гантели в упоре одной рукой» (dumbbell), у фермера `unit: 'sec'`, `countsTonnage: false`, `skippable: true`, уникальность `id`.
- [ ] Step 2: запустить → FAIL (нет модуля).
- [ ] Step 3: написать `program.ts` по таблицам раздела 3 ТЗ и технике из документа.
- [ ] Step 4: тест PASS. Step 5: commit `feat: программа тренировок`.

### Task 3: Недели цикла

**Files:** Create `src/logic/cycle.ts`, `tests/cycle.test.ts`

**Consumes:** `Day`, `Slot`, `DayId`, `DAYS`.
**Produces:**
```ts
export const WEEKS = 8;
export function plannedSets(day: Day, slot: Slot, week: number, cycleNumber: number): number;
export function weekLabel(week: number, cycleNumber: number): string; // 'калибровка' | 'вход' | 'разгрузка' | ''
export function isDeload(week: number): boolean;
export function suggestDay(done: DayId[], jsWeekday: number): DayId | null;
```
Правила: неделя 8 → `min(2, sets)`; цикл 1 неделя 1 → `min(3, sets)`; цикл 1 неделя 2 → слоты с 4 подходами по порядку внутри дня: чётный индекс среди них (0, 2, …) — 4, нечётный — 3; иначе `sets`. `suggestDay`: день, совпадающий с `jsWeekday` (1 Пн, 2 Вт, 4 Чт, 5 Пт), если не сделан; иначе первый несделанный по порядку; все сделаны → `null`.

- [ ] Step 1: тесты — суммы по неделям цикла 1: 90, 102, 113 (недели 3-7), 60; по дням недели 1: 21/24/24/21, недели 2: 23/27/27/25; цикл 2 неделя 1 = 113, неделя 8 = 60; `suggestDay([], 2) = 'tue'`, `suggestDay(['tue'], 2) = 'mon'`, `suggestDay([], 3) = 'mon'`, все четыре → `null`; метки.
- [ ] Step 2: FAIL. Step 3: реализация. Step 4: PASS. Step 5: commit `feat: логика недель цикла`.

### Task 4: Прогрессия

**Files:** Create `src/logic/progression.ts`, `tests/progression.test.ts`

**Consumes:** `Slot`, `Day`, `Equipment`.
**Produces:**
```ts
export type Steps = Record<Equipment, number>;
export const DEFAULT_STEPS: Steps; // 2.5, 2.5, 2, 5, 1.25
export interface PastSet { weight: number; value: number; done: boolean; pain: boolean }
export interface Past { sets: PastSet[] }              // все запланированные строки прошлой тренировки
export interface Suggestion { weight: number; values: number[]; hint: string; increased: boolean }
export function suggest(args: {
  slot: Slot; kind: 'heavy' | 'light'; equipment: Equipment; count: number;
  past: Past | null; deload: boolean; steps: Steps;
}): Suggestion;
```
Рабочий вес прошлого раза = максимум `weight` среди `done`. «Верх набран» = все строки `done` и `value >= repMax` (и строк > 0). Приоритет: нет истории → вес 0, значения `repMin`, «Калибровка: подберите рабочий вес»; разгрузка → прошлый вес, «Разгрузка: веса те же, подходов меньше»; боль → прошлый вес, «В прошлый раз была боль — держим вес»; верх набран → вес + шаг, значения `repMin`, «Верх набран → +2,5 кг» (лёгкий день: «… назад к N»); иначе прошлый вес, значения = прошлые по индексу (нет — `repMin`), тяжёлый: «Держим вес, добиваем до N», лёгкий: «Держим вес, +1 повтор». Единица подсказки для секунд — «40 с набраны → +2 кг». Числа — через `formatKg` (запятая, без лишних нулей). Вес округляется до 0,01.

- [ ] Step 1: тесты по каждой строке таблицы раздела 6 ТЗ, включая: жим гантелей 4 подхода 24 кг × 10 в тяжёлый день → 26 кг (шаг гантелей 2), значения 8; неполные подходы → не набран; фиксированные повторения 4×12; фермер 3×40 с → +2 кг, значения 30; замена использует переданный `equipment`.
- [ ] Step 2: FAIL. Step 3: реализация. Step 4: PASS. Step 5: commit `feat: подсказки прогрессии`.

### Task 5: Тоннаж

**Files:** Create `src/logic/tonnage.ts`, `src/lib/format.ts`, `tests/tonnage.test.ts`

**Produces:**
```ts
export interface TSet { slotId: string; weight: number; value: number; done: boolean }
export function tonnage(sets: TSet[]): number;  // только done и slot.countsTonnage
export function formatKg(n: number): string;    // 26 → "26", 1.25 → "1,25", 12500 → "12 500"
```
- [ ] Step 1: тесты — пример 840; невыполненные не считаются; фермер не считается; `formatKg`.
- [ ] Step 2-4: FAIL → реализация → PASS. Step 5: commit `feat: тоннаж`.

### Task 6: База и репозиторий

**Files:** Create `src/data/db.ts`, `src/data/repo.ts`, `tests/repo.test.ts`

**Consumes:** всё выше.
**Produces:**
```ts
// db.ts
export interface CycleRow { id?: number; number: number; startedAt: number; currentWeek: number; finishedAt?: number }
export interface SessionRow { id?: number; cycleId: number; week: number; day: DayId; date: string; startedAt: number; finishedAt?: number; wellbeing?: number; back?: 'ok'|'ache'|'pain'; note?: string }
export interface SetRow { id?: number; sessionId: number; slotId: string; exerciseKey: string; index: number; weight: number; value: number; rir?: number; pain: boolean; done: boolean }
export interface SkipRow { id?: number; sessionId: number; slotId: string }
export interface BodyweightRow { id?: number; date: string; kg: number }
export interface SettingsRow { id: 'main'; steps: Steps; sound: boolean; lastBackupAt?: number; persistAsked?: boolean }
export class JournalDB extends Dexie { ... }  // db.version(1).stores({...})
export let db: JournalDB; export function resetDb(name?: string): void; // для тестов

// repo.ts
export function getSettings(): Promise<SettingsRow>;
export function saveSettings(p: Partial<SettingsRow>): Promise<void>;
export function getActiveCycle(): Promise<CycleRow>;               // создаёт цикл 1
export function weekSessions(cycleId: number, week: number): Promise<SessionRow[]>;
export function openSession(): Promise<SessionRow | undefined>;    // незавершённая
export function startSession(day: DayId, now?: Date): Promise<number>; // создаёт строки подходов по suggest
export function sessionBundle(id: number): Promise<{ session: SessionRow; cycle: CycleRow; sets: SetRow[]; skips: SkipRow[] }>;
export function suggestionFor(sessionId: number, slotId: string): Promise<Suggestion>;
export function updateSet(id: number, patch: Partial<SetRow>): Promise<void>;
export function swapExercise(sessionId: number, slotId: string, useSubstitute: boolean): Promise<void>;
export function setSkipped(sessionId: number, slotId: string, skipped: boolean): Promise<void>;
export function finishSession(id: number, f: { wellbeing: number; back: 'ok'|'ache'|'pain'; note: string }, now?: Date): Promise<void>; // + автопереход недели
export function advanceWeek(cycleId: number): Promise<void>;      // 8 → finishedAt
export function startNewCycle(): Promise<CycleRow>;
export function lastPast(exerciseKey: string, beforeSessionId?: number): Promise<{ past: Past; week: number } | null>;
export function allSessions(): Promise<SessionRow[]>;              // по убыванию даты
export function deleteSession(id: number): Promise<void>;
export function addBodyweight(date: string, kg: number): Promise<void>;
export function bodyweights(): Promise<BodyweightRow[]>;
export function deleteBodyweight(id: number): Promise<void>;
export function exerciseHistory(exerciseKey: string): Promise<{ date: string; top: number; total: number }[]>;
export function weeklySummary(cycleId: number): Promise<{ week: number; byDay: Record<DayId, number>; total: number; bodyweight: number | null }[]>;
```
`lastPast` пропускает тренировки недели 8 и незавершённые. `startSession` для неделей 8 берёт прошлый вес (разгрузка), для новой тренировки создаёт `plannedSets` строк на слот.

- [ ] Step 1: тесты с `fake-indexeddb/auto` и `resetDb()` в `beforeEach`: создание цикла; `startSession('mon')` в цикле 1 неделе 1 создаёт 21 строку с весом 0; после завершения недели 1 (все 4 дня) `currentWeek = 2`; в неделе 2 подсказка использует неделю 1; верх набран → вес + шаг; неделя 8 не используется как «прошлый раз»; замена создаёт отдельную историю; `advanceWeek` на 8 закрывает цикл, `startNewCycle` даёт номер 2 и неделя 1 = 113 подходов; `weeklySummary` суммирует тоннаж и средний вес тела недели.
- [ ] Step 2-4: FAIL → реализация → PASS. Step 5: commit `feat: хранилище и репозиторий`.

### Task 7: Резервная копия

**Files:** Create `src/logic/backup.ts`, `tests/backup.test.ts`; Modify `src/data/repo.ts` (+`exportBackup(): Promise<Backup>`, `importBackup(b: Backup): Promise<void>`)

**Produces:**
```ts
export interface Backup { app: 'trenirovki'; schemaVersion: 1; exportedAt: string; cycles: CycleRow[]; sessions: SessionRow[]; sets: SetRow[]; skips: SkipRow[]; bodyweight: BodyweightRow[]; settings: SettingsRow | null }
export function parseBackup(text: string): { ok: true; backup: Backup; summary: string } | { ok: false; error: string };
export function backupFileName(d: Date): string; // trenirovki-backup-2026-09-23.json
```
- [ ] Step 1: тесты — экспорт → JSON → parse → import в чистую базу даёт те же строки; неверный JSON, чужой `app`, `schemaVersion: 2`, отсутствующий массив → ошибка с русским текстом; имя файла.
- [ ] Step 2-4. Step 5: commit `feat: резервная копия`.

### Task 8: Оболочка UI и экран «Сегодня»

**Files:** Create `src/styles.css`, `src/ui/Nav.tsx`, `src/ui/Sheet.tsx`, `src/screens/Today.tsx`, `src/router.ts`; Modify `src/app.tsx`, `src/main.tsx`

Маршруты: `#/` Сегодня, `#/w/:id` Тренировка, `#/history`, `#/progress`, `#/more`. Нижняя навигация на 4 вкладки (Сегодня, История, Прогресс, Ещё), скрыта на экране тренировки. CSS-переменные тёмной темы, `color-scheme: dark`, отступы под safe-area.

«Сегодня»: карточка цикла/недели с меткой; «Продолжить тренировку», если есть незавершённая; большая кнопка «Начать: <день>» по `suggestDay`; 4 плитки дней (сделан ✓ с тоннажем / можно начать); кнопка «Перейти к следующей неделе» (подтверждение), при завершённом цикле — «Начать новый цикл»; плашка резервной копии (> 7 дней или ни разу, при наличии хотя бы одной тренировки).

- [ ] Step 1: реализация; `npm run build` OK.
- [ ] Step 2: проверка в браузере (`npm run dev`, мобильный размер): карточка «Цикл 1 · Неделя 1 из 8 · калибровка», кнопка по дню недели.
- [ ] Step 3: commit `feat: оболочка и экран Сегодня`.

### Task 9: Экран тренировки

**Files:** Create `src/screens/Workout.tsx`, `src/ui/Stepper.tsx`, `src/ui/RestBar.tsx`, `src/lib/sound.ts`, `src/lib/wakelock.ts`

- Шапка: ← назад, «Пн — верх, тяжёлый», номер упражнения `3 / 7`, общий секундомер.
- Карточка упражнения: название (замена — её название), `4 × 8-10 · отдых 105 с` (план с учётом недели), «ℹ» раскрывает технику, «Заменить на … / Вернуть …» если есть `substitute`, «Пропустить / Вернуть» если `skippable`, строка подсказки из `suggestionFor`.
- Строка подхода: № , Stepper веса (шаг снаряда, тап по числу — `prompt`-подобный ввод через `<input inputmode="decimal">`), Stepper повторений/секунд (шаг 1 / 5 с), фишки RIR `0 1 2 3+` (повторный тап снимает), ⚡, ✓. После ✓ — `updateSet(done)` и старт отдыха: `restSec` или `TRANSITION_REST_SEC`, если это последний подход упражнения; изменение веса в первом подходе переносит вес в последующие невыполненные.
- Навигация ← → по упражнениям и список-оглавление (Sheet) со статусом «n/m подходов».
- RestBar: `endAt` в `localStorage` (try/catch), отображение `мм:сс`, «+15 с», «Стоп»; по окончании `beep()` (Web Audio) и `navigator.vibrate?.(…)`.
- Wake Lock при открытии, повтор при `visibilitychange`.
- «Завершить» → Sheet самочувствия: 1-5, поясница ок/ноет/болит, заметка → `finishSession` → `#/`. Для завершённой тренировки — режим правки: кнопка «Сохранить».

- [ ] Step 1: реализация; build OK.
- [ ] Step 2: браузер: пройти Пн недели 1 целиком — 21 строка, таймер идёт, подсказка калибровки, завершение → плитка Пн ✓.
- [ ] Step 3: commit `feat: экран тренировки и таймер`.

### Task 10: История

**Files:** Create `src/screens/History.tsx`

Список `allSessions()`: дата, день, цикл/неделя, тоннаж, самочувствие; тап → `#/w/:id` (режим правки); удаление с подтверждением.
- [ ] Step 1: реализация; браузер: тренировка из Task 9 видна, открывается. Step 2: commit `feat: история`.

### Task 11: Прогресс

**Files:** Create `src/screens/Progress.tsx`, `src/ui/Chart.tsx`

- Выбор цикла (если их больше одного).
- Столбики тоннажа по неделям (uPlot, 4 серии-стека: Пн/Вт/Чт/Пт) и таблица «Сводка»: неделя, Пн, Вт, Чт, Пт, итого, вес тела.
- Выбор упражнения (`<select>` c группами по дням, включая замену) → линии «рабочий вес» и «сумма повторений» по датам (две оси).
- Цвета серий из CSS-переменных; пустое состояние «Пока нет данных».
- [ ] Step 1: реализация; браузер: графики строятся по тестовым данным. Step 2: commit `feat: прогресс`.

### Task 12: «Ещё»: вес тела, резервная копия, настройки

**Files:** Create `src/screens/More.tsx`; Modify `src/main.tsx` (`navigator.storage.persist()` один раз)

- Вес тела: ввод (дата по умолчанию сегодня, кг), список последних с удалением.
- Резервная копия: «Сохранить копию» → `exportBackup` → `File` → `navigator.share({files})` если `canShare`, иначе скачивание через `<a download>`; `lastBackupAt` обновляется. «Восстановить» → `<input type=file>` → `parseBackup` → Sheet со сводкой и подтверждением → `importBackup`.
- Настройки: шаги по снарядам (Stepper 0,25), звук вкл/выкл, «О приложении» (версия, ссылка на инструкцию).
- [ ] Step 1: реализация; браузер: вес тела сохраняется, копия скачивается и восстанавливается. Step 2: commit `feat: вес тела, копия, настройки`.

### Task 13: PWA

**Files:** Modify `vite.config.ts`; Create `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png`, `scripts/make-icons.py`

`VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Журнал тренировок', short_name: 'Тренировки', lang: 'ru', display: 'standalone', background_color/theme_color тёмные, start_url/scope '/trenirovki/', icons 192/512 (+maskable) }, workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'] } })`; в `index.html` — `apple-touch-icon`, `apple-mobile-web-app-capable`, `theme-color`.
- [ ] Step 1: иконки (Pillow). Step 2: `npm run build && npx vite preview` — в браузере манифест и service worker зарегистрированы, после офлайна страница открывается. Step 3: commit `feat: PWA`.

### Task 14: Публикация и инструкция

**Files:** Create `.github/workflows/deploy.yml`, `README.md`

- Workflow: on push `main` → `npm ci`, `npm test`, `npm run build`, `actions/upload-pages-artifact` (`dist`), `actions/deploy-pages`.
- `gh repo create vik9123/trenirovki --public --source . --push`; включить Pages `build_type=workflow`.
- README: что это, установка на Android (Chrome → «Установить приложение») и iPhone (Safari → «Поделиться» → «На экран Домой»), резервная копия раз в неделю, как обновляется.
- [ ] Step 1: пуш, дождаться зелёного workflow. Step 2: открыть `https://vik9123.github.io/trenirovki/` в браузере, мобильный размер, пройти сценарий раздела 10 ТЗ. Step 3: commit/push.
