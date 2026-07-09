// PostHog caricato lazy: il modulo (~70KB gzip) non entra nel bundle iniziale,
// viene scaricato solo quando serve davvero (consenso già dato in precedenza,
// o appena l'utente accetta dal banner cookie).
let posthogPromise = null;

export function loadPosthog() {
  if (!import.meta.env.VITE_POSTHOG_KEY) return Promise.resolve(null);
  if (!posthogPromise) {
    posthogPromise = import("posthog-js").then(({ default: posthog }) => {
      posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
        api_host:                     import.meta.env.VITE_POSTHOG_HOST || "https://eu.i.posthog.com",
        capture_pageview:             true,
        session_recording:            { maskAllInputs: true },
        opt_out_capturing_by_default: true,
        loaded: (ph) => {
          if (import.meta.env.DEV) {
            ph.opt_out_capturing();
          } else if (localStorage.getItem("cookie_consent") === "accepted") {
            ph.opt_in_capturing();
          }
        },
      });
      return posthog;
    });
  }
  return posthogPromise;
}

export function track(event, props) {
  if (!import.meta.env.VITE_POSTHOG_KEY) return;
  loadPosthog().then((posthog) => posthog && posthog.capture(event, props));
}

// Se il consenso era già stato dato in una sessione precedente, ricarica
// PostHog dopo il primo render (non blocca il paint iniziale) per riprendere
// il tracciamento pageview.
if (typeof window !== "undefined" && localStorage.getItem("cookie_consent") === "accepted") {
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 200));
  idle(() => loadPosthog());
}
