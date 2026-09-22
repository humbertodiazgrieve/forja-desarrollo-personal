import { useState } from 'react';
import { CalendarDays, Check, ChevronRight, Pencil, Target, ArrowRight } from 'lucide-react';
import {
  addDays,
  addVersion,
  areaNames,
  datesBetween,
  formatDate,
  habitsAt,
  localDate,
  missionsAt,
  monthPeriods,
  uid,
  type Goal,
  type Habit,
} from './domain';
import { Badge, DayPicker, Field, HabitIcon, Heading, Modal, longDays, type PageProps } from './ui';
export function Planning(p: PageProps) {
  const today = localDate(),
    [selectedMonth, setSelectedMonth] = useState(0),
    [editHabit, setEditHabit] = useState<Habit | null>(null),
    [from, setFrom] = useState(addDays(today, 1)),
    [to, setTo] = useState(''),
    [goal, setGoal] = useState<Goal | null>(null),
    [cycle, setCycle] = useState(p.state.cycleStart);
  const periods = monthPeriods(p.state.cycleStart),
    period = periods[selectedMonth],
    schedule = [
      ...new Map(
        datesBetween(period.start, period.end)
          .flatMap((d) => habitsAt(p.state, d))
          .map((h) => [h.id, h] as const),
      ).values(),
    ];
  const openHabit = (h: Habit, monthly = false) => {
    setEditHabit(structuredClone(h));
    setFrom(monthly ? period.start : h.effectiveFrom);
    setTo(monthly ? period.end : h.effectiveTo ?? '');
  };
  return (
    <>
      <Heading
        eyebrow="DALE DIRECCIÓN A TU ESFUERZO"
        title="El mapa de tu progreso"
        description="Un trimestre con propósito. Un mes a la vez. Una acción cada día."
      />
      <section className="panel cycle-panel">
        <div>
          <div className="eyebrow">TU TRIMESTRE</div>
          <h2>
            {formatDate(p.state.cycleStart)} <span className="subtle">—</span>{' '}
            {formatDate(periods[2].end, { day: 'numeric', month: 'long', year: 'numeric' })}
          </h2>
          <p>Tres meses desde la fecha que tú elijas.</p>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            p.update((s) => {
              s.cycleStart = cycle;
              if (
                !s.onboarded &&
                !Object.keys(s.records).length &&
                !Object.keys(s.journals).length
              ) {
                s.habits = s.habits.map((h) => ({ ...h, effectiveFrom: cycle }));
              }
              s.onboarded = true;
            });
            p.notify('Trimestre guardado. Tus metas conservan su fecha límite.');
          }}
        >
          <Field label="Fecha de inicio">
            <input type="date" required value={cycle} onChange={(e) => setCycle(e.target.value)} />
          </Field>
          <button className="primary">
            <Check size={16} /> Guardar trimestre
          </button>
        </form>
      </section>
      <div className="section-title outside">
        <div>
          <h2>Tus grandes objetivos</h2>
          <p>El destino está claro; el camino se puede ajustar.</p>
        </div>
        <Badge className="gold">
          <Target size={12} /> FÍSICO
        </Badge>
      </div>
      <div className="goal-cards">
        {p.state.goals.map((g) => (
          <section className="panel" key={g.id}>
            <div className="section-title">
              <h3>{g.name}</h3>
              <button
                className="icon-button"
                aria-label={'Editar ' + g.name}
                onClick={() => setGoal({ ...g })}
              >
                <Pencil size={16} />
              </button>
            </div>
            <div className="goal-journey">
              <span>
                {g.start}
                <small>{g.unit}</small>
              </span>
              <ArrowRight size={23} />
              <strong>
                {g.target}
                <small>{g.unit}</small>
              </strong>
            </div>
            <p className="subtle">
              Fecha objetivo ·{' '}
              {formatDate(g.deadline, { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <div className="linked-habits">
              {g.habitIds.map((id) => (
                <span key={id} title={p.state.habits.find((h) => h.id === id)?.name}>
                  <HabitIcon id={id} size={14} />
                </span>
              ))}
            </div>
          </section>
        ))}
      </div>
      <div className="month-tabs">
        {periods.map((month, i) => (
          <button
            key={i}
            className={selectedMonth === i ? 'selected' : ''}
            onClick={() => setSelectedMonth(i)}
          >
            <span>MES {i + 1}</span>
            <strong>
              {formatDate(month.start)} — {formatDate(month.end)}
            </strong>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Hitos del mes {selectedMonth + 1}</h2>
            <p>Define tus resultados intermedios. Puedes dejarlos pendientes.</p>
          </div>
          <CalendarDays size={20} />
        </div>
        <div className="form-grid three">
          {p.state.goals.map((g) => (
            <Field key={g.id} label={`${g.name} (${g.unit})`}>
              <input
                type="number"
                min="0"
                step="any"
                placeholder="Por definir"
                value={p.state.milestones[p.state.cycleStart + '-' + selectedMonth]?.[g.id] ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0)) return;
                  p.update((s) => {
                    const key = s.cycleStart + '-' + selectedMonth;
                    s.milestones[key] ??= {};
                    if (v === '') delete s.milestones[key][g.id];
                    else s.milestones[key][g.id] = Number(v);
                  });
                }}
              />
            </Field>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Acciones que te acercan</h2>
            <p>Los totales cuentan solo las ocasiones programadas dentro del mes.</p>
          </div>
        </div>
        <div className="habit-plan-list">
          {schedule.map((h) => {
            const occasions = datesBetween(period.start, period.end).flatMap((d) =>
              missionsAt(p.state, d).filter((m) => m.id === h.id),
            );
            const quantity = occasions.reduce((n, m) => n + m.target, 0);
            return (
              <div className="habit-plan-row" key={h.id}>
                <span className={'habit-icon ' + h.area}>
                  <HabitIcon id={h.id} />
                </span>
                <div className="habit-plan-name">
                  <strong>{h.name}</strong>
                  <span>
                    {areaNames[h.area]} ·{' '}
                    {h.kind === 'session'
                      ? `${h.days.length} veces / semana`
                      : `${h.target} ${h.unit} / ocasión`}
                  </span>
                  <small>
                    {h.days.length
                      ? h.days.map((day) => longDays[day].slice(0, 3)).join(' · ')
                      : 'Días en descanso'}{' '}
                    · Desde {formatDate(h.effectiveFrom)}
                  </small>
                </div>
                <div className="month-total">
                  <strong>{occasions.length} ocasiones</strong>
                  <small>
                    {h.kind === 'calories'
                      ? 'Registro de consumo'
                      : `${Math.round(quantity * 100) / 100} ${h.unit} en el mes`}
                  </small>
                </div>
                <button className="secondary" onClick={() => openHabit(h, true)}>
                  Ajustar mes
                </button>
                <button
                  className="icon-button"
                  aria-label={'Editar programación de ' + h.name}
                  onClick={() => openHabit(h)}
                >
                  <Pencil size={16} />
                </button>
              </div>
            );
          })}
        </div>
      </section>
      <section className="panel">
        <div className="section-title">
          <h2>Historial de programación</h2>
          <Badge>{p.state.habits.length - 8} ajustes</Badge>
        </div>
        {p.state.habits.length <= 8 ? (
          <p className="subtle">Aquí aparecerán los cambios con sus fechas de vigencia.</p>
        ) : (
          <div className="history-list">
            {p.state.habits
              .slice(8)
              .reverse()
              .map((h) => (
                <div key={h.versionId}>
                  <strong>{h.name}</strong>
                  <span>
                    {h.target} {h.unit} · {h.days.length} días/semana
                  </span>
                  <small>
                    Desde {formatDate(h.effectiveFrom)}
                    {h.effectiveTo ? ` hasta ${formatDate(h.effectiveTo)}` : ''}
                  </small>
                </div>
              ))}
          </div>
        )}
      </section>
      {editHabit && (
        <Modal title={'Programar · ' + editHabit.name} onClose={() => setEditHabit(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (to && to < from) {
                p.notify('La fecha de término debe ser igual o posterior al inicio.');
                return;
              }
              p.update((s) => {
                if (!s.onboarded) {
                  s.habits = s.habits.map((h) =>
                    h.versionId === editHabit.versionId ? { ...editHabit, versionId: uid() } : h,
                  );
                } else Object.assign(s, addVersion(s, editHabit, from, to || undefined));
              });
              p.notify('Programación guardada. El historial se mantiene.');
              setEditHabit(null);
            }}
          >
            <div className="form-grid">
              <Field label="Vigente desde">
                <input
                  required
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </Field>
              <Field label="Hasta (opcional)">
                <input
                  type="date"
                  min={from}
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Días programados"
              hint="Puedes combinar fuerza y cardio el mismo día. Sin días seleccionados, el hábito queda en descanso."
            >
              <DayPicker
                days={editHabit.days}
                onChange={(days) => setEditHabit({ ...editHabit, days })}
              />
            </Field>
            {!['session', 'journal'].includes(editHabit.kind) && (
              <Field label={`Objetivo por ocasión (${editHabit.unit})`}>
                <input
                  required
                  type="number"
                  min="0.01"
                  max="1000000"
                  step="any"
                  value={editHabit.target}
                  onChange={(e) => setEditHabit({ ...editHabit, target: Number(e.target.value) })}
                />
              </Field>
            )}
            <p className="notice">
              {p.state.onboarded
                ? 'Puedes corregir una programación pasada o futura. Si indicas una fecha de término, después volverá la programación anterior.'
                : 'Estás configurando la programación inicial. La fecha y los días elegidos quedarán guardados para esta actividad.'}
            </p>
            <button className="primary full">Guardar programación</button>
          </form>
        </Modal>
      )}
      {goal && (
        <Modal title={'Meta · ' + goal.name} onClose={() => setGoal(null)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              p.update((s) => {
                s.goals = s.goals.map((g) => (g.id === goal.id ? goal : g));
              });
              setGoal(null);
            }}
          >
            <div className="form-grid">
              <Field label={`Valor inicial (${goal.unit})`}>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={goal.start}
                  onChange={(e) => setGoal({ ...goal, start: Number(e.target.value) })}
                />
              </Field>
              <Field label={`Objetivo (${goal.unit})`}>
                <input
                  required
                  type="number"
                  min="0"
                  step="any"
                  value={goal.target}
                  onChange={(e) => setGoal({ ...goal, target: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Fecha objetivo">
              <input
                required
                type="date"
                value={goal.deadline}
                onChange={(e) => setGoal({ ...goal, deadline: e.target.value })}
              />
            </Field>
            <button className="primary full">Guardar meta</button>
          </form>
        </Modal>
      )}
    </>
  );
}
