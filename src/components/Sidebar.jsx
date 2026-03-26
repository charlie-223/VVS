import {
  Archive,
  Plus,
  History,
  FileText,
  Users,
  BarChart3,
  Building2,
  ArchiveX
} from "lucide-react"
import vvsLogo from "../assets/vvsLogo.jpg"

export function Sidebar({ activeView, onViewChange, currentUser }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: BarChart3, roles: ["Admin"] },
    {
      id: "inventory",
      label: "Inventory",
      icon: Archive,
      roles: ["Admin", "Staff"]
    },
    { id: "add-stock", label: "Add Stock", icon: Plus, roles: ["Admin"] },
    {
      id: "history",
      label: "History",
      icon: History,
      roles: ["Admin", "Staff"]
    },
    { id: "reports", label: "Reports", icon: FileText, roles: ["Admin"] },
    {
      id: "user-management",
      label: "User Management",
      icon: Users,
      roles: ["Admin"]  // Only Admin can access User Management
    },
    { id: "archive", label: "Archive", icon: ArchiveX, roles: ["Admin"] }
  ]

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(
    item => currentUser && item.roles.includes(currentUser.role)
  )

  return (
    <div className="w-48 bg-gray-50 h-screen flex flex-col fixed left-0 top-0 z-40 border-r border-gray-200">
      {/* Logo/Brand */}
      <div className="p-4 flex-shrink-0 border-b border-gray-200">
        <div className="w-full flex flex-col items-center gap-2">
          <div className="w-16 h-16 flex items-center justify-center">
            <img
              src={vvsLogo}
              alt="VVS Logo"
              className="w-20 h-20 object-contain"
            />
          </div>
          <div className="text-center">
            <h2 className="text-sm font-semibold text-gray-900">
              Shobe Printing
            </h2>
            <p className="text-xs text-gray-500">Inventory System</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-2 py-4 overflow-y-auto">
        {filteredMenuItems.map(item => {
          const Icon = item.icon
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg mb-2 transition-colors text-left ${
                isActive
                  ? "bg-blue-100 text-blue-900 border-l-4 border-blue-600"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Copyright */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0 bg-gray-100">
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © 2025 Shobe Printing Services
          </p>
          <p className="text-xs text-gray-400 mt-1">All rights reserved</p>
        </div>
      </div>
    </div>
  )
}
