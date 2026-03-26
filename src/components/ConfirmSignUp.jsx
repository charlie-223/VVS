import { useEffect, useState } from "react"
import supabase from "../lib/supabaseClient"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { toast } from "sonner"
import shobeLogo from "../assets/shobelogo.png"
import { Loader2 } from "lucide-react"

export function ConfirmSignUp() {
  const [confirming, setConfirming] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const handleConfirmation = async () => {
      try {
        // Try to resolve a session/user in several ways (robust for different link formats)
        let userId = null

        // 1) If SDK already has a session (it may have auto-processed the URL), use it
        try {
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user?.id) {
            userId = session.user.id
          }
        } catch (err) {
          // ignore
        }

        // 2) If no session and query contains `code=`, exchange it for a session
        if (!userId && window.location.search && window.location.search.includes('code=')) {
          const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.search)
          if (exchangeError) {
            console.error('Token verification failed:', exchangeError)
            throw exchangeError
          }
          const resolvedUser = exchangeData?.session?.user || exchangeData?.user
          userId = resolvedUser?.id
        }

        // 3) If still no session and hash contains an access_token, attempt getSessionFromUrl (if available)
        if (!userId && window.location.hash && window.location.hash.includes('access_token=')) {
          try {
            // some SDKs expose getSessionFromUrl()
            if (typeof supabase.auth.getSessionFromUrl === 'function') {
              const { data: urlSessionData, error: urlSessionError } = await supabase.auth.getSessionFromUrl()
              if (urlSessionError) throw urlSessionError
              const resolvedUser = urlSessionData?.session?.user || urlSessionData?.user
              userId = resolvedUser?.id
            }
          } catch (err) {
            console.warn('Could not extract session from URL hash', err)
          }
        }

        if (!userId) {
          setError('No confirmation token found');
          setConfirming(false);
          return;
        }

        // Prefer performing admin updates server-side to avoid exposing the service role key
        // and to bypass row-level security (RLS). We'll call a serverless endpoint that
        // performs: updateUserById, upsert profiles, delete pending_users. The endpoint
        // must accept the user's access token for validation.

        // Get current client session to obtain access token
        let accessToken = null
        try {
          const { data: { session } } = await supabase.auth.getSession()
          accessToken = session?.access_token
        } catch (err) {
          // ignore
        }

        // Fallback: attempt to parse access_token from URL hash if present
        if (!accessToken && window.location.hash && window.location.hash.includes('access_token=')) {
          const hash = window.location.hash.substring(1)
          const params = new URLSearchParams(hash)
          accessToken = params.get('access_token')
        }

        if (!accessToken) {
          console.warn('No access token available to finalize signup; skipping server-side admin calls')
        } else {
          // Try common serverless paths used by platforms (Vercel: /api/confirm-signup)
          const endpoints = ['/api/confirm-signup', '/confirm-signup']
          let called = false
          for (const ep of endpoints) {
            try {
              const resp = await fetch(ep, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ access_token: accessToken })
              })
              if (resp.ok) {
                called = true
                break
              }
            } catch (err) {
              // try next
            }
          }
          if (!called) {
            console.warn('Could not reach server-side confirm endpoint; admin tasks may not have completed')
          }
        }

        // Robustly wait for Supabase to process the confirmation and produce a session
        const waitForConfirmation = async (attempts = 12, intervalMs = 1000) => {
          for (let i = 0; i < attempts; i++) {
            try {
              // 1) If SDK supports URL hash processing, try it first (handles implicit grant / hash flows)
              if (typeof supabase.auth.getSessionFromUrl === 'function') {
                try {
                  const { data: urlSessionData, error: urlErr } = await supabase.auth.getSessionFromUrl()
                  if (!urlErr) {
                    const resolved = urlSessionData?.session?.user || urlSessionData?.user
                    if (resolved && resolved.email_confirmed_at) return resolved
                    if (resolved && resolved.id) userId = resolved.id
                  }
                } catch (e) {
                  // ignore and continue
                }
              }

              // 2) Try exchanging the code for a session (some SDKs require full href)
              try {
                const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href)
                if (!exchangeError) {
                  const resolved = exchangeData?.session?.user || exchangeData?.user
                  if (resolved && resolved.email_confirmed_at) return resolved
                  if (resolved && resolved.id) userId = resolved.id
                }
              } catch (e) {
                // ignore and continue
              }

              // 3) Check the current client session
              try {
                const { data: { session } } = await supabase.auth.getSession()
                const u = session?.user
                if (u && u.email_confirmed_at) return u
                if (u && u.id) userId = u.id
              } catch (e) {
                // ignore
              }
            } catch (err) {
              // swallow and retry
            }

            // wait before retrying
            await new Promise(r => setTimeout(r, intervalMs))
          }
          return null
        }

        try {
          const confirmedUser = await waitForConfirmation(12, 1000) // ~12s max wait
          if (!confirmedUser) {
            setError('Email not confirmed yet. Please click the confirmation link in your email (or wait a few seconds) and try again.')
            setConfirming(false)
            return
          }

          // we have a confirmed user
          userId = confirmedUser.id

          // Try to call server-side confirm endpoint now that we have a confirmed session.
          // This lets a serverless function run admin tasks (updateUserById, upsert profiles, delete pending_users)
          try {
            const { data: { session: s } } = await supabase.auth.getSession()
            const token = s?.access_token
            if (token) {
              const endpoints = ['/api/confirm-signup', '/confirm-signup']
              for (const ep of endpoints) {
                try {
                  const resp = await fetch(ep, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: token })
                  })
                  if (resp.ok) {
                    console.log('Server-side confirm endpoint succeeded:', ep)
                    break
                  } else {
                    console.warn('Server-side confirm endpoint responded not ok:', ep, resp.status)
                  }
                } catch (e) {
                  console.warn('Server-side confirm endpoint failed:', ep, e)
                }
              }
            } else {
              console.warn('No access token available to call server-side confirm endpoint')
            }
          } catch (e) {
            console.warn('Error attempting server-side confirm call:', e)
          }
        } catch (e) {
          console.warn('Error verifying confirmation status:', e)
          setError('Could not verify email confirmation. Please try again or contact support.')
          setConfirming(false)
          return
        }

        // Remove the pending user using the user's ID
        try {
          if (userId) {
            console.log('Removing pending user with ID:', userId);
            const { error: deletePendingError } = await supabase
              .from('pending_users')
              .delete()
              .eq('id', userId);

            if (deletePendingError) {
              console.error('Error removing pending user:', deletePendingError);
            } else {
              console.log('Successfully removed user from pending_users table');
            }
          } else {
            console.error('Could not determine user ID for pending_users cleanup');
          }
        } catch (err) {
          console.error('Error cleaning up pending user:', err);
        }

        toast.success('Email confirmed successfully! You can now log in.');
        
        // Clear ALL session data and set confirmation flag
        try {
          console.log('Clearing session and setting confirmation state...');
          // Clear Supabase session
          await supabase.auth.signOut();
          // Clear all storage
          sessionStorage.clear();
          localStorage.clear();
          // Set our flags
          sessionStorage.setItem('justConfirmed', 'true');
          sessionStorage.setItem('shouldShowLogin', 'true');
        } catch (e) {
          console.error('Error clearing session:', e);
        }

        // Hard redirect to login page
        setTimeout(() => {
          const baseUrl = import.meta.env.PROD
            ? 'https://shobe-printing-services.vercel.app'
            : window.location.origin;
          console.log('Redirecting to login with confirmed flag...');
          // Use replace to prevent back navigation
          window.location.replace(`${baseUrl}/login?confirmed=1`);
        }, 2000)

      } catch (err) {
        console.error('Confirmation error:', err)
        setError(err.message || 'Failed to confirm email')
      } finally {
        setConfirming(false)
      }
    }

    handleConfirmation()
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 px-4">
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img
                src={shobeLogo}
                alt="Shobe Printing Services Logo"
                className="w-20 h-20 object-contain"
              />
            </div>
            <CardTitle className="text-2xl">Email Confirmation</CardTitle>
            <CardDescription>
              {confirming
                ? "Confirming your email address..."
                : error
                ? "Failed to confirm email"
                : "Email confirmed successfully!"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            {confirming ? (
              <div className="flex justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : error ? (
              <div className="space-y-4">
                <p className="text-red-600">{error}</p>
                <Button
                  onClick={() => {
                    const baseUrl = import.meta.env.PROD
                      ? 'https://shobe-printing-services.vercel.app'
                      : window.location.origin
                    window.location.href = baseUrl
                  }}
                >
                  Back to Login
                </Button>
              </div>
            ) : (
              <p className="text-green-600">
                Your email has been confirmed. Redirecting to login...
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}