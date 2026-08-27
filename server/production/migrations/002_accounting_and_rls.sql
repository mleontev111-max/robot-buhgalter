CREATE TABLE tax_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  regime text NOT NULL CHECK (regime IN ('usn6', 'usn15', 'npd', 'psn', 'osno')),
  valid_from date NOT NULL,
  valid_to date,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit_type text NOT NULL,
  address text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id)
);

CREATE TABLE business_unit_tax_registrations (
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_unit_id uuid NOT NULL,
  tax_registration_id uuid NOT NULL,
  PRIMARY KEY (organization_id, business_unit_id, tax_registration_id),
  FOREIGN KEY (organization_id, business_unit_id)
    REFERENCES business_units(organization_id, id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id, tax_registration_id)
    REFERENCES tax_registrations(organization_id, id) ON DELETE CASCADE
);

ALTER TABLE sales_channels
  ADD COLUMN business_unit_id uuid,
  ADD COLUMN channel_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN source_type text NOT NULL DEFAULT 'manual',
  ADD CONSTRAINT sales_channels_business_unit_fk
    FOREIGN KEY (organization_id, business_unit_id)
    REFERENCES business_units(organization_id, id) ON DELETE RESTRICT;

CREATE TABLE import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  sales_channel_id uuid,
  source_type text NOT NULL,
  source_filename text,
  source_sha256 text,
  status text NOT NULL CHECK (status IN ('pending', 'validated', 'imported', 'failed')),
  row_count integer NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  error_summary text,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, sales_channel_id)
    REFERENCES sales_channels(organization_id, id) ON DELETE RESTRICT
);

CREATE TABLE operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_unit_id uuid NOT NULL,
  sales_channel_id uuid NOT NULL,
  tax_registration_id uuid NOT NULL,
  import_batch_id uuid,
  source_type text NOT NULL,
  external_operation_id text,
  operation_date date NOT NULL,
  revenue numeric(18,2) NOT NULL DEFAULT 0,
  commission numeric(18,2) NOT NULL DEFAULT 0,
  logistics numeric(18,2) NOT NULL DEFAULT 0,
  ads numeric(18,2) NOT NULL DEFAULT 0,
  other_expenses numeric(18,2) NOT NULL DEFAULT 0,
  currency char(3) NOT NULL DEFAULT 'RUB',
  note text,
  source_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, business_unit_id)
    REFERENCES business_units(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, sales_channel_id)
    REFERENCES sales_channels(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, tax_registration_id)
    REFERENCES tax_registrations(organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, import_batch_id)
    REFERENCES import_batches(organization_id, id) ON DELETE SET NULL (import_batch_id)
);
CREATE UNIQUE INDEX operations_external_idempotency_idx
  ON operations (organization_id, sales_channel_id, source_type, external_operation_id)
  WHERE external_operation_id IS NOT NULL;
CREATE INDEX operations_org_date_idx ON operations (organization_id, operation_date);

CREATE TABLE tax_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tax_registration_id uuid,
  payment_kind text NOT NULL,
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  paid_at date NOT NULL,
  obligation_id text,
  source_type text NOT NULL DEFAULT 'manual',
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, tax_registration_id)
    REFERENCES tax_registrations(organization_id, id) ON DELETE RESTRICT
);
CREATE INDEX tax_payments_org_paid_idx ON tax_payments (organization_id, paid_at);

CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
LANGUAGE sql STABLE
RETURN nullif(current_setting('app.user_id', true), '')::uuid;

CREATE OR REPLACE FUNCTION app_can_access(target_organization_id uuid, write_access boolean DEFAULT false)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
RETURN EXISTS (
  SELECT 1
  FROM organization_memberships membership
  JOIN users app_user ON app_user.id = membership.user_id AND app_user.status = 'active'
  WHERE membership.user_id = app_user_id()
    AND membership.organization_id = target_organization_id
    AND (NOT write_access OR membership.role IN ('owner', 'accountant'))
);

