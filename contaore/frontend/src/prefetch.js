import { API_URL } from "./api";

/**
 * Cache brevissima (pochi secondi) per bypassare il "salto" di caricamento
 * quando l'utente ha appena sfiorato/toccato una voce di navigazione: le
 * pagine continuano a fare polling regolare come prima, qui serve solo a
 * coprire la finestra tra hover/tocco e il click vero e proprio.
 *
 * Il valore cachato è la Promise del JSON già parsato (non la Response
 * grezza): così più consumatori (prefetch + pagina + eventuale polling di
 * un'altra pagina sullo stesso endpoint) possono leggerlo senza il rischio
 * di leggere due volte lo stream di una Response già consumata.
 */
const cache = new Map(); // url -> { promise, ts }
const TTL_MS = 4000;

export function cachedFetch(url, options) {
  const hit = cache.get(url);
  if (hit && Date.now() - hit.ts < TTL_MS) return hit.promise;
  const promise = fetch(url, options).then((r) => r.json());
  cache.set(url, { promise, ts: Date.now() });
  promise.catch(() => cache.delete(url));
  return promise;
}

export function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem("token")}` };
}

// Le stesse funzioni import() usate da lazy() in main.jsx: chiamarle qui
// scarica e mette in cache lo stesso chunk, così quando React le richiede
// davvero per il render sono già pronte.
export function prefetchEmployees() {
  import("./pages/Employees");
  cachedFetch(`${API_URL}/api/employees`, { headers: authHeaders() });
}

export function prefetchReaders() {
  import("./pages/Readers");
  cachedFetch(`${API_URL}/api/readers`, { headers: authHeaders() });
}

export function prefetchNotifications() {
  import("./pages/Notifications");
  const headers = authHeaders();
  cachedFetch(`${API_URL}/api/notifications/settings`, { headers });
  cachedFetch(`${API_URL}/api/notifications/email-cc`, { headers });
  cachedFetch(`${API_URL}/api/employees`, { headers });
  cachedFetch(`${API_URL}/api/readers`, { headers });
}

export function prefetchSettings() {
  // Impostazioni è un menu statico: nessun dato da anticipare, solo il chunk.
  import("./pages/Settings");
}

export function prefetchRequests() {
  // I dati (requestsData) arrivano già da OwnerLayout, sempre aggiornati:
  // qui basta anticipare il codice della pagina.
  import("./pages/Requests");
}
