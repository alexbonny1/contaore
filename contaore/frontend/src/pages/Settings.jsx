import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { SlidersHorizontal, BarChart2, Bell, Shield, Trash2, User, LogOut, Users, Mail } from "lucide-react";
import { SettingRow, SettingsGroup } from "../components/SettingsUI";
import { ThemeRow } from "../components/ThemeSelector";
import { hasPermission } from "../api";

// ─── Schermata principale impostazioni (stile Apple, categorie) ────────────────

export default function Settings() {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const canManageAdmins = user.role === "owner" || user.role === "superadmin";
  const canManageEmployees = hasPermission("can_manage_employees");

  useEffect(() => {
    if (!user.role || user.role === "dipendente") navigate("/dashboard");
  }, []);

  function logout() { localStorage.clear(); navigate("/"); }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-5">

      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Impostazioni</h1>

      <SettingsGroup>
        <SettingRow
          to="/impostazioni/profilo"
          icon={User}
          iconBg="bg-blue-50 dark:bg-blue-900/20"
          iconColor="text-blue-500"
          title="Profilo"
          subtitle="Nome, cognome e indirizzo email"
        />
        {canManageAdmins && (
          <SettingRow
            to="/impostazioni/admin"
            icon={Users}
            iconBg="bg-violet-50 dark:bg-violet-900/20"
            iconColor="text-violet-500"
            title="Account amministratori"
            subtitle="Accessi secondari con permessi limitati"
          />
        )}
        {canManageEmployees && (
          <SettingRow
            to="/impostazioni/presenze"
            icon={SlidersHorizontal}
            iconBg="bg-zinc-100 dark:bg-zinc-800"
            iconColor="text-zinc-600 dark:text-zinc-300"
            title="Presenze e turni"
            subtitle="Tolleranza e calcolo straordinari"
          />
        )}
        <SettingRow
          to="/impostazioni/grafici"
          icon={BarChart2}
          iconBg="bg-amber-50 dark:bg-amber-900/20"
          iconColor="text-amber-500"
          title="Grafici dipendente"
          subtitle="Personalizza il pannello riepilogo"
        />
        {canManageEmployees && (
          <SettingRow
            to="/impostazioni/notifiche"
            icon={Bell}
            iconBg="bg-indigo-50 dark:bg-indigo-900/20"
            iconColor="text-indigo-500"
            title="Notifiche"
            subtitle="Email e avvisi automatici"
          />
        )}
        <SettingRow
          to="/impostazioni/sicurezza"
          icon={Shield}
          iconBg="bg-green-50 dark:bg-green-900/20"
          iconColor="text-green-500"
          title="Sicurezza"
          subtitle="Password e autenticazione a due fattori"
        />
        {canManageEmployees && (
          <SettingRow
            to="/impostazioni/dati"
            icon={Trash2}
            iconBg="bg-red-50 dark:bg-red-900/20"
            iconColor="text-red-500"
            title="Gestione dati"
            subtitle="Elimina e pulizia automatica dello storico"
          />
        )}
        {canManageEmployees && (
          <SettingRow
            to="/impostazioni/riepilogo-ore"
            icon={Mail}
            iconBg="bg-teal-50 dark:bg-teal-900/20"
            iconColor="text-teal-500"
            title="Invio riepilogo ore"
            subtitle="Invia automaticamente PDF o Excel via email"
          />
        )}
      </SettingsGroup>

      <SettingsGroup>
        <ThemeRow />
      </SettingsGroup>

      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 text-sm font-medium"
      >
        <LogOut size={15} /> Esci
      </button>

    </div>
  );
}
