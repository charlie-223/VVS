import supabase, { supabaseAdmin } from './supabaseClient'

// Thin wrapper around Supabase auth so components can import and use
// these functions without coupling to the Supabase client initialization details.
export async function signIn(email, password) {
  if (!supabase) return { error: new Error('Supabase not configured'), data: null }
  try {
    const result = await supabase.auth.signInWithPassword({ email, password })
    return { data: result.data, error: result.error }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function signUp(email, password, options = {}) {
  if (!supabase) return { error: new Error('Supabase not configured'), data: null }
  try {
    // Use admin generateLink to send a signup invitation link.
    // Do NOT create the auth user here; Supabase will create the user when
    // they complete the signup via the emailed link. Creating the user up
    // front causes conflicts with generateLink.
    if (!supabaseAdmin) return { data: null, error: new Error('Supabase admin not configured') }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: 'signup',
      email,
      password,
      options: {
        redirectTo: options.redirectTo || `${window.location.origin}/confirm`,
        data: {
          username: options.username,
          role: options.role,
          createdBy: options.createdBy
        }
      }
    })

    // Log the generated link action (do not expose tokens in production logs)
    try { console.log('[auth.signUp] signup link:', data?.properties?.action_link ? '[REDACTED_LINK]' : null) } catch (e) {}

    return { data, error }
  } catch (err) {
    return { data: null, error: err }
  }
}

export async function signOut() {
  if (!supabase) return { error: new Error('Supabase not configured') }
  try {
    // Force clear any existing session
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) throw error
    
    // Clear any local storage items
  // Remove only Supabase auth tokens — do NOT clear all localStorage because
  // that will wipe app-level preferences like the remembered email.
  try { localStorage.removeItem('supabase.auth.token'); } catch (e) {}
    
  // Force a page reload to clear any in-memory state
  // Note: don't remove other localStorage keys (e.g. REMEMBER_KEY)
  window.location.href = '/';
    
    return { data: null, error: null }
  } catch (err) {
    console.error('Signout error:', err)
    return { data: null, error: err }
  }
}

export function onAuthStateChange(cb) {
  if (!supabase) return () => {}
  const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
    cb(event, session)
  })
  return () => listener?.subscription?.unsubscribe?.()
}

export async function getUser() {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }
  try {
    const result = await supabase.auth.getUser()
    return { data: result.data, error: result.error }
  } catch (err) {
    return { data: null, error: err }
  }
}

// Request a password reset email for the given address. Returns {data, error}.
export async function resetPassword(email, options = {}) {
  if (!supabase) return { data: null, error: new Error('Supabase not configured') }
  try {
    // supabase.auth.resetPasswordForEmail returns { data, error }
    const result = await supabase.auth.resetPasswordForEmail(email, {
      ...options,
      redirectTo: options.redirectTo || `${window.location.origin}/reset-password`,
    })
    // Debug: surface result to client console so devs can see Supabase response
    try {
      // Avoid logging sensitive tokens but show the error/message details
      // eslint-disable-next-line no-console
      console.log('[auth.resetPassword] result:', {
        status: result?.error ? 'error' : 'ok',
        error: result?.error?.message || null,
        data: result?.data || null
      })
    } catch (e) {
      // ignore logging failures
    }
    return { data: result.data, error: result.error }
  } catch (err) {
    return { data: null, error: err }
  }
}
