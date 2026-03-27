// Define available roles
export const ROLES = {
  ADMIN: 'Admin',
  STAFF: 'Staff'
}

// Define permissions for each component/feature
export const PERMISSIONS = {
  VIEW_DASHBOARD: 'view:dashboard',
  VIEW_TRANSACTIONS: 'view:transactions',
  VIEW_INVENTORY: 'view:inventory',
  MANAGE_STOCK: 'manage:stock',
  VIEW_REPORTS: 'view:reports',
  MANAGE_USERS: 'manage:users',
  VIEW_ARCHIVE: 'view:archive',
  MANAGE_ACCOUNT: 'manage:account',
  USE_PRINT_SERVICE: 'use:print-service'
}

// Define which roles have which permissions
export const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_TRANSACTIONS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_STOCK,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_ARCHIVE,
    PERMISSIONS.MANAGE_ACCOUNT,
    PERMISSIONS.USE_PRINT_SERVICE
  ],
  [ROLES.STAFF]: [
    PERMISSIONS.VIEW_TRANSACTIONS,
    PERMISSIONS.VIEW_INVENTORY,
    PERMISSIONS.MANAGE_ACCOUNT,
    PERMISSIONS.USE_PRINT_SERVICE
  ],
  // Add a default role for users who haven't been assigned a role yet
  'default': [
    PERMISSIONS.MANAGE_ACCOUNT
  ]
}

// Helper to check if a role has a specific permission
export function hasPermission(role, permission) {
  // Check role-specific permissions first
  if (role && ROLE_PERMISSIONS[role]?.includes(permission)) {
    return true
  }
  // Check default permissions for users without roles
  return ROLE_PERMISSIONS['default']?.includes(permission) ?? false
}

// Helper to check if a role has any of the given permissions
export function hasAnyPermission(role, permissions) {
  return permissions.some(permission => hasPermission(role, permission))
}

// Helper to check if a role has all of the given permissions
export function hasAllPermissions(role, permissions) {
  return permissions.every(permission => hasPermission(role, permission))
}

// Map components to required permissions
export const COMPONENT_PERMISSIONS = {
  'dashboard': [PERMISSIONS.VIEW_DASHBOARD],
  'transaction-history': [PERMISSIONS.VIEW_TRANSACTIONS],
  'inventory-overview': [PERMISSIONS.VIEW_INVENTORY],
  'add-stock': [PERMISSIONS.MANAGE_STOCK],
  'reports': [PERMISSIONS.VIEW_REPORTS],
  'user-management': [PERMISSIONS.MANAGE_USERS],
  'archive': [PERMISSIONS.VIEW_ARCHIVE],
  'account': [PERMISSIONS.MANAGE_ACCOUNT],
  'print-service': [PERMISSIONS.USE_PRINT_SERVICE]
}