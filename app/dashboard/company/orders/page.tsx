'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Filter, Eye } from 'lucide-react'
import { getOrdersByCompany, getCompanyById } from '@/lib/data-mongodb'
import { maskEmployeeName, maskAddress } from '@/lib/utils/data-masking'

export default function CompanyOrdersPage() {
  const [companyId, setCompanyId] = useState<string>('')
  const [companyOrders, setCompanyOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [companyPrimaryColor, setCompanyPrimaryColor] = useState<string>('#f76b1c')
  const [companySecondaryColor, setCompanySecondaryColor] = useState<string>('#f76b1c')
  
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
            
            // Fetch company colors
            const companyDetails = await getCompanyById(storedCompanyId)
            if (companyDetails) {
              setCompanyPrimaryColor(companyDetails.primaryColor || '#f76b1c')
              setCompanySecondaryColor(companyDetails.secondaryColor || companyDetails.primaryColor || '#f76b1c')
            }
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
          <button 
            className="text-white px-4 py-2 rounded-lg font-semibold transition-colors"
            style={{ backgroundColor: companyPrimaryColor || '#f76b1c' }}
            onMouseEnter={(e) => {
              const color = companyPrimaryColor || '#f76b1c'
              const r = parseInt(color.slice(1, 3), 16)
              const g = parseInt(color.slice(3, 5), 16)
              const b = parseInt(color.slice(5, 7), 16)
              const darker = `#${Math.max(0, r - 25).toString(16).padStart(2, '0')}${Math.max(0, g - 25).toString(16).padStart(2, '0')}${Math.max(0, b - 25).toString(16).padStart(2, '0')}`
              e.currentTarget.style.backgroundColor = darker
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = companyPrimaryColor || '#f76b1c'
            }}
          >
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                style={{ 
                  '--tw-ring-color': companyPrimaryColor || '#f76b1c',
                  '--tw-border-color': companyPrimaryColor || '#f76b1c'
                } as React.CSSProperties & { '--tw-ring-color'?: string; '--tw-border-color'?: string }}
                onFocus={(e) => {
                  e.target.style.borderColor = companyPrimaryColor || '#f76b1c'
                  e.target.style.boxShadow = `0 0 0 2px ${companyPrimaryColor || '#f76b1c'}40`
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#d1d5db'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>
            <select 
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
              style={{ 
                '--tw-ring-color': companyPrimaryColor || '#f76b1c',
                '--tw-border-color': companyPrimaryColor || '#f76b1c'
              } as React.CSSProperties & { '--tw-ring-color'?: string; '--tw-border-color'?: string }}
              onFocus={(e) => {
                e.target.style.borderColor = companyPrimaryColor || '#f76b1c'
                e.target.style.boxShadow = `0 0 0 2px ${companyPrimaryColor || '#f76b1c'}40`
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db'
                e.target.style.boxShadow = 'none'
              }}
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="processing">Processing</option>
              <option value="shipped">Shipped</option>
              <option value="delivered">Delivered</option>
            </select>
            <select 
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
              style={{ 
                '--tw-ring-color': companyPrimaryColor || '#f76b1c',
                '--tw-border-color': companyPrimaryColor || '#f76b1c'
              } as React.CSSProperties & { '--tw-ring-color'?: string; '--tw-border-color'?: string }}
              onFocus={(e) => {
                e.target.style.borderColor = companyPrimaryColor || '#f76b1c'
                e.target.style.boxShadow = `0 0 0 2px ${companyPrimaryColor || '#f76b1c'}40`
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d1d5db'
                e.target.style.boxShadow = 'none'
              }}
            >
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
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Payment Type</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Dispatch Location</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Date</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Status</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {companyOrders.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      No orders found for your company
                    </td>
                  </tr>
                ) : (
                  companyOrders.map((order) => (
                  <tr key={order.id} className="border-b hover:bg-gray-50">
                    <td className="py-4 px-6 text-gray-900 font-medium">{order.id}</td>
                    <td className="py-4 px-6 text-gray-600">{maskEmployeeName(order.employeeName || 'N/A')}</td>
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
                    <td className="py-4 px-6 text-gray-600">
                      {order.isPersonalPayment ? (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                          Personal Payment
                          {order.personalPaymentAmount && ` (₹${parseFloat(order.personalPaymentAmount).toFixed(2)})`}
                        </span>
                      ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          Company Paid
                        </span>
                      )}
                    </td>
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








