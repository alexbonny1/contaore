import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children, requireRole }) {

  const token = localStorage.getItem("token");
  const user  = JSON.parse(localStorage.getItem("user") || "{}");

  // non loggato
  if (!token) {
    return <Navigate to="/" replace />;
  }

  // superadmin prova ad accedere a pagine azienda o portale
  if (user.role === "superadmin" && requireRole !== "superadmin") {
    return <Navigate to="/admin" replace />;
  }

  // utente normale o dipendente prova ad accedere ad admin
  if (requireRole === "superadmin" && user.role !== "superadmin") {
    return <Navigate to="/dashboard" replace />;
  }

  // dipendente prova ad accedere a pagine owner
  if (user.role === "dipendente" && requireRole !== "dipendente") {
    return <Navigate to="/portale" replace />;
  }

  // owner prova ad accedere al portale dipendente
  if (requireRole === "dipendente" && user.role !== "dipendente") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}