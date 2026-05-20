import React from "react";
import ReactDOM from "react-dom/client";
import EmployeeDetails from "./pages/EmployeeDetails";

import {
  BrowserRouter,
  Routes,
  Route
} from "react-router-dom";

import "./index.css";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Badges from "./pages/Badges";
import Readers from "./pages/Readers";
import Admin from "./pages/admin";

import ProtectedRoute from "./ProtectedRoute";

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

        <Route
          path="/"
          element={<Login />}
        />

        <Route
  path="/admin"
  element={
    <ProtectedRoute requireRole="superadmin">
      <Admin />
    </ProtectedRoute>
  }
/>

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employees"
          element={
            <ProtectedRoute>
              <Employees />
            </ProtectedRoute>
          }
        />

        <Route
          path="/employees/:id"
          element={
            <ProtectedRoute>
              <EmployeeDetails />
            </ProtectedRoute>
          }
        />

        <Route
          path="/badges"
          element={
            <ProtectedRoute>
              <Badges />
            </ProtectedRoute>
          }
        />

        <Route
          path="/readers"
          element={
            <ProtectedRoute>
              <Readers />
            </ProtectedRoute>
          }
        />

      </Routes>

    </BrowserRouter>

  </React.StrictMode>
);