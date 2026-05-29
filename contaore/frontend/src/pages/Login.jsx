import { useState } from "react";
import { API_URL } from "../api";

export default function Login() {

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");

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

      if (!data.success) {
        setError("Credenziali non valide");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      // ── redirect in base al ruolo ──────────────────────────────────────
      if (data.user.role === "superadmin") {
        window.location.href = "/admin";
      } else if (data.user.role === "dipendente") {
        window.location.href = "/portale";
      } else {
        window.location.href = "/dashboard";
      }

    } catch (err) {
      console.log(err);
      setError("Errore di connessione");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-sm border border-zinc-200 p-8">

        <div className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">Timbry</h1>
          <p className="text-zinc-500 mt-2">Gestione NFC presenze</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-12 px-4 rounded-2xl border border-zinc-200 outline-none focus:border-zinc-400"
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-12 px-4 rounded-2xl border border-zinc-200 outline-none focus:border-zinc-400"
            required
          />

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-2xl bg-zinc-900 text-white font-medium hover:bg-black transition disabled:opacity-50"
          >
            {loading ? "Caricamento..." : "Accedi"}
          </button>

          <p className="text-center text-sm text-zinc-400">
            <a href="/reset-password" className="underline hover:text-zinc-600">
              Password dimenticata?
            </a>
          </p>

        </form>

      </div>
    </div>
  );
}
