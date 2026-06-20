import {
  useEffect,
  useState,
  useMemo
} from "react";

import {
  useParams,
  useNavigate,
  Link
} from "react-router-dom";

import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Calendar,
  Briefcase,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  BarChart2,
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
      fixed bottom-28 left-1/2 -translate-x-1/2 z-50
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

function Bars({ data, keys, colors, unit = "" }) {
  if (!data.length) return null;
  const W = 256, H = 110, PL = 28, PB = 16, PT = 4, PR = 2;
  const cW = W - PL - PR, cH = H - PB - PT;
  const max = Math.max(...data.flatMap(d => keys.map(k => d[k] ?? 0)), 1);
  const slot = cW / data.length;
  const bW = Math.max(2, Math.min(10, slot / keys.length - 1.5));
  const step = Math.max(1, Math.ceil(data.length / 8));
  const gridLines = [0.25, 0.5, 0.75, 1].map(f => ({ y: PT + cH * (1 - f), v: Math.round(max * f) }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {gridLines.map(gl => (
        <g key={gl.y}>
          <line x1={PL} x2={W - PR} y1={gl.y} y2={gl.y} stroke="rgba(120,120,120,0.15)" strokeWidth={1} />
          <text x={PL - 3} y={gl.y + 1} textAnchor="end" dominantBaseline="middle" fontSize={7.5} fill="rgba(120,120,120,0.7)">{gl.v}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const sx = PL + i * slot;
        return (
          <g key={d.g}>
            {keys.map((k, ki) => {
              const bH = ((d[k] ?? 0) / max) * cH;
              const tot = keys.length * bW + (keys.length - 1);
              const bx = sx + (slot - tot) / 2 + ki * (bW + 1);
              return <rect key={k} x={bx} y={PT + cH - bH} width={bW} height={Math.max(0, bH)} fill={colors[ki]} rx={1.5} />;
            })}
            {(i === 0 || i === data.length - 1 || i % step === 0) && (
              <text x={sx + slot / 2} y={H - 1} textAnchor="middle" fontSize={8} fill="rgba(120,120,120,0.8)">{d.g}</text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function StackedBars({ data, keys, colors }) {
  if (!data.length) return null;
  const W = 256, H = 116, PL = 4, PB = 16, PT = 14, PR = 4;
  const cW = W - PL - PR, cH = H - PB - PT;
  const max = Math.max(...data.map(d => keys.reduce((s, k) => s + (d[k] ?? 0), 0)), 1);
  const slot = cW / data.length;
  const bW = Math.max(5, Math.min(20, slot - 6));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      <line x1={PL} x2={W - PR} y1={PT + cH} y2={PT + cH} stroke="rgba(120,120,120,0.15)" strokeWidth={1} />
      {data.map((d, i) => {
        const sx = PL + i * slot;
        const bx = sx + (slot - bW) / 2;
        const baseline = PT + cH;
        let cumH = 0;
        const total = keys.reduce((s, k) => s + (d[k] ?? 0), 0);
        const rects = keys.map((k, ki) => {
          const val = d[k] ?? 0;
          const bH = (val / max) * cH;
          const rectY = baseline - cumH - bH;
          cumH += bH;
          return { k, ki, val, bH, rectY };
        });
        const lastNonZeroIdx = rects.reduce((best, r, idx) => r.val > 0 ? idx : best, -1);
        const topY = lastNonZeroIdx >= 0 ? rects[lastNonZeroIdx].rectY : baseline;
        return (
          <g key={d.g}>
            {rects.map(({ k, ki, val, bH, rectY }, idx) =>
              val > 0 ? (
                <rect key={k} x={bx} y={rectY} width={bW} height={bH}
                  fill={colors[ki]} rx={idx === lastNonZeroIdx ? 2 : 0} />
              ) : null
            )}
            {total > 0 && (
              <text x={sx + slot / 2} y={topY - 2} textAnchor="middle"
                fontSize={8} fontWeight="600" fill="rgba(120,120,120,0.9)">{total}×</text>
            )}
            <text x={sx + slot / 2} y={H - 1} textAnchor="middle" fontSize={8} fill="rgba(120,120,120,0.8)">{d.g}</text>
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

  const chartPrefs = useMemo(() => {
    try { return { showOre: true, showExtra: true, hiddenStati: [], ...JSON.parse(localStorage.getItem("timbry_chart_prefs") || "{}") }; }
    catch (_) { return { showOre: true, showExtra: true, hiddenStati: [] }; }
  }, []);

  const giorni = useMemo(() =>
    historyMonths.find(m => m.mese === selectedMese)?.giorni ?? [],
  [historyMonths, selectedMese]);

  const pieData = useMemo(() => {
    const counts = {};
    giorni.forEach(d => {
      const k = d.assente ? "assente" : d.stato;
      if (!chartPrefs.hiddenStati.includes(k)) counts[k] = (counts[k] ?? 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [giorni, chartPrefs.hiddenStati]);

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

  const barDow = useMemo(() => {
    const LABELS = ["Lun","Mar","Mer","Gio","Ven","Sab","Dom"];
    return LABELS.map((label, i) => {
      const jsDay = i < 6 ? i + 1 : 0;
      const week = giorni.filter(d => new Date(d.giorno + "T12:00:00").getDay() === jsDay);
      return {
        g: label,
        ass: week.filter(d => d.assente || d.stato === "assente").length,
        rit: week.filter(d => (d.ritardo_minuti ?? 0) > 0 || d.stato === "ritardo").length,
        str: week.filter(d => (d.ore_straordinario ?? 0) > 0 || d.stato === "straordinario").length,
      };
    });
  }, [giorni]);

  if (!historyMonths.length) return null;

  return (
    <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 space-y-4">

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
        <p className="text-xs text-zinc-400 text-center py-6">Nessun dato per questo mese</p>
      ) : (
        <>
          {/* Riepilogo stati — barre con ratio esplicito */}
          {(() => {
            const totalDays = giorni.length;
            const totRitMin = giorni.reduce((s, d) => s + (d.ritardo_minuti ?? 0), 0);
            const totStrH   = giorni.reduce((s, d) => s + (d.ore_straordinario ?? 0), 0);
            function fmtMins(mins) {
              const h = Math.floor(mins / 60), m = mins % 60;
              return h > 0 ? `${h}h${m > 0 ? " " + m + "m" : ""}` : `${m}m`;
            }
            return (
              <div className="space-y-2.5">
                {pieData.map(d => {
                  const pct = totalDays > 0 ? Math.round((d.value / totalDays) * 100) : 0;
                  const color = PIE_COLORS[d.name] ?? "#94a3b8";
                  let timeLabel = null;
                  if (d.name === "ritardo" && totRitMin > 0) timeLabel = fmtMins(totRitMin) + " tot";
                  if (d.name === "straordinario" && totStrH > 0) timeLabel = fmtMins(Math.round(totStrH * 60)) + " tot";
                  return (
                    <div key={d.name}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                        <span className="text-xs text-zinc-600 dark:text-zinc-400 capitalize flex-1">{d.name}</span>
                        {timeLabel && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md" style={{ background: color + "22", color }}>{timeLabel}</span>}
                        <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{d.value} su {totalDays}g</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: pct + "%", background: color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {turniAttivi && (chartPrefs.showOre || chartPrefs.showExtra) && (
            <div className="space-y-4 pt-2 border-t border-zinc-100 dark:border-zinc-800">

              {chartPrefs.showOre && <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-zinc-500">Ore lavorate vs previste</p>
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-[10px] text-zinc-400"><span className="w-2 h-1.5 rounded-sm inline-block bg-zinc-300 dark:bg-zinc-600" />prv</span>
                    <span className="flex items-center gap-1 text-[10px] text-zinc-400"><span className="w-2 h-1.5 rounded-sm inline-block bg-green-500" />lav</span>
                  </div>
                </div>
                <Bars data={barOre} keys={["prv","lav"]} colors={["#a1a1aa","#22c55e"]} />
              </div>}

              {chartPrefs.showExtra && barExtra.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-zinc-500">Ritardi e straordinari (min)</p>
                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1 text-[10px] text-zinc-400"><span className="w-2 h-1.5 rounded-sm inline-block bg-purple-500" />rit</span>
                      <span className="flex items-center gap-1 text-[10px] text-zinc-400"><span className="w-2 h-1.5 rounded-sm inline-block bg-amber-500" />str</span>
                    </div>
                  </div>
                  <Bars data={barExtra} keys={["rit","str"]} colors={["#a855f7","#f59e0b"]} />
                </div>
              )}

            </div>
          )}

          {barDow.some(d => d.ass > 0 || d.rit > 0 || d.str > 0) && (
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <div className="mb-1">
                <p className="text-xs font-medium text-zinc-500">In quali giorni succede di più</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">quante volte nel mese quel giorno ha avuto un evento</p>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="flex items-center gap-1 text-[10px] text-zinc-400"><span className="w-2 h-1.5 rounded-sm inline-block bg-red-500" />assenze</span>
                <span className="flex items-center gap-1 text-[10px] text-zinc-400"><span className="w-2 h-1.5 rounded-sm inline-block bg-purple-500" />ritardi</span>
                <span className="flex items-center gap-1 text-[10px] text-zinc-400"><span className="w-2 h-1.5 rounded-sm inline-block bg-amber-500" />straordinari</span>
              </div>
              <StackedBars data={barDow} keys={["ass","rit","str"]} colors={["#ef4444","#a855f7","#f59e0b"]} />
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
  const [expandedDay, setExpandedDay] = useState(null);
  const [showGrafici, setShowGrafici] = useState(false);

  const [waitingBadgeScan, setWaitingBadgeScan] = useState(false);
  const [changingBadge, setChangingBadge] = useState(false);
  const [manualUid, setManualUid] = useState("");
  const [showManualUid, setShowManualUid] = useState(false);
  const [toast, setToast] = useState(null);

  const [portaleAttivo, setPortaleAttivo]       = useState(true); // default true = nascosto finché non carica

  const [showEditProfile, setShowEditProfile]   = useState(false);
  const [profileNome, setProfileNome]           = useState("");
  const [profileCognome, setProfileCognome]     = useState("");
  const [profileEmail, setProfileEmail]         = useState("");
  const [profileSaving, setProfileSaving]       = useState(false);

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

  function openEditProfile() {
    setProfileNome(employee?.nome || "");
    setProfileCognome(employee?.cognome || "");
    setProfileEmail(employee?.email || "");
    setShowEditProfile(true);
  }

  async function saveProfile() {
    if (!profileNome.trim()) { showToast("Il nome è obbligatorio", "error"); return; }
    setProfileSaving(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(API_URL + "/api/employees/" + id + "/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
        body: JSON.stringify({
          nome: profileNome.trim(),
          cognome: profileCognome.trim(),
          email: profileEmail.trim() || null
        })
      });
      const data = await res.json();
      if (!data.success) { showToast(data.error || "Errore salvataggio", "error"); return; }
      showToast(data.credenziali_inviate ? `Credenziali inviate a ${profileEmail.trim()}` : "Anagrafica aggiornata");
      setShowEditProfile(false);
      loadData();
    } catch (err) {
      console.log(err);
      showToast("Errore server", "error");
    } finally {
      setProfileSaving(false);
    }
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

  const giorniIdx = ["Domenica","Lunedì","Martedì","Mercoledì","Giovedì","Venerdì","Sabato"];
  const todayName = giorniIdx[new Date().getDay()];
  const todayStr  = new Date().toISOString().split("T")[0];
  const turnoOggi = turni.filter(t => t.giorno_settimana === todayName);
  let todayDay = null;
  for (const m of historyMonths) {
    const d = (m.giorni || []).find(g => g.giorno === todayStr);
    if (d) { todayDay = d; break; }
  }
  const inFerieOggi = todayDay?.stato === "ferie";
  const headerStato = inFerieOggi
    ? { label: "In ferie",     cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" }
    : employee.attivo
    ? { label: "Presente ora", cls: "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-300" }
    : { label: "Fuori orario", cls: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300" };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-8">

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <Link to="/employees" className="inline-flex items-center gap-0.5 -ml-1 mb-4 text-sm font-medium text-blue-500 hover:text-blue-600 transition-colors">
        <ChevronLeft size={18} /> Dipendenti
      </Link>

        {/* HEADER */}

        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 mb-5">

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

            <div className="flex items-start gap-3 min-w-0">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 truncate">
                  {employee.nome} {employee.cognome}
                </h1>
                <p className="text-sm text-zinc-500 mt-1 truncate">
                  {employee.email || "Nessuna email"}
                </p>
              </div>
              <button
                onClick={openEditProfile}
                title="Modifica nome ed email"
                className="w-9 h-9 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 shrink-0"
              >
                <Pencil size={15} />
              </button>
            </div>

            <div className={`px-4 py-2 rounded-2xl text-sm font-semibold w-fit ${headerStato.cls}`}>
              {headerStato.label}
            </div>

          </div>

        </div>

        {/* RIQUADRI */}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">

          <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5">
            <div className="flex items-center gap-2 mb-2">
              <Clock3 size={15} className="text-zinc-400" />
              <p className="text-xs text-zinc-500">Ore mese corrente</p>
            </div>
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              {formatOre(employee.stats?.total_hours ?? 0)}
            </p>
          </div>

          <Link
            to={`/employees/${id}/turni`}
            className="text-left rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Calendar size={15} className="text-zinc-400" />
                <p className="text-xs text-zinc-500">Turno di oggi</p>
              </div>
              <ChevronRight size={15} className="text-zinc-300 dark:text-zinc-600" />
            </div>
            {!turniAttivi ? (
              <p className="text-base font-semibold text-zinc-400">Turni non attivi</p>
            ) : inFerieOggi ? (
              <p className="text-base font-semibold text-blue-500">In ferie</p>
            ) : turnoOggi.length > 0 ? (
              <div className="space-y-0.5">
                {turnoOggi.map(t => (
                  <p key={t.id} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {t.ingresso_1} - {t.uscita_1}{t.ingresso_2 && t.uscita_2 ? ` · ${t.ingresso_2} - ${t.uscita_2}` : ""}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-base font-semibold text-zinc-500">Riposo</p>
            )}
            <p className="text-xs text-zinc-400 mt-1">tocca per modificare i turni</p>
          </Link>

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

        {/* STORICO ORE (inline) */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] overflow-hidden mb-5">

          <div className="flex items-center justify-between p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Storico ore</h2>
            {canManagePresence && (
              <button
                onClick={() => startAddPresence()}
                className="h-9 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium flex items-center gap-1.5"
              >
                <Plus size={14} />
                Timbratura
              </button>
            )}
          </div>

          <div className="p-4 sm:p-6 space-y-4">

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
                        </div>

                      </div>

                    </button>

                    {/* GIORNI - accordion style come nel dipendente */}

                    {expandedMonth === month.mese && (

                      <div className="border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                        {month.giorni.map(day => {
                          const isDayOpen = expandedDay === day.giorno;

                          // Get status badge
                          let badgeColor = 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                          let badgeLabel = 'Presente'
                          if (day.assente) {
                            badgeColor = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                            badgeLabel = 'Assente'
                          } else if (day.stato === 'ferie') {
                            badgeColor = 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                            badgeLabel = 'Ferie'
                          } else if (day.stato === 'giustificata') {
                            badgeColor = 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400'
                            badgeLabel = 'Giustificata'
                          } else if (day.stato === 'parziale') {
                            badgeColor = 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
                            badgeLabel = 'Parziale'
                          } else if (day.ore_straordinario > 0) {
                            badgeColor = 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                            badgeLabel = 'Straord.'
                          }

                          return (
                            <div key={day.giorno}>
                              <div className="w-full flex items-center justify-between px-6 py-3 gap-4 flex-wrap hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                                <div className="flex items-center gap-3">
                                  <span className="text-sm text-zinc-700 dark:text-zinc-300 w-32">
                                    {new Date(day.giorno + "T12:00:00").toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "2-digit" })}
                                  </span>
                                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${badgeColor}`}>{badgeLabel}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-zinc-500">
                                  {day.coppie.length > 0 ? (
                                    day.coppie.map((c, i) => (
                                      <div key={i} className="flex items-center gap-2">
                                        <span className="text-green-600 dark:text-green-400 font-medium">↑ {c.entrata || "—"}</span>
                                        <span className="text-zinc-300">|</span>
                                        <span className="text-red-500 dark:text-red-400 font-medium">↓ {c.uscita || "..."}</span>
                                      </div>
                                    ))
                                  ) : (
                                    <span className="text-zinc-400">Nessuna timbratura</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-4 ml-auto">
                                  {day.ore_totali > 0 && <span className="text-xs text-zinc-400">{formatOre(day.ore_totali)}h</span>}
                                  <button onClick={() => setExpandedDay(isDayOpen ? null : day.giorno)} className="flex items-center justify-center h-8 w-8 text-zinc-400">
                                    {isDayOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                </div>
                              </div>

                              {/* dettaglio giorno */}
                              {isDayOpen && (
                                <div className="px-6 pb-4 bg-zinc-50 dark:bg-zinc-900/50 space-y-3">

                                  {/* timbrature */}
                                  {day.coppie.length > 0 ? (
                                    <div className="space-y-1">
                                      {day.coppie.map((c, i) => (
                                        <div key={i} className="flex items-center gap-2 text-xs text-zinc-500">
                                          <span className="text-green-600 dark:text-green-400 font-medium">↑ {c.entrata || "—"}</span>
                                          {c.entrata_id && (
                                            <button onClick={() => startEditPresence(c.entrata_id, "ENTRATA", day.giorno, c.entrata)}
                                              className="text-zinc-300 hover:text-blue-500 transition-colors flex-shrink-0">
                                              <Pencil size={10} />
                                            </button>
                                          )}
                                          {canManagePresence && (c.entrata_manuale || c.entrata_automatica) && c.entrata_id && (
                                            <button onClick={() => deletePresence(c.entrata_id)} className="text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0">
                                              <X size={10} />
                                            </button>
                                          )}
                                          <span className="text-zinc-300">|</span>
                                          <span className="text-red-500 dark:text-red-400 font-medium">↓ {c.uscita || "ancora dentro"}</span>
                                          {c.uscita && c.uscita_giorno_dopo && (
                                            <span className="text-indigo-500 dark:text-indigo-400 font-medium">+1</span>
                                          )}
                                          {c.uscita_id && (
                                            <button onClick={() => startEditPresence(c.uscita_id, "USCITA", day.giorno, c.uscita_giorno_dopo ? null : c.uscita)}
                                              className="text-zinc-300 hover:text-blue-500 transition-colors flex-shrink-0">
                                              <Pencil size={10} />
                                            </button>
                                          )}
                                          {canManagePresence && (c.uscita_manuale || c.uscita_automatica) && c.uscita_id && (
                                            <button onClick={() => deletePresence(c.uscita_id)} className="text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0">
                                              <X size={10} />
                                            </button>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <p className="text-xs text-zinc-400">Nessuna timbratura</p>
                                  )}

                                  {/* ore e stato */}
                                  <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-200 dark:border-zinc-700">
                                    <div className="flex gap-4">
                                      <div>
                                        <span className="text-zinc-400">Ore: </span>
                                        <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatOre(day.ore_totali)}</span>
                                      </div>
                                      {turniAttivi && day.ore_previste > 0 && (
                                        <div>
                                          <span className="text-zinc-400">Previste: </span>
                                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatOre(day.ore_previste)}</span>
                                        </div>
                                      )}
                                      {turniAttivi && day.ore_straordinario > 0 && (
                                        <div>
                                          <span className="text-zinc-400">Straord: </span>
                                          <span className="font-semibold text-amber-600 dark:text-amber-400">{formatOre(day.ore_straordinario)}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* pulsante aggiungi timbratura */}
                                  {canManagePresence && (
                                    <button onClick={() => startAddPresence(day.giorno)}
                                      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 mt-2">
                                      <Plus size={13} /> Aggiungi timbratura
                                    </button>
                                  )}

                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>

                    )}

                  </div>

                ))

              )}

          </div>

        </div>{/* end storico card */}

        {/* GRAFICI (comprimibile) */}
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] overflow-hidden mb-5">
          <button
            onClick={() => setShowGrafici(v => !v)}
            className="w-full flex items-center justify-between p-5 sm:p-6"
          >
            <div className="flex items-center gap-2">
              <BarChart2 size={18} className="text-zinc-500" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Statistiche</h2>
            </div>
            {showGrafici ? <ChevronUp size={18} className="text-zinc-400" /> : <ChevronDown size={18} className="text-zinc-400" />}
          </button>
          {showGrafici && (
            <div className="px-4 sm:px-6 pb-6">
              <ChartPanel historyMonths={historyMonths} turniAttivi={turniAttivi} />
            </div>
          )}
        </div>

      {/* MODALE MODIFICA ANAGRAFICA */}

      {showEditProfile && (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white dark:bg-[#161618] border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Modifica anagrafica</h3>
            <p className="text-xs text-zinc-400 mb-5">
              {portaleAttivo
                ? "Con portale attivo, salvando verranno inviate nuove credenziali alla email indicata."
                : "Aggiorna nome, cognome ed email del dipendente."}
            </p>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Nome</p>
                  <input type="text" value={profileNome} onChange={(e) => setProfileNome(e.target.value)}
                    className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Cognome</p>
                  <input type="text" value={profileCognome} onChange={(e) => setProfileCognome(e.target.value)}
                    className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
                </div>
              </div>
              <div>
                <p className="text-xs text-zinc-400 mb-1">Email</p>
                <input type="email" value={profileEmail} onChange={(e) => setProfileEmail(e.target.value)}
                  placeholder="email@esempio.it"
                  className="w-full h-11 px-3 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 text-sm text-zinc-900 dark:text-zinc-100 outline-none" />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={saveProfile} disabled={profileSaving}
                className="flex-1 h-11 rounded-2xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black text-sm font-medium disabled:opacity-50">
                {profileSaving ? "Salvataggio..." : "Salva"}
              </button>
              <button onClick={() => setShowEditProfile(false)}
                className="flex-1 h-11 rounded-2xl border border-zinc-200 dark:border-zinc-700 text-sm text-zinc-600 dark:text-zinc-300">
                Annulla
              </button>
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