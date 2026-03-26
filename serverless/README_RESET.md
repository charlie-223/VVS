Server-side password reset helper (Supabase)

Purpose

This small server handler triggers Supabase password-reset emails using your Supabase service_role key. Keep the service role key on the server — never in client code or committed to a public repo.

Files

- `send-reset.js` — Express handler that exposes POST /reset-password

Required environment variables (set these on your server / hosting platform):

- SUPABASE_URL — your Supabase project URL (e.g. https://xyz.supabase.co)
- SUPABASE_SERVICE_ROLE_KEY — your Service Role key (must be kept secret)
- RESET_REDIRECT_TO (optional) — the redirect URL to include in reset emails (defaults to <origin>/reset-password)
- ORIGIN (optional) — used to build default redirect when RESET_REDIRECT_TO not set

Usage (local testing)

1. Install dependencies in a separate folder (or add to your project):

```powershell
npm init -y
npm install express body-parser @supabase/supabase-js
$env:SUPABASE_URL = 'https://your.supabase.co'
$env:SUPABASE_SERVICE_ROLE_KEY = 'your-service-role-key'
node serverless/send-reset.js
```

2. Make a POST request:

```powershell
# using curl in PowerShell
curl -Method POST -Uri http://localhost:8787/reset-password -Body (@{ email = 'user@example.com' } | ConvertTo-Json) -ContentType 'application/json'
```

Deploying

- Vercel: create an API route that imports this file. Set `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_URL` in Vercel Environment Variables.
- Netlify Functions: wrap the handler as a Netlify function and set env vars in Netlify settings.
- Any server: run as a small Node process behind HTTPS.

Security & notes

- This uses your service role key. Keep it secret. Use server environment variables.
- Implement persistent rate-limiting (Redis, DB) for production. This example uses in-memory map and is not suitable across multiple instances.
- If Supabase still complains about "email rate limit exceeded", check your Supabase Auth logs and your SMTP provider's dashboard (SendGrid/Mailgun/SES) for provider-level limits or blocks.
