import { useEffect, useState } from 'react';
import { CalendarDays, Check, Flame } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { addDays, formatDate, recordedCalorieBalance } from './domain';
import { Badge, Empty, Field, Heading, Modal, type PageProps } from './ui';

const REFERENCE_EXPENDITURE = 3000;
const validNumber = (value: string) => {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1000000 ? number : undefined;
};

function balanceDescription(value: number) {
  const amount = Math.abs(Math.round(value * 100) / 100);
  return value > 0
    ? `Déficit estimado: ${amount} kcal`
    : value < 0
      ? `Superávit estimado: ${amount} kcal`
      : 'Equilibrio: 0 kcal';
}

function CalorieBalanceChart({ data }: { data: { date: string; value: number | null }[] }) {
  const completeDays = data.filter((item) => item.value !== null);
  if (!completeDays.length) {
    return (
      <Empty title="Aún no hay balances completos">
        Registra consumo y gasto total en el mismo día para ver el déficit estimado.
      </Empty>
    );
  }

  return (
    <div
      className="chart"
      role="img"
      aria-label={
        'Déficit estimado: ' +
        completeDays.map((item) => `${item.date}: ${balanceDescription(item.value!)}`).join(', ')
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 14, right: 20, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ffffff0b" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#8c978e', fontSize: 11 }}
            tickFormatter={(date) => String(date).slice(5).split('-').reverse().join('/')}
            axisLine={false}
            tickLine={false}
            minTickGap={25}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: '#8c978e', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={47}
          />
          <Tooltip
            contentStyle={{
              background: '#222b25',
              border: '1px solid #46503e',
              borderRadius: 10,
              color: '#eee',
            }}
            labelFormatter={(date) =>
              formatDate(String(date), { day: 'numeric', month: 'short', year: 'numeric' })
            }
            formatter={(value) => [balanceDescription(Number(value)), 'Balance']}
          />
          <ReferenceLine y={0} stroke="#8c978e" strokeDasharray="4 5" ifOverflow="extendDomain" />
          <Line
            type="monotone"
            dataKey="value"
            stroke="#d9b77b"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#d9b77b' }}
            activeDot={{ r: 6 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Calories(p: PageProps) {
  const savedConsumption = p.state.records[p.date]?.calories,
    savedExpenditure = p.state.calorieExpenditure?.[p.date];
  const [consumption, setConsumption] = useState(() => String(savedConsumption ?? '')),
    [expenditure, setExpenditure] = useState(() =>
      String(savedExpenditure ?? REFERENCE_EXPENDITURE),
    ),
    [editing, setEditing] = useState<{
      date: string;
      consumption: string;
      expenditure: string;
    } | null>(null);
  useEffect(() => {
    setConsumption(String(savedConsumption ?? ''));
    setExpenditure(String(savedExpenditure ?? REFERENCE_EXPENDITURE));
  }, [p.date, savedConsumption, savedExpenditure]);

  const balance = recordedCalorieBalance(p.state, p.date),
    chartData = Array.from({ length: 30 }, (_, index) => {
      const date = addDays(p.date, index - 29);
      return { date, value: recordedCalorieBalance(p.state, date)?.balance ?? null };
    }),
    historyDates = [
      ...new Set([
        ...Object.keys(p.state.records),
        ...Object.keys(p.state.calorieExpenditure ?? {}),
      ]),
    ]
      .filter((date) => date <= p.date && date >= addDays(p.date, -29))
      .sort((a, b) => b.localeCompare(a)),
    history = historyDates
      .map((date) => ({
        date,
        consumption: p.state.records[date]?.calories,
        expenditure: p.state.calorieExpenditure?.[date],
        balance: recordedCalorieBalance(p.state, date),
      }))
      .filter((item) => item.consumption !== undefined || item.expenditure !== undefined);

  return (
    <>
      <Heading
        eyebrow="REGISTRA LO QUE SABES"
        title="Calorías"
        description="Registra consumo y gasto y consulta el balance de cada día."
      />
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Registro del día</h2>
            <p>{formatDate(p.date, { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
          <Badge className="gold">
            <Flame size={12} /> Referencia {REFERENCE_EXPENDITURE} kcal
          </Badge>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const parsedConsumption = validNumber(consumption),
              parsedExpenditure = validNumber(expenditure);
            if (parsedConsumption === undefined || parsedExpenditure === undefined) {
              p.notify('Usa valores de calorías finitos y no negativos.');
              return;
            }
            p.update((s) => {
              if (parsedConsumption === null) {
                if (s.records[p.date]) delete s.records[p.date].calories;
              } else {
                s.records[p.date] ??= {};
                s.records[p.date].calories = Math.round(parsedConsumption * 100) / 100;
              }
              if (parsedExpenditure === null) {
                if (s.calorieExpenditure) delete s.calorieExpenditure[p.date];
              } else {
                s.calorieExpenditure ??= {};
                s.calorieExpenditure[p.date] = Math.round(parsedExpenditure * 100) / 100;
              }
            });
            p.notify('Registro de calorías guardado.');
          }}
        >
          <div className="form-grid">
            <Field
              label="Consumo registrado (kcal)"
              hint="Usa el registro existente de consumo; vacío elimina solo el registro de ese día."
            >
              <input
                type="number"
                min="0"
                max="1000000"
                step="any"
                value={consumption}
                placeholder="Sin registrar"
                onChange={(event) => setConsumption(event.target.value)}
              />
            </Field>
            <Field
              label="Gasto total del día (basal + actividad) (kcal)"
              hint="3000 kcal es una referencia editable; vacío elimina solo el gasto guardado de ese día."
            >
              <input
                type="number"
                min="0"
                max="1000000"
                step="any"
                value={expenditure}
                onChange={(event) => setExpenditure(event.target.value)}
              />
            </Field>
          </div>
          <button className="primary">
            <Check size={16} /> Guardar registro
          </button>
        </form>
        <p className="notice">
          Este campo representa el gasto total del día; no se suma otra vez ninguna actividad.
        </p>
      </section>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Balance estimado</h2>
            <p>Gasto total menos consumo, usando los dos datos registrados del día.</p>
          </div>
          <CalendarDays size={20} />
        </div>
        {balance ? (
          <div className="goal-journey">
            <strong>
              {Math.abs(Math.round(balance.balance * 100) / 100)}
              <small>kcal</small>
            </strong>
            <p>
              {balance.expenditure} − {balance.consumption} = {balance.balance} kcal ·{' '}
              {balance.balance > 0
                ? 'Déficit estimado'
                : balance.balance < 0
                  ? 'Superávit estimado'
                  : 'Equilibrio'}
            </p>
          </div>
        ) : (
          <p className="notice">Completa consumo y gasto para mostrar el balance del día.</p>
        )}
      </section>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Déficit estimado</h2>
            <p>Gasto total menos consumo en los últimos 30 días.</p>
          </div>
          <CalendarDays size={20} />
        </div>
        <CalorieBalanceChart data={chartData} />
        <p className="notice">+ déficit · − superávit · 0 equilibrio.</p>
      </section>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Historial reciente</h2>
            <p>Últimos 30 días con registros de consumo o gasto total.</p>
          </div>
        </div>
        {history.length ? (
          <div className="history-list">
            {history.map(
              ({
                date,
                consumption: itemConsumption,
                expenditure: itemExpenditure,
                balance: item,
              }) => (
                <div key={date}>
                  <strong>{formatDate(date, { day: 'numeric', month: 'short' })}</strong>
                  <span>Consumo: {itemConsumption ?? '—'} kcal</span>
                  <span>Gasto total: {itemExpenditure ?? '—'} kcal</span>
                  <small>
                    Balance:{' '}
                    {item
                      ? `${Math.abs(Math.round(item.balance * 100) / 100)} kcal · ${item.balance > 0 ? 'Déficit estimado' : item.balance < 0 ? 'Superávit estimado' : 'Equilibrio'}`
                      : '—'}
                  </small>
                  <button
                    type="button"
                    className="text-button"
                    aria-label={`Editar registro del ${formatDate(date, { day: 'numeric', month: 'long', year: 'numeric' })}`}
                    onClick={() =>
                      setEditing({
                        date,
                        consumption: String(itemConsumption ?? ''),
                        expenditure: String(itemExpenditure ?? ''),
                      })
                    }
                  >
                    Editar
                  </button>
                </div>
              ),
            )}
          </div>
        ) : (
          <Empty title="No hay registros de calorías">
            Aquí aparecerán los días con consumo o gasto total registrados.
          </Empty>
        )}
      </section>
      {editing && (
        <Modal
          title={`Editar registro · ${formatDate(editing.date, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}`}
          onClose={() => setEditing(null)}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              const parsedConsumption = validNumber(editing.consumption),
                parsedExpenditure = validNumber(editing.expenditure);
              if (parsedConsumption === undefined || parsedExpenditure === undefined) {
                p.notify('Usa valores de calorías finitos y no negativos.');
                return;
              }
              p.update((s) => {
                if (parsedConsumption === null) {
                  if (s.records[editing.date]) delete s.records[editing.date].calories;
                } else {
                  s.records[editing.date] ??= {};
                  s.records[editing.date].calories = Math.round(parsedConsumption * 100) / 100;
                }
                if (parsedExpenditure === null) {
                  if (s.calorieExpenditure) delete s.calorieExpenditure[editing.date];
                } else {
                  s.calorieExpenditure ??= {};
                  s.calorieExpenditure[editing.date] = Math.round(parsedExpenditure * 100) / 100;
                }
              });
              p.notify('Registro de calorías actualizado.');
              setEditing(null);
            }}
          >
            <Field label="Consumo registrado (kcal)">
              <input
                type="number"
                min="0"
                max="1000000"
                step="any"
                value={editing.consumption}
                onChange={(event) => setEditing({ ...editing, consumption: event.target.value })}
              />
            </Field>
            <Field label="Gasto total del día (basal + actividad) (kcal)">
              <input
                type="number"
                min="0"
                max="1000000"
                step="any"
                value={editing.expenditure}
                onChange={(event) => setEditing({ ...editing, expenditure: event.target.value })}
              />
            </Field>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button className="primary" type="submit">
                Guardar cambios
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
