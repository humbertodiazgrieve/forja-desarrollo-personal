export type FitnessData = Record<string, unknown> & { schemaVersion: 1 };

export function isTrustedFitnessMessage(
  eventOrigin: string,
  eventSource: MessageEventSource | null,
  expectedOrigin: string,
  expectedSource: MessageEventSource | null,
) {
  return eventOrigin === expectedOrigin && eventSource === expectedSource && expectedSource !== null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

function finiteOrNull(value: unknown, min = 0, max = 1_000_000) {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max);
}
const validDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
const record = (value: unknown): value is Record<string, unknown> => isRecord(value);
const list = (value: unknown): unknown[] => {
  if (!Array.isArray(value)) throw Error('La copia de Fitness OS tiene listas incompletas.');
  return value;
};

export function validateFitnessData(value: unknown): FitnessData {
  if (!isRecord(value) || value.schemaVersion !== 1) throw Error('El JSON no es una copia compatible de Fitness OS.');
  const json = JSON.stringify(value);
  if (json.length > 2_000_000) throw Error('La copia de Fitness OS supera el límite de 2 MB.');
  for (const key of ['profile', 'octDetail', 'activity', 'nutrition', 'checks'])
    if (!isRecord(value[key])) throw Error(`Falta el bloque ${key} en la copia.`);
  const profile = value.profile as Record<string, unknown>;
  for (const key of ['heightCm', 'ageAtCutoff', 'vo2max', 'fatGoalPct'])
    if (!finiteOrNull(profile[key], 0, 1000)) throw Error(`Valor no válido: ${key}.`);
  const bio = list(value.bio), dates = new Set<string>();
  for (const [index, row] of bio.entries()) {
    if (!record(row) || !validDate(row.date) || dates.has(row.date))
      throw Error(`La medición ${index + 1} no tiene una fecha válida.`);
    dates.add(row.date);
    if (!finiteOrNull(row.weight, 1, 500) || row.weight === null) throw Error(`El peso de la medición ${index + 1} no es válido.`);
    for (const key of ['fat', 'muscle', 'water', 'fatPct'])
      if (!finiteOrNull(row[key], 0, 500)) throw Error(`Valor no válido en ${key}.`);
    if (typeof row.source !== 'string') throw Error('Cada medición debe indicar su fuente o condiciones.');
  }
  for (const [index, row] of list(value.runs).entries()) {
    if (!record(row) || !validDate(row.date) || !finiteOrNull(row.km, 0, 1000) || row.km === null)
      throw Error(`La sesión de actividad ${index + 1} no es válida.`);
    for (const key of ['paceSec', 'avgHr', 'maxHr', 'durationSec', 'activeKcal', 'totalKcal'])
      if (!finiteOrNull(row[key], 0, 100_000)) throw Error(`Valor no válido en ${key}.`);
  }
  const nutrition = value.nutrition as Record<string, unknown>;
  for (const key of ['kcal', 'proteinG', 'carbsG', 'fatG', 'tdeeLow', 'tdeeHigh'])
    if (!finiteOrNull(nutrition[key], 0, 20_000))
      throw Error(`Valor nutricional no válido: ${key}.`);
  if (!Array.isArray(nutrition.logs)) throw Error('Faltan registros de nutrición.');
  for (const row of nutrition.logs) {
    if (!record(row) || !validDate(row.date) || !finiteOrNull(row.kcal, 0, 20_000) || typeof row.incomplete !== 'boolean')
      throw Error('Un registro de nutrición no es válido.');
  }
  const activity = value.activity as Record<string, unknown>;
  if (typeof activity.month !== 'string') throw Error('El periodo de actividad no es válido.');
  for (const key of ['days', 'steps', 'km', 'activeKcal'])
    if (!finiteOrNull(activity[key], 0, 100_000_000)) throw Error(`Valor no válido en actividad: ${key}.`);
  for (const [index, row] of list(value.week).entries())
    if (!record(row) || ['day', 'strength', 'cardio'].some((key) => typeof row[key] !== 'string'))
      throw Error(`La rutina ${index + 1} no es válida.`);
  for (const [index, row] of list(value.core).entries())
    if (!record(row) || ['exercise', 'dose'].some((key) => typeof row[key] !== 'string'))
      throw Error(`El ejercicio ${index + 1} no es válido.`);
  if (list(value.notes).some((note) => typeof note !== 'string')) throw Error('Las notas deben ser texto.');
  const detail = value.octDetail as Record<string, unknown>;
  for (const key of ['bmi', 'reportedFatFreeMass', 'visceralIndex', 'bmrKcal'])
    if (!finiteOrNull(detail[key], 0, 10_000)) throw Error(`Valor no válido en detalle: ${key}.`);
  return value as FitnessData;
}
