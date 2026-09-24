import { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import {
  Download,
  Upload,
  KeyRound,
  ShieldCheck,
  Sparkles,
  FolderHeart,
  RotateCcw,
  Mail,
  LogOut,
  Cloud,
  CloudDownload,
  CloudUpload,
  RefreshCw,
  Smartphone,
} from 'lucide-react';
import type { Session } from '@supabase/supabase-js';
import type { AppState } from './domain';
import { desktop, exportBackup, readBackup, restoreBackup, recoverPrevious } from './storage';
import {
  getCurrentSession,
  isSupabaseAuthConfigured,
  requestMagicLink,
  signOut,
  subscribeToAuthChanges,
} from './supabase-auth';
import {
  loadRemoteState,
  RemoteConflictError,
  saveRemoteState,
  type RemoteState,
} from './supabase-repository';
import {
  getPwaInstallState,
  promptPwaInstall,
  subscribeToPwaInstallChanges,
  type PwaInstallState,
} from './pwa-install';
import { markAutoSyncResolved } from './auto-sync';
import { Badge, Field, Heading, Modal, type PageProps } from './ui';
export function Settings(p: PageProps) {
  const authConfigured = isSupabaseAuthConfigured();
  const [key, setKey] = useState(''),
    [hasKey, setHasKey] = useState(false),
    [busy, setBusy] = useState(false),
    [incoming, setIncoming] = useState<AppState | null>(null),
    [error, setError] = useState(''),
    [model, setModel] = useState(p.state.model),
    [authSession, setAuthSession] = useState<Session | null>(null),
    [authEmail, setAuthEmail] = useState(''),
    [authLoading, setAuthLoading] = useState(authConfigured),
    [authBusy, setAuthBusy] = useState(false),
    [authMessage, setAuthMessage] = useState(''),
    [authError, setAuthError] = useState(''),
    [remoteState, setRemoteState] = useState<RemoteState | null>(null),
    [remoteChecked, setRemoteChecked] = useState(false),
    [remoteLoading, setRemoteLoading] = useState(false),
    [remoteBusy, setRemoteBusy] = useState(false),
    [remoteMessage, setRemoteMessage] = useState(''),
    [remoteError, setRemoteError] = useState(''),
    [pwaState, setPwaState] = useState<PwaInstallState>(() => getPwaInstallState()),
    [pwaBusy, setPwaBusy] = useState(false),
    [pwaMessage, setPwaMessage] = useState(''),
    [pwaError, setPwaError] = useState('');
  const input = useRef<HTMLInputElement>(null),
    mounted = useRef(true),
    authUserId = useRef<string | null>(null),
    remoteLoadedFor = useRef<string | null>(null);
  authUserId.current = authSession?.user.id ?? null;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (desktop)
      invoke<boolean>('has_api_key')
        .then(setHasKey)
        .catch((e) => setError(String(e)));
  }, []);
  useEffect(() => {
    if (!authConfigured) return;
    let active = true;
    let unsubscribe = () => {};
    setAuthLoading(true);
    try {
      unsubscribe = subscribeToAuthChanges((_event, session) => {
        if (!active || !mounted.current) return;
        setAuthSession(session);
        setAuthLoading(false);
        setAuthError('');
      });
      getCurrentSession()
        .then((session) => {
          if (!active || !mounted.current) return;
          setAuthSession(session);
          setAuthLoading(false);
        })
        .catch((e) => {
          if (!active || !mounted.current) return;
          setAuthLoading(false);
          setAuthError(`No se pudo comprobar la sesión. ${String(e)}`);
        });
    } catch (e) {
      if (active && mounted.current) {
        setAuthLoading(false);
        setAuthError(`No se pudo preparar el acceso. ${String(e)}`);
      }
    }
    return () => {
      active = false;
      unsubscribe();
    };
  }, [authConfigured]);
  useEffect(() => {
    if (desktop) return;
    return subscribeToPwaInstallChanges(setPwaState);
  }, []);
  const refreshRemote = async (userId: string) => {
    if (!mounted.current || authUserId.current !== userId) return;
    setRemoteLoading(true);
    setRemoteError('');
    try {
      const remote = await loadRemoteState();
      if (!mounted.current || authUserId.current !== userId) return;
      setRemoteState(remote);
      setRemoteChecked(true);
      remoteLoadedFor.current = userId;
    } catch (e) {
      if (!mounted.current || authUserId.current !== userId) return;
      remoteLoadedFor.current = null;
      setRemoteError(`No se pudieron consultar los datos remotos. ${String(e)}`);
    } finally {
      if (mounted.current && authUserId.current === userId) setRemoteLoading(false);
    }
  };
  useEffect(() => {
    const userId = authSession?.user.id;
    if (!userId) {
      remoteLoadedFor.current = null;
      setRemoteState(null);
      setRemoteChecked(false);
      setRemoteLoading(false);
      setRemoteMessage('');
      setRemoteError('');
      return;
    }
    if (remoteLoadedFor.current === userId) return;
    void refreshRemote(userId);
  }, [authSession]);
  const perform = async (action: () => Promise<unknown>, message?: string) => {
    setError('');
    setBusy(true);
    try {
      const r = await action();
      if (message && r !== null) p.notify(message);
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };
  const choose = async (file?: File) => {
    const state = await readBackup(file);
    if (state) setIncoming(state);
  };
  const sendMagicLink = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = authEmail.trim();
    setAuthEmail(email);
    setAuthMessage('');
    setAuthError('');
    if (!email) {
      setAuthError('Escribe un email para enviar el enlace.');
      return;
    }
    setAuthBusy(true);
    try {
      await requestMagicLink(email);
      if (mounted.current)
        setAuthMessage('Te enviamos un enlace mágico. Revisa tu correo para continuar.');
    } catch (e) {
      if (mounted.current) setAuthError(`No se pudo enviar el enlace. ${String(e)}`);
    } finally {
      if (mounted.current) setAuthBusy(false);
    }
  };
  const closeSession = async () => {
    setAuthBusy(true);
    setAuthMessage('');
    setAuthError('');
    try {
      await signOut();
      if (mounted.current) {
        setAuthSession(null);
        setAuthMessage('Sesión cerrada.');
      }
    } catch (e) {
      if (mounted.current) setAuthError(`No se pudo cerrar la sesión. ${String(e)}`);
    } finally {
      if (mounted.current) setAuthBusy(false);
    }
  };
  const downloadRemote = async () => {
    const userId = authUserId.current;
    if (!userId || !mounted.current) return;
    setRemoteBusy(true);
    setRemoteMessage('');
    setRemoteError('');
    try {
      const remote = await loadRemoteState();
      if (!mounted.current || authUserId.current !== userId) return;
      if (!remote) {
        setRemoteError('No hay datos remotos para descargar.');
        return;
      }
      await restoreBackup(remote.state);
      if (!mounted.current || authUserId.current !== userId) return;
      p.update((s) => Object.assign(s, remote.state));
      setModel(remote.state.model);
      markAutoSyncResolved(remote.state, remote.revision);
      setRemoteState(remote);
      setRemoteChecked(true);
      remoteLoadedFor.current = userId;
      setRemoteMessage('Datos remotos descargados y aplicados al almacenamiento local.');
    } catch (e) {
      if (mounted.current && authUserId.current === userId)
        setRemoteError(`No se pudieron descargar los datos remotos. ${String(e)}`);
    } finally {
      if (mounted.current && authUserId.current === userId) setRemoteBusy(false);
    }
  };
  const uploadLocal = async () => {
    const userId = authUserId.current;
    if (!userId || !mounted.current) return;
    setRemoteBusy(true);
    setRemoteMessage('');
    setRemoteError('');
    try {
      const latest = await loadRemoteState();
      if (!mounted.current || authUserId.current !== userId) return;
      const expectedRevision = latest?.revision ?? 0;
      const newRevision = await saveRemoteState(p.state, expectedRevision);
      if (!mounted.current || authUserId.current !== userId) return;
      setRemoteState({
        state: p.state,
        schemaVersion: p.state.schema,
        revision: newRevision,
        updatedAt: new Date().toISOString(),
      });
      setRemoteChecked(true);
      remoteLoadedFor.current = userId;
      markAutoSyncResolved(p.state, newRevision);
      setRemoteMessage(`Datos locales subidos. Revisión remota ${newRevision}.`);
    } catch (e) {
      if (!mounted.current || authUserId.current !== userId) return;
      if (e instanceof RemoteConflictError) {
        remoteLoadedFor.current = null;
        setRemoteError(
          'Los datos remotos cambiaron en otro dispositivo. Vuelve a consultar antes de subir.',
        );
      } else setRemoteError(`No se pudieron subir los datos locales. ${String(e)}`);
    } finally {
      if (mounted.current && authUserId.current === userId) setRemoteBusy(false);
    }
  };
  const installPwa = async () => {
    setPwaBusy(true);
    setPwaMessage('');
    setPwaError('');
    try {
      const outcome = await promptPwaInstall();
      if (!mounted.current) return;
      if (outcome === 'accepted') setPwaMessage('Forja se está instalando en este dispositivo.');
      else if (outcome === 'dismissed') setPwaMessage('La instalación se canceló.');
      else setPwaMessage('Este navegador no ofrece instalación automática.');
    } catch (e) {
      if (mounted.current) setPwaError(`No se pudo iniciar la instalación. ${String(e)}`);
    } finally {
      if (mounted.current) setPwaBusy(false);
    }
  };
  return (
    <>
      <Heading
        eyebrow="A TU MANERA"
        title="Ajustes de tu refugio"
        description="Tu información, tus preferencias y las herramientas que eliges usar."
      />
      {!authConfigured ? (
        <section className="panel settings-card">
          <span className="habit-icon mental">
            <Mail size={22} />
          </span>
          <div>
            <div className="section-title">
              <h2>Acceso opcional</h2>
              <Badge>SOLO MODO LOCAL</Badge>
            </div>
            <p>
              Forja sigue funcionando en modo local. Para preparar el acceso con enlace mágico,
              configura VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY en tu entorno.
            </p>
          </div>
        </section>
      ) : (
        <section className="panel settings-card">
          <span className="habit-icon mental">
            <Mail size={22} />
          </span>
          <div>
            <div className="section-title">
              <h2>Acceso opcional</h2>
              <Badge className="green">CUENTA SUPABASE</Badge>
            </div>
            <p>
              Puedes usar un enlace mágico para reconocer tu cuenta. Tus datos siguen guardándose
              localmente mientras la sincronización remota no esté activa.
            </p>
            {authLoading ? (
              <p aria-live="polite">Comprobando tu sesión...</p>
            ) : authSession ? (
              <div className="button-row">
                <p>
                  Sesión iniciada como <strong>{authSession.user.email ?? 'usuario autenticado'}</strong>.
                </p>
                <button
                  type="button"
                  className="secondary"
                  disabled={authBusy}
                  onClick={closeSession}
                >
                  <LogOut size={16} /> {authBusy ? 'Cerrando sesión...' : 'Cerrar sesión'}
                </button>
              </div>
            ) : (
              <form onSubmit={sendMagicLink}>
                <Field
                  label="Email"
                  hint="Recibirás un enlace para continuar sin guardar contraseñas en Forja."
                >
                  <input
                    id="supabase-email"
                    type="email"
                    autoComplete="email"
                    value={authEmail}
                    disabled={authBusy}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="tu@email.com"
                  />
                </Field>
                <button className="secondary" type="submit" disabled={authBusy}>
                  <Mail size={16} /> {authBusy ? 'Enviando enlace...' : 'Enviar enlace mágico'}
                </button>
              </form>
            )}
            {authMessage && (
              <p className="notice" role="status" aria-live="polite">
                {authMessage}
              </p>
            )}
            {authError && (
              <p className="error-message" role="alert">
                {authError}
              </p>
            )}
          </div>
        </section>
      )}
      {authSession && (
        <section className="panel settings-card">
          <span className="habit-icon gold">
            <Cloud size={22} />
          </span>
          <div>
            <div className="section-title">
              <h2>Sincronización remota</h2>
              <Badge className="green">AUTOMÁTICA</Badge>
            </div>
            <p>
              Los cambios se sincronizan automáticamente cuando hay una sesión activa. Puedes usar
              los botones para forzar una descarga o resolver un conflicto; el guardado local continúa activo.
            </p>
            {remoteLoading ? (
              <p aria-live="polite">Consultando tu copia remota...</p>
            ) : remoteChecked && remoteState ? (
              <>
                <p aria-live="polite">
                  Última actualización: {new Date(remoteState.updatedAt).toLocaleString('es-ES')} ·
                  Revisión {remoteState.revision}
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="secondary"
                    disabled={remoteBusy}
                    onClick={downloadRemote}
                  >
                    <CloudDownload size={16} /> Descargar datos remotos
                  </button>
                  <button
                    type="button"
                    className="secondary"
                    disabled={remoteBusy}
                    onClick={uploadLocal}
                  >
                    <CloudUpload size={16} /> Subir datos locales
                  </button>
                </div>
              </>
            ) : remoteChecked ? (
              <>
                <p aria-live="polite">Todavía no hay una copia remota de tus datos.</p>
                <button
                  type="button"
                  className="secondary"
                  disabled={remoteBusy}
                  onClick={uploadLocal}
                >
                  <CloudUpload size={16} /> Subir datos locales
                </button>
              </>
            ) : null}
            {remoteMessage && (
              <p className="notice" role="status" aria-live="polite">
                {remoteMessage}
              </p>
            )}
            {remoteError && (
              <div>
                <p className="error-message" role="alert">
                  {remoteError}
                </p>
                <button
                  type="button"
                  className="text-button"
                  disabled={remoteBusy || remoteLoading}
                  onClick={() => void refreshRemote(authSession.user.id)}
                >
                  <RefreshCw size={14} /> Volver a consultar
                </button>
              </div>
            )}
          </div>
        </section>
      )}
      <section className="panel settings-card">
        <span className="habit-icon physical">
          <Smartphone size={22} />
        </span>
        <div>
          <div className="section-title">
            <h2>Instalación en tus dispositivos</h2>
            <Badge>{desktop ? 'ESCRITORIO' : 'PWA'}</Badge>
          </div>
          {desktop ? (
            <p aria-live="polite">La aplicación de escritorio de Forja ya está instalada.</p>
          ) : pwaState.installed ? (
            <p aria-live="polite">Forja está instalada en este dispositivo.</p>
          ) : pwaState.canInstall ? (
            <>
              <p aria-live="polite">Instala Forja para abrirla desde tu pantalla de inicio.</p>
              <button type="button" className="secondary" disabled={pwaBusy} onClick={installPwa}>
                <Download size={16} /> {pwaBusy ? 'Instalando...' : 'Instalar Forja'}
              </button>
            </>
          ) : (
            <p aria-live="polite">
              Este navegador no ofrece instalación automática. En iPhone o iPad, usa Compartir y
              elige Agregar a pantalla de inicio.
            </p>
          )}
          {pwaMessage && (
            <p className="notice" role="status" aria-live="polite">
              {pwaMessage}
            </p>
          )}
          {pwaError && (
            <p className="error-message" role="alert">
              {pwaError}
            </p>
          )}
        </div>
      </section>
      <section className="panel settings-card">
        <span className="habit-icon physical">
          <FolderHeart size={22} />
        </span>
        <div>
          <div className="section-title">
            <h2>Datos en tu PC</h2>
            <Badge className="green">{desktop ? 'SQLITE LOCAL' : 'VISTA DE NAVEGADOR'}</Badge>
          </div>
          <p>
            {desktop
              ? 'Tu historial se guarda en una base SQLite en los datos locales de tu usuario de Windows.'
              : 'Esta vista de prueba guarda información en este navegador. La aplicación instalada utiliza SQLite; ambas tienen almacenes independientes.'}
          </p>
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => perform(() => exportBackup(p.state), 'Copia exportada.')}
            >
              <Download size={16} /> Exportar copia
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => (desktop ? perform(() => choose()) : input.current?.click())}
            >
              <Upload size={16} /> Restaurar copia
            </button>
            <button
              className="text-button"
              disabled={busy}
              onClick={() =>
                perform(async () => {
                  const raw = await recoverPrevious();
                  if (!raw) throw Error('No hay una copia anterior a la restauración.');
                  setIncoming(raw);
                })
              }
            >
              <RotateCcw size={14} /> Recuperar copia anterior
            </button>
          </div>
          <input
            type="file"
            accept=".json,application/json"
            ref={input}
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) perform(() => choose(file));
              e.target.value = '';
            }}
          />
          <p className="footnote">
            Las copias incluyen diario, metas, historial y personalización. La clave de IA nunca se
            incluye. Antes de restaurar, se respalda el estado actual.
          </p>
        </div>
      </section>
      <section className="panel settings-card">
        <span className="habit-icon mental">
          <Sparkles size={22} />
        </span>
        <div>
          <div className="section-title">
            <h2>Una ayuda extra, cuando la necesites</h2>
            <Badge>IA OPCIONAL</Badge>
          </div>
          <p>
            OpenAI puede proponer ajustes durante tu revisión semanal. Solo se consulta cuando lo
            solicitas, después de revisar la información a compartir.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              p.update((s) => {
                s.model = model.trim();
              });
              p.notify('Modelo guardado.');
            }}
          >
            <Field
              label="Modelo de tu cuenta de OpenAI"
              hint="Escribe el identificador de un modelo disponible en tu cuenta que admita Responses y salidas estructuradas."
            >
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Identificador del modelo"
                maxLength={200}
              />
            </Field>
            <button className="secondary" type="submit">
              Guardar modelo
            </button>
          </form>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              perform(async () => {
                await invoke('set_api_key', { key });
                setHasKey(!!key.trim());
                setKey('');
              }, 'Clave guardada en el almacén de credenciales de Windows.');
            }}
          >
            <Field
              label="Clave de API"
              hint={
                hasKey
                  ? 'Ya hay una clave guardada de forma segura. Puedes reemplazarla.'
                  : 'Tu clave permanece en el almacén de credenciales de Windows.'
              }
            >
              <input
                disabled={!desktop}
                type="password"
                autoComplete="new-password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={hasKey ? '••••••••••••••••' : 'Introduce tu clave'}
              />
            </Field>
            <div className="button-row">
              <button className="secondary" disabled={!desktop || busy || !key.trim()}>
                <KeyRound size={15} /> Guardar clave
              </button>
              {hasKey && (
                <button
                  type="button"
                  className="text-button danger-text"
                  disabled={busy}
                  onClick={() =>
                    perform(async () => {
                      await invoke('set_api_key', { key: '' });
                      setHasKey(false);
                    }, 'Clave eliminada.')
                  }
                >
                  Eliminar clave
                </button>
              )}
            </div>
          </form>
          <p className="notice">
            El uso de la API puede tener costos propios. Se solicita no almacenar las respuestas
            como historial recuperable; esto no elimina toda posible retención del proveedor. La app
            sigue funcionando sin IA, sin saldo o sin conexión.
          </p>
        </div>
      </section>
      <section className="panel settings-card">
        <span className="habit-icon gold">
          <ShieldCheck size={22} />
        </span>
        <div>
          <h2>Un espacio cómodo para ti</h2>
          <label className="check-row">
            <input
              type="checkbox"
              checked={p.state.reducedMotion}
              onChange={(e) =>
                p.update((s) => {
                  s.reducedMotion = e.target.checked;
                })
              }
            />{' '}
            Reducir animaciones y movimiento
          </label>
          <p className="subtle">También se respeta la preferencia de movimiento de Windows.</p>
          <button className="text-button" onClick={() => p.go('home')}>
            Personalizar widgets y frases desde Inicio
          </button>
        </div>
      </section>
      {error && (
        <p role="alert" className="error-message">
          {error}
        </p>
      )}
      {incoming && (
        <Modal title="Restaurar esta copia" onClose={() => setIncoming(null)}>
          <p>
            Esta copia contiene{' '}
            <strong>{Object.keys(incoming.journals).length} entradas de diario</strong>,{' '}
            {incoming.measurements.length} mediciones y {incoming.reviews.length} revisiones.
          </p>
          <p className="notice">
            Se reemplazarán los datos actuales. Se guardará automáticamente una copia anterior que
            podrás recuperar desde Ajustes.
          </p>
          <button
            className="primary full"
            disabled={busy}
            onClick={() =>
              perform(async () => {
                await restoreBackup(incoming);
                p.update((s) => Object.assign(s, incoming));
                setIncoming(null);
                setModel(incoming.model);
              }, 'Copia restaurada correctamente.')
            }
          >
            <Upload size={16} /> Restaurar y conservar respaldo anterior
          </button>
        </Modal>
      )}
    </>
  );
}
