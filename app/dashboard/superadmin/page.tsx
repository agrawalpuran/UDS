'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Package, Users, Building2, ShoppingBag, Link2, 
  Plus, Edit, Trash2, Search, Save
} from 'lucide-react'
import { 
  getAllProducts, getAllVendors, getAllCompanies, getAllEmployees,
  getProductCompanies, getProductVendors,
  createProductCompany, createProductVendor,
  deleteProductCompany, deleteProductVendor,
  addCompanyAdmin, removeCompanyAdmin, updateCompanyAdminPrivileges, getCompanyAdmins,
  createProduct, updateProduct, deleteProduct,
  Uniform, Vendor, Company, Employee, ProductCompany, ProductVendor
} from '@/lib/data-mongodb'
import { maskEmployeeData, maskEmail } from '@/lib/utils/data-masking'

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'vendors' | 'companies' | 'employees' | 'relationships'>('products')
  const [relationshipSubTab, setRelationshipSubTab] = useState<'productToCompany' | 'productToVendor'>('productToCompany')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Data states
  const [products, setProducts] = useState<Uniform[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [productCompanies, setProductCompanies] = useState<ProductCompany[]>([])
  const [productVendors, setProductVendors] = useState<ProductVendor[]>([])
  const [vendorCompanies, setVendorCompanies] = useState<Array<{ vendorId: string, companyId: string }>>([])
  const [loading, setLoading] = useState(true)
  
  // Load all data from MongoDB on mount
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true)
        const [productsData, vendorsData, companiesData, employeesData, pcData, pvData] = await Promise.all([
          getAllProducts(),
          getAllVendors(),
          getAllCompanies(),
          getAllEmployees(),
          getProductCompanies(),
          getProductVendors()
        ])
        
        setProducts(productsData)
        setVendors(vendorsData)
        setCompanies(companiesData)
        setEmployees(employeesData)
        setProductCompanies(pcData)
        setProductVendors(pvData)
        setVendorCompanies([])
        
        // Load admins for each company
        const adminsMap: Record<string, any[]> = {}
        for (const company of companiesData) {
          try {
            const admins = await getCompanyAdmins(company.id)
            adminsMap[company.id] = admins
            console.log(`Loaded ${admins.length} admins for ${company.id}:`, admins.map((a: any) => a.employee?.employeeId || a.employeeId))
          } catch (error) {
            console.error(`Error loading admins for company ${company.id}:`, error)
            adminsMap[company.id] = []
          }
        }
        console.log('Setting companyAdmins state:', adminsMap)
        setCompanyAdmins(adminsMap)
        
        console.log('✅ Loaded data:', {
          products: productsData.length,
          vendors: vendorsData.length,
          companies: companiesData.length,
          employees: employeesData.length
        })
      } catch (error) {
        console.error('❌ Error loading data:', error)
        alert('Error loading data. Please check the console for details.')
      } finally {
        setLoading(false)
      }
    }
    
    loadAllData()
  }, [])
  
  // Refresh admins when Companies tab is opened
  useEffect(() => {
    if (activeTab === 'companies' && companies.length > 0) {
      const refreshAdmins = async () => {
        const adminsMap: Record<string, any[]> = {}
        for (const company of companies) {
          try {
            const admins = await getCompanyAdmins(company.id)
            adminsMap[company.id] = admins
            console.log(`[Refresh] Loaded ${admins.length} admins for ${company.id}`)
          } catch (error) {
            console.error(`Error refreshing admins for company ${company.id}:`, error)
            adminsMap[company.id] = []
          }
        }
        setCompanyAdmins(adminsMap)
      }
      refreshAdmins()
    }
  }, [activeTab, companies])
  
  // Form states
  const [editingProduct, setEditingProduct] = useState<Uniform | null>(null)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [selectedProductId, setSelectedProductId] = useState<string>('')
  const [selectedCompanyIds, setSelectedCompanyIds] = useState<string[]>([])
  const [selectedVendorId, setSelectedVendorId] = useState<string>('')
  const [assigningAdminForCompany, setAssigningAdminForCompany] = useState<string | null>(null)
  const [selectedEmployeeIdForAdmin, setSelectedEmployeeIdForAdmin] = useState<string>('')
  const [adminSearchTerm, setAdminSearchTerm] = useState<string>('')
  const [canApproveOrders, setCanApproveOrders] = useState<boolean>(false)
  const [companyAdmins, setCompanyAdmins] = useState<Record<string, any[]>>({})

  const tabs = [
    { id: 'products', name: 'Products', icon: Package },
    { id: 'vendors', name: 'Vendors', icon: ShoppingBag },
    { id: 'companies', name: 'Companies', icon: Building2 },
    { id: 'employees', name: 'Employees', icon: Users },
    { id: 'relationships', name: 'Relationships', icon: Link2 },
  ]

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredCompanies = companies.filter(c =>
    c.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredEmployees = employees.filter(e =>
    `${e.firstName} ${e.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (e.employeeId && e.employeeId.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleSaveProduct = async (product: Partial<Uniform>) => {
    try {
      if (editingProduct && editingProduct.id) {
        // Update existing product
        const updated = await updateProduct(editingProduct.id, {
          name: product.name,
          category: product.category,
          gender: product.gender,
          sizes: product.sizes,
          price: product.price,
          image: product.image,
          sku: product.sku,
          stock: product.stock,
        })
        
        // Reload products list
        const updatedProducts = await getAllProducts()
        setProducts(updatedProducts)
        alert('Product updated successfully!')
      } else {
        // Create new product (vendor can be linked later via relationships)
        const newProduct = await createProduct({
          name: product.name || '',
          category: (product.category as any) || 'shirt',
          gender: (product.gender as any) || 'unisex',
          sizes: product.sizes || [],
          price: product.price || 0,
          image: product.image || '',
          sku: product.sku || '',
          stock: product.stock || 0,
        })
        
        // Reload products list
        const updatedProducts = await getAllProducts()
        setProducts(updatedProducts)
        alert('Product created successfully!')
      }
      setEditingProduct(null)
    } catch (error: any) {
      console.error('Error saving product:', error)
      alert(`Error saving product: ${error.message || 'Unknown error occurred'}`)
    }
  }

  const handleSaveVendor = (vendor: Partial<Vendor>) => {
    if (editingVendor) {
      setVendors(vendors.map(v => v.id === editingVendor.id ? { ...v, ...vendor } as Vendor : v))
    } else {
      const newVendor: Vendor = {
        id: `VEND-${Date.now()}`,
        name: vendor.name || '',
        email: vendor.email || '',
        phone: vendor.phone || '',
        logo: vendor.logo || '',
        website: vendor.website || '',
        primaryColor: vendor.primaryColor || '#2563eb',
        secondaryColor: vendor.secondaryColor || '#1e40af',
        accentColor: vendor.accentColor || '#3b82f6',
        theme: vendor.theme || 'light'
      }
      setVendors([...vendors, newVendor])
    }
    setEditingVendor(null)
  }

  const handleSaveCompany = (company: Partial<Company>) => {
    if (editingCompany) {
      setCompanies(companies.map(c => c.id === editingCompany.id ? { ...c, ...company } as Company : c))
    } else {
      const newCompany: Company = {
        id: `COMP-${Date.now()}`,
        name: company.name || '',
        logo: company.logo || '',
        website: company.website || '',
        primaryColor: company.primaryColor || '#000000',
        showPrices: company.showPrices || false,
      }
      setCompanies([...companies, newCompany])
    }
    setEditingCompany(null)
  }

  const handleLinkProductToCompanies = async () => {
    if (!selectedProductId || selectedCompanyIds.length === 0) {
      alert('Please select a product and at least one company')
      return
    }
    
    console.log('handleLinkProductToCompanies - selectedProductId:', selectedProductId)
    console.log('handleLinkProductToCompanies - selectedCompanyIds:', selectedCompanyIds)
    console.log('handleLinkProductToCompanies - Available products:', products.map(p => ({ id: p.id, name: p.name })))
    console.log('handleLinkProductToCompanies - Available companies:', companies.map(c => ({ id: c.id, name: c.name })))
    
    try {
      // Remove existing relationships for this product first
      const existing = productCompanies.filter(pc => pc.productId === selectedProductId)
      for (const rel of existing) {
        await deleteProductCompany(selectedProductId, rel.companyId)
      }
      
      // Create new relationships
      for (const companyId of selectedCompanyIds) {
        console.log(`Creating relationship: productId=${selectedProductId}, companyId=${companyId}`)
        await createProductCompany(selectedProductId, companyId)
      }
      
      // Reload relationships
      const updated = await getProductCompanies()
      setProductCompanies(updated)
      
      const productName = products.find(p => p.id === selectedProductId)?.name || selectedProductId
      const companyNames = selectedCompanyIds.map(id => companies.find(c => c.id === id)?.name || id).join(', ')
      
      setSelectedProductId('')
      setSelectedCompanyIds([])
      alert(`✅ "${productName}" linked to ${selectedCompanyIds.length} company/companies: ${companyNames}`)
    } catch (error: any) {
      console.error('Error linking product to companies:', error)
      alert(`Error saving relationship: ${error?.message || 'Unknown error'}. Please check the console for details.`)
    }
  }

  const handleLinkProductToVendor = async () => {
    if (!selectedProductId || !selectedVendorId) {
      alert('Please select both a product and a vendor')
      return
    }
    
    try {
      // Remove existing vendor relationship for this product first
      const existing = productVendors.filter(pv => pv.productId === selectedProductId)
      for (const rel of existing) {
        await deleteProductVendor(selectedProductId, rel.vendorId)
      }
      
      // Create new relationship
      await createProductVendor(selectedProductId, selectedVendorId)
      
      // Reload relationships
      const updated = await getProductVendors()
      setProductVendors(updated)
      
      const productName = products.find(p => p.id === selectedProductId)?.name || selectedProductId
      const vendorName = vendors.find(v => v.id === selectedVendorId)?.name || selectedVendorId
      
      setSelectedProductId('')
      setSelectedVendorId('')
      alert(`✅ "${productName}" linked to vendor "${vendorName}" successfully!`)
    } catch (error) {
      console.error('Error linking product to vendor:', error)
      alert('Error saving relationship. Please try again.')
    }
  }


  return (
    <DashboardLayout actorType="superadmin">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Super Admin Dashboard</h1>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex border-b border-gray-200">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center space-x-2 px-6 py-4 font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'border-b-2 border-blue-600 text-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{tab.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 text-center">
            <p className="text-gray-600">Loading data...</p>
          </div>
        )}

        {/* Search */}
        {!loading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === 'products' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Products</h2>
              <button
                onClick={() => setEditingProduct({} as Uniform)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>Add Product</span>
              </button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map((product) => (
                <div key={product.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">SKU: {product.sku}</p>
                  <p className="text-sm text-gray-600 mb-2">
                    Gender: <span className="font-semibold capitalize">{product.gender || 'unisex'}</span>
                  </p>
                  <p className="text-sm text-gray-600 mb-2">Price: ₹{product.price}</p>
                  <p className="text-sm text-gray-600 mb-2">Stock: {product.stock}</p>
                  <p className="text-sm text-gray-600 mb-2">
                    Companies: {product.companyIds.length}
                  </p>
                  <div className="flex space-x-2 mt-4">
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete "${product.name}"?`)) {
                          try {
                            await deleteProduct(product.id)
                            // Reload products list
                            const updatedProducts = await getAllProducts()
                            setProducts(updatedProducts)
                            alert('Product deleted successfully!')
                          } catch (error: any) {
                            console.error('Error deleting product:', error)
                            alert(`Error deleting product: ${error.message || 'Unknown error occurred'}`)
                          }
                        }
                      }}
                      className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Product Edit/Add Form Modal */}
            {editingProduct && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                  <h2 className="text-2xl font-bold text-gray-900 mb-6">
                    {editingProduct.id ? 'Edit Product' : 'Add New Product'}
                  </h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault()
                      const formData = new FormData(e.target as HTMLFormElement)
                      const productData: Partial<Uniform> = {
                        name: formData.get('name') as string,
                        category: formData.get('category') as any,
                        gender: formData.get('gender') as any,
                        sizes: (formData.get('sizes') as string)?.split(',').map(s => s.trim()).filter(s => s) || [],
                        price: parseFloat(formData.get('price') as string) || 0,
                        image: formData.get('image') as string,
                        sku: formData.get('sku') as string,
                        stock: parseInt(formData.get('stock') as string) || 0,
                      }
                      await handleSaveProduct(productData)
                    }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product Name</label>
                      <input
                        type="text"
                        name="name"
                        defaultValue={editingProduct.name || ''}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                        <select
                          name="category"
                          defaultValue={editingProduct.category || 'shirt'}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="shirt">Shirt</option>
                          <option value="pant">Pant</option>
                          <option value="shoe">Shoe</option>
                          <option value="jacket">Jacket</option>
                          <option value="accessory">Accessory</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                        <select
                          name="gender"
                          defaultValue={editingProduct.gender || 'unisex'}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="unisex">Unisex</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Sizes (comma-separated)</label>
                      <input
                        type="text"
                        name="sizes"
                        defaultValue={editingProduct.sizes?.join(', ') || ''}
                        placeholder="e.g., S, M, L, XL"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹)</label>
                        <input
                          type="number"
                          name="price"
                          step="0.01"
                          defaultValue={editingProduct.price || 0}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Stock</label>
                        <input
                          type="number"
                          name="stock"
                          defaultValue={editingProduct.stock || 0}
                          required
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                      <input
                        type="text"
                        name="sku"
                        defaultValue={editingProduct.sku || ''}
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Image URL</label>
                      <input
                        type="url"
                        name="image"
                        defaultValue={editingProduct.image || ''}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex space-x-4 pt-4">
                      <button
                        type="submit"
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                      >
                        <Save className="h-5 w-5 inline mr-2" />
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="flex-1 bg-gray-200 text-gray-700 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vendors Tab */}
        {activeTab === 'vendors' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Vendors</h2>
              <button
                onClick={() => setEditingVendor({} as Vendor)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>Add Vendor</span>
              </button>
            </div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredVendors.map((vendor) => (
                <div key={vendor.id} className="border border-gray-200 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-2">{vendor.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">Email: {vendor.email}</p>
                  <p className="text-sm text-gray-600 mb-2">Phone: {vendor.phone}</p>
                  <div className="flex items-center space-x-2 mb-2">
                    <div 
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: vendor.primaryColor }}
                    />
                    <span className="text-sm text-gray-600">Primary: {vendor.primaryColor}</span>
                  </div>
                  <div className="flex space-x-2 mt-4">
                    <button
                      onClick={() => setEditingVendor(vendor)}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setVendors(vendors.filter(v => v.id !== vendor.id))}
                      className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Companies Tab */}
        {activeTab === 'companies' && !loading && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Companies</h2>
              <button
                onClick={() => setEditingCompany({} as Company)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <Plus className="h-5 w-5" />
                <span>Add Company</span>
              </button>
            </div>
            {filteredCompanies.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600 mb-4">No companies found.</p>
                <p className="text-sm text-gray-500">Companies: {companies.length}, Filtered: {filteredCompanies.length}</p>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCompanies.map((company) => {
                const companyEmployees = employees.filter((e: any) => {
                  // Handle different companyId formats
                  let empCompanyId: string | null = null
                  
                  if (e.companyId) {
                    // If companyId is populated object with id field
                    if (typeof e.companyId === 'object' && e.companyId !== null) {
                      empCompanyId = e.companyId.id || e.companyId._id?.toString() || null
                    } 
                    // If companyId is a string (company id like "COMP-INDIGO")
                    else if (typeof e.companyId === 'string') {
                      empCompanyId = e.companyId
                    }
                  }
                  
                  // Also check companyName as fallback
                  if (!empCompanyId && e.companyName) {
                    const matchingCompany = companies.find(c => c.name === e.companyName)
                    if (matchingCompany) {
                      empCompanyId = matchingCompany.id
                    }
                  }
                  
                  return empCompanyId === company.id
                })
                const admins = companyAdmins[company.id] || []

                return (
                  <div key={company.id} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-2">{company.name}</h3>
                    <p className="text-sm text-gray-600 mb-2">Website: {company.website}</p>
                    <div className="flex items-center space-x-2 mb-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: company.primaryColor }}
                      />
                      <span className="text-sm text-gray-600">Color: {company.primaryColor}</span>
                    </div>
                    
                    {/* Company Admins Display */}
                    <div className="mb-3 p-2 bg-gray-50 rounded">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-gray-700">Company Admins ({admins.length}):</p>
                        <button
                          onClick={async () => {
                            try {
                              const refreshedAdmins = await getCompanyAdmins(company.id)
                              setCompanyAdmins({ ...companyAdmins, [company.id]: refreshedAdmins })
                              console.log('Refreshed admins for', company.id, ':', refreshedAdmins)
                            } catch (error) {
                              console.error('Error refreshing admins:', error)
                            }
                          }}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          🔄 Refresh
                        </button>
                      </div>
                      {admins.length > 0 ? (
                        <div className="space-y-2">
                          {admins.map((admin: any) => {
                            // Try to get employee from admin.employee (populated), or find in employees list
                            let adminEmployee = admin.employee
                            if (!adminEmployee && admin.employeeId) {
                              // Try to find by id or employeeId - but only if admin.employeeId exists
                              adminEmployee = employees.find((e: any) => 
                                e.id === admin.employeeId || 
                                e.employeeId === admin.employeeId ||
                                e._id?.toString() === admin.employeeId?.toString()
                              )
                            }
                            
                            // Don't display if no valid employee found
                            if (!adminEmployee) {
                              console.warn('Admin record has no valid employee:', admin)
                              return null
                            }
                            
                            return (
                              <div key={admin.employeeId || admin._id} className="p-2 bg-white rounded border border-gray-200">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">
                                      {maskEmployeeData(adminEmployee).firstName} {maskEmployeeData(adminEmployee).lastName}
                                    </p>
                                    <p className="text-xs text-gray-600">{maskEmail(adminEmployee.email)}</p>
                                    <p className="text-xs font-mono text-blue-600 font-semibold mt-1">
                                      ID: {adminEmployee.employeeId || 'N/A'}
                                    </p>
                                    <div className="mt-1 flex items-center space-x-2">
                                      <span className={`text-xs px-2 py-0.5 rounded ${
                                        admin.canApproveOrders 
                                          ? 'bg-green-100 text-green-800 font-semibold' 
                                          : 'bg-gray-100 text-gray-600'
                                      }`}>
                                        {admin.canApproveOrders ? '✓ Can Approve Orders' : 'Cannot Approve Orders'}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col space-y-1">
                                    <button
                                      onClick={async () => {
                                        try {
                                          // Use employee.id or employee.employeeId, fallback to admin.employeeId
                                          const employeeIdToUpdate = adminEmployee.id || adminEmployee.employeeId || admin.employeeId
                                          if (!employeeIdToUpdate) {
                                            alert('Error: Could not determine employee ID')
                                            return
                                          }
                                          await updateCompanyAdminPrivileges(
                                            company.id, 
                                            employeeIdToUpdate, 
                                            !admin.canApproveOrders
                                          )
                                          // Reload admins
                                          const updatedAdmins = await getCompanyAdmins(company.id)
                                          setCompanyAdmins({ ...companyAdmins, [company.id]: updatedAdmins })
                                          alert('Privileges updated successfully!')
                                        } catch (error: any) {
                                          console.error('Error updating privileges:', error)
                                          alert(`Error: ${error.message}`)
                                        }
                                      }}
                                      className={`text-xs px-2 py-1 rounded font-semibold ${
                                        admin.canApproveOrders
                                          ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                                          : 'bg-green-100 text-green-700 hover:bg-green-200'
                                      }`}
                                    >
                                      {admin.canApproveOrders ? 'Revoke Approval' : 'Grant Approval'}
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const masked = maskEmployeeData(adminEmployee)
                                        if (confirm(`Remove ${masked.firstName} ${masked.lastName} as admin?`)) {
                                          try {
                                            // Use employee.id or employee.employeeId, fallback to admin.employeeId
                                            const employeeIdToRemove = adminEmployee.id || adminEmployee.employeeId || admin.employeeId
                                            
                                            if (!employeeIdToRemove) {
                                              console.error('No employeeId found:', { adminEmployee, admin })
                                              alert('Error: Could not determine employee ID. Please check the console.')
                                              return
                                            }
                                            
                                            console.log('Removing admin:', { 
                                              companyId: company.id, 
                                              employeeId: employeeIdToRemove,
                                              adminEmployeeId: adminEmployee.id,
                                              adminEmployeeEmployeeId: adminEmployee.employeeId,
                                              adminRecordEmployeeId: admin.employeeId
                                            })
                                            
                                            await removeCompanyAdmin(company.id, employeeIdToRemove)
                                            
                                            // Reload admins
                                            const updatedAdmins = await getCompanyAdmins(company.id)
                                            setCompanyAdmins({ ...companyAdmins, [company.id]: updatedAdmins })
                                            alert('Admin removed successfully!')
                                          } catch (error: any) {
                                            console.error('Error removing admin:', error)
                                            alert(`Error: ${error.message}`)
                                          }
                                        }
                                      }}
                                      className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 font-semibold"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 italic">No admins assigned</p>
                      )}
                    </div>

                    {/* Assign Admin Section */}
                    {assigningAdminForCompany === company.id ? (
                      <div className="mb-3 p-3 bg-blue-50 rounded border border-blue-200">
                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                          Search Employee (e.g., "Amit" or "Patel"):
                        </label>
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={adminSearchTerm}
                            onChange={(e) => {
                              setAdminSearchTerm(e.target.value)
                              setSelectedEmployeeIdForAdmin('') // Clear selection when search changes
                            }}
                            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                          />
                        </div>
                        {adminSearchTerm && (
                          <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg bg-white mb-2">
                            {companyEmployees
                              .filter((emp) => {
                                const searchLower = adminSearchTerm.toLowerCase()
                                return (
                                  emp.firstName.toLowerCase().includes(searchLower) ||
                                  emp.lastName.toLowerCase().includes(searchLower) ||
                                  emp.email.toLowerCase().includes(searchLower) ||
                                  `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchLower)
                                )
                              })
                              .slice(0, 5)
                              .map((emp) => (
                                <div
                                  key={emp.id}
                                  onClick={() => {
                                    // Use employee.id as primary, fallback to employee.employeeId
                                    const employeeIdToSelect = emp.id || emp.employeeId
                                    setSelectedEmployeeIdForAdmin(employeeIdToSelect)
                                    setAdminSearchTerm(`${emp.firstName} ${emp.lastName} (${emp.email})`)
                                    console.log('Selected employee for admin:', {
                                      id: emp.id,
                                      employeeId: emp.employeeId,
                                      name: `${emp.firstName} ${emp.lastName}`,
                                      email: emp.email,
                                      companyId: emp.companyId,
                                      companyName: emp.companyName,
                                      targetCompany: company.name,
                                      selectedId: employeeIdToSelect,
                                      belongsToCompany: emp.companyId === company.id || emp.companyName === company.name
                                    })
                                  }}
                                  className={`px-3 py-2 cursor-pointer hover:bg-blue-100 transition-colors ${
                                    selectedEmployeeIdForAdmin === (emp.id || emp.employeeId) ? 'bg-blue-200' : ''
                                  }`}
                                >
                                  <p className="text-sm font-medium text-gray-900">
                                    {emp.firstName} {emp.lastName}
                                  </p>
                                  <p className="text-xs font-mono text-blue-600 font-semibold">{emp.employeeId || emp.id || 'N/A'}</p>
                                  <p className="text-xs text-gray-600">{emp.email}</p>
                                </div>
                              ))}
                            {companyEmployees.filter((emp) => {
                              const searchLower = adminSearchTerm.toLowerCase()
                              return (
                                emp.firstName.toLowerCase().includes(searchLower) ||
                                emp.lastName.toLowerCase().includes(searchLower) ||
                                emp.email.toLowerCase().includes(searchLower) ||
                                `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchLower)
                              )
                            }).length === 0 && (
                              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                                No employees found
                              </div>
                            )}
                          </div>
                        )}
                        {selectedEmployeeIdForAdmin && (() => {
                          const selectedEmployee = companyEmployees.find((e) => 
                            e.id === selectedEmployeeIdForAdmin || 
                            e.employeeId === selectedEmployeeIdForAdmin
                          )
                          return selectedEmployee ? (
                            <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                              <p className="font-semibold text-green-900">Selected:</p>
                              <p className="text-green-700 font-medium">
                                {selectedEmployee.firstName} {selectedEmployee.lastName}
                              </p>
                              <p className="text-xs font-mono text-green-600 font-semibold mt-1">
                                Employee ID: {selectedEmployee.employeeId || selectedEmployee.id || 'N/A'}
                              </p>
                              <p className="text-xs text-green-600 mt-1">
                                {selectedEmployee.email}
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                Internal ID: {selectedEmployee.id}
                              </p>
                            <div className="mt-2">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={canApproveOrders}
                                  onChange={(e) => setCanApproveOrders(e.target.checked)}
                                  className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <span className="text-xs font-semibold text-gray-700">
                                  Can Approve Orders
                                </span>
                              </label>
                            </div>
                            </div>
                          ) : null
                        })()}
                        <div className="flex space-x-2">
                          <button
                            onClick={async () => {
                              if (!selectedEmployeeIdForAdmin) {
                                alert('Please search and select an employee')
                                return
                              }
                              
                              // Get the selected employee to verify
                              const selectedEmployee = companyEmployees.find((e) => 
                                e.id === selectedEmployeeIdForAdmin || 
                                e.employeeId === selectedEmployeeIdForAdmin
                              )
                              
                              if (!selectedEmployee) {
                                alert('Selected employee not found. Please try again.')
                                return
                              }
                              
                              // Verify employee belongs to this company
                              let empCompanyId: string | null = null
                              if (selectedEmployee.companyId) {
                                if (typeof selectedEmployee.companyId === 'object' && selectedEmployee.companyId !== null) {
                                  empCompanyId = (selectedEmployee.companyId as any).id || (selectedEmployee.companyId as any).toString()
                                } else {
                                  empCompanyId = String(selectedEmployee.companyId)
                                }
                              }
                              
                              // Also check companyName as fallback
                              if (empCompanyId !== company.id && selectedEmployee.companyName !== company.name) {
                                // Try to find matching company by name
                                const matchingCompany = companies.find(c => 
                                  c.name === selectedEmployee.companyName || 
                                  c.id === empCompanyId
                                )
                                if (!matchingCompany || matchingCompany.id !== company.id) {
                                  alert(`Error: Employee ${selectedEmployee.firstName} ${selectedEmployee.lastName} (${selectedEmployee.employeeId}) does not belong to ${company.name}. They belong to ${selectedEmployee.companyName || 'unknown company'}.`)
                                  return
                                }
                              }
                              
                              // Use employee.id as primary identifier
                              const employeeIdToAdd = selectedEmployee.id || selectedEmployee.employeeId || selectedEmployeeIdForAdmin
                              
                              console.log('Adding admin:', {
                                companyId: company.id,
                                companyName: company.name,
                                employeeIdToAdd: employeeIdToAdd,
                                selectedEmployeeIdForAdmin: selectedEmployeeIdForAdmin,
                                employeeName: `${selectedEmployee.firstName} ${selectedEmployee.lastName}`,
                                employeeEmployeeId: selectedEmployee.employeeId,
                                employeeCompanyId: empCompanyId,
                                employeeCompanyName: selectedEmployee.companyName,
                                verification: empCompanyId === company.id ? 'PASS' : 'FAIL'
                              })
                              
                              try {
                                await addCompanyAdmin(company.id, employeeIdToAdd, canApproveOrders)
                                // Reload admins
                                const updatedAdmins = await getCompanyAdmins(company.id)
                                setCompanyAdmins({ ...companyAdmins, [company.id]: updatedAdmins })
                                setAssigningAdminForCompany(null)
                                setSelectedEmployeeIdForAdmin('')
                                setAdminSearchTerm('')
                                setCanApproveOrders(false)
                                alert(`Admin added successfully! ${selectedEmployee.firstName} ${selectedEmployee.lastName} is now an admin.`)
                              } catch (error: any) {
                                console.error('Error adding admin:', error)
                                alert(`Error: ${error.message}`)
                              }
                            }}
                            disabled={!selectedEmployeeIdForAdmin}
                            className="flex-1 bg-green-600 text-white py-1.5 rounded text-xs font-semibold hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            Add Admin
                          </button>
                          <button
                            onClick={() => {
                              setAssigningAdminForCompany(null)
                              setSelectedEmployeeIdForAdmin('')
                              setAdminSearchTerm('')
                              setCanApproveOrders(false)
                            }}
                            className="flex-1 bg-gray-400 text-white py-1.5 rounded text-xs font-semibold hover:bg-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3">
                        <button
                          onClick={() => {
                            setAssigningAdminForCompany(company.id)
                            setSelectedEmployeeIdForAdmin('')
                            setAdminSearchTerm('')
                            setCanApproveOrders(false)
                          }}
                          className="w-full bg-purple-600 text-white py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors text-sm"
                        >
                          Add Admin
                        </button>
                      </div>
                    )}

                    <div className="flex space-x-2 mt-4">
                      <button
                        onClick={() => setEditingCompany(company)}
                        className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setCompanies(companies.filter(c => c.id !== company.id))}
                        className="flex-1 bg-red-600 text-white py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors text-sm"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )
              })}
              </div>
            )}
          </div>
        )}

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Employees</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Employee ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Email</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Company</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b border-gray-100">
                      <td className="py-3 px-4">
                        <span className="font-mono text-sm font-semibold text-blue-600">
                          {employee.employeeId || 'N/A'}
                        </span>
                      </td>
                      <td className="py-3 px-4">{maskEmployeeData(employee).firstName} {maskEmployeeData(employee).lastName}</td>
                      <td className="py-3 px-4">{maskEmail(employee.email)}</td>
                      <td className="py-3 px-4">{employee.companyName}</td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${
                          employee.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {employee.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Relationships Tab */}
        {activeTab === 'relationships' && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Manage Relationships</h2>
            
            {/* Sub-tabs for relationships */}
            <div className="mb-6 border-b border-gray-200">
              <nav className="flex space-x-8">
                <button
                  onClick={() => setRelationshipSubTab('productToCompany')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    relationshipSubTab === 'productToCompany'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Product to Company
                </button>
                <button
                  onClick={() => setRelationshipSubTab('productToVendor')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    relationshipSubTab === 'productToVendor'
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Product to Vendor
                </button>
              </nav>
            </div>
            
            {/* Link Product to Companies */}
            {relationshipSubTab === 'productToCompany' && (
            <div className="mb-8 p-6 border border-gray-200 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Link Product to Companies</h3>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value)
                      // Auto-select companies already linked to this product
                      if (e.target.value) {
                        const linkedCompanies = productCompanies
                          .filter(pc => pc.productId === e.target.value)
                          .map(pc => pc.companyId)
                        setSelectedCompanyIds(linkedCompanies)
                      } else {
                        setSelectedCompanyIds([])
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select Product</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Companies</label>
                  <select
                    multiple
                    value={selectedCompanyIds}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => option.value)
                      setSelectedCompanyIds(selected)
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    size={5}
                  >
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleLinkProductToCompanies}
                    disabled={!selectedProductId || selectedCompanyIds.length === 0}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <Link2 className="h-5 w-5" />
                    <span>Link</span>
                  </button>
                </div>
              </div>
              
              {/* Display all companies linked to selected product */}
              {selectedProductId && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">All Companies Linked to Selected Product</h4>
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    {(() => {
                      const product = products.find(p => p.id === selectedProductId)
                      const linkedCompanies = productCompanies
                        .filter(pc => pc.productId === selectedProductId)
                        .map(pc => {
                          const company = companies.find(c => c.id === pc.companyId)
                          return company
                        })
                        .filter(Boolean)
                      
                      return (
                        <>
                          <h5 className="font-semibold text-gray-900 mb-2">
                            {product?.name || selectedProductId}
                            {product?.sku && <span className="text-gray-600 font-normal ml-2">(SKU: {product.sku})</span>}
                          </h5>
                          {linkedCompanies.length === 0 ? (
                            <p className="text-gray-500 text-sm">This product is not linked to any companies</p>
                          ) : (
                            <div className="space-y-1">
                              {linkedCompanies.map((company, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded text-sm">
                                  <span className="text-gray-700 font-medium">{company?.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Display all products linked to selected company */}
              {selectedCompanyIds.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">
                    Products Linked to Selected {selectedCompanyIds.length === 1 ? 'Company' : 'Companies'}
                  </h4>
                  <div className="space-y-3">
                    {selectedCompanyIds.map(companyId => {
                      const company = companies.find(c => c.id === companyId)
                      const linkedProducts = productCompanies
                        .filter(pc => pc.companyId === companyId)
                        .map(pc => {
                          const product = products.find(p => p.id === pc.productId)
                          return product
                        })
                        .filter(Boolean)
                      
                      return (
                        <div key={companyId} className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                          <h5 className="font-semibold text-gray-900 mb-2">
                            {company?.name || companyId}
                          </h5>
                          {linkedProducts.length === 0 ? (
                            <p className="text-gray-500 text-sm">No products linked to this company</p>
                          ) : (
                            <div className="space-y-1">
                              {linkedProducts.map((product, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded text-sm">
                                  <span className="text-gray-700">
                                    <span className="font-medium">{product?.name}</span>
                                    {product?.sku && <span className="text-gray-500 ml-2">(SKU: {product.sku})</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Display existing Product-Company relationships */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">All Product-Company Links</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {productCompanies.length === 0 ? (
                    <p className="text-gray-500 text-sm">No product-company links yet</p>
                  ) : (
                    productCompanies.map((pc, index) => {
                      const product = products.find(p => p.id === pc.productId)
                      const company = companies.find(c => c.id === pc.companyId)
                      return (
                        <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg text-sm">
                          <span className="text-gray-700">
                            <span className="font-semibold">{product?.name || pc.productId}</span> linked to{' '}
                            <span className="font-semibold">{company?.name || pc.companyId}</span>
                          </span>
                          <button
                            onClick={async () => {
                              if (!confirm(`Are you sure you want to remove the link between "${product?.name || pc.productId}" and "${company?.name || pc.companyId}"?`)) {
                                return
                              }
                              try {
                                await deleteProductCompany(pc.productId, pc.companyId)
                                const updated = await getProductCompanies()
                                setProductCompanies(updated)
                                alert('Link removed successfully!')
                              } catch (error: any) {
                                console.error('Error deleting relationship:', error)
                                alert(`Error removing link: ${error.message || 'Please try again.'}`)
                              }
                            }}
                            className="text-red-600 hover:text-red-800 cursor-pointer transition-colors p-1 rounded hover:bg-red-50"
                            title="Delete relationship"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
            )}

            {/* Link Product to Vendor */}
            {relationshipSubTab === 'productToVendor' && (
            <div className="mb-8 p-6 border border-gray-200 rounded-lg">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Link Product to Vendor</h3>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                  <select
                    value={selectedProductId}
                    onChange={(e) => {
                      setSelectedProductId(e.target.value)
                      // Auto-select vendor already linked to this product
                      if (e.target.value) {
                        const linkedVendor = productVendors.find(pv => pv.productId === e.target.value)
                        setSelectedVendorId(linkedVendor?.vendorId || '')
                      } else {
                        setSelectedVendorId('')
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select Product</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Vendor</label>
                  <select
                    value={selectedVendorId}
                    onChange={(e) => setSelectedVendorId(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  >
                    <option value="">Select Vendor</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleLinkProductToVendor}
                    disabled={!selectedProductId || !selectedVendorId}
                    className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <Link2 className="h-5 w-5" />
                    <span>Link</span>
                  </button>
                </div>
              </div>
              
              {/* Display all vendors selling selected product */}
              {selectedProductId && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h4 className="text-lg font-semibold text-gray-900 mb-3">All Vendors Selling Selected Product</h4>
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    {(() => {
                      const product = products.find(p => p.id === selectedProductId)
                      const linkedVendors = productVendors
                        .filter(pv => pv.productId === selectedProductId)
                        .map(pv => {
                          const vendor = vendors.find(v => v.id === pv.vendorId)
                          return vendor
                        })
                        .filter(Boolean)
                      
                      return (
                        <>
                          <h5 className="font-semibold text-gray-900 mb-2">
                            {product?.name || selectedProductId}
                            {product?.sku && <span className="text-gray-600 font-normal ml-2">(SKU: {product.sku})</span>}
                          </h5>
                          {linkedVendors.length === 0 ? (
                            <p className="text-gray-500 text-sm">No vendors are selling this product</p>
                          ) : (
                            <div className="space-y-1">
                              {linkedVendors.map((vendor, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-white p-2 rounded text-sm">
                                  <span className="text-gray-700">
                                    <span className="font-medium">{vendor?.name}</span>
                                    {vendor?.email && <span className="text-gray-500 ml-2">({vendor.email})</span>}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </div>
                </div>
              )}

              {/* Display existing Product-Vendor relationships */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">All Product-Vendor Links</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {productVendors.length === 0 ? (
                    <p className="text-gray-500 text-sm">No product-vendor links yet</p>
                  ) : (
                    productVendors.map((pv, index) => {
                      const product = products.find(p => p.id === pv.productId)
                      const vendor = vendors.find(v => v.id === pv.vendorId)
                      return (
                        <div key={index} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg text-sm">
                          <span className="text-gray-700">
                            <span className="font-semibold">{product?.name || pv.productId}</span> supplied by{' '}
                            <span className="font-semibold">{vendor?.name || pv.vendorId}</span>
                          </span>
                          <button
                            onClick={async () => {
                              if (!confirm(`Are you sure you want to remove the link between "${product?.name || pv.productId}" and "${vendor?.name || pv.vendorId}"?`)) {
                                return
                              }
                              try {
                                await deleteProductVendor(pv.productId, pv.vendorId)
                                const updated = await getProductVendors()
                                setProductVendors(updated)
                                alert('Link removed successfully!')
                              } catch (error: any) {
                                console.error('Error deleting relationship:', error)
                                alert(`Error removing link: ${error.message || 'Please try again.'}`)
                              }
                            }}
                            className="text-red-600 hover:text-red-800 cursor-pointer transition-colors p-1 rounded hover:bg-red-50"
                            title="Delete relationship"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>
            )}


          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

