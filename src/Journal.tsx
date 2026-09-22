import { Check, Feather, BookOpen, Heart, Sparkles, Leaf } from 'lucide-react';
import { emptyJournal, formatDate, missionsAt, type Journal as JournalType } from './domain';
import { Badge, Field, Heading, type PageProps } from './ui';
export function Journal(p: PageProps) {
  const j = p.state.journals[p.date] ?? emptyJournal(),
    complete = !!(j.good.trim() && j.bad.trim());
  const change = (key: keyof JournalType, value: unknown) =>
    p.update((s) => {
      s.journals[p.date] = {
        ...(s.journals[p.date] ?? emptyJournal()),
        [key]: value,
        ...(['body', 'good', 'bad'].includes(key) ? { published: false } : {}),
      };
    });
  return (
    <>
      <Heading
        eyebrow="UN MOMENTO CONTIGO"
        title="Tu diario de camino"
        description={`${formatDate(p.date, { weekday: 'long', day: 'numeric', month: 'long' })} · Escribir también es avanzar.`}
        action={
          <Badge className={j.published ? 'green' : 'gold'}>
            {j.published ? <Check size={13} /> : <Feather size={13} />}{' '}
            {j.published ? 'Entrada completada' : 'Borrador · guardado automático'}
          </Badge>
        }
      />
      <div className="journal-layout">
        <div>
          <section className="panel">
            <div className="section-title">
              <h2>
                <BookOpen size={19} /> Hoy, en mis palabras
              </h2>
            </div>
            <textarea
              className="journal-body"
              aria-label="Texto libre del diario"
              value={j.body}
              onChange={(e) => change('body', e.target.value)}
              placeholder="¿Qué pasó hoy? ¿Qué ocupó tu mente? Este espacio es tuyo…"
            />
          </section>
          <div className="form-grid reflections">
            <section className="panel good">
              <h2>
                <Sparkles size={18} /> Qué hice bien
              </h2>
              <p>Reconoce tus avances, incluso los pequeños.</p>
              <textarea
                aria-label="Qué hice bien"
                value={j.good}
                onChange={(e) => change('good', e.target.value)}
                placeholder="Hoy me siento bien por…"
              />
            </section>
            <section className="panel lessons">
              <h2>
                <Leaf size={18} /> Qué hice mal
              </h2>
              <p>Observa lo que puedes aprender, sin juzgarte.</p>
              <textarea
                aria-label="Qué hice mal"
                value={j.bad}
                onChange={(e) => change('bad', e.target.value)}
                placeholder="Algo que podría hacer diferente…"
              />
            </section>
          </div>
          <div className="journal-save">
            <p>
              {j.published
                ? 'Tu misión de escritura está completada.'
                : 'Completa ambas reflexiones y guarda la entrada para cumplir tu misión.'}
            </p>
            <button
              className="primary"
              disabled={!complete || j.published}
              onClick={() => {
                change('published', true);
                p.notify(
                  missionsAt(p.state, p.date).some((h) => h.id === 'journal')
                    ? '+10 XP de experiencia · Misión de escritura conquistada'
                    : 'Entrada completada para esta fecha, sin misión programada.',
                );
              }}
            >
              <Check size={17} />
              {j.published ? 'Entrada completada' : 'Completar entrada'}
            </button>
          </div>
        </div>
        <aside>
          <section className="panel mood-panel">
            <span className="habit-icon mental">
              <Heart size={21} />
            </span>
            <h2>¿Cómo te sientes?</h2>
            <p>No hay respuestas buenas o malas. Solo un punto de partida.</p>
            {[
              {
                key: 'clarity',
                title: 'Claridad mental',
                low: 'Poca claridad',
                high: 'Mucha claridad',
              },
              {
                key: 'patience',
                title: 'Paciencia',
                low: 'Poca paciencia',
                high: 'Mucha paciencia',
              },
              { key: 'stress', title: 'Estrés', low: 'Poco estrés', high: 'Mucho estrés' },
            ].map((m) => (
              <Field key={m.key} label={m.title}>
                <div className="rating">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      aria-label={`${m.title}: ${n}`}
                      aria-pressed={j[m.key as keyof JournalType] === n}
                      className={j[m.key as keyof JournalType] === n ? 'selected' : ''}
                      onClick={() =>
                        change(
                          m.key as keyof JournalType,
                          j[m.key as keyof JournalType] === n ? null : n,
                        )
                      }
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span className="rating-labels">
                  <small>{m.low}</small>
                  <small>{m.high}</small>
                </span>
              </Field>
            ))}
            <p className="footnote">
              Opcional. Tus valoraciones personales no suman ni restan puntos.
            </p>
          </section>
          <div className="journal-quote">
            “Conocerte también
            <br />
            es una forma de
            <br />
            <em>hacerte más fuerte.</em>”
          </div>
        </aside>
      </div>
    </>
  );
}
