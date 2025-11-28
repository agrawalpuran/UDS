'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { CheckCircle, MapPin, Clock, Package, AlertCircle } from 'lucide-react'
import { getProductsByCompany, getEmployeeByEmail, getCompanyById, createOrder } from '@/lib/data-mongodb'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function OrderConfirmationPage() {
  const router = useRouter()
  const [orderData, setOrderData] = useState<any>(null)
  const [currentEmployee, setCurrentEmployee] = useState<any>(null)
  const [companyProducts, setCompanyProducts] = useState<any[]>([])
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [orderSaved, setOrderSaved] = useState(false)
  const [savingOrder, setSavingOrder] = useState(false)
  
  // Get current employee from localStorage
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
            // Get only products linked to this company
            // Ensure companyId is a string (handle populated objects)
            const companyId = typeof employee.companyId === 'object' && employee.companyId?.id 
              ? employee.companyId.id 
              : employee.companyId
            const [products, companyData] = await Promise.all([
              getProductsByCompany(companyId),
              getCompanyById(companyId)
            ])
            setCompanyProducts(products)
            setCompany(companyData)
          }
        } catch (error) {
          console.error('Error loading employee data:', error)
        } finally {
          setLoading(false)
        }
      }
      
      loadData()
    }
  }, [])

  useEffect(() => {
    // Check for pending order with a small delay to ensure sessionStorage is available
    const checkPendingOrder = () => {
      try {
        const pendingOrder = sessionStorage.getItem('pendingOrder')
        console.log('Order confirmation: Checking for pending order', pendingOrder ? 'Found' : 'Not found')
        if (pendingOrder) {
          const parsed = JSON.parse(pendingOrder)
          console.log('Order confirmation: Parsed order data', parsed)
          setOrderData(parsed)
          // Don't clear immediately - wait until component is fully loaded
          // sessionStorage.removeItem('pendingOrder')
        } else {
          // Only redirect if we're sure there's no pending order
          // Give it a moment in case sessionStorage hasn't synced yet
          setTimeout(() => {
            const checkAgain = sessionStorage.getItem('pendingOrder')
            if (!checkAgain) {
              console.log('Order confirmation: No pending order found, redirecting to catalog')
              router.push('/dashboard/consumer/catalog')
            }
          }, 100)
        }
      } catch (error) {
        console.error('Error reading pending order:', error)
        router.push('/dashboard/consumer/catalog')
      }
    }
    
    // Check immediately and also after a small delay
    checkPendingOrder()
    const timeout = setTimeout(checkPendingOrder, 50)
    
    return () => clearTimeout(timeout)
  }, [router])
  
  // Save order to database when order data and employee are loaded
  useEffect(() => {
    const saveOrder = async () => {
      if (!orderData || !currentEmployee || !companyProducts || orderSaved || savingOrder) {
        return
      }

      try {
        setSavingOrder(true)
        console.log('Saving order to database...', { orderData, currentEmployee })

        // Calculate estimated delivery time
        const getEstimatedDeliveryTime = () => {
          if (!currentEmployee?.dispatchPreference) {
            return '5-7 business days'
          }
          if (currentEmployee.dispatchPreference === 'direct') {
            return '3-5 business days'
          } else if (currentEmployee.dispatchPreference === 'central') {
            return '5-7 business days'
          } else {
            return '7-10 business days'
          }
        }

        // Prepare order items with prices
        const orderItems = orderData.items.map((item: any) => {
          const uniform = companyProducts.find((u: any) => u.id === item.uniformId)
          return {
            uniformId: item.uniformId,
            uniformName: item.uniformName,
            size: item.size,
            quantity: item.quantity,
            price: uniform?.price || 0,
          }
        })

        // Get employee ID (handle both string and object)
        const employeeId = typeof currentEmployee.id === 'string' 
          ? currentEmployee.id 
          : currentEmployee._id?.toString() || currentEmployee.id

        // Create order in database
        const savedOrder = await createOrder({
          employeeId: employeeId,
          items: orderItems,
          deliveryAddress: currentEmployee.address || 'Address not available',
          estimatedDeliveryTime: getEstimatedDeliveryTime(),
          dispatchLocation: currentEmployee.dispatchPreference || 'standard',
        })

        console.log('Order saved successfully:', savedOrder)
        setOrderSaved(true)

        // Clear the pending order from sessionStorage after successful save
        sessionStorage.removeItem('pendingOrder')
        console.log('Order confirmation: Cleared pending order from sessionStorage')
      } catch (error) {
        console.error('Error saving order to database:', error)
        alert('Error saving order. Please try again or contact support.')
      } finally {
        setSavingOrder(false)
      }
    }

    saveOrder()
  }, [orderData, currentEmployee, companyProducts, orderSaved, savingOrder])

  if (loading) {
    return (
      <DashboardLayout actorType="consumer">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 mb-4">Loading order details...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!orderData) {
    return (
      <DashboardLayout actorType="consumer">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-gray-600 mb-4">No order data found. Redirecting...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!currentEmployee) {
    return (
      <DashboardLayout actorType="consumer">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-red-600 mb-4">Employee data not found. Please log in again.</p>
            <Link
              href="/login/consumer"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 inline-block"
            >
              Go to Login
            </Link>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const getEstimatedDeliveryTime = () => {
    // Calculate delivery time based on dispatch preference
    if (!currentEmployee?.dispatchPreference) {
      return '5-7 business days'
    }
    if (currentEmployee.dispatchPreference === 'direct') {
      return '3-5 business days'
    } else if (currentEmployee.dispatchPreference === 'central') {
      return '5-7 business days'
    } else {
      return '7-10 business days'
    }
  }

  const orderItems = orderData.items.map((item: any) => {
    // Only find products that are linked to the company
    const uniform = companyProducts.find(u => u.id === item.uniformId)
    return {
      ...item,
      uniform
    }
  }).filter((item: any) => item.uniform !== undefined) // Filter out any items that don't match company products

  return (
    <DashboardLayout actorType="consumer">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
              <CheckCircle className="h-10 w-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-semibold text-gray-900 mb-2">Order Confirmed!</h1>
            <p className="text-gray-600">Your order has been successfully placed</p>
          </div>

          {/* Awaiting Admin Approval Notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-yellow-600 mr-2 flex-shrink-0" />
              <p className="text-yellow-800 font-medium">
                Your order is awaiting admin approval. You will be notified once it's approved.
              </p>
            </div>
          </div>

          {/* Order Items */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Package className="h-5 w-5 mr-2 text-blue-600" />
              Order Items
            </h2>
            <div className="space-y-3">
              {orderItems.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div>
                    <p className="font-medium text-gray-900">{item.uniformName}</p>
                    <p className="text-sm text-gray-600">Size: {item.size} × Quantity: {item.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Information */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center mb-3">
                <MapPin className="h-5 w-5 text-blue-600 mr-2" />
                <h3 className="font-semibold text-blue-900">Delivery Address</h3>
              </div>
              <p className="text-blue-800 leading-relaxed">{currentEmployee?.address || 'Address not available'}</p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-6">
              <div className="flex items-center mb-3">
                <Clock className="h-5 w-5 text-orange-600 mr-2" />
                <h3 className="font-semibold text-orange-900">Estimated Delivery Time</h3>
              </div>
              <p className="text-2xl font-bold text-orange-800 mb-2">{getEstimatedDeliveryTime()}</p>
              <p className="text-sm text-orange-700 mb-2">
                <span className="font-semibold">5-7 business days post admin's approval</span>
              </p>
              <p className="text-sm text-orange-700">Dispatch Preference: <span className="font-semibold capitalize">{currentEmployee?.dispatchPreference || 'standard'}</span></p>
            </div>
          </div>

          {/* Additional Info */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">What's Next?</h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>You will receive an email confirmation shortly</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>Your order is awaiting admin approval. Once approved, it will be processed and shipped</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <span>You can track your order status from the "My Orders" page</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Link
              href="/dashboard/consumer/orders"
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center shadow-md"
            >
              View My Orders
            </Link>
            <Link
              href="/dashboard/consumer/catalog"
              className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors text-center"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}





