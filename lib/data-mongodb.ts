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
  VendorCompany,
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

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `API Error: ${response.status} ${response.statusText}`
      try {
        const errorJson = JSON.parse(errorText)
        errorMessage = errorJson.error || errorMessage
      } catch {
        errorMessage = errorText || errorMessage
      }
      throw new Error(errorMessage)
    }

    // Handle 404 (null response)
    if (response.status === 404) {
      return null as T
    }

    const data = await response.json()
    return data
  } catch (error: any) {
    console.error(`fetchAPI error for ${endpoint}:`, error)
    throw error
  }
}

// ========== PRODUCT FUNCTIONS ==========

export async function getProductsByCompany(companyId: string): Promise<any[]> {
  if (!companyId) return []
  try {
    return await fetchAPI<any[]>(`/products?companyId=${companyId}`)
  } catch (error) {
    console.error('Error fetching products by company:', error)
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
  if (!companyId) return []
  try {
    return await fetchAPI<any[]>(`/employees?companyId=${companyId}`)
  } catch (error) {
    console.error('Error fetching employees by company:', error)
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
    return await fetchAPI<any>('/orders', {
      method: 'POST',
      body: JSON.stringify(orderData),
    })
  } catch (error) {
    console.error('Error creating order:', error)
    throw error
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

export async function createVendorCompany(vendorId: string, companyId: string): Promise<void> {
  try {
    await fetchAPI(`/relationships`, {
      method: 'POST',
      body: JSON.stringify({
        type: 'vendorCompany',
        vendorId,
        companyId,
      }),
    })
  } catch (error) {
    console.error('Error creating vendor-company relationship:', error)
    throw error
  }
}

export async function deleteVendorCompany(vendorId: string, companyId: string): Promise<void> {
  try {
    await fetchAPI(`/relationships?type=vendorCompany&vendorId=${vendorId}&companyId=${companyId}`, {
      method: 'DELETE',
    })
  } catch (error) {
    console.error('Error deleting vendor-company relationship:', error)
    throw error
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

