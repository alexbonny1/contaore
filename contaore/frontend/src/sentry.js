// Sentry caricato lazy: il modulo non entra nel bundle iniziale, viene
// scaricato solo quando serve (dopo il primo render, oppure subito se un
// errore viene catturato prima che l'idle callback scatti).
let sentryPromise = null;

export function loadSentry() {
  if (!import.meta.env.VITE_SENTRY_DSN) return Promise.resolve(null);
  if (!sentryPromise) {
    sentryPromise = import("@sentry/react").then((Sentry) => {
      Sentry.init({
        dsn:              import.meta.env.VITE_SENTRY_DSN,
        environment:      import.meta.env.MODE,
        tracesSampleRate: 0.1,
      });
      return Sentry;
    });
  }
  return sentryPromise;
}

if (typeof window !== "undefined" && import.meta.env.VITE_SENTRY_DSN) {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
  idle(() => loadSentry());
}
