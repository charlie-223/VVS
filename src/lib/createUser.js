import { supabaseAdmin } from './supabaseClient'

// inviteUser: generate a Supabase signup link for the provided user info.
// This does NOT create the auth user — the account will be created once
// the recipient completes the signup flow via the emailed link.
export async function inviteUser({ email, username, role, createdBy, password }, options = {}) {
  if (!supabaseAdmin) return { data: null, error: new Error('Supabase admin not configured') }
  try {
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: options.redirectTo || (import.meta.env.PROD ? 'https://shobe-printing-services.vercel.app/confirm' : 'http://localhost:5174/confirm'),
        data: { username, role, createdBy }
      }
    })

    // Hide the full link in logs in case of production
    try { console.log('[inviteUser] generated signup link:', data?.properties?.action_link ? '[REDACTED_LINK]' : null) } catch (e) {}

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}