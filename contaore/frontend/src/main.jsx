import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import "./index.css";

import Login               from "./pages/Login";
import Dashboard           from "./pages/Dashboard";
import Requests            from "./pages/Requests";
import Employees           from "./pages/Employees";
import EmployeeDetails     from "./pages/EmployeeDetails";
import EmployeeTurni       from "./pages/EmployeeTurni";
import Badges              from "./pages/Badges";
import Readers             from "./pages/Readers";
import Admin               from "./pages/admin";
import DipendenteDashboard from "./pages/DipendenteDashboard";
import ResetPassword       from "./pages/ResetPassword";
import TwoFactorVerify     from "./pages/TwoFactorVerify";
import TwoFactorVerifyReset from "./pages/TwoFactorVerifyReset";
import Notifications       from "./pages/Notifications";
import Settings            from "./pages/Settings";
import SettingsProfilo     from "./pages/SettingsProfilo";
import SettingsPresenze    from "./pages/SettingsPresenze";
import SettingsGrafici     from "./pages/SettingsGrafici";
import SettingsSicurezza   from "./pages/SettingsSicurezza";
import SettingsDati        from "./pages/SettingsDati";
import PrivacyPolicy       from "./pages/PrivacyPolicy";
import CookiePolicy        from "./pages/CookiePolicy";

import ProtectedRoute from "./ProtectedRoute";
import OwnerLayout from "./components/OwnerLayout";

function AppWithInactivity2FA() {

  return (
    <>
      <Routes>

        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-2fa" element={<TwoFactorVerify />} />
        <Route path="/verify-2fa-reset" element={<TwoFactorVerifyReset />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />

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
          <Route path="/impostazioni"            element={<Settings />} />
          <Route path="/impostazioni/profilo"    element={<SettingsProfilo />} />
          <Route path="/impostazioni/presenze"   element={<SettingsPresenze />} />
          <Route path="/impostazioni/grafici"    element={<SettingsGrafici />} />
          <Route path="/impostazioni/notifiche"  element={<Notifications />} />
          <Route path="/impostazioni/sicurezza"  element={<SettingsSicurezza />} />
          <Route path="/impostazioni/dati"       element={<SettingsDati />} />
        </Route>

        {/* portale dipendente */}
        <Route path="/portale" element={
          <ProtectedRoute requireRole="dipendente">
            <DipendenteDashboard />
          </ProtectedRoute>
        } />

      </Routes>

    </>
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
        }
      } catch {}
    }

    return response;
  };
})();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppWithInactivity2FA />
    </BrowserRouter>
  </React.StrictMode>
);
