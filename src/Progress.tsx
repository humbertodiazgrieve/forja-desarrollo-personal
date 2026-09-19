import { useState } from 'react';
import { Plus, Trash2, ArrowRight, Trophy, LockKeyhole, Flame } from 'lucide-react';
import {
  addDays,
  datesBetween,
  formatDate,
  goalProgress,
  latestMeasurement,
  localDate,
  streak,
  totalXp,
  uid,
} from './domain';
import {
  Badge,
  Empty,
  Field,
  HabitIcon,
  Heading,
  Modal,
  SparkChart,
  Warrior,
  type PageProps,
} from './ui';
export function Progress(p: PageProps) {
  const [metric, setMetric] = useState('weight'),
    [measure, setMeasure] = useState(false),
    [day, setDay] = useState(p.date),
    [values, setValues] = useState<Record<string, string>>({}),
    [range, setRange] = useState(90);
  const goal = p.state.goals.find((g) => g.id === metric)!;
  const measures = p.state.measurements
      .filter((m) => m.goalId === metric && m.date >= addDays(p.date, -range) && m.date <= p.date)
      .sort((a, b) => a.date.localeCompare(b.date)),
    last = latestMeasurement(p.state, metric);
  return (
    <>
      <Heading
        eyebrow="OBSERVA EL CAMINO RECORRIDO"
        title="Tu progreso, con perspectiva"
        description="Los datos te orientan. Cada registro cuenta una parte de tu historia."
        action={
          <button
            className="primary"
            onClick={() => {
              setDay(p.date);
              setValues({});
              setMeasure(true);
            }}
          >
            <Plus size={16} /> Registrar medidas
          </button>
        }
      />
      <div className="goal-cards">
        {p.state.goals.map((g) => {
          const m = latestMeasurement(p.state, g.id);
          return (
            <button
              key={g.id}
              className={'panel metric-card ' + (metric === g.id ? 'selected' : '')}
              onClick={() => setMetric(g.id)}
            >
              <span>{g.name}</span>
              <strong>
                {m?.value ?? '—'}
                <small>{g.unit}</small>
              </strong>
              <span>
                Inicio {g.start} <ArrowRight size={12} /> Meta {g.target}
              </span>
              <div className="progress-track">
                <span style={{ width: goalProgress(g, m?.value ?? g.start) + '%' }} />
              </div>
              <small>
                {m ? `Último registro: ${formatDate(m.date)}` : 'Todavía no hay mediciones'}
              </small>
            </button>
          );
        })}
      </div>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>{goal.name}</h2>
            <p>
              Meta: {goal.target} {goal.unit} ·{' '}
              {formatDate(goal.deadline, { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <select
            aria-label="Período de gráficos"
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
          >
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
            <option value={365}>Último año</option>
          </select>
        </div>
        <SparkChart
          data={measures.map((m) => ({ date: m.date, value: m.value }))}
          target={goal.target}
          unit={goal.unit}
        />
        <p className="footnote">
          {last
            ? `Cambio desde el inicio: ${+(last.value - goal.start).toFixed(2)} ${goal.unit}.`
            : 'El valor inicial es una referencia, no una medición fechada.'}{' '}
          Solo se representan valores que hayas registrado.
        </p>
      </section>
      <div className="section-title outside">
        <h2>Tu bienestar mental</h2>
        <Badge className="purple">VALORACIONES PERSONALES</Badge>
      </div>
      <div className="three-grid">
        {[
          { id: 'clarity', name: 'Claridad mental', color: '#b3a0d4' },
          { id: 'patience', name: 'Paciencia', color: '#84bbaa' },
          { id: 'stress', name: 'Estrés', color: '#d1a180' },
        ].map((m) => (
          <section className="panel" key={m.id}>
            <h3>{m.name}</h3>
            <p className="subtle">1 = poco · 5 = mucho</p>
            <SparkChart
              small
              color={m.color}
              data={datesBetween(addDays(p.date, -13), p.date).map((d) => ({
                date: d,
                value: p.state.journals[d]?.[m.id as 'clarity' | 'patience' | 'stress'] ?? null,
              }))}
            />
          </section>
        ))}
      </div>
      <section className="panel">
        <div className="section-title">
          <h2>Historial de mediciones</h2>
          <Badge>{p.state.measurements.length} registros</Badge>
        </div>
        {!p.state.measurements.length ? (
          <Empty title="Empieza con tu primera medición" />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Indicador</th>
                  <th>Valor</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {[...p.state.measurements]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((m) => (
                    <tr key={m.id}>
                      <td>
                        {formatDate(m.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td>{p.state.goals.find((g) => g.id === m.goalId)?.name}</td>
                      <td>
                        {m.value} {p.state.goals.find((g) => g.id === m.goalId)?.unit}
                      </td>
                      <td>
                        <button
                          className="icon-button"
                          aria-label={`Eliminar medición ${m.goalId} ${m.date}`}
                          onClick={() => {
                            p.update((s) => {
                              s.measurements = s.measurements.filter((x) => x.id !== m.id);
                            });
                            p.notify('Medición eliminada. Puedes volver a registrarla.');
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {measure && (
        <Modal title="Un nuevo punto en tu camino" onClose={() => setMeasure(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!p.state.goals.some((g) => values[g.id]?.trim())) {
                p.notify('Introduce al menos una medición.');
                return;
              }
              p.update((s) => {
                for (const g of s.goals) {
                  if (!values[g.id]?.trim()) continue;
                  const value = Number(values[g.id]);
                  if (!Number.isFinite(value) || value < 0) continue;
                  const existing = s.measurements.find((m) => m.date === day && m.goalId === g.id);
                  if (existing) existing.value = value;
                  else s.measurements.push({ id: uid(), date: day, goalId: g.id, value });
                }
              });
              setMeasure(false);
              p.notify('Mediciones guardadas.');
            }}
          >
            <Field label="Fecha de medición">
              <input
                type="date"
                required
                max={localDate()}
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
            </Field>
            {p.state.goals.map((g) => (
              <Field
                key={g.id}
                label={`${g.name} (${g.unit})`}
                hint={
                  p.state.measurements.some((m) => m.goalId === g.id && m.date === day)
                    ? 'Se actualizará la medición existente para esta fecha.'
                    : undefined
                }
              >
                <input
                  type="number"
                  min="0"
                  max="100000"
                  step="any"
                  value={values[g.id] ?? ''}
                  placeholder="Sin registrar"
                  onChange={(e) => setValues({ ...values, [g.id]: e.target.value })}
                />
              </Field>
            ))}
            <button className="primary full">Guardar mediciones</button>
          </form>
        </Modal>
      )}
    </>
  );
}
export function WarriorPage(p: PageProps) {
  const xp = totalXp(p.state),
    level = 1 + Math.floor(xp / 100),
    stages = [
      { level: 1, name: 'Aprendiz', text: 'Toda leyenda comienza con una decisión.' },
      { level: 5, name: 'Guardián', text: 'La constancia se convierte en tu armadura.' },
      { level: 10, name: 'Centinela', text: 'Aprendes a proteger lo que importa.' },
      { level: 15, name: 'Campeón', text: 'Cada regreso te ha hecho más fuerte.' },
      { level: 20, name: 'Leyenda', text: 'El camino continúa. Tu fuerza también.' },
    ];
  return (
    <>
      <Heading
        eyebrow="FORJADO POR TUS ACCIONES"
        title="El guerrero que llevas dentro"
        description="Tu personaje crece con tu constancia. Los días difíciles no borran lo que has construido."
      />
      <section className="panel warrior-showcase">
        <Warrior level={level} large />
        <div>
          <Badge className="gold">
            {stages
              .filter((s) => s.level <= level)
              .at(-1)
              ?.name.toUpperCase()}
          </Badge>
          <h2>Nivel {level}</h2>
          <p>{xp} XP acumulados</p>
          <div className="progress-track">
            <span style={{ width: (xp % 100) + '%' }} />
          </div>
          <p className="subtle">{100 - (xp % 100)} XP para alcanzar el siguiente nivel.</p>
          <div className="rule-chips">
            <span>10 XP por misión</span>
            <span>100 XP por nivel</span>
            <span>Tu experiencia se conserva</span>
          </div>
        </div>
      </section>
      <div className="evolution-track">
        {stages.map((s) => (
          <section key={s.level} className={'panel ' + (level >= s.level ? 'unlocked' : 'locked')}>
            <span className="tier-icon">
              {level >= s.level ? <Trophy size={22} /> : <LockKeyhole size={22} />}
            </span>
            <small>NIVEL {s.level}</small>
            <h3>{s.name}</h3>
            <p>{s.text}</p>
            <Badge>
              {level >= s.level ? 'Desbloqueado' : `${s.level * 100 - 100 - xp} XP restantes`}
            </Badge>
          </section>
        ))}
      </div>
      <div className="section-title outside">
        <h2>Rachas que construyen carácter</h2>
        <Flame size={20} />
      </div>
      <div className="streak-grid">
        {[...new Map(p.state.habits.map((h) => [h.id, h])).values()].map((h) => (
          <section className="panel" key={h.id}>
            <span className={'habit-icon ' + h.area}>
              <HabitIcon id={h.id} />
            </span>
            <div>
              <h3>{h.name}</h3>
              <p>{streak(p.state, h.id)} ocasiones consecutivas</p>
            </div>
          </section>
        ))}
      </div>
      <p className="notice">
        Los descansos programados no rompen rachas. Una ocasión incumplida reinicia solo esa racha.
        Corregir un registro ajusta su XP; faltar nunca resta puntos.
      </p>
    </>
  );
}
