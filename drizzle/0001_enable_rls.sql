-- Enable row-level security on every table in the public schema.
-- On Supabase, public tables are reachable through the Data API with the anon
-- key; RLS with no policies denies that path entirely. The app connects as the
-- table owner, which RLS does not restrict.
-- New tables need the same: add `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` to
-- their migration (or re-run this block in a new one).
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END
$$;
