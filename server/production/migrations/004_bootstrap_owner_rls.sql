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
  created_user_id uuid := gen_random_uuid();
  created_organization_id uuid := gen_random_uuid();
BEGIN
  LOCK TABLE users IN EXCLUSIVE MODE;
  IF EXISTS (SELECT 1 FROM users) THEN
    RAISE EXCEPTION 'Bootstrap refused: users already exist';
  END IF;

  -- Generate IDs before INSERT. INSERT ... RETURNING on an RLS table also applies
  -- the SELECT policy, but no membership can exist until both rows are present.
  INSERT INTO organizations (id, legal_form, name)
  VALUES (created_organization_id, bootstrap_legal_form, bootstrap_organization_name);

  INSERT INTO users (id, email, display_name)
  VALUES (created_user_id, lower(bootstrap_email), bootstrap_display_name);

  INSERT INTO organization_memberships (organization_id, user_id, role)
  VALUES (created_organization_id, created_user_id, 'owner');

  INSERT INTO password_credentials (user_id, password_hash)
  VALUES (created_user_id, bootstrap_password_hash);

  RETURN QUERY SELECT created_user_id, created_organization_id;
END;
$$;

REVOKE ALL ON FUNCTION bootstrap_initial_owner(text, text, text, text, text) FROM PUBLIC;
