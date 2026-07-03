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
              La piattaforma Timbry <strong>non utilizza cookie HTTP</strong> tecnici o di profilazione.
              Utilizza invece <strong>PostHog</strong>, uno strumento di analisi del comportamento degli
              utenti (pagine visitate, azioni compiute nell'app, registrazione della sessione con i campi
              di testo oscurati), ospitato su server europei. PostHog viene attivato solo se dai il
              consenso tramite il banner che compare al primo accesso — se rifiuti, o finché non scegli,
              resta disattivato e non raccoglie alcun dato.
            </P>
            <P>Viene inoltre utilizzato il <strong>localStorage</strong> del browser per:</P>
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
                    <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800/50">theme</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">Preferenza tema (light/dark)</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">Personalizzazione visiva</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">Persistente (fino a reset)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300 border-b border-zinc-100 dark:border-zinc-800/50">timbry_chart_prefs</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">Preferenze di visualizzazione dei grafici</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">Personalizzazione visiva</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800/50">Persistente (fino a reset)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-zinc-700 dark:text-zinc-300">cookie_consent</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">Scelta fatta sul banner (accettato/rifiutato)</td>
                    <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">Ricordare la scelta sulle analitiche</td>
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
              La piattaforma non include pixel di retargeting o widget social. Non vengono impostati
              cookie HTTP di terze parti. È presente <strong>PostHog</strong> (vedi sezione 2), che salva
              i propri dati tecnici nel localStorage del browser anziché in un cookie HTTP tradizionale, e
              solo dopo il tuo consenso. È inoltre presente <strong>Twilio</strong>, usato dal server per
              inviare SMS/WhatsApp con il codice di verifica quando l'autenticazione a due fattori è
              attiva: non installa nulla nel tuo browser, riceve solo il numero di telefono al momento
              dell'invio.
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
              Aggiornamento di luglio 2026: introdotto PostHog per le analitiche di utilizzo, attivabile
              solo con consenso esplicito. La presente Cookie Policy sarà aggiornata anche in futuro in
              caso di introduzione di nuovi servizi (es. Stripe.js per i pagamenti). La versione
              aggiornata sarà disponibile a questo indirizzo.
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
