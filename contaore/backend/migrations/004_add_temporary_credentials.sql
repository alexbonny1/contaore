-- Add temporary credentials tracking to user_account table
ALTER TABLE user_account
ADD COLUMN IF NOT EXISTS is_temporary_credentials boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS temporary_credentials_used_at timestamptz DEFAULT null;

-- Comment for clarity
COMMENT ON COLUMN user_account.is_temporary_credentials IS 'When true, credentials work only on first login then auto-expire';
COMMENT ON COLUMN user_account.temporary_credentials_used_at IS 'Timestamp when temporary credentials were first used (marks them as expired)';
