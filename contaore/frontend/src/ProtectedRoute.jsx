import { Navigate } from "react-router-dom";

export default function ProtectedRoute({
  children,
  requireRole
}) {

  const token = localStorage.getItem("token");

  const user = JSON.parse(
    localStorage.getItem("user") || "{}"
  );

  if (!token) {

    return <Navigate to="/" replace />;

  }

  /*
    SUPERADMIN PROVA AD ACCEDERE
    A PAGINE AZIENDA
  */

  if (
    user.role === "superadmin" &&
    requireRole !== "superadmin"
  ) {

    return <Navigate to="/admin" replace />;

  }

  /*
    UTENTE NORMALE PROVA AD ACCEDERE
    A PAGINE SUPERADMIN
  */

  if (
    requireRole === "superadmin" &&
    user.role !== "superadmin"
  ) {

    return <Navigate to="/dashboard" replace />;

  }

  return children;

}