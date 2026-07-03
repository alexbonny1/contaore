import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "../api";
import LegalFooter from "../components/LegalFooter";
import SplashScreen from "../components/SplashScreen";
import { track } from "../main";

export default function Login() {

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [booting, setBooting]   = useState(true);
  const [splashExiting, setSplashExiting] = useState(false);
  const [error, setError]       = useState(
    searchParams.get("password_changed") === "1"
      ? "Password aggiornata con successo. Accedi con le nuove credenziali."
      : searchParams.get("session_expired") === "1"
      ? "Sessione scaduta: password modificata su un altro dispositivo. Accedi di nuovo."
      : searchParams.get("portal_disabled") === "1"
      ? "Portale disattivato dal titolare. Contatta l'azienda."
      : ""
  );

  useEffect(() => {
    const token = localStorage.getItem("token");
    const user  = JSON.parse(localStorage.getItem("user") || "{}");

    // Lo splash resta visibile un momento fisso, anche se il controllo (istantaneo)
    // ha già finito, così non sembra un lampo ma un vero avvio dell'app.
    const minDisplay = setTimeout(() => {
      setSplashExiting(true);
      setTimeout(() => {
        if (token) {
          if (user.role === "superadmin")  navigate("/admin",     { replace: true });
          else if (user.role === "dipendente") navigate("/portale",  { replace: true });
          else                             navigate("/dashboard", { replace: true });
        } else {
          setBooting(false);
        }
      }, 300);
    }, 900);

    return () => clearTimeout(minDisplay);
  }, []);

  if (booting) {
    return <SplashScreen exiting={splashExiting} />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API_URL + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      // Check for 2FA requirement
      if (data.status === 'TWO_FACTOR_REQUIRED') {
        sessionStorage.setItem('2fa_tempToken', data.tempToken);
        navigate('/verify-2fa', {
          state: { method: data.method, tempToken: data.tempToken }
        });
        return;
      }

      if (!data.success) {
        setError(data.error === "PORTAL_DISABLED" ? "Portale disattivato dal titolare" : "Credenziali non valide");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      track("user_logged_in", { role: data.user.role });

      if (data.user.role === "superadmin") {
        window.location.href = "/admin";
      } else if (data.user.role === "dipendente") {
        window.location.href = "/portale";
      } else {
        window.location.href = "/dashboard";
      }

    } catch (err) {
      setError("Errore di connessione");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-sm border border-zinc-200 p-6 sm:p-8">

        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-zinc-900">Timbry</h1>
          <p className="text-sm sm:text-base text-zinc-500 mt-1 sm:mt-2">Gestione NFC presenze</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-11 sm:h-12 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-zinc-200 text-sm sm:text-base outline-none focus:border-zinc-400 transition"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-11 sm:h-12 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-zinc-200 text-sm sm:text-base outline-none focus:border-zinc-400 transition"
            required
          />

          {error && (
            <p className="text-xs sm:text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-zinc-900 text-white text-sm sm:text-base font-medium hover:bg-black transition disabled:opacity-50"
          >
            {loading ? "Caricamento..." : "Accedi"}
          </button>

          <p className="text-center text-xs sm:text-sm text-zinc-400 pt-1">
            <a href="/reset-password" className="underline hover:text-zinc-600 transition">
              Password dimenticata?
            </a>
          </p>

        </form>

      </div>
      <LegalFooter />
    </div>
  );
}
