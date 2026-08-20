/**
 * Fill these in from your Supabase project: Settings → API.
 * The anon key is safe to use in the browser — RLS protects user data.
 */
export const SUPABASE_URL = 'https://aasmkehntpplskqtrtaq.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_JwkehHlpAmHhnQMmbMVWpA_di5Hdd1a';

export function isSupabaseConfigured() {
  return (
    typeof SUPABASE_URL === 'string' &&
    SUPABASE_URL.startsWith('https://') &&
    !SUPABASE_URL.includes('YOUR_SUPABASE') &&
    typeof SUPABASE_ANON_KEY === 'string' &&
    SUPABASE_ANON_KEY.length > 20 &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE')
  );
}
