/**
 * Client-side MongoDB Data Access Layer
 * This file provides the same interface as data.ts but uses MongoDB via API routes
 */

// Re-export types from data.ts
export type {
  Uniform,
  Vendor,
  Company,
  Employee,
  Order,
  ProductCompany,
  ProductVendor,
} from './data'

// Base API URL
const API_BASE = '/api'

// Helper function to fetch from API
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    })

    // Handle 404 (null response) before checking response.ok
    if (response.status === 404) {
      return null as T
    }

    if (!response.ok) {
      let errorText = ''
      let errorMessage = `API Error: ${response.status} ${response.statusText}`
      try {
        errorText = await response.text()
        if (errorText) {
          try {
            const errorJson = JSON.parse(errorText)
            errorMessage = errorJson.error || errorMessage
          } catch {
            // If parsing fails, use the text as error message if it's not empty
            if (errorText.trim()) {
              errorMessage = errorText
            }
          }
        }
      } catch (textError) {
        // If reading response text fails, use the default error message
        console.warn(`Failed to read error response text:`, textError)
      }
      throw new Error(errorMessage)
    }

    // Handle empty responses
    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      // If response is not JSON, return null for empty responses
      const text = await response.text()
      if (!text || text.trim() === '') {
        return null as T
      }
      // If there's text but not JSON, try to parse it or return as string
      try {
        return JSON.parse(text) as T
      } catch {
        return text as T
      }
    }

    const data = await response.json()
    // Ensure arrays are returned as arrays (not wrapped in objects)
    if (Array.isArray(data)) {
      return data as T
    }
    // If data is an object with an array property, extract it
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // Check common array property names
      if (data.employees && Array.isArray(data.employees)) {
        return data.employees as T
      }
      if (data.data && Array.isArray(data.data)) {
        return data.data as T
      }
    }
    return data
  } catch (error: any) {
    // Don't log network errors as errors if they're expected (like 404)
    if (error?.message && !error.message.includes('404')) {
      console.error(`fetchAPI error for ${endpoint}:`, error)
    }
    throw error
  }
}

// ========== PRODUCT FUNCTIONS ==========

export async function getProductsByCompany(
  companyId: string, 
  designation?: string, 
  gender?: 'male' | 'female'
): Promise<any[]> {
  if (!companyId) return []
  try {
    let url = `/products?companyId=${companyId}`
    if (designation) {
      url += `&designation=${encodeURIComponent(designation)}`
    }
    if (gender) {
      url += `&gender=${gender}`
    }
    return await fetchAPI<any[]>(url)
  } catch (error) {
    console.error('Error fetching products by company:', error)
    return []
  }
}

export async function getAllProductsByCompany(companyId: string): Promise<any[]> {
  if (!companyId) return []
  try {
    const url = `/products?companyId=${companyId}&all=true`
    return await fetchAPI<any[]>(url)
  } catch (error) {
    console.error('Error fetching all products by company:', error)
    return []
  }
}

export async function getProductsByVendor(vendorId: string): Promise<any[]> {
  if (!vendorId) return []
  try {
    // Note: This endpoint needs to be added to the API
    return await fetchAPI<any[]>(`/products?vendorId=${vendorId}`)
  } catch (error) {
    console.error('Error fetching products by vendor:', error)
    return []
  }
}

export async function createProduct(productData: {
  name: string
  category: 'shirt' | 'pant' | 'shoe' | 'jacket' | 'accessory'
  gender: 'male' | 'female' | 'unisex'
  sizes: string[]
  price: number
  image: string
  sku: string
  vendorId?: string
  stock?: number
}): Promise<any> {
  try {
    return await fetchAPI<any>('/products', {
      method: 'POST',
      body: JSON.stringify(productData),
    })
  } catch (error) {
    console.error('Error creating product:', error)
    throw error
  }
}

