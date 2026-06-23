import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { API_URL } from "../api";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [mode, setMode] = useState("reset"); // "reset" | "forgot"
  const [email, setEmail]           = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm]       = useState("");
  const [loading, setLoading]       = useState(false);
  const [message, setMessage]       = useState(null); // { type: "success"|"error", text }
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!token) setMode("forgot");
  }, [token]);

  // ─── Richiesta reset (forgot) ─────────────────────────────────────────────
  async function handleForgot(e) {
    e.preventDefault();
    if (!email.trim()) { setFieldErrors({ email: "Campo obbligatorio" }); return; }
    setFieldErrors({});
    setLoading(true);
    setMessage(null);
    try {
      const res  = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email })
      });
      await res.json();
      setMessage({
        type: "success",
        text: "Se l'email è registrata riceverai un link per reimpostare la password."
      });
    } catch {
      setMessage({ type: "error", text: "Errore di connessione. Riprova." });
    } finally {
      setLoading(false);
    }
  }

  // ─── Imposta nuova password (dal link email) ──────────────────────────────
  async function handleReset(e) {
    e.preventDefault();
    const errs = {};
    if (!newPassword)             errs.newPassword = "Campo obbligatorio";
    else if (newPassword.length < 6) errs.newPassword = "Minimo 6 caratteri";
    if (!confirm)                 errs.confirm = "Campo obbligatorio";
    else if (confirm !== newPassword) errs.confirm = "Le password non coincidono";
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    setLoading(true);
    setMessage(null);
    try {
      const res  = await fetch(`${API_URL}/api/auth/reset-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ token, newPassword })
      });
      const data = await res.json();

      // Check for 2FA requirement
      if (data.status === 'TWO_FACTOR_REQUIRED') {
        sessionStorage.setItem('2fa_tempToken', data.tempToken);
        navigate('/verify-2fa-reset', {
          state: { method: data.method, tempToken: data.tempToken }
        });
        return;
      }

      if (!data.success) {
        const msgs = {
          INVALID_TOKEN:    "Il link non è valido.",
          TOKEN_EXPIRED:    "Il link è scaduto. Richiedi un nuovo reset.",
          PASSWORD_TOO_SHORT: "La password deve essere di almeno 6 caratteri."
        };
        setMessage({ type: "error", text: msgs[data.error] || "Errore. Riprova." });
      } else {
        setMessage({ type: "success", text: "Password aggiornata! Verrai reindirizzato al login." });
        setTimeout(() => navigate("/"), 2500);
      }
    } catch {
      setMessage({ type: "error", text: "Errore di connessione. Riprova." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-zinc-200 p-8">

        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">ContaOre</h1>
          <p className="text-zinc-500 mt-2">
            {mode === "forgot" ? "Recupera password" : "Nuova password"}
          </p>
        </div>

        {mode === "forgot" ? (
          <form onSubmit={handleForgot} className="space-y-4">
            <p className="text-sm text-zinc-500">
              Inserisci l'email del tuo account e ti invieremo un link per reimpostare la password.
            </p>
            <div>
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); if (fieldErrors.email) setFieldErrors({}); }}
                className={`w-full h-12 px-4 rounded-2xl border outline-none focus:border-zinc-400 ${fieldErrors.email ? "border-red-400" : "border-zinc-200"}`}
              />
              {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
            </div>
            {message && (
              <p className={`text-sm text-center ${message.type === "success" ? "text-green-600" : "text-red-500"}`}>
                {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl bg-zinc-900 text-white font-medium hover:bg-black transition disabled:opacity-50"
            >
              {loading ? "Invio in corso..." : "Invia link di reset"}
            </button>
            <p className="text-center text-sm text-zinc-400">
              <a href="/" className="underline hover:text-zinc-700">Torna al login</a>
            </p>
          </form>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            <p className="text-sm text-zinc-500">
              Scegli una nuova password per il tuo account.
            </p>
            <div>
              <input
                type="password"
                placeholder="Nuova password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); if (fieldErrors.newPassword) setFieldErrors(p => ({...p, newPassword: ""})); }}
                className={`w-full h-12 px-4 rounded-2xl border outline-none focus:border-zinc-400 ${fieldErrors.newPassword ? "border-red-400" : "border-zinc-200"}`}
              />
              {fieldErrors.newPassword && <p className="text-xs text-red-500 mt-1">{fieldErrors.newPassword}</p>}
            </div>
            <div>
              <input
                type="password"
                placeholder="Conferma password"
                value={confirm}
                onChange={(e) => { setConfirm(e.target.value); if (fieldErrors.confirm) setFieldErrors(p => ({...p, confirm: ""})); }}
                className={`w-full h-12 px-4 rounded-2xl border outline-none focus:border-zinc-400 ${fieldErrors.confirm ? "border-red-400" : "border-zinc-200"}`}
              />
              {fieldErrors.confirm && <p className="text-xs text-red-500 mt-1">{fieldErrors.confirm}</p>}
            </div>
            {message && (
              <p className={`text-sm text-center ${message.type === "success" ? "text-green-600" : "text-red-500"}`}>
                {message.text}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl bg-zinc-900 text-white font-medium hover:bg-black transition disabled:opacity-50"
            >
              {loading ? "Salvataggio..." : "Salva nuova password"}
            </button>
            <p className="text-center text-sm text-zinc-400">
              <a href="/" className="underline hover:text-zinc-700">Torna al login</a>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
