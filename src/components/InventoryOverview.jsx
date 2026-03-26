import { useState, useEffect } from "react"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { supabaseAdmin } from "../lib/supabaseClient"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from "./ui/dialog"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { toast } from "sonner"
import { Edit, Search } from "lucide-react"
import { PageHeader } from "./PageHeader"
import { MATERIALS } from "../config/material"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "./ui/pagination"

export function InventoryOverview({
  currentUser,
  onLogout,
  lowStockItems = [],
  onNavigateToAccount
}) {
  const [inventory, setInventory] = useState([])
  const [loading, setLoading] = useState(true)
  const [useStockDialog, setUseStockDialog] = useState({ open: false })
  const [editStockDialog, setEditStockDialog] = useState({ open: false })
  const [useQuantity, setUseQuantity] = useState("")
  const [useNote, setUseNote] = useState("")
  const [editQuantity, setEditQuantity] = useState("")
  const [editReorderLevel, setEditReorderLevel] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch inventory data from Supabase
  useEffect(() => {
    fetchInventory()
  }, [])

  const fetchInventory = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabaseAdmin
        .from('inventory')
        .select('*')
        .order('date_added', { ascending: false })

      if (error) throw error

      const formattedInventory = data.map(item => ({
        id: item.id,
        // Preserve the full name column exactly as returned from the DB
        name: item.name,
        // Keep size if there's an explicit column (may be empty)
        size: item.size || '',
        quantity: parseFloat(item.quantity),
        unit: item.unit,
        reorderLevel: item.reorder_level,
        status: item.status,
        isNew: item.is_new,
        dateAdded: new Date(item.date_added).toLocaleDateString(),
        sku: item.sku
      }))

      setInventory(formattedInventory)
    } catch (error) {
      console.error('Error fetching inventory:', error)
      toast.error('Failed to load inventory items')
    } finally {
      setLoading(false)
    }
  }

  // Archive an inventory row (move to archived_items) and delete from inventory
  const archiveAndDelete = async (inventoryId, archivedByUserId, reason) => {
    try {
      // Fetch the full inventory row so we have all original fields (including date_added)
      const { data: invRow, error: fetchErr } = await supabaseAdmin
        .from('inventory')
        .select('*')
        .eq('id', inventoryId)
        .single()

      if (fetchErr) throw fetchErr

      // Try to find matching catalog row by SKU (optional)
      let catalogId = null
      if (invRow && invRow.sku) {
        try {
          const { data: catRow, error: catErr } = await supabaseAdmin
            .from('inventory_catalog')
            .select('id')
            .eq('sku', invRow.sku)
            .maybeSingle()
          if (catErr) console.warn('Error fetching catalog id for archiving:', catErr)
          if (catRow && catRow.id) catalogId = catRow.id
        } catch (e) {
          console.warn('Unexpected error looking up catalog id:', e)
        }
      }

      // Build archive payload. Use original date_added when available.
      // Build archive payload. Do NOT include `inventory_id` if the DB schema
      // no longer contains that column (some deployments remove it). Keep
      // fields conservative to reduce chance of a 400 Bad Request from Supabase.
      const payload = {
        name: invRow.name,
        size: invRow.size || null,
        unit: invRow.unit || null,
        reorder_level: invRow.reorder_level || null,
        sku: invRow.sku || null,
        last_quantity: invRow.quantity || 0,
        date_added: invRow.date_added || null,
        archived_at: new Date().toISOString(),
        archived_by: archivedByUserId || null,
        archived_reason: reason || null,
        catalog_id: catalogId || null
      }

      const { data: archivedRow, error: archiveErr } = await supabaseAdmin
        .from('archived_items')
        .insert(payload)
        .select()
        .maybeSingle()

      if (archiveErr) {
        // Log detailed error for debugging and rethrow so caller can handle it
        console.error('Failed to insert into archived_items:', archiveErr, 'payload:', payload)
        throw archiveErr
      }

      // Delete the original inventory row
      const { error: deleteErr } = await supabaseAdmin
        .from('inventory')
        .delete()
        .eq('id', inventoryId)

      if (deleteErr) {
        // Attempt to rollback the archived insert if delete fails
        try {
          if (archivedRow && archivedRow.id) {
            await supabaseAdmin.from('archived_items').delete().eq('id', archivedRow.id)
          }
        } catch (rollbackErr) {
          console.error('Failed to rollback archived_items after delete failure:', rollbackErr)
        }
        throw deleteErr
      }

      return archivedRow
    } catch (err) {
      console.error('archiveAndDelete error:', err)
      throw err
    }
  }

  // Update inventory_catalog row identified by SKU with given fields. Non-fatal: logs but does not throw.
  const updateCatalogBySku = async (sku, updates) => {
    if (!sku) return null
    try {
      const { data, error } = await supabaseAdmin
        .from('inventory_catalog')
        .update(updates)
        .eq('sku', sku)
        .select()
        .maybeSingle()

      if (error) {
        console.warn('Failed to update inventory_catalog for SKU', sku, error)
        return null
      }
      return data
    } catch (e) {
      console.warn('Unexpected error updating inventory_catalog for SKU', sku, e)
      return null
    }
  }

  const isStaff = currentUser?.role === "Staff"
  const isAdmin = currentUser?.role === "Admin"

  function getStatusColor(item) {
    if (item.isNew) {
      return "bg-green-100 text-green-800 border-green-300"
    }
    switch (item.status) {
      case "In Stock":
        return "bg-yellow-100 text-yellow-800 border-yellow-300"
      case "Low Stock":
        return "bg-orange-100 text-orange-800 border-orange-300"
      case "Out of Stock":
        return "bg-red-100 text-red-800 border-red-300"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  function getStatusLabel(item) {
    if (item.isNew) return "New"
    return item.status
  }

  const openUseDialog = item => {
    setUseStockDialog({ open: true, item })
    setUseQuantity("")
    setUseNote("")
  }

  const openEditDialog = item => {
    setEditStockDialog({ open: true, item })
    setEditQuantity(item.quantity.toString())
    setEditReorderLevel(item.reorderLevel.toString())
  }

  const handleUse = async () => {
    const item = useStockDialog.item
    if (!item || !useQuantity || !useNote) {
      toast.error("Please enter quantity and note")
      return
    }
    const qty = parseFloat(useQuantity)
    if (isNaN(qty) || qty <= 0) {
      toast.error("Quantity must be greater than 0")
      return
    }
    if (qty > item.quantity) {
      toast.error("Cannot use more than available quantity")
      return
    }

    try {
      const remaining = parseFloat((item.quantity - qty).toFixed(2))
      const status = remaining <= item.reorderLevel 
        ? remaining === 0 ? 'Out of Stock' : 'Low Stock' 
        : 'In Stock'

      // Get catalog ID first if we have a SKU
      let catalogId = null
      if (item.sku) {
        const { data: catRow } = await supabaseAdmin
          .from('inventory_catalog')
          .select('id')
          .eq('sku', item.sku)
          .maybeSingle()
        if (catRow) catalogId = catRow.id
      }

      // Update inventory quantity
      const { error: updateError } = await supabaseAdmin
        .from('inventory')
        .update({ 
          quantity: remaining,
          status: status,
          is_new: false
        })
        .eq('id', item.id)

      if (updateError) throw updateError

      // Update inventory_catalog with retry on failure
      let catalogUpdateSuccess = false
      for (let attempt = 0; attempt < 3 && !catalogUpdateSuccess; attempt++) {
        try {
          const { error: catalogError } = await supabaseAdmin
            .from('inventory_catalog')
            .update({ 
              quantity: remaining,
              status: status,
              is_new: false
            })
            .eq('sku', item.sku)
          
          if (!catalogError) {
            catalogUpdateSuccess = true
          } else if (attempt === 2) {
            console.error('Failed to sync catalog after 3 attempts:', catalogError)
          }
        } catch (e) {
          if (attempt === 2) console.error('Failed to sync catalog after 3 attempts:', e)
        }
      }

      // Record the transaction (do NOT include removed inventory_id column)
      const { error: transactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          type: 'Used',
          quantity: qty,
          note: useNote,
          user_id: currentUser.id,
          username: currentUser.username,
          catalog_id: catalogId || null // Include catalog_id when available
        })

      if (transactionError) throw transactionError

      // If the remaining quantity is zero, archive the item then delete it from inventory
      if (remaining === 0) {
        try {
          await archiveAndDelete(item.id, currentUser.id, useNote || 'Automatically archived when quantity reached 0')
        } catch (err) {
          console.error('Failed to archive and delete item after usage:', err)
          toast.error('Item reached zero but failed to archive/delete. Please contact admin.')
          return
        }
      }

      toast.success(
        `Used ${qty} ${item.unit} of ${item.name}. Remaining: ${remaining} ${item.unit}`
      )
      setUseStockDialog({ open: false })
      fetchInventory() // Refresh inventory data
    } catch (error) {
      console.error('Error updating stock:', error)
      toast.error('Failed to update stock')
    }
  }

  const handleEdit = async () => {
    if (editStockDialog.item && editQuantity && editReorderLevel) {
      const qty = parseFloat(editQuantity)
      const reorder = parseFloat(editReorderLevel)
      if (qty < 0 || reorder < 0) {
        toast.error("Values must be >= 0")
        return
      }

      try {
        const status = qty === 0 ? 'Out of Stock' 
          : qty <= reorder ? 'Low Stock' 
          : 'In Stock'

        // Get catalog ID first if we have a SKU
        let catalogId = null
        if (editStockDialog.item.sku) {
          const { data: catRow } = await supabaseAdmin
            .from('inventory_catalog')
            .select('id')
            .eq('sku', editStockDialog.item.sku)
            .maybeSingle()
          if (catRow) catalogId = catRow.id
        }

        // Update inventory
        const { error } = await supabaseAdmin
          .from('inventory')
          .update({ 
            quantity: qty,
            reorder_level: reorder,
            status: status,
            is_new: false
          })
          .eq('id', editStockDialog.item.id)

        if (error) throw error

        // Update inventory_catalog with retry logic
        let catalogUpdateSuccess = false
        for (let attempt = 0; attempt < 3 && !catalogUpdateSuccess; attempt++) {
          try {
            const { error: catalogError } = await supabaseAdmin
              .from('inventory_catalog')
              .update({ 
                quantity: qty,
                reorder_level: reorder,
                status: status,
                is_new: false
              })
              .eq('sku', editStockDialog.item.sku)
            
            if (!catalogError) {
              catalogUpdateSuccess = true
            } else if (attempt === 2) {
              console.error('Failed to sync catalog after 3 attempts:', catalogError)
            }
          } catch (e) {
            if (attempt === 2) console.error('Failed to sync catalog after 3 attempts:', e)
          }
        }

        toast.success(`Updated ${editStockDialog.item.name}`)
        // If updated quantity is zero, archive and delete the item
        if (qty === 0) {
          try {
            await archiveAndDelete(editStockDialog.item.id, currentUser.id, 'Archived after admin set quantity to 0')
            toast.success(`Archived ${editStockDialog.item.name}`)
          } catch (err) {
            console.error('Failed to archive item after edit:', err)
            toast.error('Updated quantity to 0 but failed to archive/delete. Please contact admin.')
          }
        }

        setEditStockDialog({ open: false })
        fetchInventory() // Refresh inventory data
      } catch (error) {
        console.error('Error updating stock:', error)
        toast.error('Failed to update stock')
      }
    } else {
      toast.error("Please fill quantity and reorder level")
    }
  }

  /**
   * Try to find the material config by matching the inventory item name or SKU.
   * This may or may not always match perfectly, depending on how you've constructed SKUs.
   */
  const findMaterialConfig = item => {
    // Try match by exact name first
    const byName = MATERIALS.find(m => {
      if (m.subOptions) {
        return m.subOptions.includes(item.name)
      } else {
        return (
          m.value === item.name ||
          m.value.toLowerCase() === item.name.toLowerCase()
        )
      }
    })
    if (byName) return byName
    // fallback: try matching by value switch
    return MATERIALS.find(
      m => m.value.toLowerCase() === item.name.toLowerCase()
    )
  }

  // Prepare sorted inventory with new items first and apply search filter
  const filteredInventory = [...inventory]
    .filter(item => {
      if (!searchQuery) return true
      const query = searchQuery.toLowerCase()
      return (
        item.name.toLowerCase().includes(query) ||
        item.sku.toLowerCase().includes(query)
      )
    })
    .map((item, idx) => ({ ...item, originalIndex: idx }))
    .sort((a, b) => {
      if (a.isNew && !b.isNew) return -1
      if (!a.isNew && b.isNew) return 1
      return a.originalIndex - b.originalIndex
    })

  // Pagination
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedInventory = filteredInventory.slice(startIndex, endIndex)

  // Reset to page 1 when search query changes
  const handleSearchChange = value => {
    setSearchQuery(value)
    setCurrentPage(1)
  }

  return (
    <div className="bg-white h-full flex flex-col">
      <PageHeader
        title="Inventory Overview"
        currentUser={currentUser}
        onLogout={onLogout}
        showNotifications={true}
        lowStockItems={lowStockItems}
        onNavigateToAccount={onNavigateToAccount}
      />
      <div className="flex-1 overflow-auto p-6">
        {/* Search Bar */}
        <div className="relative w-full max-w-md mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            type="text"
            placeholder="Search by name or SKU..."
            value={searchQuery}
            onChange={e => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="space-y-4">
          {paginatedInventory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No items found matching your search.
            </div>
          ) : (
            paginatedInventory.map(({ originalIndex, ...item }) => {
              const materialCfg = findMaterialConfig(item)
              const unit = materialCfg?.unit || item.unit
              return (
                <div
                  key={item.id}
                  className="bg-white border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-1">
                        {item.name}
                      </h3>
                      <div className="text-2xl font-semibold text-gray-900 mb-2">
                        {item.quantity} {unit}
                      </div>
                      <Badge
                        className={`text-xs ${getStatusColor(item)} border-0`}
                      >
                        {getStatusLabel(item)}
                      </Badge>
                      <p className="text-sm text-gray-600 mt-2">
                        Reorder at {item.reorderLevel} {unit}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">
                        SKU: <span className="font-mono">{item.sku}</span>
                      </p>
                    </div>

                    <div className="sm:ml-4 flex flex-col gap-2 w-full sm:w-auto">
                      {isStaff && (
                        <Dialog
                          open={
                            useStockDialog.open &&
                            useStockDialog.item?.id === item.id
                          }
                          onOpenChange={open =>
                            setUseStockDialog({
                              open,
                              item: open ? item : undefined
                            })
                          }
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={item.quantity === 0}
                            >
                              Use Stock
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Use Stock — {item.name}</DialogTitle>
                              <DialogDescription>
                                Record usage. Enter quantity or length and
                                provide a note.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <Label>
                                Available: {item.quantity} {unit}
                              </Label>
                              <div className="space-y-2">
                                <Label htmlFor="use-qty">
                                  Quantity / Length to Use
                                </Label>
                                <Input
                                  id="use-qty"
                                  type="number"
                                  step={unit === "ft" ? "0.1" : "1"}
                                  min="0"
                                  placeholder="Enter amount"
                                  value={useQuantity}
                                  onChange={e => setUseQuantity(e.target.value)}
                                  max={item.quantity}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="use-note">
                                  Note / Job / Client
                                </Label>
                                <Textarea
                                  id="use-note"
                                  placeholder="Enter details"
                                  value={useNote}
                                  onChange={e => setUseNote(e.target.value)}
                                />
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={handleUse} className="flex-1">
                                  Use Stock
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setUseStockDialog({ open: false })
                                    setUseQuantity("")
                                    setUseNote("")
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      {isAdmin && (
                        <Dialog
                          open={
                            editStockDialog.open &&
                            editStockDialog.item?.id === item.id
                          }
                          onOpenChange={open => {
                            setEditStockDialog({
                              open,
                              item: open ? item : undefined
                            })
                            if (open && item) {
                              setEditQuantity(item.quantity.toString())
                              setEditReorderLevel(item.reorderLevel.toString())
                            }
                          }}
                        >
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>
                                Edit Stock — {item.name}
                              </DialogTitle>
                              <DialogDescription>
                                Update the quantity or reorder threshold.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="space-y-2">
                                <Label htmlFor="edit-qty">New Quantity</Label>
                                <Input
                                  id="edit-qty"
                                  type="number"
                                  placeholder="Enter new quantity"
                                  value={editQuantity}
                                  onChange={e =>
                                    setEditQuantity(e.target.value)
                                  }
                                  min={0}
                                />
                                <p className="text-sm text-gray-500">
                                  Unit: {unit}
                                </p>
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor="edit-reorder">
                                  Reorder Level
                                </Label>
                                <Input
                                  id="edit-reorder"
                                  type="number"
                                  placeholder="Enter reorder level"
                                  value={editReorderLevel}
                                  onChange={e =>
                                    setEditReorderLevel(e.target.value)
                                  }
                                  min={0}
                                />
                                <p className="text-sm text-gray-500">
                                  Minimum before reordering
                                </p>
                              </div>
                              <div className="flex gap-2">
                                <Button onClick={handleEdit} className="flex-1">
                                  Update
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setEditStockDialog({ open: false })
                                    setEditQuantity("")
                                    setEditReorderLevel("")
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() =>
                      setCurrentPage(prev => Math.max(1, prev - 1))
                    }
                    className={
                      currentPage === 1
                        ? "pointer-events-none opacity-50"
                        : "cursor-pointer"
                    }
                  />
                </PaginationItem>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  page => (
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
                )}

                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage(prev => Math.min(totalPages, prev + 1))
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
      </div>
    </div>
  )
}
