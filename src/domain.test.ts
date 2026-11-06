import { describe, expect, it } from 'vitest';
import {
  addDays,
  addVersion,
  applyReview,
  completedMissionsAt,
  completion,
  currentPeriodIndex,
  emptyJournal,
  habitsAt,
  initialState,
  isSimpleMissionAt,
  isDone,
  missionsAt,
  missionsForDisplayAt,
  monthPeriods,
  ruleSuggestions,
  recordedCalorieBalance,
  renameHabit,
  streak,
  totalXp,
  undoReview,
  updateGoal,
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
  it('selecciona el periodo que contiene la fecha de Planificación', () => {
    expect(currentPeriodIndex('2026-09-21', '2026-10-26')).toBe(1);
    expect(currentPeriodIndex('2026-09-21', '2026-09-20')).toBe(0);
    expect(currentPeriodIndex('2026-09-21', '2027-01-01')).toBe(2);
  });
  it('calcula el balance registrado solo con ambos datos y conserva el valor cero', () => {
    const s = initialState(monday);
    expect(recordedCalorieBalance(s, monday)).toBeNull();
    s.records[monday] = { calories: 0 };
    expect(recordedCalorieBalance(s, monday)).toBeNull();
    s.calorieExpenditure = { [monday]: 0 };
    expect(recordedCalorieBalance(s, monday)).toEqual({
      consumption: 0,
      expenditure: 0,
      balance: 0,
    });
    s.calorieExpenditure[monday] = 3000;
    s.records[monday].calories = 2076;
    expect(recordedCalorieBalance(s, monday)?.balance).toBe(924);
    s.records[monday].calories = 3200;
    expect(recordedCalorieBalance(s, monday)?.balance).toBe(-200);
    s.records[monday].calories = 3000;
    expect(recordedCalorieBalance(s, monday)?.balance).toBe(0);
  });
  it('distingue la programación diaria de una versión posterior restringida', () => {
    let s = initialState('2026-09-21');
    const cardio = habitsAt(s, '2026-09-21').find((h) => h.id === 'cardio')!;
    s = addVersion(
      s,
      { ...cardio, name: 'Cardio diario', days: [0, 1, 2, 3, 4, 5, 6] },
      '2026-09-21',
    );
    s = addVersion(s, { ...cardio, name: 'Cardio diario', days: [2, 4, 6] }, '2026-10-21');

    expect(currentPeriodIndex(s.cycleStart, '2026-10-26')).toBe(1);
    expect(habitsAt(s, '2026-09-26').find((h) => h.id === 'cardio')?.days).toEqual([
      0, 1, 2, 3, 4, 5, 6,
    ]);
    expect(missionsAt(s, '2026-09-26').some((h) => h.id === 'cardio')).toBe(true);
    expect(habitsAt(s, '2026-10-26').find((h) => h.id === 'cardio')?.days).toEqual([2, 4, 6]);
    expect(missionsAt(s, '2026-10-26').some((h) => h.id === 'cardio')).toBe(false);

    let uninterrupted = initialState('2026-09-21');
    const uninterruptedCardio = habitsAt(uninterrupted, uninterrupted.cycleStart).find(
      (h) => h.id === 'cardio',
    )!;
    uninterrupted = addVersion(
      uninterrupted,
      { ...uninterruptedCardio, name: 'Cardio diario', days: [0, 1, 2, 3, 4, 5, 6] },
      '2026-09-21',
    );
    expect(missionsAt(uninterrupted, '2026-10-26').some((h) => h.id === 'cardio')).toBe(true);
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
  it('retira agua y proteína de las misiones visibles sin perder XP del corte', () => {
    const state = initialState('2026-10-01');
    const water = state.habits.find((habit) => habit.id === 'water')!;
    const updated = addVersion(state, { ...water, target: 2 }, '2026-11-01');
    const cutoff = '2026-11-03';
    updated.records['2026-11-02'] = { water: 2, protein: 1 };
    updated.records[cutoff] = { water: 2, protein: 1 };
    const xpBeforeCutoff = totalXp(updated, cutoff);

    expect(missionsAt(updated, '2026-11-02').map((habit) => habit.id)).toContain('water');
    expect(missionsAt(updated, cutoff).map((habit) => habit.id)).not.toContain('water');
    expect(missionsAt(updated, cutoff).map((habit) => habit.id)).not.toContain('protein');
    expect(completedMissionsAt(updated, cutoff).map((habit) => habit.id)).toEqual(
      expect.arrayContaining(['water', 'protein']),
    );
    expect(missionsForDisplayAt(updated, cutoff).map((habit) => habit.id)).not.toEqual(
      expect.arrayContaining(['water', 'protein']),
    );
    expect(totalXp(updated, cutoff)).toBe(xpBeforeCutoff);
    expect(completion(updated, cutoff, cutoff).percent).toBeLessThanOrEqual(100);
  });

  it('usa controles binarios desde el corte y conserva el criterio histórico antes', () => {
    const state = initialState('2026-10-01');
    const reading = state.habits.find((habit) => habit.id === 'reading')!;
    const meditation = state.habits.find((habit) => habit.id === 'meditation')!;

    expect(isSimpleMissionAt(reading, '2026-11-02')).toBe(false);
    expect(isSimpleMissionAt(reading, '2026-11-03')).toBe(true);
    expect(isSimpleMissionAt(meditation, '2026-11-03')).toBe(true);
    state.records['2026-11-03'] = { reading: reading.target, meditation: 0 };
    expect(isDone(state, reading, '2026-11-03')).toBe(true);
    expect(isDone(state, meditation, '2026-11-03')).toBe(false);
    expect(totalXp(state, '2026-11-03')).toBe(10);
  });

  it('el No del diario prevalece sin borrar la entrada publicada ni alterar XP anterior', () => {
    const state = initialState('2026-10-01');
    const journal = state.habits.find((habit) => habit.id === 'journal')!;
    state.journals['2026-11-02'] = {
      ...emptyJournal(),
      published: true,
      good: 'Avancé',
      bad: 'Me distraje',
    };
    state.journals['2026-11-03'] = {
      ...emptyJournal(),
      published: true,
      good: 'Avancé',
      bad: 'Me distraje',
    };
    state.records['2026-11-02'] = { journal: 0 };
    expect(totalXp(state, '2026-11-03')).toBe(20);
    expect(isDone(state, journal, '2026-11-02')).toBe(true);
    state.records['2026-11-03'] = { journal: 0 };
    expect(isSimpleMissionAt(journal, '2026-11-03')).toBe(true);
    expect(isDone(state, journal, '2026-11-03')).toBe(false);
    expect(state.journals['2026-11-03'].published).toBe(true);
    expect(totalXp(state, '2026-11-03')).toBe(10);
    state.records['2026-11-03'].journal = 1;
    expect(isDone(state, journal, '2026-11-03')).toBe(true);
  });

  it('oculta misiones de diario en la lista visible y conserva historial y XP', () => {
    const state = initialState(monday);
    const journal = state.habits.find((habit) => habit.id === 'journal')!;
    state.journals[monday] = {
      ...emptyJournal(),
      published: true,
      good: 'Avancé',
      bad: 'Me distraje',
    };
    const xpBefore = totalXp(state, monday);
    expect(xpBefore).toBe(10);

    expect(missionsForDisplayAt(state, monday).some((habit) => habit.id === 'journal')).toBe(false);
    expect(completedMissionsAt(state, monday).some((habit) => habit.id === 'journal')).toBe(true);
    expect(isDone(state, journal, monday)).toBe(true);
    expect(totalXp(state, monday)).toBe(xpBefore);
    expect(missionsAt(state, '2026-11-06').some((habit) => habit.id === 'journal')).toBe(false);

    const renamedByKind = {
      ...state,
      habits: state.habits.map((habit) =>
        habit.id === 'journal'
          ? { ...habit, id: 'personal-reflection', name: 'Reflexión personalizada' }
          : habit,
      ),
    };
    expect(missionsForDisplayAt(renamedByKind, monday).some((habit) => habit.kind === 'journal')).toBe(false);
    expect(missionsAt(renamedByKind, '2026-11-06').some((habit) => habit.kind === 'journal')).toBe(false);
  });

  it('conserva un cumplimiento si después se cambia retroactivamente el día', () => {
    let s = initialState(monday);
    const strength = habitsAt(s, monday).find((h) => h.id === 'strength')!;
    s.records[monday] = { strength: 1 };
    s = addVersion(s, { ...strength, days: [2, 4, 5] }, monday);

    expect(missionsAt(s, monday).some((h) => h.id === 'strength')).toBe(false);
    expect(completedMissionsAt(s, monday).some((h) => h.id === 'strength')).toBe(true);
    expect(completion(s, monday, monday)).toEqual({ planned: 7, done: 1, percent: 14 });
    expect(totalXp(s, monday)).toBe(10);
  });
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
  it('acepta copias antiguas sin gasto calórico y conserva el campo nuevo', () => {
    const legacy = initialState(monday);
    const loadedLegacy = validateState(JSON.parse(JSON.stringify(legacy)));
    expect(loadedLegacy.calorieExpenditure).toBeUndefined();

    const withExpenditure = {
      ...legacy,
      calorieExpenditure: { [monday]: 700 },
    };
    expect(validateState(JSON.parse(JSON.stringify(withExpenditure)))).toEqual(withExpenditure);
    expect(() =>
      validateState({ ...withExpenditure, calorieExpenditure: { [monday]: -1 } }),
    ).toThrow();
    expect(() =>
      validateState({ ...withExpenditure, calorieExpenditure: { [monday]: NaN } }),
    ).toThrow();
  });
  it('no pierde los registros al versionar una meta de hábito', () => {
    let s = initialState(monday);
    s.records[monday] = { reading: 20 };
    const reading = habitsAt(s, monday).find((h) => h.id === 'reading')!;
    s = addVersion(s, { ...reading, target: 30 }, '2026-09-21');
    expect(totalXp(s, '2026-09-22')).toBe(10);
  });
  it('renombra una meta sin perder id, progreso, hitos ni hábitos vinculados', () => {
    const s = initialState(monday);
    const goal = s.goals[0];
    s.measurements = [{ id: 'measurement', date: monday, goalId: goal.id, value: 86 }];
    s.milestones['2026-09-14-0'] = { [goal.id]: 87 };

    const updated = updateGoal(s, { ...goal, name: '  Composición corporal  ' });

    expect(updated.goals[0]).toEqual({ ...goal, name: 'Composición corporal' });
    expect(updated.measurements).toEqual(s.measurements);
    expect(updated.milestones).toEqual(s.milestones);
    expect(() => updateGoal(s, { ...goal, name: '   ' })).toThrow('nombre');
  });
  it('renombra todas las versiones de una acción sin tocar registros ni programación', () => {
    let s = initialState(monday);
    const strength = s.habits.find((h) => h.id === 'strength')!;
    s = addVersion(s, { ...strength, days: [1, 3, 5] }, '2026-09-21', '2026-09-27');
    s.records[monday] = { strength: 1 };
    const before = s.habits.filter((h) => h.id === 'strength').map(({ name, ...h }) => h);

    const renamed = renameHabit(s, 'strength', '  Fuerza  ');

    expect(
      renamed.habits.filter((h) => h.id === 'strength').every((h) => h.name === 'Fuerza'),
    ).toBe(true);
    expect(renamed.habits.filter((h) => h.id === 'strength').map(({ name, ...h }) => h)).toEqual(
      before,
    );
    expect(renamed.records).toEqual(s.records);
    expect(() => renameHabit(s, 'strength', '   ')).toThrow('nombre');
  });
});
