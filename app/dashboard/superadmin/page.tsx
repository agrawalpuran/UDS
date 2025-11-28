'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { 
  Package, Users, Building2, ShoppingBag, Link2, 
  Plus, Edit, Trash2, Search, Save
} from 'lucide-react'
import { 
  getAllProducts, getAllVendors, getAllCompanies, getAllEmployees,
  getProductCompanies, getProductVendors, getVendorCompanies,
  createProductCompany, createProductVendor, createVendorCompany,
  deleteProductCompany, deleteProductVendor, deleteVendorCompany,
  addCompanyAdmin, removeCompanyAdmin, updateCompanyAdminPrivileges, getCompanyAdmins,
  Uniform, Vendor, Company, Employee, ProductCompany, ProductVendor, VendorCompany
} from '@/lib/data-mongodb'

export default function SuperAdminPage() {
  const [activeTab, setActiveTab] = useState<'products' | 'vendors' | 'companies' | 'employees' | 'relationships'>('products')
  const [searchTerm, setSearchTerm] = useState('')
  
  // Data states
  const [products, setProducts] = useState<Uniform[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [productCompanies, setProductCompanies] = useState<ProductCompany[]>([])
  const [productVendors, setProductVendors] = useState<ProductVendor[]>([])
  const [vendorCompanies, setVendorCompanies] = useState<VendorCompany[]>([])
  const [loading, setLoading] = useState(true)
  
  // Load all data from MongoDB on mount
  useEffect(() => {
    const loadAllData = async () => {
      try {
        setLoading(true)
        const [productsData, vendorsData, companiesData, employeesData, pcData, pvData, vcData] = await Promise.all([
          getAllProducts(),
          getAllVendors(),
          getAllCompanies(),
          getAllEmployees(),
          getProductCompanies(),
          getProductVendors(),
          getVendorCompanies()
        ])
        
        setProducts(productsData)
        setVendors(vendorsData)
        setCompanies(companiesData)
        setEmployees(employeesData)
        setProductCompanies(pcData)
        setProductVendors(pvData)
        setVendorCompanies(vcData)
        
        // Load admins for each company
        const adminsMap: Record<string, any[]> = {}
        for (const company of companiesData) {
          try {
            const admins = await getCompanyAdmins(company.id)
            adminsMap[company.id] = admins
          } catch (error) {
            console.error(`Error loading admins for company ${company.id}:`, error)
            adminsMap[company.id] = []
          }
        }
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

  const handleSaveProduct = (product: Partial<Uniform>) => {
    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? { ...p, ...product } as Uniform : p))
    } else {
      const newProduct: Uniform = {
        id: `PROD-${Date.now()}`,
        name: product.name || '',
        category: product.category || 'shirt',
        gender: product.gender || 'unisex',
        sizes: product.sizes || [],
        price: product.price || 0,
        image: product.image || '',
        sku: product.sku || '',
        vendorId: product.vendorId || '',
        stock: product.stock || 0,
        companyIds: product.companyIds || []
      }
      setProducts([...products, newProduct])
    }
    setEditingProduct(null)
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
                      onClick={() => setProducts(products.filter(p => p.id !== product.id))}
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
                  const empCompanyId = typeof e.companyId === 'object' && e.companyId?.id
                    ? e.companyId.id
                    : e.companyId
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
                      <p className="text-xs font-semibold text-gray-700 mb-2">Company Admins ({admins.length}):</p>
                      {admins.length > 0 ? (
                        <div className="space-y-2">
                          {admins.map((admin: any) => {
                            const adminEmployee = admin.employee || employees.find((e: any) => e.id === admin.employeeId)
                            return adminEmployee ? (
                              <div key={admin.employeeId} className="p-2 bg-white rounded border border-gray-200">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">
                                      {adminEmployee.firstName} {adminEmployee.lastName}
                                    </p>
                                    <p className="text-xs text-gray-600">{adminEmployee.email}</p>
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
                                          await updateCompanyAdminPrivileges(
                                            company.id, 
                                            admin.employeeId, 
                                            !admin.canApproveOrders
                                          )
                                          // Reload admins
                                          const updatedAdmins = await getCompanyAdmins(company.id)
                                          setCompanyAdmins({ ...companyAdmins, [company.id]: updatedAdmins })
                                          alert('Privileges updated successfully!')
                                        } catch (error: any) {
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
                                        if (confirm(`Remove ${adminEmployee.firstName} ${adminEmployee.lastName} as admin?`)) {
                                          try {
                                            await removeCompanyAdmin(company.id, admin.employeeId)
                                            // Reload admins
                                            const updatedAdmins = await getCompanyAdmins(company.id)
                                            setCompanyAdmins({ ...companyAdmins, [company.id]: updatedAdmins })
                                            alert('Admin removed successfully!')
                                          } catch (error: any) {
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
                            ) : null
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
                          Search Employee:
                        </label>
                        <div className="relative mb-2">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                          <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={adminSearchTerm}
                            onChange={(e) => {
                              setAdminSearchTerm(e.target.value)
                              setSelectedEmployeeIdForAdmin('')
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
                                    setSelectedEmployeeIdForAdmin(emp.id)
                                    setAdminSearchTerm(`${emp.firstName} ${emp.lastName} (${emp.email})`)
                                  }}
                                  className={`px-3 py-2 cursor-pointer hover:bg-blue-100 transition-colors ${
                                    selectedEmployeeIdForAdmin === emp.id ? 'bg-blue-200' : ''
                                  }`}
                                >
                                  <p className="text-sm font-medium text-gray-900">
                                    {emp.firstName} {emp.lastName}
                                  </p>
                                  <p className="text-xs font-mono text-blue-600 font-semibold">{emp.employeeId || 'N/A'}</p>
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
                        {selectedEmployeeIdForAdmin && (
                          <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                            <p className="font-semibold text-green-900">Selected:</p>
                            <p className="text-green-700">
                              {companyEmployees.find((e) => e.id === selectedEmployeeIdForAdmin)?.firstName}{' '}
                              {companyEmployees.find((e) => e.id === selectedEmployeeIdForAdmin)?.lastName}
                            </p>
                            <p className="text-xs font-mono text-green-600 font-semibold mt-1">
                              ID: {companyEmployees.find((e) => e.id === selectedEmployeeIdForAdmin)?.employeeId || 'N/A'}
                            </p>
                            <p className="text-xs text-green-600 mt-1">
                              {companyEmployees.find((e) => e.id === selectedEmployeeIdForAdmin)?.email}
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
                        )}
                        <div className="flex space-x-2">
                          <button
                            onClick={async () => {
                              if (!selectedEmployeeIdForAdmin) {
                                alert('Please search and select an employee')
                                return
                              }
                              try {
                                await addCompanyAdmin(company.id, selectedEmployeeIdForAdmin, canApproveOrders)
                                // Reload admins
                                const updatedAdmins = await getCompanyAdmins(company.id)
                                setCompanyAdmins({ ...companyAdmins, [company.id]: updatedAdmins })
                                setAssigningAdminForCompany(null)
                                setSelectedEmployeeIdForAdmin('')
                                setAdminSearchTerm('')
                                setCanApproveOrders(false)
                                alert('Admin added successfully!')
                              } catch (error: any) {
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
                      <td className="py-3 px-4">{employee.firstName} {employee.lastName}</td>
                      <td className="py-3 px-4">{employee.email}</td>
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
            
            {/* Link Product to Companies */}
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
              
              {/* Display existing Product-Company relationships */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Existing Product-Company Links</h4>
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
                              try {
                                await deleteProductCompany(pc.productId, pc.companyId)
                                const updated = await getProductCompanies()
                                setProductCompanies(updated)
                                alert('Link removed successfully!')
                              } catch (error) {
                                console.error('Error deleting relationship:', error)
                                alert('Error removing link. Please try again.')
                              }
                            }}
                            className="text-red-600 hover:text-red-800"
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

            {/* Link Product to Vendor */}
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
              
              {/* Display existing Product-Vendor relationships */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Existing Product-Vendor Links</h4>
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
                              try {
                                await deleteProductVendor(pv.productId, pv.vendorId)
                                const updated = await getProductVendors()
                                setProductVendors(updated)
                                alert('Link removed successfully!')
                              } catch (error) {
                                console.error('Error deleting relationship:', error)
                                alert('Error removing link. Please try again.')
                              }
                            }}
                            className="text-red-600 hover:text-red-800"
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

          </div>
        )}
      </div>
    </DashboardLayout>
  )
}

