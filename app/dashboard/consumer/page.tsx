'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Package, ShoppingCart, CheckCircle, Clock, Plus, Minus, ArrowRight } from 'lucide-react'
import { getProductsByCompany, getEmployeeByEmail, getOrdersByEmployee, getConsumedEligibility, Uniform } from '@/lib/data-mongodb'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

// Helper function to get Indigo Airlines-style uniform images
// Using local images stored in public/images/uniforms/
function getIndigoUniformImage(category: string, gender: string = 'male'): string {
  // Normalize category name (handle both 'pant' and 'trouser')
  const normalizedCategory = category.toLowerCase() === 'trouser' ? 'pant' : category.toLowerCase()
  const normalizedGender = gender.toLowerCase()
  
  // Special case: female shirt uses female-shirt.png
  if (normalizedCategory === 'shirt' && normalizedGender === 'female') {
    return '/images/uniforms/female-shirt.png'
  }
  
  // Special case: male jacket uses male-blazer.webp
  if (normalizedCategory === 'jacket' && normalizedGender === 'male') {
    return '/images/uniforms/male-blazer.webp'
  }
  
  // Special case: male pant uses pant-male.png
  if (normalizedCategory === 'pant' && normalizedGender === 'male') {
    return '/images/uniforms/pant-male.png'
  }
  
  // Special case: female pant uses pant-female
  if (normalizedCategory === 'pant' && normalizedGender === 'female') {
    return '/images/uniforms/pant-female.jpg'
  }
  
  // Special case: female jacket uses jacket-female
  if (normalizedCategory === 'jacket' && normalizedGender === 'female') {
    return '/images/uniforms/jacket-female.jpg'
  }
  
  // Special case: male shoes use shoe-male.jpg
  if (normalizedCategory === 'shoe' && normalizedGender === 'male') {
    return '/images/uniforms/shoe-male.jpg'
  }
  
  // Special case: female shoes use shoe-female.jpg
  if (normalizedCategory === 'shoe' && normalizedGender === 'female') {
    return '/images/uniforms/shoe-female.jpg'
  }
  
  // Special case: shoes use shoe-image (for unisex)
  if (normalizedCategory === 'shoe') {
    return '/images/uniforms/shoe-image.jpg'
  }
  
  // Local image paths - images should be stored in public/images/uniforms/
  // Naming convention: {category}-{gender}.jpg (e.g., shirt-male.jpg, pant-female.jpg)
  const imagePath = `/images/uniforms/${normalizedCategory}-${normalizedGender}.jpg`
  
  return imagePath
}

