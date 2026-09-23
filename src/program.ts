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
}

export interface Slot {
  id: string;
  day: DayId;
  order: number;
  exercise: Exercise;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  unit: 'reps' | 'sec';
  countsTonnage: boolean;
  substitute?: Exercise;
  skippable?: boolean;
}

export interface Day {
  id: DayId;
  title: string;
  short: string;
  kind: 'heavy' | 'light';
  note: string;
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

const AMPLITUDE =
  'Полная амплитуда во всех движениях: в жимах — до растяжения грудной, в тягах вверху полностью распрямлять руки, в разгибаниях ног — до конца.';

const T = {
  squat:
    'В силовой раме с выставленными страховочными упорами. До параллели бедра, не ниже. Вес — около 70 % от того, что идёт в Смите.',
  dips: 'Не опускаться ниже 90° в локте. Записывайте только дополнительный вес, 0 — без веса.',
  pullups: 'Записывайте только дополнительный вес, 0 — без веса.',
  uprightRow: 'Хват шире плеч. Локти останавливаются на уровне плеч, не выше.',
  rdl: 'Стопы поставить так, чтобы гриф шёл вплотную вдоль ног.',
  seatedRow: 'Корпус зафиксирован, тянуть локтями назад, в конце свести лопатки.',
  tbar: 'Если заноет поясница — заменить на тягу гантели в упоре одной рукой (кнопка «Заменить»).',
  farmer:
    'Начать с 20-24 кг в каждой руке. Корпус прямой, плечи назад, идти медленно, не заваливаться вбок. Начали крениться — подход закончен. Осевая нагрузка: если поясница отреагирует, убирать первой. Вес — одной гантели, в повторениях — секунды.',
  latPulldown: 'Широкий хват, тянуть к верху груди, корпус отклонён назад градусов на пятнадцать, не больше.',
  dumbbell: 'Вес — одной гантели.',
  hyper: 'Записывайте только дополнительный вес, 0 — без веса.',
};

type Row = [
  name: string,
  sets: number,
  repMin: number,
  repMax: number,
  restSec: number,
  equipment: Equipment,
  technique?: string,
  extra?: Partial<Pick<Slot, 'unit' | 'countsTonnage' | 'skippable'>> & { substitute?: Omit<Exercise, 'key'> },
];

function day(id: DayId, title: string, short: string, kind: Day['kind'], note: string, rows: Row[]): Day {
  const slots = rows.map(([name, sets, repMin, repMax, restSec, equipment, technique, extra], i): Slot => {
    const slotId = `${id}-${i + 1}`;
    const slot: Slot = {
      id: slotId,
      day: id,
      order: i + 1,
      exercise: { key: slotId, name, equipment, ...(technique ? { technique } : {}) },
      sets,
      repMin,
      repMax,
      restSec,
      unit: extra?.unit ?? 'reps',
      countsTonnage: extra?.countsTonnage ?? true,
    };
    if (extra?.skippable) slot.skippable = true;
    if (extra?.substitute) slot.substitute = { key: `${slotId}~sub`, ...extra.substitute };
    return slot;
  });
  return { id, title, short, kind, note, slots };
}

const HEAVY_NOTE = (range: string) =>
  `${range} повторений, запас 2, вес растёт. Набрали верх диапазона во всех подходах — в следующий раз +1,25-2,5 кг. ${AMPLITUDE}`;
const LIGHT_NOTE =
  `12-20 повторений, вес ~65 % от тяжёлого дня, запас 2-3. Вес держите, растут повторения; дошли до верха диапазона — поднимаете вес. Последние 2-3 повторения должны даваться тяжело. ${AMPLITUDE}`;

export const DAYS: Day[] = [
  day('mon', 'Понедельник — верх, тяжёлый', 'Пн', 'heavy', HEAVY_NOTE('8-10'), [
    ['Жим гантелей на наклонной 30°', 4, 8, 10, 105, 'dumbbell', T.dumbbell],
    ['Подтягивания с весом', 4, 6, 8, 105, 'added', T.pullups],
    ['Отжимания на брусьях', 4, 8, 10, 90, 'added', T.dips],
    ['Тяга Т-грифа', 3, 8, 10, 90, 'barbell', T.tbar, {
      substitute: { name: 'Тяга гантели в упоре одной рукой', equipment: 'dumbbell', technique: 'Вес — одной гантели, повторения — на каждую руку.' },
    }],
    ['Сгибания на скамье Скотта', 3, 8, 10, 60, 'barbell'],
    ['Разгибание на верхнем блоке', 3, 10, 12, 60, 'machine'],
    ['Гиперэкстензия', 4, 12, 12, 45, 'added', T.hyper],
  ]),
  day('tue', 'Вторник — низ, лёгкий', 'Вт', 'light', LIGHT_NOTE, [
    ['Приседания в Смите', 4, 12, 15, 90, 'smith'],
    ['Румынская тяга в Смите', 4, 12, 15, 90, 'smith', T.rdl],
    ['Жим ногами', 3, 15, 20, 75, 'machine'],
    ['Сгибание ног лёжа', 4, 15, 15, 45, 'machine'],
    ['Подъёмы на носки стоя', 4, 15, 20, 45, 'machine'],
    ['Разведения гантелей в стороны', 4, 15, 15, 45, 'dumbbell', T.dumbbell],
    ['Разведения в наклоне', 4, 15, 20, 45, 'dumbbell', T.dumbbell],
    ['Прогулка фермера', 3, 30, 40, 60, 'dumbbell', T.farmer, { unit: 'sec', countsTonnage: false, skippable: true }],
  ]),
  day('thu', 'Четверг — верх, лёгкий', 'Чт', 'light', LIGHT_NOTE, [
    ['Тяга вертикального блока', 4, 12, 15, 75, 'machine', T.latPulldown],
    ['Жим гантелей на горизонтальной', 4, 12, 15, 75, 'dumbbell', T.dumbbell],
    ['Тяга сидя в тренажёре', 4, 12, 15, 75, 'machine', T.seatedRow],
    ['Сведения в кроссовере', 3, 15, 20, 45, 'machine'],
    ['Французский жим', 4, 12, 15, 45, 'barbell'],
    ['Молотковые сгибания', 3, 12, 15, 45, 'dumbbell', T.dumbbell],
    ['Разведения гантелей в стороны', 4, 15, 15, 45, 'dumbbell', T.dumbbell],
    ['Гиперэкстензия', 4, 15, 20, 45, 'added', T.hyper],
  ]),
  day('fri', 'Пятница — низ, тяжёлый', 'Пт', 'heavy', HEAVY_NOTE('8-12'), [
    ['Приседания со штангой', 4, 8, 10, 120, 'barbell', T.squat],
    ['Ягодичный мост со штангой', 4, 10, 12, 105, 'barbell'],
    ['Разгибание ног', 4, 10, 12, 60, 'machine'],
    ['Сгибание ног лёжа', 4, 10, 12, 60, 'machine'],
    ['Подъёмы на носки сидя', 4, 12, 12, 45, 'machine'],
    ['Тяга к подбородку', 4, 10, 12, 60, 'barbell', T.uprightRow],
    ['Разведения в наклоне', 4, 12, 15, 45, 'dumbbell', T.dumbbell],
  ]),
];

const SLOTS = new Map(DAYS.flatMap((d) => d.slots).map((s) => [s.id, s]));

export function getDay(id: DayId): Day {
  const d = DAYS.find((x) => x.id === id);
  if (!d) throw new Error(`Нет дня ${id}`);
  return d;
}

export function getSlot(id: string): Slot {
  const s = SLOTS.get(id);
  if (!s) throw new Error(`Нет упражнения ${id}`);
  return s;
}

export function exerciseByKey(key: string): { slot: Slot; exercise: Exercise } {
  const slot = getSlot(key.split('~')[0]);
  if (slot.exercise.key === key) return { slot, exercise: slot.exercise };
  if (slot.substitute?.key === key) return { slot, exercise: slot.substitute };
  throw new Error(`Нет упражнения ${key}`);
}
