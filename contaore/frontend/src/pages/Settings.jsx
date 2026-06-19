import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SlidersHorizontal, BarChart2, Bell, Shield, Trash2 } from "lucide-react";
import { SettingRow, SettingsGroup } from "../components/SettingsUI";

// ─── Schermata principale impostazioni (stile Apple, categorie) ────────────────

export default function Settings() {
  const navigate = useNavigate();

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (!user.role || user.role === "dipendente") navigate("/dashboard");
  }, []);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-5">

      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Impostazioni</h1>

      <SettingsGroup>
        <SettingRow
          to="/impostazioni/presenze"
          icon={SlidersHorizontal}
          iconBg="bg-zinc-100 dark:bg-zinc-800"
          iconColor="text-zinc-600 dark:text-zinc-300"
          title="Presenze e turni"
          subtitle="Tolleranza e calcolo straordinari"
        />
        <SettingRow
          to="/impostazioni/grafici"
          icon={BarChart2}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconColor="text-amber-500"
          title="Grafici dipendente"
          subtitle="Personalizza il pannello riepilogo"
        />
        <SettingRow
          to="/impostazioni/notifiche"
          icon={Bell}
          iconBg="bg-indigo-50 dark:bg-indigo-900/20"
          iconColor="text-indigo-500"
          title="Notifiche"
          subtitle="Email e avvisi automatici"
        />
        <SettingRow
          to="/impostazioni/sicurezza"
          icon={Shield}
          iconBg="bg-green-50 dark:bg-green-900/20"
          iconColor="text-green-500"
          title="Sicurezza"
          subtitle="Password e autenticazione a due fattori"
        />
        <SettingRow
          to="/impostazioni/dati"
          icon={Trash2}
          iconBg="bg-red-50 dark:bg-red-900/20"
          iconColor="text-red-500"
          title="Gestione dati"
          subtitle="Elimina e pulizia automatica dello storico"
        />
      </SettingsGroup>

    </div>
  );
}
