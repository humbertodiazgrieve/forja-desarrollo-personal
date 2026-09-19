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
} from 'lucide-react';
import { validateState, type AppState } from './domain';
import { desktop, exportBackup, readBackup, restoreBackup } from './storage';
import { Badge, Field, Heading, Modal, type PageProps } from './ui';
export function Settings(p: PageProps) {
  const [key, setKey] = useState(''),
    [hasKey, setHasKey] = useState(false),
    [busy, setBusy] = useState(false),
    [incoming, setIncoming] = useState<AppState | null>(null),
    [error, setError] = useState(''),
    [model, setModel] = useState(p.state.model);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (desktop)
      invoke<boolean>('has_api_key')
        .then(setHasKey)
        .catch((e) => setError(String(e)));
  }, []);
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
  return (
    <>
      <Heading
        eyebrow="A TU MANERA"
        title="Ajustes de tu refugio"
        description="Tu información, tus preferencias y las herramientas que eliges usar."
      />
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
                  const raw = desktop
                    ? await invoke('recover_previous')
                    : JSON.parse(localStorage.getItem('forja-preview-v1-before-restore') || 'null');
                  if (!raw) throw Error('No hay una copia anterior a la restauración.');
                  setIncoming(validateState(raw));
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
