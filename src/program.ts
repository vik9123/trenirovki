// Программа «Сплит верх/низ, тяжёлый и лёгкий день», сезон 2026/27.
// Источник: «Дневник тренировок 2026-27.xlsx» и «Программа тренировок 2026-27.docx».
// Программа неизменяемая: в приложении нет редактора, только замена и пропуск.

export type DayId = 'mon' | 'tue' | 'thu' | 'fri';
export type Equipment = 'barbell' | 'smith' | 'dumbbell' | 'machine' | 'added';

export interface Exercise {
  key: string;
  name: string;
  equipment: Equipment;
  technique?: string;
  /** Мышцы: первой — основная (колонка «Мышцы» программы). */
  muscles?: string;
  /** Повторения — на каждую ногу (руку), вес — одной гантели. */
  perSide?: boolean;
  /** Первые N тренировок с упражнением — без отягощения. */
  bodyweightFirst?: number;
  /** Нет своей истории — подсказка берётся из истории этого упражнения (перенесено из другого дня). */
  inheritsFrom?: string;
}

export interface Slot {
  /** Постоянный id = ключ основного упражнения; не зависит от места в дне. */
  id: string;
  day: DayId;
  order: number;
  exercise: Exercise;
  sets: number;
  repMin: number;
  repMax: number;
  /** До скольких повторений растить, прежде чем прибавлять вес (разведения — до 20). */
  progressTo?: number;
  restSec: number;
  unit: 'reps' | 'sec';
  countsTonnage: boolean;
  substitute?: Exercise;
  skippable?: boolean;
  /** Упражнение убрано из программы (последний день, когда оно было). */
  retiredAfter?: string;
}

export interface Day {
  id: DayId;
  title: string;
  short: string;
  kind: 'heavy' | 'light';
  note: string;
  warmup: string[];
  slots: Slot[];
}

/** Отдых после последнего подхода упражнения — переход и подбор веса. */
export const TRANSITION_REST_SEC = 90;

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Штанга, EZ-гриф',
  smith: 'Смит',
  dumbbell: 'Гантели (вес одной)',
  machine: 'Блоки и тренажёры',
  added: 'Доп. вес (подтягивания, брусья, гиперэкстензия)',
};

const AMPLITUDE = 'Полная амплитуда во всех движениях: в жимах — до растяжения грудной, в тягах вверху полностью распрямлять руки.';

const RAISES =
  'Ведёте локтем, а не кистью, корпус неподвижен, подъём до уровня плеч. Помогаете себе телом — вес велик. Вес — одной гантели. Сначала добавляете повторения до 20, потом вес: шаг 1-2 кг для дельты — почти 20 %.';

const T = {
  squat:
    'В силовой раме со страховочными упорами, до параллели бедра, не ниже. Первые тренировки — вес с запасом, прибавлять по 5 кг. Стоят первыми специально: самое тяжёлое упражнение недели — на свежие силы.',
  seatedPress:
    'Нейтральный хват (ладони друг к другу), спинка почти вертикальная. Первая неделя — вес на 30-40 % ниже, чем в наклонном жиме. Резкая боль в плече — подход заканчиваете. Вес — одной гантели.',
  machineRaise:
    'Сиденье так, чтобы плечо было на уровне оси тренажёра, подушки чуть выше локтя. Защемление вверху — вернуться к разведениям на нижнем блоке одной рукой.',
  facePull: 'Тянете к переносице, локти высоко, в конце разводите руки наружу.',
  tueRaises: `${RAISES} Если плечи не восстанавливаются (повторения падают при том же весе, плечо болит больше суток, в понедельник ещё ноет с пятницы) — это упражнение убирается первым: кнопка «Пропустить».`,
  stepUp:
    'Тумба 30-40 см, угол в колене внизу не меньше 90°. Поднимаетесь за счёт ноги на тумбе, нижней не отталкиваетесь. Колено идёт по линии носка. Первые две недели без гантелей. Вес — одной гантели (0 без веса), повторения — на одну ногу.',
  singleLegRdl:
    'Первое время держитесь свободной рукой за стойку, гантель 10-12 кг. Спина прямая, таз назад, опорное колено слегка согнуто. Вес — одной гантели, повторения — на одну ногу.',
  gluteBridge: 'Перед мостом — один лёгкий разминочный подход: ноги успевают остыть за плечевым блоком.',
  dips: 'Не опускаться ниже 90° в локте. Записывайте только дополнительный вес, 0 — без веса.',
  pullups: 'Записывайте только дополнительный вес, 0 — без веса.',
  seatedRow: 'Корпус зафиксирован, тянуть локтями назад, в конце свести лопатки.',
  tbar: 'Если заноет поясница — заменить на тягу гантели в упоре одной рукой (кнопка «Заменить»).',
  latPulldown: 'Широкий хват, к верху груди, корпус отклонён назад на 15°, не больше.',
  dumbbell: 'Вес — одной гантели.',
  hyper: 'Записывайте только дополнительный вес, 0 — без веса.',
};