export async function updateProduct(
  productId: string,
  updateData: {
    name?: string
    category?: 'shirt' | 'pant' | 'shoe' | 'jacket' | 'accessory'
    gender?: 'male' | 'female' | 'unisex'
    sizes?: string[]
    price?: number
    image?: string
    sku?: string
    vendorId?: string
    stock?: number
  }
): Promise<any> {
  try {
    return await fetchAPI<any>(`/products?productId=${productId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    })
  } catch (error) {
    console.error('Error updating product:', error)
    throw error
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  try {
    await fetchAPI<void>(`/products?productId=${productId}`, {
      method: 'DELETE',
    })
  } catch (error) {
    console.error('Error deleting product:', error)
    throw error
  }
}

export async function getAllProducts(): Promise<any[]> {
  try {
    return await fetchAPI<any[]>(`/products`)
  } catch (error) {
    console.error('Error fetching all products:', error)
    return []
  }
}

export async function getProductById(productId: string): Promise<any | null> {
  if (!productId) return null
  try {
    return await fetchAPI<any>(`/products?productId=${productId}`)
  } catch (error) {
    console.error('Error fetching product by ID:', error)
    return null
  }
}

// ========== VENDOR FUNCTIONS ==========

export async function getAllVendors(): Promise<any[]> {
  try {
    return await fetchAPI<any[]>(`/vendors`)
  } catch (error) {
    console.error('Error fetching vendors:', error)
    return []
  }
}

export async function getVendorById(vendorId: string): Promise<any | null> {
  if (!vendorId) return null
  try {
    return await fetchAPI<any>(`/vendors?vendorId=${vendorId}`)
  } catch (error) {
    console.error('Error fetching vendor by ID:', error)
    return null
  }
}

export async function getVendorByEmail(email: string): Promise<any | null> {
  if (!email) return null
  try {
    return await fetchAPI<any>(`/vendors?email=${encodeURIComponent(email)}`)
  } catch (error) {
    console.error('Error fetching vendor by email:', error)
    return null
  }
}

// ========== VENDOR INVENTORY FUNCTIONS ==========

export async function getVendorInventory(vendorId: string, productId?: string): Promise<any[]> {
  if (!vendorId) return []
  try {
    let url = `/vendor-inventory?vendorId=${vendorId}`
    if (productId) {
      url += `&productId=${productId}`
    }
    return await fetchAPI<any[]>(url)
  } catch (error) {
    console.error('Error fetching vendor inventory:', error)
    return []
  }
}

export async function updateVendorInventory(
  vendorId: string,
  productId: string,
  sizeInventory: { [size: string]: number }
): Promise<any> {
  if (!vendorId || !productId) {
    throw new Error('Vendor ID and Product ID are required')
  }
  try {
    return await fetchAPI<any>(`/vendor-inventory`, {
      method: 'PUT',
      body: JSON.stringify({
        vendorId,
        productId,
        sizeInventory,
      }),
    })
  } catch (error) {
    console.error('Error updating vendor inventory:', error)
    throw error
  }
}

// ========== COMPANY FUNCTIONS ==========

export async function getAllCompanies(): Promise<any[]> {
  try {
    return await fetchAPI<any[]>(`/companies`)
  } catch (error) {
    console.error('Error fetching companies:', error)
    return []
  }
}

export async function getCompanyById(companyId: string): Promise<any | null> {
  if (!companyId) return null
  try {
    return await fetchAPI<any>(`/companies?companyId=${companyId}`)
  } catch (error) {
    console.error('Error fetching company by ID:', error)
    return null
  }
}

export async function addCompanyAdmin(companyId: string, employeeId: string, canApproveOrders: boolean = false): Promise<void> {
  try {
    await fetchAPI<any>('/companies', {
      method: 'PATCH',
      body: JSON.stringify({ companyId, employeeId, action: 'addAdmin', canApproveOrders }),
    })
  } catch (error) {
    console.error('Error adding company admin:', error)
    throw error
  }
}

export async function setCompanyAdmin(companyId: string, employeeId: string): Promise<void> {
  // Legacy function - use addCompanyAdmin instead
  return addCompanyAdmin(companyId, employeeId, false)
}

export async function removeCompanyAdmin(companyId: string, employeeId: string): Promise<void> {
  try {
    await fetchAPI<any>('/companies', {
      method: 'PATCH',
      body: JSON.stringify({ companyId, employeeId, action: 'removeAdmin' }),
    })
  } catch (error) {
    console.error('Error removing company admin:', error)
    throw error
  }
}

export async function updateCompanyAdminPrivileges(companyId: string, employeeId: string, canApproveOrders: boolean): Promise<void> {
  try {
    await fetchAPI<any>('/companies', {
      method: 'PATCH',
      body: JSON.stringify({ companyId, employeeId, action: 'updatePrivileges', canApproveOrders }),
    })
  } catch (error) {
    console.error('Error updating company admin privileges:', error)
    throw error
  }
}

export async function updateCompanySettings(
  companyId: string,
  settings: { 
    showPrices?: boolean
    allowPersonalPayments?: boolean
    logo?: string
    primaryColor?: string
    secondaryColor?: string
    name?: string
  }
): Promise<any> {
  try {
    return await fetchAPI<any>('/companies', {
      method: 'PATCH',
      body: JSON.stringify({ companyId, action: 'updateSettings', ...settings }),
    })
  } catch (error) {
    console.error('Error updating company settings:', error)
    throw error
  }
}

export async function getCompanyAdmins(companyId: string): Promise<any[]> {
  try {
    return await fetchAPI<any[]>(`/companies?getAdmins=true&companyId=${companyId}`)
  } catch (error) {
    console.error('Error fetching company admins:', error)
    return []
  }
}

export async function canApproveOrders(email: string, companyId: string): Promise<boolean> {
  try {
    const result = await fetchAPI<{ canApprove: boolean }>(
      `/companies?checkCanApprove=true&email=${encodeURIComponent(email)}&companyId=${companyId}`
    )
    return result?.canApprove || false
  } catch (error) {
    console.error('Error checking approval permission:', error)
    return false
  }
}

export async function isCompanyAdmin(email: string, companyId: string): Promise<boolean> {
  try {
    const result = await fetchAPI<{ isAdmin: boolean }>(
      `/companies?checkAdmin=true&email=${encodeURIComponent(email)}&companyId=${companyId}`
    )
    return result.isAdmin
  } catch (error) {
    console.error('Error checking company admin:', error)
    return false
  }
}

export async function getCompanyByAdminEmail(email: string): Promise<any | null> {
  try {
    return await fetchAPI<any>(`/companies?getByAdminEmail=true&email=${encodeURIComponent(email)}`)
  } catch (error) {
    console.error('Error fetching company by admin email:', error)
    return null
  }
}

// ========== EMPLOYEE FUNCTIONS ==========

export async function getAllEmployees(): Promise<any[]> {
  try {
    return await fetchAPI<any[]>(`/employees`)
  } catch (error) {
    console.error('Error fetching employees:', error)
    return []
  }
}

export async function getEmployeeByEmail(email: string): Promise<any | null> {
  if (!email) return null
  try {
    const response = await fetchAPI<any>(`/employees?email=${encodeURIComponent(email)}`)
    // Handle null response (404)
    if (response === null) {
      return null
    }
    return response
  } catch (error) {
    console.error('Error fetching employee by email:', error)
    return null
  }
}

export async function getEmployeeById(employeeId: string): Promise<any | null> {
  if (!employeeId) return null
  try {
    return await fetchAPI<any>(`/employees?employeeId=${employeeId}`)
  } catch (error) {
    console.error('Error fetching employee by ID:', error)
    return null
  }
}

export async function getEmployeesByCompany(companyId: string): Promise<any[]> {
  if (!companyId) {
    console.warn('[getEmployeesByCompany] No companyId provided')
    return []
  }
  try {
    const employees = await fetchAPI<any[]>(`/employees?companyId=${companyId}`)
    console.log(`[getEmployeesByCompany] Fetched ${employees?.length || 0} employees for companyId: ${companyId}`)
    if (employees && employees.length > 0) {
      console.log(`[getEmployeesByCompany] First employee:`, {
        id: employees[0].id,
        employeeId: employees[0].employeeId,
        firstName: employees[0].firstName,
        lastName: employees[0].lastName
      })
    }
    return employees || []
  } catch (error) {
    console.error('Error fetching employees by company:', error)
    return []
  }
}

export async function createEmployee(employeeData: {
  employeeId?: string
  firstName: string
  lastName: string
  designation: string
  gender: 'male' | 'female'
  location: string
  email: string
  mobile: string
  shirtSize: string
  pantSize: string
  shoeSize: string
  address: string
  companyId: string
  companyName: string
  branchId?: string
  branchName?: string
  eligibility?: { shirt: number; pant: number; shoe: number; jacket: number }
  cycleDuration?: { shirt: number; pant: number; shoe: number; jacket: number }
  dispatchPreference?: 'direct' | 'central' | 'regional'
  status?: 'active' | 'inactive'
  period?: string
  dateOfJoining?: Date
}): Promise<any> {
  try {
    const employee = await fetchAPI<any>('/employees', {
      method: 'POST',
      body: JSON.stringify(employeeData),
    })
    return employee
  } catch (error: any) {
    console.error('Error creating employee:', error)
    throw error
  }
}

export async function updateEmployee(
  employeeId: string,
  updateData: {
    firstName?: string
    lastName?: string
    designation?: string
    gender?: 'male' | 'female'
    location?: string
    email?: string
    mobile?: string
    shirtSize?: string
    pantSize?: string
    shoeSize?: string
    address?: string
    branchId?: string
    branchName?: string
    eligibility?: { shirt: number; pant: number; shoe: number; jacket: number }
    cycleDuration?: { shirt: number; pant: number; shoe: number; jacket: number }
    dispatchPreference?: 'direct' | 'central' | 'regional'
    status?: 'active' | 'inactive'
    period?: string
    dateOfJoining?: Date
  }
): Promise<any> {
  try {
    const employee = await fetchAPI<any>('/employees', {
      method: 'PUT',
      body: JSON.stringify({ employeeId, ...updateData }),
    })
    return employee
  } catch (error: any) {
    console.error('Error updating employee:', error)
    throw error
  }
}

export async function deleteEmployee(employeeId: string): Promise<boolean> {
  try {
    await fetchAPI<any>(`/employees?employeeId=${employeeId}`, {
      method: 'DELETE',
    })
    return true
  } catch (error: any) {
    console.error('Error deleting employee:', error)
    throw error
  }
}

export async function getBranchesByCompany(companyId: string): Promise<any[]> {
  if (!companyId) return []
  try {
    return await fetchAPI<any[]>(`/branches?companyId=${companyId}`)
  } catch (error) {
    console.error('Error fetching branches by company:', error)
    return []
  }
}

// ========== ORDER FUNCTIONS ==========

export async function getAllOrders(): Promise<any[]> {
  try {
    return await fetchAPI<any[]>(`/orders`)
  } catch (error) {
    console.error('Error fetching orders:', error)
    return []
  }
}

export async function getOrdersByCompany(companyId: string): Promise<any[]> {
  if (!companyId) return []
  try {
    return await fetchAPI<any[]>(`/orders?companyId=${companyId}`)
  } catch (error) {
    console.error('Error fetching orders by company:', error)
    return []
  }
}

export async function getOrdersByVendor(vendorId: string): Promise<any[]> {
  if (!vendorId) return []
  try {
    return await fetchAPI<any[]>(`/orders?vendorId=${vendorId}`)
  } catch (error) {
    console.error('Error fetching orders by vendor:', error)
    return []
  }
}

export async function getOrdersByEmployee(employeeId: string): Promise<any[]> {
  if (!employeeId) return []
  try {
    return await fetchAPI<any[]>(`/orders?employeeId=${employeeId}`)
  } catch (error) {
    console.error('Error fetching orders by employee:', error)
    return []
  }
}

export async function getConsumedEligibility(employeeId: string): Promise<{
  shirt: number
  pant: number
  shoe: number
  jacket: number
}> {
  if (!employeeId) return { shirt: 0, pant: 0, shoe: 0, jacket: 0 }
  try {
    return await fetchAPI<{ shirt: number; pant: number; shoe: number; jacket: number }>(
      `/orders?employeeId=${employeeId}&consumedEligibility=true`
    )
  } catch (error) {
    console.error('Error fetching consumed eligibility:', error)
    return { shirt: 0, pant: 0, shoe: 0, jacket: 0 }
  }
}

export async function createOrder(orderData: {
  employeeId: string
  items: Array<{
    uniformId: string
    uniformName: string
    size: string
    quantity: number
    price: number
  }>
  deliveryAddress: string
  estimatedDeliveryTime: string
  dispatchLocation?: string
}): Promise<any> {
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(orderData),
    })

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`
      try {
        const errorData = await response.json()
        errorMessage = errorData.error || errorMessage
        console.error('API Error Response:', errorData)
      } catch (parseError) {
        // If JSON parsing fails, try to get text
        try {
          const errorText = await response.text()
          if (errorText) {
            errorMessage = errorText
          }
        } catch (textError) {
          console.error('Failed to parse error response:', textError)
        }
      }
      throw new Error(errorMessage)
    }

    return await response.json()
  } catch (error: any) {
    console.error('Error creating order:', error)
    // Ensure we have a meaningful error message
    if (error.message) {
      throw error
    } else {
      throw new Error(error.toString() || 'Unknown error occurred while creating order')
    }
  }
}

