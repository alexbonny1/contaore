import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Download, X, CheckSquare, Square, FileText, Table2, UserPlus, Trash2
} from "lucide-react";
import { API_URL, apiFetch, hasPermission, hasAnyPermission } from "../api";
import { usePullToRefresh, PullIndicator } from "../hooks/usePullToRefresh.jsx";

/*
────────────────────────────────────
HELPERS
────────────────────────────────────
*/

function formatOre(h) {
  if (!h || h === 0) return "0m";
  const ore = Math.floor(h);
  const min = Math.round((h - ore) * 60);
  if (ore === 0) return `${min}m`;
  if (min === 0) return `${ore}h`;
  return `${ore}h ${min}m`;
}

/*
────────────────────────────────────
MODALE EXPORT
────────────────────────────────────
*/

function ExportModal({ employees, onClose, token, initialIds }) {

  const [selectedIds, setSelectedIds] = useState(
    initialIds && initialIds.length ? initialIds : employees.map(e => e.id)
  );
  const [selectedMonth, setSelectedMonth] = useState("tutti");
  const [availableMonths, setAvailableMonths] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadMonths() {
      const monthSet = new Set();
      for (const emp of employees) {
        try {
          const res = await fetch(`${API_URL}/api/employees/${emp.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const data = await res.json();
          if (data.success && data.employee.history_months) {
            data.employee.history_months.forEach(m => monthSet.add(m.mese));
          }
        } catch {}
      }
      const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno",
        "luglio","agosto","settembre","ottobre","novembre","dicembre"];
      const sorted = [...monthSet].sort((a, b) => {
        const parse = s => {
          const parts = s.split(" ");
          return new Date(parseInt(parts[1]), MESI.indexOf(parts[0].toLowerCase()));
        };
        return parse(b) - parse(a);
      });
      setAvailableMonths(sorted);
    }
    loadMonths();
  }, []);

  function toggleEmployee(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  }

  function toggleAll() {
    setSelectedIds(
      selectedIds.length === employees.length ? [] : employees.map(e => e.id)
    );
  }

  async function buildExportData() {
    const result = [];
    for (const id of selectedIds) {
      const res = await fetch(`${API_URL}/api/employees/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) continue;
      const emp = data.employee;
      let months = emp.history_months || [];
      if (selectedMonth !== "tutti") months = months.filter(m => m.mese === selectedMonth);
      result.push({ emp, months });
    }
    return result;
  }

  async function exportPDF() {
    setLoading(true);
    // Apre subito una finestra vuota (sincrono, dentro il click) così Safari non la
    // blocca come popup. Il PDF verrà caricato lì una volta pronto, invece che al
    // posto della pagina dell'app: su iPhone Safari apre spesso i PDF a schermo
    // intero sostituendo la pagina corrente, e tornare indietro da lì mostrava una
    // schermata bianca.
    const pdfWindow = window.open("", "_blank");
    try {
      const response = await fetch(`${API_URL}/api/export/pdf`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          employee_ids: selectedIds,
          month: selectedMonth
        })
      });

      if (!response.ok) throw new Error("Errore generazione PDF");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      if (pdfWindow) {
        pdfWindow.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = `Timbry_${selectedMonth === "tutti" ? "storico" : selectedMonth.replace(/\s/g, "_")}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (pdfWindow) pdfWindow.close();
    } finally {
      setLoading(false);
    }
  }

  async function exportExcel() {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/export/excel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          employee_ids: selectedIds,
          month: selectedMonth
        })
      });

      if (!response.ok) throw new Error("Errore generazione Excel");

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Timbry_${selectedMonth === "tutti" ? "storico" : selectedMonth.replace(/\s/g, "_")}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="min-w-0 flex-1 pr-3">
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100 truncate">Esporta presenze</h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">Seleziona periodo e dipendenti</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <X size={14} className="sm:w-4 sm:h-4 text-zinc-500" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6 space-y-5 sm:space-y-6">

          <div>
            <p className="text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Periodo</p>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full h-10 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none"
            >
              <option value="tutti">Tutto lo storico</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300">Dipendenti</p>
              <button onClick={toggleAll} className="text-[10px] sm:text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                {selectedIds.length === employees.length ? "Deseleziona tutti" : "Seleziona tutti"}
              </button>
            </div>
            <div className="space-y-2 max-h-48 sm:max-h-52 overflow-y-auto pr-1">
              {employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => toggleEmployee(emp.id)}
                  className="w-full flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left"
                >
                  {selectedIds.includes(emp.id)
                    ? <CheckSquare size={16} className="sm:w-[18px] sm:h-[18px] text-indigo-500 shrink-0" />
                    : <Square size={16} className="sm:w-[18px] sm:h-[18px] text-zinc-400 shrink-0" />
                  }
                  <span className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {emp.nome} {emp.cognome}
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>

        <div className="p-4 sm:p-6 border-t border-zinc-200 dark:border-zinc-800 shrink-0 space-y-3">

          {loading && <p className="text-center text-xs sm:text-sm text-zinc-500">Generazione in corso...</p>}

          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={exportPDF}
              disabled={loading || selectedIds.length === 0}
              className="flex items-center justify-center gap-1.5 sm:gap-2 h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-semibold disabled:opacity-40 transition-all"
            >
              <FileText size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Esporta </span>PDF
            </button>
            <button
              onClick={exportExcel}
              disabled={loading || selectedIds.length === 0}
              className="flex items-center justify-center gap-1.5 sm:gap-2 h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-green-600 hover:bg-green-700 text-white text-xs sm:text-sm font-semibold disabled:opacity-40 transition-all"
            >
              <Table2 size={14} className="sm:w-4 sm:h-4" />
              <span className="hidden xs:inline">Esporta </span>Excel
            </button>
          </div>

          <p className="text-[10px] sm:text-xs text-center text-zinc-400">
            {selectedIds.length} dipendent{selectedIds.length === 1 ? "e" : "i"} selezionat{selectedIds.length === 1 ? "o" : "i"}
          </p>

        </div>

      </div>
    </div>
  );
}

/*
────────────────────────────────────
MODALE ASSEGNA TURNO (multi-dipendente)
────────────────────────────────────
*/

const GIORNI = ["Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato","Domenica"];

function AssignShiftModal({ selectedEmployees, onClose, token }) {
  const [turnoNome, setTurnoNome]           = useState("");
  const [giorniSelezionati, setGiorniSel]   = useState([]);
  const [ingresso1, setIngresso1]           = useState("");
  const [uscita1, setUscita1]               = useState("");
  const [ingresso2, setIngresso2]           = useState("");
  const [uscita2, setUscita2]               = useState("");
  const [saving, setSaving]                 = useState(false);
  const [toast, setToast]                   = useState(null);

  function toggleGiorno(g) {
    setGiorniSel(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);
  }

  async function salva(e) {
    e.preventDefault();
    if (giorniSelezionati.length === 0) { setToast({ msg: "Seleziona almeno un giorno", type: "error" }); return; }
    setSaving(true);
    let errors = 0;
    try {
      for (const emp of selectedEmployees) {
        for (const g of giorniSelezionati) {
          const res  = await fetch(`${API_URL}/api/employees/${emp.id}/shift`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              turno_nome:       turnoNome,
              giorno_settimana: g,
              ingresso_1:       ingresso1 || null,
              uscita_1:         uscita1   || null,
              ingresso_2:       ingresso2 || null,
              uscita_2:         uscita2   || null,
            })
          });
          const data = await res.json();
          if (!data.success) errors++;
        }
      }
      if (errors === 0) {
        for (const emp of selectedEmployees) {
          await fetch(`${API_URL}/api/employees/${emp.id}/toggle-turni`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ turni_attivi: true })
          });
        }
        setToast({ msg: `Turni assegnati a ${selectedEmployees.length} dipendent${selectedEmployees.length === 1 ? "e" : "i"}`, type: "ok" });
        setTimeout(onClose, 1500);
      } else {
        setToast({ msg: `${errors} errori durante il salvataggio`, type: "error" });
      }
    } catch { setToast({ msg: "Errore server", type: "error" }); }
    finally { setSaving(false); }
  }

  const n = selectedEmployees.length;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl flex flex-col max-h-[90vh]">

        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="min-w-0 flex-1 pr-3">
            <h2 className="text-lg sm:text-xl font-bold text-zinc-900 dark:text-zinc-100">Assegna turno</h2>
            <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">{n} dipendent{n === 1 ? "e" : "i"} selezionat{n === 1 ? "o" : "i"}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <X size={14} className="sm:w-4 sm:h-4 text-zinc-500" />
          </button>
        </div>

        <form onSubmit={salva} className="overflow-y-auto p-4 sm:p-6 space-y-4 sm:space-y-5">

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Nome turno (opzionale)</label>
            <input type="text" value={turnoNome} onChange={e => setTurnoNome(e.target.value)} placeholder="es. Turno mattina"
              className="w-full h-10 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none" />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Giorni</label>
            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {GIORNI.map(g => (
                <button type="button" key={g} onClick={() => toggleGiorno(g)}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all ${
                    giorniSelezionati.includes(g)
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  }`}>
                  {g.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Orario principale</label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <p className="text-[10px] sm:text-xs text-zinc-500 mb-1">Entrata</p>
                <input type="time" value={ingresso1} onChange={e => setIngresso1(e.target.value)}
                  className="w-full h-10 sm:h-11 px-3 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-zinc-500 mb-1">Uscita</p>
                <input type="time" value={uscita1} onChange={e => setUscita1(e.target.value)}
                  className="w-full h-10 sm:h-11 px-3 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">Orario pomeriggio (opzionale)</label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div>
                <p className="text-[10px] sm:text-xs text-zinc-500 mb-1">Entrata</p>
                <input type="time" value={ingresso2} onChange={e => setIngresso2(e.target.value)}
                  className="w-full h-10 sm:h-11 px-3 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none" />
              </div>
              <div>
                <p className="text-[10px] sm:text-xs text-zinc-500 mb-1">Uscita</p>
                <input type="time" value={uscita2} onChange={e => setUscita2(e.target.value)}
                  className="w-full h-10 sm:h-11 px-3 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm outline-none" />
              </div>
            </div>
          </div>

          {toast && (
            <div className={`rounded-xl p-3 text-xs sm:text-sm font-medium ${toast.type === "ok" ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
              {toast.msg}
            </div>
          )}

          <div className="pb-1">
            <button type="submit" disabled={saving || giorniSelezionati.length === 0}
              className="w-full h-11 sm:h-12 rounded-xl sm:rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-semibold disabled:opacity-40 transition-all">
              {saving ? "Salvataggio..." : `Assegna a ${n} dipendent${n === 1 ? "e" : "i"}`}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

/*
────────────────────────────────────
PAGINA DIPENDENTI
────────────────────────────────────
*/

export default function Employees() {

  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [apiErrorDetail, setApiErrorDetail] = useState('');
  const [showExport, setShowExport]                 = useState(false);
  const [selectionMode, setSelectionMode]           = useState(false);
  const [selectedEmployeeIds, setSelectedEmpIds]    = useState([]);
  const [showAssignShift, setShowAssignShift]       = useState(false);
  const [deleteConfirm, setDeleteConfirm]           = useState(false);
  const [deleteLoading, setDeleteLoading]           = useState(false);
  const [toast, setToast]                           = useState(null);
  const token = localStorage.getItem("token");
  const canManageEmployees = hasPermission("can_manage_employees");
  const canViewPresenze    = hasPermission("can_view_presenze");
  const canSelect          = hasAnyPermission(["can_manage_employees", "can_view_presenze"]);

  function showToast(msg, type = 'success') {
    setToast({ message: msg, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function deleteSelectedEmployees() {
    setDeleteLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/employees/batch`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ids: selectedEmployeeIds }),
      });
      const data = await res.json();
      if (data.success) {
        showToast(`${selectedEmployeeIds.length} dipendente${selectedEmployeeIds.length > 1 ? 'i' : ''} eliminat${selectedEmployeeIds.length > 1 ? 'i' : 'o'}`);
        exitSelectionMode();
        loadEmployees();
      } else {
        showToast('Errore durante l\'eliminazione', 'error');
      }
    } catch {
      showToast('Errore di connessione', 'error');
    } finally {
      setDeleteLoading(false);
      setDeleteConfirm(false);
    }
  }

  function toggleEmployeeSelect(id) {
    setSelectedEmpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedEmpIds([]);
  }

  function toggleSelectAll() {
    setSelectedEmpIds(prev => prev.length === employees.length ? [] : employees.map(e => e.id));
  }

  const { pulling, refreshing, distance } = usePullToRefresh(loadEmployees)

  useEffect(() => {
    loadEmployees();
    const interval = setInterval(loadEmployees, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadEmployees() {
    try {
      const data = await apiFetch('/api/employees');
      if (data.success) {
        setEmployees(data.employees || []);
        setApiError(false);
        setApiErrorDetail('');
      } else {
        setApiError(true);
        const detail = data.detail || data.error || 'Errore sconosciuto';
        setApiErrorDetail(detail);
      }
    } catch (err) {
      setApiError(true);
      setApiErrorDetail(err?.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">

      {showExport && (
        <ExportModal employees={employees} onClose={() => setShowExport(false)} token={token} initialIds={selectedEmployeeIds} />
      )}

      {showAssignShift && (
        <AssignShiftModal
          selectedEmployees={employees.filter(e => selectedEmployeeIds.includes(e.id))}
          onClose={() => { setShowAssignShift(false); exitSelectionMode(); }}
          token={token}
        />
      )}

      {/* DIALOG CONFERMA ELIMINAZIONE */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-zinc-200 dark:border-zinc-700 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-red-100 dark:bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <Trash2 size={18} className="text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Elimina dipendenti</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Operazione non reversibile</p>
              </div>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-300 mb-6 leading-relaxed">
              Stai per eliminare <strong>{selectedEmployeeIds.length} dipendente{selectedEmployeeIds.length > 1 ? 'i' : ''}</strong>.
              Verranno rimossi anche badge, presenze, turni, ferie e account di accesso associati.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(false)}
                disabled={deleteLoading}
                className="flex-1 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium disabled:opacity-50"
              >
                Annulla
              </button>
              <button
                onClick={deleteSelectedEmployees}
                disabled={deleteLoading}
                className="flex-1 h-11 rounded-2xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {deleteLoading
                  ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Eliminando…</>
                  : <><Trash2 size={15} />Elimina</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST */}
      {toast && (
        <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium whitespace-nowrap ${
          toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          {toast.message}
        </div>
      )}

        <PullIndicator pulling={pulling} refreshing={refreshing} distance={distance} />

        <div className="flex items-center justify-between gap-3 mb-6 sm:mb-8">
          {canSelect && (
            <button
              onClick={() => { setSelectionMode(prev => !prev); setSelectedEmpIds([]); }}
              className={`flex items-center gap-2 h-12 sm:h-14 px-5 sm:px-6 rounded-2xl sm:rounded-3xl border text-sm sm:text-base font-medium shadow-sm hover:shadow-md active:scale-[0.97] transition-all ${
                selectionMode
                  ? "bg-zinc-100 dark:bg-zinc-800 border-indigo-400 dark:border-indigo-500 text-zinc-900 dark:text-zinc-100"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100"
              }`}
            >
              <CheckSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
              <span>Seleziona</span>
            </button>
          )}
          {canManageEmployees && (
            <button
              onClick={() => navigate("/badges")}
              className="flex items-center gap-2 h-12 sm:h-14 px-5 sm:px-6 rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 text-sm sm:text-base font-medium shadow-sm hover:shadow-md active:scale-[0.97] transition-all"
            >
              <UserPlus size={20} className="sm:w-[22px] sm:h-[22px]" />
              <span>Aggiungi</span>
            </button>
          )}
        </div>

        {selectionMode && (
          <div className="mb-4 sm:mb-6 flex flex-wrap items-center justify-between gap-3 p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-white/70 dark:bg-[#161618]/70 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-2 h-9 sm:h-10 px-3 sm:px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 text-xs sm:text-sm font-medium"
            >
              {selectedEmployeeIds.length === employees.length && employees.length > 0
                ? <><CheckSquare size={16} className="text-indigo-500" /> Deseleziona tutti</>
                : <><Square size={16} /> Seleziona tutti</>}
            </button>
            <div className="flex flex-wrap items-center justify-end gap-2 w-full sm:w-auto">
              <span className="hidden sm:inline text-sm font-medium text-zinc-500 dark:text-zinc-400">
                {selectedEmployeeIds.length} selezionat{selectedEmployeeIds.length === 1 ? "o" : "i"}
              </span>
              {canViewPresenze && (
                <button
                  onClick={() => setShowExport(true)}
                  disabled={selectedEmployeeIds.length === 0}
                  className="flex items-center gap-1.5 h-9 sm:h-10 px-3 sm:px-4 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-xs sm:text-sm font-semibold disabled:opacity-40 transition-all"
                >
                  <Download size={15} /> Esporta
                </button>
              )}
              {canManageEmployees && (
                <button
                  onClick={() => setShowAssignShift(true)}
                  disabled={selectedEmployeeIds.length === 0}
                  className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 text-xs sm:text-sm font-semibold disabled:opacity-40 transition-all"
                >
                  Assegna turno
                </button>
              )}
              {canManageEmployees && (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  disabled={selectedEmployeeIds.length === 0}
                  className="flex items-center gap-1.5 h-9 sm:h-10 px-3 sm:px-4 rounded-xl bg-red-500 text-white text-xs sm:text-sm font-semibold disabled:opacity-40 hover:bg-red-600 transition-all"
                >
                  <Trash2 size={15} /> Elimina
                </button>
              )}
              <button onClick={exitSelectionMode} className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <X size={16} className="text-zinc-500 dark:text-zinc-400" />
              </button>
            </div>
          </div>
        )}

        <div className="mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Dipendenti</h2>
          <p className="text-sm sm:text-base text-zinc-500 mt-1 sm:mt-2">Statistiche presenze realtime</p>
        </div>

        {loading && (
          <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-8 sm:p-10 text-center">
            <p className="text-sm sm:text-base text-zinc-500">Caricamento dipendenti...</p>
          </div>
        )}

        {!loading && apiError && apiErrorDetail === 'FORBIDDEN' && (
          <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-8 sm:p-10 text-center">
            <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Accesso non consentito</h3>
            <p className="text-sm sm:text-base text-zinc-500">Non hai i permessi per visualizzare i dipendenti.</p>
          </div>
        )}

        {!loading && apiError && apiErrorDetail !== 'FORBIDDEN' && (
          <div className="rounded-2xl sm:rounded-3xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-8 sm:p-10 text-center">
            <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Errore nel caricamento</h3>
            <p className="text-sm sm:text-base text-zinc-500 mb-1">Impossibile caricare i dipendenti.</p>
            {apiErrorDetail && <p className="text-xs text-zinc-400 mb-4 font-mono">{apiErrorDetail}</p>}
            <button
              onClick={loadEmployees}
              className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium"
            >
              Riprova
            </button>
          </div>
        )}

        {!loading && !apiError && employees.length === 0 && (
          <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-8 sm:p-10 text-center">
            <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Nessun dipendente</h3>
            <p className="text-sm sm:text-base text-zinc-500">Nessun badge registrato</p>
          </div>
        )}

        {!loading && !apiError && employees.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {employees.map((emp) => {
              const isSelected = selectedEmployeeIds.includes(emp.id);
              const stato = emp.attivo
                ? { dot: "bg-green-500", label: "Presente",     color: "text-green-600 dark:text-green-400" }
                : emp.assente
                ? { dot: "bg-red-500",   label: "Assente",      color: "text-red-600 dark:text-red-400" }
                : emp.in_pausa
                ? { dot: "bg-amber-500", label: "In pausa",     color: "text-amber-600 dark:text-amber-400" }
                : { dot: "bg-zinc-400",  label: "Fuori orario", color: "text-zinc-500" };
              return (
                <div
                  key={emp.id}
                  onClick={() => selectionMode ? toggleEmployeeSelect(emp.id) : navigate("/employees/" + emp.id)}
                  className={`rounded-2xl sm:rounded-3xl border bg-white dark:bg-[#161618] p-4 sm:p-6 cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all ${
                    selectionMode && isSelected
                      ? "border-indigo-500 ring-2 ring-indigo-500/30"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {emp.nome} {emp.cognome}
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-500 mt-0.5 truncate">{emp.email || "Nessuna email"}</p>
                    </div>
                    {selectionMode
                      ? (isSelected
                          ? <CheckSquare size={20} className="sm:w-6 sm:h-6 text-indigo-500 mt-0.5 flex-shrink-0" />
                          : <Square size={20} className="sm:w-6 sm:h-6 text-zinc-400 mt-0.5 flex-shrink-0" />)
                      : <span className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mt-1.5 flex-shrink-0 ${stato.dot}`} />
                    }
                  </div>

                  <div className="flex items-end justify-between gap-2 mt-4 sm:mt-5">
                    <div className="min-w-0">
                      <p className="text-[10px] sm:text-xs text-zinc-400">Ore questo mese</p>
                      <p className="text-lg sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">{formatOre(emp.stats?.total_hours || 0)}</p>
                    </div>
                    {!selectionMode && (
                      <span className={`text-xs sm:text-sm font-medium ${stato.color}`}>{stato.label}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
  );
}
