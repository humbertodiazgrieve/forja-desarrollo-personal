import { useId } from 'react';
import { cumulativeFatEstimate, type AppState } from './domain';

const number = (value: number) => value.toLocaleString('es-PE', { maximumFractionDigits: 2 });

/** The illustration represents only the current kilogram; completed ones remain in the tally. */
export function FatProgress({ state, date }: { state: AppState; date: string }) {
  const progress = cumulativeFatEstimate(state, date);
  const id = useId();
  const shape =
    'M90 8 C88 40 42 54 31 94 C14 151 41 192 90 192 C141 192 166 151 149 106 C143 87 130 74 120 65 C124 93 109 99 105 83 C99 61 111 37 90 8 Z';
  return (
    <section className="panel fat-progress" aria-labelledby={`${id}-title`}>
      <div className="fat-progress-art" aria-hidden="true">
        <svg viewBox="0 0 180 204" focusable="false">
          <defs>
            <clipPath id={`${id}-shape`}>
              <path d={shape} />
            </clipPath>
            <linearGradient id={`${id}-gold`} x1="0" y1="1" x2="0.7" y2="0">
              <stop stopColor="#aa752f" />
              <stop offset="1" stopColor="#f4d79a" />
            </linearGradient>
          </defs>
          <path d={shape} fill="#111513" stroke="#6d715d" strokeWidth="2" />
          <g clipPath={`url(#${id}-shape)`}>
            <rect
              x="0"
              y={192 - progress.fraction * 184}
              width="180"
              height={progress.fraction * 184}
              fill={`url(#${id}-gold)`}
            />
            <path
              d="M48 134 Q65 107 88 129 T138 131 M47 163 Q72 144 94 162 T139 159 M72 99 Q87 86 103 103"
              fill="none"
              stroke="#d7b77c"
              strokeOpacity=".3"
              strokeWidth="2"
            />
          </g>
        </svg>
        <span>1 kg estimado</span>
      </div>
      <div className="fat-progress-copy">
        <span className="eyebrow">TU AVANCE, KILO A KILO</span>
        <h2 id={`${id}-title`}>Grasa quemada estimada</h2>
        <p className="fat-progress-total">
          <strong>{number(progress.estimatedKg)} kg</strong> de grasa quemada estimada
        </p>
        <p>
          <strong>
            {progress.completedKg} kg {progress.completedKg === 1 ? 'completo' : 'completos'}
          </strong>{' '}
          · Próximo hito: {progress.completedKg + 1} kg
        </p>
        <div
          role="progressbar"
          aria-label="Avance del siguiente kilogramo estimado"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.fraction * 10000) / 100}
          aria-valuetext={`${number(progress.currentKcal)} de 7700 kcal; ${progress.completedKg} kg ${progress.completedKg === 1 ? 'completo' : 'completos'}`}
          className="progress-track fat-progress-track"
        >
          <span style={{ width: `${progress.fraction * 100}%` }} />
        </div>
        <p className="fat-progress-caption">
          {number(progress.currentKcal)} / 7.700 kcal · {number(progress.fraction * 100)}% del
          siguiente kg
        </p>
        <p className="fat-progress-message">
          {!progress.recordedDays
            ? 'Tu primer paso: registra consumo y gasto total de un mismo día.'
            : progress.netKcal < 0
              ? `Superávit neto acumulado: ${number(-progress.netKcal)} kcal. Se descontará de futuros déficits.`
              : progress.completedKg > 0
                ? 'Cada kilo completo queda en tu contador; la figura empieza a colorear el siguiente.'
                : 'Cada paso cuenta. El color crece con tu déficit neto registrado.'}
        </p>
        <p className="notice">
          Estimación orientativa: 7.700 kcal ≈ 1 kg de grasa; no mide pérdida real. Balance neto:{' '}
          {number(progress.netKcal)} kcal en {progress.recordedDays} días completos hasta {date}.
          Los superávits restan; los días incompletos no cuentan.
        </p>
      </div>
    </section>
  );
}
