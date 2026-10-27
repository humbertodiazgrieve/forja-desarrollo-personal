import { useEffect, useState } from 'react';
import { CalendarDays, Check, Flame } from 'lucide-react';
import { addDays, formatDate, recordedCalorieBalance } from './domain';
import { Badge, Empty, Field, Heading, type PageProps } from './ui';

const REFERENCE_EXPENDITURE = 700;
const validNumber = (value: string) => {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 1000000 ? number : undefined;
};

export function Calories(p: PageProps) {
  const savedConsumption = p.state.records[p.date]?.calories,
    savedExpenditure = p.state.calorieExpenditure?.[p.date];
  const [consumption, setConsumption] = useState(() => String(savedConsumption ?? '')),
    [expenditure, setExpenditure] = useState(() =>
      String(savedExpenditure ?? REFERENCE_EXPENDITURE),
    );
  useEffect(() => {
    setConsumption(String(savedConsumption ?? ''));
    setExpenditure(String(savedExpenditure ?? REFERENCE_EXPENDITURE));
  }, [p.date, savedConsumption, savedExpenditure]);

  const balance = recordedCalorieBalance(p.state, p.date),
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
              label="Gasto registrado (kcal)"
              hint="700 kcal es una referencia editable. Vacío elimina solo el gasto guardado de ese día."
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
          Si el gasto corresponde solo a actividad, esta diferencia no representa tu déficit total.
        </p>
      </section>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Balance registrado</h2>
            <p>Consumo menos gasto registrado. Solo se calcula con ambos datos del día.</p>
          </div>
          <CalendarDays size={20} />
        </div>
        {balance ? (
          <div className="goal-journey">
            <strong>
              {balance.balance > 0 ? '+' : ''}
              {Math.round(balance.balance * 100) / 100}
              <small>kcal</small>
            </strong>
            <p>
              {balance.consumption} kcal de consumo − {balance.expenditure} kcal de gasto registrado
            </p>
          </div>
        ) : (
          <p className="notice">Completa consumo y gasto para mostrar el balance del día.</p>
        )}
      </section>
      <section className="panel">
        <div className="section-title">
          <div>
            <h2>Historial reciente</h2>
            <p>Últimos 30 días con consumo y gasto registrados.</p>
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
                  <span>Gasto: {itemExpenditure ?? '—'} kcal</span>
                  <small>
                    Balance:{' '}
                    {item
                      ? `${item.balance > 0 ? '+' : ''}${Math.round(item.balance * 100) / 100} kcal`
                      : '—'}
                  </small>
                </div>
              ),
            )}
          </div>
        ) : (
          <Empty title="Todavía no hay días completos">
            El historial aparece cuando un día tiene consumo y gasto registrados.
          </Empty>
        )}
      </section>
    </>
  );
}
