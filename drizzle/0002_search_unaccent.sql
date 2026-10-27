-- Accent-insensitive, lower-cased text for search ("Réglages" matches "reglages").
-- Pure SQL so it works on Supabase and on PGlite without the unaccent extension,
-- and IMMUTABLE so it can feed generated tsvector columns and indexes.
CREATE OR REPLACE FUNCTION public.cockpit_unaccent(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = ''
AS $$
  SELECT replace(replace(
    pg_catalog.translate(
      pg_catalog.lower(input),
      'àáâãäåāçćčèéêëēėęîïíīįìñńôöòóøōõśšûüùúūýÿžźż',
      'aaaaaaaccceeeeeeeiiiiiinnooooooossuuuuuyyzzz'
    ),
    'œ', 'oe'), 'æ', 'ae');
$$;
