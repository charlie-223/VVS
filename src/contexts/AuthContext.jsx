import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import * as auth from '../lib/auth'

// Create context with null as initial value
const AuthContext = createContext(null)

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  // Format user data from Supabase session
  const formatUserData = (sessionUser) => {
    if (!sessionUser) return null;
    return {
      ...sessionUser,
      username: sessionUser.user_metadata?.username || sessionUser.email,
      role: sessionUser.user_metadata?.role || 'Staff',
      id: sessionUser.id,
      email: sessionUser.email,
      createdAt: sessionUser.created_at
    };
  };

  // Initial session check and setup refresh token listener
  useEffect(() => {
    // Get initial session (returns null if no valid session)
    const initSession = async () => {
      try {
        // Check if we're in a password reset flow
        const isResetFlow = window.location.hash.includes('type=recovery') || 
                          window.location.pathname === '/reset-password';
        
        if (isResetFlow) {
          console.log('Reset flow detected, preserving session for password update');
          // Don't clear the session, we need it for the password update
          const { data: { session: activeSession } } = await supabase.auth.getSession();
          if (activeSession) {
            console.log('Existing session found during reset flow');
            setSession(activeSession);
            setUser(formatUserData(activeSession?.user));
          }
        } else {
          // Normal flow - check for existing session
          const { data: { session: activeSession } } = await supabase.auth.getSession()
          setSession(activeSession)
          setUser(formatUserData(activeSession?.user))
        }
      } catch (error) {
        console.error('Error checking session:', error)
      } finally {
        setLoading(false)
      }
    }

    // Call initial session check
    initSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, currentSession) => {
      console.log('Supabase auth event:', event);
      
      // Check if we're in a reset flow
      const isResetFlow = window.location.hash.includes('type=recovery') || 
                         window.location.pathname === '/reset-password';
      
      console.log('Auth state change - Reset flow:', isResetFlow);
      
      // If Supabase signals a password recovery flow, ensure we mark it so the UI
      // forces the user to change their password before proceeding.
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Auth event PASSWORD_RECOVERY - marking forcePasswordReset');
        try { sessionStorage.setItem('forcePasswordReset', 'true') } catch (e) {}
        if (currentSession) {
          setSession(currentSession);
          setUser(formatUserData(currentSession?.user));
        }
        setLoading(false);
        return;
      }

      // If user signs in while on the reset page (or a reset token exists AND we're on a recovery path), mark force reset
      if (event === 'SIGNED_IN') {
        const hasStoredToken = !!sessionStorage.getItem('resetToken');
        const onResetPath = window.location.pathname === '/reset-password' || window.location.hash.includes('type=recovery');

        // Only set forcePasswordReset when we have both a stored token and are on a recovery/reset path,
        // or when the user signs in while actually on the reset page (explicit path/hash).
        if ((hasStoredToken && onResetPath) || onResetPath) {
          console.log('SIGNED_IN on reset flow - marking forcePasswordReset');
          try { sessionStorage.setItem('forcePasswordReset', 'true') } catch (e) {}
        } else if (hasStoredToken && !onResetPath) {
          // Stored token looks stale (no recovery indicator) — remove it to avoid accidental resets on refresh
          try { sessionStorage.removeItem('resetToken') } catch (e) {}
        }
      }

      if (event === 'SIGNED_OUT' && !isResetFlow) {
        // Only clear everything and redirect if we're not in a reset flow
        console.log('Sign out detected (not in reset flow)');
        setSession(null);
        setUser(null);
        localStorage.removeItem('supabase.auth.token');
        sessionStorage.clear();

        // Redirect to login page only if we're not in reset flow
        window.location.href = '/';
        setLoading(false);
        return;
      }

      // other events continue to update session state
      console.log('Updating session state:', !!currentSession);
      setSession(currentSession);
      setUser(formatUserData(currentSession?.user));
      setLoading(false);
    })

    // Cleanup subscription
    return () => {
      subscription?.unsubscribe()
    }
  }, [])

  // Sign out helper (uses our auth.js wrapper)
  const signOut = async () => {
    try {
      const { error } = await auth.signOut()
      if (error) throw error
      // State will be updated by the listener
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  // Get user roles/metadata helper
  const getUserRoles = () => {
    if (!user) return []
    // You can customize this based on your Supabase setup
    // e.g., reading from user_metadata or a separate roles table
    return user.app_metadata?.roles || []
  }

  const value = {
    session,
    user,
    loading,
    signOut,
    getUserRoles,
    // Add isAuthenticated helper
    isAuthenticated: !!session,
    // Add formatted user properties for easy access
    username: user?.username,
    role: user?.role,
  }

  return (
    <AuthContext.Provider value={value}>
      {!loading ? children : null /* or a loading spinner */}
    </AuthContext.Provider>
  )
}

export default AuthContext