export async function approveOrder(orderId: string, adminEmail: string): Promise<any> {
  try {
    return await fetchAPI<any>('/orders', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', orderId, adminEmail }),
    })
  } catch (error) {
    console.error('Error approving order:', error)
    throw error
  }
}

export async function bulkApproveOrders(orderIds: string[], adminEmail: string): Promise<{ success: string[], failed: Array<{ orderId: string, error: string }> }> {
  try {
    return await fetchAPI<{ success: string[], failed: Array<{ orderId: string, error: string }> }>('/orders', {
      method: 'POST',
      body: JSON.stringify({ action: 'bulkApprove', orderIds, adminEmail }),
    })
  } catch (error) {
    console.error('Error bulk approving orders:', error)
    throw error
  }
}

export async function updateOrderStatus(orderId: string, status: 'Awaiting approval' | 'Awaiting fulfilment' | 'Dispatched' | 'Delivered'): Promise<any> {
  try {
    return await fetchAPI<any>('/orders', {
      method: 'POST',
      body: JSON.stringify({ action: 'updateStatus', orderId, status }),
    })
  } catch (error) {
    console.error('Error updating order status:', error)
    throw error
  }
}

export async function getPendingApprovals(companyId: string): Promise<any[]> {
  if (!companyId) return []
  try {
    return await fetchAPI<any[]>(`/orders?pendingApprovals=true&companyId=${companyId}`)
  } catch (error) {
    console.error('Error fetching pending approvals:', error)
    return []
  }
}

