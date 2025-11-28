'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Package, CheckCircle, Clock, Truck } from 'lucide-react'
import { getEmployeeByEmail, getOrdersByEmployee } from '@/lib/data-mongodb'
import Link from 'next/link'

export default function ConsumerOrdersPage() {
  const [currentEmployee, setCurrentEmployee] = useState<any>(null)
  const [myOrders, setMyOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Get current employee from localStorage (email stored during login)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadData = async () => {
        try {
          setLoading(true)
          const userEmail = localStorage.getItem('userEmail')
          if (!userEmail) {
            setLoading(false)
            return
          }
          
          const employee = await getEmployeeByEmail(userEmail)
          if (employee) {
            setCurrentEmployee(employee)
            // Get orders for this employee
            const employeeOrders = await getOrdersByEmployee(employee.id)
            setMyOrders(employeeOrders)
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Delivered':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'Dispatched':
        return <Truck className="h-5 w-5 text-purple-600" />
      case 'Awaiting fulfilment':
        return <Package className="h-5 w-5 text-blue-600" />
      case 'Awaiting approval':
        return <Clock className="h-5 w-5 text-yellow-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Delivered':
        return 'bg-green-100 text-green-700'
      case 'Dispatched':
        return 'bg-purple-100 text-purple-700'
      case 'Awaiting fulfilment':
        return 'bg-blue-100 text-blue-700'
      case 'Awaiting approval':
        return 'bg-yellow-100 text-yellow-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  const formatDate = (date: any) => {
    if (!date) return 'N/A'
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date
      if (isNaN(dateObj.getTime())) return 'N/A'
      return dateObj.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      console.error('Error formatting date:', error)
      return 'N/A'
    }
  }

  return (
    <DashboardLayout actorType="consumer">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <Link
            href="/dashboard/consumer/catalog"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md"
          >
            Place New Order
          </Link>
        </div>

        {myOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">No Orders Yet</h2>
            <p className="text-gray-600 mb-6">Start browsing our catalog to place your first order.</p>
            <Link
              href="/dashboard/consumer/catalog"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md"
            >
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {myOrders.map((order) => {
              if (!order || !order.id) return null
              
              return (
                <div key={order.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      {getStatusIcon(order.status || 'Awaiting approval')}
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Order #{order.id}</h3>
                        <p className="text-sm text-gray-600">
                          Placed on {formatDate(order.orderDate)}
                        </p>
                      </div>
                    </div>
                    <span className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.status || 'Awaiting approval')}`}>
                      {order.status || 'Awaiting approval'}
                    </span>
                  </div>

                  <div className="border-t pt-4 mb-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Order Items:</h4>
                    <div className="space-y-2">
                      {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                        order.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                            <div>
                              <p className="font-medium text-gray-900">{item.uniformName || 'Unknown Item'}</p>
                              <p className="text-sm text-gray-600">
                                Size: {item.size || 'N/A'} • Quantity: {item.quantity || 0}
                              </p>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-500">No items found</p>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Order Date:</p>
                        <p className="font-semibold text-gray-900">
                          {formatDate(order.orderDate)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Dispatch Location:</p>
                        <p className="font-semibold text-gray-900">{order.dispatchLocation || 'N/A'}</p>
                      </div>
                    </div>
                    {order.deliveryAddress && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-600">Delivery Address:</p>
                        <p className="font-semibold text-gray-900">{order.deliveryAddress}</p>
                      </div>
                    )}
                    {order.estimatedDeliveryTime && (
                      <div className="mt-3">
                        <p className="text-sm text-gray-600">Estimated Delivery:</p>
                        <p className="font-semibold text-gray-900">{order.estimatedDeliveryTime}</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}




