import {
  useEffect,
  useState,
  useMemo
} from "react";

import {
  useParams,
  useNavigate
} from "react-router-dom";

import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Briefcase,
  ChevronDown,
  ChevronUp,
  CreditCard,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Plus,
  X,
  Pencil
} from "lucide-react";

import { API_URL } from "../api";

function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`
      fixed bottom-6 left-1/2 -translate-x-1/2 z-50
      flex items-center gap-2
      px-5 py-3 rounded-2xl shadow-lg
      text-sm font-medium
      ${type === "success"
        ? "bg-green-500 text-white"
        : "bg-red-500 text-white"
      }
    `}>
      {type === "success"
        ? <CheckCircle2 size={16} />
        : <XCircle size={16} />
      }
      {message}
    </div>
  );
}

function formatOre(decimalHours) {
  if (!decimalHours || decimalHours === 0) return "0m";
  const h = Math.floor(decimalHours);
  const m = Math.round((decimalHours - h) * 60);
  if (h === 0) return m + "m";
  if (m === 0) return h + "h";
  return h + "h " + m + "m";
}

const PIE_COLORS = {
  presente:     "#22c55e",
  straordinario:"#f59e0b",
  ritardo:      "#a855f7",
  parziale:     "#f97316",
  assente:      "#ef4444",
  ferie:        "#3b82f6",
  giustificata: "#6366f1",
};

