import React, { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card"
import { Eye, EyeOff } from "lucide-react"
import { toast } from "sonner"
import vvsLogo from "../assets/vvsLogo.jpg"
import supabase from "../lib/supabaseClient"
import { useAuth } from "../contexts/AuthContext"

const handleAuthRedirect = async () => {
  // Get URL components
  const url = window.location.href;
  const search = window.location.search;
  
  console.log('Reset Flow - URL Analysis');
  console.log('Current URL:', url);
  console.log('Search params:', search);
  
  // Check if we're on localhost with a code
  if (window.location.hostname === 'localhost' && search.includes('code=')) {
    const code = new URLSearchParams(search).get('code');
    if (code) {
      // Redirect to production with the same code
      const prodUrl = 'https://shobe-printing-services.vercel.app/reset-password';
      window.location.href = `${prodUrl}?code=${code}`;
      return false;
    }
  }

  // If we have a code in the URL, exchange it for a session
  if (search.includes('code=')) {
    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(search);
      if (error) throw error;
      
      // Store the fact that we're in a reset flow
      sessionStorage.setItem('forcePasswordReset', 'true');
      return true;
    } catch (err) {
      console.error('Error exchanging code for session:', err);
      return false;
    }
  }

  return true;
};

export function ResetPassword() {
  const { user } = useAuth();
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  // Handle the password reset flow
  useEffect(() => {
    const handleResetFlow = async () => {
      console.log('Reset Password Component - Initializing');
      
      // Check if this is a post-confirmation redirect
      const isPostConfirmation = 
        window.location.pathname === '/login' && 
        window.location.search.includes('confirmed=1');
      
      if (isPostConfirmation) {
        console.log('Post-confirmation detected - redirecting to login');
        const baseUrl = import.meta.env.PROD 
          ? 'https://shobe-printing-services.vercel.app'
          : window.location.origin;
        window.location.replace(`${baseUrl}/`);
        return;
      }

      // First handle any auth redirects and get a session
      const shouldContinue = await handleAuthRedirect();
      if (!shouldContinue) return;

      // Check current session state
      const { data: { session } } = await supabase.auth.getSession();
      const justConfirmed = sessionStorage.getItem('justConfirmed') === 'true';
      const isForceReset = sessionStorage.getItem('forcePasswordReset') === 'true' && !justConfirmed;
      const isTokenFlow = window.location.search.includes('code=');
      const isFirstLogin = session && !session.user?.user_metadata?.has_changed_password && !justConfirmed;

      // If this is a token-based reset flow, mark force reset so other logic respects it
      if (isTokenFlow) {
        sessionStorage.setItem('forcePasswordReset', 'true');
      }
      
      console.log('Session exists:', !!session);
      console.log('Force reset required:', isForceReset);
      console.log('First login:', isFirstLogin);
      
      // Handle navigation based on state
      // If there's no session and no token-based flow, or if we're redirected from confirmation, go to login
      if ((!session && !isTokenFlow) || justConfirmed) {
        console.log('No session/token or just confirmed - redirecting to login');
        const baseUrl = import.meta.env.PROD 
          ? 'https://shobe-printing-services.vercel.app'
          : window.location.origin;
        // Use replace to prevent back-button issues
        window.location.replace(baseUrl);
        return;
      }

      // If session exists but this is not a forced reset, first-login, or token flow,
      // then redirect to dashboard because no reset is required.
      if (session && !isForceReset && !isFirstLogin && !isTokenFlow) {
        console.log('No reset required - redirecting to dashboard');
        const baseUrl = import.meta.env.PROD 
          ? 'https://shobe-printing-services.vercel.app'
          : window.location.origin;
        window.location.href = `${baseUrl}/dashboard`;
        return;
      }
      
      console.log('Reset flow initialized successfully');
    };

    handleResetFlow();
  }, []);



  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      // Make sure we have a session before updating password
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No valid session found. Please use the reset link again.");
      }

      // Update the password and mark that it has been changed
      const { data, error } = await supabase.auth.updateUser({ 
        password: newPassword,
        data: { 
          has_changed_password: true,
          password_last_changed: new Date().toISOString()
        }
      });

      if (error) {
        throw error;
      }

      // Clear all reset-related flags
      sessionStorage.removeItem('forcePasswordReset');
      sessionStorage.removeItem('resetToken');
      
      // Show success message and redirect to login page using absolute URL
      toast.success("Password updated successfully! Please log in with your new password.");
      
      // Use absolute URL for redirect
      const baseUrl = import.meta.env.PROD 
        ? 'https://shobe-printing-services.vercel.app'
        : window.location.origin;
        
      setTimeout(() => {
        window.location.href = baseUrl; // Redirect to login page
      }, 1500);

    } catch (err) {
      console.error("Error updating password:", err);
      setError(err.message || "Failed to update password");
      toast.error("Failed to update password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

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
            <CardTitle className="text-2xl">Reset Password</CardTitle>
            <CardDescription>Enter your new password below</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pr-10"
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-gray-900 hover:bg-gray-800"
                disabled={isLoading}
              >
                {isLoading ? "Updating..." : "Update Password"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  const baseUrl = import.meta.env.PROD 
                    ? 'https://shobe-printing-services.vercel.app'
                    : window.location.origin;
                  window.location.href = baseUrl;
                }}
              >
                Back to Login
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}