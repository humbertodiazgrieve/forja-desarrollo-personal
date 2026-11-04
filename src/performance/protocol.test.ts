import { describe, expect, it } from 'vitest';
import { initialState, validateState } from '../domain';
import { isTrustedFitnessMessage, validateFitnessData } from './protocol';

const emptyFitness = () => ({
  schemaVersion: 1,
  profile: { heightCm: null, ageAtCutoff: null, vo2max: null, fatGoalPct: null },
  bio: [],
  octDetail: { bmi: null, reportedFatFreeMass: null, visceralIndex: null, bmrKcal: null },
  runs: [],
  activity: { month: '', days: null, steps: null, km: null, activeKcal: null },
  nutrition: { kcal: null, proteinG: null, carbsG: null, fatG: null, tdeeLow: null, tdeeHigh: null, logs: [] },
  week: [],
  core: [],
  notes: [],
  checks: {},
});

describe('integración Fitness OS', () => {
  it('solo confía en mensajes del iframe local esperado', () => {
    const frame = {} as MessageEventSource;
    expect(isTrustedFitnessMessage('https://forja.test', frame, 'https://forja.test', frame)).toBe(true);
    expect(isTrustedFitnessMessage('https://attacker.test', frame, 'https://forja.test', frame)).toBe(false);
    expect(isTrustedFitnessMessage('https://forja.test', {} as MessageEventSource, 'https://forja.test', frame)).toBe(false);
  });
  it('acepta un estado vacío sin transformar valores desconocidos en cero', () => {
    expect(validateFitnessData(emptyFitness()).bio).toEqual([]);
    expect((validateFitnessData(emptyFitness()).activity as { steps: unknown }).steps).toBeNull();
  });

  it('rechaza copias incompletas, fechas imposibles y valores físicos fuera de rango', () => {
    expect(() => validateFitnessData({ schemaVersion: 1 })).toThrow('Falta el bloque profile');
    const invalidDate = emptyFitness();
    (invalidDate.bio as unknown[]).push({ date: '2026-02-30', weight: 80, source: 'sintético', fat: null, muscle: null, water: null, fatPct: null });
    expect(() => validateFitnessData(invalidDate)).toThrow('fecha válida');
    const invalidBody = emptyFitness();
    (invalidBody.bio as unknown[]).push({ date: '2026-02-28', weight: 0, source: 'sintético', fat: null, muscle: null, water: null, fatPct: null });
    expect(() => validateFitnessData(invalidBody)).toThrow('peso');
  });

  it('mantiene la compatibilidad de respaldos Forja antiguos y persiste Performance en el estado', () => {
    const legacy = initialState('2026-11-04');
    expect(validateState(legacy)).toEqual(legacy);
    const current = { ...legacy, performanceData: emptyFitness() };
    expect(validateState(current).performanceData).toEqual(emptyFitness());
    expect(() => validateState({ ...legacy, performanceData: { schemaVersion: 1 } })).toThrow();
  });
});
