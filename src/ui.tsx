import { useEffect, useRef, type ReactNode } from 'react';
import {
  Dumbbell,
  Footprints,
  Droplets,
  CupSoda,
  Utensils,
  BookOpen,
  Flower2,
  NotebookPen,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import type { AppState } from './domain';
export type Update = (mutate: (draft: AppState) => void) => void;
export type Page =
  | 'home'
  | 'missions'
  | 'planning'
  | 'journal'
  | 'progress'
  | 'warrior'
  | 'review'
  | 'settings'
  | 'finance';
export type PageProps = {
  state: AppState;
  update: Update;
  date: string;
  go: (page: Page) => void;
  notify: (text: string) => void;
};
export const habitIcons: Record<string, typeof Dumbbell> = {
  strength: Dumbbell,
  cardio: Footprints,
  water: Droplets,
  protein: CupSoda,
  calories: Utensils,
  reading: BookOpen,
  meditation: Flower2,
  journal: NotebookPen,
};
export function HabitIcon({ id, size = 20 }: { id: string; size?: number }) {
  const Icon = habitIcons[id] ?? Dumbbell;
  return <Icon size={size} />;
}
export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={'badge ' + className}>{children}</span>;
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-symbol">✧</span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
    </div>
  );
}
export function Heading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    return () => ref.current?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-inner">
        <div className="section-title">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export const weekDays = [
  { day: 1, label: 'L' },
  { day: 2, label: 'M' },
  { day: 3, label: 'X' },
  { day: 4, label: 'J' },
  { day: 5, label: 'V' },
  { day: 6, label: 'S' },
  { day: 0, label: 'D' },
];
export const longDays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export function DayPicker({
  days,
  onChange,
}: {
  days: number[];
  onChange: (days: number[]) => void;
}) {
  return (
    <div className="day-picker">
      {weekDays.map(({ day, label }) => (
        <button
          key={day}
          type="button"
          aria-label={longDays[day]}
          aria-pressed={days.includes(day)}
          className={days.includes(day) ? 'selected' : ''}
          onClick={() =>
            onChange(days.includes(day) ? days.filter((d) => d !== day) : [...days, day].sort())
          }
        >
          {label}
        </button>
      ))}
    </div>
  );
}
export function SparkChart({
  data,
  color = '#d9b77b',
  target,
  unit = '',
  small = false,
}: {
  data: { date: string; value: number | null }[];
  color?: string;
  target?: number;
  unit?: string;
  small?: boolean;
}) {
  if (!data.some((x) => x.value !== null))
    return (
      <Empty title="Tu historia aún está por escribirse">
        Añade un registro para ver la evolución.
      </Empty>
    );
  return (
    <div
      className={small ? 'chart small' : 'chart'}
      role="img"
      aria-label={
        'Evolución: ' +
        data
          .filter((d) => d.value !== null)
          .map((d) => `${d.date}: ${d.value} ${unit}`)
          .join(', ')
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 14, right: 20, left: -12, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="#ffffff0b" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#8c978e', fontSize: 11 }}
            tickFormatter={(d) => d.slice(5).split('-').reverse().join('/')}
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
            labelFormatter={(v) => String(v)}
            formatter={(v) => [`${v} ${unit}`, 'Registro']}
          />
          {target !== undefined && (
            <ReferenceLine
              y={target}
              stroke={color}
              strokeDasharray="4 5"
              label={{ value: 'Meta', fill: color, fontSize: 11, position: 'insideTopRight' }}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2.5}
            dot={{ r: 3, fill: color }}
            activeDot={{ r: 6 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function Warrior({ level = 1, large = false }: { level?: number; large?: boolean }) {
  const tier = level >= 20 ? 4 : level >= 15 ? 3 : level >= 10 ? 2 : level >= 5 ? 1 : 0;
  const armor = ['#81948b', '#799d91', '#9eb2a7', '#bcac80', '#dab970'][tier];
  const accent = ['#c5aa75', '#d4b778', '#d5c397', '#e0c780', '#f7d88e'][tier];
  return (
    <svg
      className={'warrior-art ' + (large ? 'large' : '')}
      viewBox="0 0 460 440"
      role="img"
      aria-label={`Guerrero nivel ${level}, evolución ${tier + 1}`}
    >
      <defs>
        <radialGradient id="aura">
          <stop stopColor="#b6b272" stopOpacity=".22" />
          <stop offset="1" stopColor="#182a23" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="cloak" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#416a54" />
          <stop offset=".5" stopColor="#263f32" />
          <stop offset="1" stopColor="#142a24" />
        </linearGradient>
        <linearGradient id="steel">
          <stop stopColor="#c2c9b8" />
          <stop offset=".45" stopColor={armor} />
          <stop offset="1" stopColor="#3d5c51" />
        </linearGradient>
        <linearGradient id="gold">
          <stop stopColor="#f0d799" />
          <stop offset="1" stopColor="#977e4e" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <ellipse cx="260" cy="233" rx="206" ry="205" fill="url(#aura)" />
      <g fill="none" stroke="#bda36b" opacity=".15">
        <circle cx="269" cy="212" r="140" />
        <circle cx="269" cy="212" r="148" strokeDasharray="2 14" />
        <path d="M120 213h299M269 62v299M163 106l212 212M374 106 164 318" />
      </g>
      <g opacity=".2" fill="#76977c">
        <path d="m30 320 37-188 34 188ZM365 333l31-186 35 186ZM93 340l33-164 31 164Z" />
        <path d="M0 356q110-82 207 0t253-10v94H0Z" fill="#13281f" />
      </g>
      <ellipse cx="264" cy="387" rx="116" ry="17" fill="#070e0b" opacity=".45" />
      <path
        d="M221 142q-59 42-65 123l-36 97 91-24 112 37 40-4q-48-101-41-183l-28-47Z"
        fill="url(#cloak)"
      />
      <path
        d="m211 191-29 139-48 30 77-20 14-146M307 170l12 160 39 37-48-130"
        fill="#65836a"
        opacity=".19"
      />
      <g stroke="#172b24" strokeWidth="3">
        <path d="m234 280-16 58-9 42 37 2 20-94Z" fill="url(#steel)" />
        <path d="m273 281 10 61 10 42 35-3-21-99Z" fill="url(#steel)" />
        <path d="m217 326 35 5-4 18-36-5ZM280 330l35-4 5 18-36 6Z" fill="#344e40" />
        <path d="m209 372-11 14-3 10 49-2 3-17ZM293 377l1 16 45 3-4-13-14-11Z" fill="#24382e" />
      </g>
      <path
        d="m221 172 53-12 42 17-15 103-47 20-40-24Z"
        fill="url(#steel)"
        stroke="#263c31"
        strokeWidth="3"
      />
      <path d="m228 177 34 16 43-15-7 46-37 28-37-26Z" fill="#334f40" />
      <path d="m238 182 23 9 30-11-13 30-17 16-15-17Z" fill="url(#gold)" />
      <path d="m260 204-11 17 12-6 12 7Z" fill="#e2c786" />
      <path d="m217 250 40 19 47-18-3 18-44 18-41-19Z" fill="#293c2f" />
      <path d="m249 266 20 1v17l-20-1Z" fill="url(#gold)" />
      <path
        d="m210 163 32 12-12 34-42-7-8-15Z"
        fill="url(#steel)"
        stroke={accent}
        strokeWidth="3"
      />
      <path
        d="m310 163-25 13 14 30 44-10 2-15Z"
        fill="url(#steel)"
        stroke={accent}
        strokeWidth="3"
      />
      <path
        d="m193 199-14 51 23 12 24-58M323 200l16 47-21 12-19-53"
        fill="url(#steel)"
        stroke="#294635"
        strokeWidth="3"
      />
      <path d="m176 250 14 21 22-11-11-21M319 248l6 20 23 1-6-28" fill="#6f755c" />
      <path d="M246 143v30l17 13 20-15v-28Z" fill="#829387" />
      <path
        d="m238 104 26-16 31 18 4 30-15 23-24 9-23-26Z"
        fill="url(#steel)"
        stroke="#233a2c"
        strokeWidth="3"
      />
      <path d="m241 114 23 10 30-12-2 17-27 8-23-8Z" fill="#12281f" />
      <path d="m264 95 3 34-8 28 13-4 8-25Z" fill="#c2b387" />
      <path d="m238 104 7-16 23-14 20 13 8 19-30-12Z" fill={armor} />
      {tier >= 1 && <path d="m256 82 10-28 11 28-11 10Z" fill="url(#gold)" />}
      {tier >= 2 && (
        <g fill={accent}>
          <path d="m184 173-14-22 38 10 11 10ZM326 163l32-15-13 33Z" />
          <path d="m258 240 7-12 8 12-8 12Z" />
        </g>
      )}
      {tier >= 3 && (
        <path
          d="m230 100-17-24 27 9 24-21 29 21 24-11-15 29-36-11Z"
          fill="none"
          stroke={accent}
          strokeWidth="4"
        />
      )}
      <g transform="rotate(-10 165 293)">
        <path d="m155 235 14-65 8 65-7 146-11 12Z" fill="url(#steel)" />
        <path d="m166 176-1 184" stroke="#e7e5c5" strokeWidth="2" />
        <path d="M140 264h49l-4 9-40-1Z" fill="url(#gold)" />
        <path d="M157 235h18v28h-18Z" fill="#604f36" />
        <circle cx="166" cy="232" r="7" fill={accent} />
      </g>
      <path
        d="m314 249 42-17 40 17-3 52q-11 24-39 43-26-19-38-42Z"
        fill="#293e32"
        stroke={accent}
        strokeWidth="4"
      />
      <path d="m326 257 29-11 28 11-2 41q-8 16-27 31-18-14-25-31Z" fill="url(#steel)" />
      <path d="m354 261 14 29-12-5v30h-7v-30l-12 5Z" fill="url(#gold)" />
      <g fill={accent} className="embers">
        <circle cx="131" cy="117" r="2" />
        <circle cx="353" cy="91" r="2" />
        <circle cx="388" cy="229" r="1.5" />
        <circle cx="143" cy="262" r="2" />
        <circle cx="303" cy="57" r="1.5" />
        <path d="m375 154 2-7 2 7 7 2-7 2-2 7-2-7-7-2Z" />
        {tier >= 4 && (
          <>
            <circle cx="220" cy="96" r="4" filter="url(#glow)" />
            <circle cx="308" cy="99" r="4" filter="url(#glow)" />
            <path d="M203 73q60-47 125 0" fill="none" stroke="#f0cc75" strokeWidth="3" />
          </>
        )}
      </g>
    </svg>
  );
}
