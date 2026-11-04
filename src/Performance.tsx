import { useEffect, useRef, useState } from 'react';
import type { PageProps } from './ui';
import { isTrustedFitnessMessage, validateFitnessData } from './performance/protocol';

type FitnessMessage = { channel: 'forja-fitness-os'; type: 'fitness:update'; data: unknown };

export function Performance({ state, update }: PageProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const target = frame.current?.contentWindow;
    if (!target) return;
    target.postMessage(
      { channel: 'forja-fitness-os', type: 'forja:sync', data: state.performanceData ?? null },
      window.location.origin,
    );
  }, [state.performanceData]);
  useEffect(() => {
    const onMessage = (event: MessageEvent<FitnessMessage>) => {
      if (!isTrustedFitnessMessage(event.origin, event.source, window.location.origin, frame.current?.contentWindow ?? null)) return;
      const message = event.data;
      if (!message || message.channel !== 'forja-fitness-os' || message.type !== 'fitness:update') return;
      try {
        const data = validateFitnessData(message.data);
        setError('');
        update((draft) => {
          draft.performanceData = data;
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : 'No se aceptaron los datos de Fitness OS.');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [update]);
  return (
    <section className="performance-page" aria-label="Performance">
      <div className="performance-heading">
        <div>
          <p>SEGUIMIENTO FÍSICO</p>
          <h1>Performance</h1>
          <span>Tu evolución, con contexto.</span>
        </div>
        <span className="performance-local">Se guarda con tus datos de Forja</span>
      </div>
      {error && <div className="notice" role="alert">{error}</div>}
      <iframe
        ref={frame}
        className="performance-frame"
        title="Fitness OS: Mi progreso, Avance visual, Actividad y Nutrición"
        src="/performance/index.html"
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
        onLoad={() => {
          const target = frame.current?.contentWindow;
          target?.postMessage(
            { channel: 'forja-fitness-os', type: 'forja:sync', data: state.performanceData ?? null },
            window.location.origin,
          );
        }}
      />
    </section>
  );
}
