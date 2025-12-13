'use client'

import DashboardLayout from '@/components/DashboardLayout'
import { Search, CheckCircle, XCircle, Package, Truck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { getAllOrders, getOrdersByVendor, updateOrderStatus } from '@/lib/data-mongodb'
import { maskEmployeeName, maskAddress } from '@/lib/utils/data-masking'

export default function VendorOrdersPage() {
  const [orders, setOrders] = useState<any[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean
    orderId: string | null
    action: 'shipped' | 'delivered' | null
  }>({ show: false, orderId: null, action: null })

  const loadOrders = async () => {
    try {
      setLoading(true)
      // Get vendor ID from localStorage
      const storedVendorId = typeof window !== 'undefined' ? localStorage.getItem('vendorId') : null
      if (storedVendorId) {
        // Load only orders for this vendor
        const vendorOrders = await getOrdersByVendor(storedVendorId)
        console.log('Loaded vendor orders:', vendorOrders.length)
        console.log('Order statuses:', vendorOrders.map((o: any) => ({ id: o.id, status: o.status, vendorName: o.vendorName })))
        setOrders(vendorOrders)
      } else {
        // Fallback: get all orders if no vendor ID (shouldn't happen in production)
        console.warn('No vendor ID found, loading all orders')
        const allOrders = await getAllOrders()
        setOrders(allOrders)
      }
    } catch (error) {
      console.error('Error loading orders:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const filteredOrders = orders.filter(order =>
    order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.employeeName?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleMarkAsShipped = (orderId: string) => {
    setConfirmDialog({ show: true, orderId, action: 'shipped' })
  }

  const handleMarkAsDelivered = (orderId: string) => {
    setConfirmDialog({ show: true, orderId, action: 'delivered' })
  }

  const handleConfirm = async () => {
    if (!confirmDialog.orderId || !confirmDialog.action) return

    try {
      const newStatus = confirmDialog.action === 'shipped' ? 'Dispatched' : 'Delivered'
      await updateOrderStatus(confirmDialog.orderId, newStatus)
      
      // Reload orders to get updated data
      await loadOrders()
      
      setConfirmDialog({ show: false, orderId: null, action: null })
    } catch (error) {
      console.error('Error updating order status:', error)
      alert('Failed to update order status. Please try again.')
    }
  }

  const handleCancel = () => {
    setConfirmDialog({ show: false, orderId: null, action: null })
  }

  return (
    <DashboardLayout actorType="vendor">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Order Fulfillment</h1>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Orders */}
        <div className="space-y-4">
          {loading ? (
            <p className="text-gray-600 text-center py-8">Loading orders...</p>
          ) : filteredOrders.length === 0 ? (
            <p className="text-gray-600 text-center py-8">No orders found</p>
          ) : (
            filteredOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Order #{order.id}</h3>
                  <p className="text-sm text-gray-600">Employee: {maskEmployeeName(order.employeeName || 'N/A')}</p>
                  <p className="text-sm text-gray-600">Date: {order.orderDate}</p>
                </div>
                <span className={`px-4 py-2 rounded-full text-sm font-semibold ${
                  order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                  order.status === 'Dispatched' ? 'bg-blue-100 text-blue-700' :
                  order.status === 'Awaiting fulfilment' ? 'bg-purple-100 text-purple-700' :
                  order.status === 'Awaiting approval' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {order.status}
                </span>
              </div>

              <div className="border-t pt-4 mb-4">
                <h4 className="font-semibold text-gray-900 mb-2">Items:</h4>
                <div className="space-y-2">
                  {order.items.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600">
                        {item.uniformName} (Size: {item.size}) x {item.quantity}
                      </span>
                      <span className="text-gray-900 font-medium">₹{(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t flex justify-between items-center">
                  <span className="text-gray-600">Dispatch to: {order.dispatchLocation}</span>
                  <span className="text-lg font-bold text-gray-900">Total: ₹{order.total.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex space-x-3">
                {/* Show "Mark as Shipped" for orders that are not yet Dispatched or Delivered */}
                {(order.status === 'Awaiting approval' || order.status === 'Awaiting fulfilment') && (
                  <button 
                    onClick={() => handleMarkAsShipped(order.id)}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <Truck className="h-5 w-5" />
                    <span>Mark as Shipped</span>
                  </button>
                )}
                {/* Show "Mark as Delivered" for orders that are Dispatched but not Delivered */}
                {order.status === 'Dispatched' && (
                  <button 
                    onClick={() => handleMarkAsDelivered(order.id)}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="h-5 w-5" />
                    <span>Mark as Delivered</span>
                  </button>
                )}
                {/* Show "Delivered" badge for completed orders */}
                {order.status === 'Delivered' && (
                  <div className="flex-1 bg-gray-100 text-gray-600 py-2 rounded-lg font-semibold flex items-center justify-center space-x-2">
                    <CheckCircle className="h-5 w-5" />
                    <span>Delivered</span>
                  </div>
                )}
                <button className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors">
                  View Details
                </button>
              </div>
            </div>
          ))
          )}
        </div>

        {/* Confirmation Dialog */}
        {confirmDialog.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Confirm Action</h2>
              <p className="text-gray-700 mb-6">
                Are you sure you want to mark this order as {confirmDialog.action === 'shipped' ? 'shipped' : 'delivered'}?
              </p>
              <div className="flex space-x-3">
                <button
                  onClick={handleCancel}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  No
                </button>
                <button
                  onClick={handleConfirm}
                  className={`flex-1 text-white py-3 rounded-lg font-semibold transition-colors ${
                    confirmDialog.action === 'shipped' 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}








