import { useEffect, useState } from 'react';
import { Check, ChevronRight, Play, Pause, Flame, Plus, Pencil, RotateCcw } from 'lucide-react';
import {
  areaNames,
  missionValue,
  isDone,
  missionsWithHistoryAt,
  streak,
  localDate,
  type Habit,
} from './domain';
import { Badge, Empty, Field, HabitIcon, Heading, Modal, type PageProps } from './ui';
type Timer = { started: number; base: number };
export function MissionCard({
  habit: h,
  compact = false,
  ...p
}: PageProps & { habit: Habit; compact?: boolean }) {
  const value = missionValue(p.state, h, p.date),
    done = isDone(p.state, h, p.date),
    [edit, setEdit] = useState(false),
    [amount, setAmount] = useState(String(value));
  const timerKey = `forja-timer-${p.date}-${h.id}`;
  const [timer, setTimer] = useState<Timer | null>(() => {
      try {
        return JSON.parse(localStorage.getItem(timerKey) || 'null');
      } catch {
        return null;
      }
    }),
    [now, setNow] = useState(Date.now());
  const write = (n: number) => {
    const wasDone = done;
    p.update((s) => {
      s.records[p.date] ??= {};
      s.records[p.date][h.id] = Math.round(n * 100) / 100;
    });
    const nowDone = h.kind === 'calories' || n >= h.target;
    if (!wasDone && nowDone) p.notify(`+10 XP de experiencia · ${h.name} conquistada`);
  };
  useEffect(() => {
    if (!timer) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer]);
  const elapsed = timer ? Math.max(0, (now - timer.started) / 60000) : 0;
  const stopTimer = () => {
    if (timer) {
      write(Math.min(h.target, timer.base + Math.max(0, (Date.now() - timer.started) / 60000)));
      setTimer(null);
      localStorage.removeItem(timerKey);
    }
  };
  useEffect(() => {
    if (timer && timer.base + elapsed >= h.target) stopTimer();
  }, [now]);
  const startTimer = () => {
    const t = { started: Date.now(), base: value };
    setNow(Date.now());
    setTimer(t);
    localStorage.setItem(timerKey, JSON.stringify(t));
  };
  const racha = streak(p.state, h.id);
  return (
    <article className={`mission-card ${h.area} ${done ? 'done' : ''} ${compact ? 'compact' : ''}`}>
      <div className="mission-top">
        <span className={'habit-icon ' + h.area}>
          <HabitIcon id={h.id} />
        </span>
        <span className="mission-category">{areaNames[h.area]}</span>
        <span className={'xp-tag ' + (done ? 'earned' : '')}>
          {done ? <Check size={12} /> : <Plus size={11} />}10 XP
        </span>
      </div>
      <div className="mission-title">
        <h3>{h.name}</h3>
        {racha > 0 && (
          <span className="streak" title={`${racha} ocasiones consecutivas`}>
            <Flame size={13} />
            {racha}
          </span>
        )}
      </div>
      <div className="mission-detail">
        {h.kind === 'journal' ? (
          'Una pausa para conocerte mejor'
        ) : h.kind === 'session' ? (
          'Una sesión, un paso adelante'
        ) : h.kind === 'calories' ? (
          `Referencia diaria · ${h.target} kcal`
        ) : (
          `Objetivo · ${h.target} ${h.unit}`
        )}
        {timer && (
          <span className="timer-text">
            {Math.floor(elapsed)}:{String(Math.floor(elapsed * 60) % 60).padStart(2, '0')}
          </span>
        )}
      </div>
      <div className="mission-actions">
        {h.kind === 'journal' ? (
          <button
            className={'mission-button ' + (done ? 'complete' : '')}
            onClick={() => p.go('journal')}
          >
            {done ? <Check size={15} /> : <Pencil size={15} />}{' '}
            {done ? 'Diario completado' : 'Escribir mi diario'}
            <ChevronRight size={14} />
          </button>
        ) : h.kind === 'session' ? (
          <button
            className={'mission-button ' + (done ? 'complete' : '')}
            onClick={() => write(done ? 0 : h.target)}
          >
            {done ? <Check size={15} /> : <Plus size={15} />}{' '}
            {done ? 'Misión conquistada · deshacer' : 'Completar misión'}
          </button>
        ) : (
          <>
            <button
              className={'mission-button ' + (done ? 'complete' : '')}
              disabled={!!timer}
              onClick={() => {
                setAmount(String(value));
                setEdit(true);
              }}
            >
              {done ? <Check size={15} /> : <Plus size={15} />}{' '}
              {h.kind === 'calories'
                ? done
                  ? 'Editar registro'
                  : 'Registrar calorías'
                : done
                  ? 'Objetivo completado'
                  : 'Registrar'}
            </button>
            {h.kind === 'minutes' && !done && p.date === localDate() && (
              <button
                className={'icon-button ' + (timer ? 'active' : '')}
                aria-label={timer ? `Pausar ${h.name}` : `Temporizador de ${h.name}`}
                onClick={timer ? stopTimer : startTimer}
              >
                {timer ? <Pause size={16} /> : <Play size={16} />}
              </button>
            )}
            {h.id === 'water' && !done && (
              <button className="quick-add" onClick={() => write(value + 0.25)}>
                +250 ml
              </button>
            )}
          </>
        )}
      </div>
      {h.kind === 'calories' && p.state.records[p.date]?.[h.id] !== undefined && (
        <small className="calorie-diff">
          {value - h.target > 0 ? '+' : ''}
          {Math.round(value - h.target)} kcal respecto a la referencia
        </small>
      )}
      {edit && (
        <Modal title={h.name} onClose={() => setEdit(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const n = Number(amount);
              if (!Number.isFinite(n) || n < 0 || n > 1000000) return;
              write(n);
              setEdit(false);
            }}
          >
            <Field
              label={`Total del día (${h.unit})`}
              hint="Introduce el total acumulado. Puedes corregirlo en cualquier momento."
            >
              <input
                autoFocus
                required
                type="number"
                min="0"
                max="1000000"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </Field>
            <div className="modal-actions">
              <button
                type="button"
                className="text-button danger-text"
                onClick={() => {
                  p.update((s) => {
                    if (s.records[p.date]) delete s.records[p.date][h.id];
                  });
                  setEdit(false);
                }}
              >
                <RotateCcw size={15} /> Quitar registro
              </button>
              <button className="primary" type="submit">
                Guardar registro
              </button>
            </div>
          </form>
        </Modal>
      )}
    </article>
  );
}
export function Missions(p: PageProps) {
  const [area, setArea] = useState('all');
  const all = missionsWithHistoryAt(p.state, p.date),
    list = all.filter((h) => area === 'all' || h.area === area);
  const completed = all.filter((h) => isDone(p.state, h, p.date)).length;
  return (
    <>
      <Heading
        eyebrow="PASO A PASO"
        title="Misiones de hoy"
        description="Las pequeñas acciones construyen grandes cambios."
        action={
          <Badge className="gold">
            {completed} / {all.length} completadas
          </Badge>
        }
      />
      <div className="tabs">
        {[['all', 'Todas'], ...Object.entries(areaNames)].map(([id, name]) => (
          <button key={id} className={area === id ? 'active' : ''} onClick={() => setArea(id)}>
            {name}
          </button>
        ))}
      </div>
      {!list.length ? (
        <Empty title="Sin misiones programadas">
          Puedes elegir los días de tus actividades en Planificación.
        </Empty>
      ) : (
        <div className="mission-board">
          {[
            {
              key: 'pending',
              title: 'Por conquistar',
              match: (h: Habit) => !isDone(p.state, h, p.date),
            },
            { key: 'done', title: 'Conquistado', match: (h: Habit) => isDone(p.state, h, p.date) },
          ].map((column) => (
            <section key={column.key} className={'mission-column ' + column.key}>
              <h2>
                <span className="status-dot" />
                {column.title}
                <span>{list.filter(column.match).length}</span>
              </h2>
              {list.filter(column.match).map((h) => (
                <MissionCard key={h.id + '-' + p.date} habit={h} {...p} />
              ))}
              {!list.some(column.match) && <div className="column-empty">Todo a su tiempo.</div>}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
