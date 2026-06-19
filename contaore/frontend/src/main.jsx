import React, { useState, useEffect } from "react";
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
import TwoFactorVerifyInactivity from "./pages/TwoFactorVerifyInactivity";
import Notifications       from "./pages/Notifications";
import Settings            from "./pages/Settings";
import SettingsPresenze    from "./pages/SettingsPresenze";
import SettingsGrafici     from "./pages/SettingsGrafici";
import SettingsSicurezza   from "./pages/SettingsSicurezza";
import SettingsDati        from "./pages/SettingsDati";
import PrivacyPolicy       from "./pages/PrivacyPolicy";
import CookiePolicy        from "./pages/CookiePolicy";

import ProtectedRoute from "./ProtectedRoute";
import OwnerLayout from "./components/OwnerLayout";

// Wrapper per il router che ascolta eventi 2FA
function AppWithInactivity2FA() {
  const [show2FAInactivity, setShow2FAInactivity] = useState(false);

  useEffect(() => {
    const handleInactivity2FA = () => {
      setShow2FAInactivity(true);
    };

    window.addEventListener('inactivity2FARequired', handleInactivity2FA);

    return () => {
      window.removeEventListener('inactivity2FARequired', handleInactivity2FA);
    };
  }, []);

  return (
    <>
      <Routes>

        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-2fa" element={<TwoFactorVerify />} />
        <Route path="/verify-2fa-reset" element={<TwoFactorVerifyReset />} />
        <Route path="/verify-2fa-inactivity" element={<TwoFactorVerifyInactivity />} />
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

      {/* Modal 2FA Inattività */}
      {show2FAInactivity && (
        <>
          <TwoFactorVerifyInactivity />
        </>
      )}
    </>
  );
}

// fix ngrok in dev
const originalFetch = window.fetch;
window.fetch = (url, options = {}) => {
  if (typeof url === "string" && url.includes("ngrok")) {
    options.headers = {
      "ngrok-skip-browser-warning": "1",
      ...options.headers,
    };
  }
  return originalFetch(url, options);
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppWithInactivity2FA />
    </BrowserRouter>
  </React.StrictMode>
);
