/*
Simple serverless / Express handler to trigger Supabase password-reset emails
Run this on a server (Vercel/Netlify/Azure/AWS) with env vars:
  SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

This endpoint protects the service role key by keeping it on the server instead of in the client.
It also implements a small IP-based cooldown to avoid excessive calls.
*/

import express from 'express'
import bodyParser from 'body-parser'
import { createClient } from '@supabase/supabase-js'

const app = express()
app.use(bodyParser.json())

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const REDIRECT_TO = process.env.RESET_REDIRECT_TO || `${process.env.ORIGIN || 'http://localhost:5173'}/reset-password`

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env variables')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

// naive in-memory per-IP cooldown map (for serverless this only lasts for lifetime of instance)
const cooldowns = new Map()
const COOLDOWN_MS = 15 * 60 * 1000 // 15 minutes

app.post('/reset-password', async (req, res) => {
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress
    const { email } = req.body || {}
    if (!email || typeof email !== 'string') return res.status(400).json({ error: 'email_required' })

    const now = Date.now()
    const until = cooldowns.get(ip)
    if (until && until > now) {
      const remaining = Math.ceil((until - now) / 1000)
      return res.status(429).json({ error: 'rate_limited', retry_after_seconds: remaining })
    }

    // Trigger Supabase password reset email using service role key
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT_TO })
    if (error) {
      // If Supabase reports a rate limit, set cooldown for this IP
      const msg = (error.message || '').toLowerCase()
      if (msg.includes('rate limit') || error.status === 429) {
        cooldowns.set(ip, now + COOLDOWN_MS)
      }
      return res.status(error.status || 500).json({ error: error.message || 'unknown_error' })
    }

    // on success, set a short cooldown to prevent repeat spamming
    cooldowns.set(ip, now + (60 * 1000)) // 1 minute
    return res.status(200).json({ success: true, data })
  } catch (err) {
    console.error('reset-password error', err)
    return res.status(500).json({ error: 'server_error' })
  }
})

// Start when run directly (helpful for local testing)
if (process.env.NODE_ENV !== 'production') {
  const port = process.env.PORT || 8787
  app.listen(port, () => console.log(`Reset server listening on http://localhost:${port}`))
}

export default app
