import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Plus, Trash2, Shield, Pencil, CheckCircle2, X } from "lucide-react";
import { API_URL } from "../api";
import { EmployeeSelector } from "../components/SettingsUI";

const PERMISSIONS = [
  { key: "can_view_presenze",    label: "Visualizza presenze",   desc: "Può vedere lo storico presenze dei dipendenti" },
  { key: "can_edit_presenze",    label: "Modifica presenze",     desc: "Può aggiungere e modificare timbrature manuali" },
  { key: "can_approve_requests", label: "Approva richieste",     desc: "Può approvare ferie, permessi e giustificazioni" },
  { key: "can_manage_employees", label: "Gestisce dipendenti",   desc: "Può creare, modificare e gestire i turni dei dipendenti" },
];

function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t); }, []);
  return (
    <div className={`anim-toast fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium ${type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"}`}>
      {type === "success" ? <CheckCircle2 size={16} /> : <X size={16} />}
      {message}
    </div>
  );
}

function PermBadge({ label }) {
  return (
    <span className="px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 text-[11px] font-medium">
      {label}
    </span>
  );
}

export default function SettingsAdmin() {
  const navigate  = useNavigate();
  const [admins, setAdmins]   = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail]       = useState("");
  const [newNome, setNewNome]         = useState("");
  const [newCognome, setNewCognome]   = useState("");
  const [newPerms, setNewPerms]       = useState({ can_view_presenze: true, can_edit_presenze: false, can_approve_requests: false, can_manage_employees: false });
  const [newTutti, setNewTutti]       = useState(true);
  const [newSelected, setNewSelected] = useState(new Set());
  const [creating, setCreating]       = useState(false);

  const [editId, setEditId]     = useState(null);
  const [editPerms, setEditPerms] = useState({});
  const [editTutti, setEditTutti] = useState(true);
  const [editSelected, setEditSelected] = useState(new Set());
  const [editSaving, setEditSaving] = useState(false);

  function showToast(msg, type = "success") { setToast({ message: msg, type }); }

  function token() { return localStorage.getItem("token"); }

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch(API_URL + "/api/admin-accounts", { headers: { Authorization: "Bearer " + token() } });
      const data = await res.json();
      if (data.success) setAdmins(data.admins);
    } catch (_) {}
    setLoading(false);
  }

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user.role !== "owner" && user.role !== "superadmin") { navigate("/impostazioni"); return; }
    load();
    fetch(API_URL + "/api/employees", { headers: { Authorization: "Bearer " + token() } })
      .then(r => r.json()).then(d => { if (d.success) setEmployees(d.employees || []); }).catch(() => {});
  }, []);

  async function createAdmin() {
    if (!newNome.trim() || !newCognome.trim() || !newEmail.trim()) { showToast("Nome, cognome ed email sono obbligatori", "error"); return; }
    setCreating(true);
    try {
      const res  = await fetch(API_URL + "/api/admin-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
        body: JSON.stringify({
          email: newEmail.trim(), nome: newNome.trim(), cognome: newCognome.trim(), permissions: newPerms,
          employee_ids: newTutti ? null : [...newSelected]
        })
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || "Errore", "error"); return; }
      showToast(`Admin creato: @${data.admin.username} — Password: ${data.password}`);
      setShowCreate(false);
      setNewEmail(""); setNewNome(""); setNewCognome("");
      setNewPerms({ can_view_presenze: true, can_edit_presenze: false, can_approve_requests: false, can_manage_employees: false });
      setNewTutti(true); setNewSelected(new Set());
      load();
    } catch (_) { showToast("Errore server", "error"); }
    setCreating(false);
  }

  function startEdit(admin) {
    setEditId(admin.id);
    setEditPerms(admin.permissions || {});
    const ids = admin.assigned_dipendente_ids;
    if (Array.isArray(ids) && ids.length) { setEditTutti(false); setEditSelected(new Set(ids)); }
    else { setEditTutti(true); setEditSelected(new Set()); }
  }

  async function saveEdit() {
    setEditSaving(true);
    try {
      const res  = await fetch(API_URL + "/api/admin-accounts/" + editId, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
        body: JSON.stringify({ permissions: editPerms, employee_ids: editTutti ? null : [...editSelected] })
      });
      const data = await res.json();
      if (!data.success) { showToast("Errore salvataggio", "error"); return; }
      showToast("Permessi aggiornati");
      setEditId(null);
      load();
    } catch (_) { showToast("Errore server", "error"); }
    setEditSaving(false);
  }

  async function deleteAdmin(id) {
    if (!confirm("Eliminare questo account admin?")) return;
    try {
      const res  = await fetch(API_URL + "/api/admin-accounts/" + id, { method: "DELETE", headers: { Authorization: "Bearer " + token() } });
      const data = await res.json();
      if (!data.success) { showToast("Errore eliminazione", "error"); return; }
      showToast("Admin eliminato");
      load();
    } catch (_) { showToast("Errore server", "error"); }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      <button onClick={() => navigate("/impostazioni")} className="inline-flex items-center gap-0.5 -ml-1 mb-4 text-sm font-medium text-blue-500 hover:text-blue-600">
        <ChevronLeft size={18} /> Impostazioni
      </button>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Account amministratori</h1>
          <p className="text-sm text-zinc-500 mt-1">Account secondari con permessi limitati per il tuo staff</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="h-9 px-4 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium flex items-center gap-1.5"
        >
          <Plus size={14} /> Nuovo admin
        </button>
      </div>

      {/* LISTA ADMIN */}
      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] divide-y divide-zinc-100 dark:divide-zinc-800">
        {loading ? (
          <p className="text-sm text-zinc-400 text-center py-10">Caricamento...</p>
        ) : admins.length === 0 ? (
          <div className="py-12 text-center">
            <Shield size={32} className="text-zinc-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-sm text-zinc-400">Nessun account admin creato</p>
            <p className="text-xs text-zinc-300 dark:text-zinc-600 mt-1">Crea un account per dare accesso limitato al tuo staff</p>
          </div>
        ) : admins.map(admin => (
          <div key={admin.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  {admin.nome || admin.cognome ? `${admin.nome || ""} ${admin.cognome || ""}`.trim() : admin.username}
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">@{admin.username}{admin.email ? ` · ${admin.email}` : ""}</p>
                <p className="text-xs text-zinc-400 mt-1">
                  Accesso: {Array.isArray(admin.assigned_dipendente_ids) && admin.assigned_dipendente_ids.length
                    ? `${admin.assigned_dipendente_ids.length} dipendent${admin.assigned_dipendente_ids.length === 1 ? "e" : "i"}`
                    : "tutti i dipendenti"}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {PERMISSIONS.filter(p => admin.permissions?.[p.key]).map(p => (
                    <PermBadge key={p.key} label={p.label} />
                  ))}
                  {!PERMISSIONS.some(p => admin.permissions?.[p.key]) && (
                    <span className="text-xs text-zinc-400">Nessun permesso attivo</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button onClick={() => startEdit(admin)} className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-blue-500 transition-colors">
                  <Pencil size={13} />
                </button>
                <button onClick={() => deleteAdmin(admin.id)} className="w-8 h-8 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-red-500 transition-colors">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* EDIT PERMESSI INLINE */}
            {editId === admin.id && (
              <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl space-y-4">
                <div>
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Accesso ai dipendenti</p>
                  <EmployeeSelector employees={employees} tutti={editTutti} onTuttiChange={setEditTutti}
                    selected={editSelected}
                    onToggle={id => setEditSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })} />
                </div>
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Permessi</p>
                {PERMISSIONS.map(p => (
                  <label key={p.key} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!editPerms[p.key]}
                      onChange={e => setEditPerms(prev => ({ ...prev, [p.key]: e.target.checked }))}
                      className="mt-0.5 rounded"
                    />
                    <div>
                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.label}</p>
                      <p className="text-xs text-zinc-400">{p.desc}</p>
                    </div>
                  </label>
                ))}
                <div className="flex gap-3 pt-2">
                  <button onClick={saveEdit} disabled={editSaving}
                    className="flex-1 h-10 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50">
                    {editSaving ? "Salvataggio..." : "Salva permessi"}
                  </button>
                  <button onClick={() => setEditId(null)}
                    className="flex-1 h-10 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300">
                    Annulla
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MODALE CREA ADMIN */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Nuovo admin</h3>
            <p className="text-xs text-zinc-400 mb-5">Username e password temporanea verranno generati automaticamente e inviati via email</p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Nome *</p>
                  <input type="text" value={newNome} onChange={e => setNewNome(e.target.value)}
                    className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Cognome *</p>
                  <input type="text" value={newCognome} onChange={e => setNewCognome(e.target.value)}
                    className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1">Email *</p>
                <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                  placeholder="email@esempio.it"
                  className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
              </div>

              <div className="pt-1">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Accesso ai dipendenti</p>
                <EmployeeSelector employees={employees} tutti={newTutti} onTuttiChange={setNewTutti}
                  selected={newSelected}
                  onToggle={id => setNewSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; })} />
              </div>

              <div className="pt-1">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-3">Permessi</p>
                <div className="space-y-3">
                  {PERMISSIONS.map(p => (
                    <label key={p.key} className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!newPerms[p.key]}
                        onChange={e => setNewPerms(prev => ({ ...prev, [p.key]: e.target.checked }))}
                        className="mt-0.5 rounded"
                      />
                      <div>
                        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{p.label}</p>
                        <p className="text-xs text-zinc-400">{p.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={createAdmin} disabled={creating}
                className="flex-1 h-11 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50">
                {creating ? "Creazione..." : "Crea admin"}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="flex-1 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300">
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
