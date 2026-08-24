/* =========================================================
   supabase-config.js — Supabase project connection details.

   Safe to commit: this is the public "publishable" (anon) key,
   not the database password. It only works within the limits of
   the Row Level Security policies set up on the project (see
   schema.sql notes in the README) — currently: anyone can insert
   a submission and anyone can read submissions/files, nothing
   more. Never put the DATABASE_URL / service-role key here.
   ========================================================= */

const SUPABASE_URL = 'https://cjuwkxvmhfqdpithgoxs.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_zZf0Pd9IIs0FuPnB9449jA_XZLMxUMz';
const SUPABASE_DOCUMENTS_BUCKET = 'documents';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
