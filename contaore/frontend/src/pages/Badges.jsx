import { useEffect, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import {
  CreditCard, CheckCircle2, XCircle, Mail, Pencil, X, ArrowLeft
} from "lucide-react";
import { API_URL } from "../api";
import { usePullToRefresh, PullIndicator } from "../hooks/usePullToRefresh.jsx";

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`
      fixed bottom-28 left-1/2 -translate-x-1/2 z-50
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

  const [dark, setDark]                     = useState(false);
  const [badges, setBadges]                 = useState([]);
  const [uid, setUid]                       = useState("");
  const [employeeName, setEmployeeName]     = useState("");
  const [employeeCognome, setEmployeeCognome] = useState("");
  const [employeeEmail, setEmployeeEmail]   = useState("");
  const [waitingScan, setWaitingScan]       = useState(false);
  const [toast, setToast]                   = useState(null);
  const [confirm, setConfirm]               = useState(null);
  const { portaleAttivo } = useOutletContext();
  const [editingUidId, setEditingUidId]     = useState(null);
  const [newUid, setNewUid]                 = useState("");
  const [updatingUid, setUpdatingUid]       = useState(false);
  const [informativaConsegnata, setInformativaConsegnata] = useState(false);

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

  // ─── carica badge ─────────────────────────────────────────────────────────
  useEffect(() => {
    loadBadges();
  }, []);

  async function loadBadges() {
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(API_URL + "/api/tags", { headers: { Authorization: `Bearer ${token}` } });
      const data  = await res.json();
      if (data.success) setBadges(data.tags || []);
    } catch (err) { console.log(err); }
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
          employee_name:          employeeName,
          employee_cognome:       employeeCognome,
          employee_email:         employeeEmail.trim() || undefined,
          informativa_consegnata: informativaConsegnata
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
      setInformativaConsegnata(false);
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

  function startEditUid(badge) {
    setEditingUidId(badge.id);
    setNewUid(badge.uid);
  }

  async function saveUid(badge) {
    if (!newUid.trim()) {
      showToast("UID non può essere vuoto", "error");
      return;
    }
    if (newUid === badge.uid) {
      setEditingUidId(null);
      return;
    }

    setUpdatingUid(true);
    try {
      const token = localStorage.getItem("token");
      const res  = await fetch(`${API_URL}/api/tags/${badge.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ uid: newUid.trim() })
      });
      const data = await res.json();
      if (!data.success) {
        const msg = data.error === "UID_ALREADY_EXISTS" ? "UID già registrato" : data.error || "Errore";
        showToast(msg, "error");
        return;
      }
      showToast("UID aggiornato");
      setEditingUidId(null);
      loadBadges();
    } catch (err) { showToast("Errore server", "error"); }
    finally { setUpdatingUid(false); }
  }

  return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {confirm && (
        <ConfirmDialog
          message={confirm.message}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

        <PullIndicator pulling={pulling} refreshing={refreshing} distance={distance} />

        {/* BACK */}
        <Link to="/employees" className="inline-flex items-center gap-1.5 mb-4 text-sm font-medium text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
          <ArrowLeft size={16} /> Dipendenti
        </Link>

        {/* TITLE */}
        <div className="mb-5 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Aggiungi dipendente</h2>
          <p className="text-xs sm:text-sm text-zinc-500 mt-1 sm:mt-2">Registra un nuovo badge NFC e associalo a un dipendente</p>
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

                <label className="flex items-start gap-2.5 cursor-pointer sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={informativaConsegnata}
                    onChange={e => setInformativaConsegnata(e.target.checked)}
                    className="mt-0.5 flex-shrink-0 h-4 w-4 accent-zinc-900"
                    required
                  />
                  <span className="text-[11px] sm:text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                    Ho consegnato l'<strong>informativa privacy</strong> (art. 13 GDPR) al dipendente.
                  </span>
                </label>

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
            return (
              <div key={badge.id} className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 sm:p-6">

                {/* header card */}
                <div className="flex items-start justify-between mb-3 sm:mb-4">
                  <div className="w-9 sm:w-12 h-9 sm:h-12 rounded-lg sm:rounded-2xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <CreditCard size={16} className="sm:w-5 sm:h-5 text-zinc-700 dark:text-zinc-200" />
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <button
                      onClick={() => editingUidId === badge.id ? setEditingUidId(null) : startEditUid(badge)}
                      className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg sm:rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 text-[10px] sm:text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Aggiorna l'UID del badge"
                    >
                      <CreditCard size={12} />
                      {editingUidId === badge.id ? "Annulla" : "Aggiorna UID"}
                    </button>
                    <button
                      onClick={() => askDeleteBadge(badge.id)}
                      className="h-7 sm:h-8 px-2.5 sm:px-3 rounded-lg sm:rounded-xl bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 text-[10px] sm:text-xs font-semibold flex items-center gap-1 transition-colors"
                      title="Elimina badge e dipendente"
                    >
                      <X size={12} />
                      Elimina
                    </button>
                  </div>
                </div>

                {/* UID */}
                <p className="text-[10px] sm:text-xs text-zinc-400 mb-0.5">UID</p>
                {editingUidId === badge.id ? (
                  <div className="flex gap-2 mb-3">
                    <input
                      type="text"
                      value={newUid}
                      onChange={e => setNewUid(e.target.value)}
                      placeholder="Nuovo UID"
                      className="flex-1 h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs outline-none font-mono"
                      autoFocus
                    />
                    <button
                      onClick={() => saveUid(badge)}
                      disabled={updatingUid}
                      className="h-9 px-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
                    >
                      {updatingUid ? "..." : "OK"}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100 truncate mb-3">{badge.uid}</p>
                )}

                {/* Dipendente info */}
                <div>
                  <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 font-medium truncate">{badge.nome}</p>
                  {portaleAttivo && (
                    badge.ha_account
                      ? <p className="text-[10px] sm:text-xs text-green-500 mt-1 flex items-center gap-1">
                          <CheckCircle2 size={11} /> Account attivo · {badge.email}
                        </p>
                      : <p className="text-[10px] sm:text-xs text-zinc-400 mt-1">Nessun account</p>
                  )}
                </div>

              </div>
            );
          })}
        </div>

      </div>
  );
}
