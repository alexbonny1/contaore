import { Link } from "react-router-dom";

export default function CookiePolicy() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">
            ← Torna al login
          </Link>
        </div>
        <div className="bg-white dark:bg-[#161618] rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Cookie Policy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mb-8">
            Ai sensi dell’art. 122 D.Lgs. 196/2003 e Linee Guida Garante — Aggiornamento: giugno 2025
          </p>

          <Sec title="1. Cosa sono i cookie">
            <P>
              I cookie sono piccoli file di testo trasmessi dal server al browser dell’utente. Tecnologie
              simili come localStorage e sessionStorage svolgono funzioni analoghe ma archiviano dati
              esclusivamente nel browser locale, senza trasmissione HTTP automatica.
            </P>
          </Sec>

          <Sec title="2. Elementi di archiviazione utilizzati da Timbry">
            <P>
              La piattaforma Timbry <strong>non utilizza cookie HTTP</strong> di alcun tipo (tecnici,
              analitici, di profilazione o di terze parti).
            </P>
            <P>Viene utilizzato esclusivamente il <strong>localStorage</strong> del browser per:</P>
            <div className="overflow-x-auto mb-3">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50">
                    <th className="text-left px-3 py-2 text-zinc-600 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-700">Chiave</th>
                    <th className="text-left px-3 py-2 text-zinc-600 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-700">Contenuto</th>
                    <th className="text-left px-3 py-2 text-zinc-600 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-700">Scopo</th>
                    <th className="text-left px-3 py-2 text-zinc-600 dark:text-zinc-400 font-semibold border-b border-zinc-200 dark:border-zinc-700">Durata</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800/50">token</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">JWT di autenticazione</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">Mantenimento della sessione utente</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">Fino al logout</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800/50">user</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">Username e ruolo</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">Routing post-login in base al ruolo</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">Fino al logout</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300">theme</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">Preferenza tema (light/dark)</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">Personalizzazione visiva</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">Persistente (fino a reset)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <P>
              Il localStorage è accessibile <strong>esclusivamente dalla presente applicazione</strong>,
              non viene trasmesso ad alcun server di terze parti e non richiede consenso ai sensi
              dell’art. 122, co. 1, D.Lgs. 196/2003 (strettamente necessario alla fornitura del servizio).
            </P>
          </Sec>

          <Sec title="3. Cookie di terze parti">
            <P>
              La piattaforma non include tracker, pixel di retargeting, widget social o analytics esterni.
              Non vengono impostati cookie di terze parti.
            </P>
          </Sec>

          <Sec title="4. Come cancellare il localStorage">
            <P>
              Puoi cancellare il localStorage dalle impostazioni del tuo browser (Strumenti →
              Sviluppatore → Applicazione → Storage locale → Cancella). L’eliminazione comporta la
              disconnessione automatica dalla piattaforma.
            </P>
          </Sec>

          <Sec title="5. Modifiche">
            <P>
              La presente Cookie Policy sarà aggiornata in caso di introduzione di nuovi servizi (es.
              analytics, Stripe.js). La versione aggiornata sarà disponibile a questo indirizzo.
            </P>
          </Sec>

          <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-4 text-xs sm:text-sm text-zinc-400">
            <Link to="/privacy" className="hover:text-zinc-600 dark:hover:text-zinc-200 transition">
              Privacy Policy
            </Link>
            <span>·</span>
            <span>© 2025 Timbry</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sec({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm sm:text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        {title}
      </h2>
      {children}
    </div>
  );
}

function P({ children }) {
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-2">{children}</p>
  );
}
