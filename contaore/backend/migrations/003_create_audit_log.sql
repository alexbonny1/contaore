CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE SET NULL,

  action varchar(50) NOT NULL,
  resource_type varchar(50),
  resource_id uuid,

  old_state jsonb,
  new_state jsonb,

  ip_address inet,
  user_agent text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_log_company ON audit_log(company_id, created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action, created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);
