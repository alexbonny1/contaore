import { useState } from "react";
import { Toggle, SettingsHeader } from "../components/SettingsUI";

const STATI_GRAFICO = [
  { key: "presente",     label: "Presente",      color: "#22c55e" },
  { key: "assente",      label: "Assente",       color: "#ef4444" },
  { key: "ritardo",      label: "Ritardo",       color: "#a855f7" },
  { key: "straordinario",label: "Straordinario", color: "#f59e0b" },
  { key: "parziale",     label: "Parziale",      color: "#f97316" },
  { key: "ferie",        label: "Ferie",         color: "#3b82f6" },
  { key: "giustificata", label: "Giustificata",  color: "#6366f1" },
];

const DEFAULT_CHART_PREFS = { showOre: true, showExtra: true, hiddenStati: [] };

function loadChartPrefs() {
  try { return { ...DEFAULT_CHART_PREFS, ...JSON.parse(localStorage.getItem("timbry_chart_prefs") || "{}") }; }
  catch (_) { return DEFAULT_CHART_PREFS; }
}

export default function SettingsGrafici() {
  const [chartPrefs, setChartPrefs] = useState(loadChartPrefs);

  function updateChartPrefs(patch) {
    const next = { ...chartPrefs, ...patch };
    setChartPrefs(next);
    localStorage.setItem("timbry_chart_prefs", JSON.stringify(next));
  }

  function toggleStato(key) {
    const hidden = chartPrefs.hiddenStati.includes(key)
      ? chartPrefs.hiddenStati.filter(s => s !== key)
      : [...chartPrefs.hiddenStati, key];
    updateChartPrefs({ hiddenStati: hidden });
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4">
      <SettingsHeader title="Grafici dipendente" subtitle="Personalizza il pannello riepilogo" />

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Grafico ore lavorate</p>
              <p className="text-xs text-zinc-400">Ore lavorate vs ore previste per giorno</p>
            </div>
            <Toggle value={chartPrefs.showOre} onChange={v => updateChartPrefs({ showOre: v })} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Grafico ritardi/straordinari</p>
              <p className="text-xs text-zinc-400">Minuti di ritardo e straordinario per giorno</p>
            </div>
            <Toggle value={chartPrefs.showExtra} onChange={v => updateChartPrefs({ showExtra: v })} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Stati nel grafico a torta</p>
          <p className="text-xs text-zinc-400">Scegli quali stati mostrare nel riepilogo del mese</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            {STATI_GRAFICO.map(({ key, label, color }) => {
              const visible = !chartPrefs.hiddenStati.includes(key);
              return (
                <button key={key} type="button" onClick={() => toggleStato(key)}
                  className={`flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-medium border transition-all ${visible ? "border-transparent bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200" : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#161618] text-zinc-400 dark:text-zinc-600"}`}>
                  <span className="w-2 h-2 rounded-full shrink-0 transition-opacity" style={{ background: visible ? color : "#a1a1aa" }} />
                  {label}
                  {!visible && <span className="ml-auto text-[10px] text-zinc-400">off</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
