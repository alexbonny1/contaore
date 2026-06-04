import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard,
  Radio, Sun, Moon, CheckCircle2, XCircle, Mail,
  FileText, Calendar, Bell, Pencil, X
} from "lucide-react";
import { API_URL } from "../api";
import { usePullToRefresh, PullIndicator } from "../hooks/usePullToRefresh.jsx";

const NAV_TABS = [
  { title: "Dashboard",       icon: LayoutDashboard, path: "/dashboard" },
  { title: "Richieste",       icon: FileText,        path: "/requests",  nascondiSeSenzaPortale: true },
  { title: "Pausa aziendale", icon: Calendar,        path: "/pause"     },
  { title: "Dipendenti",      icon: Users,           path: "/employees" },
  { title: "Badge",           icon: CreditCard,      path: "/badges"    },
  { title: "Lettori NFC",     icon: Radio,           path: "/readers"   },
  { title: "Notifiche",       icon: Bell,            path: "/notifications" },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-[#161618] rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6 max-w-sm w-full shadow-xl">
        <p className="text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 font-medium mb-4 sm:mb-6 leading-relaxed">{message}</p>
        <div className="flex gap-2 sm:gap-3">
          <button
            onClick={onConfirm}
            className="flex-1 h-10 sm:h-11 rounded-xl sm:rounded-2xl bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-medium transition-colors"
          >
            Elimina
          </button>
          <button
            onClick={onCancel}
            className="flex-1 h-10 sm:h-11 rounded-xl sm:rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-medium"
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
  const [confirm, setConfirm]               = useState(null);
  const [portaleAttivo, setPortaleAttivo]   = useState(false);
  const [pendingCount, setPendingCount]     = useState(0);
  const [editingId, setEditingId]           = useState(null);
  const [editForm, setEditForm]             = useState({ nome: '', cognome: '', email: '' });
  const [editSaving, setEditSaving]         = useState(false);

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

  const { pulling, refreshing, distance } = usePullToRefresh(loadBadges)

  // ─── carica badge + info portale ────────────────────────────────────────────
  useEffect(() => {
    loadBadges();
    checkPortale();
    const token = localStorage.getItem("token");
    fetch(`${API_URL}/api/requests/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setPendingCount(d.counts?.totali_in_attesa ?? 0); })
      .catch(() => {});
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

  function startEdit(badge) {
    setEditingId(badge.id);
    setEditForm({ nome: badge.nome_raw || '', cognome: badge.cognome_raw || '', email: badge.email || '' });
  }

  async function saveEdit(badge) {
    setEditSaving(true);
    try {
      const token = localStorage.getItem("token");
      const body  = { nome: editForm.nome, cognome: editForm.cognome };
      // include email only if changed or added
      if (editForm.email && editForm.email !== badge.email) body.email = editForm.email;
      const res  = await fetch(`${API_URL}/api/tags/${badge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || "Errore", "error"); return; }
      const msg = data.account_creato ? `Account creato — credenziali inviate a ${editForm.email}` : "Salvato";
      showToast(msg);
      setEditingId(null);
      loadBadges();
    } catch (err) { showToast("Errore server", "error"); }
    finally { setEditSaving(false); }
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">Timbry</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">Gestione badge NFC</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setDark(p => !p)}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center">
              {dark ? <Sun size={16} className="sm:w-[18px] sm:h-[18px] text-zinc-200" /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px] text-zinc-700" />}
            </button>
            <button onClick={logout} className="h-9 sm:h-11 px-3 sm:px-5 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium">
              <span className="hidden sm:inline">Logout</span>
              <span className="sm:hidden">Esci</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <PullIndicator pulling={pulling} refreshing={refreshing} distance={distance} />

        {/* NAV TABS */}
        <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {NAV_TABS
            .filter(item => !(item.nascondiSeSenzaPortale && !portaleAttivo))
            .map((item) => {
              const Icon     = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link key={item.title} to={item.path}
                  className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
                      : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                  }`}>
                  <Icon size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{item.title}</span>
                  {!isActive && item.nascondiSeSenzaPortale && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {pendingCount > 9 ? "9+" : pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
        </div>

        {/* TITLE */}
        <div className="mb-5 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Badge NFC</h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1 sm:mt-2">Registra un nuovo badge e associalo a un dipendente</p>
        </div>

        {/* BANNER PORTALE ATTIVO */}
        {portaleAttivo && (
          <div className="flex items-start sm:items-center gap-2 sm:gap-3 mb-5 sm:mb-6 bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 rounded-xl sm:rounded-2xl px-3 sm:px-5 py-2 sm:py-3">
            <Mail size={14} className="sm:w-4 sm:h-4 text-blue-500 flex-shrink-0 mt-0.5 sm:mt-0" />
            <p className="text-[10px] sm:text-sm text-blue-700 dark:text-blue-300 leading-snug">
              <strong>Portale dipendenti attivo</strong> — inserisci l'email del dipendente per creare automaticamente il suo account e inviargli le credenziali di accesso.
            </p>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={createBadge}
          className="rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-4 sm:p-6 mb-6 sm:mb-8">

          <div className="mb-4 sm:mb-6">
            <button type="button"
              onClick={() => { setUid(""); setEmployeeName(""); setEmployeeCognome(""); setEmployeeEmail(""); setWaitingScan(true); }}
              className="h-10 sm:h-12 px-4 sm:px-8 rounded-xl sm:rounded-2xl bg-black text-white text-xs sm:text-sm font-semibold">
              {waitingScan ? "Attendi scansione..." : "Leggi Tag NFC"}
            </button>
          </div>

          {uid && (
            <div className="space-y-3 sm:space-y-4">

              {/* UID */}
              <div className="flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                <CreditCard size={14} className="sm:w-4 sm:h-4 text-zinc-400 flex-shrink-0" />
                <p className="text-xs sm:text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100 truncate">{uid}</p>
              </div>

              {/* CAMPI DIPENDENTE */}
              <div className={`grid gap-2.5 sm:gap-4 ${portaleAttivo ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"}`}>

                <input type="text" placeholder="Nome" value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  className="h-10 sm:h-12 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none"
                  required />

                <input type="text" placeholder="Cognome" value={employeeCognome}
                  onChange={(e) => setEmployeeCognome(e.target.value)}
                  className="h-10 sm:h-12 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none"
                  required />

                {portaleAttivo && (
                  <div className="relative sm:col-span-2">
                    <Mail size={14} className="sm:w-4 sm:h-4 absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                    <input
                      type="email"
                      placeholder="Email dipendente *"
                      value={employeeEmail}
                      onChange={(e) => setEmployeeEmail(e.target.value)}
                      className="w-full h-10 sm:h-12 pl-8 sm:pl-10 pr-3 sm:pr-4 rounded-xl sm:rounded-2xl border border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none focus:border-blue-500 placeholder-zinc-400"
                      required={portaleAttivo}
                    />
                  </div>
                )}

                <button type="submit"
                  className={`h-10 sm:h-12 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-medium ${portaleAttivo ? "sm:col-span-2" : ""}`}>
                  Registra Badge
                </button>

              </div>
            </div>
          )}
        </form>

        {/* LISTA BADGE */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {badges.map((badge) => {
            const isEditing = editingId === badge.id;
            return (
              <div key={badge.id} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">

                {/* header card */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="w-9 sm:w-12 h-9 sm:h-12 rounded-lg sm:rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <CreditCard size={16} className="sm:w-5 sm:h-5 text-zinc-700 dark:text-zinc-200" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => isEditing ? setEditingId(null) : startEdit(badge)}
                      className="text-[10px] sm:text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium flex items-center gap-1"
                    >
                      {isEditing ? <X size={12} /> : <Pencil size={12} />}
                      {isEditing ? "Annulla" : "Modifica"}
                    </button>
                    <button onClick={() => askDeleteBadge(badge.id)}
                      className="text-[10px] sm:text-xs text-red-500 hover:text-red-700 font-medium">
                      Elimina
                    </button>
                  </div>
                </div>

                {/* UID */}
                <p className="text-[10px] sm:text-xs text-zinc-400 mb-0.5">UID</p>
                <p className="text-xs sm:text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100 truncate mb-3">{badge.uid}</p>

                {isEditing ? (
                  /* ── edit mode ── */
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={editForm.nome}
                        onChange={e => setEditForm(p => ({ ...p, nome: e.target.value }))}
                        placeholder="Nome"
                        className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs outline-none"
                      />
                      <input
                        value={editForm.cognome}
                        onChange={e => setEditForm(p => ({ ...p, cognome: e.target.value }))}
                        placeholder="Cognome"
                        className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs outline-none"
                      />
                    </div>

                    {portaleAttivo && (
                      <div className="relative">
                        <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
                        <input
                          type="email"
                          value={editForm.email}
                          onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))}
                          placeholder={badge.ha_account ? "Email account" : "Email (crea account portale)"}
                          className={`w-full h-9 pl-8 pr-3 rounded-xl border text-xs outline-none ${
                            badge.ha_account
                              ? "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                              : "border-blue-300 dark:border-blue-500/40 bg-blue-50 dark:bg-blue-500/10 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400"
                          }`}
                        />
                      </div>
                    )}

                    <button
                      onClick={() => saveEdit(badge)}
                      disabled={editSaving}
                      className="w-full h-9 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-xs font-medium disabled:opacity-50"
                    >
                      {editSaving ? "Salvataggio..." : "Salva"}
                    </button>
                  </div>
                ) : (
                  /* ── view mode ── */
                  <div>
                    <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium truncate">{badge.nome}</p>
                    {portaleAttivo && (
                      badge.ha_account
                        ? <p className="text-[10px] sm:text-xs text-green-500 mt-1 flex items-center gap-1">
                            <CheckCircle2 size={11} /> Account attivo · {badge.email}
                          </p>
                        : <button
                            onClick={() => startEdit(badge)}
                            className="text-[10px] sm:text-xs text-blue-500 hover:text-blue-700 mt-1 flex items-center gap-1"
                          >
                            <Mail size={11} /> Aggiungi email e crea account
                          </button>
                    )}
                  </div>
                )}

              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
