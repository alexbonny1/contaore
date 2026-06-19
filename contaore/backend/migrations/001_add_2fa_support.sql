-- Migration: Add 2FA Support to Contaore
-- Date: 2026-06-18
-- Purpose: Add columns for 2FA and create tracking table for 2FA attempts
-- Safety: Uses IF NOT EXISTS - idempotent, safe to run multiple times, no data deletion

-- ============================================================================
-- 1. Extend user_account table with 2FA columns
-- ============================================================================

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS phone_number varchar(20);

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS two_factor_method varchar(10) DEFAULT 'email';
  -- Allowed values: 'email', 'sms', 'whatsapp'

-- ============================================================================
-- 2. Create two_factor_attempts table for tracking 2FA verification attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS two_factor_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  code varchar(6) NOT NULL,
  method varchar(10) NOT NULL,
  -- Method: 'email', 'sms', 'whatsapp'
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '10 minutes',
  verified boolean DEFAULT false,
  attempts_count integer DEFAULT 0
);

-- Index per query veloci
CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user_expires
  ON two_factor_attempts(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user_verified
  ON two_factor_attempts(user_id, verified, expires_at);

-- ============================================================================
-- 3. Add columns for password reset (if not already present)
-- ============================================================================

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS reset_token text;

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;

-- Index per cercare token di reset
CREATE INDEX IF NOT EXISTS idx_user_account_reset_token
  ON user_account(reset_token);

-- ============================================================================
-- 4. Optional: Create audit log table for 2FA events (for security tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS two_factor_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  event_type varchar(50) NOT NULL,
  -- Event types: 'login_2fa_sent', 'login_2fa_verified', 'login_2fa_failed',
  --              'reset_2fa_sent', 'reset_2fa_verified', 'reset_2fa_failed',
  --              'method_changed', '2fa_enabled', '2fa_disabled'
  method varchar(10),
  -- 'email', 'sms', 'whatsapp'
  ip_address inet,
  user_agent text,
  status varchar(20),
  -- 'success', 'failed', 'expired', 'rate_limited'
  error_reason text,
  created_at timestamptz DEFAULT now()
);

-- Index per ricerche audit
CREATE INDEX IF NOT EXISTS idx_two_factor_audit_user_date
  ON two_factor_audit(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_two_factor_audit_event_type
  ON two_factor_audit(event_type, created_at);

-- ============================================================================
-- 5. Data preservation check (read-only)
-- ============================================================================

-- Verify no data was deleted during migration
-- SELECT COUNT(*) as total_users FROM user_account;
-- Expected: Same count before and after migration

-- ============================================================================
-- Migration Status: COMPLETE
-- All changes are additive (no columns deleted, no data modified)
-- Safe to rollback by dropping the new tables and columns if needed
-- ============================================================================
