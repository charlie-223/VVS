// Re-export the admin/service client from the single source in `src/lib/supabaseClient.js`.
// This prevents creating multiple Supabase clients (and multiple GoTrueClient instances)
// in the browser context which can cause logout/auth issues.
export { supabaseAdmin } from '../lib/supabaseClient.js'
