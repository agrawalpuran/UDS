'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { ShoppingCart, MapPin, Package, ArrowRight, CheckCircle, Clock } from 'lucide-react'
import { getProductsByCompany, getEmployeeByEmail, getCompanyById } from '@/lib/data-mongodb'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function OrderReviewPage() {
  const router = useRouter()
  const [orderData, setOrderData] = useState<any>(null)
  const [currentEmployee, setCurrentEmployee] = useState<any>(null)
  const [companyProducts, setCompanyProducts] = useState<any[]>([])
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
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
    // Check for pending order from sessionStorage
    const checkPendingOrder = () => {
      try {
        const pendingOrder = sessionStorage.getItem('pendingOrder')
        if (pendingOrder) {
          const parsed = JSON.parse(pendingOrder)
          setOrderData(parsed)
        } else {
          // If no pending order, redirect to catalog
          router.push('/dashboard/consumer/catalog')
        }
      } catch (error) {
        console.error('Error reading pending order:', error)
        router.push('/dashboard/consumer/catalog')
      }
    }
    
    checkPendingOrder()
  }, [router])

  const handlePlaceOrder = () => {
    if (!orderData || !currentEmployee) return
    
    // Calculate total
    const total = orderData.items.reduce((sum: number, item: any) => {
      const uniform = companyProducts.find(u => u.id === item.uniformId)
      return sum + (uniform?.price || 0) * item.quantity
    }, 0)
    
    // Add total to order data
    const finalOrderData = {
      ...orderData,
      total: total.toFixed(2)
    }
    
    // Update sessionStorage with final order data
    sessionStorage.setItem('pendingOrder', JSON.stringify(finalOrderData))
    
    // Navigate to confirmation page
    window.location.href = '/dashboard/consumer/orders/confirm'
  }

  const handleCancel = () => {
    sessionStorage.removeItem('pendingOrder')
    router.push('/dashboard/consumer/catalog')
  }

  if (loading) {
    return (
      <DashboardLayout actorType="consumer">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 mb-4">Loading order review...</p>
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

  // Calculate order total
  const orderTotal = orderData.items.reduce((sum: number, item: any) => {
    const uniform = companyProducts.find(u => u.id === item.uniformId)
    return sum + (uniform?.price || 0) * item.quantity
  }, 0)

  // Get order items with product details
  const orderItems = orderData.items.map((item: any) => {
    const uniform = companyProducts.find(u => u.id === item.uniformId)
    return {
      ...item,
      uniform,
      itemTotal: (uniform?.price || 0) * item.quantity
    }
  }).filter((item: any) => item.uniform !== undefined)

  // Calculate estimated delivery date
  const getEstimatedDeliveryDate = () => {
    if (!currentEmployee?.dispatchPreference) {
      return null
    }
    
    const today = new Date()
    let daysToAdd = 0
    
    if (currentEmployee.dispatchPreference === 'direct') {
      daysToAdd = 5 // 3-5 business days, use max
    } else if (currentEmployee.dispatchPreference === 'central') {
      daysToAdd = 7 // 5-7 business days, use max
    } else {
      daysToAdd = 10 // 7-10 business days, use max
    }
    
    // Add processing time (1-2 business days)
    daysToAdd += 2
    
    // Calculate delivery date (skip weekends)
    let deliveryDate = new Date(today)
    let businessDaysAdded = 0
    
    while (businessDaysAdded < daysToAdd) {
      deliveryDate.setDate(deliveryDate.getDate() + 1)
      // Skip weekends (Saturday = 6, Sunday = 0)
      if (deliveryDate.getDay() !== 0 && deliveryDate.getDay() !== 6) {
        businessDaysAdded++
      }
    }
    
    return deliveryDate
  }

  const estimatedDeliveryDate = getEstimatedDeliveryDate()
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

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

  return (
    <DashboardLayout actorType="consumer">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 mb-6">
          <div className="mb-8">
            <h1 className="text-3xl font-semibold text-gray-900 mb-2 flex items-center">
              <ShoppingCart className="h-8 w-8 mr-3 text-blue-600" />
              Review Your Order
            </h1>
            <p className="text-gray-600">Please review your order details before confirming</p>
          </div>

          {/* Order Items */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Package className="h-5 w-5 mr-2 text-blue-600" />
              Order Items
            </h2>
            <div className="space-y-3">
              {orderItems.map((item: any, idx: number) => (
                <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{item.uniformName}</p>
                      <p className="text-sm text-gray-600">Size: {item.size} × Quantity: {item.quantity}</p>
                      {item.uniform && (
                        <p className="text-sm text-gray-500 mt-1">Category: <span className="capitalize">{item.uniform.category}</span></p>
                      )}
                      {company?.showPrices && item.uniform && (
                        <p className="text-sm text-gray-500 mt-1">Price: ₹{item.uniform.price.toFixed(2)} each</p>
                      )}
                    </div>
                    {company?.showPrices && (
                      <div className="text-right">
                        <p className="font-semibold text-gray-900">₹{item.itemTotal.toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Estimated Delivery Information */}
          {estimatedDeliveryDate && (
            <div className="mb-8 p-6 bg-orange-50 border border-orange-200 rounded-lg">
              <div className="flex items-center mb-3">
                <Clock className="h-5 w-5 text-orange-600 mr-2" />
                <h3 className="font-semibold text-orange-900">Estimated Delivery</h3>
              </div>
              <p className="text-2xl font-bold text-orange-800 mb-2">{formatDate(estimatedDeliveryDate)}</p>
              <p className="text-sm text-orange-700">
                Estimated delivery time: {getEstimatedDeliveryTime()} (plus 1-2 business days for processing)
              </p>
              {currentEmployee?.dispatchPreference && (
                <p className="text-xs text-orange-600 mt-2">
                  Based on your dispatch preference: <span className="font-semibold capitalize">{currentEmployee.dispatchPreference}</span>
                </p>
              )}
            </div>
          )}

          {/* Order Summary - Only show if prices are enabled */}
          {company?.showPrices && (
            <div className="mb-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">Subtotal:</span>
                <span className="font-semibold text-gray-900">₹{orderTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-700">Shipping:</span>
                <span className="font-semibold text-gray-900">Free</span>
              </div>
              <div className="border-t border-blue-300 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total:</span>
                  <span className="text-2xl font-bold text-blue-900">₹{orderTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Delivery Information */}
          <div className="mb-8 p-6 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center mb-3">
              <MapPin className="h-5 w-5 text-gray-600 mr-2" />
              <h3 className="font-semibold text-gray-900">Delivery Address</h3>
            </div>
            <p className="text-gray-700 leading-relaxed">{currentEmployee?.address || 'Address not available'}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={handleCancel}
              className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handlePlaceOrder}
              className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 shadow-md"
            >
              <CheckCircle className="h-5 w-5" />
              <span>Confirm & Place Order</span>
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

