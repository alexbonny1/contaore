import { useState } from "react";
import TwoFactorSettings from "../components/TwoFactorSettings";
import ChangePasswordModal from "../components/ChangePasswordModal";
import { SettingsHeader } from "../components/SettingsUI";

export default function SettingsSicurezza() {
  const [showChangePassword, setShowChangePassword] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4">
      <SettingsHeader title="Sicurezza" subtitle="Password e autenticazione a due fattori" />

      {/* Cambio password */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cambio password</h2>
          <p className="text-xs text-zinc-500">Aggiorna la tua password</p>
        </div>
        <button
          onClick={() => setShowChangePassword(true)}
          className="w-full h-11 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition duration-200"
        >
          Cambia password
        </button>
      </div>

      {/* 2FA */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Autenticazione a due fattori</h2>
          <p className="text-xs text-zinc-500">Aggiungi un livello di sicurezza all'accesso</p>
        </div>
        <TwoFactorSettings />
      </div>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}
