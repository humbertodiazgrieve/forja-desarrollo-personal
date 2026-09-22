import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { ArrowLeft, ArrowRight, Check, Sparkles, RotateCcw, ShieldCheck } from 'lucide-react';
import { z } from 'zod';
import {
  addDays,
  applyReview,
  completion,
  datesBetween,
  formatDate,
  habitsAt,
  isDone,
  localDate,
  missionsAt,
  missionsWithHistoryAt,
  ruleSuggestions,
  suggestionSchema,
  undoReview,
  weekStart,
  type Suggestion,
} from './domain';
import { desktop } from './storage';
import { Badge, DayPicker, Empty, Field, Heading, Modal, type PageProps } from './ui';
export function Review(p: PageProps) {
  const [week, setWeek] = useState(weekStart(p.date)),
    [step, setStep] = useState(0),
    [wins, setWins] = useState(''),
    [obstacles, setObstacles] = useState(''),
    [suggestions, setSuggestions] = useState<Suggestion[]>(() =>
      ruleSuggestions(p.state, weekStart(p.date)),
    ),
    [selected, setSelected] = useState<number[]>([]),
    [shared, setShared] = useState<string[]>([]),
    [preview, setPreview] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const today = localDate(),
    end = addDays(week, 6),
    cutoff = end < today ? end : today,
    summary = completion(p.state, week, cutoff),
    days = datesBetween(week, cutoff),
    journals = days.filter((d) => p.state.journals[d]);
  const context = {
    week,
    through: cutoff,
    today,
    summary,
    habits: habitsAt(p.state, addDays(week, 7))
      .filter((h) => h.area !== 'nutrition')
      .map((h) => ({ id: h.id, name: h.name, target: h.target, days: h.days, unit: h.unit })),
    daily: days.map((d) => ({
      date: d,
      closed: d < today,
      missions: missionsWithHistoryAt(p.state, d).map((h) => ({ id: h.id, done: isDone(p.state, h, d) })),
    })),
    reflections: shared
      .filter((d) => journals.includes(d))
      .map((d) => ({ date: d, ...p.state.journals[d] })),
    wins,
    obstacles,
  };
  const requestAi = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await invoke('suggest', { model: p.state.model, context });
      const parsed = z.object({ suggestions: z.array(suggestionSchema).max(5) }).parse(result);
      const valid = parsed.suggestions.map((x) => {
        const h = habitsAt(p.state, addDays(week, 7)).find((h) => h.id === x.habitId);
        if (!h || h.area === 'nutrition')
          throw Error('La propuesta incluye un hábito fuera del alcance permitido.');
        if (h.kind === 'session' && (x.target !== 1 || x.days.length !== h.days.length))
          throw Error('La IA intentó cambiar una frecuencia física. Usa las propuestas locales.');
        if (h.kind === 'journal' && x.target !== 1) throw Error('Objetivo de diario no válido.');
        return x;
      });
      setSuggestions(valid);
      setSelected([]);
      setPreview(false);
      p.notify('Propuestas recibidas. Revisa cada una antes de aprobar.');
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const switchWeek = (value: string) => {
    if (!value) return;
    const w = weekStart(value);
    setWeek(w);
    setStep(0);
    setSuggestions(ruleSuggestions(p.state, w));
    setSelected([]);
    setShared([]);
    setWins('');
    setObstacles('');
    setError('');
  };
  return (
    <>
      <Heading
        eyebrow="APRENDE. AJUSTA. CONTINÚA."
        title="Tu consejo del domingo"
        description="Mira atrás con honestidad y prepara una semana que puedas sostener."
        action={
          <input
            aria-label="Semana que se revisa"
            type="date"
            max={today}
            value={week}
            onChange={(e) => switchWeek(e.target.value)}
          />
        }
      />
      <div className="review-period">
        <Badge className="gold">
          {formatDate(week)} — {formatDate(end)}
        </Badge>
        <span>
          Próximo plan: {formatDate(addDays(week, 7))} — {formatDate(addDays(week, 13))}
        </span>
      </div>
      <nav className="stepper" aria-label="Pasos de revisión">
        {['Mirar atrás', 'Aprender', 'Ajustar', 'Comprometerme'].map((label, i) => (
          <button
            key={label}
            className={step === i ? 'current' : step > i ? 'passed' : ''}
            onClick={() => setStep(i)}
          >
            <span>{step > i ? <Check size={14} /> : i + 1}</span>
            {label}
          </button>
        ))}
      </nav>
      {step === 0 && (
        <section className="panel">
          <div className="review-stats">
            <div>
              <strong>{summary.done}</strong>
              <span>misiones completadas</span>
            </div>
            <div>
              <strong>{summary.percent}%</strong>
              <span>cumplimiento hasta {formatDate(cutoff)}</span>
            </div>
            <div>
              <strong>{journals.filter((d) => p.state.journals[d].published).length}</strong>
              <span>entradas completadas</span>
            </div>
          </div>
          <p className="notice">
            El día de hoy sigue abierto. Las misiones pendientes de hoy todavía pueden completarse.
          </p>
          <div className="week-summary">
            {days.map((d) => {
              const c = completion(p.state, d, d);
              return (
                <div key={d}>
                  <strong>{formatDate(d, { weekday: 'short', day: 'numeric' })}</strong>
                  <div className="progress-track">
                    <span style={{ width: c.percent + '%' }} />
                  </div>
                  <span>
                    {c.done} / {c.planned}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {step === 1 && (
        <>
          <section className="panel">
            <div className="section-title">
              <h2>Lo que esta semana te enseñó</h2>
            </div>
            <div className="form-grid">
              <Field label="Mis logros">
                <textarea
                  value={wins}
                  onChange={(e) => setWins(e.target.value)}
                  placeholder="¿Qué funcionó y quieres repetir?"
                />
              </Field>
              <Field label="Mis obstáculos">
                <textarea
                  value={obstacles}
                  onChange={(e) => setObstacles(e.target.value)}
                  placeholder="¿Qué puedes cambiar o preparar mejor?"
                />
              </Field>
            </div>
          </section>
          <section className="panel">
            <h2>Vuelve a tus reflexiones</h2>
            <p className="subtle">
              Selecciona únicamente las entradas que quieras compartir si decides usar IA.
            </p>
            {!journals.length ? (
              <Empty title="Esta semana aún no tiene entradas" />
            ) : (
              journals.map((d) => (
                <details className="reflection-preview" key={d}>
                  <summary>
                    {formatDate(d, { weekday: 'long', day: 'numeric', month: 'short' })}
                    <Badge>{p.state.journals[d].published ? 'Completada' : 'Borrador'}</Badge>
                  </summary>
                  <p>
                    <strong>Qué hice bien:</strong> {p.state.journals[d].good || 'Sin completar'}
                  </p>
                  <p>
                    <strong>Qué hice mal:</strong> {p.state.journals[d].bad || 'Sin completar'}
                  </p>
                  {p.state.journals[d].body && <p>{p.state.journals[d].body}</p>}
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={shared.includes(d)}
                      onChange={(e) =>
                        setShared(e.target.checked ? [...shared, d] : shared.filter((x) => x !== d))
                      }
                    />{' '}
                    Incluir esta entrada en la consulta de IA
                  </label>
                </details>
              ))
            )}
          </section>
        </>
      )}
      {step === 2 && (
        <>
          <section className="panel ai-intro">
            <div>
              <Badge className="purple">
                <Sparkles size={12} /> AYUDA OPCIONAL
              </Badge>
              <h2>Otra mirada sobre tu semana</h2>
              <p>
                Las propuestas locales ya están listas. La IA puede ayudarte a interpretar las
                reflexiones que elijas.
              </p>
            </div>
            <button
              className="secondary"
              disabled={!desktop || busy}
              onClick={() => setPreview(true)}
            >
              <Sparkles size={16} /> Revisar envío a IA
            </button>
          </section>
          {!desktop && (
            <p className="notice">
              La IA se conecta desde la aplicación de escritorio. Esta vista de navegador usa las
              propuestas locales.
            </p>
          )}
          <div className="suggestion-list">
            {suggestions.map((s, i) => {
              const h = habitsAt(p.state, addDays(week, 7)).find((h) => h.id === s.habitId);
              return (
                <section
                  className={'panel suggestion ' + (selected.includes(i) ? 'accepted' : '')}
                  key={i}
                >
                  <div className="section-title">
                    <h2>{h?.name}</h2>
                    <label className="check-row">
                      <input
                        type="checkbox"
                        checked={selected.includes(i)}
                        onChange={(e) =>
                          setSelected(
                            e.target.checked ? [...selected, i] : selected.filter((n) => n !== i),
                          )
                        }
                      />{' '}
                      Aprobar
                    </label>
                  </div>
                  <p>
                    <strong>Motivo:</strong> {s.reason}
                  </p>
                  <Field label="Cambio propuesto">
                    <textarea
                      value={s.change}
                      onChange={(e) =>
                        setSuggestions((xs) =>
                          xs.map((x, n) => (n === i ? { ...x, change: e.target.value } : x)),
                        )
                      }
                    />
                  </Field>
                  <p className="subtle">{s.effect}</p>
                  <div className="form-grid">
                    <Field label="Días de la próxima semana">
                      <DayPicker
                        days={s.days}
                        onChange={(days) => {
                          if (days.length)
                            setSuggestions((xs) =>
                              xs.map((x, n) => (n === i ? { ...x, days } : x)),
                            );
                        }}
                      />
                    </Field>
                    {h?.kind === 'minutes' && (
                      <Field label={`Objetivo (${h.unit})`}>
                        <input
                          type="number"
                          min="1"
                          max="1440"
                          value={s.target}
                          onChange={(e) => {
                            const target = Number(e.target.value);
                            if (target > 0)
                              setSuggestions((xs) =>
                                xs.map((x, n) => (n === i ? { ...x, target } : x)),
                              );
                          }}
                        />
                      </Field>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
          <button
            className="text-button"
            onClick={() => {
              setSuggestions(ruleSuggestions(p.state, week));
              setSelected([]);
            }}
          >
            <RotateCcw size={14} /> Volver a sugerencias locales
          </button>
        </>
      )}
      {step === 3 && (
        <section className="panel commitment">
          <ShieldCheck size={38} />
          <h2>La próxima semana empieza con intención.</h2>
          <p>
            {selected.length} propuestas aprobadas para {formatDate(addDays(week, 7))} —{' '}
            {formatDate(addDays(week, 13))}.
          </p>
          {selected.map((i) => (
            <div className="commitment-item" key={i}>
              <Check size={16} />
              <span>
                <strong>{p.state.habits.find((h) => h.id === suggestions[i].habitId)?.name}</strong>{' '}
                · {suggestions[i].change}
                <small>
                  {suggestions[i].days.length} días · {suggestions[i].target}{' '}
                  {p.state.habits.find((h) => h.id === suggestions[i].habitId)?.unit}
                </small>
              </span>
            </div>
          ))}
          {!selected.length && (
            <p className="notice">
              Guardarás la reflexión semanal conservando la programación actual.
            </p>
          )}
          {addDays(week, 7) <= today && (
            <p className="notice">
              Esta revisión es histórica. Para planificar fechas futuras, selecciona la semana
              actual arriba.
            </p>
          )}
          <button
            className="primary"
            disabled={addDays(week, 7) <= today}
            onClick={() => {
              try {
                const next = applyReview(
                  p.state,
                  week,
                  selected.map((i) => suggestions[i]),
                  wins,
                  obstacles,
                );
                p.update((s) => Object.assign(s, next));
                p.notify('Revisión guardada. Tu próxima semana está preparada.');
                setSelected([]);
              } catch (e) {
                p.notify(String(e));
              }
            }}
          >
            <Check size={17} /> Guardar mi próxima semana
          </button>
        </section>
      )}
      <div className="step-actions">
        <button className="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
          <ArrowLeft size={16} /> Anterior
        </button>
        {step < 3 && (
          <button className="primary" onClick={() => setStep(step + 1)}>
            Continuar <ArrowRight size={16} />
          </button>
        )}
      </div>
      <section className="panel">
        <h2>Revisiones guardadas</h2>
        {!p.state.reviews.length ? (
          <p className="subtle">Tus aprendizajes y cambios aparecerán aquí.</p>
        ) : (
          [...p.state.reviews].reverse().map((r) => (
            <details className="reflection-preview" key={r.id}>
              <summary>
                Semana del {formatDate(r.week)}
                <Badge>{r.undone ? 'Plan deshecho' : `${r.suggestions.length} propuestas`}</Badge>
              </summary>
              <p>
                <strong>Logros:</strong> {r.wins || 'Sin notas'}
              </p>
              <p>
                <strong>Obstáculos:</strong> {r.obstacles || 'Sin notas'}
              </p>
              {r.suggestions.map((s, i) => (
                <p key={i}>{s.change}</p>
              ))}
              {!r.undone && r.appliedIds.length > 0 && addDays(r.week, 7) > today && (
                <button
                  className="secondary"
                  onClick={() => {
                    try {
                      const next = undoReview(p.state, r.id);
                      p.update((s) => Object.assign(s, next));
                      p.notify('Se ha recuperado la programación anterior.');
                    } catch (e) {
                      p.notify(String(e));
                    }
                  }}
                >
                  <RotateCcw size={15} /> Deshacer cambios futuros
                </button>
              )}
            </details>
          ))
        )}
      </section>
      {preview && (
        <Modal
          title="Antes de compartir con OpenAI"
          onClose={() => {
            if (!busy) setPreview(false);
          }}
        >
          <p>
            Se enviará el resumen semanal, tus notas de revisión y {shared.length} entradas
            seleccionadas. Puedes revisar el contenido exacto debajo.
          </p>
          <details>
            <summary>Ver información que se enviará</summary>
            <pre className="payload-preview">{JSON.stringify(context, null, 2)}</pre>
          </details>
          <p className="notice">
            Se usará tu clave y el modelo configurado:{' '}
            <strong>{p.state.model || 'sin configurar'}</strong>. La consulta puede tener un costo
            en tu cuenta del proveedor. No se crea un historial recuperable en la API; el proveedor
            puede conservar registros conforme a sus políticas.
          </p>
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <button className="primary full" disabled={busy || !p.state.model} onClick={requestAi}>
            <Sparkles size={16} />
            {busy ? 'Preparando sugerencias…' : 'Enviar y pedir sugerencias'}
          </button>
          {!p.state.model && (
            <button className="text-button" onClick={() => p.go('settings')}>
              Configurar IA en Ajustes
            </button>
          )}
        </Modal>
      )}
    </>
  );
}