const WARMUP_BASE = [
  'Эллипс — 4 минуты, лёгкий темп.',
  'Плечи и грудной отдел: круги плечами, сведение лопаток, повороты корпуса — 2 минуты.',
];
const WARMUP_CUFF = 'Наружная ротация плеча на блоке или резине, 2 × 15 на каждую руку — подготовка вращательной манжеты.';
const WARMUP_FIRST = 'Подводящие подходы первого упражнения: 12 повторений с 50 % рабочего веса, затем 6 повторений с 75 %.';

type Extra = Partial<Pick<Slot, 'unit' | 'countsTonnage' | 'skippable' | 'progressTo'>> &
  Pick<Exercise, 'perSide' | 'bodyweightFirst' | 'inheritsFrom'> & {
    /** Ключ истории упражнения. У упражнений первой редакции — прежний номер места («tue-6»). */
    key: string;
    substitute?: Omit<Exercise, 'key'>;
  };

type Row = [
  name: string,
  sets: number,
  repMin: number,
  repMax: number,
  restSec: number,
  equipment: Equipment,
  muscles: string,
  technique: string | undefined,
  extra: Extra,
];

function slot(day: DayId, order: number, row: Row, retiredAfter?: string): Slot {
  const [name, sets, repMin, repMax, restSec, equipment, muscles, technique, extra] = row;
  const s: Slot = {
    id: extra.key,
    day,
    order,
    exercise: {
      key: extra.key,
      name,
      equipment,
      ...(muscles ? { muscles } : {}),
      ...(technique ? { technique } : {}),
      ...(extra.perSide ? { perSide: true } : {}),
      ...(extra.bodyweightFirst ? { bodyweightFirst: extra.bodyweightFirst } : {}),
      ...(extra.inheritsFrom ? { inheritsFrom: extra.inheritsFrom } : {}),
    },
    sets,
    repMin,
    repMax,
    restSec,
    unit: extra.unit ?? 'reps',
    countsTonnage: extra.countsTonnage ?? true,
  };
  if (extra.progressTo) s.progressTo = extra.progressTo;
  if (extra.skippable) s.skippable = true;
  if (extra.substitute) s.substitute = { key: `${extra.key}~sub`, ...extra.substitute };
  if (retiredAfter) s.retiredAfter = retiredAfter;
  return s;
}

function day(id: DayId, title: string, short: string, kind: Day['kind'], note: string, warmup: string[], rows: Row[]): Day {
  return { id, title, short, kind, note, warmup, slots: rows.map((r, i) => slot(id, i + 1, r)) };
}

const HEAVY_NOTE = (range: string) =>
  `${range} повторений, запас 2, вес растёт. Набрали верх диапазона во всех подходах — в следующий раз +1,25-2,5 кг. ${AMPLITUDE}`;
const LIGHT_NOTE =
  '12-20 повторений, вес ~65 % от тяжёлого дня, запас 2-3. Вес держите, растут повторения; дошли до верха диапазона — поднимаете вес. Последние 2-3 повторения должны даваться тяжело.';

const R20 = { progressTo: 20 } as const;

