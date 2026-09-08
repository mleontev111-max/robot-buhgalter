GRANT CONNECT ON DATABASE robot_buhgalter TO robot_buhgalter_app;
GRANT USAGE ON SCHEMA public TO robot_buhgalter_app;
GRANT SELECT ON users, organization_memberships, sessions, password_credentials TO robot_buhgalter_app;
GRANT INSERT ON sessions TO robot_buhgalter_app;
GRANT UPDATE (last_seen_at, revoked_at) ON sessions TO robot_buhgalter_app;
GRANT SELECT ON organizations TO robot_buhgalter_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON
  tax_registrations,
  business_units,
  business_unit_tax_registrations,
  sales_channels,
  marketplace_accounts,
  import_batches,
  operations,
  tax_payments,
  sync_runs
TO robot_buhgalter_app;
GRANT SELECT, INSERT ON audit_events TO robot_buhgalter_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO robot_buhgalter_app;
GRANT EXECUTE ON FUNCTION app_user_id(), app_can_access(uuid, boolean) TO robot_buhgalter_app;