function SvgDonut({ data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const cx = 60, cy = 60, R = 50, ri = 30, gap = 0.04;
  let a = -Math.PI / 2;
  const slices = data.map(d => {
    const sweep = (d.value / total) * 2 * Math.PI - gap;
    const a0 = a + gap / 2, a1 = a0 + sweep;
    a += (d.value / total) * 2 * Math.PI;
    const lg = sweep > Math.PI ? 1 : 0;
    const path = `M${cx+R*Math.cos(a0)},${cy+R*Math.sin(a0)} A${R},${R},0,${lg},1,${cx+R*Math.cos(a1)},${cy+R*Math.sin(a1)} L${cx+ri*Math.cos(a1)},${cy+ri*Math.sin(a1)} A${ri},${ri},0,${lg},0,${cx+ri*Math.cos(a0)},${cy+ri*Math.sin(a0)}Z`;
    return { ...d, path };
  });
  return (
    <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
      {slices.map(s => <path key={s.name} d={s.path} fill={PIE_COLORS[s.name] ?? "#94a3b8"} />)}
    </svg>
  );
}

function SvgBars({ data, keys, colors }) {
  if (!data.length) return null;
  const W = 240, H = 80, PL = 26, PB = 16, PT = 2, PR = 2;
  const cW = W - PL - PR, cH = H - PB - PT;
  const maxVal = Math.max(...data.flatMap(d => keys.map(k => d[k] ?? 0)), 1);
  const slotW = cW / data.length;
  const bW = Math.max(2, Math.min(10, slotW / keys.length - 1));
  const everyN = Math.max(1, Math.ceil(data.length / 8));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 0.5, 1].map(t => {
        const y = PT + cH * (1 - t);
        return (
          <g key={t}>
            <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="#52525b" strokeWidth={0.5} />
            <text x={PL - 3} y={y + 3} textAnchor="end" fontSize={8} fill="#71717a">{Math.round(maxVal * t)}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const sx = PL + i * slotW;
        return (
          <g key={d.g}>
            {keys.map((k, ki) => {
              const bH = ((d[k] ?? 0) / maxVal) * cH;
              const bx = sx + (slotW - keys.length * (bW + 1)) / 2 + ki * (bW + 1);
              return <rect key={k} x={bx} y={PT + cH - bH} width={bW} height={Math.max(bH, 0)} fill={colors[ki]} rx={1} />;
            })}
            {(i === 0 || i === data.length - 1 || i % everyN === 0) && (
              <text x={sx + slotW / 2} y={H - 2} textAnchor="middle" fontSize={8} fill="#71717a">{d.g}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function ChartPanel({ historyMonths, turniAttivi }) {
  const [selectedMese, setSelectedMese] = useState(historyMonths[0]?.mese ?? "");

  useEffect(() => {
    if (!selectedMese && historyMonths.length > 0) setSelectedMese(historyMonths[0].mese);
  }, [historyMonths]);

  const giorni = useMemo(() =>
    historyMonths.find(m => m.mese === selectedMese)?.giorni ?? [],
  [historyMonths, selectedMese]);

  const pieData = useMemo(() => {
    const counts = {};
    giorni.forEach(d => { const k = d.assente ? "assente" : d.stato; counts[k] = (counts[k] ?? 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [giorni]);

  const barOre = useMemo(() =>
    giorni.map(d => ({
      g: new Date(d.giorno + "T12:00:00").getDate(),
      lav: Number((d.ore_totali ?? 0).toFixed(1)),
      prv: Number((d.ore_previste ?? 0).toFixed(1)),
    })),
  [giorni]);

  const barExtra = useMemo(() =>
    giorni
      .filter(d => (d.ritardo_minuti ?? 0) > 0 || (d.ore_straordinario ?? 0) > 0)
      .map(d => ({
        g: new Date(d.giorno + "T12:00:00").getDate(),
        rit: d.ritardo_minuti ?? 0,
        str: Number(((d.ore_straordinario ?? 0) * 60).toFixed(0)),
      })),
  [giorni]);

  if (!historyMonths.length) return null;

  return (
    <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 space-y-5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Riepilogo</h3>
        <select
          value={selectedMese}
          onChange={e => setSelectedMese(e.target.value)}
          className="text-xs rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-1.5 outline-none focus:border-blue-500"
        >
          {historyMonths.map(m => <option key={m.mese} value={m.mese}>{m.mese}</option>)}
        </select>
      </div>

      {giorni.length === 0 ? (
        <p className="text-xs text-zinc-400 text-center py-4">Nessun dato per questo mese</p>
      ) : (
        <>
          {/* Torta stati */}
          <div>
            <p className="text-xs font-medium text-zinc-500 mb-2">Distribuzione giorni</p>
            <div className="flex items-center gap-3">
              <SvgDonut data={pieData} />
              <div className="flex flex-col gap-1">
                {pieData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[d.name] ?? "#94a3b8" }} />
                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 capitalize">{d.name}</span>
                    <span className="text-[10px] font-medium text-zinc-700 dark:text-zinc-300 ml-auto pl-2">{d.value}g</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Barre ore */}
          {turniAttivi && (
            <div>
              <div className="flex items-center gap-3 mb-1">
                <p className="text-xs font-medium text-zinc-500">Ore lavorate vs previste</p>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="flex items-center gap-1 text-[10px] text-zinc-400"><span className="w-2 h-2 rounded-sm inline-block" style={{background:"#94a3b8"}} />prev.</span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-400"><span className="w-2 h-2 rounded-sm inline-block" style={{background:"#22c55e"}} />lav.</span>
                </div>
              </div>
              <SvgBars data={barOre} keys={["prv", "lav"]} colors={["#94a3b8", "#22c55e"]} />
            </div>
          )}

          {/* Barre ritardi */}
          {turniAttivi && barExtra.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-1">
                <p className="text-xs font-medium text-zinc-500">Ritardi e straordinari (min)</p>
                <div className="flex items-center gap-2 ml-auto">
                  <span className="flex items-center gap-1 text-[10px] text-zinc-400"><span className="w-2 h-2 rounded-sm inline-block" style={{background:"#a855f7"}} />rit.</span>
                  <span className="flex items-center gap-1 text-[10px] text-zinc-400"><span className="w-2 h-2 rounded-sm inline-block" style={{background:"#f59e0b"}} />str.</span>
                </div>
              </div>
              <SvgBars data={barExtra} keys={["rit", "str"]} colors={["#a855f7", "#f59e0b"]} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function EmployeeDetails() {

  const { id } = useParams();
  const navigate = useNavigate();

  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);

  const [turni, setTurni] = useState([]);
  const [turniAttivi, setTurniAttivi] = useState(false);

  const [historyMonths, setHistoryMonths] = useState([]);
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [showStorico, setShowStorico] = useState(false);

  const [waitingBadgeScan, setWaitingBadgeScan] = useState(false);
  const [changingBadge, setChangingBadge] = useState(false);
  const [manualUid, setManualUid] = useState("");
  const [showManualUid, setShowManualUid] = useState(false);
  const [toast, setToast] = useState(null);

  const [portaleAttivo, setPortaleAttivo]       = useState(true); // default true = nascosto finché non carica
  const [showAddPresence, setShowAddPresence]   = useState(false);
  const [addTipo, setAddTipo]                   = useState("ENTRATA");
  const [addDate, setAddDate]                   = useState("");
  const [addTime, setAddTime]                   = useState("09:00");
  const [addPresenceSaving, setAddPresenceSaving] = useState(false);

  const [showEditPresence, setShowEditPresence]     = useState(false);
  const [editPresenceId, setEditPresenceId]         = useState(null);
  const [editPresenceTipo, setEditPresenceTipo]     = useState("ENTRATA");
  const [editPresenceDate, setEditPresenceDate]     = useState("");
  const [editPresenceTime, setEditPresenceTime]     = useState("09:00");
  const [editPresenceSaving, setEditPresenceSaving] = useState(false);

  function showToast(message, type = "success") {
    setToast({ message, type });
  }

  function startAddPresence(dateStr) {
    setAddDate(dateStr || new Date().toISOString().split("T")[0]);
    setAddTipo("ENTRATA");
    setAddTime("09:00");
    setShowAddPresence(true);
  }

  async function addPresence() {
    if (!addDate || !addTime) return;
    setAddPresenceSaving(true);
    try {
      const token    = localStorage.getItem("token");
      const datetime = `${addDate}T${addTime}:00`;
      const res      = await fetch(`${API_URL}/api/employees/${id}/presence`, {
        method:  "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ tipo: addTipo, datetime })
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || "Errore", "error"); return; }
      showToast("Timbratura aggiunta");
      setShowAddPresence(false);
      loadData();
    } catch (err) {
      console.log(err);
      showToast("Errore server", "error");
    } finally {
      setAddPresenceSaving(false);
    }
  }

  function startEditPresence(id, tipo, dateStr, timeStr) {
    setEditPresenceId(id);
    setEditPresenceTipo(tipo);
    setEditPresenceDate(dateStr);
    setEditPresenceTime(timeStr || "09:00");
    setShowEditPresence(true);
  }

  async function saveEditPresence() {
    if (!editPresenceDate || !editPresenceTime) return;
    setEditPresenceSaving(true);
    try {
      const token    = localStorage.getItem("token");
      const datetime = `${editPresenceDate}T${editPresenceTime}:00`;
      const res      = await fetch(`${API_URL}/api/presenze/${editPresenceId}`, {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ tipo: editPresenceTipo, datetime })
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || "Errore", "error"); return; }
      showToast("Timbratura modificata");
      setShowEditPresence(false);
      loadData();
    } catch (err) {
      console.log(err);
      showToast("Errore server", "error");
    } finally {
      setEditPresenceSaving(false);
    }
  }

  async function deletePresence(presenceId) {
    if (!confirm("Eliminare questa timbratura?")) return;
    try {
      const token = localStorage.getItem("token");
      const res   = await fetch(`${API_URL}/api/presenze/${presenceId}`, {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.success) { showToast("Errore eliminazione", "error"); return; }
      showToast("Timbratura eliminata");
      loadData();
    } catch (err) {
      console.log(err);
      showToast("Errore server", "error");
    }
  }

  const [editingShiftId, setEditingShiftId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [turnoNome, setTurnoNome] = useState("");
  const [giorno, setGiorno] = useState("Lunedì");
  const [giorniSelezionati, setGiorniSelezionati] = useState([]); // multi-giorno
  const [ingresso1, setIngresso1] = useState("");
  const [uscita1, setUscita1] = useState("");
  const [ingresso2, setIngresso2] = useState("");
  const [uscita2, setUscita2] = useState("");

  const giorni = [
    "Lunedì","Martedì","Mercoledì",
    "Giovedì","Venerdì","Sabato","Domenica"
  ];

  function toggleGiorno(g) {
    setGiorniSelezionati(prev =>
      prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]
    );
  }

  useEffect(() => { loadData(); }, []);

  useEffect(() => {

    if (!waitingBadgeScan) return;

    const startedAt = new Date().toISOString();

    const interval = setInterval(async () => {
      try {
        const token = localStorage.getItem("token");
        const response = await fetch(
          API_URL + "/api/latest-read?after=" + encodeURIComponent(startedAt),
          { headers: { Authorization: "Bearer " + token } }
        );
        const data = await response.json();
        if (data.success && data.uid) {
          clearInterval(interval);
          setWaitingBadgeScan(false);
          await changeBadge(data.uid);
        }
      } catch (err) { console.log(err); }
    }, 1000);

    return () => clearInterval(interval);

  }, [waitingBadgeScan]);

  async function loadData() {

    try {

      setLoading(true);
      const token = localStorage.getItem("token");

      const [empRes, companyRes] = await Promise.all([
        fetch(API_URL + "/api/employees/" + id, { headers: { Authorization: "Bearer " + token } }),
        fetch(API_URL + "/api/company/info",    { headers: { Authorization: "Bearer " + token } })
      ]);

      const empData     = await empRes.json();
      const companyData = await companyRes.json();

      if (companyData.success) {
        setPortaleAttivo(!!companyData.portale_dipendenti);
      }

      if (empData.success) {
        setEmployee(empData.employee);
        setTurni(empData.employee.shifts || []);
        setTurniAttivi(!!empData.employee.turni_attivi);
        setHistoryMonths(empData.employee.history_months || []);
      }

    } catch (err) {
      console.log(err);
    } finally {
      setLoading(false);
    }

  }

  async function changeBadge(newUid) {

    try {

      setChangingBadge(true);
      const token = localStorage.getItem("token");
      const response = await fetch(
        API_URL + "/api/employees/" + id + "/change-badge",
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({ new_uid: newUid })
        }
      );
      const data = await response.json();

      if (!data.success) {
        showToast(data.error === "UID_ALREADY_USED" ? "Badge già assegnato ad un altro dipendente" : data.error || "Errore cambio badge", "error");
        return;
      }

      setShowManualUid(false);
      setManualUid("");
      showToast("Badge aggiornato");
      loadData();

    } catch (err) {
      console.log(err);
      showToast("Errore server", "error");
    } finally {
      setChangingBadge(false);
    }

  }

  async function salvaTurno(e) {

    e.preventDefault();
    setSaving(true);

    try {

      const token = localStorage.getItem("token");

      // In modalità modifica: singolo giorno come prima
      if (editingShiftId) {
        const url = API_URL + "/api/shifts/" + editingShiftId;
        const response = await fetch(url, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify({
            turno_nome:       turnoNome,
            giorno_settimana: giorno,
            ingresso_1:       ingresso1 || null,
            uscita_1:         uscita1   || null,
            ingresso_2:       ingresso2 || null,
            uscita_2:         uscita2   || null
          })
        });
        const data = await response.json();
        if (!data.success) { showToast("Errore salvataggio turno", "error"); return; }
      } else {
        // In modalità creazione: uno per ogni giorno selezionato
        const giorniDaCreare = giorniSelezionati.length > 0 ? giorniSelezionati : [giorno];
        for (const g of giorniDaCreare) {
          const url = API_URL + "/api/employees/" + id + "/shift";
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({
              turno_nome:       turnoNome,
              giorno_settimana: g,
              ingresso_1:       ingresso1 || null,
              uscita_1:         uscita1   || null,
              ingresso_2:       ingresso2 || null,
              uscita_2:         uscita2   || null
            })
          });
          const data = await response.json();
          if (!data.success) { showToast("Errore salvataggio turno per " + g, "error"); return; }
        }
      }

      resetForm();
      loadData();

    } catch (err) {
      console.log(err);
      showToast("Errore server", "error");
    } finally {
      setSaving(false);
    }

  }

  async function eliminaTurno(shiftId) {

    if (!confirm("Eliminare turno?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        API_URL + "/api/shifts/" + shiftId,
        { method: "DELETE", headers: { Authorization: "Bearer " + token } }
      );
      const data = await response.json();
      if (!data.success) { showToast("Errore eliminazione", "error"); return; }
      loadData();
    } catch (err) {
      console.log(err);
      showToast("Errore server", "error");
    }

  }

  async function toggleTurni() {

    try {
      const value = !turniAttivi;
      setTurniAttivi(value);
      const token = localStorage.getItem("token");
      await fetch(
        API_URL + "/api/employees/" + id + "/toggle-turni",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({ turni_attivi: value })
        }
      );
      loadData();
    } catch (err) { console.log(err); }

  }

  async function eliminaMese(monthName) {

    if (!confirm("Eliminare tutte le presenze di " + monthName + "?")) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        API_URL + "/api/employees/" + id + "/delete-month",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer " + token
          },
          body: JSON.stringify({ month: monthName })
        }
      );
      const data = await response.json();
      if (!data.success) { showToast("Errore eliminazione mese", "error"); return; }
      loadData();
    } catch (err) {
      console.log(err);
      showToast("Errore server", "error");
    }

  }

  function startEditShift(shift) {
    setEditingShiftId(shift.id);
    setTurnoNome(shift.turno_nome || "");
    setGiorno(shift.giorno_settimana);
    setIngresso1(shift.ingresso_1 || "");
    setUscita1(shift.uscita_1 || "");
    setIngresso2(shift.ingresso_2 || "");
    setUscita2(shift.uscita_2 || "");
  }

  function resetForm() {
    setEditingShiftId(null);
    setTurnoNome("");
    setGiorno("Lunedì");
    setGiorniSelezionati([]);
    setIngresso1("");
    setUscita1("");
    setIngresso2("");
    setUscita2("");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] flex items-center justify-center">
        <p className="text-zinc-500">Caricamento...</p>
      </div>
    );
  }

  // Portal active but employee has no email → they can't use the portal anyway
  const canManagePresence = !portaleAttivo || !employee?.email;

  if (!employee) {
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] flex items-center justify-center">
        <p className="text-zinc-500">Dipendente non trovato</p>
      </div>
    );
  }

  return (

    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10]">

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        <div className="flex flex-col xl:flex-row gap-5 xl:items-start">
        <div className="flex-1 min-w-0">

        <button
          onClick={() => navigate("/employees")}
          className="mb-6 flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          <ArrowLeft size={16} />
          Torna ai dipendenti
        </button>

        {/* HEADER */}

        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-5">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div>
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
                {employee.nome} {employee.cognome}
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {employee.email || "Nessuna email"}
              </p>
            </div>

            <div className={`
              px-4 py-2 rounded-2xl text-sm font-semibold w-fit
              ${employee.attivo
                ? "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
              }
            `}>
              {employee.attivo ? "Presente ora" : "Assente"}
            </div>

          </div>

        </div>

        {/* STATS */}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">

          <div
            onClick={() => setShowStorico(true)}
            className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 cursor-pointer hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
          >
            <div className="flex items-center gap-2 mb-2">
              <Clock3 size={15} className="text-zinc-400" />
              <p className="text-xs text-zinc-500">Ore mese corrente</p>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatOre(employee.stats?.total_hours ?? 0)}
            </p>
            <p className="text-xs text-zinc-400 mt-1">clicca per storico</p>
          </div>

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays size={15} className="text-zinc-400" />
              <p className="text-xs text-zinc-500">Letture</p>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {employee.stats?.total_reads ?? 0}
            </p>
          </div>

          {turniAttivi && (

            <>

              <div className="rounded-3xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle size={15} className="text-red-400" />
                  <p className="text-xs text-red-500">Assenze</p>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {employee.stats?.giorni_assenti ?? 0}
                </p>
              </div>

              <div className="rounded-3xl border border-amber-100 dark:border-amber-900/30 bg-amber-50 dark:bg-amber-900/10 p-5">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={15} className="text-amber-400" />
                  <p className="text-xs text-amber-500">Straordinari</p>
                </div>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                  {formatOre(parseFloat(employee.stats?.ore_straordinario ?? 0))}
                </p>
              </div>

            </>

          )}

        </div>

        {/* BADGE */}

        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-5">

          <div className="flex items-center gap-2 mb-4">
            <CreditCard size={18} className="text-zinc-500" />
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Badge NFC</h2>
          </div>

          <div className="mb-4">
            <p className="text-xs text-zinc-400 mb-1">UID attuale</p>
            <p className="text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100">
              {employee.badge_uid || "Nessun badge"}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">

            <button
              onClick={() => { setWaitingBadgeScan(true); setShowManualUid(false); }}
              disabled={waitingBadgeScan || changingBadge}
              className="h-10 px-5 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50"
            >
              {waitingBadgeScan ? "Scansiona badge..." : changingBadge ? "Aggiornamento..." : "Scansiona nuovo badge"}
            </button>

            <button
              onClick={() => { setShowManualUid(prev => !prev); setWaitingBadgeScan(false); }}
              className="h-10 px-5 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300"
            >
              Inserisci UID manuale
            </button>

          </div>

          {showManualUid && (

            <div className="mt-4 flex gap-3">
              <input
                type="text"
                placeholder="Es. A1B2C3D4"
                value={manualUid}
                onChange={(e) => setManualUid(e.target.value.toUpperCase())}
                className="flex-1 h-10 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none font-mono"
              />
              <button
                onClick={() => changeBadge(manualUid)}
                disabled={!manualUid || changingBadge}
                className="h-10 px-5 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50"
              >
                Salva
              </button>
            </div>

          )}

        </div>

        {/* TURNI TOGGLE */}

        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-5">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Gestione turni</h2>
              <p className="text-sm text-zinc-500 mt-1">
                {turniAttivi
                  ? "Turni attivi — assenze e straordinari calcolati"
                  : "Attiva per tracciare assenze e straordinari"
                }
              </p>
            </div>

            <button
              onClick={toggleTurni}
              className={`w-16 h-9 rounded-2xl text-sm font-semibold transition-all ${
                turniAttivi
                  ? "bg-green-500 text-white"
                  : "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
              }`}
            >
              {turniAttivi ? "ON" : "OFF"}
            </button>

          </div>

        </div>

        {/* FORM TURNI */}

        {turniAttivi && (

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-5">

            <div className="flex items-center gap-2 mb-5">
              <Briefcase size={18} className="text-zinc-500" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {editingShiftId ? "Modifica turno" : "Aggiungi turno"}
              </h2>
            </div>

            <form onSubmit={salvaTurno} className="space-y-4">

              <div className="grid md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Nome turno (es. Mattina)"
                  value={turnoNome}
                  onChange={(e) => setTurnoNome(e.target.value)}
                  className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                />
              </div>

              {/* SELEZIONE GIORNI - singolo in modifica, multi in creazione */}
              <div>
                <p className="text-xs text-zinc-400 mb-2">
                  {editingShiftId ? "Giorno" : "Giorni (seleziona uno o più)"}
                </p>
                {editingShiftId ? (
                  <select
                    value={giorno}
                    onChange={(e) => setGiorno(e.target.value)}
                    className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                  >
                    {giorni.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {giorni.map(g => (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleGiorno(g)}
                        className={`px-3 py-2 rounded-xl text-xs font-medium border transition-all ${
                          giorniSelezionati.includes(g)
                            ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-black border-transparent"
                            : "bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                )}
                {!editingShiftId && giorniSelezionati.length === 0 && (
                  <p className="text-xs text-zinc-400 mt-1">Seleziona almeno un giorno, oppure verrà usato Lunedì</p>
                )}
              </div>

              <div>
                <p className="text-xs text-zinc-400 mb-2">Primo turno</p>
                <div className="grid grid-cols-2 gap-4">
                  <input type="time" value={ingresso1} onChange={(e) => setIngresso1(e.target.value)}
                    className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                  <input type="time" value={uscita1} onChange={(e) => setUscita1(e.target.value)}
                    className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                </div>
              </div>

              <div>
                <p className="text-xs text-zinc-400 mb-2">Secondo turno (opzionale)</p>
                <div className="grid grid-cols-2 gap-4">
                  <input type="time" value={ingresso2} onChange={(e) => setIngresso2(e.target.value)}
                    className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                  <input type="time" value={uscita2} onChange={(e) => setUscita2(e.target.value)}
                    className="h-11 px-4 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 px-6 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "Salvataggio..." : editingShiftId ? "Modifica" : "Aggiungi turno"}
                </button>
                {editingShiftId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="h-11 px-6 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300"
                  >
                    Annulla
                  </button>
                )}
              </div>

            </form>

          </div>

        )}

        {/* LISTA TURNI */}

        {turniAttivi && turni.length > 0 && (

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-5">

            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Turni assegnati</h2>

            <div className="space-y-3">
              {turni.map((t) => (
                <div key={t.id} className="rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2 flex-wrap">
                        {t.turno_nome || "Turno"} — {t.giorno_settimana}
                        {t.uscita_1 && t.ingresso_1 && t.uscita_1 < t.ingresso_1 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                            Notturno
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {t.ingresso_1} - {t.uscita_1}
                        {t.ingresso_2 && t.uscita_2 ? ` · ${t.ingresso_2} - ${t.uscita_2}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-4">
                      <button onClick={() => startEditShift(t)} className="text-xs text-blue-500 hover:text-blue-700">Modifica</button>
                      <button onClick={() => eliminaTurno(t.id)} className="text-xs text-red-500 hover:text-red-700">Elimina</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </div>

        )}

        </div>{/* end flex-1 main content */}

        {/* PANNELLO LATERALE GRAFICI */}
        <div className="w-full xl:w-80 xl:shrink-0 xl:sticky xl:top-6">
          <ChartPanel historyMonths={historyMonths} turniAttivi={turniAttivi} />
        </div>

        </div>{/* end flex row */}
      </div>

      {/* MODALE STORICO */}

      {showStorico && (

        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">

          <div className="w-full max-w-3xl max-h-[90vh] bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-3xl flex flex-col">

            <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <div>
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">Storico presenze</h2>
                <p className="text-sm text-zinc-500 mt-0.5">{employee.nome} {employee.cognome}</p>
              </div>
              <div className="flex items-center gap-2">
                {canManagePresence && (
                  <button
                    onClick={() => startAddPresence()}
                    className="h-9 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium flex items-center gap-1.5"
                  >
                    <Plus size={14} />
                    Timbratura
                  </button>
                )}
                <button
                  onClick={() => setShowStorico(false)}
                  className="h-9 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-sm text-zinc-600 dark:text-zinc-300"
                >
                  Chiudi
                </button>
              </div>
            </div>

            <div className="overflow-y-auto p-6 space-y-4">

              {historyMonths.length === 0 ? (

                <p className="text-zinc-500 text-center py-10">Nessuna presenza registrata</p>

              ) : (

                historyMonths.map((month) => (

                  <div key={month.mese} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">

                    {/* MESE HEADER */}

                    <button
                      onClick={() => setExpandedMonth(expandedMonth === month.mese ? null : month.mese)}
                      className="w-full flex items-center justify-between px-5 py-4 bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all"
                    >

                      <div className="text-left">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 capitalize">{month.mese}</p>
                        <p className="text-xs text-zinc-400 mt-0.5">{month.giorni.length} giorni</p>
                      </div>

                      <div className="flex items-center gap-4">

                        <div className="flex gap-4 text-right">

                          <div>
                            <p className="text-xs text-zinc-400">Ore lavorate</p>
                            <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">{formatOre(month.ore_totali)}</p>
                          </div>

                          {turniAttivi && (
                            <>
                              {month.ore_previste > 0 && (
                                <div>
                                  <p className="text-xs text-zinc-400">Previste</p>
                                  <p className="text-base font-bold text-zinc-600 dark:text-zinc-300">{formatOre(month.ore_previste)}</p>
                                </div>
                              )}
                              {month.ore_straordinario > 0 && (
                                <div>
                                  <p className="text-xs text-zinc-400">Straord.</p>
                                  <p className="text-base font-bold text-amber-500">{formatOre(month.ore_straordinario)}</p>
                                </div>
                              )}
                              {month.giorni_assenti > 0 && (
                                <div>
                                  <p className="text-xs text-zinc-400">Assenze</p>
                                  <p className="text-base font-bold text-red-500">{month.giorni_assenti}gg</p>
                                </div>
                              )}
                            </>
                          )}

                        </div>

                        <div className="flex flex-col items-center gap-1">
                          {expandedMonth === month.mese
                            ? <ChevronUp size={16} className="text-zinc-400" />
                            : <ChevronDown size={16} className="text-zinc-400" />
                          }
                          <button
                            onClick={(e) => { e.stopPropagation(); eliminaMese(month.mese); }}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            Elimina
                          </button>
                        </div>

                      </div>

                    </button>

                    {/* GIORNI */}

                    {expandedMonth === month.mese && (

                      <table className="w-full">

                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-800">
                            <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400">Data</th>
                            <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400">Entrata</th>
                            <th className="text-left px-5 py-3 text-xs font-medium text-zinc-400">Uscita</th>
                            <th className="text-right px-5 py-3 text-xs font-medium text-zinc-400">Ore</th>
                            {turniAttivi && <th className="text-right px-5 py-3 text-xs font-medium text-zinc-400">Previste</th>}
                            {turniAttivi && <th className="text-right px-5 py-3 text-xs font-medium text-zinc-400">Stato</th>}
                            {canManagePresence && <th className="px-3 py-3"></th>}
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">

                          {month.giorni.map((day) => (

                            <tr
                              key={day.giorno}
                              className={`align-top ${
                                day.stato === 'ferie'
                                  ? "bg-blue-50/50 dark:bg-blue-900/10"
                                  : day.stato === 'giustificata'
                                  ? "bg-purple-50/50 dark:bg-purple-900/10"
                                  : day.assente
                                  ? "bg-red-50/50 dark:bg-red-900/10"
                                  : "hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
                              }`}
                            >

                              <td className="px-5 py-3 text-sm text-zinc-900 dark:text-zinc-100">
                                {new Date(day.giorno + "T00:00:00").toLocaleDateString("it-IT", {
                                  weekday: "short", day: "2-digit", month: "short", timeZone: "Europe/Rome"
                                })}
                              </td>

                              <td className="px-5 py-3 text-sm">
                                <div className="flex flex-col gap-1">
                                  {(day.assente || day.stato === 'ferie' || day.stato === 'giustificata')
                                    ? <span className="text-zinc-400">—</span>
                                    : (day.coppie || []).map((coppia, i) => (
                                        <div key={i} className="flex items-center gap-1">
                                          <span className={coppia.entrata_manuale ? "text-amber-600 dark:text-amber-400 font-medium" : "text-green-600 dark:text-green-400 font-medium"}>
                                            {coppia.entrata || "—"}
                                          </span>
                                          {canManagePresence && coppia.entrata_id && (
                                            <button onClick={(e) => { e.stopPropagation(); startEditPresence(coppia.entrata_id, "ENTRATA", day.giorno, coppia.entrata); }}
                                              className={`transition-colors flex-shrink-0 ${coppia.entrata_manuale ? "text-amber-400 hover:text-blue-500" : "text-zinc-300 hover:text-blue-500"}`}>
                                              <Pencil size={10} />
                                            </button>
                                          )}
                                          {canManagePresence && coppia.entrata_manuale && coppia.entrata_id && (
                                            <button onClick={(e) => { e.stopPropagation(); deletePresence(coppia.entrata_id); }} className="text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0">
                                              <X size={10} />
                                            </button>
                                          )}
                                        </div>
                                      ))
                                  }
                                </div>
                              </td>

                              <td className="px-5 py-3 text-sm">
                                <div className="flex flex-col gap-1">
                                  {(day.assente || day.stato === 'ferie' || day.stato === 'giustificata')
                                    ? <span className="text-zinc-400">—</span>
                                    : (day.coppie || []).map((coppia, i) => (
                                        <div key={i} className="flex items-center gap-1">
                                          <span className={coppia.uscita_manuale ? "text-amber-600 dark:text-amber-400 font-medium" : "text-red-500 dark:text-red-400 font-medium"}>
                                            {coppia.uscita || "—"}
                                          </span>
                                          {coppia.uscita && coppia.uscita_giorno_dopo && (
                                            <span className="text-xs text-indigo-500 dark:text-indigo-400 font-medium">+1</span>
                                          )}
                                          {canManagePresence && coppia.uscita_id && (
                                            <button onClick={(e) => { e.stopPropagation(); startEditPresence(coppia.uscita_id, "USCITA", day.giorno, coppia.uscita_giorno_dopo ? null : coppia.uscita); }}
                                              className={`transition-colors flex-shrink-0 ${coppia.uscita_manuale ? "text-amber-400 hover:text-blue-500" : "text-zinc-300 hover:text-blue-500"}`}>
                                              <Pencil size={10} />
                                            </button>
                                          )}
                                          {canManagePresence && coppia.uscita_manuale && coppia.uscita_id && (
                                            <button onClick={(e) => { e.stopPropagation(); deletePresence(coppia.uscita_id); }} className="text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0">
                                              <X size={10} />
                                            </button>
                                          )}
                                        </div>
                                      ))
                                  }
                                </div>
                              </td>

                              <td className="px-5 py-3 text-sm text-right font-semibold text-zinc-900 dark:text-zinc-100">
                                {day.ore_totali > 0
                                  ? formatOre(day.ore_totali)
                                  : <span className="text-zinc-400 font-normal">—</span>
                                }
                              </td>

                              {turniAttivi && (
                                <td className="px-5 py-3 text-sm text-right text-zinc-400">
                                  {day.ore_previste > 0 ? formatOre(day.ore_previste) : "—"}
                                </td>
                              )}

                              {turniAttivi && (
                                <td className="px-5 py-3 text-right">
                                  {day.assente && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                      Assente
                                    </span>
                                  )}
                                  {day.stato === 'ferie' && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                                      Ferie
                                    </span>
                                  )}
                                  {day.stato === 'giustificata' && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                                      Giustificata
                                    </span>
                                  )}
                                  {day.stato === 'straordinario' && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                                      +{formatOre(day.ore_straordinario)}
                                    </span>
                                  )}
                                  {day.stato === 'parziale' && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                                      Parziale
                                    </span>
                                  )}
                                  {day.stato === 'presente' && !day.assente && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400">
                                      Presente
                                    </span>
                                  )}
                                  {day.ritardo_minuti > 0 && day.stato === 'ritardo' && (
                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
                                      Ritardo {day.ritardo_minuti}m
                                    </span>
                                  )}
                                </td>
                              )}

                              {canManagePresence && (
                                <td className="px-3 py-3 text-right">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); startAddPresence(day.giorno); }}
                                    title="Aggiungi timbratura"
                                    className="text-zinc-300 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                                  >
                                    <Plus size={14} />
                                  </button>
                                </td>
                              )}

                            </tr>

                          ))}

                        </tbody>

                      </table>

                    )}

                  </div>

                ))

              )}

            </div>

          </div>

        </div>

      )}

      {/* MODALE AGGIUNGI TIMBRATURA MANUALE — solo se portale disattivo */}

      {showAddPresence && canManagePresence && (

        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">

          <div className="w-full max-w-sm bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl">

            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Aggiungi timbratura</h3>
            <p className="text-xs text-zinc-400 mb-5">La timbratura sarà marcata come <span className="text-amber-500 font-medium">manuale</span> in storico, PDF ed Excel</p>

            <div className="space-y-4">

              {/* TIPO */}
              <div>
                <p className="text-xs text-zinc-400 mb-2">Tipo</p>
                <div className="flex gap-2">
                  {["ENTRATA", "USCITA"].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAddTipo(t)}
                      className={`flex-1 h-10 rounded-2xl text-sm font-medium border transition-all ${
                        addTipo === t
                          ? t === "ENTRATA"
                            ? "bg-green-500 text-white border-transparent"
                            : "bg-red-500 text-white border-transparent"
                          : "bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      {t === "ENTRATA" ? "Entrata" : "Uscita"}
                    </button>
                  ))}
                </div>
              </div>

              {/* DATA + ORA */}
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400 mb-2">Data</p>
                  <input
                    type="date"
                    value={addDate}
                    onChange={(e) => setAddDate(e.target.value)}
                    className="w-full min-w-0 h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400 mb-2">Ora</p>
                  <input
                    type="time"
                    value={addTime}
                    onChange={(e) => setAddTime(e.target.value)}
                    className="w-full min-w-0 h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                </div>
              </div>

            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={addPresence}
                disabled={addPresenceSaving || !addDate || !addTime}
                className="flex-1 h-11 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50"
              >
                {addPresenceSaving ? "Aggiunta..." : "Aggiungi"}
              </button>
              <button
                onClick={() => setShowAddPresence(false)}
                className="flex-1 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300"
              >
                Annulla
              </button>
            </div>

          </div>

        </div>

      )}

      {/* MODALE MODIFICA TIMBRATURA — solo se canManagePresence */}

      {showEditPresence && canManagePresence && (

        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">

          <div className="w-full max-w-sm bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl">

            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Modifica timbratura</h3>
            <p className="text-xs text-zinc-400 mb-5">
              {editPresenceTipo === "ENTRATA" ? "Entrata" : "Uscita"} — modifica data e orario
            </p>

            <div className="space-y-4">

              {/* TIPO */}
              <div>
                <p className="text-xs text-zinc-400 mb-2">Tipo</p>
                <div className="flex gap-2">
                  {["ENTRATA", "USCITA"].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setEditPresenceTipo(t)}
                      className={`flex-1 h-10 rounded-2xl text-sm font-medium border transition-all ${
                        editPresenceTipo === t
                          ? t === "ENTRATA"
                            ? "bg-green-500 text-white border-transparent"
                            : "bg-red-500 text-white border-transparent"
                          : "bg-zinc-50 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700"
                      }`}
                    >
                      {t === "ENTRATA" ? "Entrata" : "Uscita"}
                    </button>
                  ))}
                </div>
              </div>

              {/* DATA + ORA */}
              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400 mb-2">Data</p>
                  <input
                    type="date"
                    value={editPresenceDate}
                    onChange={(e) => setEditPresenceDate(e.target.value)}
                    className="w-full min-w-0 h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-zinc-400 mb-2">Ora</p>
                  <input
                    type="time"
                    value={editPresenceTime}
                    onChange={(e) => setEditPresenceTime(e.target.value)}
                    className="w-full min-w-0 h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none"
                  />
                </div>
              </div>

            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={saveEditPresence}
                disabled={editPresenceSaving || !editPresenceDate || !editPresenceTime}
                className="flex-1 h-11 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50"
              >
                {editPresenceSaving ? "Salvataggio..." : "Salva"}
              </button>
              <button
                onClick={() => setShowEditPresence(false)}
                className="flex-1 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300"
              >
                Annulla
              </button>
            </div>

          </div>

        </div>

      )}

    </div>

  );

}