REVOKE ALL ON FUNCTION app_can_access(uuid, boolean) FROM PUBLIC;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations FORCE ROW LEVEL SECURITY;
CREATE POLICY organizations_read ON organizations FOR SELECT
  USING (app_can_access(id));
CREATE POLICY organizations_write ON organizations FOR UPDATE
  USING (app_can_access(id, true)) WITH CHECK (app_can_access(id, true));

ALTER TABLE tax_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_registrations FORCE ROW LEVEL SECURITY;
CREATE POLICY tax_registrations_read ON tax_registrations FOR SELECT USING (app_can_access(organization_id));
CREATE POLICY tax_registrations_write ON tax_registrations FOR ALL
  USING (app_can_access(organization_id, true)) WITH CHECK (app_can_access(organization_id, true));

ALTER TABLE business_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_units FORCE ROW LEVEL SECURITY;
CREATE POLICY business_units_read ON business_units FOR SELECT USING (app_can_access(organization_id));
CREATE POLICY business_units_write ON business_units FOR ALL
  USING (app_can_access(organization_id, true)) WITH CHECK (app_can_access(organization_id, true));

ALTER TABLE business_unit_tax_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_unit_tax_registrations FORCE ROW LEVEL SECURITY;
CREATE POLICY business_unit_tax_registrations_read ON business_unit_tax_registrations FOR SELECT USING (app_can_access(organization_id));
CREATE POLICY business_unit_tax_registrations_write ON business_unit_tax_registrations FOR ALL
  USING (app_can_access(organization_id, true)) WITH CHECK (app_can_access(organization_id, true));

ALTER TABLE sales_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_channels FORCE ROW LEVEL SECURITY;
CREATE POLICY sales_channels_read ON sales_channels FOR SELECT USING (app_can_access(organization_id));
CREATE POLICY sales_channels_write ON sales_channels FOR ALL
  USING (app_can_access(organization_id, true)) WITH CHECK (app_can_access(organization_id, true));

ALTER TABLE marketplace_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_accounts FORCE ROW LEVEL SECURITY;
CREATE POLICY marketplace_accounts_read ON marketplace_accounts FOR SELECT USING (app_can_access(organization_id));
CREATE POLICY marketplace_accounts_write ON marketplace_accounts FOR ALL
  USING (app_can_access(organization_id, true)) WITH CHECK (app_can_access(organization_id, true));

ALTER TABLE import_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_batches FORCE ROW LEVEL SECURITY;
CREATE POLICY import_batches_read ON import_batches FOR SELECT USING (app_can_access(organization_id));
CREATE POLICY import_batches_write ON import_batches FOR ALL
  USING (app_can_access(organization_id, true)) WITH CHECK (app_can_access(organization_id, true));

ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations FORCE ROW LEVEL SECURITY;
CREATE POLICY operations_read ON operations FOR SELECT USING (app_can_access(organization_id));
CREATE POLICY operations_write ON operations FOR ALL
  USING (app_can_access(organization_id, true)) WITH CHECK (app_can_access(organization_id, true));

ALTER TABLE tax_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY tax_payments_read ON tax_payments FOR SELECT USING (app_can_access(organization_id));
CREATE POLICY tax_payments_write ON tax_payments FOR ALL
  USING (app_can_access(organization_id, true)) WITH CHECK (app_can_access(organization_id, true));

ALTER TABLE sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_runs FORCE ROW LEVEL SECURITY;
CREATE POLICY sync_runs_read ON sync_runs FOR SELECT USING (app_can_access(organization_id));
CREATE POLICY sync_runs_write ON sync_runs FOR ALL
  USING (app_can_access(organization_id, true)) WITH CHECK (app_can_access(organization_id, true));

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_events_read ON audit_events FOR SELECT USING (app_can_access(organization_id));
CREATE POLICY audit_events_insert ON audit_events FOR INSERT WITH CHECK (app_can_access(organization_id, true));
