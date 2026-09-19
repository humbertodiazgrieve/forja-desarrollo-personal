import { useState } from 'react';
import {
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Expand,
  Shrink,
  SlidersHorizontal,
  Quote,
  Target,
  CalendarDays,
  Sparkles,
  Flame,
  Shield,
} from 'lucide-react';
import {
  completion,
  datesBetween,
  addDays,
  localDate,
  weekStart,
  missionsAt,
  isDone,
  totalXp,
  latestMeasurement,
  goalProgress,
  formatDate,
  uid,
} from './domain';
import { Badge, Empty, Field, Heading, Modal, SparkChart, Warrior, type PageProps } from './ui';
import { MissionCard } from './Missions';
export function Home(p: PageProps) {
  const [physicalMetric, setPhysicalMetric] = useState('weight'),
    [custom, setCustom] = useState(false),
    [quotes, setQuotes] = useState(false),
    [quoteText, setQuoteText] = useState('');
  const xp = totalXp(p.state),
    level = 1 + Math.floor(xp / 100),
    week = completion(p.state, weekStart(p.date), p.date),
    daily = missionsAt(p.state, p.date),
    completed = daily.filter((h) => isDone(p.state, h, p.date)).length;
  const quote = p.state.rotateQuotes
    ? p.state.quotes[
        Math.floor(new Date(p.date + 'T12:00:00').getTime() / 86400000) %
          Math.max(1, p.state.quotes.length)
      ]
    : (p.state.quotes.find((q) => q.id === p.state.pinnedQuote) ?? p.state.quotes[0]);
  const shift = (id: string, delta: number) =>
    p.update((s) => {
      const i = s.widgets.findIndex((w) => w.id === id),
        j = i + delta;
      if (j >= 0 && j < s.widgets.length)
        [s.widgets[i], s.widgets[j]] = [s.widgets[j], s.widgets[i]];
    });
  const content = (id: string) => {
    if (id === 'warrior')
      return (
        <div className="hero">
          <div className="hero-copy">
            <Badge className="gold">
              <Shield size={12} /> TU CAMINO DE GUERRERO
            </Badge>
            <h2>
              Cada día cuenta.
              <br />
              <em>Hazlo tuyo.</em>
            </h2>
            <p>
              La fuerza se construye con las decisiones
              <br className="desktop-break" /> pequeñas que eliges repetir.
            </p>
            <div className="hero-level">
              <span className="level-medal">{level}</span>
              <div>
                <strong>
                  {level < 5
                    ? 'Aprendiz'
                    : level < 10
                      ? 'Guardián'
                      : level < 15
                        ? 'Centinela'
                        : level < 20
                          ? 'Campeón'
                          : 'Leyenda'}
                </strong>
                <span>
                  Nivel {level} · {xp % 100} / 100 XP
                </span>
                <div className="progress-track">
                  <span style={{ width: (xp % 100) + '%' }} />
                </div>
              </div>
            </div>
            <button className="primary" onClick={() => p.go('missions')}>
              Conquistar mis misiones <ArrowRight size={16} />
            </button>
          </div>
          <Warrior level={level} />
          <span className="hero-chapter">
            CAPÍTULO {String(level).padStart(2, '0')} <span>·</span> TU MEJOR VERSIÓN
          </span>
        </div>
      );
    if (id === 'quote')
      return (
        <div className="quote-card">
          <div className="section-title">
            <span className="eyebrow">TU BRÚJULA</span>
            <button
              className="icon-button"
              aria-label="Editar frases favoritas"
              onClick={() => setQuotes(true)}
            >
              <SlidersHorizontal size={16} />
            </button>
          </div>
          <Quote className="quote-icon" size={31} />
          <blockquote>
            {quote?.text ?? 'Añade una frase que te recuerde por qué empezaste.'}
          </blockquote>
          <div className="quote-footer">
            <span className="gold-line" /> PALABRAS QUE TE MUEVEN
          </div>
          <button className="text-button" onClick={() => setQuotes(true)}>
            Mis frases favoritas <ArrowRight size={14} />
          </button>
        </div>
      );
    if (id === 'missions')
      return (
        <>
          <div className="section-title">
            <div>
              <h2>
                Misiones de hoy{' '}
                <span className="count">
                  {completed}/{daily.length}
                </span>
              </h2>
              <p>Un paso más cerca de quien quieres ser.</p>
            </div>
            <button className="text-button" onClick={() => p.go('missions')}>
              Ver todas <ArrowRight size={15} />
            </button>
          </div>
          {daily.length ? (
            <div className="home-missions">
              {daily.map((h) => (
                <MissionCard key={h.id + '-' + p.date} habit={h} compact {...p} />
              ))}
            </div>
          ) : (
            <Empty title="Hoy puedes tomar un respiro">
              Revisa tu programación de actividades.
            </Empty>
          )}
        </>
      );
    if (id === 'physical')
      return (
        <>
          <div className="section-title">
            <h2>Tu transformación</h2>
            <Target size={17} />
          </div>
          <p className="subtle">Objetivos al {formatDate(p.state.goals[0].deadline)}</p>
          <div className="goal-list">
            {p.state.goals.map((g) => {
              const m = latestMeasurement(p.state, g.id);
              return (
                <div className="mini-goal" key={g.id}>
                  <div>
                    <span>{g.name}</span>
                    <span className="goal-target">
                      Meta {g.target} {g.unit}
                    </span>
                  </div>
                  <strong>
                    {m?.value ?? g.start}
                    <small> {g.unit}</small>
                  </strong>
                  <span className="mini-goal-note">
                    {m
                      ? `Último registro · ${formatDate(m.date)}`
                      : 'Valor inicial · sin mediciones'}
                  </span>
                  <div className="progress-track">
                    <span style={{ width: goalProgress(g, m?.value ?? g.start) + '%' }} />
                  </div>
                </div>
              );
            })}
          </div>
          <select
            className="physical-chart-select"
            aria-label="Gráfico físico del dashboard"
            value={physicalMetric}
            onChange={(e) => setPhysicalMetric(e.target.value)}
          >
            {p.state.goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <SparkChart
            small
            unit={p.state.goals.find((g) => g.id === physicalMetric)!.unit}
            target={p.state.goals.find((g) => g.id === physicalMetric)!.target}
            data={p.state.measurements
              .filter((m) => m.goalId === physicalMetric && m.date <= p.date)
              .sort((a, b) => a.date.localeCompare(b.date))
              .map((m) => ({ date: m.date, value: m.value }))}
          />
          <button className="secondary full" onClick={() => p.go('progress')}>
            Registrar mis medidas <ArrowRight size={15} />
          </button>
          <p className="footnote">Tu constancia y tus resultados tienen su propio ritmo.</p>
        </>
      );
    if (id === 'consistency') {
      const days = datesBetween(addDays(p.date, -27), p.date);
      return (
        <>
          <div className="section-title">
            <h2>La fuerza de volver</h2>
            <Flame size={18} />
          </div>
          <div className="consistency-value">
            <strong>
              {week.percent}
              <small>%</small>
            </strong>
            <span>
              cumplimiento esta semana
              <br />
              {week.done} de {week.planned} misiones hasta hoy
            </span>
          </div>
          <div className="heatmap">
            {days.map((d) => {
              const c = completion(p.state, d, d);
              return (
                <div
                  key={d}
                  title={`${formatDate(d)}: ${c.done}/${c.planned}`}
                  className={c.done === 0 ? '' : c.percent === 100 ? 'full' : 'partial'}
                >
                  {new Date(d + 'T12:00:00').getDate()}
                </div>
              );
            })}
          </div>
          <div className="heatmap-legend">
            <span>Últimos 28 días</span>
            <span>
              Menos <i />
              <i />
              <i /> Más
            </span>
          </div>
        </>
      );
    }
    if (id === 'mental') {
      const data = datesBetween(addDays(p.date, -13), p.date).map((d) => ({
        date: d,
        value: p.state.journals[d]?.clarity ?? null,
      }));
      return (
        <>
          <div className="section-title">
            <h2>Un poco más de calma</h2>
            <Sparkles size={18} />
          </div>
          <p className="subtle">Claridad mental · escala del 1 al 5</p>
          <SparkChart data={data} color="#b1a2d6" small />
          <button className="text-button" onClick={() => p.go('journal')}>
            Hacer una pausa y escribir <ArrowRight size={15} />
          </button>
        </>
      );
    }
    return (
      <div className="review-widget">
        <span className="habit-icon gold">
          <CalendarDays size={22} />
        </span>
        <div className="eyebrow">TU RITUAL DEL DOMINGO</div>
        <h2>
          Reflexiona.
          <br />
          Ajusta. Continúa.
        </h2>
        <p>
          Una semana para aprender.
          <br />
          Otra para volver a intentarlo.
        </p>
        <button className="secondary full" onClick={() => p.go('review')}>
          Planificar mi semana <ArrowRight size={15} />
        </button>
      </div>
    );
  };
  return (
    <>
      <Heading
        eyebrow="TU PROGRESO, TU LEYENDA"
        title="Tu aventura continúa"
        description={formatDate(p.date, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        action={
          <button className={custom ? 'primary' : 'secondary'} onClick={() => setCustom(!custom)}>
            <SlidersHorizontal size={15} />
            {custom ? 'Terminar' : 'Personalizar'}
          </button>
        }
      />
      {!p.state.onboarded && (
        <div className="welcome-banner">
          <div>
            <Sparkles size={20} />
            <span>
              <strong>Tu historia empieza aquí.</strong> Elige cuándo comienza tu trimestre y
              prepara tu primera semana.
            </span>
          </div>
          <button onClick={() => p.go('planning')}>
            Preparar mi camino <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="stat-strip">
        <div>
          <span className="stat-icon gold">
            <Shield size={20} />
          </span>
          <div>
            <small>Experiencia total</small>
            <strong>
              {xp}
              <span> XP</span>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon green">
            <Target size={20} />
          </span>
          <div>
            <small>Misiones de hoy</small>
            <strong>
              {completed}
              <span> / {daily.length}</span>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon purple">
            <Sparkles size={20} />
          </span>
          <div>
            <small>Tu constancia semanal</small>
            <strong>
              {week.percent}
              <span> %</span>
            </strong>
          </div>
        </div>
        <div>
          <span className="stat-icon gold">
            <CalendarDays size={20} />
          </span>
          <div>
            <small>Comienzo del trimestre</small>
            <strong className="stat-date">{formatDate(p.state.cycleStart)}</strong>
          </div>
        </div>
      </div>
      <div className={'dashboard-grid ' + (custom ? 'customizing' : '')}>
        {p.state.widgets
          .filter((w) => w.visible || custom)
          .map((w, i) => (
            <section
              key={w.id}
              className={`widget ${w.id} ${w.wide ? 'wide' : ''} ${!w.visible ? 'hidden-widget' : ''}`}
            >
              {custom && (
                <div className="widget-toolbar">
                  <span>
                    {
                      {
                        warrior: 'Guerrero',
                        quote: 'Frases',
                        missions: 'Misiones',
                        physical: 'Metas físicas',
                        consistency: 'Constancia',
                        mental: 'Bienestar',
                        review: 'Revisión',
                      }[w.id]
                    }
                  </span>
                  <button
                    aria-label={'Subir ' + w.id}
                    className="icon-button"
                    disabled={i === 0}
                    onClick={() => shift(w.id, -1)}
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    aria-label={'Bajar ' + w.id}
                    className="icon-button"
                    disabled={i === p.state.widgets.length - 1}
                    onClick={() => shift(w.id, 1)}
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={'Cambiar tamaño de ' + w.id}
                    onClick={() =>
                      p.update((s) => {
                        s.widgets.find((x) => x.id === w.id)!.wide = !w.wide;
                      })
                    }
                  >
                    {w.wide ? <Shrink size={14} /> : <Expand size={14} />}
                  </button>
                  <button
                    className="icon-button"
                    aria-label={(w.visible ? 'Ocultar ' : 'Mostrar ') + w.id}
                    onClick={() =>
                      p.update((s) => {
                        s.widgets.find((x) => x.id === w.id)!.visible = !w.visible;
                      })
                    }
                  >
                    {w.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                </div>
              )}
              {content(w.id)}
            </section>
          ))}
      </div>
      {quotes && (
        <Modal title="Palabras que te acompañan" onClose={() => setQuotes(false)}>
          <p className="subtle">Guarda tus frases favoritas y elige cuál ver al comenzar el día.</p>
          <div className="quote-list">
            {p.state.quotes.map((q) => (
              <div key={q.id}>
                <textarea
                  aria-label="Editar frase"
                  maxLength={1000}
                  value={q.text}
                  onChange={(e) => {
                    const text = e.target.value;
                    if (text.trim())
                      p.update((s) => {
                        s.quotes.find((x) => x.id === q.id)!.text = text;
                      });
                  }}
                />
                <div>
                  <button
                    className={
                      p.state.pinnedQuote === q.id && !p.state.rotateQuotes
                        ? 'text-button gold-text'
                        : 'text-button'
                    }
                    onClick={() =>
                      p.update((s) => {
                        s.pinnedQuote = q.id;
                        s.rotateQuotes = false;
                      })
                    }
                  >
                    Fijar frase
                  </button>
                  <button
                    className="text-button danger-text"
                    onClick={() =>
                      p.update((s) => {
                        s.quotes = s.quotes.filter((x) => x.id !== q.id);
                        if (s.pinnedQuote === q.id) s.pinnedQuote = s.quotes[0]?.id ?? null;
                      })
                    }
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!quoteText.trim()) return;
              p.update((s) => {
                const id = uid();
                s.quotes.push({ id, text: quoteText.trim() });
                if (!s.pinnedQuote) s.pinnedQuote = id;
              });
              setQuoteText('');
            }}
          >
            <Field label="Nueva frase">
              <textarea
                value={quoteText}
                maxLength={1000}
                onChange={(e) => setQuoteText(e.target.value)}
                placeholder="Algo que te recuerde por qué empezaste…"
              />
            </Field>
            <button className="primary">Añadir frase</button>
          </form>
          <label className="check-row">
            <input
              type="checkbox"
              checked={p.state.rotateQuotes}
              onChange={(e) =>
                p.update((s) => {
                  s.rotateQuotes = e.target.checked;
                })
              }
            />{' '}
            Mostrar una frase distinta cada día
          </label>
        </Modal>
      )}
    </>
  );
}
