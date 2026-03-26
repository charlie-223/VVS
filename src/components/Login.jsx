import React, { useState, useEffect, useRef } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { useAuth } from "../contexts/AuthContext"
import { signIn } from "../lib/auth"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "./ui/card"
import { Checkbox } from "./ui/checkbox"
import { toast } from "sonner"
import { Eye, EyeOff } from "lucide-react"
import { Footer } from "./Footer"
import vvsLogo from "../assets/vvsLogo.jpg"
// Supabase integration — the app now requires Supabase for authentication.
// Enable by setting VITE_USE_SUPABASE=true and providing VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY in your .env. The helper functions are in src/lib/auth.js
const USE_SUPABASE = import.meta.env.VITE_USE_SUPABASE === 'true'
import * as supabaseAuth from "../lib/auth"

// We no longer store demo/local users. All authentication is done via Supabase.
// Keep a small local key for remember-me (stores email only).
const REMEMBER_KEY = "shobe_remembered_email"

// ----------------------
// useLoginRateLimiter hook (unchanged)
// ----------------------
function useLoginRateLimiter({ key = "login_rate_limiter", maxAttempts = 10, lockSeconds = 30 } = {}) {
  const [remainingSeconds, setRemainingSeconds] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const intervalRef = useRef(null)

  const _getState = () => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? JSON.parse(raw) : { attempts: 0, lockUntil: 0 }
    } catch (e) {
      return { attempts: 0, lockUntil: 0 }
    }
  }

  const _setState = s => {
    try {
      localStorage.setItem(key, JSON.stringify(s))
    } catch (e) {
      // ignore
    }
  }

  const getRemainingSeconds = () => {
    const s = _getState()
    const now = Date.now()
    if (!s.lockUntil || s.lockUntil <= now) return 0
    return Math.ceil((s.lockUntil - now) / 1000)
  }

  const startTicking = () => {
    if (intervalRef.current) return
    intervalRef.current = setInterval(() => {
      const rem = getRemainingSeconds()
      setRemainingSeconds(rem)
      setIsLocked(rem > 0)
      if (rem <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        // clear attempts when lock expires
        _setState({ attempts: 0, lockUntil: 0 })
        setIsLocked(false)
        setRemainingSeconds(0)
      }
    }, 1000)
  }

  const recordFailure = () => {
    const s = _getState()
    const now = Date.now()
    const attempts = (s.attempts || 0) + 1
    let lockUntil = s.lockUntil || 0

    if (attempts >= maxAttempts) {
      lockUntil = now + lockSeconds * 1000
      _setState({ attempts, lockUntil })
      setRemainingSeconds(Math.ceil((lockUntil - now) / 1000))
      setIsLocked(true)
      startTicking()
    } else {
      _setState({ attempts, lockUntil })
    }
  }

  const reset = () => {
    _setState({ attempts: 0, lockUntil: 0 })
    setIsLocked(false)
    setRemainingSeconds(0)
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  useEffect(() => {
    const rem = getRemainingSeconds()
    setRemainingSeconds(rem)
    setIsLocked(rem > 0)
    if (rem > 0) startTicking()
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    isLocked,
    remainingSeconds,
    recordFailure,
    reset,
    _rawState: _getState()
  }
}

// ----------------------
// Login component (full file)
// ----------------------
export function Login({ onLogin }) {
  const [credentials, setCredentials] = useState({
    username: "",
    password: ""
  })
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [usernameError, setUsernameError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  // Cooldown for password reset requests to avoid hitting Supabase rate limits
  const [resetCooldownUntil, setResetCooldownUntil] = useState(0)
  const [resetRemainingSeconds, setResetRemainingSeconds] = useState(0)

  // Rate limiter (client-side UX)
  const { isLocked, remainingSeconds, recordFailure, reset } = useLoginRateLimiter({
    key: "shobe_login_rl",
    maxAttempts: 10,
    lockSeconds: 30
  })

  // On mount: load remembered credentials if present
  useEffect(() => {
    try {
      const raw = localStorage.getItem(REMEMBER_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && parsed.email) {
          setCredentials({ username: parsed.email || "", password: "" })
          setRememberMe(true)
        }
      }
    } catch (e) {
      // ignore parse errors
    }
  }, [])

  // Keep remembered email in localStorage in sync when the username changes while rememberMe is active.
  useEffect(() => {
    if (!rememberMe) return
    try {
      const email = (credentials.username || '').trim()
      if (email) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email }))
      } else {
        localStorage.removeItem(REMEMBER_KEY)
      }
    } catch (e) {
      // ignore storage errors
    }
  }, [credentials.username, rememberMe])

  // Restore any existing reset cooldown from localStorage
  useEffect(() => {
    try {
      const key = localStorage.getItem('shobe_reset_cooldown')
      const val = key ? parseInt(key, 10) : 0
      if (val && val > Date.now()) {
        setResetCooldownUntil(val)
        setResetRemainingSeconds(Math.ceil((val - Date.now()) / 1000))
      }
    } catch (e) {
      // ignore
    }
  }, [])

  // Tick remaining seconds for cooldown
  useEffect(() => {
    if (!resetCooldownUntil || resetCooldownUntil <= Date.now()) return
    const iv = setInterval(() => {
      const rem = Math.max(0, Math.ceil((resetCooldownUntil - Date.now()) / 1000))
      setResetRemainingSeconds(rem)
      if (rem <= 0) {
        setResetCooldownUntil(0)
        localStorage.removeItem('shobe_reset_cooldown')
        clearInterval(iv)
      }
    }, 1000)
    return () => clearInterval(iv)
  }, [resetCooldownUntil])

  // No local/demo stored users — use Supabase exclusively

  const handleSubmit = async e => {
    e.preventDefault()
    setUsernameError("")
    setPasswordError("")

    // if locked, show remaining seconds immediately
    if (isLocked) {
      setPasswordError(`Incorrect password. Try again in ${remainingSeconds}s`)
      return
    }

  // Trim inputs before validation / checking
  const trimmedEmail = credentials.username.trim()
  const trimmedPassword = credentials.password.trim()

    // Validation
    let hasError = false

    if (!trimmedEmail) {
      setUsernameError("Please enter your email")
      hasError = true
    }

    if (!trimmedPassword) {
      setPasswordError("Please enter your password")
      hasError = true
    }

    if (hasError) return

    setIsLoading(true)


    // Simulate small delay for UX
    await new Promise(resolve => setTimeout(resolve, 500))

    if (!USE_SUPABASE) {
      setIsLoading(false)
      setPasswordError('Supabase not enabled. Please enable VITE_USE_SUPABASE and set env variables.')
      return
    }

    try {
      const { data, error } = await supabaseAuth.signIn(trimmedEmail, trimmedPassword)
      if (error) {
        recordFailure()
        setPasswordError(error.message || 'Invalid credentials')
      } else {
        // success
        reset()
        try {
          if (rememberMe) {
            localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: trimmedEmail }))
          } else {
            localStorage.removeItem(REMEMBER_KEY)
          }
        } catch (e) {}

        // Session will be handled by AuthProvider
        toast.success('Signed in')
        
        // Extract role from user metadata if set
        const role = data?.user?.user_metadata?.role || 'User'
        const idOrEmail = data?.user?.email || trimmedEmail
        
        // Update user metadata with role if not present
        if (!data?.user?.user_metadata?.role) {
          try {
            await supabase.auth.updateUser({
              data: { role }
            })
          } catch (e) {
            console.warn('Failed to update user role metadata:', e)
          }
        }
        
        onLogin(idOrEmail, role)
      }
    } catch (e) {
      console.error('Login error', e)
      setPasswordError('Login failed')
    }

    setIsLoading(false)
  }

  // ----------------------
  // Password reset using Supabase
  // ----------------------
  const handleForgotPassword = async () => {
    const trimmedEmail = credentials.username.trim()
    setIsLoading(true)

    try {
      // Validate email format
      if (!trimmedEmail || !trimmedEmail.includes('@')) {
        toast.error('Please enter a valid email address')
        return
      }

      if (!USE_SUPABASE) {
        toast.error('Supabase not enabled. Cannot send password reset.')
        return
      }

      console.log('Attempting password reset for:', trimmedEmail)

      // Call Supabase password reset through our auth helper
      const { error } = await supabaseAuth.resetPassword(trimmedEmail, {
        redirectTo: `${window.location.origin}/reset-password`
      })

      if (error) {
        console.warn('Reset password request returned error:', error)
        // Generic message to avoid user enumeration
        toast.info("If an account exists, you'll receive a reset email shortly.")
      } else {
        toast.success('Password reset link sent! Please check your email.')
      }

      setShowForgotPassword(false)
    } catch (e) {
      console.error('Reset password failed:', e)
      toast.error('Failed to send reset link. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }



  return (
    <div className="min-h-screen flex flex-col bg-gray-50 px-4">
      <div className="flex-1 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-4">
              <img
                src={vvsLogo}
                alt="VVS Logo"
                className="w-20 h-20 object-contain"
              />
            </div>
            <CardTitle className="text-2xl">TESTING</CardTitle>
            <CardDescription>Inventory Management System</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={credentials.username}
                  onChange={e => {
                    setCredentials(prev => ({
                      ...prev,
                      username: e.target.value
                    }))
                    setUsernameError("")
                  }}
                  className={usernameError ? "border-red-500" : ""}
                />
                {usernameError && (
                  <span className="text-sm text-red-600">{usernameError}</span>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={credentials.password}
                    onChange={e => {
                      setCredentials(prev => ({
                        ...prev,
                        password: e.target.value
                      }))
                      setPasswordError("")
                    }}
                    className={passwordError ? "border-red-500 pr-10" : "pr-10"}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                {passwordError && (
                  <span className="text-sm text-red-600">{passwordError}</span>
                )}
              </div>

              {/* Remember Me and Forgot Password */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={checked => {
                      const isChecked = !!checked
                      setRememberMe(isChecked)
                      try {
                        if (isChecked) {
                          // Save current username/email when enabling remember me
                          const email = (credentials.username || '').trim()
                          if (email) localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email }))
                        } else {
                          localStorage.removeItem(REMEMBER_KEY)
                        }
                      } catch (e) {
                        // ignore storage errors
                      }
                    }}
                  />
                  <label
                    htmlFor="remember"
                    className="text-sm text-gray-600 cursor-pointer select-none"
                  >
                    Remember me
                  </label>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="text-sm text-blue-600 hover:text-blue-800 p-0 h-auto"
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot password?
                </Button>
              </div>

              <Button
                type="submit"
                className="w-full bg-gray-900 hover:bg-gray-800"
                disabled={isLoading || isLocked}
              >
                {isLoading ? "Signing in..." : isLocked ? `Locked (${remainingSeconds}s)` : "Sign in"}
              </Button>
            </form>

            {/* Forgot Password Dialog */}
            {showForgotPassword && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Reset Password
                </h4>
                <p className="text-sm text-gray-600 mb-3">
                  Enter your username and we'll send a reset link to your email.
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleForgotPassword}
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={isLoading || (resetCooldownUntil && resetCooldownUntil > Date.now())}
                  >
                    {isLoading ? "Sending..." : (resetCooldownUntil && resetCooldownUntil > Date.now() ? `Try again in ${resetRemainingSeconds}s` : "Send Reset Link")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowForgotPassword(false)}
                    disabled={isLoading}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>

      {/* Copyright Footer - positioned at bottom with no space below */}
      <Footer />
    </div>
  )
}