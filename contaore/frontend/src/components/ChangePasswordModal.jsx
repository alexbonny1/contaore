import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Lock, CheckCircle2, XCircle } from "lucide-react";
import { API_URL } from "../api";

/**
 * Modal riutilizzabile per cambiare password.
 * Funziona per owner (Dashboard) e dipendente (DipendenteDashboard).
 *
 * Props:
 *   onClose: () => void
 */
export default function ChangePasswordModal({ onClose }) {
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword]         = useState("");
  const [confirm, setConfirm]                 = useState("");
  const [loading, setLoading]                 = useState(false);
  const [message, setMessage]                 = useState(null); // { type, text }
  const [fieldErrors, setFieldErrors]         = useState({});

  function clearFieldError(field) {
    if (fieldErrors[field]) setFieldErrors(p => ({ ...p, [field]: "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const errs = {};
    if (!currentPassword) errs.currentPassword = "Campo obbligatorio";
    if (!newPassword)     errs.newPassword     = "Campo obbligatorio";
    else if (newPassword.length < 6) errs.newPassword = "Minimo 6 caratteri";
    if (!confirm)         errs.confirm         = "Campo obbligatorio";
    else if (confirm !== newPassword) errs.confirm = "Le password non coincidono";
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});

    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`${API_URL}/api/auth/change-password`, {
        method:  "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      const data = await res.json();

      if (!data.success) {
        const msgs = {
          WRONG_CURRENT_PASSWORD: "La password attuale non è corretta.",
          PASSWORD_TOO_SHORT:     "La password deve essere di almeno 6 caratteri.",
          MISSING_FIELDS:         "Compila tutti i campi."
        };
        setMessage({ type: "error", text: msgs[data.error] || "Errore. Riprova." });
      } else {
        // Logout completo: tutti i dispositivi (incluso questo) devono ri-autenticarsi
        setMessage({ type: "success", text: "Password aggiornata! Verrai reindirizzato al login." });
        setTimeout(() => {
          localStorage.clear();
          navigate("/?password_changed=1");
        }, 1800);
      }
    } catch {
      setMessage({ type: "error", text: "Errore di connessione. Riprova." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-6">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Lock size={18} className="text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Cambia password
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
          >
            <X size={18} className="text-zinc-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Password attuale
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => { setCurrentPassword(e.target.value); clearFieldError("currentPassword"); }}
              placeholder="••••••••"
              className={`w-full h-11 px-4 rounded-xl border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none text-sm ${fieldErrors.currentPassword ? "border-red-400 dark:border-red-500" : "border-zinc-200 dark:border-zinc-700 focus:border-zinc-400 dark:focus:border-zinc-500"}`}
            />
            {fieldErrors.currentPassword && <p className="text-xs text-red-500 mt-1">{fieldErrors.currentPassword}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Nuova password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); clearFieldError("newPassword"); }}
              placeholder="Min. 6 caratteri"
              className={`w-full h-11 px-4 rounded-xl border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none text-sm ${fieldErrors.newPassword ? "border-red-400 dark:border-red-500" : "border-zinc-200 dark:border-zinc-700 focus:border-zinc-400 dark:focus:border-zinc-500"}`}
            />
            {fieldErrors.newPassword && <p className="text-xs text-red-500 mt-1">{fieldErrors.newPassword}</p>}
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">
              Conferma nuova password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); clearFieldError("confirm"); }}
              placeholder="••••••••"
              className={`w-full h-11 px-4 rounded-xl border bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none text-sm ${fieldErrors.confirm ? "border-red-400 dark:border-red-500" : "border-zinc-200 dark:border-zinc-700 focus:border-zinc-400 dark:focus:border-zinc-500"}`}
            />
            {fieldErrors.confirm && <p className="text-xs text-red-500 mt-1">{fieldErrors.confirm}</p>}
          </div>

          {/* Feedback */}
          {message && (
            <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-xl
              ${message.type === "success"
                ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
                : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400"
              }`}>
              {message.type === "success"
                ? <CheckCircle2 size={15} />
                : <XCircle size={15} />
              }
              {message.text}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-1 rounded-xl bg-zinc-900 dark:bg-zinc-100
                       text-white dark:text-zinc-900 font-medium text-sm
                       hover:bg-black dark:hover:bg-white transition disabled:opacity-50"
          >
            {loading ? "Salvataggio..." : "Aggiorna password"}
          </button>
        </form>
      </div>
    </div>
  );
}
