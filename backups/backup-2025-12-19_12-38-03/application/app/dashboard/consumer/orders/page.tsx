'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Package, CheckCircle, Clock, Truck, Star, MessageSquare } from 'lucide-react'
import { getEmployeeByEmail, getOrdersByEmployee, getCompanyById, getVendorByEmail, createProductFeedback, getProductFeedback } from '@/lib/data-mongodb'
import Link from 'next/link'
import { maskAddress } from '@/lib/utils/data-masking'

export default function ConsumerOrdersPage() {
  const [currentEmployee, setCurrentEmployee] = useState<any>(null)
  const [myOrders, setMyOrders] = useState<any[]>([])
  const [company, setCompany] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [feedbackData, setFeedbackData] = useState<Record<string, Record<string, { rating: number; comment: string }>>>({})
  const [submittingFeedback, setSubmittingFeedback] = useState<Record<string, boolean>>({})
  const [existingFeedback, setExistingFeedback] = useState<Record<string, Record<string, any>>>({})
  
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
          
          // ROLE DETECTION: Check if email belongs to vendor
          const vendor = await getVendorByEmail(userEmail)
          if (vendor) {
            console.error('Consumer Orders - Email belongs to vendor, redirecting...')
            window.location.href = '/dashboard/vendor'
            return
          }
          
          const employee = await getEmployeeByEmail(userEmail)
          if (employee) {
            setCurrentEmployee(employee)
            // Get company ID
            const companyId = typeof employee.companyId === 'object' && employee.companyId?.id 
              ? employee.companyId.id 
              : employee.companyId
            
            // Get orders, company settings, and existing feedback in parallel
            const [employeeOrders, companyData] = await Promise.all([
              getOrdersByEmployee(employee.employeeId || employee.id),
              companyId ? getCompanyById(companyId) : Promise.resolve(null)
            ])
            setMyOrders(employeeOrders)
            setCompany(companyData)
            
            // Load existing feedback for delivered orders
            const deliveredOrders = employeeOrders.filter((o: any) => o.status === 'Delivered')
            if (deliveredOrders.length > 0) {
              try {
                const allFeedback = await getProductFeedback()
                const feedbackMap: Record<string, Record<string, any>> = {}
                allFeedback.forEach((fb: any) => {
                  if (!feedbackMap[fb.orderId]) {
                    feedbackMap[fb.orderId] = {}
                  }
                  feedbackMap[fb.orderId][fb.productId] = fb
                })
                setExistingFeedback(feedbackMap)
              } catch (error) {
                console.error('Error loading feedback:', error)
              }
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Delivered':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'Dispatched':
        return <Truck className="h-5 w-5 text-purple-600" />
      case 'Awaiting fulfilment':
        return <Package className="h-5 w-5" style={{ color: company?.primaryColor || '#f76b1c' }} />
      case 'Awaiting approval':
        return <Clock className="h-5 w-5 text-yellow-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Delivered':
        return { className: 'bg-green-100 text-green-700' }
      case 'Dispatched':
        return { className: 'bg-purple-100 text-purple-700' }
      case 'Awaiting fulfilment':
        return company?.primaryColor 
          ? { 
              style: { 
                backgroundColor: `${company.primaryColor}20`, 
                color: company.primaryColor 
              },
              className: ''
            }
          : { className: 'bg-orange-100 text-[#f76b1c]' }
      case 'Awaiting approval':
        return { className: 'bg-yellow-100 text-yellow-700' }
      default:
        return { className: 'bg-gray-100 text-gray-700' }
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

  const handleFeedbackChange = (orderId: string, productId: string, field: 'rating' | 'comment', value: number | string) => {
    setFeedbackData(prev => ({
      ...prev,
      [orderId]: {
        ...prev[orderId],
        [productId]: {
          ...prev[orderId]?.[productId],
          [field]: value,
        }
      }
    }))
  }

  const handleSubmitFeedback = async (orderId: string, productId: string, item: any) => {
    if (!currentEmployee) return
    
    const feedback = feedbackData[orderId]?.[productId]
    if (!feedback || !feedback.rating) {
      alert('Please provide a rating (1-5 stars)')
      return
    }
    
    setSubmittingFeedback(prev => ({ ...prev, [`${orderId}-${productId}`]: true }))
    
    try {
      const companyId = typeof currentEmployee.companyId === 'object' && currentEmployee.companyId?.id 
        ? currentEmployee.companyId.id 
        : currentEmployee.companyId
      
      const savedFeedback = await createProductFeedback({
        orderId,
        productId: productId || item.productId,
        employeeId: currentEmployee.employeeId || currentEmployee.id,
        companyId: companyId || '',
        vendorId: item.vendorId,
        rating: feedback.rating,
        comment: feedback.comment || undefined,
      })
      
      // Get the actual order ID from saved feedback (might be different for split orders)
      const actualOrderId = savedFeedback?.orderId || orderId
      const actualProductId = productId || item.productId
      
      console.log('[handleSubmitFeedback] Feedback submitted:', {
        orderId,
        actualOrderId,
        productId: actualProductId,
        savedFeedback: savedFeedback?.orderId
      })
      
      // Immediately add the submitted feedback to existingFeedback so it shows up right away
      setExistingFeedback(prev => {
        const newMap = { ...prev }
        // Store in both order IDs to handle parent/child order scenarios
        if (!newMap[orderId]) {
          newMap[orderId] = {}
        }
        if (!newMap[actualOrderId]) {
          newMap[actualOrderId] = {}
        }
        const feedbackEntry = {
          rating: feedback.rating,
          comment: feedback.comment || '',
          ...savedFeedback
        }
        newMap[orderId][actualProductId] = feedbackEntry
        newMap[actualOrderId][actualProductId] = feedbackEntry
        
        console.log('[handleSubmitFeedback] Updated existingFeedback:', {
          orderId,
          actualOrderId,
          productId: actualProductId,
          hasEntry: !!newMap[orderId][actualProductId]
        })
        
        return newMap
      })
      
      // Clear the feedback form data for this product to prevent editing
      setFeedbackData(prev => {
        const newMap = { ...prev }
        if (newMap[orderId]) {
          const orderData = { ...newMap[orderId] }
          delete orderData[actualProductId]
          if (Object.keys(orderData).length === 0) {
            delete newMap[orderId]
          } else {
            newMap[orderId] = orderData
          }
        }
        // Also clear for actualOrderId if different
        if (actualOrderId !== orderId && newMap[actualOrderId]) {
          const orderData = { ...newMap[actualOrderId] }
          delete orderData[actualProductId]
          if (Object.keys(orderData).length === 0) {
            delete newMap[actualOrderId]
          } else {
            newMap[actualOrderId] = orderData
          }
        }
        return newMap
      })
      
      // Reload feedback to get the complete saved feedback from server (with timestamps, etc.)
      const allFeedback = await getProductFeedback()
      const feedbackMap: Record<string, Record<string, any>> = {}
      allFeedback.forEach((fb: any) => {
        if (!feedbackMap[fb.orderId]) {
          feedbackMap[fb.orderId] = {}
        }
        feedbackMap[fb.orderId][fb.productId] = fb
      })
      setExistingFeedback(feedbackMap)
      
      alert('Feedback submitted successfully!')
    } catch (error: any) {
      console.error('Error submitting feedback:', error)
      alert(`Error submitting feedback: ${error.message || 'Unknown error'}`)
    } finally {
      setSubmittingFeedback(prev => {
        const newState = { ...prev }
        delete newState[`${orderId}-${productId}`]
        return newState
      })
    }
  }

  return (
    <DashboardLayout actorType="consumer">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Orders</h1>
          <Link
            href="/dashboard/consumer/catalog"
            className="bg-[#f76b1c] text-white px-4 py-2 rounded-lg font-medium hover:bg-[#dc5514] transition-colors shadow-md"
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
              style={{ backgroundColor: company?.primaryColor || '#f76b1c' }}
              className="inline-block text-white px-6 py-3 rounded-lg font-medium hover:opacity-90 transition-opacity shadow-md"
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
                        <h3 className="text-lg font-bold text-gray-900">
                          Order #{order.id}
                          {order.isSplitOrder && (
                            <span className="ml-2 text-xs font-normal text-blue-600 bg-blue-50 px-2 py-1 rounded">
                              Split Order ({order.vendorCount} vendor{order.vendorCount > 1 ? 's' : ''})
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Placed on {formatDate(order.orderDate)}
                          {order.vendors && order.vendors.length > 0 && (
                            <span className="ml-2 text-xs text-gray-500">
                              • Vendors: {order.vendors.join(', ')}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span 
                      className={`px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.status || 'Awaiting approval').className || ''}`}
                      style={getStatusColor(order.status || 'Awaiting approval').style}
                    >
                      {order.status || 'Awaiting approval'}
                    </span>
                  </div>
                  
                  {/* Show split order details if applicable */}
                  {order.isSplitOrder && order.splitOrders && order.splitOrders.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                      <p className="text-sm font-semibold text-blue-900 mb-2">Order Split by Vendor:</p>
                      <div className="space-y-1">
                        {order.splitOrders.map((split: any, idx: number) => (
                          <div key={idx} className="text-xs text-blue-800">
                            <span className="font-medium">{split.vendorName}:</span>
                            <span className="ml-2">
                              {split.itemCount} item(s)
                              {company?.showPrices && ` - ₹${split.total.toFixed(2)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="border-t pt-4 mb-4">
                    <h4 className="font-semibold text-gray-900 mb-3">Order Items:</h4>
                    <div className="space-y-2">
                      {order.items && Array.isArray(order.items) && order.items.length > 0 ? (
                        order.items.map((item: any, idx: number) => {
                          const productId = item.productId || item.uniformId
                          // Check for existing feedback - try order.id first, then check split orders if available
                          let existing = existingFeedback[order.id]?.[productId]
                          // If not found and this is a split order, check child order IDs
                          if (!existing && order.splitOrders && Array.isArray(order.splitOrders)) {
                            for (const splitOrder of order.splitOrders) {
                              if (existingFeedback[splitOrder.id]?.[productId]) {
                                existing = existingFeedback[splitOrder.id]?.[productId]
                                break
                              }
                            }
                          }
                          
                          // Debug logging (remove in production if needed)
                          if (existing) {
                            console.log('[Feedback UI] Found existing feedback:', {
                              orderId: order.id,
                              productId,
                              hasComment: !!existing.comment,
                              comment: existing.comment
                            })
                          }
                          
                          const isSubmitting = submittingFeedback[`${order.id}-${productId}`]
                          // If feedback exists, don't allow editing - use the feedback from existing
                          // Otherwise, use the current feedback data from state
                          const currentFeedback = existing ? { rating: existing.rating || 0, comment: existing.comment || '' } : (feedbackData[order.id]?.[productId] || { rating: 0, comment: '' })
                          
                          return (
                            <div key={idx} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex justify-between items-center mb-2">
                                <div>
                                  <p className="font-medium text-gray-900">{item.uniformName || 'Unknown Item'}</p>
                                  <p className="text-sm text-gray-600">
                                    Size: {item.size || 'N/A'} • Quantity: {item.quantity || 0}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Feedback Section - Only for Delivered orders */}
                              {order.status === 'Delivered' && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  {existing ? (
                                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span className="text-sm font-semibold text-green-900">Feedback Submitted</span>
                                      </div>
                                      <div className="flex items-center space-x-1 mb-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <Star
                                            key={star}
                                            className={`h-4 w-4 ${
                                              star <= existing.rating
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-gray-300'
                                            }`}
                                          />
                                        ))}
                                        <span className="text-sm text-gray-600 ml-2">({existing.rating}/5)</span>
                                      </div>
                                      {existing.comment && (
                                        <div className="mt-2">
                                          <p className="text-xs text-gray-500 mb-1">Your comment:</p>
                                          <textarea
                                            value={existing.comment}
                                            disabled
                                            readOnly
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-700 cursor-not-allowed resize-none"
                                            rows={3}
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ) : isSubmitting ? (
                                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <Clock className="h-4 w-4 text-gray-500 animate-spin" />
                                        <span className="text-sm font-semibold text-gray-700">Submitting feedback...</span>
                                      </div>
                                      <div className="flex items-center space-x-1 mb-2">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <Star
                                            key={star}
                                            className={`h-4 w-4 ${
                                              star <= currentFeedback.rating
                                                ? 'fill-yellow-400 text-yellow-400'
                                                : 'text-gray-300'
                                            }`}
                                          />
                                        ))}
                                        <span className="text-sm text-gray-600 ml-2">({currentFeedback.rating}/5)</span>
                                      </div>
                                      {currentFeedback.comment && (
                                        <div className="mt-2">
                                          <p className="text-xs text-gray-500 mb-1">Your comment:</p>
                                          <textarea
                                            value={currentFeedback.comment}
                                            disabled
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed resize-none"
                                            rows={3}
                                            readOnly
                                          />
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Rate this product:
                                      </label>
                                      <div className="flex items-center space-x-1 mb-3">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <button
                                            key={star}
                                            type="button"
                                            onClick={() => !existing && handleFeedbackChange(order.id, productId, 'rating', star)}
                                            disabled={!!existing}
                                            className={`focus:outline-none ${existing ? 'cursor-not-allowed' : ''}`}
                                          >
                                            <Star
                                              className={`h-6 w-6 transition-colors ${
                                                star <= currentFeedback.rating
                                                  ? 'fill-yellow-400 text-yellow-400'
                                                  : 'text-gray-300 hover:text-yellow-300'
                                              }`}
                                            />
                                          </button>
                                        ))}
                                      </div>
                                      <div className="mb-3">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                          <MessageSquare className="h-4 w-4 inline mr-1" />
                                          Comment (optional):
                                        </label>
                                        <textarea
                                          value={currentFeedback.comment || ''}
                                          onChange={(e) => !existing && handleFeedbackChange(order.id, productId, 'comment', e.target.value)}
                                          disabled={!!existing}
                                          readOnly={!!existing}
                                          className={`w-full px-3 py-2 border border-gray-300 rounded-lg outline-none ${
                                            existing 
                                              ? 'bg-gray-100 text-gray-700 cursor-not-allowed resize-none' 
                                              : 'focus:ring-2 focus:ring-[#f76b1c] focus:border-[#f76b1c]'
                                          }`}
                                          rows={3}
                                          placeholder="Share your experience with this product..."
                                          maxLength={2000}
                                        />
                                      </div>
                                      <button
                                        onClick={() => handleSubmitFeedback(order.id, productId, item)}
                                        disabled={isSubmitting || !currentFeedback.rating || !!existing}
                                        className="bg-[#f76b1c] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#dc5514] transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                                      >
                                        {isSubmitting ? 'Submitting...' : existing ? 'Feedback Already Submitted' : 'Submit Feedback'}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })
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
                        <p className="font-semibold text-gray-900">{maskAddress(order.deliveryAddress)}</p>
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




