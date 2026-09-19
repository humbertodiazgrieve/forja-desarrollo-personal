import { useCallback, useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Swords,
  Map,
  NotebookPen,
  ChartNoAxesCombined,
  Shield,
  CalendarDays,
  Settings as SettingsIcon,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Check,
  LoaderCircle,
  AlertCircle,
  X,
  ArrowUpRight,
} from 'lucide-react';
import { addDays, localDate, totalXp, validateState, type AppState } from './domain';
import { desktop, loadState, readBackup, restoreBackup, saveState } from './storage';
import { Home } from './Home';
import { Missions } from './Missions';
import { Planning } from './Planning';
import { Journal } from './Journal';
import { Progress, WarriorPage } from './Progress';
import { Review } from './Review';
import { Settings } from './Settings';
import { Empty, Heading, type Page, type PageProps, type Update } from './ui';

const navigation = [
  { id: 'home', label: 'Mi refugio', icon: LayoutDashboard },
  { id: 'missions', label: 'Misiones de hoy', icon: Swords },
  { id: 'planning', label: 'Planificación', icon: Map },
  { id: 'journal', label: 'Mi diario', icon: NotebookPen },
  { id: 'progress', label: 'Mi progreso', icon: ChartNoAxesCombined },
  { id: 'warrior', label: 'Mi guerrero', icon: Shield },
  { id: 'review', label: 'Revisión semanal', icon: CalendarDays },
] as const;
export default function App() {
  const [state, setState] = useState<AppState | null>(null),
    [loadError, setLoadError] = useState(''),
    [page, setPage] = useState<Page>('home'),
    [date, setDate] = useState(localDate()),
    [saveStatus, setSaveStatus] = useState('loading'),
    [saveError, setSaveError] = useState(''),
    [toast, setToast] = useState('');
  const chain = useRef<Promise<void>>(Promise.resolve()),
    saving = useRef(false),
    failed = useRef(false),
    seq = useRef(0),
    latest = useRef<AppState | null>(null),
    toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null),
    lastToday = useRef(localDate());
  const notify = useCallback((text: string) => {
    setToast(text);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(''), 6500);
  }, []);
  const load = () => {
    setLoadError('');
    loadState()
      .then((s) => {
        setState(s);
        setSaveStatus('saved');
      })
      .catch((e) => setLoadError(String(e)));
  };
  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      const today = localDate();
      if (today !== lastToday.current) {
        setDate((d) => (d === lastToday.current ? today : d));
        lastToday.current = today;
      }
    }, 30000);
    return () => clearInterval(interval);
  }, []);
  useEffect(() => {
    if (!state) return;
    latest.current = state;
    const generation = ++seq.current;
    saving.current = true;
    setSaveStatus('saving');
    chain.current = chain.current
      .catch(() => {})
      .then(async () => {
        validateState(state);
        await saveState(state);
      })
      .then(() => {
        if (generation === seq.current) {
          saving.current = false;
          failed.current = false;
          setSaveStatus('saved');
          setSaveError('');
        }
      })
      .catch((e) => {
        if (generation === seq.current) {
          saving.current = false;
          failed.current = true;
          setSaveStatus('error');
          setSaveError(String(e));
        }
      });
  }, [state]);
  useEffect(() => {
    if (!desktop) return;
    let off: (() => void) | undefined;
    let disposed = false;
    import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const win = getCurrentWindow();
      const unsubscribe = await win.onCloseRequested(async (event) => {
        if (saving.current || failed.current) {
          event.preventDefault();
          await chain.current;
          if (failed.current) {
            notify('No se pudo guardar. Exporta una copia o reintenta antes de cerrar.');
            return;
          }
          await win.destroy();
        }
      });
      if (disposed) unsubscribe();
      else off = unsubscribe;
    });
    return () => {
      disposed = true;
      off?.();
    };
  }, [notify]);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', !!state?.reducedMotion);
  }, [state?.reducedMotion]);
  const update: Update = useCallback(
    (mutate) =>
      setState((current) => {
        if (!current) return current;
        const draft = structuredClone(current);
        mutate(draft);
        if (
          !draft.onboarded &&
          (Object.keys(draft.records).length || Object.keys(draft.journals).length)
        )
          draft.onboarded = true;
        return draft;
      }),
    [],
  );
  const go = (next: Page) => {
    setPage(next);
    document.querySelector('main')?.scrollTo({ top: 0, behavior: 'instant' });
  };
  if (loadError)
    return (
      <div className="startup">
        <img src="/mark.svg" alt="Forja" />
        <h1>Tu información permanece protegida</h1>
        <p>No se pudieron abrir los datos. No se han reemplazado.</p>
        <pre>{loadError}</pre>
        <button className="primary" onClick={load}>
          Reintentar
        </button>
        {desktop && (
          <button
            className="secondary"
            onClick={async () => {
              try {
                const backup = await readBackup();
                if (backup) {
                  await restoreBackup(backup);
                  load();
                }
              } catch (e) {
                setLoadError(String(e));
              }
            }}
          >
            Restaurar una copia
          </button>
        )}
      </div>
    );
  if (!state)
    return (
      <div className="startup">
        <img src="/mark.svg" alt="Forja" />
        <h1>Preparando tu refugio</h1>
        <LoaderCircle className="spin" />
      </div>
    );
  const xp = totalXp(state),
    props: PageProps = { state, update, date, go, notify };
  const screen =
    page === 'home' ? (
      <Home {...props} />
    ) : page === 'missions' ? (
      <Missions {...props} />
    ) : page === 'planning' ? (
      <Planning {...props} />
    ) : page === 'journal' ? (
      <Journal key={date} {...props} />
    ) : page === 'progress' ? (
      <Progress {...props} />
    ) : page === 'warrior' ? (
      <WarriorPage {...props} />
    ) : page === 'review' ? (
      <Review {...props} />
    ) : page === 'settings' ? (
      <Settings {...props} />
    ) : (
      <>
        <Heading
          eyebrow="UN NUEVO HORIZONTE"
          title="Tu camino financiero"
          description="Este espacio te espera para cuando decidas tus metas."
        />
        <section className="panel finance-empty">
          <Wallet size={45} />
          <Empty title="Todo empieza con una intención">
            Las metas financieras están pendientes de definir. Esta área no afecta tus puntos,
            rachas o porcentajes de cumplimiento.
          </Empty>
          <button className="secondary" onClick={() => go('home')}>
            Volver a mi refugio
          </button>
        </section>
      </>
    );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => go('home')}>
          <img src="/mark.svg" alt="" />
          <span>
            FORJA<small>CONSTRUYE TU LEYENDA</small>
          </span>
        </button>
        <div className="nav-caption">TU CAMINO</div>
        <nav aria-label="Navegación principal">
          {navigation.map((n) => (
            <button key={n.id} className={page === n.id ? 'active' : ''} onClick={() => go(n.id)}>
              <n.icon size={19} />
              <span>{n.label}</span>
              {page === n.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="nav-divider" />
        <button
          className={'finance-nav ' + (page === 'finance' ? 'active' : '')}
          onClick={() => go('finance')}
        >
          <Wallet size={18} />
          <span>Finanzas</span>
          <small>Pronto</small>
        </button>
        <div className="sidebar-bottom">
          <div className="mini-profile">
            <span className="profile-shield">
              <Shield size={23} />
            </span>
            <div>
              <strong>Tu guerrero</strong>
              <small>
                Nivel {1 + Math.floor(xp / 100)} · {xp} XP
              </small>
            </div>
            <ArrowUpRight size={15} />
            <div className="progress-track">
              <span style={{ width: (xp % 100) + '%' }} />
            </div>
          </div>
          <button className={page === 'settings' ? 'active' : ''} onClick={() => go('settings')}>
            <SettingsIcon size={18} />
            <span>Ajustes</span>
          </button>
          <div className="local-status">
            <span /> Tus datos, en tu {desktop ? 'PC' : 'navegador'}
          </div>
        </div>
      </aside>
      <div className="workspace">
        <div className="topbar">
          <div className="breadcrumb">
            Mi espacio <ChevronRight size={13} />{' '}
            <span>
              {navigation.find((n) => n.id === page)?.label ??
                (page === 'finance' ? 'Finanzas' : 'Ajustes')}
            </span>
          </div>
          <div className="topbar-right">
            <span className={'save-indicator ' + saveStatus} aria-live="polite">
              {saveStatus === 'saved' ? (
                <Check size={12} />
              ) : saveStatus === 'error' ? (
                <AlertCircle size={12} />
              ) : (
                <LoaderCircle size={12} className="spin" />
              )}
              {saveStatus === 'saved'
                ? 'Guardado local'
                : saveStatus === 'error'
                  ? 'Error al guardar'
                  : 'Guardando'}
            </span>
            <div className="date-control">
              <button
                className="icon-button"
                aria-label="Día anterior"
                onClick={() => setDate(addDays(date, -1))}
              >
                <ChevronLeft size={14} />
              </button>
              <CalendarDays size={14} />
              <input
                aria-label="Fecha de registro"
                type="date"
                max={localDate()}
                value={date}
                onChange={(e) => {
                  if (/^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && e.target.value <= localDate())
                    setDate(e.target.value);
                }}
              />
              <button
                className="icon-button"
                aria-label="Día siguiente"
                disabled={date >= localDate()}
                onClick={() => setDate(addDays(date, 1))}
              >
                <ChevronRight size={14} />
              </button>
            </div>
            {date !== localDate() && (
              <button className="text-button" onClick={() => setDate(localDate())}>
                Hoy
              </button>
            )}
            <span className="user-monogram">G</span>
          </div>
        </div>
        <main id="main-content">
          {saveError && (
            <div className="save-error" role="alert">
              <AlertCircle size={17} />
              <span>No se pudo guardar: {saveError}</span>
              <button onClick={() => setState((s) => (s ? { ...s } : s))}>Reintentar</button>
            </div>
          )}
          {screen}
          <footer className="page-footer">
            <span>FORJA</span> La constancia es tu verdadero poder.<span>HECHO PARA TU CAMINO</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button className="icon-button" aria-label="Cerrar aviso" onClick={() => setToast('')}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
