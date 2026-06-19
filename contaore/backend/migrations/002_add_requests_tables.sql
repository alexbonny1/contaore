-- Migration: Add Requests Tables for Permessi and Turni Modifications
-- Date: 2026-06-19
-- Purpose: Create tables for employee permission requests and shift modification requests
-- Safety: Uses IF NOT EXISTS - idempotent, safe to run multiple times

-- ============================================================================
-- 1. Create richieste_permessi table for permission requests (exit/entry)
-- ============================================================================

CREATE TABLE IF NOT EXISTS richieste_permessi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,

  -- Permission details
  data_uscita date,
  ora_uscita time,
  data_entrata date,
  ora_entrata time,
  tipo varchar(50) DEFAULT 'personale',
  -- Allowed: 'personale', 'medico', 'altro'

  motivo text NOT NULL,

  -- Status tracking
  stato varchar(20) DEFAULT 'in_attesa',
  -- Allowed: 'in_attesa', 'approvata', 'rifiutata'

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES user_account(id) ON DELETE SET NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_richieste_permessi_company
  ON richieste_permessi(company_id);

CREATE INDEX IF NOT EXISTS idx_richieste_permessi_dipendente
  ON richieste_permessi(dipendente_id);

CREATE INDEX IF NOT EXISTS idx_richieste_permessi_stato
  ON richieste_permessi(stato);

CREATE INDEX IF NOT EXISTS idx_richieste_permessi_created
  ON richieste_permessi(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_richieste_permessi_dipendente_stato
  ON richieste_permessi(dipendente_id, stato);

-- ============================================================================
-- 2. Create richieste_turni table for shift modification requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS richieste_turni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,

  -- Period and days affected
  data_dal date NOT NULL,
  data_al date NOT NULL,
  giorni varchar(255) NOT NULL,
  -- Comma-separated day names: 'lunedi,martedi,mercoledi,...'

  orari jsonb,
  -- JSON structure: { "lunedi": { "ingresso": "09:00", "uscita": "17:00" }, ... }

  motivo text NOT NULL,

  -- Status tracking
  stato varchar(20) DEFAULT 'in_attesa',
  -- Allowed: 'in_attesa', 'approvata', 'rifiutata'

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES user_account(id) ON DELETE SET NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_richieste_turni_company
  ON richieste_turni(company_id);

CREATE INDEX IF NOT EXISTS idx_richieste_turni_dipendente
  ON richieste_turni(dipendente_id);

CREATE INDEX IF NOT EXISTS idx_richieste_turni_stato
  ON richieste_turni(stato);

CREATE INDEX IF NOT EXISTS idx_richieste_turni_created
  ON richieste_turni(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_richieste_turni_dipendente_stato
  ON richieste_turni(dipendente_id, stato);

CREATE INDEX IF NOT EXISTS idx_richieste_turni_period
  ON richieste_turni(data_dal, data_al);

-- ============================================================================
-- Migration Status: COMPLETE
-- All changes are additive (creating new tables only)
-- Safe to rollback by dropping the tables if needed
-- ============================================================================
