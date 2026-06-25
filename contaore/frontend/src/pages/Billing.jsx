import { CreditCard, Zap, Shield, LifeBuoy } from 'lucide-react'
import { SettingsHeader } from '../components/SettingsUI'

export default function Billing() {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-6">
      <SettingsHeader title="Piano & Abbonamento" subtitle="Gestisci il tuo piano Timbry" />

      {/* Piano attuale */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Piano attuale</h2>
            <p className="text-xs text-zinc-500 mt-0.5">Il tuo abbonamento Timbry</p>
          </div>
          <span className="px-2.5 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full">
            Attivo
          </span>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900 rounded-xl p-4">
          <p className="text-2xl font-bold text-zinc-900 dark:text-white">Timbry Pro</p>
          <p className="text-sm text-zinc-500 mt-1">Dipendenti illimitati · Badge NFC · Report · Supporto prioritario</p>
        </div>
      </div>

      {/* Funzionalità */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Incluso nel piano</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { icon: Zap,       label: 'Timbrature illimitate',        desc: 'Badge NFC in tempo reale' },
            { icon: Shield,    label: 'Sicurezza avanzata',            desc: '2FA, audit log, GDPR' },
            { icon: CreditCard,label: 'Report & Export',               desc: 'PDF, Excel, storico completo' },
            { icon: LifeBuoy,  label: 'Supporto',                      desc: 'Email e chat dedicata' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900">
              <div className="p-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                <Icon className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
                <p className="text-xs text-zinc-500">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contatto */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#161618] p-6">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Domande sull'abbonamento?</h2>
        <p className="text-xs text-zinc-500 mb-4">Contattaci per cambiare piano, ottenere una fattura o discutere esigenze specifiche.</p>
        <a
          href="mailto:info@timbry.it"
          className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-xl text-sm font-medium hover:opacity-90 transition"
        >
          Contatta il supporto
        </a>
      </div>
    </div>
  )
}
