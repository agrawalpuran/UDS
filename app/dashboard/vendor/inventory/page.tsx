'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Plus, Search, Edit, Package, Save, X } from 'lucide-react'
import { getProductsByVendor, getVendorInventory, updateVendorInventory } from '@/lib/data-mongodb'
import Image from 'next/image'

// Helper function to get Indigo Airlines-style uniform images
function getIndigoUniformImage(category: string, gender: string = 'male'): string {
  const normalizedCategory = category.toLowerCase() === 'trouser' ? 'pant' : category.toLowerCase()
  const normalizedGender = gender.toLowerCase()
  
  if (normalizedCategory === 'shirt' && normalizedGender === 'female') {
    return '/images/uniforms/female-shirt.png'
  }
  if (normalizedCategory === 'jacket' && normalizedGender === 'male') {
    return '/images/uniforms/male-blazer.webp'
  }
  if (normalizedCategory === 'pant' && normalizedGender === 'male') {
    return '/images/uniforms/pant-male.png'
  }
  if (normalizedCategory === 'pant' && normalizedGender === 'female') {
    return '/images/uniforms/pant-female.jpg'
  }
  if (normalizedCategory === 'jacket' && normalizedGender === 'female') {
    return '/images/uniforms/jacket-female.jpg'
  }
  if (normalizedCategory === 'shoe' && normalizedGender === 'male') {
    return '/images/uniforms/shoe-male.jpg'
  }
  if (normalizedCategory === 'shoe' && normalizedGender === 'female') {
    return '/images/uniforms/shoe-female.jpg'
  }
  if (normalizedCategory === 'shoe') {
    return '/images/uniforms/shoe-image.jpg'
  }
  
  const imagePath = `/images/uniforms/${normalizedCategory}-${normalizedGender}.jpg`
  return imagePath
}

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [vendorId, setVendorId] = useState<string>('')
  const [products, setProducts] = useState<any[]>([])
  const [inventoryData, setInventoryData] = useState<Map<string, any>>(new Map())
  const [loading, setLoading] = useState(true)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editingSizes, setEditingSizes] = useState<{ [size: string]: number }>({})
  const [saving, setSaving] = useState(false)
  
  // Get vendor ID from localStorage (set during login)
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const storedVendorId = typeof window !== 'undefined' ? localStorage.getItem('vendorId') : null
        const targetVendorId = storedVendorId || 'VEND-001'
        setVendorId(targetVendorId)
        
        // Load products linked to this vendor
        const vendorProducts = await getProductsByVendor(targetVendorId)
        setProducts(vendorProducts)
        
        // Load inventory data for all products
        const inventory = await getVendorInventory(targetVendorId)
        const inventoryMap = new Map()
        inventory.forEach((inv: any) => {
          inventoryMap.set(inv.productId, inv)
        })
        setInventoryData(inventoryMap)
      } catch (error) {
        console.error('Error loading inventory:', error)
      } finally {
        setLoading(false)
      }
    }
    
    loadData()
  }, [])
  
  const handleEdit = (product: any) => {
    const inventory = inventoryData.get(product.id)
    const sizeInventory = inventory?.sizeInventory || {}
    
    // Initialize with product's available sizes, defaulting to 0
    const initialSizes: { [size: string]: number } = {}
    product.sizes?.forEach((size: string) => {
      initialSizes[size] = sizeInventory[size] || 0
    })
    
    setEditingSizes(initialSizes)
    setEditingProductId(product.id)
  }
  
  const handleSave = async (productId: string) => {
    try {
      setSaving(true)
      await updateVendorInventory(vendorId, productId, editingSizes)
      
      // Reload inventory data
      const inventory = await getVendorInventory(vendorId, productId)
      if (inventory.length > 0) {
        const updatedMap = new Map(inventoryData)
        updatedMap.set(productId, inventory[0])
        setInventoryData(updatedMap)
      }
      
      setEditingProductId(null)
      setEditingSizes({})
    } catch (error) {
      console.error('Error saving inventory:', error)
      alert('Failed to save inventory. Please try again.')
    } finally {
      setSaving(false)
    }
  }
  
  const handleCancel = () => {
    setEditingProductId(null)
    setEditingSizes({})
  }
  
  const handleSizeChange = (size: string, value: string) => {
    const numValue = parseInt(value) || 0
    setEditingSizes((prev) => ({
      ...prev,
      [size]: numValue,
    }))
  }
  
  const filteredProducts = products.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  const getInventoryForProduct = (productId: string) => {
    return inventoryData.get(productId) || {
      sizeInventory: {},
      totalStock: 0,
    }
  }
  
  if (loading) {
    return (
      <DashboardLayout actorType="vendor">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading inventory...</div>
        </div>
      </DashboardLayout>
    )
  }
  
  return (
    <DashboardLayout actorType="vendor">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Inventory Management</h1>
        </div>

        {/* Search */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or SKU..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Consolidated Inventory Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">SKU</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Sizes</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Total Stock</th>
                  <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                      {searchTerm ? 'No products found matching your search.' : 'No products linked to this vendor.'}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product: any) => {
                    const inventory = getInventoryForProduct(product.id)
                    const isEditing = editingProductId === product.id
                    const sizeInventory = inventory.sizeInventory || {}
                    
                    return (
                      <tr key={product.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100">
                              <Image
                                src={getIndigoUniformImage(product.category, product.gender)}
                                alt={product.name}
                                fill
                                className="object-cover"
                                unoptimized={true}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement
                                  target.src = '/images/uniforms/default.jpg'
                                }}
                              />
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900">{product.name}</div>
                              <div className="text-sm text-gray-500">{product.gender}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">{product.sku}</td>
                        <td className="px-6 py-4 text-sm text-gray-600 capitalize">{product.category}</td>
                        <td className="px-6 py-4">
                          {isEditing ? (
                            <div className="flex flex-wrap gap-2 justify-center">
                              {product.sizes?.map((size: string) => (
                                <div key={size} className="flex items-center space-x-1">
                                  <span className="text-xs font-medium text-gray-600 w-6">{size}:</span>
                                  <input
                                    type="number"
                                    min="0"
                                    value={editingSizes[size] || 0}
                                    onChange={(e) => handleSizeChange(size, e.target.value)}
                                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="flex flex-wrap gap-2 justify-center">
                              {product.sizes?.map((size: string) => {
                                const qty = sizeInventory[size] || 0
                                return (
                                  <span
                                    key={size}
                                    className={`px-2 py-1 text-xs font-medium rounded ${
                                      qty > 0
                                        ? qty > 10
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-yellow-100 text-yellow-700'
                                        : 'bg-red-100 text-red-700'
                                    }`}
                                  >
                                    {size}: {qty}
                                  </span>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                            inventory.totalStock > 50
                              ? 'bg-green-100 text-green-700'
                              : inventory.totalStock > 0
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {inventory.totalStock || 0}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center space-x-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={() => handleSave(product.id)}
                                  disabled={saving}
                                  className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Save"
                                >
                                  <Save className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={handleCancel}
                                  disabled={saving}
                                  className="p-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                  title="Cancel"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => handleEdit(product)}
                                className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                title="Edit Inventory"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
