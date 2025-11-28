'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Filter, Eye } from 'lucide-react'
import { getOrdersByCompany } from '@/lib/data-mongodb'

export default function CompanyOrdersPage() {
  const [companyId, setCompanyId] = useState<string>('')
  const [companyOrders, setCompanyOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Get company ID from localStorage (set during login) - company admin is linked to only one company
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadData = async () => {
        try {
          setLoading(true)
          const storedCompanyId = localStorage.getItem('companyId')
          if (storedCompanyId) {
            setCompanyId(storedCompanyId)
            // Filter orders by company - only show orders for this company
            const filtered = await getOrdersByCompany(storedCompanyId)
            setCompanyOrders(filtered)
          }
        } catch (error) {
          console.error('Error loading orders:', error)
        } finally {
          setLoading(false)
        }
      }
      
      loadData()
    }
  }, [])

  return (
    <DashboardLayout actorType="company">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Order Management</h1>
          <button className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors">
            Place Bulk Order
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
            <select className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent">
              <option value="all">All Locations</option>
              <option value="new-york">New York Office</option>
              <option value="san-francisco">San Francisco Office</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Order ID</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Employee</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Items</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Total</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Dispatch Location</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Date</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Status</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companyOrders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-500">
                      No orders found for your company
                    </td>
                  </tr>
                ) : (
                  companyOrders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="py-4 px-6 text-gray-900 font-medium">{order.id}</td>
                    <td className="py-4 px-6 text-gray-600">{order.employeeName}</td>
                    <td className="py-4 px-6 text-gray-600">
                      <div className="space-y-1">
                        {order.items.map((item: any, idx: number) => (
                          <div key={idx} className="text-sm">
                            {item.uniformName} (Size: {item.size}) x {item.quantity}
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-gray-900 font-semibold">₹{order.total.toFixed(2)}</td>
                    <td className="py-4 px-6 text-gray-600">{order.dispatchLocation}</td>
                    <td className="py-4 px-6 text-gray-600">{order.orderDate}</td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        order.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                        order.status === 'delivered' ? 'bg-blue-100 text-blue-700' :
                        order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <button className="text-blue-600 hover:text-blue-700">
                        <Eye className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}








