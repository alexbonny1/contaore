-- ═══════════════════════════════════════════════════════════════════════
-- SEED DEMO DATA — script di popolamento per demo/presentazioni
-- ═══════════════════════════════════════════════════════════════════════
--
-- NON è una migration: non viene eseguito da runMigrations.js. Va lanciato
-- a mano (Supabase Studio -> SQL Editor, oppure psql "$DATABASE_URL" -f ...)
-- su una company già esistente.
--
-- Cosa crea, per la company indicata in v_company_id:
--   - 10 dipendenti con badge_uid e turno standard lun-ven 09-13/14-18
--   - presenze (ENTRATA/USCITA) per gli ultimi 3 mesi, solo giorni feriali,
--     con orari leggermente variabili (ritardi, straordinari) e qualche
--     giorno "buco" o con timbratura dimenticata, per dati realistici
--   - richieste_ferie, richieste_permessi, giustificazioni e richieste_turni
--     per ciascun dipendente, con stato misto: 'approvata', 'in_attesa',
--     'rifiutata'
--
-- Le righe "approvata"/"rifiutata" vengono agganciate come approvatore al
-- primo utente owner/admin trovato per la company (se esiste), altrimenti
-- restano senza approvatore (colonna nullable).
--
-- Rieseguendo lo script si duplicano i dati (non è idempotente): pensato
-- per un ambiente demo/staging, non per produzione.
--
-- Per ripulire i dati demo prima di rilanciare lo script (es. dopo una
-- versione precedente con orari sfasati), scommenta ed esegui a parte,
-- SOSTITUENDO l'uuid con lo stesso v_company_id usato sotto:
--
-- DELETE FROM richieste_turni    WHERE dipendente_id IN (SELECT id FROM dipendenti WHERE company_id = '662e1425-e083-42b1-950f-d0ace2a7623c' AND badge_uid LIKE 'DEMO-BADGE-%');
-- DELETE FROM giustificazioni    WHERE dipendente_id IN (SELECT id FROM dipendenti WHERE company_id = '662e1425-e083-42b1-950f-d0ace2a7623c' AND badge_uid LIKE 'DEMO-BADGE-%');
-- DELETE FROM richieste_permessi WHERE dipendente_id IN (SELECT id FROM dipendenti WHERE company_id = '662e1425-e083-42b1-950f-d0ace2a7623c' AND badge_uid LIKE 'DEMO-BADGE-%');
-- DELETE FROM richieste_ferie    WHERE dipendente_id IN (SELECT id FROM dipendenti WHERE company_id = '662e1425-e083-42b1-950f-d0ace2a7623c' AND badge_uid LIKE 'DEMO-BADGE-%');
-- DELETE FROM turni              WHERE dipendente_id IN (SELECT id FROM dipendenti WHERE company_id = '662e1425-e083-42b1-950f-d0ace2a7623c' AND badge_uid LIKE 'DEMO-BADGE-%');
-- DELETE FROM presenza           WHERE company_id = '662e1425-e083-42b1-950f-d0ace2a7623c' AND tag_uid LIKE 'DEMO-BADGE-%';
-- DELETE FROM dipendenti         WHERE company_id = '662e1425-e083-42b1-950f-d0ace2a7623c' AND badge_uid LIKE 'DEMO-BADGE-%';
-- ═══════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  v_company_id  uuid := '662e1425-e083-42b1-950f-d0ace2a7623c';
  v_owner_id    uuid;
  v_dip_id      uuid;
  v_nomi        text[] := ARRAY['Marco','Giulia','Luca','Francesca','Andrea','Chiara','Davide','Sara','Matteo','Elena'];
  v_cognomi     text[] := ARRAY['Rossi','Bianchi','Colombo','Ferrari','Russo','Romano','Gallo','Conti','Esposito','Ricci'];
  v_badge       text;
  i             int;
  d             date;
  v_dow         int;
  v_jitter_in   int;
  v_jitter_out  int;
  v_skip_day    boolean;
  v_incomplete  boolean;
  v_turno_stato text;
