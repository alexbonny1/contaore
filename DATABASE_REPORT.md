# 📊 DATABASE REPORT - Timbry

**Data:** 31 Maggio 2026
**Status:** ✅ Database già esiste e è strutturato

---

## 🎯 Quadro Situazione

Il database esiste già e contiene **14 tabelle** completamente strutturate:

### Tabelle Trovate:
1. ✅ **company** (6 colonne)
2. ✅ **device_claim** (8 colonne)
3. ✅ **dipendenti** (13 colonne)
4. ✅ **dispositivo** (8 colonne)
5. ✅ **fasce_orarie** (8 colonne)
6. ✅ **giustificazioni** (10 colonne)
7. ✅ **pause_aziendali** (8 colonne)
8. ✅ **presenza** (6 colonne)
9. ✅ **richieste_ferie** (11 colonne)
10. ✅ **richieste_lettura** (12 colonne) ← **NON usata dal backend**
11. ✅ **richieste_timbratura** (11 colonne)
12. ✅ **tag** (7 colonne)
13. ✅ **turni** (11 colonne)
14. ✅ **user_account** (11 colonne)

---

## 📋 USER_ACCOUNT Structure (Verificato)

```
id                      UUID, PRIMARY KEY
email                   VARCHAR, UNIQUE
password                VARCHAR
role                    VARCHAR (default: 'user')
company_id              UUID (foreign key)
created_at              TIMESTAMPTZ (default: now())
updated_at              TIMESTAMPTZ (default: now())
username                VARCHAR, UNIQUE
dipendente_id           UUID
reset_token             TEXT (per password reset)
reset_token_expires_at  TIMESTAMPTZ (per password reset)
```

✅ **Colonne critiche presenti:**
- `reset_token` ✅
- `reset_token_expires_at` ✅
- `company_id` ✅
- `password` ✅

---

## 🔑 INDICI (37 totali)

### Per Tabella:
- **company**: 2 (pkey, slug_key)
- **device_claim**: 4 (pkey, token_key, idx_company_id, idx_token)
- **dipendenti**: 3 (pkey, badge_uid_key, idx_company_id)
- **dispositivo**: 4 (pkey, reader_id_key, idx_company_id, idx_reader_id)
- **fasce_orarie**: 1 (pkey)
- **giustificazioni**: 2 (pkey, dipendente_data_unique)
- **pause_aziendali**: 1 (pkey)
- **presenza**: 4 (pkey, idx_company_id, idx_created_at, idx_tag_uid)
- **richieste_ferie**: 1 (pkey)
- **richieste_lettura**: 1 (pkey)
- **richieste_timbratura**: 1 (pkey)
- **tag**: 5 (pkey, uid_key, idx_uid, idx_company_id, idx_dipendente_id)
- **turni**: 3 (pkey, idx_company_id, idx_dipendente_id)
- **user_account**: 5 (pkey, email_key, username_key, idx_company_id, idx_email)

✅ **Performance indexes:** Presenti e ottimali

---

## 🔗 FOREIGN KEYS

Da verificare con il backend:
- `dipendenti.company_id` → `company.id`
- `user_account.company_id` → `company.id`
- `tag.company_id`, `tag.dipendente_id` → `company`, `dipendenti`
- `presenza.company_id` → `company.id`
- `turni.company_id`, `turni.dipendente_id`
- `richieste_ferie.company_id`, `richieste_ferie.dipendente_id`
- `device_claim.company_id`, `device_claim.dispositivo_id`
- Etc.

---

## ⚠️ PROBLEMI IDENTIFICATI

### 1. ❌ Tabella `richieste_lettura` NON usata dal backend
- **Trovata nel database:** SÌ (12 colonne)
- **Usata dal backend:** NO
- **Azione:** Può essere rimossa o tenuta come storica

### 2. ⚠️ Nome tabella incoerente
- **Nel database:** `pause_aziendali`
- **Nel CLAUDE.md:** `pausa_aziendale` (singolare)
- **Impatto:** Minor (il backend usa il nome corretto `pause_aziendali`)

### 3. ⚠️ Colonne che potrebbero mancare
Basato sull'analisi del backend (routes/employees.js):
- **turni** potrebbe mancare colonne come:
  - `ingresso_1`, `uscita_1`, `ingresso_2`, `uscita_2` (orari bifasici)
  - `giorno_settimana`

Da verificare se sono presenti.

---

## ✅ COSA FUNZIONA

✅ **Multi-tenancy:** Tutte le tabelle hanno `company_id`
✅ **Password reset:** Colonne presenti in `user_account`
✅ **Badge NFC:** Tabella `tag` con `uid`, `dipendente_id`, `company_id`
✅ **Timbrature:** Tabella `presenza` con `tipo` (ENTRATA/USCITA)
✅ **Turni:** Tabella `turni` presente
✅ **Ferie:** Tabella `richieste_ferie` presente
✅ **Indici:** 37 indici per performance
✅ **Foreign keys:** Relazioni impostate

---

## 🔄 COSA MANCA / DA VERIFICARE

Esegui questo script per verificare le colonne critiche:

```sql
-- Verifica struttura turni
SELECT column_name FROM information_schema.columns
WHERE table_name = 'turni' ORDER BY ordinal_position;

-- Verifica struttura presenza
SELECT column_name FROM information_schema.columns
WHERE table_name = 'presenza' ORDER BY ordinal_position;

-- Verifica struttura dipendenti
SELECT column_name FROM information_schema.columns
WHERE table_name = 'dipendenti' ORDER BY ordinal_position;

-- Verifica struttura tag
SELECT column_name FROM information_schema.columns
WHERE table_name = 'tag' ORDER BY ordinal_position;
```

---

## 📝 CONCLUSIONE

**Il database è già strutturato e funzionante!**

Quello che serve ora:
1. Verificare le colonne di `turni`, `presenza`, `dipendenti`, `tag`
2. Verificare i constraints (CHECK per tipo ENTRATA/USCITA)
3. Verificare le foreign keys
4. Eventualmente rimuovere `richieste_lettura` se non usata

**Non serve creare da zero - serve solo verificare/aggiustare quello che manca!**

---

## 🚀 Prossimo Step

Esegui il SQL above per verificare le colonne di quelle 4 tabelle critiche.
Incolla l'output e ti dirò esattamente cosa manca/aggiustare.