export async function getPendingApprovalCount(companyId: string): Promise<number> {
  if (!companyId) return 0
  try {
    const result = await fetchAPI<{ count: number }>(`/orders?pendingApprovalCount=true&companyId=${companyId}`)
    return result.count || 0
  } catch (error) {
    console.error('Error fetching pending approval count:', error)
    return 0
  }
}

// ========== RELATIONSHIP FUNCTIONS ==========

export async function getProductCompanies(): Promise<any[]> {
  try {
    return await fetchAPI<any[]>(`/relationships?type=productCompany`)
  } catch (error) {
    console.error('Error fetching product-company relationships:', error)
    return []
  }
}

export async function getProductVendors(): Promise<any[]> {
  try {
    return await fetchAPI<any[]>(`/relationships?type=productVendor`)
  } catch (error) {
    console.error('Error fetching product-vendor relationships:', error)
    return []
  }
}

export async function getVendorCompanies(): Promise<any[]> {
  try {
    return await fetchAPI<any[]>(`/relationships?type=vendorCompany`)
  } catch (error) {
    console.error('Error fetching vendor-company relationships:', error)
    return []
  }
}

// ========== CREATE/UPDATE RELATIONSHIP FUNCTIONS ==========

export async function createProductCompany(productId: string, companyId: string): Promise<void> {
  try {
    await fetchAPI(`/relationships`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'productCompany',
        productId,
        companyId,
      }),
    })
  } catch (error) {
    console.error('Error creating product-company relationship:', error)
    throw error
  }
}

