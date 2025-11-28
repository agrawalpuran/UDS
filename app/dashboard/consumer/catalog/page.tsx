'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, ShoppingCart, Plus, Minus, AlertCircle, Package, RefreshCw } from 'lucide-react'
import { getProductsByCompany, getEmployeeByEmail, getConsumedEligibility, Uniform } from '@/lib/data-mongodb'
import { getCurrentCycleDates, getNextCycleStartDate, formatCycleDate, getDaysRemainingInCycle } from '@/lib/utils/eligibility-cycles'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

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

export default function ConsumerCatalogPage() {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState('')
  const [currentEmployee, setCurrentEmployee] = useState<any>(null)
  const [uniforms, setUniforms] = useState<Uniform[]>([])
  const [loading, setLoading] = useState(true)
  const [consumedEligibility, setConsumedEligibility] = useState<{
    shirt: number
    pant: number
    shoe: number
    jacket: number
  }>({ shirt: 0, pant: 0, shoe: 0, jacket: 0 })
  
  // Get current employee and load products - SINGLE useEffect to avoid race conditions
  useEffect(() => {
    if (typeof window === 'undefined') return
    
    const loadData = async () => {
      try {
        setLoading(true)
        const userEmail = localStorage.getItem('userEmail')
        console.log('Consumer Catalog - Loading... User Email:', userEmail)
        
        if (!userEmail) {
          console.error('Consumer Catalog - No userEmail in localStorage')
          setLoading(false)
          return
        }
        
        const employee = await getEmployeeByEmail(userEmail)
        console.log('Consumer Catalog - Employee found:', employee ? `${employee.firstName} ${employee.lastName}` : 'none')
        
        if (!employee) {
          console.error('Consumer Catalog - No employee found for email:', userEmail)
          setLoading(false)
          return
        }
        
        // Set employee first
        setCurrentEmployee(employee)
        
        // Ensure companyId is a string (handle populated objects)
        const companyId = typeof employee.companyId === 'object' && employee.companyId?.id 
          ? employee.companyId.id 
          : employee.companyId
        
        // Get employee ID for consumed eligibility
        const employeeId = typeof employee.id === 'string' 
          ? employee.id 
          : employee._id?.toString() || employee.id
        
        console.log('Consumer Catalog - Company ID:', companyId, 'Company Name:', employee.companyName)
        
        // Load products and consumed eligibility in parallel
        const [products, consumed] = await Promise.all([
          getProductsByCompany(companyId),
          getConsumedEligibility(employeeId)
        ])
        
        console.log('Consumer Catalog - Products loaded:', products.length, 'products')
        console.log('Consumer Catalog - Consumed eligibility:', consumed)
        if (products.length > 0) {
          console.log('Consumer Catalog - Product names:', products.map(p => p.name).join(', '))
        }
        
        // Always set uniforms, even if empty
        setUniforms(products)
        setConsumedEligibility(consumed)
        
        if (products.length === 0) {
          console.warn('Consumer Catalog - ⚠️ No products found for company:', employee.companyId)
          console.log('Checking localStorage...')
          const pc = localStorage.getItem('productCompanies')
          const vc = localStorage.getItem('vendorCompanies')
          const pv = localStorage.getItem('productVendors')
          console.log('localStorage productCompanies:', pc ? JSON.parse(pc).length + ' items' : 'null')
          console.log('localStorage vendorCompanies:', vc ? JSON.parse(vc).length + ' items' : 'null')
          console.log('localStorage productVendors:', pv ? JSON.parse(pv).length + ' items' : 'null')
        }
      } catch (error) {
        console.error('Consumer Catalog - Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }
    
    // Load immediately
    loadData()
    
    // Also reload when window gains focus (in case data was updated in another tab)
    const handleFocus = () => {
      console.log('Consumer Catalog - Window focused, reloading...')
      loadData()
    }
    window.addEventListener('focus', handleFocus)
    
    return () => {
      window.removeEventListener('focus', handleFocus)
    }
  }, [])
  
  // Refresh products when employee changes
  useEffect(() => {
    if (!currentEmployee) return
    
    const reloadProducts = async () => {
      const companyId = typeof currentEmployee.companyId === 'object' && currentEmployee.companyId?.id 
        ? currentEmployee.companyId.id 
        : currentEmployee.companyId
      console.log('Consumer Catalog - Employee changed, reloading products for:', companyId)
      const products = await getProductsByCompany(companyId)
      console.log('Consumer Catalog - Reloaded products:', products.length)
      setUniforms(products)
    }
    
    reloadProducts()
  }, [currentEmployee?.id, currentEmployee?.companyId])
  
  // Set default gender filter based on user's profile gender
  const defaultGenderFilter = currentEmployee?.gender === 'male' ? 'male' : currentEmployee?.gender === 'female' ? 'female' : 'all'
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female' | 'unisex'>(defaultGenderFilter)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [cart, setCart] = useState<Record<string, { size: string; quantity: number }>>({})
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({})
  const [hoveredItemType, setHoveredItemType] = useState<'shirt' | 'pant' | 'shoe' | 'jacket' | null>(null)

  // Auto-select sizes based on profile
  useEffect(() => {
    if (!currentEmployee || uniforms.length === 0) return
    
    const autoSizes: Record<string, string> = {}
    uniforms.forEach(uniform => {
      if (uniform.category === 'shirt') {
        autoSizes[uniform.id] = currentEmployee.shirtSize || 'M'
      } else if (uniform.category === 'pant') {
        autoSizes[uniform.id] = currentEmployee.pantSize || '32'
      } else if (uniform.category === 'shoe') {
        autoSizes[uniform.id] = currentEmployee.shoeSize || '9'
      } else {
        // For jacket, use shirt size as default
        autoSizes[uniform.id] = currentEmployee.shirtSize || 'M'
      }
    })
    setSelectedSizes(autoSizes)
  }, [uniforms, currentEmployee])

  const filteredUniforms = uniforms.filter(uniform => {
    const matchesSearch = uniform.name.toLowerCase().includes(searchTerm.toLowerCase())
    // Show products that match the selected gender OR are unisex
    const matchesGender = filterGender === 'all' || uniform.gender === filterGender || uniform.gender === 'unisex'
    const matchesCategory = filterCategory === 'all' || uniform.category === filterCategory
    return matchesSearch && matchesGender && matchesCategory
  })

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
    return Object.entries(cart).reduce((total, [uniformId, cartItem]) => {
      const uniform = uniforms.find(u => u.id === uniformId)
      if (uniform?.category === category) {
        return total + cartItem.quantity
      }
      return total
    }, 0)
  }

  const updateQuantity = (uniformId: string, size: string, delta: number) => {
    const uniform = uniforms.find(u => u.id === uniformId)
    if (!uniform) return

    const currentQuantity = cart[uniformId]?.quantity || 0
    const newQuantity = currentQuantity + delta
    const eligibility = getEligibilityForCategory(uniform.category)
    
    // Calculate total quantity for this category AFTER the change
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
      const newCart = { ...cart }
      delete newCart[uniformId]
      setCart(newCart)
    } else {
      setCart(prev => ({
        ...prev,
        [uniformId]: { size, quantity: newQuantity }
      }))
    }
  }

  const handleSizeChange = (uniformId: string, size: string) => {
    setSelectedSizes(prev => ({ ...prev, [uniformId]: size }))
    // If item is already in cart, update the size
    if (cart[uniformId]) {
      setCart(prev => ({
        ...prev,
        [uniformId]: { ...prev[uniformId], size }
      }))
    }
  }

  const handleCheckout = () => {
    if (Object.keys(cart).length === 0) {
      alert('Your cart is empty')
      return
    }
    
    // Validate eligibility before checkout
    const categoryTotals: Record<string, number> = {}
    Object.entries(cart).forEach(([uniformId, item]) => {
      const uniform = uniforms.find(u => u.id === uniformId)
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
    
    // Navigate to order confirmation
    const orderData = {
      items: Object.entries(cart).map(([uniformId, item]) => {
        const uniform = uniforms.find(u => u.id === uniformId)
        return {
          uniformId,
          uniformName: uniform?.name || '',
          size: item.size,
          quantity: item.quantity
        }
      })
    }
    // Store in sessionStorage for review page
    try {
      sessionStorage.setItem('pendingOrder', JSON.stringify(orderData))
      console.log('Checkout: Order data saved to sessionStorage', orderData)
      // Navigate to review page first
      router.push('/dashboard/consumer/orders/review')
    } catch (error) {
      console.error('Error saving order data:', error)
      alert('Error processing checkout. Please try again.')
    }
  }

  const getCartTotalItems = () => {
    return Object.values(cart).reduce((sum, item) => sum + item.quantity, 0)
  }

  return (
    <DashboardLayout actorType="consumer">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-semibold text-gray-800">Uniform Catalog</h1>
          <div className="flex items-center space-x-3">
            <button
              onClick={async () => {
                if (currentEmployee) {
                  const companyId = typeof currentEmployee.companyId === 'object' && currentEmployee.companyId?.id 
                    ? currentEmployee.companyId.id 
                    : currentEmployee.companyId
                  console.log('Manual refresh triggered - Company ID:', companyId)
                  const products = await getProductsByCompany(companyId)
                  console.log('Manual refresh - Products loaded:', products.length, products.map(p => p.name))
                  setUniforms(products)
                  if (products.length > 0) {
                    alert(`✅ Refreshed! Found ${products.length} product(s): ${products.map(p => p.name).join(', ')}`)
                  } else {
                    alert(`⚠️ No products found. Check console for details.`)
                  }
                } else {
                  alert('Employee not found. Please log in again.')
                }
              }}
              className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-200 transition-colors flex items-center space-x-2"
              title="Refresh products"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={async () => {
                if (confirm('This will clear all relationship data from localStorage. Are you sure?')) {
                  localStorage.removeItem('productCompanies')
                  localStorage.removeItem('vendorCompanies')
                  localStorage.removeItem('productVendors')
                  if (currentEmployee) {
                    const companyId = typeof currentEmployee.companyId === 'object' && currentEmployee.companyId?.id 
                      ? currentEmployee.companyId.id 
                      : currentEmployee.companyId
                    const products = await getProductsByCompany(companyId)
                    setUniforms(products)
                    alert(`Cleared localStorage. Found ${products.length} products (using MongoDB now).`)
                  }
                }
              }}
              className="bg-red-100 text-red-700 px-4 py-2 rounded-lg font-medium hover:bg-red-200 transition-colors flex items-center space-x-2"
              title="Clear localStorage and reset to mock data"
            >
              <span>Clear Data</span>
            </button>
            {getCartTotalItems() > 0 && (
              <button
                onClick={handleCheckout}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2 shadow-md"
              >
                <ShoppingCart className="h-5 w-5" />
                <span>Checkout ({getCartTotalItems()} items)</span>
              </button>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search uniforms..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
            <div>
              <select
                value={filterGender}
                onChange={(e) => setFilterGender(e.target.value as any)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
              >
                <option value="all">All Genders</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              {filterGender !== 'all' && filterGender === currentEmployee?.gender && (
                <p className="text-xs text-blue-600 mt-1">Filtered by your profile ({currentEmployee?.gender})</p>
              )}
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
            >
              <option value="all">All Categories</option>
              <option value="shirt">Shirts</option>
              <option value="pant">Pants</option>
              <option value="shoe">Shoes</option>
              <option value="jacket">Jackets</option>
            </select>
          </div>
        </div>

        {/* Eligibility Info */}
        {currentEmployee && (() => {
          // Get employee's date of joining (default to Oct 1, 2025 if not set)
          const dateOfJoining = currentEmployee.dateOfJoining 
            ? new Date(currentEmployee.dateOfJoining) 
            : new Date('2025-10-01T00:00:00.000Z')
          
          // Get cycle durations for each item type (defaults if not set)
          const cycleDurations = currentEmployee.cycleDuration || {
            shirt: 6,
            pant: 6,
            shoe: 6,
            jacket: 12
          }
          
          // Get cycle info for each item type
          const getCycleInfo = (itemType: 'shirt' | 'pant' | 'shoe' | 'jacket') => {
            const cycleDates = getCurrentCycleDates(itemType, dateOfJoining, cycleDurations[itemType])
            const nextCycleStart = getNextCycleStartDate(itemType, dateOfJoining, cycleDurations[itemType])
            const daysRemaining = getDaysRemainingInCycle(itemType, dateOfJoining, cycleDurations[itemType])
            return { cycleDates, nextCycleStart, daysRemaining }
          }
          
          const shirtCycle = getCycleInfo('shirt')
          const pantCycle = getCycleInfo('pant')
          const shoeCycle = getCycleInfo('shoe')
          const jacketCycle = getCycleInfo('jacket')
          
          return (
            <div className="glass rounded-2xl shadow-modern-lg border border-slate-200/50 p-6 mb-6 bg-gradient-to-br from-blue-50/50 to-indigo-50/30">
              <div className="flex items-center space-x-2 mb-4">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <AlertCircle className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-lg">Your Eligibility</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                <div 
                  className="relative"
                  onMouseEnter={() => setHoveredItemType('shirt')}
                  onMouseLeave={() => setHoveredItemType(null)}
                >
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 cursor-pointer hover-lift transition-smooth shadow-modern">
                    <div className="font-bold text-slate-900 mb-2">Shirts</div>
                    <div className="text-slate-700 mb-1">
                      <span className="font-bold text-slate-900 text-lg">
                        {getEligibilityForCategory('shirt')} / {currentEmployee.eligibility?.shirt || 0}
                      </span>
                      {consumedEligibility.shirt > 0 && (
                        <span className="text-xs text-slate-500 ml-1">({consumedEligibility.shirt} used)</span>
                      )}
                    </div>
                  </div>
                  {hoveredItemType === 'shirt' && (
                    <div className="absolute z-[9999] left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none tooltip-overlay">
                      <div className="text-sm font-semibold mb-2 pb-2 border-b border-gray-700">
                        Shirt Cycle Information
                      </div>
                      <div className="text-xs space-y-1">
                        <div>Cycle Duration: <span className="font-semibold">{cycleDurations.shirt} months</span></div>
                        <div>Expires: <span className="font-semibold">{formatCycleDate(shirtCycle.cycleDates.end)}</span></div>
                        <div>Next Cycle: <span className="font-semibold">{formatCycleDate(shirtCycle.nextCycleStart)}</span></div>
                        <div className="mt-2 pt-2 border-t border-gray-700">
                          {shirtCycle.daysRemaining > 0 ? (
                            <span className="text-green-400 font-semibold">{shirtCycle.daysRemaining} days remaining</span>
                          ) : (
                            <span className="text-orange-400 font-semibold">Cycle expired - Reset pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div 
                  className="relative"
                  onMouseEnter={() => setHoveredItemType('pant')}
                  onMouseLeave={() => setHoveredItemType(null)}
                >
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 cursor-pointer hover-lift transition-smooth shadow-modern">
                    <div className="font-bold text-slate-900 mb-2">Pants</div>
                    <div className="text-slate-700 mb-1">
                      <span className="font-bold text-slate-900 text-lg">
                        {getEligibilityForCategory('pant')} / {currentEmployee.eligibility?.pant || 0}
                      </span>
                      {consumedEligibility.pant > 0 && (
                        <span className="text-xs text-slate-500 ml-1">({consumedEligibility.pant} used)</span>
                      )}
                    </div>
                  </div>
                  {hoveredItemType === 'pant' && (
                    <div className="absolute z-[9999] left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none tooltip-overlay">
                      <div className="text-sm font-semibold mb-2 pb-2 border-b border-gray-700">
                        Pant Cycle Information
                      </div>
                      <div className="text-xs space-y-1">
                        <div>Cycle Duration: <span className="font-semibold">{cycleDurations.pant} months</span></div>
                        <div>Expires: <span className="font-semibold">{formatCycleDate(pantCycle.cycleDates.end)}</span></div>
                        <div>Next Cycle: <span className="font-semibold">{formatCycleDate(pantCycle.nextCycleStart)}</span></div>
                        <div className="mt-2 pt-2 border-t border-gray-700">
                          {pantCycle.daysRemaining > 0 ? (
                            <span className="text-green-400 font-semibold">{pantCycle.daysRemaining} days remaining</span>
                          ) : (
                            <span className="text-orange-400 font-semibold">Cycle expired - Reset pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div 
                  className="relative"
                  onMouseEnter={() => setHoveredItemType('shoe')}
                  onMouseLeave={() => setHoveredItemType(null)}
                >
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 cursor-pointer hover-lift transition-smooth shadow-modern">
                    <div className="font-bold text-slate-900 mb-2">Shoes</div>
                    <div className="text-slate-700 mb-1">
                      <span className="font-bold text-slate-900 text-lg">
                        {getEligibilityForCategory('shoe')} / {currentEmployee.eligibility?.shoe || 0}
                      </span>
                      {consumedEligibility.shoe > 0 && (
                        <span className="text-xs text-slate-500 ml-1">({consumedEligibility.shoe} used)</span>
                      )}
                    </div>
                  </div>
                  {hoveredItemType === 'shoe' && (
                    <div className="absolute z-[9999] left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none tooltip-overlay">
                      <div className="text-sm font-semibold mb-2 pb-2 border-b border-gray-700">
                        Shoe Cycle Information
                      </div>
                      <div className="text-xs space-y-1">
                        <div>Cycle Duration: <span className="font-semibold">{cycleDurations.shoe} months</span></div>
                        <div>Expires: <span className="font-semibold">{formatCycleDate(shoeCycle.cycleDates.end)}</span></div>
                        <div>Next Cycle: <span className="font-semibold">{formatCycleDate(shoeCycle.nextCycleStart)}</span></div>
                        <div className="mt-2 pt-2 border-t border-gray-700">
                          {shoeCycle.daysRemaining > 0 ? (
                            <span className="text-green-400 font-semibold">{shoeCycle.daysRemaining} days remaining</span>
                          ) : (
                            <span className="text-orange-400 font-semibold">Cycle expired - Reset pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div 
                  className="relative"
                  onMouseEnter={() => setHoveredItemType('jacket')}
                  onMouseLeave={() => setHoveredItemType(null)}
                >
                  <div className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 cursor-pointer hover-lift transition-smooth shadow-modern">
                    <div className="font-bold text-slate-900 mb-2">Jackets</div>
                    <div className="text-slate-700 mb-1">
                      <span className="font-bold text-slate-900 text-lg">
                        {getEligibilityForCategory('jacket')} / {currentEmployee.eligibility?.jacket || 0}
                      </span>
                      {consumedEligibility.jacket > 0 && (
                        <span className="text-xs text-slate-500 ml-1">({consumedEligibility.jacket} used)</span>
                      )}
                    </div>
                  </div>
                  {hoveredItemType === 'jacket' && (
                    <div className="absolute z-[9999] left-1/2 -translate-x-1/2 top-full mt-2 w-64 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none tooltip-overlay">
                      <div className="text-sm font-semibold mb-2 pb-2 border-b border-gray-700">
                        Jacket Cycle Information
                      </div>
                      <div className="text-xs space-y-1">
                        <div>Cycle Duration: <span className="font-semibold">{cycleDurations.jacket} months</span></div>
                        <div>Expires: <span className="font-semibold">{formatCycleDate(jacketCycle.cycleDates.end)}</span></div>
                        <div>Next Cycle: <span className="font-semibold">{formatCycleDate(jacketCycle.nextCycleStart)}</span></div>
                        <div className="mt-2 pt-2 border-t border-gray-700">
                          {jacketCycle.daysRemaining > 0 ? (
                            <span className="text-green-400 font-semibold">{jacketCycle.daysRemaining} days remaining</span>
                          ) : (
                            <span className="text-orange-400 font-semibold">Cycle expired - Reset pending</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Empty State */}
        {filteredUniforms.length === 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <Package className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Available</h3>
            <p className="text-gray-600 mb-4">
              {uniforms.length === 0 
                ? 'No products are currently available for your company. Please contact your administrator.'
                : `No products match your current filters (${filterGender}, ${filterCategory}). Try adjusting your search or filters.`}
            </p>
            {uniforms.length === 0 && currentEmployee && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-left max-w-md mx-auto">
                <p className="text-sm font-semibold text-yellow-900 mb-2">Debug Information</p>
                <div className="text-xs text-yellow-800 space-y-1">
                  <p>Company ID: <strong>{currentEmployee.companyId}</strong></p>
                  <p>Company Name: <strong>{currentEmployee.companyName}</strong></p>
                  <p>Employee Email: <strong>{currentEmployee.email}</strong></p>
                  <p>Total Products Loaded: <strong>{uniforms.length}</strong></p>
                  <p className="mt-2">Check browser console (F12) for detailed logs.</p>
                  <button
                    onClick={async () => {
                      console.log('Catalog Debug Check:')
                      console.log('localStorage productCompanies:', localStorage.getItem('productCompanies'))
                      console.log('localStorage productVendors:', localStorage.getItem('productVendors'))
                      console.log('localStorage vendorCompanies:', localStorage.getItem('vendorCompanies'))
                      console.log('Current Employee:', currentEmployee)
                      const companyId = typeof currentEmployee.companyId === 'object' && currentEmployee.companyId?.id 
                        ? currentEmployee.companyId.id 
                        : currentEmployee.companyId
                      const products = await getProductsByCompany(companyId)
                      console.log('Products after manual call:', products)
                      setUniforms(products)
                      if (products.length > 0) {
                        alert(`✅ Found ${products.length} product(s): ${products.map(p => p.name).join(', ')}`)
                      } else {
                        alert(`⚠️ No products found. Check console for details.`)
                      }
                    }}
                    className="mt-2 text-xs bg-yellow-200 text-yellow-900 px-3 py-1 rounded hover:bg-yellow-300"
                  >
                    Run Debug Check
                  </button>
                </div>
              </div>
            )}
            {uniforms.length > 0 && filteredUniforms.length === 0 && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-left max-w-md mx-auto">
                <p className="text-sm font-semibold text-blue-900 mb-2">Products Available But Filtered</p>
                <div className="text-xs text-blue-800 space-y-1">
                  <p>Total Products: <strong>{uniforms.length}</strong></p>
                  <p>Current Gender Filter: <strong>{filterGender}</strong></p>
                  <p>Current Category Filter: <strong>{filterCategory}</strong></p>
                  <p className="mt-2">Try changing your filters to see products.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Catalog Grid */}
        {filteredUniforms.length > 0 && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredUniforms.map((uniform) => {
            const selectedSize = selectedSizes[uniform.id] || uniform.sizes[0]
            const cartItem = cart[uniform.id]
            const currentQuantity = cartItem?.quantity || 0
            const eligibility = getEligibilityForCategory(uniform.category)
            const totalForCategory = getTotalQuantityForCategory(uniform.category)
            const otherItemsQuantity = totalForCategory - currentQuantity
            const maxAllowed = Math.max(0, eligibility - otherItemsQuantity)
            const canAddMore = currentQuantity < maxAllowed && totalForCategory < eligibility

            return (
              <div key={uniform.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative h-64 bg-gradient-to-br from-indigo-50 via-blue-50 to-slate-100">
                  <Image
                    src={getIndigoUniformImage(uniform.category, uniform.gender)}
                    alt={uniform.name}
                    fill
                    className="object-cover object-center"
                    priority={false}
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    unoptimized={true}
                    onError={(e) => {
                      // Fallback to a placeholder or default image if the image fails to load
                      const target = e.target as HTMLImageElement
                      target.src = '/images/uniforms/default.jpg'
                    }}
                  />
                  {/* Professional airline uniform overlay effect */}
                  <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/5 to-transparent pointer-events-none"></div>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-gray-900 mb-3 text-lg">{uniform.name}</h3>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Size:</label>
                    <select
                      value={selectedSize}
                      onChange={(e) => handleSizeChange(uniform.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
                    >
                      {uniform.sizes.map((size) => (
                        <option key={size} value={size}>
                          {size} {size === selectedSizes[uniform.id] ? '(Your Size)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Quantity:</label>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => updateQuantity(uniform.id, selectedSize, -1)}
                        disabled={currentQuantity === 0}
                        className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <span className="flex-1 text-center font-semibold text-gray-900 py-1.5 px-3 border border-gray-200 rounded-lg bg-gray-50">
                        {currentQuantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(uniform.id, selectedSize, 1)}
                        disabled={!canAddMore}
                        className="p-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                    {!canAddMore && currentQuantity > 0 && (
                      <p className="text-xs text-red-600 mt-1">
                        Maximum {maxAllowed} allowed for {uniform.category}
                      </p>
                    )}
                    {currentQuantity === 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        You can order up to {eligibility} {uniform.category}(s)
                      </p>
                    )}
                  </div>

                  {currentQuantity > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-600">
                        <span className="font-medium text-gray-900">{currentQuantity}</span> × {selectedSize} in cart
                      </p>
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