BEGIN
  -- Owner/admin della company, usato come approvatore delle richieste (opzionale)
  SELECT id INTO v_owner_id
  FROM user_account
  WHERE company_id = v_company_id AND role IN ('owner', 'admin')
  ORDER BY (role = 'owner') DESC
  LIMIT 1;

  FOR i IN 1..10 LOOP
    v_badge := 'DEMO-BADGE-' || lpad(i::text, 2, '0');

    -- ── Anagrafica dipendente ────────────────────────────────────────
    INSERT INTO dipendenti (
      company_id, nome, cognome, badge_uid, email,
      turni_attivi, turni_attivati_il, data_inizio
    )
    VALUES (
      v_company_id, v_nomi[i], v_cognomi[i], v_badge,
      lower(v_nomi[i] || '.' || v_cognomi[i] || '@demo-timbry.it'),
      true, now() - interval '6 months', CURRENT_DATE - interval '6 months'
    )
    RETURNING id INTO v_dip_id;

    -- ── Turno standard lun-ven 09:00-13:00 / 14:00-18:00 ────────────
    INSERT INTO turni (company_id, dipendente_id, turno_nome, giorno_settimana, ingresso_1, uscita_1, ingresso_2, uscita_2)
    SELECT v_company_id, v_dip_id, 'Standard', gg, '09:00', '13:00', '14:00', '18:00'
    FROM unnest(ARRAY['lunedi', 'martedi', 'mercoledi', 'giovedi', 'venerdi']) AS gg;

    -- ── Presenze ultimi 3 mesi (solo giorni feriali) ────────────────
    FOR d IN
      SELECT generate_series(CURRENT_DATE - interval '3 months', CURRENT_DATE - interval '1 day', interval '1 day')::date
    LOOP
      v_dow := extract(dow FROM d)::int;
      CONTINUE WHEN v_dow IN (0, 6); -- salta sabato/domenica

      v_skip_day := random() < 0.04; -- ~4% giorni completamente assenti
      CONTINUE WHEN v_skip_day;

      v_incomplete := random() < 0.03; -- ~3% giorni con uscita pomeridiana dimenticata
      v_jitter_in  := (random() * 12)::int - 3;  -- entrata ~08:57-09:09
      v_jitter_out := (random() * 40)::int - 10; -- uscita ~17:50-18:30 (straordinari vari)

      -- I timestamp vengono calcolati come ora locale Europe/Rome e convertiti in
      -- timestamptz con AT TIME ZONE: un timestamp "naive" (es. d + time '09:00')
      -- verrebbe interpretato nel timezone di sessione di Postgres (in genere UTC),
      -- sfasando entrata/uscita di 1-2 ore rispetto ai turni (CET/CEST).
      INSERT INTO presenza (company_id, tag_uid, reader_id, tipo, manuale, automatica, "timestamp", created_at)
      VALUES (
        v_company_id, v_badge, 'DEMO-READER-01', 'ENTRATA', false, true,
        (d + time '09:00' + (v_jitter_in || ' minutes')::interval) AT TIME ZONE 'Europe/Rome',
        (d + time '09:00' + (v_jitter_in || ' minutes')::interval) AT TIME ZONE 'Europe/Rome'
      );

      INSERT INTO presenza (company_id, tag_uid, reader_id, tipo, manuale, automatica, "timestamp", created_at)
      VALUES (
        v_company_id, v_badge, 'DEMO-READER-01', 'USCITA', false, true,
        (d + time '13:00') AT TIME ZONE 'Europe/Rome', (d + time '13:00') AT TIME ZONE 'Europe/Rome'
      );

      IF NOT v_incomplete THEN
        INSERT INTO presenza (company_id, tag_uid, reader_id, tipo, manuale, automatica, "timestamp", created_at)
        VALUES (
          v_company_id, v_badge, 'DEMO-READER-01', 'ENTRATA', false, true,
          (d + time '14:00') AT TIME ZONE 'Europe/Rome', (d + time '14:00') AT TIME ZONE 'Europe/Rome'
        );

        INSERT INTO presenza (company_id, tag_uid, reader_id, tipo, manuale, automatica, "timestamp", created_at)
        VALUES (
          v_company_id, v_badge, 'DEMO-READER-01', 'USCITA', false, true,
          (d + time '18:00' + (v_jitter_out || ' minutes')::interval) AT TIME ZONE 'Europe/Rome',
          (d + time '18:00' + (v_jitter_out || ' minutes')::interval) AT TIME ZONE 'Europe/Rome'
        );
      END IF;
    END LOOP;

    -- ── Richieste ferie: approvata (passata), in attesa (futura), rifiutata (1 dip. su 3) ──
    INSERT INTO richieste_ferie (company_id, dipendente_id, data_inizio, data_fine, note, stato, approvato_da, approvato_il)
    VALUES (v_company_id, v_dip_id, CURRENT_DATE - interval '45 days', CURRENT_DATE - interval '40 days', 'Ferie estive', 'approvata', v_owner_id, now() - interval '50 days');

    INSERT INTO richieste_ferie (company_id, dipendente_id, data_inizio, data_fine, note, stato)
    VALUES (v_company_id, v_dip_id, CURRENT_DATE + interval '10 days', CURRENT_DATE + interval '15 days', 'Ferie estive', 'in_attesa');

    IF i % 3 = 0 THEN
      INSERT INTO richieste_ferie (company_id, dipendente_id, data_inizio, data_fine, note, stato, approvato_da, approvato_il)
      VALUES (v_company_id, v_dip_id, CURRENT_DATE + interval '3 days', CURRENT_DATE + interval '5 days', 'Ponte', 'rifiutata', v_owner_id, now());
    END IF;

    -- ── Richieste permessi: approvata (passata), in attesa (futura), rifiutata (1 dip. su 2) ──
    INSERT INTO richieste_permessi (company_id, dipendente_id, data_uscita, ora_uscita, tipo, motivo, stato, approved_at, approved_by)
    VALUES (v_company_id, v_dip_id, CURRENT_DATE - interval '20 days', '12:00', 'medico', 'Visita medica', 'approvata', now() - interval '19 days', v_owner_id);

    INSERT INTO richieste_permessi (company_id, dipendente_id, data_uscita, ora_uscita, tipo, motivo, stato)
    VALUES (v_company_id, v_dip_id, CURRENT_DATE + interval '4 days', '16:00', 'personale', 'Impegno personale', 'in_attesa');

    IF i % 2 = 0 THEN
      INSERT INTO richieste_permessi (company_id, dipendente_id, data_uscita, ora_uscita, tipo, motivo, stato, approved_at, approved_by)
      VALUES (v_company_id, v_dip_id, CURRENT_DATE - interval '5 days', '15:00', 'altro', 'Motivi familiari', 'rifiutata', now() - interval '4 days', v_owner_id);
    END IF;

    -- ── Giustificazioni: una approvata, poi a rotazione rifiutata/in attesa ──
    INSERT INTO giustificazioni (company_id, dipendente_id, data, motivo, stato, approvato_da, approvato_il)
    VALUES (v_company_id, v_dip_id, CURRENT_DATE - interval '15 days', 'Ritardo mezzi pubblici', 'approvata', v_owner_id, now() - interval '14 days');

    IF i % 3 = 1 THEN
      INSERT INTO giustificazioni (company_id, dipendente_id, data, motivo, stato, approvato_da, approvato_il)
      VALUES (v_company_id, v_dip_id, CURRENT_DATE - interval '8 days', 'Dimenticanza timbratura', 'rifiutata', v_owner_id, now() - interval '7 days');
    ELSE
      INSERT INTO giustificazioni (company_id, dipendente_id, data, motivo, stato)
      VALUES (v_company_id, v_dip_id, CURRENT_DATE - interval '2 days', 'Problema al badge', 'in_attesa');
    END IF;

    -- ── Richieste turni: orario ridotto, stato a rotazione ──
    v_turno_stato := CASE i % 4 WHEN 0 THEN 'rifiutata' WHEN 1 THEN 'approvata' ELSE 'in_attesa' END;

    INSERT INTO richieste_turni (
      company_id, dipendente_id, data_dal, data_al, giorni, orari, motivo, stato,
      approved_at, approved_by
    )
    VALUES (
      v_company_id, v_dip_id, CURRENT_DATE + interval '7 days', CURRENT_DATE + interval '30 days',
      'lunedi,mercoledi,venerdi',
      '{"lunedi":{"ingresso":"08:00","uscita":"16:00"},"mercoledi":{"ingresso":"08:00","uscita":"16:00"},"venerdi":{"ingresso":"08:00","uscita":"16:00"}}',
      'Richiesta orario ridotto per motivi familiari',
      v_turno_stato,
      CASE WHEN v_turno_stato != 'in_attesa' THEN now() ELSE NULL END,
      CASE WHEN v_turno_stato != 'in_attesa' THEN v_owner_id ELSE NULL END
    );

  END LOOP;
END $$;

COMMIT;
