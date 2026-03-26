import { useState, useEffect } from "react"
import { supabaseAdmin } from "../lib/supabaseClient"
import { LogOut, Bell } from "lucide-react"
import { Button } from "./ui/button"
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
import { AlertTriangle } from "lucide-react"
import { Badge } from "./ui/badge"

export function PageHeader({
  title,
  currentUser,
  onLogout,
  showNotifications = false,
  lowStockItems = [],
  onNavigateToAccount
}) {
  const [currentDateTime, setCurrentDateTime] = useState(new Date())
  const [notificationDialog, setNotificationDialog] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentDateTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  const formatDate = date => {
    return date.toLocaleDateString("en-US", {
      month: "numeric",
      day: "numeric",
      year: "numeric"
    })
  }

  const formatTime = date => {
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true
    })
  }

  const [notificationDialogOpen, setNotificationDialogOpen] = useState(false)
  const [dbLowStockItems, setDbLowStockItems] = useState([])
  const [dbLoaded, setDbLoaded] = useState(false)

  // Fetch low-stock items from both inventory and inventory_catalog
  useEffect(() => {
    let mounted = true

    const fetchLowStockFromDB = async () => {
      if (!supabaseAdmin) return
      try {
        // Get current inventory items and their status
        const { data: invData, error: invError } = await supabaseAdmin
          .from('inventory')
          .select('id, name, quantity, unit, reorder_level, sku')
          .order('name')

        if (invError) {
          console.warn('Failed to fetch inventory for notifications:', invError)
          return
        }

        // Get items from catalog that have been in inventory before
        const { data: catData, error: catError } = await supabaseAdmin
          .from('inventory_catalog')
          .select('id, name, unit, reorder_level, sku')
          .not('sku', 'is', null) // Only get items that have been in inventory before (have SKU)
          .order('name')

        if (catError) {
          console.warn('Failed to fetch catalog for notifications:', catError)
          return
        }

        // Format inventory items
        const invAlerts = (invData || [])
          .map(item => ({
            id: item.id,
            name: item.name,
            quantity: parseFloat(item.quantity) || 0,
            unit: item.unit || '',
            reorderLevel: item.reorder_level != null ? parseFloat(item.reorder_level) : null,
            sku: item.sku || '',
            source: 'inventory'
          }))
          .filter(item => {
            // If reorderLevel is not provided, skip it
            if (item.reorderLevel == null) return false
            return item.quantity <= item.reorderLevel
          })
          .map(item => ({
            ...item,
            status: item.quantity === 0 ? 'Out of Stock' : 'Low Stock'
          }))

        // Get current inventory item names
        const activeItemNames = new Set(invData.map(i => i.name.toLowerCase().trim()))

        // Format catalog items (only include if name not in current inventory)
        const catAlerts = (catData || [])
          .filter(item => !activeItemNames.has(item.name.toLowerCase().trim())) // Filter out items that exist in inventory by name
          .map(item => ({
            id: item.id,
            name: item.name,
            quantity: 0,
            unit: item.unit || '',
            reorderLevel: item.reorder_level != null ? parseFloat(item.reorder_level) : null,
            sku: item.sku || '',
            status: 'Out of Stock',
            source: 'catalog'
          }))
          .filter(item => item.reorderLevel != null) // Keep same filtering logic as inventory

        // Deduplicate alerts by item name, preferring inventory source over catalog
        const uniqueAlerts = Object.values(
          [...invAlerts, ...catAlerts].reduce((acc, alert) => {
            const key = alert.name.toLowerCase().trim()
            // If this name already exists, only replace if current is from inventory and existing is from catalog
            if (!acc[key] || (alert.source === 'inventory' && acc[key].source === 'catalog')) {
              acc[key] = alert
            }
            return acc
          }, {})
        )

        if (mounted) {
          setDbLowStockItems(uniqueAlerts)
          setDbLoaded(true)
        }
      } catch (err) {
        console.error('Error fetching low-stock items from DB:', err)
      }
    }

    fetchLowStockFromDB()

    // Set up real-time subscription to watch both inventory and catalog changes
    let channel
    try {
      channel = supabaseAdmin
        .channel('stock-alerts')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'inventory' },
          () => fetchLowStockFromDB()
        )
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'inventory_catalog' },
          () => fetchLowStockFromDB()
        )
        .subscribe()
    } catch (e) {
      // older client fallback or if supabaseAdmin not available
    }

    return () => {
      mounted = false
      try {
        if (channel && channel.unsubscribe) channel.unsubscribe()
      } catch (e) {}
    }
  }, [])

  // Close notification dialog automatically when there are no low-stock items
  useEffect(() => {
    const count = dbLoaded ? (dbLowStockItems?.length || 0) : (lowStockItems?.length || 0)
    if (count === 0) setNotificationDialogOpen(false)
  }, [dbLowStockItems, dbLoaded, lowStockItems])

  // Determine the authoritative alert count (prefer DB when loaded)
  const alertCount = dbLoaded ? (dbLowStockItems?.length || 0) : (lowStockItems?.length || 0)

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-4">
        {showNotifications && (
          <Dialog
            open={notificationDialogOpen}
            onOpenChange={setNotificationDialogOpen}
          >
                <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="relative p-2">
                <Bell className="w-4 h-4 text-gray-600" />
                {alertCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {alertCount}
                  </span>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Stock Alerts
                </DialogTitle>
                <DialogDescription>
                  Items that need attention due to low or out of stock levels.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {(() => {
                  const displayedItems = dbLoaded ? (dbLowStockItems || []) : (lowStockItems || [])
                  if (!displayedItems || displayedItems.length === 0) {
                    return (
                      <p className="text-sm text-gray-600">All items are in good stock levels!</p>
                    )
                  }

                  return displayedItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">{item.name}</p>
                        <p className="text-sm text-gray-600">
                          Current: {item.quantity} {item.unit} | Reorder at: {" "}
                          {item.reorderLevel ?? ''} {item.unit}
                        </p>
                      </div>
                      <Badge
                        className={`text-xs ${
                          item.status === "Low Stock"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-red-100 text-red-800"
                        } border-0`}
                      >
                        {item.status}
                      </Badge>
                    </div>
                  ))
                })()}
              </div>
            </DialogContent>
          </Dialog>
        )}

        <div className="flex items-center gap-2 text-sm text-gray-600">
          <span>{currentUser?.role?.toUpperCase() || "USER"}</span>
          <span>•</span>
          <button
            onClick={onNavigateToAccount}
            className="hover:text-blue-600 hover:underline cursor-pointer"
          >
            {currentUser?.username?.toUpperCase() || "UNKNOWN"}
          </button>
        </div>

        <div className="text-sm text-gray-900">
          {formatDate(currentDateTime)} {formatTime(currentDateTime)}
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              className="bg-red-600 hover:bg-red-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to logout? You will need to sign in again
                to access the system.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={onLogout}
                className="bg-red-600 hover:bg-red-700"
              >
                Logout
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
