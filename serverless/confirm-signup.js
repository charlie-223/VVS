/*
Serverless endpoint to finalize a signup confirmation.
Receives an access token from the client, validates it with Supabase's /auth/v1/user endpoint,
then uses the service-role key to update user metadata, upsert a profile, and remove pending_users.

Deploy this on a secure serverless environment (Vercel/Netlify) with env vars:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

This keeps the service role key on the server and avoids RLS 403s from browser-side admin calls.
*/

import express from 'express'
import bodyParser from 'body-parser'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(bodyParser.json())

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables')
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

app.post('/confirm-signup', async (req, res) => {
  try {
    const accessToken = req.body?.access_token || null
    if (!accessToken) return res.status(400).json({ error: 'missing_access_token' })

    // Validate token by calling Supabase auth user endpoint with the user's token
    const userResp = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    if (!userResp.ok) {
      const txt = await userResp.text()
      console.error('Token validation failed', userResp.status, txt)
      return res.status(401).json({ error: 'invalid_token' })
    }

    const userData = await userResp.json()
    const user = userData?.user || userData // some endpoints return { user }
    if (!user || !user.id) return res.status(401).json({ error: 'invalid_user' })

    // Update user metadata (mark confirmed)
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      user_metadata: {
        ...user.user_metadata,
        status: 'active',
        email_confirmed: true,
        email_confirmed_at: new Date().toISOString(),
        has_changed_password: true
      }
    })
    if (updateError) {
      console.error('admin.updateUserById error', updateError)
      return res.status(500).json({ error: 'failed_update_user' })
    }

    // Upsert profile (service role bypasses RLS)
    const profilePayload = {
      id: user.id,
      username: user.user_metadata?.username || user.email,
      role: user.user_metadata?.role || 'Staff'
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert([profilePayload], { onConflict: 'id' })

    if (profileError) {
      console.error('profiles upsert error', profileError)
      return res.status(500).json({ error: 'failed_upsert_profile' })
    }

    // Delete pending_users row by email if present
    if (user.email) {
      const { error: delError } = await supabaseAdmin
        .from('pending_users')
        .delete()
        .eq('email', user.email)

      if (delError) console.warn('failed to delete pending_users row', delError)
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    console.error('confirm-signup error', err)
    return res.status(500).json({ error: 'server_error' })
  }
})

// Local dev helper
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 8788
  app.listen(port, () => console.log(`Confirm-signup server listening on http://localhost:${port}`))
}

export default app