export default function ConsumerDashboard() {
  const router = useRouter()
  
  // State for employee and products
  const [currentEmployee, setCurrentEmployee] = useState<any>(null)
  const [companyProducts, setCompanyProducts] = useState<Uniform[]>([])
  const [myOrders, setMyOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [quickOrderCart, setQuickOrderCart] = useState<Record<string, { size: string; quantity: number }>>({})
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({})
  const [showTooltip, setShowTooltip] = useState<string | null>(null)
  const [consumedEligibility, setConsumedEligibility] = useState<{
    shirt: number
    pant: number
    shoe: number
    jacket: number
  }>({ shirt: 0, pant: 0, shoe: 0, jacket: 0 })
  
  // Get current employee from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadData = async () => {
        try {
          setLoading(true)
          const userEmail = localStorage.getItem('userEmail')
          console.log('Consumer Dashboard - User Email:', userEmail)
          
          if (!userEmail) {
            console.error('Consumer Dashboard - No userEmail found')
            setError('No email found. Please log in again.')
            setLoading(false)
            return
          }
          
          try {
            const employee = await getEmployeeByEmail(userEmail)
            console.log('Consumer Dashboard - Employee:', employee)
            
            if (!employee) {
              console.error('Consumer Dashboard - No employee found for email:', userEmail)
              setError(`No employee found for email: ${userEmail}. Please check your login credentials.`)
              setLoading(false)
              return
            }
            
            setCurrentEmployee(employee)
            
            // Ensure companyId is a string (handle populated objects, ObjectIds, and strings)
            let companyId: string | undefined
            if (employee.companyId) {
              if (typeof employee.companyId === 'object') {
                // Populated object with id field
                companyId = employee.companyId.id || employee.companyId._id?.toString()
              } else {
                // Already a string (ObjectId string or company id string)
                companyId = employee.companyId.toString()
              }
            }
            
            console.log('Consumer Dashboard - Employee companyId raw:', employee.companyId)
            console.log('Consumer Dashboard - Company ID extracted:', companyId, 'Type:', typeof companyId)
            console.log('Consumer Dashboard - Company Name:', employee.companyName)
            
            if (!companyId) {
              console.error('Consumer Dashboard - No companyId found for employee:', employee.id)
              setError('Employee is not associated with a company. Please contact your administrator.')
              setLoading(false)
              return
            }
            
            // Get employee ID for consumed eligibility
            const employeeId = typeof employee.id === 'string' 
              ? employee.id 
              : employee._id?.toString() || employee.id
            
            // Load products, orders, and consumed eligibility in parallel
            const [products, orders, consumed] = await Promise.all([
              getProductsByCompany(companyId),
              getOrdersByEmployee(employeeId),
              getConsumedEligibility(employeeId)
            ])
            
            console.log('Consumer Dashboard - Products loaded:', products.length, products)
            console.log('Consumer Dashboard - Orders loaded:', orders.length, orders)
            console.log('Consumer Dashboard - Consumed eligibility:', consumed)
            
            setCompanyProducts(products)
            setMyOrders(orders)
            setConsumedEligibility(consumed)
            
            if (products.length === 0) {
              console.warn('No products found for company:', companyId)
            }
          } catch (apiError: any) {
            console.error('Consumer Dashboard - API Error:', apiError)
            setError(apiError?.message || 'Failed to load employee data. Please try again.')
          }
        } catch (error: any) {
          console.error('Consumer Dashboard - Error loading data:', error)
          setError(error?.message || 'Failed to load data. Please try again.')
        } finally {
          setLoading(false)
        }
      }
      
      loadData()
    }
  }, [])
  
  const pendingOrders = myOrders.filter(o => o.status === 'Awaiting approval' || o.status === 'Awaiting fulfilment').length
  const totalOrders = myOrders.length
  
  // Auto-select sizes based on profile
  useEffect(() => {
    if (!currentEmployee || companyProducts.length === 0) return
    
    const autoSizes: Record<string, string> = {}
    companyProducts.forEach(uniform => {
      if (uniform.category === 'shirt') {
        autoSizes[uniform.id] = currentEmployee.shirtSize || 'M'
      } else if (uniform.category === 'pant') {
        autoSizes[uniform.id] = currentEmployee.pantSize || '32'
      } else if (uniform.category === 'shoe') {
        autoSizes[uniform.id] = currentEmployee.shoeSize || '9'
      } else {
        autoSizes[uniform.id] = currentEmployee.shirtSize || 'M'
      }
    })
    setSelectedSizes(autoSizes)
  }, [companyProducts, currentEmployee])
  
  // Show top 6 products for quick order
  const quickOrderProducts = companyProducts.slice(0, 6)
  
  const getEligibilityForCategory = (category: string): number => {
    if (!currentEmployee) return 0
    const totalEligibility = (() => {
      switch (category) {
        case 'shirt': return currentEmployee.eligibility?.shirt || 0
        case 'pant': return currentEmployee.eligibility?.pant || 0
        case 'shoe': return currentEmployee.eligibility?.shoe || 0
        case 'jacket': return currentEmployee.eligibility?.jacket || 0
        default: return 0
      }
    })()
    
    // Subtract consumed eligibility from previous orders
    const consumed = (() => {
      switch (category) {
        case 'shirt': return consumedEligibility.shirt
        case 'pant': return consumedEligibility.pant
        case 'shoe': return consumedEligibility.shoe
        case 'jacket': return consumedEligibility.jacket
        default: return 0
      }
    })()
    
    // Return remaining eligibility (total - consumed)
    return Math.max(0, totalEligibility - consumed)
  }

  const getTotalQuantityForCategory = (category: string): number => {
    return Object.entries(quickOrderCart).reduce((total, [uniformId, cartItem]) => {
      const uniform = companyProducts.find(u => u.id === uniformId)
      if (uniform?.category === category) {
        return total + cartItem.quantity
      }
      return total
    }, 0)
  }
  
  const updateQuickOrderQuantity = (uniformId: string, delta: number) => {
    const uniform = companyProducts.find(u => u.id === uniformId)
    if (!uniform) return
    
    const currentQuantity = quickOrderCart[uniformId]?.quantity || 0
    const newQuantity = currentQuantity + delta
    const selectedSize = selectedSizes[uniformId] || uniform.sizes[0]
    
    // Eligibility check
    const eligibility = getEligibilityForCategory(uniform.category)
    const totalForCategory = getTotalQuantityForCategory(uniform.category)
    const otherItemsQuantity = totalForCategory - currentQuantity
    const totalAfterChange = newQuantity + otherItemsQuantity
    
    // Prevent negative quantities
    if (newQuantity < 0) return
    
    // Strict check: total should never exceed eligibility
    if (totalAfterChange > eligibility) {
      const remaining = Math.max(0, eligibility - otherItemsQuantity)
      alert(`You can only order up to ${eligibility} ${uniform.category}(s) total. You have already selected ${otherItemsQuantity} other ${uniform.category}(s). Maximum allowed for this item: ${remaining}.`)
      return
    }
    
    if (newQuantity === 0) {
      const newCart = { ...quickOrderCart }
      delete newCart[uniformId]
      setQuickOrderCart(newCart)
    } else {
      setQuickOrderCart(prev => ({
        ...prev,
        [uniformId]: { size: selectedSize, quantity: newQuantity }
      }))
    }
  }
  
  const handleQuickOrderCheckout = () => {
    if (Object.keys(quickOrderCart).length === 0) {
      alert('Please add items to your cart first')
      return
    }
    
    // Validate eligibility before checkout
    const categoryTotals: Record<string, number> = {}
    Object.entries(quickOrderCart).forEach(([uniformId, item]) => {
      const uniform = companyProducts.find(u => u.id === uniformId)
      if (uniform) {
        categoryTotals[uniform.category] = (categoryTotals[uniform.category] || 0) + item.quantity
      }
    })
    
    // Check each category doesn't exceed eligibility
    for (const [category, total] of Object.entries(categoryTotals)) {
      const eligibility = getEligibilityForCategory(category)
      if (total > eligibility) {
        alert(`Error: Your cart contains ${total} ${category}(s), but you are only eligible for ${eligibility}. Please adjust your order.`)
        return
      }
    }
    
    // Store order data and navigate to catalog/checkout
    const orderData = {
      items: Object.entries(quickOrderCart).map(([uniformId, item]) => {
        const uniform = companyProducts.find(u => u.id === uniformId)
        return {
          uniformId,
          uniformName: uniform?.name || '',
          size: item.size,
          quantity: item.quantity
        }
      })
    }
    
    try {
      sessionStorage.setItem('pendingOrder', JSON.stringify(orderData))
      router.push('/dashboard/consumer/orders/review')
    } catch (error) {
      console.error('Error saving order data:', error)
      alert('Error processing checkout. Please try again.')
    }
  }
  
  const getCartTotalItems = () => {
    return Object.values(quickOrderCart).reduce((sum, item) => sum + item.quantity, 0)
  }

  if (loading) {
    return (
      <DashboardLayout actorType="consumer">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (error) {
    return (
      <DashboardLayout actorType="consumer">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              onClick={() => {
                setError(null)
                setLoading(true)
                const loadData = async () => {
                  try {
                    const userEmail = localStorage.getItem('userEmail')
                    if (userEmail) {
                      const employee = await getEmployeeByEmail(userEmail)
                      if (employee) {
                        setCurrentEmployee(employee)
                        const companyId = typeof employee.companyId === 'object' && employee.companyId?.id 
                          ? employee.companyId.id 
                          : employee.companyId
                        const products = await getProductsByCompany(companyId)
                        setCompanyProducts(products)
                        const orders = await getOrdersByEmployee(employee.id)
                        setMyOrders(orders)
                      }
                    }
                  } catch (err) {
                    setError('Failed to load data')
                  } finally {
                    setLoading(false)
                  }
                }
                loadData()
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Retry
            </button>
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
            <p className="text-gray-600 mb-4">No employee data found. Please log in again.</p>
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

  return (
    <DashboardLayout actorType="consumer">
      <div>
        <h1 className="text-3xl font-semibold text-gray-800 mb-8">
          Welcome Back{currentEmployee?.firstName ? `, ${currentEmployee.firstName}${currentEmployee.lastName ? ` ${currentEmployee.lastName}` : ''}` : ''}!
        </h1>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { name: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'blue', link: '/dashboard/consumer/orders' },
            { name: 'Pending Orders', value: pendingOrders, icon: Clock, color: 'orange', link: '/dashboard/consumer/orders' },
            { name: 'Available Items', value: companyProducts.length, icon: Package, color: 'green', link: '/dashboard/consumer/catalog' },
          ].map((stat) => {
            const Icon = stat.icon
            const getColorClasses = (color: string) => {
              const colors: Record<string, { bg: string; text: string }> = {
                blue: { bg: 'bg-blue-50', text: 'text-blue-600' },
                orange: { bg: 'bg-orange-50', text: 'text-orange-600' },
                green: { bg: 'bg-green-50', text: 'text-green-600' },
              }
              return colors[color] || colors.blue
            }
            const colorClasses = getColorClasses(stat.color)
            const isClickable = stat.value > 0
            
            // Get recent orders
            const getRecentOrders = () => {
              return myOrders
                .slice(0, 10)
                .map(order => ({
                  id: order.id,
                  status: order.status || 'Unknown',
                  total: order.items && Array.isArray(order.items) && order.items.length > 0
                    ? order.items.reduce((sum: number, item: any) => {
                        const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0
                        const quantity = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0
                        return sum + (price * quantity)
                      }, 0)
                    : (order.total || 0),
                  itemsCount: order.items?.length || 0,
                  date: order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'
                }))
            }
            
            // Get pending orders list
            const getPendingOrdersList = () => {
              return myOrders
                .filter(o => o.status === 'Awaiting approval' || o.status === 'Awaiting fulfilment')
                .slice(0, 10)
                .map(order => ({
                  id: order.id,
                  status: order.status || 'Unknown',
                  total: order.items && Array.isArray(order.items) && order.items.length > 0
                    ? order.items.reduce((sum: number, item: any) => {
                        const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0
                        const quantity = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0
                        return sum + (price * quantity)
                      }, 0)
                    : (order.total || 0),
                  itemsCount: order.items?.length || 0,
                  date: order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'
                }))
            }
            
            // Get available products
            const getAvailableProducts = () => {
              return companyProducts
                .slice(0, 10)
                .map(product => ({
                  name: product.name || 'Unknown',
                  category: product.category || 'N/A',
                  price: product.price || 0
                }))
            }
            
            const StatCard = (
              <div 
                className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${isClickable ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm mb-1">{stat.name}</p>
                    <p className="text-3xl font-semibold text-gray-900">{stat.value}</p>
                    {stat.name === 'Available Items' && companyProducts.length === 0 && currentEmployee && (
                      <button
                        onClick={async (e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          // Clear localStorage and refresh
                          localStorage.removeItem('productCompanies')
                          localStorage.removeItem('vendorCompanies')
                          localStorage.removeItem('productVendors')
                          const companyId = typeof currentEmployee.companyId === 'object' && currentEmployee.companyId?.id 
                            ? currentEmployee.companyId.id 
                            : currentEmployee.companyId
                          const products = await getProductsByCompany(companyId)
                          setCompanyProducts(products)
                          alert(`Cleared localStorage. Found ${products.length} products.`)
                        }}
                        className="mt-2 text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Reset & Refresh
                      </button>
                    )}
                  </div>
                  <div className={`${colorClasses.bg} p-3 rounded-lg`}>
                    <Icon className={`h-6 w-6 ${colorClasses.text}`} />
                  </div>
                </div>
              </div>
            )
            
            // Render tooltip
            const renderTooltip = () => {
              if (showTooltip !== stat.name) return null
              
              if (stat.name === 'Total Orders' && totalOrders > 0) {
                const orders = getRecentOrders()
                return (
                  <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none">
                    <div className="text-sm font-semibold mb-3 pb-2 border-b border-gray-700">
                      Recent Orders ({totalOrders} total)
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {orders.map((order: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="font-semibold text-white mb-1">Order #{order.id}</div>
                          <div className="text-gray-300">Status: {order.status}</div>
                          <div className="text-gray-300">Items: {order.itemsCount}</div>
                          <div className="text-gray-300">Amount: ₹{order.total.toFixed(2)}</div>
                          <div className="text-gray-400">Date: {order.date}</div>
                          {idx < orders.length - 1 && (
                            <div className="border-t border-gray-700 mt-2 pt-2"></div>
                          )}
                        </div>
                      ))}
                      {totalOrders > 10 && (
                        <div className="text-gray-400 text-xs mt-2 pt-2 border-t border-gray-700">
                          +{totalOrders - 10} more orders
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              
              if (stat.name === 'Pending Orders' && pendingOrders > 0) {
                const orders = getPendingOrdersList()
                return (
                  <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none">
                    <div className="text-sm font-semibold mb-3 pb-2 border-b border-gray-700">
                      Pending Orders ({pendingOrders} total)
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {orders.map((order: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="font-semibold text-white mb-1">Order #{order.id}</div>
                          <div className="text-gray-300">Status: {order.status}</div>
                          <div className="text-gray-300">Items: {order.itemsCount}</div>
                          <div className="text-gray-300">Amount: ₹{order.total.toFixed(2)}</div>
                          <div className="text-gray-400">Date: {order.date}</div>
                          {idx < orders.length - 1 && (
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
              
              if (stat.name === 'Available Items' && companyProducts.length > 0) {
                const products = getAvailableProducts()
                return (
                  <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none">
                    <div className="text-sm font-semibold mb-3 pb-2 border-b border-gray-700">
                      Available Products ({companyProducts.length} total)
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {products.map((product: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="font-semibold text-white mb-1">{product.name}</div>
                          <div className="text-gray-300">Category: {product.category}</div>
                          <div className="text-gray-300">Price: ₹{product.price.toFixed(2)}</div>
                          {idx < products.length - 1 && (
                            <div className="border-t border-gray-700 mt-2 pt-2"></div>
                          )}
                        </div>
                      ))}
                      {companyProducts.length > 10 && (
                        <div className="text-gray-400 text-xs mt-2 pt-2 border-t border-gray-700">
                          +{companyProducts.length - 10} more products
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
                  <Link href={stat.link} className="block">
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

        {/* Debug Info - Only show if no products */}
        {companyProducts.length === 0 && currentEmployee && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-yellow-900 mb-2">Debug Information</h3>
            <div className="text-sm text-yellow-800 space-y-1">
              <p>Company ID: <strong>{(() => {
                const cid = typeof currentEmployee.companyId === 'object' && currentEmployee.companyId?.id 
                  ? currentEmployee.companyId.id 
                  : currentEmployee.companyId
                return cid || 'Not found'
              })()}</strong></p>
              <p>Company Name: <strong>{currentEmployee.companyName}</strong></p>
              <p>Employee Email: <strong>{currentEmployee.email}</strong></p>
              <p className="mt-2">Check browser console (F12) for detailed debug logs.</p>
              <button
                onClick={async () => {
                  console.log('Manual Debug Check:')
                  console.log('localStorage productCompanies:', localStorage.getItem('productCompanies'))
                  console.log('localStorage vendorCompanies:', localStorage.getItem('vendorCompanies'))
                  console.log('Current Employee:', currentEmployee)
                  const companyId = typeof currentEmployee.companyId === 'object' && currentEmployee.companyId?.id 
                    ? currentEmployee.companyId.id 
                    : currentEmployee.companyId
                  const products = await getProductsByCompany(companyId)
                  console.log('Products after manual call:', products)
                  setCompanyProducts(products)
                }}
                className="mt-2 text-xs bg-yellow-200 text-yellow-900 px-3 py-1 rounded hover:bg-yellow-300"
              >
                Run Debug Check
              </button>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <Link href="/dashboard/consumer/catalog" className="bg-blue-600 text-white py-4 rounded-lg font-medium hover:bg-blue-700 transition-colors text-center shadow-md flex items-center justify-center space-x-2">
              <Package className="h-5 w-5" />
              <span>Browse Catalog</span>
            </Link>
            <div className="flex space-x-2">
              <Link href="/dashboard/consumer/orders" className="flex-1 bg-gray-100 text-gray-800 py-4 rounded-lg font-medium hover:bg-gray-200 transition-colors text-center flex items-center justify-center space-x-2">
                <ShoppingCart className="h-5 w-5" />
                <span>View My Orders</span>
              </Link>
              <Link href="/dashboard/consumer/catalog" className="flex-1 bg-green-600 text-white py-4 rounded-lg font-medium hover:bg-green-700 transition-colors text-center shadow-md flex items-center justify-center space-x-2">
                <Plus className="h-5 w-5" />
                <span>New Order</span>
              </Link>
            </div>
            {getCartTotalItems() > 0 && (
              <button
                onClick={handleQuickOrderCheckout}
                className="bg-orange-600 text-white py-4 rounded-lg font-medium hover:bg-orange-700 transition-colors shadow-md flex items-center justify-center space-x-2"
              >
                <ShoppingCart className="h-5 w-5" />
                <span>Checkout ({getCartTotalItems()})</span>
              </button>
            )}
          </div>
        </div>

        {/* Quick Order Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Order New Uniforms</h2>
              <p className="text-sm text-gray-600 mt-1">Quickly add items to your cart and checkout</p>
            </div>
            <Link 
              href="/dashboard/consumer/catalog" 
              className="text-blue-600 hover:text-blue-700 font-medium flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          
          {quickOrderProducts.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No products available for your company.</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {quickOrderProducts.map((uniform) => {
                const cartItem = quickOrderCart[uniform.id]
                const currentQuantity = cartItem?.quantity || 0
                const selectedSize = selectedSizes[uniform.id] || uniform.sizes[0]
                const eligibility = getEligibilityForCategory(uniform.category)
                const totalForCategory = getTotalQuantityForCategory(uniform.category)
                const otherItemsQuantity = totalForCategory - currentQuantity
                const maxAllowed = Math.max(0, eligibility - otherItemsQuantity)
                const canAddMore = currentQuantity < maxAllowed && totalForCategory < eligibility
                
                return (
                  <div key={uniform.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="relative h-32 bg-gradient-to-br from-indigo-50 via-blue-50 to-slate-100 rounded-lg mb-3 overflow-hidden">
                      <Image
                        src={getIndigoUniformImage(uniform.category, uniform.gender)}
                        alt={uniform.name}
                        fill
                        className="object-cover object-center"
                        unoptimized={true}
                        onError={(e) => {
                          // Fallback to a placeholder if image fails to load
                          const target = e.target as HTMLImageElement
                          target.src = '/images/uniforms/default.jpg'
                        }}
                      />
                      {/* Professional airline uniform overlay effect */}
                      <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/5 to-transparent pointer-events-none"></div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 text-sm">{uniform.name}</h3>
                    
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Size:</label>
                      <select
                        value={selectedSize}
                        onChange={(e) => {
                          setSelectedSizes(prev => ({ ...prev, [uniform.id]: e.target.value }))
                          if (cartItem) {
                            setQuickOrderCart(prev => ({
                              ...prev,
                              [uniform.id]: { ...prev[uniform.id], size: e.target.value }
                            }))
                          }
                        }}
                        className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      >
                        {uniform.sizes.map((size) => (
                          <option key={size} value={size}>{size}</option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuickOrderQuantity(uniform.id, -1)}
                          disabled={currentQuantity === 0}
                          className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="text-sm font-semibold text-gray-900 w-8 text-center">
                          {currentQuantity}
                        </span>
                        <button
                          onClick={() => updateQuickOrderQuantity(uniform.id, 1)}
                          disabled={!canAddMore}
                          className="p-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                    {!canAddMore && currentQuantity > 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        Maximum {maxAllowed} allowed for {uniform.category}
                      </p>
                    )}
                    {currentQuantity === 0 && eligibility > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        You can order up to {eligibility} {uniform.category}(s)
                      </p>
                    )}
                    {eligibility === 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        No eligibility remaining for {uniform.category}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          
          {getCartTotalItems() > 0 && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Items: <span className="font-semibold text-gray-900">{getCartTotalItems()}</span></p>
                  <p className="text-sm text-gray-600">
                    Total: <span className="font-semibold text-gray-900">
                      ₹{Object.entries(quickOrderCart).reduce((sum, [uniformId, item]) => {
                        const uniform = companyProducts.find(u => u.id === uniformId)
                        return sum + (uniform?.price || 0) * item.quantity
                      }, 0).toFixed(2)}
                    </span>
                  </p>
                </div>
                <button
                  onClick={handleQuickOrderCheckout}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center space-x-2 shadow-md"
                >
                  <ShoppingCart className="h-5 w-5" />
                  <span>Proceed to Checkout</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Orders</h2>
          {myOrders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-4">You haven't placed any orders yet.</p>
              <Link href="/dashboard/consumer/catalog" className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md">
                Browse Catalog
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {myOrders.map((order) => (
                <div key={order.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">Order #{order.id}</h3>
                      <p className="text-sm text-gray-600">{order.orderDate}</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      order.status === 'Delivered' ? 'bg-green-100 text-green-700' :
                      order.status === 'Dispatched' ? 'bg-purple-100 text-purple-700' :
                      order.status === 'Awaiting fulfilment' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'Awaiting approval' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {order.items.map((item: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-gray-600">{item.uniformName} (Size: {item.size}) x {item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 pt-3 border-t">
                    <span className="text-gray-600">Dispatch to: {order.dispatchLocation}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}




