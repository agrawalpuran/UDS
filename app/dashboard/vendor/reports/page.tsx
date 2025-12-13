'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { BarChart3, Download, Package, DollarSign, TrendingUp } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getAllOrders, getAllProducts } from '@/lib/data-mongodb'

export default function VendorReportsPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const [ordersData, productsData] = await Promise.all([
          getAllOrders(),
          getAllProducts()
        ])
        setOrders(ordersData)
        setProducts(productsData)
      } catch (error) {
        console.error('Error loading reports data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])

  const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0)
  const totalOrders = orders.length
  const totalSKUs = products.length
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0

  const stats = [
    { name: 'Total Revenue', value: `₹${totalRevenue.toFixed(2)}`, icon: DollarSign, color: 'green' },
    { name: 'Total Orders', value: totalOrders, icon: Package, color: 'blue' },
    { name: 'Active SKUs', value: totalSKUs, icon: TrendingUp, color: 'purple' },
    { name: 'Avg Order Value', value: `₹${avgOrderValue.toFixed(2)}`, icon: BarChart3, color: 'orange' },
  ]

  return (
    <DashboardLayout actorType="vendor">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Vendor Reports</h1>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2">
            <Download className="h-5 w-5" />
            <span>Export Report</span>
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon
            const getColorClasses = (color: string | undefined) => {
              const colors: Record<string, { bg: string; text: string }> = {
                green: { bg: 'bg-green-100', text: 'text-green-600' },
                blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
                purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
                orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
              }
              return colors[color || 'blue'] || colors.blue
            }
            const colorClasses = getColorClasses(stat.color) || { bg: 'bg-blue-100', text: 'text-blue-600' }
            return (
              <div key={stat.name} className="bg-white rounded-xl shadow-lg p-6">
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
          })}
        </div>

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Sales Trends</h2>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Sales chart visualization</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Inventory Status</h2>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">Inventory chart visualization</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

