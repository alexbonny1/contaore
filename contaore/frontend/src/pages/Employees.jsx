import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard,
  Radio, Sun, Moon, Download, X,
  CheckSquare, Square, FileText, Table2, Calendar, Bell, Settings
} from "lucide-react";
import { API_URL } from "../api";
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
EXPORT PDF via HTML + window.print()
────────────────────────────────────
*/

function buildPrintHTML(exportData, periodoLabel) {
  const rows = exportData.map(({ emp, months }) => {
    let totalOre = 0, totalAssenze = 0, totalStraord = 0;
    months.forEach(m => {
      totalOre     += m.ore_totali || 0;
      totalAssenze += m.giorni_assenti || 0;
      totalStraord += m.ore_straordinario || 0;
    });

    const monthsHTML = months.map(month => {
      const giorniHTML = month.giorni.map(day => {
        const dataStr = new Date(day.giorno + "T00:00:00").toLocaleDateString("it-IT", {
          weekday: "short", day: "2-digit", month: "short"
        });
        if (day.assente) {
          return `<tr class="assente">
            <td>${dataStr}</td>
            <td>—</td><td>—</td><td>—</td>
            <td><span class="badge red">Assente</span></td>
          </tr>`;
        }
        const coppie = day.coppie || [];
        const entrate = coppie.map(c => c.entrata || "—").join("<br>");
        const uscite  = coppie.map(c => c.uscita  || "—").join("<br>");
        const statoHTML = day.stato === "straordinario"
          ? `<span class="badge orange">+${formatOre(day.ore_straordinario)}</span>`
          : `<span class="badge green">Presente</span>`;
        return `<tr>
          <td>${dataStr}</td>
          <td>${entrate}</td>
          <td>${uscite}</td>
          <td>${formatOre(day.ore_totali)}</td>
          <td>${statoHTML}</td>
        </tr>`;
      }).join("");

      return `
        <div class="month-section">
          <div class="month-header">
            <span class="month-name">${month.mese.charAt(0).toUpperCase() + month.mese.slice(1)}</span>
            <span class="month-stats">
              Ore: ${formatOre(month.ore_totali)} &nbsp;|&nbsp;
              Previste: ${formatOre(month.ore_previste)} &nbsp;|&nbsp;
              Straord: ${formatOre(month.ore_straordinario)} &nbsp;|&nbsp;
              Assenze: ${month.giorni_assenti} gg
            </span>
          </div>
          <table>
            <thead>
              <tr>
                <th>Data</th><th>Entrata</th><th>Uscita</th>
                <th>Ore</th><th>Stato</th>
              </tr>
            </thead>
            <tbody>${giorniHTML}</tbody>
          </table>
        </div>`;
    }).join("");

    return `
      <div class="employee-page">
        <div class="emp-header">
          <div class="emp-name">${emp.nome} ${emp.cognome || ""}</div>
          <div class="emp-meta">Periodo: ${periodoLabel} &nbsp;•&nbsp; Esportato il: ${new Date().toLocaleDateString("it-IT")}</div>
        </div>
        <div class="summary">
          <div class="summary-item">
            <div class="summary-label">Ore totali</div>
            <div class="summary-value">${formatOre(totalOre)}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Giorni assenti</div>
            <div class="summary-value red">${totalAssenze}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Straordinari</div>
            <div class="summary-value orange">${formatOre(totalStraord)}</div>
          </div>
        </div>
        ${monthsHTML}
      </div>`;
  }).join('<div class="page-break"></div>');

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="UTF-8">
<title>Timbry — ${periodoLabel}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #111; background: white; }

  .employee-page { padding: 20px 24px; }

  .emp-header { background: #111827; color: white; padding: 16px 20px; border-radius: 8px; margin-bottom: 16px; }
  .emp-name { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
  .emp-meta { font-size: 10px; color: #9ca3af; }

  .summary { display: flex; gap: 12px; margin-bottom: 20px; }
  .summary-item { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; }
  .summary-label { font-size: 10px; color: #6b7280; margin-bottom: 4px; }
  .summary-value { font-size: 18px; font-weight: 700; color: #111; }
  .summary-value.red { color: #dc2626; }
  .summary-value.orange { color: #d97706; }

  .month-section { margin-bottom: 20px; }
  .month-header { display: flex; align-items: baseline; gap: 12px; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 2px solid #e5e7eb; }
  .month-name { font-size: 13px; font-weight: 700; color: #111; }
  .month-stats { font-size: 9px; color: #6b7280; }

  table { width: 100%; border-collapse: collapse; }
  thead tr { background: #4f46e5; color: white; }
  th { padding: 6px 10px; text-align: left; font-size: 10px; font-weight: 600; }
  td { padding: 5px 10px; border-bottom: 1px solid #f3f4f6; font-size: 10px; vertical-align: top; }
  tr:nth-child(even) td { background: #f9fafb; }
  tr.assente td { color: #9ca3af; }

  .badge { display: inline-block; padding: 2px 7px; border-radius: 99px; font-size: 9px; font-weight: 600; }
  .badge.green  { background: #dcfce7; color: #15803d; }
  .badge.red    { background: #fee2e2; color: #dc2626; }
  .badge.orange { background: #fef3c7; color: #d97706; }

  .page-break { page-break-after: always; }

  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page-break { page-break-after: always; }
    .employee-page { padding: 16px 20px; }
  }
</style>
</head>
<body>
${rows}
<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`;
}

/*
────────────────────────────────────
MODALE EXPORT
────────────────────────────────────
*/

function ExportModal({ employees, onClose, token }) {

  const [selectedIds, setSelectedIds] = useState(employees.map(e => e.id));
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
      const a = document.createElement("a");
      a.href = url;
      a.download = `Timbry_${selectedMonth === "tutti" ? "storico" : selectedMonth.replace(/\s/g, "_")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
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
      console.error(err);
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
  const location = useLocation();
  const [dark, setDark] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport]                 = useState(false);
  const [pendingCount, setPendingCount]             = useState(0);
  const [selectionMode, setSelectionMode]           = useState(false);
  const [selectedEmployeeIds, setSelectedEmpIds]    = useState([]);
  const [showAssignShift, setShowAssignShift]       = useState(false);
  const token = localStorage.getItem("token");

  function toggleEmployeeSelect(id) {
    setSelectedEmpIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedEmpIds([]);
  }

  const user          = JSON.parse(localStorage.getItem("user") || "{}");
  const [portaleAttivo, setPortaleAttivo] = useState(user.portale_dipendenti !== false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") { setDark(true); document.documentElement.classList.add("dark"); }
  }, []);

  useEffect(() => {
    if (dark) { document.documentElement.classList.add("dark"); localStorage.setItem("theme", "dark"); }
    else { document.documentElement.classList.remove("dark"); localStorage.setItem("theme", "light"); }
  }, [dark]);

  const { pulling, refreshing, distance } = usePullToRefresh(loadEmployees)

  useEffect(() => {
    loadEmployees();
    const interval = setInterval(loadEmployees, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetch(`${API_URL}/api/requests/dashboard`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setPendingCount(d.counts?.totali_in_attesa ?? 0); })
      .catch(() => {});
    fetch(`${API_URL}/api/company/info`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { if (d.success) setPortaleAttivo(!!d.portale_dipendenti); })
      .catch(() => {});
  }, []);

  async function loadEmployees() {
    try {
      const response = await fetch(`${API_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) setEmployees(data.employees || []);
    } catch (err) { console.log(err); }
    finally { setLoading(false); }
  }

  function logout() { localStorage.removeItem("token"); localStorage.removeItem("user"); navigate("/"); }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">

      {showExport && (
        <ExportModal employees={employees} onClose={() => setShowExport(false)} token={token} />
      )}

      {showAssignShift && (
        <AssignShiftModal
          selectedEmployees={employees.filter(e => selectedEmployeeIds.includes(e.id))}
          onClose={() => { setShowAssignShift(false); exitSelectionMode(); }}
          token={token}
        />
      )}

      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100">Timbry</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">Gestione dipendenti</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-1.5 sm:gap-2 h-9 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs sm:text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              <Download size={14} className="sm:w-[15px] sm:h-[15px]" />
              <span className="hidden xs:inline">Esporta</span>
            </button>
            <button
              onClick={() => { setSelectionMode(prev => !prev); setSelectedEmpIds([]); }}
              className={`flex items-center gap-1.5 sm:gap-2 h-9 sm:h-11 px-3 sm:px-4 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium transition-all ${
                selectionMode
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
                  : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300"
              }`}
            >
              <CheckSquare size={14} className="sm:w-[15px] sm:h-[15px]" />
              <span className="hidden xs:inline">Seleziona</span>
            </button>
            <button
              onClick={() => setDark(prev => !prev)}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center"
            >
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

        <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { title: "Dashboard",       icon: LayoutDashboard, path: "/dashboard" },
            { title: "Richieste",       icon: FileText,        path: "/requests",  notifica: pendingCount, nascondiSeSenzaPortale: true },
            { title: "Pausa aziendale", icon: Calendar,        path: "/pause"     },
            { title: "Dipendenti",      icon: Users,           path: "/employees" },
            { title: "Badge",           icon: CreditCard,      path: "/badges"    },
            { title: "Lettori NFC",     icon: Radio,           path: "/readers"   },
            { title: "Notifiche",       icon: Bell,            path: "/notifications" },
            { title: "Impostazioni",    icon: Settings,        path: "/impostazioni"  }
          ]
            .filter(item => !(item.nascondiSeSenzaPortale && !portaleAttivo))
            .map((item) => {
              const Icon     = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link to={item.path} key={item.title}
                  className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-2 sm:py-3 rounded-xl sm:rounded-2xl border text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                    isActive
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-zinc-900 dark:border-zinc-100"
                      : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-800"
                  }`}>
                  <Icon size={14} className="sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">{item.title}</span>
                  {!isActive && item.notifica > 0 && (
                    <span className="absolute -top-1 -right-1 sm:-top-1.5 sm:-right-1.5 min-w-[16px] h-[16px] sm:min-w-[18px] sm:h-[18px] bg-red-500 text-white text-[9px] sm:text-[10px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {item.notifica > 9 ? "9+" : item.notifica}
                    </span>
                  )}
                </Link>
              );
            })}
        </div>

        {selectionMode && (
          <div className="mb-4 sm:mb-6 flex items-center justify-between gap-3 p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-zinc-900 dark:bg-zinc-100">
            <p className="text-xs sm:text-sm font-medium text-white dark:text-black">
              {selectedEmployeeIds.length === 0 ? "Tocca una scheda per selezionare" : `${selectedEmployeeIds.length} selezionat${selectedEmployeeIds.length === 1 ? "o" : "i"}`}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAssignShift(true)}
                disabled={selectedEmployeeIds.length === 0}
                className="h-8 sm:h-9 px-3 sm:px-4 rounded-xl bg-white text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100 text-xs sm:text-sm font-semibold disabled:opacity-40 transition-all"
              >
                Assegna turno
              </button>
              <button onClick={exitSelectionMode} className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/20 dark:bg-black/20 flex items-center justify-center">
                <X size={14} className="sm:w-4 sm:h-4 text-white dark:text-black" />
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

        {!loading && employees.length === 0 && (
          <div className="rounded-2xl sm:rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-8 sm:p-10 text-center">
            <h3 className="text-lg sm:text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Nessun dipendente</h3>
            <p className="text-sm sm:text-base text-zinc-500">Nessun badge registrato</p>
          </div>
        )}

        {!loading && employees.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
            {employees.map((emp) => {
              const isSelected = selectedEmployeeIds.includes(emp.id);
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
                  <div className="flex items-start justify-between mb-4 sm:mb-5">
                    <div className="min-w-0 flex-1 pr-2">
                      <h3 className="text-base sm:text-lg font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        {emp.nome} {emp.cognome}
                      </h3>
                      <p className="text-xs sm:text-sm text-zinc-500 mt-1 truncate">{emp.badge_uid || "Nessun badge"}</p>
                    </div>
                    {selectionMode
                      ? (isSelected
                          ? <CheckSquare size={20} className="sm:w-6 sm:h-6 text-indigo-500 mt-0.5 flex-shrink-0" />
                          : <Square size={20} className="sm:w-6 sm:h-6 text-zinc-400 mt-0.5 flex-shrink-0" />)
                      : <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full mt-1 sm:mt-2 flex-shrink-0 ${emp.attivo ? "bg-green-500" : "bg-zinc-400"}`} />
                    }
                  </div>
                  <div className="space-y-2 sm:space-y-3">
                    <Info label="Letture oggi"    value={emp.stats?.today_reads || 0} />
                    <Info label="Letture mese"    value={emp.stats?.month_reads || 0} />
                    <Info label="Ore totali"      value={formatOre(emp.stats?.total_hours || 0)} />
                    <Info
                      label="Ultima presenza"
                      value={emp.stats?.last_read ? new Date(emp.stats.last_read).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" }) : "Mai"}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs sm:text-sm text-zinc-500 truncate">{label}</span>
      <span className="text-xs sm:text-sm font-medium text-zinc-900 dark:text-zinc-100 whitespace-nowrap">{value}</span>
    </div>
  );
}
