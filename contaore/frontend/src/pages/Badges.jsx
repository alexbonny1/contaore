import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard,
  Radio, Sun, Moon, CheckCircle2, XCircle, Mail,
  FileText, Calendar
} from "lucide-react";
import { API_URL } from "../api";

const NAV_TABS = [
  { title: "Dashboard",       icon: LayoutDashboard, path: "/dashboard" },
  { title: "Richieste",       icon: FileText,        path: "/requests"  },
  { title: "Pausa aziendale", icon: Calendar,        path: "/pause"     },
  { title: "Dipendenti",      icon: Users,           path: "/employees" },
  { title: "Badge",           icon: CreditCard,      path: "/badges"    },
  { title: "Lettori NFC",     icon: Radio,           path: "/readers"   },
];

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`
      fixed bottom-6 left-1/2 -translate-x-1/2 z-50
      flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg
      text-sm font-medium
      ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}
    `}>
      {type === "success" ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
      {message}
    </div>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#161618] rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-sm w-full mx-4 shadow-xl">
        <p className="text-zinc-900 dark:text-zinc-100 font-medium mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 h-11 rounded-2xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          >
            Elimina
          </button>
          <button
            onClick={onCancel}
            className="flex-1 h-11 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium"
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Badges() {

  const navigate = useNavigate();
  const location = useLocation();

  const [dark, setDark]                     = useState(false);
  const [badges, setBadges]                 = useState([]);
  const [uid, setUid]                       = useState("");
  const [employeeName, setEmployeeName]     = useState("");
  const [employeeCognome, setEmployeeCognome] = useState("");
  const [employeeEmail, setEmployeeEmail]   = useState("");
  const [waitingScan, setWaitingScan]       = useState(false);
  const [toast, setToast]                   = useState(null);
  const [confirm, setConfirm]               = useState(null); // { message, onConfirm }
  const [portaleAttivo, setPortaleAttivo]   = useState(false);

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  // ─── tema dark ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  useEffect(() => {
    if (dark) { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [dark]);

  // ─── carica badge + info portale ────────────────────────────────────────────
  useEffect(() => {
    loadBadges();
    checkPortale();
  }, []);

  async function loadBadges() {
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(API_URL + "/api/tags", { headers: { Authorization: `Bearer ${token}` } });
      const data  = await res.json();
      if (data.success) setBadges(data.tags || []);
    } catch (err) { console.log(err); }
  }

  async function checkPortale() {
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(API_URL + "/api/company/info", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.success) setPortaleAttivo(!!data.portale_dipendenti);
    } catch (err) {
      // silenzioso
    }
  }

  // ─── polling NFC ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!waitingScan) return;
    const startedAt = new Date().toISOString();
    const interval  = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const res   = await fetch(API_URL + "/api/latest-read?after=" + encodeURIComponent(startedAt), {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.success && data.uid) {
          setUid(data.uid);
          setWaitingScan(false);
          clearInterval(interval);
        }
      } catch (err) { console.log(err); }
    }, 1000);
    return () => clearInterval(interval);
  }, [waitingScan]);

  // ─── registra badge ─────────────────────────────────────────────────────────
  async function createBadge(e) {
    e.preventDefault();

    if (portaleAttivo && !employeeEmail.trim()) {
      showToast("Il portale dipendenti è attivo: inserisci l'email", "error");
      return;
    }

    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(API_URL + "/api/tags/register", {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          uid,
          employee_name:    employeeName,
          employee_cognome: employeeCognome,
          employee_email:   employeeEmail.trim() || undefined
        })
      });

      const data = await res.json();

      if (!data.success) {
        const msg =
          data.error === "UID_ALREADY_EXISTS"   ? "Badge già registrato" :
          data.error === "EMAIL_REQUIRED"        ? "Email obbligatoria (portale attivo)" :
          data.error || "Errore registrazione";
        showToast(msg, "error");
        return;
      }

      const successMsg = data.account_creato
        ? `Badge registrato — credenziali inviate a ${employeeEmail}`
        : "Badge registrato";

      showToast(successMsg);
      setUid(""); setEmployeeName(""); setEmployeeCognome(""); setEmployeeEmail("");
      setWaitingScan(false);
      loadBadges();

    } catch (err) {
      console.log(err);
      showToast("Errore server", "error");
    }
  }

  function askDeleteBadge(id) {
    setConfirm({
      message: "Eliminare il badge e il dipendente associato? L'operazione non può essere annullata.",
      onConfirm: () => { setConfirm(null); deleteBadge(id); }
    });
  }

  async function deleteBadge(id) {
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(API_URL + "/api/tags/" + id, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || "Errore", "error"); return; }
      showToast("Badge eliminato");
      loadBadges();
    } catch (err) { console.log(err); showToast("Errore server", "error"); }
  }

  function logout() { localStorage.removeItem("token"); navigate("/"); }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">ContaOre</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Gestione badge NFC</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setDark(p => !p)}
              className="w-11 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center">
              {dark ? <Sun size={18} className="text-zinc-200" /> : <Moon size={18} className="text-zinc-700" />}
            </button>
            <button onClick={logout} className="h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium">
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">

        {/* NAV TABS */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-1">
          {NAV_TABS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link key={item.title} to={item.path}
                className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
                    : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                }`}>
                <Icon size={16} />{item.title}
              </Link>
            );
          })}
        </div>

        {/* TITLE */}
        <div className="mb-8">
          <h2 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Badge NFC</h2>
          <p className="text-zinc-500 mt-2">Registra un nuovo badge e associalo a un dipendente</p>
        </div>

        {/* BANNER PORTALE ATTIVO */}
        {portaleAttivo && (
          <div className="flex items-center gap-3 mb-6 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-2xl px-5 py-3">
            <Mail size={16} className="text-blue-500 shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <strong>Portale dipendenti attivo</strong> — inserisci l'email del dipendente per creare automaticamente il suo account e inviargli le credenziali di accesso.
            </p>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={createBadge}
          className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-8">

          <div className="mb-6">
            <button type="button"
              onClick={() => { setUid(""); setEmployeeName(""); setEmployeeCognome(""); setEmployeeEmail(""); setWaitingScan(true); }}
              className="h-14 px-8 rounded-2xl bg-black text-white text-sm font-semibold">
              {waitingScan ? "Attendi scansione..." : "Leggi Tag NFC"}
            </button>
          </div>

          {uid && (
            <div className="space-y-4">

              {/* UID */}
              <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <CreditCard size={16} className="text-zinc-400 shrink-0" />
                <p className="text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100">{uid}</p>
              </div>

              {/* CAMPI DIPENDENTE */}
              <div className={`grid gap-4 ${portaleAttivo ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"}`}>

                <input type="text" placeholder="Nome" value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="h-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none"
                  required />

                <input type="text" placeholder="Cognome" value={employeeCognome}
                  onChange={(e) => setEmployeeCognome(e.target.value)}
                  className="h-12 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 outline-none"
                  required />

                {portaleAttivo && (
                  <div className="relative md:col-span-2">
                    <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="Email dipendente (riceverà le credenziali) *"
                      value={employeeEmail}
                      onChange={(e) => setEmployeeEmail(e.target.value)}
                      className="w-full h-12 pl-10 pr-4 rounded-2xl border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-zinc-900 dark:text-zinc-100 outline-none focus:border-blue-500 placeholder-zinc-400"
                      required={portaleAttivo}
                    />
                  </div>
                )}

                <button type="submit"
                  className={`h-12 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium ${portaleAttivo ? "md:col-span-2" : ""}`}>
                  Registra Badge
                </button>

              </div>
            </div>
          )}
        </form>

        {/* LISTA BADGE */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {badges.map((badge) => (
            <div key={badge.id} className="rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  <CreditCard size={20} className="text-zinc-700 dark:text-zinc-200" />
                </div>
                <button
                  onClick={() => askDeleteBadge(badge.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  Elimina
                </button>
              </div>
              <p className="text-xs text-zinc-400 mb-1">UID</p>
              <h3 className="text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100">{badge.uid}</h3>
              <p className="text-sm text-zinc-500 mt-3">{badge.nome}</p>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