export async function deleteProductCompany(productId: string, companyId: string): Promise<void> {
  try {
    await fetchAPI(`/relationships?type=productCompany&productId=${productId}&companyId=${companyId}`, {
      method: 'DELETE',
    })
  } catch (error) {
    console.error('Error deleting product-company relationship:', error)
    throw error
  }
}

export async function createProductVendor(productId: string, vendorId: string): Promise<void> {
  try {
    await fetchAPI(`/relationships`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'productVendor',
        productId,
        vendorId,
      }),
    })
  } catch (error) {
    console.error('Error creating product-vendor relationship:', error)
    throw error
  }
}

export async function deleteProductVendor(productId: string, vendorId: string): Promise<void> {
  try {
    await fetchAPI(`/relationships?type=productVendor&productId=${productId}&vendorId=${vendorId}`, {
      method: 'DELETE',
    })
  } catch (error) {
    console.error('Error deleting product-vendor relationship:', error)
    throw error
  }
}

// Vendor-company relationships are now automatically derived from ProductCompany + ProductVendor
// No explicit create/delete functions needed - relationships are derived dynamically

// ========== DESIGNATION PRODUCT ELIGIBILITY FUNCTIONS ==========

export async function getDesignationEligibilitiesByCompany(companyId: string): Promise<any[]> {
  try {
    const data = await fetchAPI<any[]>(`/designation-eligibility?companyId=${companyId}`)
    return data || []
  } catch (error) {
    console.error('Error fetching designation eligibilities by company:', error)
    return []
  }
}

