import { z } from 'zod';

export const areaNames = { physical: 'Físico', nutrition: 'Nutrición', mental: 'Mental' } as const;
export type Area = keyof typeof areaNames;
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const d = new Date(s + 'T12:00:00');
    return !isNaN(+d) && localDate(d) === s;
  }, 'Fecha no válida');
const finite = z.number().finite().nonnegative();
export const habitSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  area: z.enum(['physical', 'nutrition', 'mental']),
  unit: z.string(),
  kind: z.enum(['session', 'quantity', 'minutes', 'calories', 'journal']),
  target: finite.positive(),
  days: z.array(z.number().int().min(0).max(6)).refine((d) => new Set(d).size === d.length),
  effectiveFrom: dateSchema,
  effectiveTo: dateSchema.optional(),
  versionId: z.string(),
  enabled: z.boolean(),
});
export type Habit = z.infer<typeof habitSchema>;
const journalSchema = z.object({
  body: z.string(),
  good: z.string(),
  bad: z.string(),
  published: z.boolean(),
  clarity: z.number().int().min(1).max(5).nullable(),
  patience: z.number().int().min(1).max(5).nullable(),
  stress: z.number().int().min(1).max(5).nullable(),
});
export type Journal = z.infer<typeof journalSchema>;
const goalSchema = z.object({
  id: z.string(),
  name: z.string(),
  unit: z.string(),
  start: finite,
  target: finite,
  deadline: dateSchema,
  habitIds: z.array(z.string()),
});
export type Goal = z.infer<typeof goalSchema>;
export const suggestionSchema = z.object({
  habitId: z.enum([
    'strength',
    'cardio',
    'reading',
    'meditation',
    'journal',
    'water',
    'protein',
    'calories',
  ]),
  reason: z.string().max(1500),
  change: z.string().max(1500),
  effect: z.string().max(1500),
  days: z
    .array(z.number().int().min(0).max(6))
    .min(1)
    .max(7)
    .refine((d) => new Set(d).size === d.length),
  target: z.number().finite().positive().max(10000),
});
export type Suggestion = z.infer<typeof suggestionSchema>;
export const stateSchema = z.object({
  schema: z.literal(1),
  onboarded: z.boolean(),
  cycleStart: dateSchema,
  habits: z.array(habitSchema).min(8),
  goals: z.array(goalSchema).length(3),
  records: z.record(dateSchema, z.record(z.string(), finite)),
  journals: z.record(dateSchema, journalSchema),
  measurements: z.array(
    z.object({ id: z.string(), date: dateSchema, goalId: z.string(), value: finite }),
  ),
  milestones: z.record(z.string(), z.record(z.string(), finite)),
  widgets: z
    .array(
      z.object({
        id: z.enum(['warrior', 'quote', 'missions', 'physical', 'consistency', 'mental', 'review']),
        visible: z.boolean(),
        wide: z.boolean(),
      }),
    )
    .length(7)
    .refine((w) => new Set(w.map((x) => x.id)).size === 7),
  quotes: z.array(z.object({ id: z.string(), text: z.string().min(1).max(1000) })),
  pinnedQuote: z.string().nullable(),
  rotateQuotes: z.boolean(),
  reducedMotion: z.boolean(),
  model: z.string().max(200),
  reviews: z.array(
    z.object({
      id: z.string(),
      week: dateSchema,
      created: dateSchema,
      wins: z.string(),
      obstacles: z.string(),
      suggestions: z.array(suggestionSchema),
      appliedIds: z.array(z.string()),
      undone: z.boolean(),
    }),
  ),
});
export type AppState = z.infer<typeof stateSchema>;
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function asDate(s: string) {
  return new Date(s + 'T12:00:00');
}
export function addDays(s: string, n: number) {
  const d = asDate(s);
  d.setDate(d.getDate() + n);
  return localDate(d);
}
export function addMonths(s: string, n: number) {
  const d = asDate(s),
    day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, last));
  return localDate(d);
}
export function weekStart(s: string) {
  return addDays(s, -((asDate(s).getDay() + 6) % 7));
}
export function datesBetween(a: string, b: string) {
  const out: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) {
    out.push(d);
    if (out.length > 3700) break;
  }
  return out;
}
export function monthPeriods(start: string) {
  return [0, 1, 2].map((i) => ({
    start: addMonths(start, i),
    end: addDays(addMonths(start, i + 1), -1),
  }));
}
export function formatDate(
  s: string,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) {
  return asDate(s).toLocaleDateString('es-PE', options);
}
export const uid = () => crypto.randomUUID();
export const emptyJournal = (): Journal => ({
  body: '',
  good: '',
  bad: '',
  published: false,
  clarity: null,
  patience: null,
  stress: null,
});
export function initialState(today = localDate()): AppState {
  const make = (
    id: string,
    name: string,
    area: Area,
    kind: Habit['kind'],
    target: number,
    unit: string,
    days = [0, 1, 2, 3, 4, 5, 6],
  ): Habit => ({
    id,
    name,
    area,
    kind,
    target,
    unit,
    days,
    effectiveFrom: today,
    versionId: uid(),
    enabled: true,
  });
  return {
    schema: 1,
    onboarded: false,
    cycleStart: today,
    habits: [
      make('strength', 'Entrenamiento de fuerza', 'physical', 'session', 1, 'sesión', [1, 2, 4, 5]),
      make('cardio', 'Cardio', 'physical', 'session', 1, 'sesión', [2, 4, 6]),
      make('water', 'Tomar agua', 'nutrition', 'quantity', 3, 'L'),
      make('protein', 'Proteína en polvo', 'nutrition', 'quantity', 1, 'scoop'),
      make('calories', 'Registrar calorías', 'nutrition', 'calories', 1500, 'kcal'),
      make('reading', 'Leer', 'mental', 'minutes', 20, 'min'),
      make('meditation', 'Meditar', 'mental', 'minutes', 30, 'min'),
      make('journal', 'Escribir en mi diario', 'mental', 'journal', 1, 'entrada'),
    ],
    goals: [
      {
        id: 'weight',
        name: 'Peso corporal',
        unit: 'kg',
        start: 88,
        target: 83,
        deadline: '2026-11-30',
        habitIds: ['strength', 'cardio', 'calories'],
      },
      {
        id: 'fat',
        name: 'Grasa corporal',
        unit: 'kg',
        start: 23,
        target: 15,
        deadline: '2026-11-30',
        habitIds: ['strength', 'cardio', 'calories'],
      },
      {
        id: 'visceral',
        name: 'Grasa visceral',
        unit: 'nivel',
        start: 10,
        target: 7,
        deadline: '2026-11-30',
        habitIds: ['strength', 'cardio', 'calories'],
      },
    ],
    records: {},
    journals: {},
    measurements: [],
    milestones: {},
    widgets: [
      { id: 'warrior', visible: true, wide: true },
      { id: 'quote', visible: true, wide: false },
      { id: 'missions', visible: true, wide: true },
      { id: 'physical', visible: true, wide: false },
      { id: 'consistency', visible: true, wide: false },
      { id: 'mental', visible: true, wide: false },
      { id: 'review', visible: true, wide: false },
    ],
    quotes: [
      { id: 'first', text: 'No necesitas ser perfecto. Solo necesitas volver a intentarlo.' },
    ],
    pinnedQuote: 'first',
    rotateQuotes: false,
    reducedMotion: false,
    model: '',
    reviews: [],
  };
}
export function habitsAt(s: AppState, date: string): Habit[] {
  const m = new Map<string, Habit>();
  s.habits.forEach((h) => {
    if (h.effectiveFrom <= date && (!h.effectiveTo || h.effectiveTo >= date)) {
      const old = m.get(h.id);
      if (!old || old.effectiveFrom <= h.effectiveFrom) m.set(h.id, h);
    }
  });
  return [...m.values()].filter((h) => h.enabled);
}
export function missionsAt(s: AppState, date: string) {
  return habitsAt(s, date).filter((h) => h.days.includes(asDate(date).getDay()));
}
export function isDone(s: AppState, h: Habit, date: string) {
  if (h.kind === 'journal') {
    const j = s.journals[date];
    return !!(j?.published && j.good.trim() && j.bad.trim());
  }
  const value = s.records[date]?.[h.id];
  return value !== undefined && (h.kind === 'calories' || value >= h.target);
}
export function missionValue(s: AppState, h: Habit, date: string) {
  return h.kind === 'journal' ? (isDone(s, h, date) ? 1 : 0) : (s.records[date]?.[h.id] ?? 0);
}
export function totalXp(s: AppState, today = localDate()) {
  return [...new Set([...Object.keys(s.records), ...Object.keys(s.journals)])]
    .filter((d) => d <= today)
    .reduce((sum, d) => sum + missionsAt(s, d).filter((h) => isDone(s, h, d)).length * 10, 0);
}
export function streak(s: AppState, id: string, today = localDate()) {
  let count = 0;
  const starts = s.habits
    .filter((h) => h.id === id)
    .map((h) => h.effectiveFrom)
    .sort();
  const start = starts[0] ?? today;
  for (let d = today; d >= start; d = addDays(d, -1)) {
    const h = missionsAt(s, d).find((x) => x.id === id);
    if (!h) continue;
    if (isDone(s, h, d)) count++;
    else if (d !== today) break;
  }
  return count;
}
export function completion(s: AppState, start: string, end: string) {
  let planned = 0,
    done = 0;
  datesBetween(start, end).forEach((d) =>
    missionsAt(s, d).forEach((h) => {
      planned++;
      if (isDone(s, h, d)) done++;
    }),
  );
  return { planned, done, percent: planned ? Math.round((done / planned) * 100) : 0 };
}
export function latestMeasurement(s: AppState, id: string) {
  return s.measurements
    .filter((m) => m.goalId === id)
    .sort((a, b) => a.date.localeCompare(b.date))
    .at(-1);
}
export function goalProgress(g: Goal, value: number) {
  return g.start === g.target
    ? value === g.target
      ? 100
      : 0
    : Math.max(0, Math.min(100, ((value - g.start) / (g.target - g.start)) * 100));
}
export function addVersion(s: AppState, h: Habit, from: string, to?: string): AppState {
  return {
    ...s,
    habits: [...s.habits, { ...h, effectiveFrom: from, effectiveTo: to, versionId: uid() }],
  };
}
export function ruleSuggestions(s: AppState, week: string, today = localDate()): Suggestion[] {
  const end = addDays(week, 6) < today ? addDays(week, 6) : today;
  return habitsAt(s, addDays(week, 7))
    .filter((h) => h.area !== 'nutrition')
    .map((h) => {
      const occasions = datesBetween(week, end).filter((d) =>
        missionsAt(s, d).some((x) => x.id === h.id),
      );
      const done = occasions.filter((d) => {
        const actual = missionsAt(s, d).find((x) => x.id === h.id)!;
        return isDone(s, actual, d);
      }).length;
      const pastMisses = occasions.filter(
        (d) =>
          d < today &&
          !isDone(
            s,
            missionsAt(s, d).find((x) => x.id === h.id)!,
            d,
          ),
      ).length;
      return {
        habitId: h.id as Suggestion['habitId'],
        reason: occasions.length
          ? `${done} de ${occasions.length} ocasiones completadas; ${pastMisses} pendientes en días cerrados.`
          : 'Todavía no hay suficientes registros.',
        change:
          pastMisses >= 2
            ? 'Revisa los días y la carga antes de repetir la semana.'
            : 'Mantén la programación y prepara un momento concreto.',
        effect: 'La propuesta conserva el objetivo actual; puedes editarla antes de aceptar.',
        days: [...h.days],
        target: h.target,
      };
    });
}
export function applyReview(
  s: AppState,
  week: string,
  suggestions: Suggestion[],
  wins: string,
  obstacles: string,
  today = localDate(),
): AppState {
  const from = addDays(week, 7),
    to = addDays(week, 13);
  if (from <= today)
    throw Error('Elige una semana cuya planificación siguiente todavía sea futura.');
  const validated = z.array(suggestionSchema).max(8).parse(suggestions);
  if (new Set(validated.map((x) => x.habitId)).size !== validated.length)
    throw Error('Aprueba una sola propuesta por actividad.');
  const appliedIds: string[] = [];
  const habits = [...s.habits];
  for (const x of validated) {
    const h = habitsAt({ ...s, habits }, from).find((h) => h.id === x.habitId);
    if (!h) continue;
    if (['session', 'journal'].includes(h.kind) && x.target !== 1)
      throw Error('Las sesiones y las entradas de diario se registran una vez por ocasión.');
    if (h.area === 'nutrition' && (x.target !== h.target || x.days.join(',') !== h.days.join(',')))
      throw Error('Los objetivos nutricionales se editan en Planificación.');
    const versionId = uid();
    habits.push({
      ...h,
      versionId,
      effectiveFrom: from,
      effectiveTo: to,
      target: x.target,
      days: x.days,
    });
    appliedIds.push(versionId);
  }
  return {
    ...s,
    habits,
    reviews: [
      ...s.reviews,
      { id: uid(), week, created: today, wins, obstacles, suggestions, appliedIds, undone: false },
    ],
  };
}
export function undoReview(s: AppState, id: string, today = localDate()): AppState {
  const r = s.reviews.find((r) => r.id === id);
  if (!r || addDays(r.week, 7) <= today)
    throw Error('Solo se pueden deshacer planes que todavía no comenzaron.');
  return {
    ...s,
    habits: s.habits.filter((h) => !r.appliedIds.includes(h.versionId)),
    reviews: s.reviews.map((x) => (x.id === id ? { ...x, undone: true } : x)),
  };
}
export function validateState(input: unknown): AppState {
  const s = stateSchema.parse(input);
  const definitions = initialState(s.cycleStart);
  const expected = definitions.habits.map((h) => h.id);
  if (
    expected.some((id) => !s.habits.some((h) => h.id === id)) ||
    ['weight', 'fat', 'visceral'].some((id) => !s.goals.some((g) => g.id === id))
  )
    throw Error('La copia no contiene las metas y hábitos requeridos.');
  if (
    s.habits.some((h) => {
      const definition = definitions.habits.find((x) => x.id === h.id);
      return (
        !definition ||
        definition.kind !== h.kind ||
        definition.area !== h.area ||
        (h.effectiveTo && h.effectiveTo < h.effectiveFrom) ||
        (['session', 'journal'].includes(h.kind) && h.target !== 1)
      );
    })
  )
    throw Error('La copia contiene una programación incompatible.');
  if (new Set(s.habits.map((h) => h.versionId)).size !== s.habits.length)
    throw Error('Hay versiones de hábitos duplicadas.');
  if (
    s.goals.some((g) => g.habitIds.some((id) => !expected.includes(id))) ||
    Object.values(s.records).some((day) => Object.keys(day).some((id) => !expected.includes(id)))
  )
    throw Error('Hay registros o metas con actividades desconocidas.');
  if (
    s.measurements.some((m) => !s.goals.some((g) => g.id === m.goalId)) ||
    new Set(s.measurements.map((m) => m.goalId + '|' + m.date)).size !== s.measurements.length
  )
    throw Error('Medición duplicada o sin meta válida.');
  return s;
}
