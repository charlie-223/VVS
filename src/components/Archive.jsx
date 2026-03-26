import { useState, useEffect } from "react"
import { PageHeader } from "./PageHeader"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "./ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "./ui/table"
import { Badge } from "./ui/badge"
import { supabaseAdmin } from "../lib/supabaseClient"
import { toast } from "sonner"

export function Archive({
  currentUser,
  onLogout,
  lowStockItems = [],
  onNavigateToAccount
}) {
  const [loading, setLoading] = useState(true)
  const [archivedUsers, setArchivedUsers] = useState([])
  const [pendingInvites, setPendingInvites] = useState([])
  const [cleanupInProgress, setCleanupInProgress] = useState(false)

  // Fetch archived users and pending invites from Supabase
  useEffect(() => {
    fetchArchivedUsers()
    fetchPendingInvites()
    cleanupOldArchivedUsers() // Check for users to delete on component mount
  }, [])

  // Function to delete users that have been archived for more than 30 days
  const cleanupOldArchivedUsers = async () => {
    try {
      if (cleanupInProgress) return // Prevent concurrent cleanup runs
      setCleanupInProgress(true)

      // Get all archived users to check dates manually
      const { data: allUsers, error: fetchError } = await supabaseAdmin
        .from('archived_users')
        .select('id, username, archived_at')
        .order('archived_at', { ascending: true })

      if (fetchError) {
        console.error('Error fetching archived users:', fetchError)
        return
      }

      console.log('Checking archived users for deletion...')
      
      // Calculate cutoff date (30 days ago) in UTC
      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000))
      const cutoffTimestamp = thirtyDaysAgo.toISOString()
      console.log('Current time (UTC):', now.toISOString())
      console.log('Cutoff date for deletion (UTC):', cutoffTimestamp)
      
      // Filter users archived more than 30 days ago
      const oldUsers = allUsers.filter(user => {
        // Parse the timestamp (keeping UTC)
        const archivedDate = new Date(user.archived_at)
        const archivedTimestamp = archivedDate.toISOString()
        
        // Compare the raw ISO strings (they're already in UTC)
        const isOld = archivedTimestamp < cutoffTimestamp
        
        console.log(`Checking user archived date:`)
        console.log(`- User: ${user.username}`)
        console.log(`- Archived: ${archivedTimestamp}`)
        console.log(`- Cutoff:  ${cutoffTimestamp}`)
        console.log(`- Status: ${isOld ? 'OLD - WILL DELETE' : 'RECENT - KEEPING'}`)
        console.log('---')
        
        return isOld
      })

      if (fetchError) throw fetchError

      if (!oldUsers || oldUsers.length === 0) {
        console.log('No archived users older than 30 days found')
        return
      }

      console.log(`Found ${oldUsers.length} users archived > 30 days ago to delete`)

      // Delete each old user
      for (const user of oldUsers) {
        try {
          // Delete from Supabase Auth
          const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(
            user.id
          )
          if (authError) {
            console.error(`Failed to delete auth user ${user.username}:`, authError)
            continue
          }

          // Remove from archived_users table
          const { error: archiveError } = await supabaseAdmin
            .from('archived_users')
            .delete()
            .match({ id: user.id })

          if (archiveError) {
            console.error(`Failed to delete archived record for ${user.username}:`, archiveError)
            continue
          }

          console.log(`Successfully deleted archived user ${user.username} (archived on ${new Date(user.archived_at).toLocaleDateString()})`)
        } catch (err) {
          console.error(`Error processing deletion for user ${user.username}:`, err)
        }
      }

      // Refresh the archived users list
      await fetchArchivedUsers()

    } catch (error) {
      console.error('Error during archived users cleanup:', error)
    } finally {
      setCleanupInProgress(false)
    }
  }

  const fetchArchivedUsers = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabaseAdmin
        .from('archived_users')
        .select('*')
        .order('archived_at', { ascending: false })

      if (error) throw error

      const formattedUsers = data.map(user => ({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: new Date(user.created_at).toLocaleDateString(),
        archivedAt: new Date(user.archived_at).toLocaleDateString(),
        archivedBy: user.archived_by_username,
        reason: user.reason
      }))

      setArchivedUsers(formattedUsers)
    } catch (error) {
      console.error('Error fetching archived users:', error)
      toast.error('Failed to load archived users')
    } finally {
      setLoading(false)
    }
  }

  const fetchPendingInvites = async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('pending_users')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedInvites = data.map(invite => {
        const metadata = invite.metadata || {}
        // Calculate expiration status
        const isExpired = new Date(invite.expires_at) < new Date()
        return {
          id: invite.id,
          email: invite.email,
          role: metadata.role || 'Staff',
          username: metadata.username || invite.email.split('@')[0],
          createdAt: new Date(invite.created_at).toLocaleString(),
          expiresAt: new Date(invite.expires_at).toLocaleString(),
          status: isExpired ? 'Expired' : 'Pending',
          createdBy: metadata.createdBy || 'Unknown'
        }
      })

      setPendingInvites(formattedInvites)
    } catch (error) {
      console.error('Error fetching pending invites:', error)
      toast.error('Failed to load pending invites')
    }
  }

  const handleResendInvite = async (email) => {
    try {
      // Get the pending user data
      const { data: pendingData } = await supabaseAdmin
        .from('pending_users')
        .select('*')
        .eq('email', email)
        .single()

      if (!pendingData) {
        throw new Error('Pending invite not found')
      }

      // Resend the invite using signUp
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password: null, // Will trigger password-less signup
        options: {
          data: {
            role: pendingData.metadata?.role || 'Staff',
            username: pendingData.metadata?.username || email.split('@')[0]
          }
        }
      })

      if (signUpError) throw signUpError

      // Update the expiration time
      const newExpiryDate = new Date()
      newExpiryDate.setHours(newExpiryDate.getHours() + 24) // 24 hour expiry

      const { error: updateError } = await supabaseAdmin
        .from('pending_users')
        .update({ expires_at: newExpiryDate.toISOString() })
        .eq('email', email)

      if (updateError) throw updateError

      toast.success('Invite resent successfully')
      await fetchPendingInvites() // Refresh the list
    } catch (error) {
      console.error('Error resending invite:', error)
      toast.error('Failed to resend invite')
    }
  }

  const getRoleBadgeColor = role => {
    return role === "Admin"
      ? "bg-blue-100 text-blue-800"
      : "bg-green-100 text-green-800"
  }

  const getStatusBadgeColor = status => {
    switch (status.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'expired':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="bg-white h-full flex flex-col">
      <PageHeader
        title="Archive"
        currentUser={currentUser}
        onLogout={onLogout}
        showNotifications={true}
        lowStockItems={lowStockItems}
        onNavigateToAccount={onNavigateToAccount}
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <p className="text-gray-600 mt-1">
            View pending invites and users who are no longer part of Shobe Printing Services
          </p>
        </div>

        {/* Pending Invites Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Pending Invites</CardTitle>
            <CardDescription>
              {pendingInvites.length} pending invite
              {pendingInvites.length !== 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead className="w-24">Role</TableHead>
                  <TableHead className="w-40">Created</TableHead>
                  <TableHead className="w-40">Expires</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-32">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingInvites.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-gray-500"
                    >
                      No pending invites
                    </TableCell>
                  </TableRow>
                ) : (
                  pendingInvites.map(invite => (
                    <TableRow key={invite.id}>
                      <TableCell>{invite.email}</TableCell>
                      <TableCell>{invite.username}</TableCell>
                      <TableCell>
                        <Badge className={`${getRoleBadgeColor(invite.role)} border-0`}>
                          {invite.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {invite.createdAt}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {invite.expiresAt}
                      </TableCell>
                      <TableCell>
                        <Badge className={`${getStatusBadgeColor(invite.status)} border-0`}>
                          {invite.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {invite.status === 'Expired' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResendInvite(invite.email)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Resend
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Archived Users Card */}
        <Card>
          <CardHeader>
            <CardTitle>Archived Users</CardTitle>
            <CardDescription>
              {archivedUsers.length} archived user
              {archivedUsers.length !== 1 ? "s" : ""}
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
                  <TableHead className="w-32">Archived</TableHead>
                  <TableHead className="w-32">Archived By</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {archivedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-gray-500"
                    >
                      No archived users found
                    </TableCell>
                  </TableRow>
                ) : (
                  archivedUsers.map(user => (
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
                      <TableCell className="text-sm text-gray-600">
                        {user.archivedAt}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {user.archivedBy}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {user.reason || "No reason provided"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
