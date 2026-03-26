import { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { supabaseAdmin } from "../config/supabaseAdmin"
import { Progress } from "./ui/progress"
import { DatePicker } from "./ui/date-picker"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line
} from "recharts"
import { PageHeader } from "./PageHeader"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from "./ui/pagination"

export function Reports({
  currentUser,
  onLogout,
  lowStockItems = [],
  onNavigateToAccount
}) {
  const [inventory, setInventory] = useState([])
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [dateRange, setDateRange] = useState({
    from: new Date("2025-08-01"),
    to: new Date("2025-09-05")
  })
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Fetch inventory and transactions data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch inventory catalog data
        const { data: inventoryData, error: inventoryError } = await supabaseAdmin
          .from('inventory_catalog')
          .select(`
            id,
            name,
            sku,
            unit,
            reorder_level,
            status,
            quantity
          `)
          .order('name')

        if (inventoryError) throw inventoryError

        // Fetch transactions data with catalog information
        const { data: transactionsData, error: transactionsError } = await supabaseAdmin
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
            catalog:catalog_id (
              name,
              sku,
              unit
            )
          `)
          .order('created_at', { ascending: false })

        if (transactionsError) throw transactionsError

        // Transform transactions data
        const transformedTransactions = transactionsData.map(transaction => ({
          id: transaction.id,
          dateTime: transaction.created_at,
          type: transaction.type,
          material: transaction.catalog?.name || 'Deleted Item',
          sku: transaction.catalog?.sku || 'N/A',
          quantity: transaction.quantity,
          user: transaction.username || 'Unknown User',
          note: transaction.note || '',
          unit: transaction.catalog?.unit || 'N/A'
        }))

        setInventory(inventoryData)
        setTransactions(transformedTransactions)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Failed to load reports data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()

    // Set up real-time subscriptions
    const catalogSubscription = supabaseAdmin
      .channel('catalog-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'inventory_catalog' }, 
        () => fetchData()
      )
      .subscribe()

    const transactionSubscription = supabaseAdmin
      .channel('transaction-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'transactions' }, 
        () => fetchData()
      )
      .subscribe()

    // Cleanup subscriptions
    return () => {
      catalogSubscription.unsubscribe()
      transactionSubscription.unsubscribe()
    }
  }, []) // Empty dependency array means this runs once on mount

  // Filter inventory and transactions based on search
  const filteredInventory = inventory.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredTransactions = transactions.filter(
    transaction =>
      (transaction.material || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (transaction.user || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (transaction.note || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculate consumption data from filtered transactions
  const consumptionData = filteredInventory.map(item => {
    const usedTransactions = filteredTransactions.filter(
      t =>
        t.type === "Used" &&
        t.material &&
        t.material.toLowerCase() === item.name.toLowerCase()
    )
    const totalUsed = usedTransactions.reduce((sum, t) => sum + t.quantity, 0)

    return {
      material: item.name,
      totalUsed,
      unit: item.unit
    }
  })

  // Generate monthly consumption data from actual transactions
  const getMonthlyConsumptionData = () => {
    const monthlyData = {}

    // Filter "Used" transactions only
    const usedTransactions = filteredTransactions.filter(t => t.type === "Used")

    usedTransactions.forEach(transaction => {
      const date = new Date(transaction.dateTime)
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`
      const monthLabel = date.toLocaleString("en-US", { month: "short" })

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { date, materials: {} }
      }

      if (!monthlyData[monthKey].materials[transaction.material]) {
        monthlyData[monthKey].materials[transaction.material] = 0
      }

      monthlyData[monthKey].materials[transaction.material] +=
        transaction.quantity
    })

    // Get unique materials that have been used
    const allMaterials = new Set()
    Object.values(monthlyData).forEach(monthObj => {
      Object.keys(monthObj.materials).forEach(material =>
        allMaterials.add(material)
      )
    })

    // Sort months chronologically (oldest to newest)
    const sortedMonths = Object.keys(monthlyData).sort((a, b) =>
      a.localeCompare(b)
    )

    // Convert to array format for recharts
    return sortedMonths.map(monthKey => {
      const date = monthlyData[monthKey].date
      const monthLabel = date.toLocaleString("en-US", { month: "short" })
      const monthObj = { month: monthLabel }
      allMaterials.forEach(material => {
        monthObj[material] = monthlyData[monthKey].materials[material] || 0
      })
      return monthObj
    })
  }

  const monthlyConsumptionData = getMonthlyConsumptionData()
  const allMaterials = Array.from(
    new Set(
      filteredTransactions.filter(t => t.type === "Used").map(t => t.material)
    )
  )

  // Generate colors for materials dynamically
  const materialColors = [
    "#3B82F6",
    "#F97316",
    "#10B981",
    "#8B5CF6",
    "#EC4899",
    "#F59E0B",
    "#14B8A6",
    "#6366F1",
    "#EF4444",
    "#84CC16"
  ]

  // Calculate material vs output data with wastage
  const getMaterialOutputData = () => {
    const monthlyData = {}

    const usedTransactions = filteredTransactions.filter(t => t.type === "Used")

    usedTransactions.forEach(transaction => {
      const date = new Date(transaction.dateTime)
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { date, output: 0, used: 0, wastage: 0 }
      }

      // Check if this is wastage (contains 'reject' or 'rejected' in note)
      const isWastage = transaction.note.toLowerCase().includes("reject")

      if (isWastage) {
        monthlyData[monthKey].wastage += transaction.quantity
      } else {
        monthlyData[monthKey].output += transaction.quantity
      }

      monthlyData[monthKey].used += transaction.quantity
    })

    // Sort months chronologically (oldest to newest)
    const sortedMonths = Object.keys(monthlyData).sort((a, b) =>
      a.localeCompare(b)
    )

    return sortedMonths.map(monthKey => {
      const date = monthlyData[monthKey].date
      const monthLabel = date.toLocaleString("en-US", { month: "short" })
      return {
        month: monthLabel,
        Output: Math.round(monthlyData[monthKey].output),
        Used: Math.round(monthlyData[monthKey].used),
        Wastage: Math.round(monthlyData[monthKey].wastage)
      }
    })
  }

  const materialOutputData = getMaterialOutputData()

  // Get current month for titles
  const currentMonth = new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric"
  })

  // Filters for Material → Output tab
  const [outputFilters, setOutputFilters] = useState({
    material: "",
    sku: "",
    fromDate: undefined,
    toDate: undefined
  })

  // Get filtered material output data based on filters
  const getFilteredMaterialOutputData = () => {
    let filteredTxns = transactions.filter(t => t.type === "Used")

    // Apply material filter
    if (outputFilters.material) {
      filteredTxns = filteredTxns.filter(t =>
        t.material.toLowerCase().includes(outputFilters.material.toLowerCase())
      )
    }

    // Apply SKU filter
    if (outputFilters.sku) {
      filteredTxns = filteredTxns.filter(t =>
        t.sku?.toLowerCase().includes(outputFilters.sku.toLowerCase())
      )
    }

    // Apply date range filter
    if (outputFilters.fromDate) {
      filteredTxns = filteredTxns.filter(t => {
        const txnDate = new Date(t.dateTime)
        return txnDate >= outputFilters.fromDate
      })
    }

    if (outputFilters.toDate) {
      filteredTxns = filteredTxns.filter(t => {
        const txnDate = new Date(t.dateTime)
        return txnDate <= outputFilters.toDate
      })
    }

    const monthlyData = {}

    filteredTxns.forEach(transaction => {
      const date = new Date(transaction.dateTime)
      const monthKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { date, output: 0, used: 0, wastage: 0 }
      }

      const isWastage = transaction.note.toLowerCase().includes("reject")

      if (isWastage) {
        monthlyData[monthKey].wastage += transaction.quantity
      } else {
        monthlyData[monthKey].output += transaction.quantity
      }

      monthlyData[monthKey].used += transaction.quantity
    })

    const sortedMonths = Object.keys(monthlyData).sort((a, b) =>
      a.localeCompare(b)
    )

    return sortedMonths.map(monthKey => {
      const date = monthlyData[monthKey].date
      const monthLabel = date.toLocaleString("en-US", { month: "short" })
      return {
        month: monthLabel,
        Output: Math.round(monthlyData[monthKey].output),
        Used: Math.round(monthlyData[monthKey].used),
        Wastage: Math.round(monthlyData[monthKey].wastage)
      }
    })
  }

  const filteredMaterialOutputData = getFilteredMaterialOutputData()

  const overviewCards = filteredInventory.map(item => ({
    title: item.name,
    value: item.quantity,
    max: item.reorderLevel * 3, // Assume max is 3x reorder level
    unit: item.unit,
    color:
      item.status === "In Stock"
        ? "bg-green-600"
        : item.status === "Low Stock"
        ? "bg-yellow-600"
        : "bg-red-600"
  }))

  const exportInventoryCSV = () => {
    const headers = ["Material", "Quantity", "Unit", "Reorder At", "Status"]
    const csvData = [
      headers.join(","),
      ...filteredInventory.map(item =>
        [
          item.name,
          item.quantity,
          item.unit,
          item.reorderLevel,
          item.status
        ].join(",")
      )
    ].join("\n")

    const blob = new Blob([csvData], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "inventory-report.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const exportConsumptionCSV = () => {
    const headers = ["Material", "Total Used", "Unit"]
    const csvData = [
      headers.join(","),
      ...consumptionData.map(item =>
        [item.material, item.totalUsed, item.unit].join(",")
      )
    ].join("\n")

    const blob = new Blob([csvData], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "consumption-report.csv"
    a.click()
    window.URL.revokeObjectURL(url)
  }
  const [activeTab, setActiveTab] = useState("inventory-report")

  return (
    <div className="bg-white h-full flex flex-col">
      <PageHeader
        title="Reports"
        currentUser={currentUser}
        onLogout={onLogout}
        showNotifications={true}
        lowStockItems={lowStockItems}
        onNavigateToAccount={onNavigateToAccount}
      />

      <div className="flex-1 overflow-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading reports data...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-red-600">
              <p>{error}</p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Search Bar */}
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search reports..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger
              value="inventory-report"
              className="data-[state=active]:bg-gray-900 data-[state=active]:text-white"
            >
              Inventory Report
            </TabsTrigger>
            <TabsTrigger value="consumption-report">
              Consumption Report
            </TabsTrigger>
            <TabsTrigger value="material-output">Material → Output</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory-report" className="space-y-6">
            {/* Current Inventory & Thresholds */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  Current Inventory & Thresholds
                </h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportInventoryCSV}
                  >
                    Export CSV
                  </Button>
                  <Button variant="outline" size="sm">
                    Print
                  </Button>
                </div>
              </div>

              <div className="bg-white rounded-lg border">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Material
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Quantity
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reorder At
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredInventory
                      .slice(
                        (currentPage - 1) * itemsPerPage,
                        currentPage * itemsPerPage
                      )
                      .map(item => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.unit}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {item.reorderLevel}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <span
                              className={`inline-flex px-2 py-1 rounded text-xs ${
                                item.status === "In Stock"
                                  ? "bg-green-100 text-green-800"
                                  : item.status === "Low Stock"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredInventory.length > itemsPerPage && (
                <div className="mt-4 flex justify-center">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={e => {
                            e.preventDefault()
                            if (currentPage > 1) setCurrentPage(currentPage - 1)
                          }}
                          className={
                            currentPage === 1
                              ? "pointer-events-none opacity-50"
                              : ""
                          }
                        />
                      </PaginationItem>
                      {Array.from(
                        {
                          length: Math.ceil(
                            filteredInventory.length / itemsPerPage
                          )
                        },
                        (_, i) => i + 1
                      ).map(page => (
                        <PaginationItem key={page}>
                          <PaginationLink
                            href="#"
                            onClick={e => {
                              e.preventDefault()
                              setCurrentPage(page)
                            }}
                            isActive={currentPage === page}
                          >
                            {page}
                          </PaginationLink>
                        </PaginationItem>
                      ))}
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={e => {
                            e.preventDefault()
                            if (
                              currentPage <
                              Math.ceil(filteredInventory.length / itemsPerPage)
                            )
                              setCurrentPage(currentPage + 1)
                          }}
                          className={
                            currentPage ===
                            Math.ceil(filteredInventory.length / itemsPerPage)
                              ? "pointer-events-none opacity-50"
                              : ""
                          }
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </div>

            {/* Consumption Report */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">From</label>
                  <DatePicker
                    value={dateRange.from}
                    onChange={date =>
                      setDateRange(prev => ({ ...prev, from: date }))
                    }
                    placeholder="MM/DD/YYYY"
                    className="w-36"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">To</label>
                  <DatePicker
                    value={dateRange.to}
                    onChange={date =>
                      setDateRange(prev => ({ ...prev, to: date }))
                    }
                    placeholder="MM/DD/YYYY"
                    className="w-36"
                  />
                </div>
                <Button size="sm" className="bg-gray-900 hover:bg-gray-800">
                  Run
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportConsumptionCSV}
                >
                  Export CSV
                </Button>
              </div>

              <div className="bg-white rounded-lg border">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Material
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total Used
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Unit
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {consumptionData.map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.material}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.totalUsed}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="consumption-report" className="space-y-6">
            {/* Inventory Overview Cards */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">
                Inventory Overview
              </h2>
              <div className="grid grid-cols-4 gap-4">
                {overviewCards.map((card, index) => (
                  <div
                    key={index}
                    className="bg-white border border-gray-200 rounded-lg p-4"
                  >
                    <h3 className="text-sm text-gray-600 mb-2">{card.title}</h3>
                    <div className="text-2xl font-semibold text-gray-900 mb-2">
                      {card.value} {card.unit}
                    </div>
                    <Progress
                      value={Math.min((card.value / card.max) * 100, 100)}
                      className="h-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Max: {card.max} {card.unit}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Monthly Consumption Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Monthly Consumption
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={monthlyConsumptionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {allMaterials.map((material, index) => (
                      <Bar
                        key={material}
                        dataKey={material}
                        fill={materialColors[index % materialColors.length]}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Material vs Output Chart */}
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Material vs Output
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={materialOutputData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="Output"
                      stroke="#10B981"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="Used"
                      stroke="#3B82F6"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="Wastage"
                      stroke="#EF4444"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="material-output" className="space-y-6">
            {/* Filtered Material vs Output Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Material vs Output Analysis
              </h3>

              {/* Filters */}
              <div className="flex items-center gap-4 mb-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">Material</label>
                  <Input
                    placeholder="Search material..."
                    className="w-40 text-xs"
                    value={outputFilters.material}
                    onChange={e =>
                      setOutputFilters(prev => ({
                        ...prev,
                        material: e.target.value
                      }))
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">SKU</label>
                  <Input
                    placeholder="Search SKU..."
                    className="w-32 text-xs"
                    value={outputFilters.sku}
                    onChange={e =>
                      setOutputFilters(prev => ({
                        ...prev,
                        sku: e.target.value
                      }))
                    }
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">From</label>
                  <DatePicker
                    value={outputFilters.fromDate}
                    onChange={date =>
                      setOutputFilters(prev => ({ ...prev, fromDate: date }))
                    }
                    placeholder="MM/DD/YYYY"
                    className="w-36"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600">To</label>
                  <DatePicker
                    value={outputFilters.toDate}
                    onChange={date =>
                      setOutputFilters(prev => ({ ...prev, toDate: date }))
                    }
                    placeholder="MM/DD/YYYY"
                    className="w-36"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setOutputFilters({
                      material: "",
                      sku: "",
                      fromDate: undefined,
                      toDate: undefined
                    })
                  }
                >
                  Clear Filters
                </Button>
              </div>

              {/* Line Chart */}
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={filteredMaterialOutputData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="Output"
                    stroke="#10B981"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="Used"
                    stroke="#3B82F6"
                    strokeWidth={2}
                  />
                  <Line
                    type="monotone"
                    dataKey="Wastage"
                    stroke="#EF4444"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Most Used Materials */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Most Used Materials - {currentMonth}
              </h3>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart
                  data={consumptionData
                    .filter(item => item.totalUsed > 0)
                    .sort((a, b) => b.totalUsed - a.totalUsed)}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="material"
                    angle={-45}
                    textAnchor="end"
                    height={100}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip
                    formatter={(value, name) => [
                      `${value} ${consumptionData.find(
                        item => item.totalUsed === value
                      )?.unit || "units"}`,
                      "Quantity Used"
                    ]}
                  />
                  <Legend />
                  <Bar
                    dataKey="totalUsed"
                    fill="#3B82F6"
                    name="Quantity Used"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Top Materials by Usage */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">
                Top 5 Materials by Usage
              </h3>
              <div className="space-y-4">
                {consumptionData
                  .filter(item => item.totalUsed > 0)
                  .sort((a, b) => b.totalUsed - a.totalUsed)
                  .slice(0, 5)
                  .map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <span className="font-medium text-gray-900">
                          {item.material}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-900">
                          {item.totalUsed} {item.unit}
                        </div>
                        <div className="text-sm text-gray-500">
                          used this period
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  )
}
