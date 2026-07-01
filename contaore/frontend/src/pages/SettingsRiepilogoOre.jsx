import { useEffect, useState } from "react";
import { API_URL } from "../api";
import { Toast, Toggle, SettingsHeader, EmployeeSelector, DaySelector } from "../components/SettingsUI";

const TIPO = "riepilogo_ore_mensile";

export default function SettingsRiepilogoOre() {
  const [employees, setEmployees] = useState([]);
  const [selected, setSelected]   = useState(new Set());
  const [tutti, setTutti]         = useState(true);

  const [attiva, setAttiva]         = useState(false);
  const [giorno, setGiorno]         = useState(5);
  const [formato, setFormato]       = useState("pdf");
  const [modalita, setModalita]     = useState("automatico"); // 'automatico' | 'approvazione'
  const [email, setEmail]           = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [pending, setPending]           = useState([]);
  const [actingId, setActingId]         = useState(null);

  const [toast, setToast] = useState(null);
  const showToast = (message, type = "success") => setToast({ message, type });
  const token = localStorage.getItem("token");

  function toggleEmp(id) {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  async function loadPending() {
    try {
      const res  = await fetch(`${API_URL}/api/notifications/riepilogo-ore/pending`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.success) setPending(data.pending || []);
    } catch (_) {}
  }

  useEffect(() => {
    fetch(`${API_URL}/api/employees`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => { if (d.success) setEmployees(d.employees || []); }).catch(() => {});

    fetch(`${API_URL}/api/notifications/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json()).then(d => {
        if (!d.success) return;
        const s = (d.settings || []).find(x => x.tipo === TIPO);
        if (!s) return;
        setAttiva(!!s.attiva);
        setGiorno(s.parametri?.giorno_invio ?? 5);
        setFormato(s.parametri?.formato === "excel" ? "excel" : "pdf");
        setModalita(s.parametri?.modalita === "approvazione" ? "approvazione" : "automatico");
        setEmail(s.email_destinatario || "");
        if (Array.isArray(s.target_ids) && s.target_ids.length) {
          setTutti(false);
          setSelected(new Set(s.target_ids));
        } else {
          setTutti(true);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    loadPending();
  }, []);

  async function salva(next = {}) {
    const body = {
      attiva:   next.attiva   ?? attiva,
      parametri: {
        giorno_invio: next.giorno   ?? giorno,
        formato:      next.formato  ?? formato,
        modalita:     next.modalita ?? modalita
      },
      target_ids:         (next.tutti ?? tutti) ? null : [...(next.selected ?? selected)],
      email_destinatario: next.email ?? email
    };
    setSaving(true);
    try {
      const res  = await fetch(`${API_URL}/api/notifications/settings/${TIPO}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!data.success) { showToast("Errore salvataggio", "error"); return; }
      showToast("Impostazioni salvate");
    } catch (_) { showToast("Errore server", "error"); }
    finally { setSaving(false); }
  }

  async function approva(id) {
    setActingId(id);
    try {
      const res  = await fetch(`${API_URL}/api/notifications/riepilogo-ore/${id}/approve`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || "Errore invio", "error"); return; }
      showToast("Riepilogo inviato");
      loadPending();
    } catch (_) { showToast("Errore server", "error"); }
    finally { setActingId(null); }
  }

  async function rifiuta(id) {
    if (!confirm("Rifiutare questo riepilogo? Non verrà inviato.")) return;
    setActingId(id);
    try {
      const res  = await fetch(`${API_URL}/api/notifications/riepilogo-ore/${id}/reject`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) { showToast("Errore", "error"); return; }
      showToast("Riepilogo rifiutato");
      loadPending();
    } catch (_) { showToast("Errore server", "error"); }
    finally { setActingId(null); }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        <SettingsHeader title="Invio riepilogo ore" subtitle="Invia automaticamente PDF o Excel via email" />
        <p className="text-sm text-zinc-400 text-center py-10">Caricamento...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <SettingsHeader title="Invio riepilogo ore" subtitle="Invia automaticamente PDF o Excel via email" />

      {pending.length > 0 && (
        <div className="rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-6 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">In attesa di approvazione</h2>
            <p className="text-xs text-zinc-500">Scaricalo dalla pagina Dipendenti per controllarlo, poi approva o rifiuta l'invio</p>
          </div>
          <div className="space-y-3">
            {pending.map(p => (
              <div key={p.id} className="rounded-xl bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 capitalize">{p.periodo}</p>
                  <p className="text-xs text-zinc-500">
                    {p.formato === "excel" ? "Excel" : "PDF"} · {Array.isArray(p.dipendente_ids) ? p.dipendente_ids.length : 0} dipendenti · a {p.destinatario_email}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => rifiuta(p.id)} disabled={actingId === p.id}
                    className="h-9 px-3 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300 disabled:opacity-50">
                    Rifiuta
                  </button>
                  <button onClick={() => approva(p.id)} disabled={actingId === p.id}
                    className="h-9 px-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-xs font-medium disabled:opacity-50">
                    {actingId === p.id ? "Invio..." : "Approva e invia"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Invio automatico riepilogo ore</h2>
            <p className="text-xs text-zinc-500">Invia via email il totale ore del mese precedente</p>
          </div>
          <Toggle value={attiva} onChange={(v) => { setAttiva(v); salva({ attiva: v }); }} />
        </div>

        {attiva && (
          <div className="space-y-5">
            <EmployeeSelector employees={employees} tutti={tutti} onTuttiChange={(v) => { setTutti(v); salva({ tutti: v }); }} selected={selected} onToggle={(id) => { toggleEmp(id); }} />

            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Formato</p>
              <div className="flex p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-800">
                {[{ id: "pdf", label: "PDF" }, { id: "excel", label: "Excel" }].map(o => (
                  <button key={o.id} type="button" onClick={() => { setFormato(o.id); salva({ formato: o.id }); }}
                    className={`flex-1 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                      formato === o.id ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm" : "text-zinc-500"
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Giorno del mese di invio</p>
              <DaySelector value={giorno} onChange={(v) => { setGiorno(v); salva({ giorno: v }); }} />
              <p className="text-xs text-zinc-400 mt-1">Es. giorno 5: il 5 di ogni mese viene inviato il riepilogo del mese precedente.</p>
            </div>

            <div>
              <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Email destinatario</p>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                onBlur={() => salva({ email })}
                placeholder="contabilita@esempio.it"
                className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div>
                <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Invio automatico</p>
                <p className="text-xs text-zinc-400">Se disattivato, il riepilogo resta in attesa della tua approvazione prima dell'invio</p>
              </div>
              <Toggle value={modalita === "automatico"} onChange={(v) => { const m = v ? "automatico" : "approvazione"; setModalita(m); salva({ modalita: m }); }} />
            </div>

            {saving && <p className="text-xs text-zinc-400">Salvataggio...</p>}
          </div>
        )}
      </div>
    </div>
  );
}
