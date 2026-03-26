import { useAuth } from '../contexts/AuthContext'
import { hasPermission, PERMISSIONS } from '../lib/permissions'

export function Protected({ 
  children, 
  permission,
  requiredPermissions = [], 
  fallback = null 
}) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return <div>Loading...</div>
  }

  // Convert single permission to array if provided
  const permissions = permission ? [permission] : requiredPermissions
  
  // Check if user has any of the required permissions
  const hasAccess = permissions.length === 0 || 
    permissions.some(perm => hasPermission(user?.role, perm))

  if (!hasAccess) {
    return fallback || (
      <div className="p-4 text-center">
        <h3 className="text-lg font-medium text-red-600">Access Denied</h3>
        <p className="mt-1 text-sm text-gray-600">
          You don't have permission to view this content.
        </p>
      </div>
    )
  }

  return children
}

export default Protected