import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil } from "lucide-react";
import { API_URL } from "../api";
import { SettingsHeader } from "../components/SettingsUI";

export default function SettingsProfilo() {
  const token    = localStorage.getItem("token");
  const navigate = useNavigate();

  const [profile, setProfile]             = useState({ nome: "", cognome: "", email: "", username: "" });
  const [loading, setLoading]             = useState(true);
  const [editing, setEditing]             = useState(false);
  const [editNome, setEditNome]           = useState("");
  const [editCognome, setEditCognome]     = useState("");
  const [editEmail, setEditEmail]         = useState("");
  const [saving, setSaving]               = useState(false);
  const [toast, setToast]                 = useState(null);

  useEffect(() => { loadProfile(); }, []);

  function showToast(msg, type = "success") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function loadProfile() {
    try {
      const res  = await fetch(API_URL + "/api/owner/profile", {
        headers: { Authorization: "Bearer " + token }
      });
      const json = await res.json();
      if (json.success) {
        setProfile(json.profile);
        setEditNome(json.profile.nome || "");
        setEditCognome(json.profile.cognome || "");
        setEditEmail(json.profile.email || "");
      }
    } catch (err) { console.log(err); }
    finally { setLoading(false); }
  }

  function startEdit() {
    setEditNome(profile.nome || "");
    setEditCognome(profile.cognome || "");
    setEditEmail(profile.email || "");
    setEditing(true);
  }

  async function saveProfile() {
    if (!editNome.trim()) { showToast("Il nome è obbligatorio", "error"); return; }
    if (editEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail)) {
      showToast("Email non valida", "error"); return;
    }
    setSaving(true);
    try {
      const res  = await fetch(API_URL + "/api/owner/profile", {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body:    JSON.stringify({ nome: editNome.trim(), cognome: editCognome.trim(), email: editEmail.trim() || null })
      });
      const json = await res.json();
      if (!json.success) { showToast(json.error || "Errore salvataggio", "error"); return; }

      // Aggiorna localStorage con il nuovo nome
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");
        user.nome    = editNome.trim();
        user.cognome = editCognome.trim();
        if (editEmail) user.email = editEmail.trim();
        localStorage.setItem("user", JSON.stringify(user));
      } catch {}

      setProfile(p => ({ ...p, nome: editNome.trim(), cognome: editCognome.trim(), email: editEmail.trim() || p.email }));
      setEditing(false);

      if (json.credenziali_reinviate) {
        showToast("Profilo aggiornato — verrai disconnesso...");
        setTimeout(() => { localStorage.clear(); navigate("/"); }, 2500);
        return;
      } else {
        showToast("Profilo aggiornato");
      }
    } catch (err) { console.log(err); showToast("Errore server", "error"); }
    finally { setSaving(false); }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <div className="h-8 w-32 bg-zinc-200 dark:bg-zinc-700 rounded-xl animate-pulse mb-6" />
        <div className="h-32 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4">
      <SettingsHeader title="Profilo" subtitle="Nome, cognome e indirizzo email" />

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-medium shadow-xl transition-all ${
          toast.type === "error"
            ? "bg-red-600 text-white"
            : "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="rounded-2xl sm:rounded-3xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-5 sm:p-6">

        {!editing ? (
          <div>
            {/* Avatar + info */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-11 h-11 rounded-2xl bg-zinc-900 dark:bg-zinc-100 flex items-center justify-center text-white dark:text-black text-base font-semibold shrink-0">
                  {(profile.nome?.[0] || profile.username?.[0] || "?").toUpperCase()}
                  {(profile.cognome?.[0] || "").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {profile.nome ? `${profile.nome} ${profile.cognome || ""}`.trim() : profile.username}
                  </p>
                  {profile.email && (
                    <p className="text-xs text-zinc-500 truncate">{profile.email}</p>
                  )}
                  <p className="text-xs text-zinc-400 truncate">@{profile.username}</p>
                </div>
              </div>
              <button
                onClick={startEdit}
                className="shrink-0 flex items-center gap-1.5 px-3 h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 text-xs font-medium"
              >
                <Pencil size={13} /> Modifica
              </button>
            </div>

            {/* Campi dettaglio */}
            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Nome</span>
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">{profile.nome || "—"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Cognome</span>
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">{profile.cognome || "—"}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-zinc-100 dark:border-zinc-800">
                <span className="text-zinc-500">Email</span>
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">{profile.email || "—"}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-zinc-500">Username</span>
                <span className="text-zinc-900 dark:text-zinc-100 font-medium">{profile.username}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">Modifica profilo</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-xs text-zinc-400 mb-1">Nome *</p>
                <input
                  value={editNome}
                  onChange={e => setEditNome(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1">Cognome</p>
                <input
                  value={editCognome}
                  onChange={e => setEditCognome(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-400 mb-1">Email</p>
              <input
                type="email"
                value={editEmail}
                onChange={e => setEditEmail(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
              />
            </div>

            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Se modifichi nome o email, ti verrà inviata una email con le nuove credenziali di accesso (inclusa una nuova password).
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={saveProfile}
                disabled={saving}
                className="flex-1 h-10 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50"
              >
                {saving ? "Salvataggio..." : "Salva"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="flex-1 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 text-sm font-medium"
              >
                Annulla
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