// Редакция 28.09.2026: «Сплит верх / низ со специализацией на плечи», 110 подходов в неделю.
export const DAYS: Day[] = [
  day('mon', 'Понедельник — верх, тяжёлый', 'Пн', 'heavy', HEAVY_NOTE('8-10'), [...WARMUP_BASE, WARMUP_FIRST], [
    ['Жим гантелей на наклонной 30°', 4, 8, 10, 105, 'dumbbell', 'грудь (верх), передняя дельта, трицепс', T.dumbbell, { key: 'mon-1' }],
    ['Подтягивания с весом', 4, 6, 8, 105, 'added', 'широчайшие, бицепс', T.pullups, { key: 'mon-2' }],
    ['Отжимания на брусьях', 4, 8, 10, 90, 'added', 'грудь (низ), трицепс', T.dips, { key: 'mon-3' }],
    ['Тяга Т-грифа', 3, 8, 10, 90, 'barbell', 'середина спины, широчайшие, задняя дельта', T.tbar, {
      key: 'mon-4',
      substitute: { name: 'Тяга гантели в упоре одной рукой', equipment: 'dumbbell', technique: 'Вес — одной гантели, повторения — на каждую руку.' },
    }],
    ['Подъём рук в стороны в тренажёре', 4, 12, 15, 45, 'machine', 'средняя дельта', T.machineRaise, { key: 'mon-lat-machine' }],
    ['Сгибания на скамье Скотта', 3, 8, 10, 60, 'barbell', 'бицепс', undefined, { key: 'mon-5' }],
    ['Гиперэкстензия', 4, 12, 12, 45, 'added', 'разгибатели спины, ягодицы', T.hyper, { key: 'mon-7' }],
  ]),
  day('tue', 'Вторник — низ, лёгкий', 'Вт', 'light', `Плечи первыми, до ног. ${LIGHT_NOTE}`, [...WARMUP_BASE, WARMUP_CUFF, WARMUP_FIRST], [
    ['Разведения гантелей в стороны', 4, 15, 15, 45, 'dumbbell', 'средняя дельта', T.tueRaises, { key: 'tue-6', skippable: true, ...R20 }],
    ['Тяга каната к лицу', 4, 15, 15, 45, 'machine', 'задняя дельта, вращательная манжета плеча', T.facePull, { key: 'tue-face-pull' }],
    ['Боковой подъём на тумбу', 4, 10, 12, 75, 'dumbbell', 'квадрицепс, средняя ягодичная', T.stepUp, { key: 'tue-stepup', perSide: true, bodyweightFirst: 2 }],
    ['Румынская тяга на одной ноге', 4, 10, 12, 75, 'dumbbell', 'бицепс бедра, ягодицы', T.singleLegRdl, { key: 'tue-sl-rdl', perSide: true }],
    ['Жим ногами', 3, 15, 20, 75, 'machine', 'квадрицепс, ягодицы', undefined, { key: 'tue-3' }],
    ['Сгибание ног лёжа', 4, 15, 15, 45, 'machine', 'бицепс бедра', undefined, { key: 'tue-4' }],
    ['Подъёмы на носки стоя', 4, 15, 20, 45, 'machine', 'икроножная', undefined, { key: 'tue-5' }],
  ]),
  day('thu', 'Четверг — верх, лёгкий', 'Чт', 'light', `${LIGHT_NOTE} ${AMPLITUDE}`, [...WARMUP_BASE, WARMUP_FIRST], [
    ['Тяга вертикального блока', 4, 12, 15, 75, 'machine', 'широчайшие, бицепс', T.latPulldown, { key: 'thu-1' }],
    ['Жим гантелей на горизонтальной', 4, 12, 15, 75, 'dumbbell', 'грудь, передняя дельта, трицепс', T.dumbbell, { key: 'thu-2' }],
    ['Тяга сидя в тренажёре', 4, 12, 15, 75, 'machine', 'середина спины, широчайшие, задняя дельта', T.seatedRow, { key: 'thu-3' }],
    ['Сведения в кроссовере', 3, 15, 20, 45, 'machine', 'грудь', undefined, { key: 'thu-4' }],
    ['Французский жим', 3, 12, 15, 45, 'barbell', 'трицепс', undefined, { key: 'thu-5' }],
    ['Молотковые сгибания', 3, 12, 15, 45, 'dumbbell', 'бицепс, плечевая мышца, предплечье', T.dumbbell, { key: 'thu-6' }],
    ['Разведения гантелей в стороны', 4, 12, 15, 45, 'dumbbell', 'средняя дельта', RAISES, { key: 'thu-7', ...R20 }],
    ['Разведения в наклоне', 4, 15, 15, 45, 'dumbbell', 'задняя дельта', RAISES, { key: 'thu-rear-delt', inheritsFrom: 'tue-7', ...R20 }],
  ]),
  day('fri', 'Пятница — низ, тяжёлый', 'Пт', 'heavy', HEAVY_NOTE('8-12'), [...WARMUP_BASE, WARMUP_CUFF, WARMUP_FIRST], [
    ['Приседания со штангой', 4, 8, 10, 120, 'barbell', 'квадрицепс, ягодицы, разгибатели спины', T.squat, { key: 'fri-1' }],
    ['Жим гантелей сидя, нейтральный хват', 4, 8, 10, 105, 'dumbbell', 'передняя и средняя дельта, трицепс', T.seatedPress, { key: 'fri-db-press' }],
    ['Разведения гантелей в стороны', 3, 12, 15, 45, 'dumbbell', 'средняя дельта', RAISES, { key: 'fri-lat', ...R20 }],
    ['Разведения в наклоне', 4, 12, 15, 45, 'dumbbell', 'задняя дельта', RAISES, { key: 'fri-7', ...R20 }],
    ['Ягодичный мост со штангой', 3, 10, 12, 105, 'barbell', 'ягодицы, бицепс бедра', T.gluteBridge, { key: 'fri-2' }],
    ['Разгибание ног', 3, 10, 12, 60, 'machine', 'квадрицепс', undefined, { key: 'fri-3' }],
    ['Сгибание ног лёжа', 3, 10, 12, 60, 'machine', 'бицепс бедра', undefined, { key: 'fri-4' }],
    ['Подъёмы на носки сидя', 4, 12, 12, 45, 'machine', 'камбаловидная (икры)', undefined, { key: 'fri-5' }],
  ]),
];