export async function getDesignationEligibilityById(eligibilityId: string): Promise<any | null> {
  try {
    const data = await fetchAPI<any>(`/designation-eligibility?eligibilityId=${eligibilityId}`)
    return data
  } catch (error) {
    console.error('Error fetching designation eligibility by ID:', error)
    return null
  }
}

export async function getDesignationEligibilityByDesignation(companyId: string, designation: string): Promise<any | null> {
  try {
    const data = await fetchAPI<any>(`/designation-eligibility?companyId=${companyId}&designation=${encodeURIComponent(designation)}`)
    return data
  } catch (error) {
    console.error('Error fetching designation eligibility by designation:', error)
    return null
  }
}

export async function createDesignationEligibility(
  companyId: string,
  designation: string,
  allowedProductCategories: string[],
  itemEligibility?: {
    shirt?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    trouser?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    pant?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    shoe?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    blazer?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    jacket?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
  },
  gender?: 'male' | 'female' | 'unisex'
): Promise<any> {
  try {
    const data = await fetchAPI<any>(`/designation-eligibility`, {
      method: 'POST',
      body: JSON.stringify({
        companyId,
        designation,
        allowedProductCategories,
        itemEligibility,
        gender: gender || 'all',
      }),
    })
    return data
  } catch (error) {
    console.error('Error creating designation eligibility:', error)
    throw error
  }
}

export async function updateDesignationEligibility(
  eligibilityId: string,
  designation?: string,
  allowedProductCategories?: string[],
  itemEligibility?: {
    shirt?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    trouser?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    pant?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    shoe?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    blazer?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    jacket?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
  },
  gender?: 'male' | 'female' | 'unisex',
  status?: 'active' | 'inactive',
  refreshEligibility?: boolean
): Promise<any> {
  try {
    const body: any = { eligibilityId }
    if (designation !== undefined) body.designation = designation
    if (allowedProductCategories !== undefined) body.allowedProductCategories = allowedProductCategories
    if (itemEligibility !== undefined) body.itemEligibility = itemEligibility
    if (gender !== undefined) body.gender = gender
    if (status !== undefined) body.status = status
    if (refreshEligibility !== undefined) body.refreshEligibility = refreshEligibility
    
    const data = await fetchAPI<any>(`/designation-eligibility`, {
      method: 'PUT',
      body: JSON.stringify(body),
    })
    return data
  } catch (error) {
    console.error('Error updating designation eligibility:', error)
    throw error
  }
}

export async function deleteDesignationEligibility(eligibilityId: string): Promise<void> {
  try {
    await fetchAPI<void>(`/designation-eligibility?eligibilityId=${eligibilityId}`, {
      method: 'DELETE',
    })
  } catch (error) {
    console.error('Error deleting designation eligibility:', error)
    throw error
  }
}

export async function getProductsForDesignation(companyId: string, designation: string): Promise<any[]> {
  try {
    const data = await fetchAPI<any[]>(`/products?companyId=${companyId}&designation=${encodeURIComponent(designation)}`)
    return data || []
  } catch (error) {
    console.error('Error fetching products for designation:', error)
    return []
  }
}

export async function getUniqueDesignationsByCompany(companyId: string): Promise<string[]> {
  try {
    const data = await fetchAPI<string[]>(`/designations?companyId=${companyId}`)
    return data || []
  } catch (error) {
    console.error('Error fetching unique designations by company:', error)
    return []
  }
}

// For backward compatibility, export mock data arrays as empty (they'll be loaded from MongoDB)
export const mockUniforms: any[] = []
export const mockVendors: any[] = []
export const mockCompanies: any[] = []
export const mockEmployees: any[] = []
export const mockOrders: any[] = []
export const mockProductCompanies: any[] = []
export const mockProductVendors: any[] = []
export const mockVendorCompanies: any[] = []

