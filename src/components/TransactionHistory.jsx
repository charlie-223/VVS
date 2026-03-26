// TransactionHistory.jsx
import { useState, useRef, useEffect } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { supabaseAdmin } from "../config/supabaseAdmin"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "./ui/select"
// NOTE: we DON'T import your old DatePicker here to avoid fragile DOM assumptions
import { PageHeader } from "./PageHeader"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "./ui/card"
import { Calendar as CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "./ui/pagination"
import { DEFAULT_MATERIAL_CONFIGS } from "../config/material"

// ---------- Utility helpers ----------
const sanitizeAndFormatInput = raw => {
  const s = String(raw || "")
  const cleaned = s.replace(/[^0-9/]/g, "")
  const digits = cleaned.replace(/\D/g, "").slice(0, 8) // limit 8 digits
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`
}

const parseMMDDYYYY = str => {
  if (typeof str !== "string") return null
  const parts = str.split("/")
  if (parts.length !== 3) return null
  const mm = Number(parts[0]), dd = Number(parts[1]), yyyy = Number(parts[2])
  if (
    Number.isNaN(mm) || Number.isNaN(dd) || Number.isNaN(yyyy) ||
    mm < 1 || mm > 12 || dd < 1 || dd > 31 || yyyy < 1000 || yyyy > 9999
  ) return null
  const d = new Date(yyyy, mm - 1, dd)
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null
  return d
}

const tryConvertToDate = value => {
  if (!value && value !== 0) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === "string" && value.length === 10) return parseMMDDYYYY(value)
  return null
}

const isFromBeforeOrEqualTo = (fromVal, toVal) => {
  const from = tryConvertToDate(fromVal)
  const to = tryConvertToDate(toVal)
  if (!from || !to) return true
  const fromStart = new Date(from); fromStart.setHours(0,0,0,0)
  const toEnd = new Date(to); toEnd.setHours(23,59,59,999)
  return fromStart.getTime() <= toEnd.getTime()
}

const countDigits = s => (String(s || "").match(/\d/g) || []).length

// Format a Date to display MM/dd/yyyy
const formatDisplay = date => (date instanceof Date ? format(date, "MM/dd/yyyy") : "")

// Format for native <input type="date"> (yyyy-MM-dd)
const formatForNativeDate = date => (date instanceof Date ? format(date, "yyyy-MM-dd") : "")

// ---------- Reusable Date text input (controlled) ----------
function DateTextInput({ which, value, onChange, placeholder = "MM/DD/YYYY", maxDate }) {
  // which: "fromDate" or "toDate"
  // value: Date or formatted string
  const nativeRef = useRef(null)

  const displayValue = value instanceof Date ? format(value, "MM/dd/yyyy") : (typeof value === "string" ? value : "")

  const handleTextChange = e => {
    const raw = e.target.value
    const formatted = sanitizeAndFormatInput(raw)
    const parsed = formatted.length === 10 ? parseMMDDYYYY(formatted) : null
    onChange(parsed || formatted)
  }

  const handleKeyDown = e => {
    if (e.ctrlKey || e.metaKey) return
    const allowed = new Set([
      "0","1","2","3","4","5","6","7","8","9",
      "/", "Backspace", "Delete", "ArrowLeft", "ArrowRight",
      "Home", "End", "Tab", "Enter", "Escape"
    ])
    if (!allowed.has(e.key)) { e.preventDefault(); return }
    // block extra digits beyond 8 unless there is a selection
    if (/^[0-9]$/.test(e.key)) {
      const val = e.target.value || ""
      const currentDigits = countDigits(val)
      const selStart = typeof e.target.selectionStart === "number" ? e.target.selectionStart : 0
      const selEnd = typeof e.target.selectionEnd === "number" ? e.target.selectionEnd : 0
      const selectedDigits = countDigits(val.slice(selStart, selEnd))
      if (currentDigits - selectedDigits >= 8) e.preventDefault()
    }
  }

  const handlePaste = e => {
    e.preventDefault()
    const pasted = (e.clipboardData || window.clipboardData).getData("text") || ""
    const formatted = sanitizeAndFormatInput(pasted)
    const parsed = formatted.length === 10 ? parseMMDDYYYY(formatted) : null
    onChange(parsed || formatted)
  }

  const handleBlur = e => {
    const val = e.target.value || ""
    const parsed = val.length === 10 ? parseMMDDYYYY(val) : null
    onChange(parsed || val || undefined)
  }

  const openNative = () => {
    try {
      if (nativeRef.current && typeof nativeRef.current.showPicker === "function") {
        nativeRef.current.showPicker()
      } else if (nativeRef.current) {
        nativeRef.current.click()
      }
    } catch (_) {
      nativeRef.current && nativeRef.current.click()
    }
  }

  const handleNativeChange = e => {
    const iso = e.target.value // yyyy-mm-dd
    if (!iso) { onChange(undefined); return }
    const [y,m,d] = iso.split("-").map(Number)
    const dt = new Date(y, m - 1, d)
    onChange(dt)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={displayValue}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={handleBlur}
        placeholder={placeholder}
        className="w-36 border rounded px-2 py-1 text-sm"
        inputMode="numeric"
        maxLength={10}
      />
      <button type="button" onClick={openNative} className="p-1 rounded hover:bg-gray-100" aria-label="Open calendar">
        <CalendarIcon className="h-4 w-4 text-gray-600" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        onChange={handleNativeChange}
        className="sr-only"
        max={maxDate ? formatForNativeDate(maxDate) : undefined}
      />
    </div>
  )
}

/* ------------------------------------------------------------------
  OPTIONAL: If you want to use your Calendar (react-day-picker wrapper),
  you can wire it into a simple popover. Below is an example component
  showing how to do that. It is commented out in the final render.
  To use it: import your Calendar wrapper (the file you posted) and
  swap <DateTextInput .../> to <CalendarPopoverDateInput .../> in the UI.
------------------------------------------------------------------*/

// import { Calendar as DayPickerCalendar } from "./ui/calendar" // <- your file
/*
function CalendarPopoverDateInput({ which, value, onChange, maxDate }) {
  const [open, setOpen] = useState(false)
  const displayValue = value instanceof Date ? format(value, "MM/dd/yyyy") : (typeof value === "string" ? value : "")

  const onSelectDate = d => {
    onChange(d)
    setOpen(false)
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={displayValue}
          onChange={e => {
            const formatted = sanitizeAndFormatInput(e.target.value)
            const parsed = formatted.length === 10 ? parseMMDDYYYY(formatted) : null
            onChange(parsed || formatted)
          }}
          onKeyDown={e => {
            if (e.ctrlKey || e.metaKey) return
            const allowed = new Set(["0","1","2","3","4","5","6","7","8","9","/","Backspace","Delete","ArrowLeft","ArrowRight","Home","End","Tab","Enter","Escape"])
            if (!allowed.has(e.key)) e.preventDefault()
            if (/^[0-9]$/.test(e.key)) {
              const val = e.target.value || ""
              const currentDigits = countDigits(val)
              const selStart = typeof e.target.selectionStart === "number" ? e.target.selectionStart : 0
              const selEnd = typeof e.target.selectionEnd === "number" ? e.target.selectionEnd : 0
              const selectedDigits = countDigits(val.slice(selStart, selEnd))
              if (currentDigits - selectedDigits >= 8) e.preventDefault()
            }
          }}
          placeholder="MM/DD/YYYY"
          className="w-36 border rounded px-2 py-1 text-sm"
          inputMode="numeric"
          maxLength={10}
        />
        <button type="button" onClick={() => setOpen(v => !v)} className="p-1 rounded hover:bg-gray-100">
          <CalendarIcon className="h-4 w-4 text-gray-600" />
        </button>
      </div>

      {open && (
        <div className="absolute z-50 mt-2">
          <DayPickerCalendar
            mode="single"
            selected={value instanceof Date ? value : undefined}
            onSelect={onSelectDate}
            disabled={maxDate ? { after: maxDate } : undefined}
          />
        </div>
      )}
    </div>
  )
}
*/

export function TransactionHistory({
  currentUser,
  onLogout,
  lowStockItems = [],
  onNavigateToAccount
}) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filters, setFilters] = useState({
    fromDate: undefined,
    toDate: undefined,
    type: "all",
    material: "all",
    search: ""
  })
  const [monthPages, setMonthPages] = useState({})
  const [dateError, setDateError] = useState("")
  const itemsPerPage = 10

  // Fetch transactions from Supabase (catalog_id-based)
  useEffect(() => {
    const fetchTransactions = async () => {
      try {
        setLoading(true)
        setError(null)

        // First try a single-query embedded relationship join (requires DB FK).
        // If the DB doesn't have the FK, PostgREST returns PGRST200 and we fall back
        // to a safe two-step client-side mapping.
        try {
          const { data: joinedData, error: joinErr } = await supabaseAdmin
            .from('transactions')
            .select(`
              id,
              type,
              quantity,
              note,
              created_at,
              catalog_id,
              user_id,
              username,
              catalog:catalog_id ( name, sku )
            `)
            .order('created_at', { ascending: false })

          if (!joinErr && Array.isArray(joinedData)) {
            const transformed = joinedData.map(transaction => {
              const cat = transaction.catalog || null
              return {
                id: transaction.id,
                dateTime: transaction.created_at,
                type: transaction.type,
                material: (cat && cat.name) || 'Deleted Item',
                sku: (cat && cat.sku) || 'N/A',
                quantity: transaction.quantity,
                user: transaction.username || 'Unknown User',
                note: transaction.note || ''
              }
            })
            setTransactions(transformed)
            return
          }

          // If joinErr indicates no relationship, fall through to fallback below
          if (joinErr && joinErr.code !== 'PGRST200') {
            // Unexpected error other than missing relationship - throw to outer catch
            throw joinErr
          }
        } catch (e) {
          // If error is PGRST200 (no FK), we'll fallback to client-side mapping below.
          if (!(e && e.code === 'PGRST200')) {
            // If it's a different error, rethrow to be handled by outer try/catch
            throw e
          }
          // else continue to fallback
        }

        // Fallback: fetch transactions and then fetch catalog rows separately
        const { data, error } = await supabaseAdmin
          .from('transactions')
          .select('id,type,quantity,note,created_at,catalog_id,user_id,username')
          .order('created_at', { ascending: false })

        if (error) throw error

        const txRows = Array.isArray(data) ? data : []
        const catalogIds = Array.from(new Set(txRows.map(t => t.catalog_id).filter(Boolean)))

        let catalogsById = {}
        if (catalogIds.length) {
          const { data: catRows, error: catErr } = await supabaseAdmin
            .from('inventory_catalog')
            .select('id,name,sku')
            .in('id', catalogIds)
          if (catErr) {
            console.warn('Failed to fetch catalog rows for transactions:', catErr)
          } else if (Array.isArray(catRows)) {
            catalogsById = Object.fromEntries(catRows.map(c => [c.id, c]))
          }
        }

        const transformedData = txRows.map(transaction => {
          const cat = transaction.catalog_id ? catalogsById[transaction.catalog_id] : null
          return {
            id: transaction.id,
            dateTime: transaction.created_at,
            type: transaction.type,
            material: (cat && cat.name) || 'Deleted Item',
            sku: (cat && cat.sku) || 'N/A',
            quantity: transaction.quantity,
            user: transaction.username || 'Unknown User',
            note: transaction.note || ''
          }
        })

        setTransactions(transformedData)
      } catch (err) {
        console.error('Error fetching transactions:', err)
        setError('Failed to load transaction history')
      } finally {
        setLoading(false)
      }
    }

    fetchTransactions()

    // Set up real-time subscription for new transactions
    const subscription = supabaseAdmin
      .channel('transaction-changes')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions'
        },
        async () => {
          // Refetch all transactions when there's a change
          await fetchTransactions()
        }
      )
      .subscribe()

    // Cleanup subscription
    return () => {
      try { subscription.unsubscribe() } catch (_) {}
    }
  }, [])

  // The onChange handlers passed to the Date inputs
  const handleFromChange = raw => {
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      setFilters(prev => ({ ...prev, fromDate: raw }))
      setMonthPages({})
      if (!isFromBeforeOrEqualTo(raw, filters.toDate)) setDateError("From date must be earlier than or equal to To date.")
      else setDateError("")
      return
    }
    const formatted = sanitizeAndFormatInput(raw)
    const parsed = formatted.length === 10 ? parseMMDDYYYY(formatted) : null
    setFilters(prev => ({ ...prev, fromDate: parsed || formatted }))
    setMonthPages({})
    if (parsed) {
      if (!isFromBeforeOrEqualTo(parsed, filters.toDate)) setDateError("From date must be earlier than or equal to To date.")
      else setDateError("")
    } else setDateError("")
  }

  const handleToChange = raw => {
    if (raw instanceof Date && !isNaN(raw.getTime())) {
      setFilters(prev => ({ ...prev, toDate: raw }))
      setMonthPages({})
      if (!isFromBeforeOrEqualTo(filters.fromDate, raw)) setDateError("From date must be earlier than or equal to To date.")
      else setDateError("")
      return
    }
    const formatted = sanitizeAndFormatInput(raw)
    const parsed = formatted.length === 10 ? parseMMDDYYYY(formatted) : null
    setFilters(prev => ({ ...prev, toDate: parsed || formatted }))
    setMonthPages({})
    if (parsed) {
      if (!isFromBeforeOrEqualTo(filters.fromDate, parsed)) setDateError("From date must be earlier than or equal to To date.")
      else setDateError("")
    } else setDateError("")
  }

  const handleDatePaste = (e, which) => {
    e.preventDefault()
    const pasted = (e.clipboardData || window.clipboardData).getData("text") || ""
    const formatted = sanitizeAndFormatInput(pasted)
    const parsed = formatted.length === 10 ? parseMMDDYYYY(formatted) : null
    setFilters(prev => ({ ...prev, [which]: parsed || formatted }))
    setMonthPages({})
    if (which === "fromDate") {
      if (!isFromBeforeOrEqualTo(parsed || formatted, filters.toDate)) setDateError("From date must be earlier than or equal to To date.")
      else setDateError("")
    } else {
      if (!isFromBeforeOrEqualTo(filters.fromDate, parsed || formatted)) setDateError("From date must be earlier than or equal to To date.")
      else setDateError("")
    }
  }

  // Filtering, CSV, grouping (unchanged logic — copy from your original)
  const filteredTransactions = transactions.filter(transaction => {
    const transactionDate = new Date(transaction.dateTime)
    if (filters.fromDate) {
      const fromDate = filters.fromDate instanceof Date ? new Date(filters.fromDate) : tryConvertToDate(filters.fromDate)
      if (fromDate) { fromDate.setHours(0,0,0,0); if (transactionDate < fromDate) return false }
    }
    if (filters.toDate) {
      const toDate = filters.toDate instanceof Date ? new Date(filters.toDate) : tryConvertToDate(filters.toDate)
      if (toDate) { toDate.setHours(23,59,59,999); if (transactionDate > toDate) return false }
    }
    if (filters.type !== "all" && transaction.type.toLowerCase() !== filters.type) return false
    if (filters.material !== "all" && transaction.material.toLowerCase() !== filters.material.toLowerCase()) return false
    if (filters.search) {
      const s = filters.search.toLowerCase()
      if (!transaction.note.toLowerCase().includes(s) && !transaction.user.toLowerCase().includes(s) && !(transaction.sku?.toLowerCase().includes(s) || false)) return false
    }
    return true
  })

  const exportCSV = () => {
    const headers = ["Date/Time","Type","Material","SKU","Quantity","User","Note"]
    const csvData = [headers.join(","), ...filteredTransactions.map(t => [t.dateTime,t.type,t.material,t.sku||"N/A",t.quantity,t.user,`"${t.note}"`].join(","))].join("\n")
    const blob = new Blob([csvData], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = "transaction-history.csv"; a.click()
    window.URL.revokeObjectURL(url)
  }

  const clearFilters = () => {
    setFilters({ fromDate: undefined, toDate: undefined, type: "all", material: "all", search: "" })
    setMonthPages({}); setDateError("")
  }

  const getAllAvailableMaterials = () => {
    const configMaterials = new Set()
    DEFAULT_MATERIAL_CONFIGS.forEach(config => {
      if (config.subOptions && config.subOptions.length > 0) {
        if (config.name === "Pull-up banner" || config.name === "X-banner") {
          config.subOptions.forEach(sub => configMaterials.add(`${sub} ${config.name.toLowerCase()}`))
        } else config.subOptions.forEach(sub => configMaterials.add(sub))
      } else configMaterials.add(config.displayName)
    })
    transactions.forEach(t => configMaterials.add(t.material))
    try {
      const stored = localStorage.getItem("shobe-material-configs")
      if (stored) {
        JSON.parse(stored).forEach(config => {
          if (config.subOptions && config.subOptions.length > 0) {
            if (config.name === "Pull-up banner" || config.name === "X-banner") {
              config.subOptions.forEach(sub => configMaterials.add(`${sub} ${config.name.toLowerCase()}`))
            } else config.subOptions.forEach(sub => configMaterials.add(sub))
          } else configMaterials.add(config.displayName)
        })
      }
    } catch (_) {}
    return Array.from(configMaterials).sort()
  }

  const availableMaterials = getAllAvailableMaterials()

  const formatDisplayDate = dateTimeString => {
    const date = new Date(dateTimeString)
    return { dateStr: format(date, "MMM dd, yyyy"), timeStr: format(date, "h:mm:ss a") }
  }

  const groupTransactionsByMonth = () => {
    const monthlyData = {}
    filteredTransactions.forEach(transaction => {
      const date = new Date(transaction.dateTime)
      const monthYear = `${date.toLocaleString("en-US",{month:"long"})} ${date.getFullYear()}`
      const year = date.getFullYear()
      const monthKey = `${year}-${String(date.getMonth()+1).padStart(2,"0")}`
      if (!monthlyData[monthKey]) monthlyData[monthKey] = { month: monthYear, year, transactions: [] }
      monthlyData[monthKey].transactions.push(transaction)
    })
    return Object.keys(monthlyData).sort((a,b) => b.localeCompare(a)).map(key => {
      const monthData = monthlyData[key]
      monthData.transactions.sort((a,b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
      return monthData
    })
  }

  const transactionsByMonth = groupTransactionsByMonth()
  const getMonthPage = monthKey => monthPages[monthKey] || 1
  const setMonthPage = (monthKey, page) => setMonthPages(prev => ({ ...prev, [monthKey]: page }))
  const paginatedByMonth = transactionsByMonth.map(monthData => {
    const monthKey = `${monthData.year}-${monthData.month}`
    const currentPage = getMonthPage(monthKey)
    const totalPages = Math.ceil(monthData.transactions.length / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return { ...monthData, transactions: monthData.transactions.slice(startIndex, endIndex), currentPage, totalPages, totalTransactions: monthData.transactions.length, monthKey }
  })

  return (
    <div className="bg-white h-full flex flex-col">
      <PageHeader title="Transaction History" currentUser={currentUser} onLogout={onLogout} showNotifications={true} lowStockItems={lowStockItems} onNavigateToAccount={onNavigateToAccount} />

      <div className="flex-1 overflow-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            {loading && <span className="text-gray-500">Loading transactions...</span>}
            {error && <span className="text-red-500">{error}</span>}
          </div>
          <Button className="bg-gray-900 hover:bg-gray-800" onClick={exportCSV} disabled={loading}>Export CSV</Button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">From</label>
              <DateTextInput which="fromDate" value={filters.fromDate} onChange={handleFromChange} placeholder="MM/DD/YYYY" maxDate={new Date()} />
            </div>
            {dateError && <p className="text-red-600 text-sm mt-1">{dateError}</p>}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">To</label>
            <DateTextInput which="toDate" value={filters.toDate} onChange={handleToChange} placeholder="MM/DD/YYYY" maxDate={new Date()} />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Type</label>
            <Select value={filters.type} onValueChange={value => { setFilters(prev => ({ ...prev, type: value })); setMonthPages({}) }}>
              <SelectTrigger className="w-24 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="used">Used</SelectItem><SelectItem value="added">Added</SelectItem></SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600">Material</label>
            <Select value={filters.material} onValueChange={value => { setFilters(prev => ({ ...prev, material: value })); setMonthPages({}) }}>
              <SelectTrigger className="w-48 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {availableMaterials.map(material => <SelectItem key={material} value={material.toLowerCase()}>{material}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Input placeholder="Search note/client/user/SKU" className="flex-1 text-xs" value={filters.search} onChange={e => { setFilters(prev => ({ ...prev, search: e.target.value })); setMonthPages({}) }} />
          <Button variant="outline" size="sm" onClick={clearFilters}>Clear</Button>
        </div>

        {/* Transactions by month (same layout as your original) */}
        {paginatedByMonth.length === 0 ? (
          <Card><CardContent className="py-8"><div className="text-center text-gray-500">No transactions found matching the current filters.</div></CardContent></Card>
        ) : (
          <div className="space-y-6">
            {paginatedByMonth.map((monthData, index) => (
              <Card key={index}>
                <CardHeader>
                  <div className="flex items-center gap-2"><CalendarIcon className="h-5 w-5 text-blue-600" /><CardTitle>{monthData.month}</CardTitle></div>
                  <CardDescription>{monthData.totalTransactions} transaction{monthData.totalTransactions !== 1 ? "s" : ""}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50"><tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date/Time</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Material</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note / Client / Job</th>
                      </tr></thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {monthData.transactions.map(transaction => (
                          <tr key={transaction.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              <div className="flex flex-col">
                                <span className="font-medium text-gray-900">{formatDisplayDate(transaction.dateTime).dateStr}</span>
                                <span className="text-xs text-gray-500">{formatDisplayDate(transaction.dateTime).timeStr}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900"><span className={`inline-flex px-2 py-1 rounded text-xs ${transaction.type === "Added" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>{transaction.type}</span></td>
                            <td className="px-4 py-3 text-sm text-blue-600">{transaction.material}</td>
                            <td className="px-4 py-3 text-sm text-gray-600 font-mono text-xs">{transaction.sku || "N/A"}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{transaction.quantity}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{transaction.user}</td>
                            <td className="px-4 py-3 text-sm text-gray-900">{transaction.note}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {monthData.totalPages > 1 && (
                    <div className="flex justify-end p-4 border-t border-gray-200">
                      <Pagination>
                        <PaginationContent>
                          <PaginationItem>
                            <PaginationPrevious onClick={() => setMonthPage(monthData.monthKey, Math.max(1, monthData.currentPage - 1))} className={monthData.currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"} />
                          </PaginationItem>
                          {Array.from({ length: monthData.totalPages }, (_, i) => i + 1).map(page => (
                            <PaginationItem key={page}><PaginationLink onClick={() => setMonthPage(monthData.monthKey, page)} isActive={monthData.currentPage === page} className="cursor-pointer">{page}</PaginationLink></PaginationItem>
                          ))}
                          <PaginationItem><PaginationNext onClick={() => setMonthPage(monthData.monthKey, Math.min(monthData.totalPages, monthData.currentPage + 1))} className={monthData.currentPage === monthData.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"} /></PaginationItem>
                        </PaginationContent>
                      </Pagination>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
