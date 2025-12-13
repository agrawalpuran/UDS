'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Search, Filter, Plus } from 'lucide-react'
import { getProductsByCompany, getAllCompanies, getCompanyById } from '@/lib/data-mongodb'
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

export default function CatalogPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female' | 'unisex'>('all')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [uniforms, setUniforms] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [companyPrimaryColor, setCompanyPrimaryColor] = useState<string>('#f76b1c')
  const [companySecondaryColor, setCompanySecondaryColor] = useState<string>('#f76b1c')
  
  // Get company ID from localStorage (set during login) or default to first company
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        let targetCompanyId = typeof window !== 'undefined' ? localStorage.getItem('companyId') : null
        
        // If companyId not in localStorage, try to get it from admin email
        if (!targetCompanyId && typeof window !== 'undefined') {
          const { getUserEmail } = await import('@/lib/utils/auth-storage')
          const userEmail = getUserEmail('company') || localStorage.getItem('userEmail')
          if (userEmail) {
            const { getCompanyByAdminEmail } = await import('@/lib/data-mongodb')
            const company = await getCompanyByAdminEmail(userEmail)
            if (company && company.id) {
              targetCompanyId = String(company.id)
              localStorage.setItem('companyId', targetCompanyId)
            }
          }
        }
        
        if (targetCompanyId) {
          setSelectedCompanyId(targetCompanyId)
          console.log(`[CatalogPage] Fetching products for companyId: ${targetCompanyId}`)
          const products = await getProductsByCompany(targetCompanyId)
          console.log(`[CatalogPage] Loaded ${products.length} products for company ${targetCompanyId}`)
          console.log(`[CatalogPage] Products:`, products.slice(0, 3).map(p => ({ id: p.id, name: p.name, sku: p.sku })))
          if (products.length === 0) {
            console.warn(`[CatalogPage] No products found for company ${targetCompanyId}. This might mean:`)
            console.warn(`  - No ProductCompany relationships exist for this company`)
            console.warn(`  - Products exist but are not linked to the company`)
            console.warn(`  - Check server logs for getProductsByCompany details`)
          }
          setUniforms(products)
          
          // Fetch company colors
          const companyDetails = await getCompanyById(targetCompanyId)
          if (companyDetails) {
            setCompanyPrimaryColor(companyDetails.primaryColor || '#f76b1c')
            setCompanySecondaryColor(companyDetails.secondaryColor || companyDetails.primaryColor || '#f76b1c')
          }
        } else {
          // Default to first company for demo (fallback)
          const companies = await getAllCompanies()
          if (companies.length > 0) {
            const fallbackCompanyId = companies[0].id
            setSelectedCompanyId(fallbackCompanyId)
            const products = await getProductsByCompany(fallbackCompanyId)
            console.log(`[CatalogPage] Using fallback company ${fallbackCompanyId}, loaded ${products.length} products`)
            setUniforms(products)
            
            // Fetch company colors
            const companyDetails = await getCompanyById(fallbackCompanyId)
            if (companyDetails) {
              setCompanyPrimaryColor(companyDetails.primaryColor || '#f76b1c')
              setCompanySecondaryColor(companyDetails.secondaryColor || companyDetails.primaryColor || '#f76b1c')
            }
          } else {
            console.error('[CatalogPage] No companies found and no companyId in localStorage')
          }
        }
      } catch (error) {
        console.error('Error loading catalog:', error)
        alert(`Error loading catalog: ${error instanceof Error ? error.message : 'Unknown error'}`)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])
  
  useEffect(() => {
    const loadProducts = async () => {
      if (selectedCompanyId) {
        try {
          setLoading(true)
          const products = await getProductsByCompany(selectedCompanyId)
          setUniforms(products)
        } catch (error) {
          console.error('Error loading products:', error)
        } finally {
          setLoading(false)
        }
      }
    }
    
    loadProducts()
  }, [selectedCompanyId])

  const filteredUniforms = uniforms.filter(uniform => {
    const matchesSearch = uniform.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         uniform.sku.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesGender = filterGender === 'all' || uniform.gender === filterGender
    const matchesCategory = filterCategory === 'all' || uniform.category === filterCategory
    return matchesSearch && matchesGender && matchesCategory
  })

  return (
    <DashboardLayout actorType="company">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Uniform Catalog</h1>
          <button 
            className="text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-2"
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
            <Plus className="h-5 w-5" />
            <span>Add SKU</span>
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search by name or SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
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
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value as any)}
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
              <option value="all">All Genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="unisex">Unisex</option>
            </select>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
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
              <option value="all">All Categories</option>
              <option value="shirt">Shirts</option>
              <option value="pant">Pants</option>
              <option value="shoe">Shoes</option>
              <option value="jacket">Jackets</option>
            </select>
          </div>
        </div>

        {/* Catalog Grid */}
        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading catalog...</p>
          </div>
        ) : filteredUniforms.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl shadow-lg">
            <p className="text-xl font-semibold text-gray-900 mb-2">No products found</p>
            <p className="text-gray-600 mb-4">
              {searchTerm || filterGender !== 'all' || filterCategory !== 'all'
                ? 'Try adjusting your filters'
                : 'No products are currently linked to this company. Products need to be linked via ProductCompany relationships.'}
            </p>
            {!searchTerm && filterGender === 'all' && filterCategory === 'all' && (
              <div className="text-sm text-gray-500 mt-4">
                <p>To add products to this catalog:</p>
                <p>1. Ensure products exist in the database</p>
                <p>2. Create ProductCompany relationships linking products to this company</p>
                <p>3. Check server console logs for detailed debugging information</p>
              </div>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredUniforms.map((uniform) => (
            <div key={uniform.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-2xl transition-shadow">
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
              <div className="p-4">
                <h3 className="font-bold text-gray-900 mb-1">{uniform.name}</h3>
                <p className="text-sm text-gray-600 mb-2">SKU: {uniform.sku}</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-lg font-bold text-gray-900">₹{uniform.price}</span>
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${
                    uniform.stock > 50 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    Stock: {uniform.stock}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 mb-3">
                  {uniform.sizes.slice(0, 4).map((size: string) => (
                    <span key={size} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {size}
                    </span>
                  ))}
                  {uniform.sizes.length > 4 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      +{uniform.sizes.length - 4}
                    </span>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button 
                    className="flex-1 text-white py-2 rounded-lg font-semibold transition-colors text-sm"
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
                    Edit
                  </button>
                  <button className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors text-sm">
                    View
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}








