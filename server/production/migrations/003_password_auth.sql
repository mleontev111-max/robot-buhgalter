CREATE TABLE password_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE sessions
  ADD COLUMN user_agent_hash text,
  ADD COLUMN ip_prefix text;

CREATE INDEX sessions_user_active_idx
  ON sessions (user_id, expires_at) WHERE revoked_at IS NULL;

CREATE POLICY organizations_initial_bootstrap_insert ON organizations FOR INSERT
  WITH CHECK (NOT EXISTS (SELECT 1 FROM users));

CREATE OR REPLACE FUNCTION bootstrap_initial_owner(
  bootstrap_email text,
  bootstrap_display_name text,
  bootstrap_legal_form text,
  bootstrap_organization_name text,
  bootstrap_password_hash text
)
RETURNS TABLE (user_id uuid, organization_id uuid)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  created_user_id uuid;
  created_organization_id uuid;
BEGIN
  LOCK TABLE users IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM users) THEN
    RAISE EXCEPTION 'Bootstrap refused: users already exist';
  END IF;

  INSERT INTO organizations (legal_form, name)
  VALUES (bootstrap_legal_form, bootstrap_organization_name)
  RETURNING id INTO created_organization_id;

  INSERT INTO users (email, display_name)
  VALUES (lower(bootstrap_email), bootstrap_display_name)
  RETURNING id INTO created_user_id;

  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (created_organization_id, created_user_id, 'owner');

  INSERT INTO password_credentials (user_id, password_hash)
  VALUES (created_user_id, bootstrap_password_hash);

  RETURN QUERY SELECT created_user_id, created_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION bootstrap_initial_owner(text, text, text, text, text) FROM PUBLIC;
