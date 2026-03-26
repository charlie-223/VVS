import { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { supabase, supabaseAdmin } from "../lib/supabaseClient"
import { Protected } from "./Protected"
import { PERMISSIONS } from "../lib/permissions"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "./ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "./ui/select"
import { Badge } from "./ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "./ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "./ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui/table"
import { toast } from "sonner"
import {
  UserPlus,
  Trash2,
  Shield,
  User,
  Search,
  RefreshCw,
  Eye,
  EyeOff
} from "lucide-react"
import { PageHeader } from "./PageHeader"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "./ui/pagination"

function UserManagementContent({
  currentUser,
  onLogout,
  lowStockItems = [],
  onArchiveUser,
  onNavigateToAccount
}) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Fetch users from Supabase on component mount
  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      console.log("Fetching users...");
      
      // Fetch all profiles data from the profiles table
      const { data: profilesData, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('*');
      
      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      console.log("Profiles fetched:", profilesData?.length || 0);

      // Format profiles data
      const formattedUsers = profilesData.map(profile => ({
        id: profile.id,
        username: profile.username,
        role: profile.role || "Staff",
        email: profile.email,
        createdAt: new Date(profile.created_at).toLocaleDateString(),
        createdBy: profile.created_by || "System",
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
        updated_at: profile.updated_at
      }));

      setUsers(formattedUsers)
    } catch (error) {
      console.error("Error fetching users:", error)
      toast.error("Failed to fetch users")
    } finally {
      setLoading(false)
    }
  }

  const [createDialog, setCreateDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [newUsername, setNewUsername] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [newEmail, setNewEmail] = useState("")
  const [newRole, setNewRole] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [usernameError, setUsernameError] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [confirmPasswordError, setConfirmPasswordError] = useState("")
  const [emailError, setEmailError] = useState("")
  const [roleError, setRoleError] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  // Password rule: 1 letter, 1 number, 1 special char, length 6–20
  const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>\/?]).{6,20}$/

  //
  // ---------- EMAIL VALIDATION HELPERS (part-by-part) ----------
  //

  // Allowed common base domains (lowercase)
  const allowedBaseDomains = new Set([
    "gmail.com",
    "googlemail.com",
    "yahoo.com",
    "ymail.com",
    "rocketmail.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "msn.com",
    "mail.com",
    "icloud.com",
    "me.com",
    "mac.com",
    // permit common PH-ish bases (these will also match when .ph is present)
    "smart.com",
    "globe.com",
    "pldtdsl.net"
  ])

  // Patterns considered allowed if they end with these .ph variants (useful for schools, gov, companies)
  const allowedPhPatternRegexes = [
    /\.edu\.ph$/i,
    /\.gov\.ph$/i,
    /\.com\.ph$/i,
    /\.org\.ph$/i,
    /\.net\.ph$/i
  ]

  // 1) basic format check
  const isEmailFormatValid = email => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(String(email).trim())
  }

  // 2) extract domain (after @)
  const extractDomain = email => {
    if (!email || typeof email !== "string") return null
    const parts = email.trim().toLowerCase().split("@")
    if (parts.length !== 2) return null
    return parts[1].trim()
  }

  // 3) domain acceptance check: allow list OR .ph patterns OR base match when .ph is present
  const isDomainAllowed = domainIn => {
    if (!domainIn) return false
    const domain = domainIn.toLowerCase().trim()

    // exact allowed domain (e.g., gmail.com)
    if (allowedBaseDomains.has(domain)) return true

    // If domain ends with ".ph", check several possibilities:
    if (domain.endsWith(".ph")) {
      // strip only the trailing ".ph" (so yahoo.com.ph -> yahoo.com)
      const strippedOnce = domain.replace(/\.ph$/i, "")
      if (allowedBaseDomains.has(strippedOnce)) return true

      // allow known .ph patterns like something.edu.ph, something.gov.ph, etc.
      if (allowedPhPatternRegexes.some(rx => rx.test(domain))) return true
    }

    // Also allow any domain that directly matches the allowed ph patterns
    if (allowedPhPatternRegexes.some(rx => rx.test(domain))) return true

    // not allowed by list/patterns
    return false
  }

  // Optional: live onBlur validation to show immediate hint
  const validateEmailOnBlur = () => {
    if (!newEmail) {
      setEmailError("")
      return
    }
    if (!isEmailFormatValid(newEmail)) {
      setEmailError("Please enter a valid email address")
      return
    }
    const domain = extractDomain(newEmail)
    if (!domain) {
      setEmailError("Please enter a valid email address")
      return
    }
    if (!isDomainAllowed(domain)) {
      setEmailError(
        "Enter a valid email (e.g., name@gmail.com)."
      )
      return
    }
    setEmailError("")
  }

  //
  // ---------- END EMAIL HELPERS ----------
  //

  // Filter users based on search query and role filter
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.username
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
    const matchesRole = roleFilter === "all" || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  // Pagination
  const itemsPerPage = 10
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex)

  // Reset to page 1 when search or filter changes
  const handleSearchChange = value => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  const handleRoleFilterChange = value => {
    setRoleFilter(value)
    setCurrentPage(1)
  }

  // Generate password based on username
  const generatePassword = () => {
    if (!newUsername) {
      toast.error("Enter a username first to generate password")
      return
    }

    const username = newUsername.toLowerCase()
    const numbers = Math.floor(Math.random() * 999) + 1
    const specialChars = ["!", "@", "#", "$", "%"][
      Math.floor(Math.random() * 5)
    ]

    const maxLength = 20
    const suffix = `${numbers}${specialChars}`
    const allowedUsernameLen = Math.max(0, maxLength - suffix.length)
    const usernameCut = username.slice(0, allowedUsernameLen)

    const generatedPassword = usernameCut + numbers + specialChars

    setNewPassword(generatedPassword)
    setConfirmPassword(generatedPassword)
    toast.success("Password generated successfully!")
  }

  const handleCreateUser = async () => {
    // Clear all errors
    setUsernameError("")
    setPasswordError("")
    setConfirmPasswordError("")
    setEmailError("")
    setRoleError("")

    let hasError = false

    // Validate username
    if (!newUsername) {
      setUsernameError("Username is required")
      hasError = true
    } else if (newUsername.length < 3) {
      setUsernameError("Username must be at least 3 characters")
      hasError = true
    } else if (
      users.some(
        user => user.username.toLowerCase() === newUsername.toLowerCase()
      )
    ) {
      setUsernameError("Username already exists")
      hasError = true
    }

    // Validate password
    if (!newPassword) {
      setPasswordError("Password is required")
      hasError = true
    } else if (newPassword.length < 6 || newPassword.length > 20) {
      setPasswordError("Password must be between 6 and 20 characters")
      hasError = true
    } else if (!passwordRegex.test(newPassword)) {
      setPasswordError(
        "Password must contain at least 1 letter, 1 number, and 1 special character"
      )
      hasError = true
    }

    // Validate confirm password
    if (!confirmPassword) {
      setConfirmPasswordError("Please confirm your password")
      hasError = true
    } else if (confirmPassword.length < 6 || confirmPassword.length > 20) {
      setConfirmPasswordError(
        "Confirm password must be between 6 and 20 characters"
      )
      hasError = true
    } else if (newPassword !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match")
      hasError = true
    }

    // Validate email (part-by-part)
    if (!newEmail) {
      setEmailError("Email is required")
      hasError = true
    } else {
      if (!isEmailFormatValid(newEmail)) {
        setEmailError("Please enter a valid email address")
        hasError = true
      } else {
        const domain = extractDomain(newEmail)
        if (!domain) {
          setEmailError("Please enter a valid email address")
          hasError = true
        } else if (!isDomainAllowed(domain)) {
          setEmailError(
            "Email domain not supported. Use common providers (gmail, yahoo, outlook) or a valid .ph domain (e.g., @school.edu.ph or @company.com.ph)."
          )
          hasError = true
        }
      }
    }

    // Validate role
    if (!newRole) {
      setRoleError("Please select a role")
      hasError = true
    }

    if (hasError) return

    try {
      setLoading(true)

      try {
        // Check if email already exists in auth.users - Include ONLY non-archived users in check
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
        const emailExists = existingUsers.users.some(user => 
          user.email === newEmail && 
          user.user_metadata?.status !== 'archived'
        );
        
        if (emailExists) {
          setEmailError("Email already exists");
          throw new Error("Email already exists");
        }

        // Check and clean up any existing pending confirmation for this email
        const { data: existingPending, error: checkPendingError } = await supabaseAdmin
          .from('pending_users')
          .select('email, created_at')
          .eq('email', newEmail);

        if (checkPendingError) {
          console.error('Error checking pending users:', checkPendingError);
        }

        if (existingPending?.length > 0) {
          // If there's a pending confirmation that's older than 24 hours, delete it
          const oldestPending = existingPending[0];
          const pendingAge = new Date() - new Date(oldestPending.created_at);
          const hoursPending = pendingAge / (1000 * 60 * 60);
          
          if (hoursPending > 24) {
            // Delete expired pending user
            const { error: deleteError } = await supabaseAdmin
              .from('pending_users')
              .delete()
              .eq('email', newEmail);
              
            if (deleteError) {
              console.error('Error deleting expired pending user:', deleteError);
            }
          } else {
            // If pending confirmation is less than 24 hours old, don't allow new registration
            setEmailError("This email already has a pending confirmation. Please check your email or wait 24 hours to try again.");
            throw new Error("Email has pending confirmation");
          }
        }

        // Store in pending_users table with the same id format as Auth.users
        const now = new Date();
        const expiresAt = new Date(now.getTime() + (24 * 60 * 60 * 1000)); // 24 hours from now
        
        // First initiate signup to get the user ID
        console.log('Initiating signup process to get user ID...');
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: newEmail,
          password: newPassword,
          options: {
            emailRedirectTo: import.meta.env.PROD
              ? 'https://shobe-printing-services.vercel.app/confirm'
              : 'http://localhost:5174/confirm',
            data: {
              username: newUsername,
              role: newRole,
              createdBy: currentUser?.username || "Admin User",
              status: 'pending_confirmation'
            }
          }
        });

        if (signUpError) {
          console.error('Signup error:', signUpError);
          throw new Error(`Failed to create user account: ${signUpError.message}`);
        }

        if (!signUpData?.user) {
          console.error('No user data returned from signup');
          throw new Error('Failed to create user account');
        }

        const pendingData = {
          id: signUpData.user.id,
          email: newEmail,
          metadata: {
            username: newUsername,
            role: newRole,
            created_by: currentUser?.username || "Admin User",
            status: 'pending_confirmation'
          },
          expires_at: expiresAt.toISOString()
        };

        console.log('Attempting to insert pending user:', { ...pendingData, email: '(redacted)' });
        
        // Insert into pending_users
        const { data, error: pendingError } = await supabaseAdmin
          .from('pending_users')
          .insert([pendingData])
          .select(); // Add select() to get more detailed error information
        
        if (pendingError) {
          console.error('Full error details:', pendingError);
          const errorMessage = pendingError.message || 'Failed to create pending user';
          // Check for specific error types
          if (pendingError.code === '23505') { // Unique violation
            throw new Error('A pending invitation already exists for this email');
          } else if (pendingError.code === '23503') { // Foreign key violation
            throw new Error('Invalid reference in pending user data');
          }
          throw new Error(errorMessage);
        }

        if (pendingError) {
          console.error('Error storing pending user:', pendingError);
          // Log the full error details
          console.error('Full error details:', {
            message: pendingError.message,
            details: pendingError.details,
            hint: pendingError.hint
          });
          throw new Error(pendingError.message || 'Failed to create pending user');
        }

        // Signup already completed above (we created the auth user and inserted pending_users).
        // Avoid calling `supabase.auth.signUp` a second time to prevent rate limits/security throttling.
        console.log('Signup initiated successfully (single flow).');
        console.log('User creation status:', {
          id: signUpData.user.id,
          emailConfirmed: signUpData.user.email_confirmed_at,
          hasMetadata: !!signUpData.user.user_metadata,
        });

        toast.success(
          'Account created! Please check your email (including spam folder) for the confirmation link.'
        );
      
      // Show success message
      } catch (error) {
        console.error('Error in user creation process:', error);
        throw error;
      }

      toast.success(
        `Account created and confirmation email sent to ${newEmail}. Please check your email to complete registration.`
      )

      // Reset form
      setNewUsername("")
      setNewPassword("")
      setConfirmPassword("")
      setNewEmail("")
      setNewRole("")
      setUsernameError("")
      setPasswordError("")
      setConfirmPasswordError("")
      setEmailError("")
      setRoleError("")
      setCreateDialog(false)

    } catch (error) {
      console.error("Error creating user:", error)
      toast.error(error.message || "Failed to create user")
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId, username) => {
    // Prevent deleting default admin account or current user's own account
    if (username === "shuee") {
      toast.error("Cannot delete default admin account")
      return
    }
    
    // Prevent deleting your own account
    if (userId === currentUser?.id) {
      toast.error("You cannot delete your own account")
      return
    }

    try {
      setLoading(true)

      // Get full user data from Supabase
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId)
      if (userError) throw userError

      // Archive the user data
      const { error: archiveError } = await supabaseAdmin
        .from('archived_users')
        .insert({
          id: userId,
          email: userData.user.email,
          username: userData.user.user_metadata?.username || userData.user.email,
          role: userData.user.user_metadata?.role || 'Staff',
          created_at: userData.user.created_at,
          archived_by: currentUser.id,
          archived_by_username: currentUser.username,
          reason: "No longer part of Shobe Printing Services",
          user_metadata: userData.user.user_metadata
        })

      if (archiveError) throw archiveError

      // Attempt to delete the user's profile row from the `profiles` table.
      // Use `.select()` on the delete call so we can check how many rows were removed.
      // Try common column names (`id`, then `user_id`) and log results.
      let deletedCount = 0
      let deleteError = null

      try {
        const { data: deletedById, error: deleteByIdError } = await supabaseAdmin
          .from('profiles')
          .delete()
          .eq('id', userId)
          .select('id')

        if (deleteByIdError) {
          console.warn('Error deleting profile by id:', deleteByIdError)
          deleteError = deleteByIdError
        } else {
          deletedCount = (deletedById && deletedById.length) || 0
        }

        // If nothing deleted by `id`, try `user_id` as a fallback
        if (deletedCount === 0) {
          const { data: deletedByUserId, error: deleteByUserIdError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('user_id', userId)
            .select('user_id')

          if (deleteByUserIdError) {
            console.warn('Error deleting profile by user_id fallback:', deleteByUserIdError)
            // prefer to keep the last error
            deleteError = deleteByUserIdError
          } else {
            deletedCount = (deletedByUserId && deletedByUserId.length) || deletedCount
          }
        }
      } catch (err) {
        // Unexpected runtime error talking to Supabase
        console.error('Unexpected error while deleting profile:', err)
        deleteError = err
      }

      if (deleteError && deletedCount === 0) {
        // If both attempts errored / no rows deleted, log and continue rather than failing the whole flow.
        console.warn('Profile deletion did not succeed for user:', userId, deleteError)
        // Optionally you could toast a warning here to alert admins, but we'll keep UX consistent.
      } else if (deletedCount > 0) {
        console.log(`Deleted ${deletedCount} profile row(s) for user ${userId}`)
      } else {
        // No error but also no rows deleted — profile may not exist. Log for debugging.
        console.log('No profile row found for user', userId)
      }

      // Disable the user's login ability without deleting them
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
        userId,
        { 
          ban_duration: '999999h',
          user_metadata: {
            ...userData.user.user_metadata,
            status: 'archived'
          }
        }
      )

      if (updateError) throw updateError

      // Update local state
  setUsers(prev => prev.filter(user => user.id !== userId))
  toast.success(`User ${username} archived successfully`)

  // Refresh the user list from the server to ensure UI matches Supabase state
  // (fetchUsers already filters archived users)
  await fetchUsers()

    } catch (error) {
      console.error('Error archiving user:', error)
      toast.error('Failed to archive user: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const getRoleIcon = role => {
    return role === "Admin" ? (
      <Shield className="h-4 w-4" />
    ) : (
      <User className="h-4 w-4" />
    )
  }

  const getRoleBadgeColor = role => {
    return role === "Admin"
      ? "bg-blue-100 text-blue-800"
      : "bg-green-100 text-green-800"
  }

  return (
    <div className="bg-white h-full flex flex-col">
      <PageHeader
        title="User Management"
        currentUser={currentUser}
        onLogout={onLogout}
        showNotifications={true}
        lowStockItems={lowStockItems}
        onNavigateToAccount={onNavigateToAccount}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-gray-600 mt-1">
              Create and manage user accounts and roles
            </p>
          </div>
          <Dialog open={createDialog} onOpenChange={setCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Create User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New User Account</DialogTitle>
                <DialogDescription>
                  Create a new user account for the inventory management system.
                  The login credentials will be automatically sent to the new
                  staff member via email.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="Enter username"
                    value={newUsername}
                    onChange={e => {
                      setNewUsername(e.target.value)
                      setUsernameError("")
                    }}
                    className={usernameError ? "border-red-500" : ""}
                  />
                  {usernameError ? (
                    <span className="text-sm text-red-600">
                      {usernameError}
                    </span>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Minimum 3 characters
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter password"
                        value={newPassword}
                        maxLength={20}
                        onChange={e => {
                          setNewPassword(e.target.value)
                          setPasswordError("")
                        }}
                        className={
                          passwordError ? "border-red-500 pr-10" : "pr-10"
                        }
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
                    <Button
                      type="button"
                      variant="outline"
                      onClick={generatePassword}
                      className="px-3"
                      title="Generate Password"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </div>
                  {passwordError ? (
                    <span className="text-sm text-red-600">
                      {passwordError}
                    </span>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Minimum 6 characters • Click refresh to generate password
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      maxLength={20}
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
                      onClick={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }
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
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter email address"
                    value={newEmail}
                    onChange={e => {
                      setNewEmail(e.target.value)
                      setEmailError("")
                    }}
                    onBlur={validateEmailOnBlur}
                    className={emailError ? "border-red-500" : ""}
                  />
                  {emailError ? (
                    <span className="text-sm text-red-600">{emailError}</span>
                  ) : (
                    <p className="text-sm text-gray-500">
                      Login credentials will be sent to this email address
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={newRole}
                    onValueChange={value => {
                      setNewRole(value)
                      setRoleError("")
                    }}
                  >
                    <SelectTrigger
                      className={roleError ? "border-red-500" : ""}
                    >
                      <SelectValue placeholder="Select user role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Admin - Full Access
                        </div>
                      </SelectItem>
                      <SelectItem value="Staff">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          Staff - Limited Access
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {roleError ? (
                    <span className="text-sm text-red-600">{roleError}</span>
                  ) : (
                    <div className="text-sm text-gray-500 space-y-1">
                      <p>
                        <strong>Admin:</strong> Can manage inventory, view
                        reports, and manage users
                      </p>
                      <p>
                        <strong>Staff:</strong> Can use stock and view
                        transaction history
                      </p>
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateUser} className="flex-1">
                    Create Account
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCreateDialog(false)
                      setNewUsername("")
                      setNewPassword("")
                      setConfirmPassword("")
                      setNewEmail("")
                      setNewRole("")
                      setUsernameError("")
                      setPasswordError("")
                      setConfirmPasswordError("")
                      setEmailError("")
                      setRoleError("")
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search Bar and Role Filter */}
        <div className="mb-6 flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by username..."
              value={searchQuery}
              onChange={e => handleSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 whitespace-nowrap">
              Filter by Role:
            </label>
            <Select
              value={roleFilter}
              onValueChange={value => handleRoleFilterChange(value)}
            >
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>User Accounts</CardTitle>
            <CardDescription>
              {filteredUsers.length} of {users.length} users shown
              {searchQuery && ` • Filtered by: "${searchQuery}"`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">ID</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="w-32">Role</TableHead>
                  <TableHead className="w-32">Created</TableHead>
                  <TableHead className="w-24 text-center">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center py-8 text-gray-500"
                    >
                      {searchQuery ? (
                        <>No users found matching "{searchQuery}"</>
                      ) : (
                        <>
                          No user accounts found. Create your first user account
                          to get started.
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell className="font-mono text-sm">
                        {user.id}
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{user.username}</span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={`text-xs ${getRoleBadgeColor(
                            user.role
                          )} border-0`}
                        >
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {user.createdAt}
                      </TableCell>
                      <TableCell className="text-center">
                        {user.username !== "shuee" && user.id !== currentUser?.id ? (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 w-8 p-0"
                                title={user.id === currentUser?.id ? "Cannot delete your own account" : "Delete user"}
                              >
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete User Account
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete the user
                                  account for "{user.username}"? This action
                                  cannot be undone and the user will lose access
                                  to the system.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() =>
                                    handleDeleteUser(user.id, user.username)
                                  }
                                  className="bg-red-600 hover:bg-red-700"
                                >
                                  Delete User
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {user.username === "shuee" ? "Protected" : "Current User"}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
          {totalPages > 1 && (
            <div className="flex justify-end p-4 border-t">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      className={
                        currentPage === 1
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                    page => {
                      if (
                        page === 1 ||
                        page === totalPages ||
                        (page >= currentPage - 1 && page <= currentPage + 1)
                      ) {
                        return (
                          <PaginationItem key={page}>
                            <PaginationLink
                              onClick={() => setCurrentPage(page)}
                              isActive={currentPage === page}
                              className="cursor-pointer"
                            >
                              {page}
                            </PaginationLink>
                          </PaginationItem>
                        )
                      } else if (
                        page === currentPage - 2 ||
                        page === currentPage + 2
                      ) {
                        return <PaginationEllipsis key={page} />
                      }
                      return null
                    }
                  )}
                  <PaginationItem>
                    <PaginationNext
                      onClick={() =>
                        setCurrentPage(p => Math.min(totalPages, p + 1))
                      }
                      className={
                        currentPage === totalPages
                          ? "pointer-events-none opacity-50"
                          : "cursor-pointer"
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">Role Permissions</CardTitle>
            <CardDescription>
              Overview of what each role can access in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <h4 className="font-medium text-gray-900">Admin Role</h4>
                </div>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Edit and update inventory quantities</li>
                  <li>• Add new stock items</li>
                  <li>• View detailed reports and analytics</li>
                  <li>• Manage user accounts</li>
                  <li>• View transaction history</li>
                  <li>• Configure system settings</li>
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <User className="h-5 w-5 text-green-600" />
                  <h4 className="font-medium text-gray-900">Staff Role</h4>
                </div>
                <ul className="space-y-1 text-sm text-gray-600">
                  <li>• Use stock for jobs and clients</li>
                  <li>• View inventory overview</li>
                  <li>• Receive low stock notifications</li>
                  <li>• View transaction history</li>
                  <li>• Limited to operational tasks</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// Export protected version of the component
export function UserManagement(props) {
  return (
    <Protected 
      permission={PERMISSIONS.MANAGE_USERS}
      fallback={
        <div className="flex items-center justify-center h-screen bg-white">
          <div className="text-center p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600">You don't have permission to access User Management.</p>
            <p className="text-gray-500 text-sm mt-1">This feature is only available to administrators.</p>
          </div>
        </div>
      }
    >
      <UserManagementContent {...props} />
    </Protected>
  )
}

