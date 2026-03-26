import { useState } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "./ui/card"
import { PageHeader } from "./PageHeader"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from "./ui/alert-dialog"
import { toast } from "sonner"
import { Eye, EyeOff, User as UserIcon } from "lucide-react"
import { supabaseAdmin } from "../lib/supabaseClient"

export function Account({
  currentUser,
  onLogout,
  lowStockItems = [],
  onUpdatePassword
}) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [currentPasswordError, setCurrentPasswordError] = useState("")
  const [newPasswordError, setNewPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")

  // Sample credentials for validation (in real app, this would be from backend)
  const validCredentials = [
    { username: "shuee", password: "shuee1", role: "Admin" },
    { username: "verity", password: "verity1", role: "Staff" },
    { username: "cath", password: "cath123", role: "Staff" },
    { username: "sofia", password: "sofia12", role: "Staff" }
  ]

  const handleUpdatePassword = async () => {
    // Clear all errors
    setCurrentPasswordError("")
    setNewPasswordError("")
    setConfirmPasswordError("")

    let hasError = false

    // Validate inputs
    if (!currentPassword) {
      setCurrentPasswordError("Current password is required")
      hasError = true
    }

    if (!newPassword) {
      setNewPasswordError("New password is required")
      hasError = true
    } else if (newPassword.length < 6) {
      setNewPasswordError("Password must be at least 6 characters")
      hasError = true
    } else if (newPassword === currentPassword) {
      setNewPasswordError(
        "New password must be different from current password"
      )
      hasError = true
    }

    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your new password")
      hasError = true
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match")
      hasError = true
    }

    if (hasError) return

    try {
      // First verify current password
      const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
        email: currentUser.email,
        password: currentPassword,
      })

      if (signInError) {
        setCurrentPasswordError("Current password is incorrect")
        throw signInError
      }

      // If current password is correct, update to new password
      const { data: updateData, error: updateError } = await supabaseAdmin.auth.updateUser({
        password: newPassword
      })

      if (updateError) {
        throw updateError
      }

      // Reset form first
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")

      toast.success("Password updated successfully! Logging you out...")

      try {
        // Clear all Supabase session data
        const { error: signOutError } = await supabaseAdmin.auth.signOut()
        if (signOutError) throw signOutError

        // Clear ALL storage
        localStorage.clear()
        sessionStorage.clear()
        
        // Remove any auth cookies if they exist
        document.cookie.split(";").forEach((c) => {
          document.cookie = c
            .replace(/^ +/, "")
            .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/")
        })
        
        // Small delay to ensure the toast is visible
        await new Promise(resolve => setTimeout(resolve, 1500))

        // Use absolute URL for redirect
        const baseUrl = import.meta.env.PROD 
          ? 'https://shobe-printing-services.vercel.app'
          : window.location.origin
        
        window.location.href = `${baseUrl}/login`

      } catch (error) {
        console.error('Error during sign out:', error)
        // Last resort: force reload
        window.location.reload(true)
      }
    } catch (error) {
      console.error('Error updating password:', error)
      if (!error.message.includes("incorrect")) {
        toast.error(error.message || "Failed to update password")
      }
    }
  }

  return (
    <div className="bg-white h-full flex flex-col">
      <PageHeader
        title="Account Settings"
        currentUser={currentUser}
        onLogout={onLogout}
        showNotifications={true}
        lowStockItems={lowStockItems}
      />

      <div className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* User Information Card */}
          <Card>
            <CardHeader>
              <CardTitle>User Information</CardTitle>
              <CardDescription>
                Your account details in the inventory management system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <UserIcon className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {currentUser?.username || "Unknown"}
                  </p>
                  <p className="text-sm text-gray-600">
                    {currentUser?.role || "User"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Change Password Card */}
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={e => {
                      setCurrentPassword(e.target.value)
                      setCurrentPasswordError("")
                    }}
                    className={
                      currentPasswordError ? "border-red-500 pr-10" : "pr-10"
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                {currentPasswordError && (
                  <span className="text-sm text-red-600">
                    {currentPasswordError}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={e => {
                      setNewPassword(e.target.value)
                      setNewPasswordError("")
                    }}
                    className={
                      newPasswordError ? "border-red-500 pr-10" : "pr-10"
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </Button>
                </div>
                {newPasswordError ? (
                  <span className="text-sm text-red-600">
                    {newPasswordError}
                  </span>
                ) : (
                  <p className="text-sm text-gray-500">Minimum 6 characters</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={e => {
                      setConfirmPassword(e.target.value)
                      setConfirmPasswordError("")
                    }}
                    className={
                      confirmPasswordError ? "border-red-500 pr-10" : "pr-10"
                    }
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
                {confirmPasswordError && (
                  <span className="text-sm text-red-600">
                    {confirmPasswordError}
                  </span>
                )}
              </div>

              <div className="pt-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full sm:w-auto">Update Password</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirm Password Change</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to change your password? This will update your account password immediately.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={async () => { await handleUpdatePassword() }}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>

          {/* Security Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Password Security Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>• Use at least 6 characters for your password</li>
                <li>
                  • Include a mix of letters, numbers, and special characters
                </li>
                <li>
                  • Don't use easily guessable information like your name or
                  birthday
                </li>
                <li>• Change your password regularly for better security</li>
                <li>• Never share your password with others</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
