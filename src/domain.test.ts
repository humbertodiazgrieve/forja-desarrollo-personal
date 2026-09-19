import { describe, expect, it } from 'vitest';
import {
  addDays,
  addVersion,
  applyReview,
  completion,
  emptyJournal,
  habitsAt,
  initialState,
  isDone,
  missionsAt,
  monthPeriods,
  ruleSuggestions,
  streak,
  totalXp,
  undoReview,
  validateState,
} from './domain';
const monday = '2026-09-14';
describe('Calendario y planificación', () => {
  it('divide tres meses sin huecos al empezar un 31', () => {
    expect(monthPeriods('2027-01-31')).toEqual([
      { start: '2027-01-31', end: '2027-02-27' },
      { start: '2027-02-28', end: '2027-03-30' },
      { start: '2027-03-31', end: '2027-04-29' },
    ]);
  });
  it('respeta febrero bisiesto', () => {
    expect(monthPeriods('2028-01-31')[1].start).toBe('2028-02-29');
  });
  it('la fecha del trimestre no cambia la fecha física', () => {
    const s = initialState(monday);
    s.cycleStart = '2026-10-15';
    expect(s.goals.every((g) => g.deadline === '2026-11-30')).toBe(true);
  });
  it('programa cuatro sesiones de fuerza y tres de cardio sin duplicados', () => {
    const s = initialState(monday);
    const h = Array.from({ length: 7 }, (_, n) => missionsAt(s, addDays(monday, n)));
    expect(h.flat().filter((x) => x.id === 'strength')).toHaveLength(4);
    expect(h.flat().filter((x) => x.id === 'cardio')).toHaveLength(3);
    h.forEach((day) => expect(new Set(day.map((x) => x.id)).size).toBe(day.length));
    expect(h[1].filter((x) => x.kind === 'session')).toHaveLength(2);
  });
  it('cuenta una semana parcial por sus días reales', () => {
    const s = initialState(monday);
    expect(completion(s, monday, monday).planned).toBe(7);
  });
  it('preserva objetivos históricos y termina un ajuste temporal', () => {
    let s = initialState(monday);
    const water = habitsAt(s, monday).find((h) => h.id === 'water')!;
    s = addVersion(s, { ...water, target: 2 }, '2026-09-21', '2026-09-27');
    expect(habitsAt(s, '2026-09-20').find((h) => h.id === 'water')?.target).toBe(3);
    expect(habitsAt(s, '2026-09-25').find((h) => h.id === 'water')?.target).toBe(2);
    expect(habitsAt(s, '2026-09-28').find((h) => h.id === 'water')?.target).toBe(3);
  });
});
describe('Registros y recompensas', () => {
  it('registrar cero calorías es diferente de no registrar; comer menos no da más XP', () => {
    const s = initialState(monday),
      h = missionsAt(s, monday).find((h) => h.id === 'calories')!;
    expect(isDone(s, h, monday)).toBe(false);
    s.records[monday] = { calories: 0 };
    expect(isDone(s, h, monday)).toBe(true);
    expect(totalXp(s, monday)).toBe(10);
    s.records[monday].calories = 2300;
    expect(totalXp(s, monday)).toBe(10);
  });
  it('cumplir por encima del objetivo no duplica XP, corregir ajusta XP', () => {
    const s = initialState(monday);
    s.records[monday] = { water: 3 };
    expect(totalXp(s, monday)).toBe(10);
    s.records[monday].water = 5;
    expect(totalXp(s, monday)).toBe(10);
    s.records[monday].water = 2;
    expect(totalXp(s, monday)).toBe(0);
  });
  it('el borrador no completa escritura; publicar dos reflexiones sí', () => {
    const s = initialState(monday);
    const h = missionsAt(s, monday).find((h) => h.id === 'journal')!;
    s.journals[monday] = { ...emptyJournal(), good: 'Leí', bad: 'Distracciones' };
    expect(isDone(s, h, monday)).toBe(false);
    s.journals[monday].published = true;
    expect(totalXp(s, monday)).toBe(10);
    s.journals[monday].published = true;
    expect(totalXp(s, monday)).toBe(10);
    s.journals[monday].bad = ' ';
    expect(totalXp(s, monday)).toBe(0);
  });
  it('los descansos mantienen rachas y hoy pendiente no las rompe', () => {
    const s = initialState(monday);
    s.records[monday] = { strength: 1 };
    s.records['2026-09-15'] = { strength: 1 };
    expect(streak(s, 'strength', '2026-09-16')).toBe(2);
    expect(streak(s, 'strength', '2026-09-17')).toBe(2);
    expect(streak(s, 'strength', '2026-09-18')).toBe(0);
    expect(totalXp(s, '2026-09-18')).toBe(20);
  });
  it('no recompensa sesiones no programadas ni datos futuros', () => {
    const s = initialState(monday);
    s.records['2026-09-16'] = { strength: 1 };
    s.records['2026-09-21'] = { water: 3 };
    expect(totalXp(s, '2026-09-20')).toBe(0);
  });
  it('no inventa mediciones al completar hábitos', () => {
    const s = initialState(monday);
    s.records[monday] = { water: 3, strength: 1 };
    expect(s.measurements).toEqual([]);
    expect(s.goals[0].start).toBe(88);
  });
});
describe('Revisión y copias', () => {
  it('propone hábitos aunque el trimestre comience a mitad de semana', () => {
    const s = initialState('2026-09-16');
    expect(ruleSuggestions(s, monday, '2026-09-20')).toHaveLength(5);
  });
  it('rechaza propuestas duplicadas y metas incompatibles con una sesión', () => {
    const s = initialState(monday);
    const r = ruleSuggestions(s, monday, '2026-09-20')[0];
    expect(() => applyReview(s, monday, [r, r], '', '', '2026-09-20')).toThrow();
    expect(() => applyReview(s, monday, [{ ...r, target: 2 }], '', '', '2026-09-20')).toThrow();
  });
  it('rechaza copias con hábitos de tipo incorrecto y mediciones duplicadas', () => {
    const s = initialState(monday);
    s.habits[0].kind = 'calories';
    expect(() => validateState(s)).toThrow();
    s.habits[0].kind = 'session';
    s.measurements = [
      { id: 'a', date: monday, goalId: 'weight', value: 88 },
      { id: 'b', date: monday, goalId: 'weight', value: 87 },
    ];
    expect(() => validateState(s)).toThrow();
  });
  it('aplica solo la próxima semana y se puede deshacer antes de comenzar', () => {
    const s = initialState(monday),
      r = ruleSuggestions(s, monday, '2026-09-20')[0];
    r.days = [1, 3, 5, 6];
    const next = applyReview(s, monday, [r], 'Bien', 'Mejorar', '2026-09-20');
    expect(habitsAt(next, monday).find((h) => h.id === r.habitId)?.days).toEqual(s.habits[0].days);
    expect(habitsAt(next, '2026-09-21').find((h) => h.id === r.habitId)?.days).toEqual(r.days);
    const restored = undoReview(next, next.reviews[0].id, '2026-09-20');
    expect(habitsAt(restored, '2026-09-21')[0].days).toEqual(s.habits[0].days);
    expect(() => undoReview(next, next.reviews[0].id, '2026-09-21')).toThrow();
  });
  it('bloquea replanificación retroactiva', () => {
    expect(() => applyReview(initialState(monday), monday, [], '', '', '2026-09-21')).toThrow();
  });
  it('rechaza cambios nutricionales desde sugerencias', () => {
    const s = initialState(monday);
    expect(() =>
      applyReview(
        s,
        monday,
        [{ habitId: 'water', target: 1, days: [1], reason: '', change: '', effect: '' }],
        '',
        '',
        '2026-09-20',
      ),
    ).toThrow();
  });
  it('serializa el estado completo y rechaza una copia mal formada', () => {
    const s = initialState(monday);
    s.journals[monday] = { ...emptyJournal(), body: 'Mi entrada' };
    s.widgets[0].visible = false;
    s.quotes.push({ id: 'q', text: 'Mi frase' });
    const round = validateState(JSON.parse(JSON.stringify(s)));
    expect(round).toEqual(s);
    expect(() => validateState({ ...s, schema: 2 })).toThrow();
    expect(() =>
      validateState({ ...s, widgets: [s.widgets[0], ...s.widgets.slice(0, 6)] }),
    ).toThrow();
    expect(() => validateState({ ...s, records: { '2026-02-31': { water: 3 } } })).toThrow();
  });
  it('no pierde los registros al versionar una meta de hábito', () => {
    let s = initialState(monday);
    s.records[monday] = { reading: 20 };
    const reading = habitsAt(s, monday).find((h) => h.id === 'reading')!;
    s = addVersion(s, { ...reading, target: 30 }, '2026-09-21');
    expect(totalXp(s, '2026-09-22')).toBe(10);
  });
});
