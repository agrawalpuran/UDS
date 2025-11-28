'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { Package, ShoppingCart, TrendingUp, AlertCircle } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getAllProducts, getAllOrders, getProductsByVendor } from '@/lib/data-mongodb'
import Link from 'next/link'

export default function VendorDashboard() {
  const [vendorId, setVendorId] = useState<string>('')
  const [products, setProducts] = useState<any[]>([])
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showTooltip, setShowTooltip] = useState<string | null>(null)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const storedVendorId = typeof window !== 'undefined' ? localStorage.getItem('vendorId') : null
        if (storedVendorId) {
          setVendorId(storedVendorId)
          const vendorProducts = await getProductsByVendor(storedVendorId)
          setProducts(vendorProducts)
        } else {
          // Fallback: get all products if no vendor ID
          const allProducts = await getAllProducts()
          setProducts(allProducts)
        }
        
        const allOrders = await getAllOrders()
        setOrders(allOrders)
      } catch (error) {
        console.error('Error loading vendor data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  const totalInventory = products.reduce((sum, item) => sum + (item.stock || 0), 0)
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length
  const lowStockItems = products.filter(item => (item.stock || 0) < 50).length

  const stats = [
    { name: 'Total Inventory', value: totalInventory, icon: Package, color: 'blue' },
    { name: 'Pending Orders', value: pendingOrders, icon: ShoppingCart, color: 'orange' },
    { name: 'Low Stock Items', value: lowStockItems, icon: AlertCircle, color: 'red' },
    { name: 'Active SKUs', value: products.length, icon: TrendingUp, color: 'green' },
  ]

  return (
    <DashboardLayout actorType="vendor">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Vendor Dashboard</h1>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon
            const getColorClasses = (color: string) => {
              const colors: Record<string, { bg: string; text: string }> = {
                blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
                orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
                red: { bg: 'bg-red-100', text: 'text-red-600' },
                green: { bg: 'bg-green-100', text: 'text-green-600' },
              }
              return colors[color] || colors.blue
            }
            const colorClasses = getColorClasses(stat.color)
            
            // Determine if card is clickable and get link
            let isClickable = false
            let linkHref = ''
            if (stat.name === 'Total Inventory' && totalInventory > 0) {
              isClickable = true
              linkHref = '/dashboard/vendor/inventory'
            } else if (stat.name === 'Pending Orders' && pendingOrders > 0) {
              isClickable = true
              linkHref = '/dashboard/vendor/orders'
            } else if (stat.name === 'Low Stock Items' && lowStockItems > 0) {
              isClickable = true
              linkHref = '/dashboard/vendor/inventory'
            } else if (stat.name === 'Active SKUs' && products.length > 0) {
              isClickable = true
              linkHref = '/dashboard/vendor/inventory'
            }
            
            // Get inventory breakdown
            const getInventoryBreakdown = () => {
              return products
                .slice(0, 10)
                .map(product => ({
                  name: product.name || 'Unknown',
                  stock: product.stock || 0,
                  category: product.category || 'N/A'
                }))
            }
            
            // Get pending orders list
            const getPendingOrdersList = () => {
              return orders
                .filter(o => o.status === 'pending' || o.status === 'confirmed')
                .slice(0, 10)
                .map(order => ({
                  id: order.id,
                  employeeName: order.employeeName || 'Unknown',
                  total: order.total || 0,
                  itemsCount: order.items?.length || 0,
                  date: order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'
                }))
            }
            
            // Get low stock items
            const getLowStockItemsList = () => {
              return products
                .filter(item => (item.stock || 0) < 50)
                .slice(0, 10)
                .map(item => ({
                  name: item.name || 'Unknown',
                  stock: item.stock || 0,
                  category: item.category || 'N/A'
                }))
            }
            
            // Get active SKUs list
            const getActiveSKUsList = () => {
              return products
                .slice(0, 10)
                .map(product => ({
                  name: product.name || 'Unknown',
                  stock: product.stock || 0,
                  category: product.category || 'N/A',
                  price: product.price || 0
                }))
            }
            
            const StatCard = (
              <div 
                className={`bg-white rounded-xl shadow-lg p-6 ${isClickable ? 'cursor-pointer hover:shadow-xl transition-shadow' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm mb-1">{stat.name}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`${colorClasses.bg} p-3 rounded-lg`}>
                    <Icon className={`h-6 w-6 ${colorClasses.text}`} />
                  </div>
                </div>
              </div>
            )
            
            // Render tooltip based on stat type
            const renderTooltip = () => {
              if (showTooltip !== stat.name) return null
              
              if (stat.name === 'Total Inventory' && totalInventory > 0) {
                const items = getInventoryBreakdown()
                return (
                  <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none">
                    <div className="text-sm font-semibold mb-3 pb-2 border-b border-gray-700">
                      Inventory Breakdown ({products.length} items)
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {items.map((item: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="font-semibold text-white mb-1">{item.name}</div>
                          <div className="text-gray-300">Stock: {item.stock} units</div>
                          <div className="text-gray-300">Category: {item.category}</div>
                          {idx < items.length - 1 && (
                            <div className="border-t border-gray-700 mt-2 pt-2"></div>
                          )}
                        </div>
                      ))}
                      {products.length > 10 && (
                        <div className="text-gray-400 text-xs mt-2 pt-2 border-t border-gray-700">
                          +{products.length - 10} more items
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              
              if (stat.name === 'Pending Orders' && pendingOrders > 0) {
                const ordersList = getPendingOrdersList()
                return (
                  <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none">
                    <div className="text-sm font-semibold mb-3 pb-2 border-b border-gray-700">
                      Pending Orders ({pendingOrders} total)
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {ordersList.map((order: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="font-semibold text-white mb-1">Order #{order.id}</div>
                          <div className="text-gray-300">Employee: {order.employeeName}</div>
                          <div className="text-gray-300">Items: {order.itemsCount}</div>
                          <div className="text-gray-300">Amount: ₹{order.total.toFixed(2)}</div>
                          <div className="text-gray-400">Date: {order.date}</div>
                          {idx < ordersList.length - 1 && (
                            <div className="border-t border-gray-700 mt-2 pt-2"></div>
                          )}
                        </div>
                      ))}
                      {pendingOrders > 10 && (
                        <div className="text-gray-400 text-xs mt-2 pt-2 border-t border-gray-700">
                          +{pendingOrders - 10} more orders
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              
              if (stat.name === 'Low Stock Items' && lowStockItems > 0) {
                const lowStock = getLowStockItemsList()
                return (
                  <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none">
                    <div className="text-sm font-semibold mb-3 pb-2 border-b border-gray-700">
                      Low Stock Items ({lowStockItems} total)
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {lowStock.map((item: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="font-semibold text-white mb-1">{item.name}</div>
                          <div className="text-red-300">Stock: {item.stock} units (Low!)</div>
                          <div className="text-gray-300">Category: {item.category}</div>
                          {idx < lowStock.length - 1 && (
                            <div className="border-t border-gray-700 mt-2 pt-2"></div>
                          )}
                        </div>
                      ))}
                      {lowStockItems > 10 && (
                        <div className="text-gray-400 text-xs mt-2 pt-2 border-t border-gray-700">
                          +{lowStockItems - 10} more items
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              
              if (stat.name === 'Active SKUs' && products.length > 0) {
                const skus = getActiveSKUsList()
                return (
                  <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none">
                    <div className="text-sm font-semibold mb-3 pb-2 border-b border-gray-700">
                      Active SKUs ({products.length} total)
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {skus.map((sku: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="font-semibold text-white mb-1">{sku.name}</div>
                          <div className="text-gray-300">Stock: {sku.stock} units</div>
                          <div className="text-gray-300">Category: {sku.category}</div>
                          <div className="text-gray-300">Price: ₹{sku.price.toFixed(2)}</div>
                          {idx < skus.length - 1 && (
                            <div className="border-t border-gray-700 mt-2 pt-2"></div>
                          )}
                        </div>
                      ))}
                      {products.length > 10 && (
                        <div className="text-gray-400 text-xs mt-2 pt-2 border-t border-gray-700">
                          +{products.length - 10} more SKUs
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              
              return null
            }
            
            if (isClickable) {
              return (
                <div 
                  key={stat.name} 
                  className="relative"
                  onMouseEnter={() => setShowTooltip(stat.name)}
                  onMouseLeave={() => setShowTooltip(null)}
                >
                  <Link href={linkHref} className="block">
                    {StatCard}
                  </Link>
                  {renderTooltip()}
                </div>
              )
            }
            
            return (
              <div key={stat.name}>
                {StatCard}
              </div>
            )
          })}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Order ID</th>
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Employee</th>
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Items</th>
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Total</th>
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Status</th>
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  orders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">{order.id}</td>
                      <td className="py-3 px-4 text-gray-600">{order.employeeName}</td>
                      <td className="py-3 px-4 text-gray-600">{order.items?.length || 0} items</td>
                      <td className="py-3 px-4 text-gray-900 font-semibold">₹{order.total?.toFixed(2) || '0.00'}</td>
                      <td className="py-3 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          order.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                          order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {order.status || 'unknown'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {order.orderDate ? new Date(order.orderDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric'
                        }) : 'N/A'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStockItems > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <div className="flex items-center space-x-3">
              <AlertCircle className="h-6 w-6 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-900">Low Stock Alert</h3>
                <p className="text-yellow-700 text-sm">You have {lowStockItems} items with stock below 50 units. Consider restocking soon.</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