/**
 * Упражнения, убранные из программы. Их записи остаются в журнале и видны в истории
 * и на «Прогрессе», но в новые тренировки не попадают и не становятся «прошлым разом»
 * для упражнений, пришедших им на смену. order — место в дне в прежней редакции.
 */
export const RETIRED: Slot[] = [
  slot('tue', 1, ['Приседания в Смите', 4, 12, 15, 90, 'smith', '', undefined, { key: 'tue-1' }], '2026-09-23'),
  slot('tue', 2, ['Румынская тяга в Смите', 4, 12, 15, 90, 'smith', '', 'Стопы поставить так, чтобы гриф шёл вплотную вдоль ног.', { key: 'tue-2' }], '2026-09-23'),
  slot('mon', 6, ['Разгибание на верхнем блоке', 3, 10, 12, 60, 'machine', '', undefined, { key: 'mon-6' }], '2026-09-27'),
  slot('tue', 7, ['Разведения в наклоне', 4, 15, 20, 45, 'dumbbell', '', T.dumbbell, { key: 'tue-7' }], '2026-09-27'),
  slot('tue', 8, ['Прогулка фермера', 3, 30, 40, 60, 'dumbbell', '', 'Вес — одной гантели, в повторениях — секунды.', { key: 'tue-8', unit: 'sec', countsTonnage: false, skippable: true }], '2026-09-27'),
  slot('thu', 8, ['Гиперэкстензия', 4, 15, 20, 45, 'added', '', T.hyper, { key: 'thu-8' }], '2026-09-27'),
  slot('fri', 6, ['Тяга к подбородку', 4, 10, 12, 60, 'barbell', '', 'Хват шире плеч. Локти останавливаются на уровне плеч, не выше.', { key: 'fri-6' }], '2026-09-27'),
];

const SLOTS = new Map([...DAYS.flatMap((d) => d.slots), ...RETIRED].map((s) => [s.id, s]));

const EXERCISES = new Map<string, { slot: Slot; exercise: Exercise; retired: boolean }>();
for (const s of SLOTS.values()) {
  EXERCISES.set(s.exercise.key, { slot: s, exercise: s.exercise, retired: !!s.retiredAfter });
  if (s.substitute) EXERCISES.set(s.substitute.key, { slot: s, exercise: s.substitute, retired: !!s.retiredAfter });
}

export function getDay(id: DayId): Day {
  const d = DAYS.find((x) => x.id === id);
  if (!d) throw new Error(`Нет дня ${id}`);
  return d;
}

/** Слот действующей программы или убранный (для записей прошлых тренировок). */
export function getSlot(id: string): Slot {
  const s = SLOTS.get(id);
  if (!s) throw new Error(`Нет упражнения ${id}`);
  return s;
}

export function exerciseByKey(key: string): { slot: Slot; exercise: Exercise; retired: boolean } {
  const e = EXERCISES.get(key);
  if (!e) throw new Error(`Нет упражнения ${key}`);
  return e;
}

/** Упражнение из действующей программы для этого слота: основное или замена. */
export function isCurrentKey(slot: Slot, key: string): boolean {
  return !slot.retiredAfter && (slot.exercise.key === key || slot.substitute?.key === key);
}

/** id слота по ключу упражнения (для записей, где slotId был номером места в дне). */
export function slotIdForKey(key: string): string {
  return exerciseByKey(key).slot.id;
}
