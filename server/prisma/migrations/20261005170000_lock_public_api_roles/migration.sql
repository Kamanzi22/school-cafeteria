-- Supabase gives its public API roles (anon, authenticated) full access to every table in the
-- public schema, and new tables get the same automatically. This app never uses those roles:
-- the browser talks only to our API, and the API connects as the tables' owner. Left as it was,
-- anyone holding the project's public key could read every table through Supabase's Data API,
-- password hashes included.
--
--  1. Row level security on every table, with no policies. The table owner (the API's login) is
--     not affected; any other role sees nothing.
--  2. Take away the public API roles' access to everything here, now and for tables added later.
--
-- On a plain local Postgres those roles don't exist, so step 2 is skipped there.
DO $$
DECLARE
  t text;
  r text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;

  FOREACH r IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', r);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', r);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %I', r);
    END IF;
  END LOOP;
END $$;
