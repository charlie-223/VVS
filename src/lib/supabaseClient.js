import { createClient } from '@supabase/supabase-js'

// Read values from Vite env. Prefer .env variables over committing keys.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || null
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0eHFvdHJ0YWtrZmZtd3pxY3JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjU3ODksImV4cCI6MjA5MDA0MTc4OX0.MSHcOIFDY15rNCavBoISt4LHbhp-QRMMOEd5E0huZ_w"
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0eHFvdHJ0YWtrZmZtd3pxY3JxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDQ2NTc4OSwiZXhwIjoyMDkwMDQxNzg5fQ.moqRhdVlDSRnSWzlPMO0S9_VdoHjY24xcfc07kcjWZw"

// Determine the site URL based on environment
const siteUrl = import.meta.env.PROD
  ? 'https://shobe-printing-services.vercel.app'
  : 'http://localhost:5174'

// Create regular client for normal operations
export const supabase = (SUPABASE_URL && SUPABASE_ANON_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storage: window?.localStorage,
        storageKey: 'sb-auth-token',
        redirectTo: siteUrl
      }
    })
  : null

// Create admin client with service role key for admin operations
export const supabaseAdmin = SUPABASE_URL
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

export default supabase
