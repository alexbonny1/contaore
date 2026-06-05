import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import "./index.css";

import Login               from "./pages/Login";
import Dashboard           from "./pages/Dashboard";
import Requests            from "./pages/Requests";
import Pause               from "./pages/Pause";
import Employees           from "./pages/Employees";
import EmployeeDetails     from "./pages/EmployeeDetails";
import Badges              from "./pages/Badges";
import Readers             from "./pages/Readers";
import Admin               from "./pages/admin";
import DipendenteDashboard from "./pages/DipendenteDashboard";
import ResetPassword       from "./pages/ResetPassword";
import Notifications       from "./pages/Notifications";
import PrivacyPolicy       from "./pages/PrivacyPolicy";
import CookiePolicy        from "./pages/CookiePolicy";

import ProtectedRoute from "./ProtectedRoute";

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
      <Routes>

        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />

        {/* superadmin */}
        <Route path="/admin" element={
          <ProtectedRoute requireRole="superadmin">
            <Admin />
          </ProtectedRoute>
        } />

        {/* owner */}
        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />

        <Route path="/requests" element={
          <ProtectedRoute>
            <Requests />
          </ProtectedRoute>
        } />

        <Route path="/pause" element={
          <ProtectedRoute>
            <Pause />
          </ProtectedRoute>
        } />

        <Route path="/employees" element={
          <ProtectedRoute>
            <Employees />
          </ProtectedRoute>
        } />

        <Route path="/employees/:id" element={
          <ProtectedRoute>
            <EmployeeDetails />
          </ProtectedRoute>
        } />

        <Route path="/badges" element={
          <ProtectedRoute>
            <Badges />
          </ProtectedRoute>
        } />

        <Route path="/readers" element={
          <ProtectedRoute>
            <Readers />
          </ProtectedRoute>
        } />

        <Route path="/notifications" element={
          <ProtectedRoute>
            <Notifications />
          </ProtectedRoute>
        } />

        {/* portale dipendente */}
        <Route path="/portale" element={
          <ProtectedRoute requireRole="dipendente">
            <DipendenteDashboard />
          </ProtectedRoute>
        } />

      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
