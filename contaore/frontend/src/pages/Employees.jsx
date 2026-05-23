import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, CreditCard,
  Radio, Sun, Moon, Download, X,
  CheckSquare, Square, FileText, Table2
} from "lucide-react";
import { API_URL } from "../api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

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

function getMonthsFromHistory(historyMonths = []) {
  return historyMonths.map(m => m.mese);
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
  const [step, setStep] = useState("config"); // config | exporting

  // Carica mesi disponibili da tutti i dipendenti
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
      const sorted = [...monthSet].sort((a, b) => {
        // ordina per data decrescente
        const parse = s => {
          const months = ["gennaio","febbraio","marzo","aprile","maggio","giugno",
            "luglio","agosto","settembre","ottobre","novembre","dicembre"];
          const parts = s.split(" ");
          return new Date(parseInt(parts[1]), months.indexOf(parts[0].toLowerCase()));
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
    if (selectedIds.length === employees.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map(e => e.id));
    }
  }

  async function fetchEmployeeData(id) {
    const res = await fetch(`${API_URL}/api/employees/${id}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    return data.success ? data.employee : null;
  }

  async function buildExportData() {
    const result = [];
    for (const id of selectedIds) {
      const emp = await fetchEmployeeData(id);
      if (!emp) continue;

      let months = emp.history_months || [];
      if (selectedMonth !== "tutti") {
        months = months.filter(m => m.mese === selectedMonth);
      }

      result.push({ emp, months });
    }
    return result;
  }

  async function exportPDF() {
    setLoading(true);
    setStep("exporting");
    try {
      const data = await buildExportData();
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const periodoLabel = selectedMonth === "tutti" ? "Tutto lo storico" : selectedMonth;

      let isFirst = true;

      for (const { emp, months } of data) {

        if (!isFirst) doc.addPage();
        isFirst = false;

        // ── Intestazione dipendente ──
        doc.setFillColor(17, 24, 39);
        doc.rect(0, 0, 210, 28, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.text(`${emp.nome} ${emp.cognome || ""}`, 14, 13);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text(`Periodo: ${periodoLabel}`, 14, 21);
        doc.text(`Esportato il: ${new Date().toLocaleDateString("it-IT")}`, 150, 21);

        // ── Riepilogo totali ──
        let totalOre = 0;
        let totalAssenze = 0;
        let totalStraord = 0;

        months.forEach(m => {
          totalOre     += m.ore_totali || 0;
          totalAssenze += m.giorni_assenti || 0;
          totalStraord += m.ore_straordinario || 0;
        });

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text("Riepilogo generale", 14, 36);

        autoTable(doc, {
          startY: 40,
          head: [["Ore totali", "Giorni assenti", "Straordinari"]],
          body: [[
            formatOre(totalOre),
            `${totalAssenze} gg`,
            formatOre(totalStraord)
          ]],
          styles: { fontSize: 10, cellPadding: 4 },
          headStyles: { fillColor: [55, 65, 81], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [249, 250, 251] },
          margin: { left: 14, right: 14 }
        });

        // ── Dettaglio mensile ──
        for (const month of months) {

          const prevY = doc.lastAutoTable.finalY + 8;

          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(30, 30, 30);
          doc.text(`${month.mese.charAt(0).toUpperCase() + month.mese.slice(1)}`, 14, prevY);

          // riepilogo mese
          const meseInfo = [
            `Ore lavorate: ${formatOre(month.ore_totali)}`,
            `Previste: ${formatOre(month.ore_previste)}`,
            `Straordinari: ${formatOre(month.ore_straordinario)}`,
            `Assenze: ${month.giorni_assenti} gg`
          ].join("   •   ");

          doc.setFont("helvetica", "normal");
          doc.setFontSize(8);
          doc.setTextColor(100, 100, 100);
          doc.text(meseInfo, 14, prevY + 5);

          // tabella giorni
          const rows = month.giorni.map(day => {
            const data = new Date(day.giorno + "T00:00:00").toLocaleDateString("it-IT", {
              weekday: "short", day: "2-digit", month: "short"
            });
            if (day.assente) {
              return [data, "—", "—", "—", "Assente"];
            }
            const coppie = day.coppie || [];
            const entrate  = coppie.map(c => c.entrata || "—").join("\n");
            const uscite   = coppie.map(c => c.uscita  || "—").join("\n");
            const stato    = day.stato === "straordinario"
              ? `+${formatOre(day.ore_straordinario)}`
              : "Presente";
            return [data, entrate, uscite, formatOre(day.ore_totali), stato];
          });

          autoTable(doc, {
            startY: prevY + 8,
            head: [["Data", "Entrata", "Uscita", "Ore", "Stato"]],
            body: rows,
            styles: { fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: [79, 70, 229], textColor: 255, fontStyle: "bold" },
            alternateRowStyles: { fillColor: [245, 245, 255] },
            columnStyles: {
              0: { cellWidth: 35 },
              1: { cellWidth: 28 },
              2: { cellWidth: 28 },
              3: { cellWidth: 28 },
              4: { cellWidth: 40 }
            },
            didParseCell: (data) => {
              if (data.row.raw && data.row.raw[4] === "Assente") {
                data.cell.styles.textColor = [220, 38, 38];
              }
              if (data.row.raw && data.row.raw[4]?.startsWith("+")) {
                data.cell.styles.textColor = [217, 119, 6];
              }
            },
            margin: { left: 14, right: 14 }
          });

        }

      }

      const filename = selectedMonth === "tutti"
        ? `ContaOre_${new Date().toLocaleDateString("it-IT").replace(/\//g, "-")}.pdf`
        : `ContaOre_${selectedMonth.replace(/\s/g, "_")}.pdf`;

      doc.save(filename);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setStep("config");
    }
  }

  async function exportExcel() {
    setLoading(true);
    setStep("exporting");
    try {
      const data = await buildExportData();
      const wb = XLSX.utils.book_new();
      const periodoLabel = selectedMonth === "tutti" ? "Tutto" : selectedMonth;

      // Sheet riepilogo
      const riepilogoRows = [
        ["Nome", "Cognome", "Ore totali", "Giorni assenti", "Straordinari"]
      ];

      for (const { emp, months } of data) {
        let ore = 0, assenze = 0, straord = 0;
        months.forEach(m => {
          ore     += m.ore_totali || 0;
          assenze += m.giorni_assenti || 0;
          straord += m.ore_straordinario || 0;
        });
        riepilogoRows.push([
          emp.nome, emp.cognome || "",
          formatOre(ore), `${assenze} gg`, formatOre(straord)
        ]);
      }

      const wsRiepilogo = XLSX.utils.aoa_to_sheet(riepilogoRows);
      wsRiepilogo["!cols"] = [20,20,15,15,15].map(w => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, wsRiepilogo, "Riepilogo");

      // Sheet per ogni dipendente
      for (const { emp, months } of data) {
        const rows = [
          [`${emp.nome} ${emp.cognome || ""}`, "", "", "", ""],
          [`Periodo: ${periodoLabel}`, "", "", "", ""],
          [""],
          ["Data", "Entrata", "Uscita", "Ore lavorate", "Stato"]
        ];

        for (const month of months) {
          rows.push([month.mese.toUpperCase(), "", "", "", ""]);
          for (const day of month.giorni) {
            const dataStr = new Date(day.giorno + "T00:00:00").toLocaleDateString("it-IT");
            if (day.assente) {
              rows.push([dataStr, "—", "—", "0h", "Assente"]);
            } else {
              const coppie = day.coppie || [];
              const entrate = coppie.length > 0
                ? coppie.map(c => c.entrata || "—").join("  ")
                : "—";
              const uscite = coppie.length > 0
                ? coppie.map(c => c.uscita || "—").join("  ")
                : "—";
              const stato = day.stato === "straordinario"
                ? `+${formatOre(day.ore_straordinario)}`
                : "Presente";
              rows.push([dataStr, entrate, uscite, formatOre(day.ore_totali), stato]);
            }
          }
          // totale mese
          rows.push([
            `Totale ${month.mese}`,
            "", "",
            formatOre(month.ore_totali),
            `Assenze: ${month.giorni_assenti} | Straord: ${formatOre(month.ore_straordinario)}`
          ]);
          rows.push([""]);
        }

        const sheetName = `${emp.nome} ${emp.cognome || ""}`.substring(0, 31);
        const ws = XLSX.utils.aoa_to_sheet(rows);
        ws["!cols"] = [16, 10, 10, 14, 22].map(w => ({ wch: w }));
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      const filename = `ContaOre_${periodoLabel.replace(/\s/g, "_")}.xlsx`;
      XLSX.writeFile(wb, filename);

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setStep("config");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Esporta presenze</h2>
            <p className="text-sm text-zinc-500 mt-0.5">Seleziona periodo e dipendenti</p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center"
          >
            <X size={16} className="text-zinc-500" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 space-y-6">

          {/* Periodo */}
          <div>
            <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Periodo</p>
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              className="w-full h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm outline-none"
            >
              <option value="tutti">Tutto lo storico</option>
              {availableMonths.map(m => (
                <option key={m} value={m}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Dipendenti */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Dipendenti</p>
              <button
                onClick={toggleAll}
                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
              >
                {selectedIds.length === employees.length ? "Deseleziona tutti" : "Seleziona tutti"}
              </button>
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => toggleEmployee(emp.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left"
                >
                  {selectedIds.includes(emp.id)
                    ? <CheckSquare size={18} className="text-indigo-500 shrink-0" />
                    : <Square size={18} className="text-zinc-400 shrink-0" />
                  }
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {emp.nome} {emp.cognome}
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Footer bottoni */}
        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 shrink-0 space-y-3">

          {loading && (
            <p className="text-center text-sm text-zinc-500 mb-2">
              Generazione in corso...
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">

            <button
              onClick={exportPDF}
              disabled={loading || selectedIds.length === 0}
              className="
                flex items-center justify-center gap-2
                h-12 rounded-2xl
                bg-red-500 hover:bg-red-600
                text-white text-sm font-semibold
                disabled:opacity-40 transition-all
              "
            >
              <FileText size={16} />
              Esporta PDF
            </button>

            <button
              onClick={exportExcel}
              disabled={loading || selectedIds.length === 0}
              className="
                flex items-center justify-center gap-2
                h-12 rounded-2xl
                bg-green-600 hover:bg-green-700
                text-white text-sm font-semibold
                disabled:opacity-40 transition-all
              "
            >
              <Table2 size={16} />
              Esporta Excel
            </button>

          </div>

          <p className="text-xs text-center text-zinc-400">
            {selectedIds.length} dipendent{selectedIds.length === 1 ? "e" : "i"} selezionat{selectedIds.length === 1 ? "o" : "i"}
          </p>

        </div>

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

  const [dark, setDark] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);

  const token = localStorage.getItem("token");

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  useEffect(() => {
    loadEmployees();
    const interval = setInterval(loadEmployees, 5000);
    return () => clearInterval(interval);
  }, []);

  async function loadEmployees() {
    try {
      const response = await fetch(`${API_URL}/api/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      if (data.success) setEmployees(data.employees || []);
    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] transition-colors duration-300">

      {showExport && (
        <ExportModal
          employees={employees}
          onClose={() => setShowExport(false)}
          token={token}
        />
      )}

      <header className="sticky top-0 z-40 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-[#111113]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">ContaOre</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Gestione dipendenti</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowExport(true)}
              className="
                flex items-center gap-2
                h-11 px-4 rounded-2xl
                border border-zinc-200 dark:border-zinc-700
                bg-white dark:bg-zinc-900
                text-sm font-medium text-zinc-700 dark:text-zinc-300
              "
            >
              <Download size={15} />
              Esporta
            </button>
            <button
              onClick={() => setDark(prev => !prev)}
              className="w-11 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center"
            >
              {dark
                ? <Sun size={18} className="text-zinc-200" />
                : <Moon size={18} className="text-zinc-700" />
              }
            </button>
            <button
              onClick={logout}
              className="h-11 px-5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">

        <div className="flex gap-3 mb-8 overflow-x-auto">
          {[
            { title: "Dashboard",   icon: LayoutDashboard, path: "/dashboard" },
            { title: "Dipendenti",  icon: Users,           path: "/employees" },
            { title: "Badge",       icon: CreditCard,      path: "/badges"    },
            { title: "Lettori NFC", icon: Radio,           path: "/readers"   }
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                to={item.path}
                key={item.title}
                className="
                  flex items-center gap-2
                  px-5 py-3 rounded-2xl
                  border text-sm font-medium
                  whitespace-nowrap
                  bg-white dark:bg-zinc-900
                  text-zinc-700 dark:text-zinc-300
                  border-zinc-200 dark:border-zinc-800
                "
              >
                <Icon size={16} />
                {item.title}
              </Link>
            );
          })}
        </div>

        <div className="mb-8">
          <h2 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Dipendenti</h2>
          <p className="text-zinc-500 mt-2">Statistiche presenze realtime</p>
        </div>

        {loading && (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-10 text-center">
            <p className="text-zinc-500">Caricamento dipendenti...</p>
          </div>
        )}

        {!loading && employees.length === 0 && (
          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-10 text-center">
            <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Nessun dipendente</h3>
            <p className="text-zinc-500">Nessun badge registrato</p>
          </div>
        )}

        {!loading && employees.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {employees.map((emp) => (
              <div
                key={emp.id}
                onClick={() => navigate("/employees/" + emp.id)}
                className="
                  rounded-3xl
                  border border-zinc-200 dark:border-zinc-800
                  bg-white dark:bg-[#161618]
                  p-6 cursor-pointer
                  hover:scale-[1.02] transition-all
                "
              >
                <div className="flex items-start justify-between mb-5">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {emp.nome} {emp.cognome}
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      {emp.badge_uid || "Nessun badge"}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full mt-2 ${emp.attivo ? "bg-green-500" : "bg-zinc-400"}`} />
                </div>

                <div className="space-y-3">
                  <Info label="Letture oggi"    value={emp.stats?.today_reads || 0} />
                  <Info label="Letture mese"    value={emp.stats?.month_reads || 0} />
                  <Info label="Ore totali"      value={formatOre(emp.stats?.total_hours || 0)} />
                  <Info
                    label="Ultima presenza"
                    value={
                      emp.stats?.last_read
                        ? new Date(emp.stats.last_read).toLocaleString("it-IT")
                        : "Mai"
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        )}

      </div>

    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-zinc-500">{label}</span>
      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}
