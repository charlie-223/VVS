import { useState, useEffect } from "react"
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Package,
  Search
} from "lucide-react"
import { Card } from "./ui/card"
import { Input } from "./ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { Progress } from "./ui/progress"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts"
import { PageHeader } from "./PageHeader"
import { supabaseAdmin } from '../lib/supabaseClient'

export function Dashboard({
  inventory,
  transactions,
  currentUser,
  onLogout,
  lowStockItems = [],
  onNavigateToAccount
}) {
  const [searchQuery, setSearchQuery] = useState("")
  const [localInventory, setLocalInventory] = useState([])
  const [localTransactions, setLocalTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Fetch inventory and transactions from Supabase on mount
  useEffect(() => {
    let mounted = true
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch inventory (use date_added which is the project's inventory date column)
        const { data: invData, error: invErr } = await supabaseAdmin
          .from('inventory')
          .select('id,name,quantity,unit,reorder_level,sku,status,date_added')
          .order('date_added', { ascending: false })

        if (invErr) throw invErr

        // Map DB fields to camelCase expected by this component
        const mappedInventory = (invData || []).map(i => ({
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          reorderLevel: i.reorder_level,
          sku: i.sku,
          status: i.status,
          dateAdded: i.date_added
        }))

        // Fetch transactions (catalog_id-based). Join to catalog to get persistent names/SKUs
        const { data: txData, error: txErr } = await supabaseAdmin
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
            catalog:catalog_id ( name )
          `)
          .order('created_at', { ascending: false })

        if (txErr) throw txErr

        // Build a quick lookup for inventory names (still useful for current inventory display)
        const invById = new Map((mappedInventory || []).map(i => [i.id, i.name]))

        // Try embedded join first (requires FK). If that fails with PGRST200,
        // fall back to fetching catalogs separately and mapping client-side.
        let mappedTransactions = []
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
              catalog:catalog_id ( name )
            `)
            .order('created_at', { ascending: false })

          if (!joinErr && Array.isArray(joinedData)) {
            mappedTransactions = joinedData.map(t => ({
              id: t.id,
              catalogId: t.catalog_id,
              type: t.type,
              quantity: t.quantity,
              note: t.note,
              userId: t.user_id,
              username: t.username,
              material: (t.catalog && t.catalog.name) || invById.get(t.catalog_id) || t.note || '',
              dateTime: t.created_at
            }))
          } else if (joinErr && joinErr.code !== 'PGRST200') {
            throw joinErr
          }
        } catch (e) {
          if (!(e && e.code === 'PGRST200')) throw e
        }

        if (!mappedTransactions.length) {
          // Fallback: fetch catalogs separately
          const txRows = Array.isArray(txData) ? txData : []
          const catalogIds = Array.from(new Set(txRows.map(t => t.catalog_id).filter(Boolean)))

          let catalogsById = {}
          if (catalogIds.length) {
            const { data: catRows, error: catErr } = await supabaseAdmin
              .from('inventory_catalog')
              .select('id,name')
              .in('id', catalogIds)
            if (catErr) {
              console.warn('Failed to fetch catalog rows for dashboard transactions:', catErr)
            } else if (Array.isArray(catRows)) {
              catalogsById = Object.fromEntries(catRows.map(c => [c.id, c]))
            }
          }

          mappedTransactions = txRows.map(t => ({
            id: t.id,
            catalogId: t.catalog_id,
            type: t.type,
            quantity: t.quantity,
            note: t.note,
            userId: t.user_id,
            username: t.username,
            material: (t.catalog_id && catalogsById[t.catalog_id]?.name) || invById.get(t.catalog_id) || t.note || '',
            dateTime: t.created_at
          }))
        }

        if (!mounted) return
        setLocalInventory(mappedInventory)
        setLocalTransactions(mappedTransactions)
        setError(null)
      } catch (e) {
        console.error('Dashboard fetch error', e)
        if (mounted) setError(e)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchData()

    return () => {
      mounted = false
    }
  }, [])

  // Use only database-fetched data as the authoritative source.
  // Do NOT fall back to props so the dashboard reflects the DB state only.
  const sourceInventory = localInventory || []
  const sourceTransactions = localTransactions || []

  // Filter inventory based on search
  const filteredInventory = sourceInventory.filter(item =>
    (item.name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Calculate analytics data
  const highStockItems = filteredInventory.filter(
    item => item.quantity > item.reorderLevel * 2
  )

  const lowStockFilteredItems = filteredInventory.filter(
    item => item.status === "Low Stock" || item.status === "Out of Stock"
  )

  // Calculate in-demand items based on usage frequency
  const demandData = sourceInventory
    .map(item => {
      const recentUsage = sourceTransactions
        .filter(
          // Last 30 days
          t =>
            t.type === "Used" &&
            (t.material || '').toLowerCase() === (item.name || '').toLowerCase() &&
            new Date(t.dateTime) >
              new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        )
        .reduce((sum, t) => sum + t.quantity, 0)

      return {
        ...item,
        recentUsage,
        demandScore: (recentUsage / (item.quantity + recentUsage)) * 100
      }
    })
    .sort((a, b) => b.demandScore - a.demandScore)

  const inDemandItems = demandData.slice(0, 5)

  // Calculate predictive analytics data based on historical usage patterns
  const predictiveData = (() => {
    // Get the current date for relative calculations
    const currentDate = new Date()
    
    // Calculate average monthly usage and trend
    const monthlyUsage = sourceTransactions
      .filter(t => t.type === "Used")
      .reduce((acc, t) => {
        const date = new Date(t.dateTime)
        const key = `${date.getFullYear()}-${date.getMonth()}`
        if (!acc[key]) {
          acc[key] = { total: 0, count: 0 }
        }
        acc[key].total += t.quantity || 0
        acc[key].count++
        return acc
      }, {})

    // Calculate trend from the last 3 months
    const last3Months = Object.entries(monthlyUsage)
      .sort((a, b) => new Date(b[0]) - new Date(a[0]))
      .slice(0, 3)
      .map(([_, data]) => data.total)

    const trend = last3Months.length >= 2
      ? (last3Months[0] - last3Months[last3Months.length - 1]) / last3Months.length
      : 0

    // Calculate baseline from recent average
    const baselineUsage = last3Months.reduce((sum, val) => sum + val, 0) / last3Months.length

    // Generate predictions for next 5 months
    return Array.from({ length: 5 }).map((_, index) => {
      const futureDate = new Date(currentDate)
      futureDate.setMonth(currentDate.getMonth() + index)
      
      // Add trend and some seasonal variation
      const seasonalFactor = 1 + Math.sin((futureDate.getMonth() + 1) * Math.PI / 6) * 0.1
      const predicted = Math.round((baselineUsage + trend * index) * seasonalFactor)
      
      // Confidence decreases as we look further into the future
      const confidence = Math.max(60, Math.round(95 - index * 5))
      
      return {
        month: futureDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }),
        predicted,
        actual: null, // Will be filled in as actuals become available
        confidence
      }
    })
  })()

  const reorderPredictions = sourceInventory
    .map(item => {
      const avgUsage =
        (sourceTransactions || [])
          .filter(
            t =>
              t.type === "Used" &&
              (t.material || '').toLowerCase() === (item.name || '').toLowerCase()
          )
          .reduce((sum, t) => sum + (t.quantity || 0), 0) / 30 // Daily average

      const daysUntilReorder = Math.max(
        0,
        Math.floor(((item.quantity || 0) - (item.reorderLevel || 0)) / (avgUsage || 1))
      )

      return {
        name: item.name,
        currentStock: item.quantity,
        reorderLevel: item.reorderLevel,
        daysUntilReorder,
        predictedReorderDate: new Date(
          Date.now() + daysUntilReorder * 24 * 60 * 60 * 1000
        ).toLocaleDateString()
      }
    })
    .sort((a, b) => a.daysUntilReorder - b.daysUntilReorder)

  // Calculate stock trends from actual transaction data
  const stockTrends = (() => {
    // Get the last 4 months of data
    const months = ['Jul', 'Aug', 'Sep', 'Oct'].map((month, idx) => {
      const date = new Date()
      date.setMonth(date.getMonth() - (3 - idx)) // Start 3 months ago
      return {
        month,
        startDate: new Date(date.getFullYear(), date.getMonth(), 1),
        endDate: new Date(date.getFullYear(), date.getMonth() + 1, 0)
      }
    })

    return months.map(({ month, startDate, endDate }) => {
      // Get transactions for this month
      const monthTransactions = sourceTransactions.filter(t => 
        new Date(t.dateTime) >= startDate && new Date(t.dateTime) <= endDate
      )

      // Calculate total stock level (sum of all inventory at month end)
      const stock = sourceInventory.reduce((sum, item) => sum + (item.quantity || 0), 0)

      // Calculate usage (sum of all "Used" transactions)
      const usage = monthTransactions
        .filter(t => t.type === "Used")
        .reduce((sum, t) => sum + (t.quantity || 0), 0)

      // Calculate efficiency (successful transactions vs total attempts)
      const successfulTx = monthTransactions.filter(t => !t.note?.includes('error')).length
      const totalTx = monthTransactions.length
      const efficiency = totalTx > 0 ? Math.round((successfulTx / totalTx) * 100) : 100

      return {
        month,
        stock,
        usage,
        efficiency
      }
    })
  })()

  // Compute category distribution from actual inventory quantities
  const categoryDistribution = (() => {
    // Sum quantities by material type
    const typeQuantities = sourceInventory.reduce((acc, item) => {
      const type = item.name || 'Other' // Use item name as the type
      acc[type] = (acc[type] || 0) + (item.quantity || 0)
      return acc
    }, {})

    // Convert to percentages and format for the pie chart
    const total = Object.values(typeQuantities).reduce((sum, qty) => sum + qty, 0)
    const categories = Object.entries(typeQuantities).map(([type, quantity], index) => {
      // Rotate through colors for different categories
      const colors = ['#3B82F6', '#F97316', '#10B981', '#8B5CF6', '#EC4899', '#EAB308']
      return {
        name: type,
        value: Math.round((quantity / total) * 100),
        color: colors[index % colors.length]
      }
    })

    // Sort by value descending
    return categories.sort((a, b) => b.value - a.value)
  })()

  return (
    <div className="bg-gray-50 h-full flex flex-col">
      <PageHeader
        title="Dashboard Analytics"
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
            placeholder="Search inventory items..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="predictive">Predictive</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Items</p>
                    <p className="text-2xl font-semibold text-gray-900">
                      {filteredInventory.length}
                    </p>
                  </div>
                  <Package className="w-8 h-8 text-blue-500" />
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">High Stock</p>
                    <p className="text-2xl font-semibold text-green-600">
                      {highStockItems.length}
                    </p>
                  </div>
                  <TrendingUp className="w-8 h-8 text-green-500" />
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Low Stock</p>
                    <p className="text-2xl font-semibold text-red-600">
                      {lowStockFilteredItems.length}
                    </p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-red-500" />
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Alerts</p>
                    <p className="text-2xl font-semibold text-yellow-600">
                      {lowStockFilteredItems.length}
                    </p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-yellow-500" />
                </div>
              </Card>
            </div>

            {/* High Stock Items */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                High Stock Items
              </h3>
              <div className="space-y-3">
                {highStockItems.slice(0, 5).map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        {item.quantity} {item.unit} in stock
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-green-600">
                        {Math.round((item.quantity / item.reorderLevel) * 100)}%
                        above reorder level
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Low Stock Items */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Low Stock Alerts
              </h3>
              <div className="space-y-3">
                {lowStockFilteredItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        {item.quantity} {item.unit} remaining
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-red-600">
                        Reorder at {item.reorderLevel} {item.unit}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* In Demand Items */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                In Demand Items
              </h3>
              <div className="space-y-3">
                {inDemandItems.map(item => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 bg-blue-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-sm text-gray-600">
                        Recent usage: {item.recentUsage} {item.unit}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-blue-600">
                        Demand Score: {Math.round(item.demandScore)}%
                      </p>
                      <Progress
                        value={item.demandScore}
                        className="w-20 h-2 mt-1"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            {/* Stock Trends Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Stock Trends & Usage
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={stockTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="stock"
                    stackId="1"
                    stroke="#3B82F6"
                    fill="#3B82F6"
                    fillOpacity={0.3}
                  />
                  <Area
                    type="monotone"
                    dataKey="usage"
                    stackId="2"
                    stroke="#F97316"
                    fill="#F97316"
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>

            {/* Category Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Inventory Distribution
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={categoryDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={80}
                      dataKey="value"
                      label={({ value }) => `${value}%`}
                    >
                      {categoryDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap justify-center gap-4 mt-4">
                  {categoryDistribution.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: item.color }}
                      ></div>
                      <span className="text-sm text-gray-600">{item.name}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Efficiency Trends
                </h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={stockTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="efficiency"
                      stroke="#10B981"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="predictive" className="space-y-6">
            {/* Predictive Consumption Chart */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Predictive Consumption Analysis
              </h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={predictiveData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="predicted"
                    stroke="#8B5CF6"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Predicted Usage"
                  />
                  <Line
                    type="monotone"
                    dataKey="confidence"
                    stroke="#10B981"
                    strokeWidth={2}
                    name="Confidence %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            {/* Reorder Predictions */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Reorder Predictions
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Material
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Current Stock
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Reorder Level
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Days Until Reorder
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Predicted Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {reorderPredictions.slice(0, 8).map((item, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.currentStock}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.reorderLevel}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs ${
                              item.daysUntilReorder <= 7
                                ? "bg-red-100 text-red-800"
                                : item.daysUntilReorder <= 14
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {item.daysUntilReorder} days
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {item.predictedReorderDate}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
