import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import "./index.css";
import { initTheme } from "./theme";
import { registerServiceWorker } from "./push";
// PostHog e Sentry si auto-inizializzano lazy (idle callback / on-demand) non
// appena importati: vedi analytics.js e sentry.js. Non pesano sul bundle
// iniziale, si scaricano solo quando servono davvero.
import "./analytics";
import "./sentry";

// Applica il tema (chiaro/scuro/automatico) subito, prima del render, per
// evitare un flash del tema sbagliato; resta anche in ascolto dei cambi di
// tema del sistema operativo per l'opzione "automatico".
initTheme();

// Service worker per le notifiche push (non blocca il render)
registerServiceWorker();

// ─── Lazy-loaded pages ────────────────────────────────────────────────────────
// Public / auth pages (keep eager: they're tiny and needed immediately)
import Login               from "./pages/Login";
import ResetPassword       from "./pages/ResetPassword";
import TwoFactorVerify     from "./pages/TwoFactorVerify";
import TwoFactorVerifyReset from "./pages/TwoFactorVerifyReset";
import PrivacyPolicy       from "./pages/PrivacyPolicy";
import CookiePolicy        from "./pages/CookiePolicy";
import TermsOfService      from "./pages/TermsOfService";
import NotFound            from "./pages/NotFound";

// App pages — lazy loaded for better initial bundle size
const Dashboard           = lazy(() => import("./pages/Dashboard"));
const Requests            = lazy(() => import("./pages/Requests"));
const Employees           = lazy(() => import("./pages/Employees"));
const EmployeeDetails     = lazy(() => import("./pages/EmployeeDetails"));
const EmployeeTurni       = lazy(() => import("./pages/EmployeeTurni"));
const Badges              = lazy(() => import("./pages/Badges"));
const Readers             = lazy(() => import("./pages/Readers"));
const Admin               = lazy(() => import("./pages/admin"));
const DipendenteDashboard = lazy(() => import("./pages/DipendenteDashboard"));
const Notifications       = lazy(() => import("./pages/Notifications"));
const Settings            = lazy(() => import("./pages/Settings"));
const SettingsProfilo     = lazy(() => import("./pages/SettingsProfilo"));
const SettingsPresenze    = lazy(() => import("./pages/SettingsPresenze"));
const SettingsGrafici     = lazy(() => import("./pages/SettingsGrafici"));
const SettingsSicurezza   = lazy(() => import("./pages/SettingsSicurezza"));
const SettingsDati        = lazy(() => import("./pages/SettingsDati"));
const SettingsAdmin       = lazy(() => import("./pages/SettingsAdmin"));
const SettingsRiepilogoOre = lazy(() => import("./pages/SettingsRiepilogoOre"));
const Billing             = lazy(() => import("./pages/Billing"));

import ProtectedRoute from "./ProtectedRoute";
import OwnerLayout from "./components/OwnerLayout";
import CookieConsentBanner from "./components/CookieConsentBanner";
import ErrorBoundary from "./components/ErrorBoundary";

// Minimal inline fallback — no extra component needed
function PageLoader() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
    </div>
  );
}

function AppWithInactivity2FA() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>

        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-2fa" element={<TwoFactorVerify />} />
        <Route path="/verify-2fa-reset" element={<TwoFactorVerifyReset />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="/termini" element={<TermsOfService />} />

        {/* superadmin */}
        <Route path="/admin" element={
          <ProtectedRoute requireRole="superadmin">
            <Admin />
          </ProtectedRoute>
        } />

        {/* owner — layout persistente (header + barra montati una sola volta) */}
        <Route element={
          <ProtectedRoute>
            <OwnerLayout />
          </ProtectedRoute>
        }>
          <Route path="/dashboard"     element={<Dashboard />} />
          <Route path="/requests"      element={<Requests />} />
          <Route path="/pause"         element={<Requests initialView="pause" />} />
          <Route path="/employees"     element={<Employees />} />
          <Route path="/employees/:id" element={<EmployeeDetails />} />
          <Route path="/employees/:id/turni" element={<EmployeeTurni />} />
          <Route path="/badges"        element={<Badges />} />
          <Route path="/readers"       element={<Readers />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/impostazioni"              element={<Settings />} />
          <Route path="/impostazioni/profilo"      element={<SettingsProfilo />} />
          <Route path="/impostazioni/presenze"     element={<SettingsPresenze />} />
          <Route path="/impostazioni/grafici"      element={<SettingsGrafici />} />
          <Route path="/impostazioni/notifiche"    element={<Notifications />} />
          <Route path="/impostazioni/sicurezza"    element={<SettingsSicurezza />} />
          <Route path="/impostazioni/admin"        element={<SettingsAdmin />} />
          <Route path="/impostazioni/dati"         element={<SettingsDati />} />
          <Route path="/impostazioni/riepilogo-ore" element={<SettingsRiepilogoOre />} />
          <Route path="/impostazioni/abbonamento"  element={<Billing />} />
        </Route>

        {/* portale dipendente */}
        <Route path="/portale" element={
          <ProtectedRoute requireRole="dipendente">
            <DipendenteDashboard />
          </ProtectedRoute>
        } />

        {/* catch-all 404 */}
        <Route path="*" element={<NotFound />} />

      </Routes>
    </Suspense>
  );
}

// Interceptor globale: rileva SESSION_EXPIRED da qualsiasi fetch e fa logout immediato
;(function() {
  const _fetch = window.fetch;
  window.fetch = async function(input, init = {}) {
    // In DEV aggiungi header ngrok per evitare la browser-warning page
    if (import.meta.env.DEV && typeof input === "string" && input.includes("ngrok")) {
      init = { ...init, headers: { "ngrok-skip-browser-warning": "1", ...(init.headers || {}) } };
    }

    const response = await _fetch(input, init);

    // Controlla SESSION_EXPIRED da qualsiasi risposta API
    if (localStorage.getItem('token')) {
      try {
        const clone = response.clone();
        const data  = await clone.json();
        if (data?.error === 'SESSION_EXPIRED') {
          localStorage.clear();
          window.location.href = '/?session_expired=1';
        } else if (data?.error === 'PORTAL_DISABLED') {
          localStorage.clear();
          window.location.href = '/?portal_disabled=1';
        }
      } catch {}
    }

    return response;
  };
})();

// Forza un ricaricamento pulito quando la pagina torna da bfcache (Safari, specialmente
// in modalità standalone su iPhone, può ripristinare una pagina "congelata" e mostrare
// schermo bianco dopo uno swipe indietro seguito da un download)
window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    // location.replace forza un caricamento davvero pulito del documento; su Safari
    // in modalità standalone, location.reload() a volte non lo fa correttamente
    // dopo un ripristino da bfcache, lasciando la pagina bianca.
    window.location.replace(window.location.href);
  }
});

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AppWithInactivity2FA />
        <CookieConsentBanner />
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
