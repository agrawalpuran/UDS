/**
 * MongoDB Data Access Layer
 * This file contains all database query functions
 */

import connectDB from './mongodb'
import Uniform, { IUniform } from '../models/Uniform'
import Vendor, { IVendor } from '../models/Vendor'
import Company, { ICompany } from '../models/Company'
import Employee, { IEmployee } from '../models/Employee'
import Order, { IOrder } from '../models/Order'
import CompanyAdmin from '../models/CompanyAdmin'
import { ProductCompany, ProductVendor, VendorCompany } from '../models/Relationship'
import mongoose from 'mongoose'
import { getCurrentCycleDates, isDateInCurrentCycle } from '../utils/eligibility-cycles'

// Helper to convert MongoDB document to plain object
function toPlainObject(doc: any): any {
  if (!doc) return null
  if (Array.isArray(doc)) {
    return doc.map((d) => toPlainObject(d))
  }
  const obj = doc.toObject ? doc.toObject() : doc
  // Convert ObjectId to string for id fields, but preserve existing id field if it exists
  if (obj._id) {
    // Only set id from _id if id doesn't already exist (preserve the actual id field)
    if (!obj.id) {
      obj.id = obj._id.toString()
    }
    delete obj._id
  }
  // Convert ObjectIds in arrays to strings
  if (obj.companyIds && Array.isArray(obj.companyIds)) {
    obj.companyIds = obj.companyIds.map((id: any) => {
      if (id && typeof id === 'object' && id.id) {
        return id.id // If populated, use the id field
      }
      return id.toString()
    })
  }
  if (obj.vendorId) {
    if (obj.vendorId && typeof obj.vendorId === 'object' && obj.vendorId.id) {
      obj.vendorId = obj.vendorId.id // If populated, use the id field
    } else {
      obj.vendorId = obj.vendorId.toString()
    }
  }
  if (obj.companyId) {
    // Handle populated companyId (object with id and name) or ObjectId
    if (obj.companyId && typeof obj.companyId === 'object') {
      if (obj.companyId.id) {
        // Populated object - use the id field (this is the company's string 'id' field)
        obj.companyId = obj.companyId.id
      } else if (obj.companyId._id) {
        // Populated object with _id - try to get the company's string 'id' field
        // If not available, use _id as fallback
        obj.companyId = obj.companyId.id || obj.companyId._id.toString()
      } else if (obj.companyId.toString) {
        // ObjectId - need to find the company to get its string 'id' field
        // For now, convert to string and we'll handle it in the calling code
        obj.companyId = obj.companyId.toString()
      }
    } else {
      // Already a string - keep it as is
      obj.companyId = obj.companyId
    }
  }
  if (obj.employeeId) {
    if (obj.employeeId && typeof obj.employeeId === 'object' && obj.employeeId.id) {
      obj.employeeId = obj.employeeId.id
    } else {
      obj.employeeId = obj.employeeId.toString()
    }
  }
  if (obj.items && Array.isArray(obj.items)) {
    obj.items = obj.items.map((item: any) => ({
      ...item,
      uniformId: item.uniformId?.toString() || (item.uniformId?.id || item.uniformId),
      // Ensure price and quantity are preserved as numbers
      price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
      quantity: typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0,
    }))
  }
  // Ensure total is preserved as a number
  if (obj.total !== undefined) {
    obj.total = typeof obj.total === 'number' ? obj.total : parseFloat(obj.total) || 0
  }
  return obj
}

// ========== UNIFORM/PRODUCT FUNCTIONS ==========

export async function getProductsByCompany(companyId: string): Promise<any[]> {
  await connectDB()
  
  if (!companyId) {
    console.warn('getProductsByCompany: companyId is empty or undefined')
    return []
  }
  
  // Find company by string ID first
  let company = await Company.findOne({ id: companyId })
  
  // If not found by string ID, try finding by ObjectId (in case companyId is an ObjectId string)
  if (!company && mongoose.Types.ObjectId.isValid(companyId)) {
    company = await Company.findById(companyId)
    if (company) {
      console.log(`getProductsByCompany: Found company by ObjectId, using company.id: ${company.id}`)
      companyId = company.id // Use the string id for the rest of the function
    }
  }
  
  if (!company) {
    console.warn(`getProductsByCompany: Company not found for companyId: ${companyId}`)
    return []
  }

  // Only get products directly linked via ProductCompany relationship
  // Do NOT include products from vendors - only direct company-product links
  const productCompanyLinks = await ProductCompany.find({ companyId: company._id })
    .populate('productId')
    .lean()
  
  const productIds = productCompanyLinks
    .map((link: any) => link.productId?._id)
    .filter((id: any) => id !== null && id !== undefined)

  if (productIds.length === 0) {
    console.log(`No products directly linked to company ${companyId}`)
    return []
  }

  // Fetch products that are directly linked to this company
  const products = await Uniform.find({
    _id: { $in: productIds },
  })
    .populate('vendorId', 'id name')
    .lean()

  console.log(`getProductsByCompany(${companyId}): Found ${products.length} directly linked products`)
  
  return products.map((p: any) => toPlainObject(p))
}

export async function getProductsByVendor(vendorId: string): Promise<any[]> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  if (!vendor) return []

  const products = await Uniform.find({ vendorId: vendor._id })
    .populate('vendorId', 'id name')
    .lean()

  return products.map((p: any) => toPlainObject(p))
}

export async function getAllProducts(): Promise<any[]> {
  await connectDB()
  
  const products = await Uniform.find()
    .populate('vendorId', 'id name')
    .lean()

  return products.map((p: any) => toPlainObject(p))
}

export async function getProductById(productId: string): Promise<any | null> {
  await connectDB()
  
  const product = await Uniform.findOne({ id: productId })
    .populate('vendorId', 'id name')
    .lean()

  return product ? toPlainObject(product) : null
}

// ========== VENDOR FUNCTIONS ==========

export async function getAllVendors(): Promise<any[]> {
  await connectDB()
  
  const vendors = await Vendor.find().lean()
  return vendors.map((v: any) => toPlainObject(v))
}

export async function getVendorById(vendorId: string): Promise<any | null> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId }).lean()
  return vendor ? toPlainObject(vendor) : null
}

// ========== COMPANY FUNCTIONS ==========

export async function getAllCompanies(): Promise<any[]> {
  await connectDB()
  
  const companies = await Company.find()
    .populate('adminId', 'id employeeId firstName lastName email')
    .lean()
  return companies.map((c: any) => toPlainObject(c))
}

export async function getCompanyById(companyId: string): Promise<any | null> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
    .populate('adminId', 'id employeeId firstName lastName email')
    .lean()
  return company ? toPlainObject(company) : null
}

// ========== COMPANY ADMIN FUNCTIONS (Multiple Admins) ==========

export async function addCompanyAdmin(companyId: string, employeeId: string, canApproveOrders: boolean = false): Promise<void> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }
  
  const employee = await Employee.findOne({ id: employeeId }).populate('companyId')
  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`)
  }
  
  // Verify employee belongs to this company
  let employeeCompanyId: mongoose.Types.ObjectId
  if (typeof employee.companyId === 'object' && employee.companyId !== null) {
    employeeCompanyId = employee.companyId._id || employee.companyId
  } else {
    employeeCompanyId = employee.companyId as mongoose.Types.ObjectId
  }
  
  if (!employeeCompanyId.equals(company._id)) {
    throw new Error(`Employee ${employeeId} does not belong to company ${companyId}`)
  }
  
  // Create or update company admin record
  await CompanyAdmin.findOneAndUpdate(
    { companyId: company._id, employeeId: employee._id },
    { canApproveOrders },
    { upsert: true, new: true }
  )
  
  console.log(`Successfully added employee ${employeeId} as admin for company ${companyId} (canApproveOrders: ${canApproveOrders})`)
}

export async function removeCompanyAdmin(companyId: string, employeeId: string): Promise<void> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }
  
  const employee = await Employee.findOne({ id: employeeId })
  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`)
  }
  
  await CompanyAdmin.findOneAndDelete({
    companyId: company._id,
    employeeId: employee._id,
  })
  
  console.log(`Successfully removed admin ${employeeId} from company ${companyId}`)
}

export async function updateCompanyAdminPrivileges(companyId: string, employeeId: string, canApproveOrders: boolean): Promise<void> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }
  
  const employee = await Employee.findOne({ id: employeeId })
  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`)
  }
  
  const admin = await CompanyAdmin.findOne({
    companyId: company._id,
    employeeId: employee._id,
  })
  
  if (!admin) {
    throw new Error(`Employee ${employeeId} is not an admin of company ${companyId}`)
  }
  
  admin.canApproveOrders = canApproveOrders
  await admin.save()
  
  console.log(`Successfully updated admin privileges for ${employeeId} in company ${companyId}`)
}

export async function getCompanyAdmins(companyId: string): Promise<any[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    return []
  }
  
  const admins = await CompanyAdmin.find({ companyId: company._id })
    .populate('employeeId', 'id employeeId firstName lastName email')
    .lean()
  
  return admins.map((admin: any) => ({
    employeeId: admin.employeeId?.id || admin.employeeId?.toString(),
    employee: admin.employeeId ? toPlainObject(admin.employeeId) : null,
    canApproveOrders: admin.canApproveOrders,
  }))
}

export async function isCompanyAdmin(email: string, companyId: string): Promise<boolean> {
  await connectDB()
  
  const employee = await Employee.findOne({ email: email })
  if (!employee) {
    return false
  }
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    return false
  }
  
  const admin = await CompanyAdmin.findOne({
    companyId: company._id,
    employeeId: employee._id,
  })
  
  return !!admin
}

export async function canApproveOrders(email: string, companyId: string): Promise<boolean> {
  await connectDB()
  
  const employee = await Employee.findOne({ email: email })
  if (!employee) {
    return false
  }
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    return false
  }
  
  const admin = await CompanyAdmin.findOne({
    companyId: company._id,
    employeeId: employee._id,
  })
  
  return admin?.canApproveOrders || false
}

export async function getCompanyByAdminEmail(email: string): Promise<any | null> {
  await connectDB()
  
  const employee = await Employee.findOne({ email: email })
  if (!employee) {
    return null
  }
  
  // Find company where this employee is an admin
  const admin = await CompanyAdmin.findOne({ employeeId: employee._id })
    .populate('companyId')
    .lean()
  
  if (!admin || !(admin as any).companyId) {
    return null
  }
  
  const companyId = typeof (admin as any).companyId === 'object' && (admin as any).companyId?._id
    ? (admin as any).companyId._id
    : (admin as any).companyId
  
  const company = await Company.findById(companyId)
    .lean()
  
  return company ? toPlainObject(company) : null
}

// Legacy function for backward compatibility (keeps old adminId field)
export async function setCompanyAdmin(companyId: string, employeeId: string): Promise<void> {
  // Use new multiple admin system
  await addCompanyAdmin(companyId, employeeId, false)
  
  // Also update legacy adminId field for backward compatibility
  const company = await Company.findOne({ id: companyId })
  if (company) {
    const employee = await Employee.findOne({ id: employeeId })
    if (employee) {
      company.adminId = employee._id
      await company.save()
    }
  }
}

// ========== EMPLOYEE FUNCTIONS ==========

export async function getAllEmployees(): Promise<any[]> {
  await connectDB()
  
  const employees = await Employee.find()
    .populate('companyId', 'id name')
    .lean()

  return employees.map((e: any) => toPlainObject(e))
}

export async function getEmployeeByEmail(email: string): Promise<any | null> {
  await connectDB()
  
  if (!email) {
    return null
  }
  
  // Trim whitespace and make case-insensitive search
  const trimmedEmail = email.trim()
  
  // Try exact match first
  let employee = await Employee.findOne({ email: trimmedEmail })
    .populate('companyId', 'id name')
    .lean()
  
  // If not found, try case-insensitive search
  if (!employee) {
    employee = await Employee.findOne({ 
      email: { $regex: new RegExp(`^${trimmedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
    })
      .populate('companyId', 'id name')
      .lean()
  }

  return employee ? toPlainObject(employee) : null
}

export async function getEmployeeById(employeeId: string): Promise<any | null> {
  await connectDB()
  
  const employee = await Employee.findOne({ id: employeeId })
    .populate('companyId', 'id name')
    .lean()
  
  return employee ? toPlainObject(employee) : null
}

export async function getEmployeeByEmployeeId(employeeId: string): Promise<any | null> {
  await connectDB()
  
  const employee = await Employee.findOne({ employeeId: employeeId })
    .populate('companyId', 'id name')
    .lean()
  
  return employee ? toPlainObject(employee) : null
}

export async function getEmployeesByCompany(companyId: string): Promise<any[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) return []

  const employees = await Employee.find({ companyId: company._id })
    .populate('companyId', 'id name')
    .lean()

  return employees.map((e: any) => toPlainObject(e))
}

// ========== ORDER FUNCTIONS ==========

export async function getAllOrders(): Promise<any[]> {
  await connectDB()
  
  const orders = await Order.find()
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .sort({ orderDate: -1 })
    .lean()

  return orders.map((o: any) => toPlainObject(o))
}

export async function getOrdersByCompany(companyId: string): Promise<any[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) return []

  const orders = await Order.find({ companyId: company._id })
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .sort({ orderDate: -1 })
    .lean()

  const transformedOrders = orders.map((o: any) => toPlainObject(o))
  
  // Debug logging
  if (transformedOrders.length > 0) {
    console.log(`getOrdersByCompany(${companyId}): Found ${transformedOrders.length} orders`)
    const firstOrder = transformedOrders[0]
    console.log('Sample order:', {
      id: firstOrder.id,
      total: firstOrder.total,
      itemsCount: firstOrder.items?.length,
      items: firstOrder.items?.map((i: any) => ({ price: i.price, quantity: i.quantity, total: i.price * i.quantity }))
    })
  }
  
  return transformedOrders
}

export async function getOrdersByEmployee(employeeId: string): Promise<any[]> {
  await connectDB()
  
  const employee = await Employee.findOne({ id: employeeId })
  if (!employee) return []

  const orders = await Order.find({ employeeId: employee._id })
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .sort({ orderDate: -1 })
    .lean()

  return orders.map((o: any) => toPlainObject(o))
}

export async function getConsumedEligibility(employeeId: string): Promise<{
  shirt: number
  pant: number
  shoe: number
  jacket: number
}> {
  await connectDB()
  
  const employee = await Employee.findOne({ id: employeeId })
  if (!employee) {
    return { shirt: 0, pant: 0, shoe: 0, jacket: 0 }
  }

  // Get employee's date of joining (default to Oct 1, 2025 if not set)
  const dateOfJoining = employee.dateOfJoining 
    ? new Date(employee.dateOfJoining) 
    : new Date('2025-10-01T00:00:00.000Z')

  // Get cycle durations for each item type (defaults if not set)
  const cycleDurations = employee.cycleDuration || {
    shirt: 6,
    pant: 6,
    shoe: 6,
    jacket: 12
  }

  // Get all orders that count towards consumed eligibility (all except cancelled)
  // We'll filter by item-specific cycles below
  const orders = await Order.find({
    employeeId: employee._id,
    status: { $in: ['Awaiting approval', 'Awaiting fulfilment', 'Dispatched', 'Delivered'] }
  })
    .populate('items.uniformId', 'id category')
    .lean()

  const consumed = { shirt: 0, pant: 0, shoe: 0, jacket: 0 }

  // Sum up quantities by category from orders in their respective current cycles
  for (const order of orders) {
    const orderDate = order.orderDate ? new Date(order.orderDate) : null
    if (!orderDate) {
      continue
    }

    for (const item of order.items || []) {
      const uniform = item.uniformId
      if (uniform && typeof uniform === 'object' && 'category' in uniform) {
        const category = uniform.category as string
        const quantity = item.quantity || 0
        
        // Check if order date is in current cycle for this specific item type
        let inCurrentCycle = false
        if (category === 'shirt') {
          inCurrentCycle = isDateInCurrentCycle(orderDate, 'shirt', dateOfJoining, cycleDurations.shirt)
          if (inCurrentCycle) {
            consumed.shirt += quantity
          }
        } else if (category === 'pant') {
          inCurrentCycle = isDateInCurrentCycle(orderDate, 'pant', dateOfJoining, cycleDurations.pant)
          if (inCurrentCycle) {
            consumed.pant += quantity
          }
        } else if (category === 'shoe') {
          inCurrentCycle = isDateInCurrentCycle(orderDate, 'shoe', dateOfJoining, cycleDurations.shoe)
          if (inCurrentCycle) {
            consumed.shoe += quantity
          }
        } else if (category === 'jacket') {
          inCurrentCycle = isDateInCurrentCycle(orderDate, 'jacket', dateOfJoining, cycleDurations.jacket)
          if (inCurrentCycle) {
            consumed.jacket += quantity
          }
        }
      }
    }
  }

  return consumed
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
  await connectDB()
  
  // Find employee and company
  const employee = await Employee.findOne({ id: orderData.employeeId })
  if (!employee) {
    throw new Error(`Employee not found: ${orderData.employeeId}`)
  }

  const companyId = typeof employee.companyId === 'object' && employee.companyId?._id
    ? employee.companyId._id
    : employee.companyId
  const company = await Company.findById(companyId)
  if (!company) {
    throw new Error(`Company not found for employee: ${orderData.employeeId}`)
  }

  // Get uniform ObjectIds for items
  const orderItems = await Promise.all(
    orderData.items.map(async (item) => {
      const uniform = await Uniform.findOne({ id: item.uniformId })
      if (!uniform) {
        throw new Error(`Uniform not found: ${item.uniformId}`)
      }
      // Use price from item if provided and > 0, otherwise use product price
      const itemPrice = (item.price && item.price > 0) ? item.price : (uniform.price || 0)
      return {
        uniformId: uniform._id,
        uniformName: item.uniformName,
        size: item.size,
        quantity: item.quantity,
        price: itemPrice,
      }
    })
  )

  // Calculate total
  const total = orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)

  // Generate order ID
  const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

  // Create order
  const order = await Order.create({
    id: orderId,
    employeeId: employee._id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    items: orderItems,
    total: total,
    status: 'Awaiting approval',
    orderDate: new Date(),
    dispatchLocation: orderData.dispatchLocation || employee.dispatchPreference || 'standard',
    companyId: company._id,
    deliveryAddress: orderData.deliveryAddress,
    estimatedDeliveryTime: orderData.estimatedDeliveryTime,
  })

  // Populate and return
  const populatedOrder = await Order.findById(order._id)
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .lean()

  return toPlainObject(populatedOrder)
}

export async function approveOrder(orderId: string, adminEmail: string): Promise<any> {
  await connectDB()
  
  const order = await Order.findOne({ id: orderId })
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }
  
  if (order.status !== 'Awaiting approval') {
    throw new Error(`Order ${orderId} is not in 'Awaiting approval' status`)
  }
  
  // Verify admin can approve orders
  // order.companyId is an ObjectId, so we find the company by _id
  const company = await Company.findById(order.companyId)
  if (!company) {
    throw new Error(`Company not found for order ${orderId}`)
  }
  
  // Use company.id (string) for canApproveOrders, not company._id (ObjectId)
  const employee = await Employee.findOne({ email: adminEmail })
  if (!employee) {
    throw new Error(`Employee not found: ${adminEmail}`)
  }
  
  const canApprove = await canApproveOrders(adminEmail, company.id)
  if (!canApprove) {
    throw new Error(`User ${adminEmail} does not have permission to approve orders`)
  }
  
  // Update order status
  order.status = 'Awaiting fulfilment'
  await order.save()
  
  // Populate and return
  const populatedOrder = await Order.findById(order._id)
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .lean()
  
  return toPlainObject(populatedOrder)
}

export async function updateOrderStatus(orderId: string, status: 'Awaiting approval' | 'Awaiting fulfilment' | 'Dispatched' | 'Delivered'): Promise<any> {
  await connectDB()
  
  const order = await Order.findOne({ id: orderId })
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }
  
  order.status = status
  await order.save()
  
  // Populate and return
  const populatedOrder = await Order.findById(order._id)
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .lean()
  
  return toPlainObject(populatedOrder)
}

export async function getPendingApprovals(companyId: string): Promise<any[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    return []
  }
  
  const orders = await Order.find({
    companyId: company._id,
    status: 'Awaiting approval',
  })
    .populate('employeeId', 'id employeeId firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .sort({ orderDate: -1 })
    .lean()
  
  return orders.map((o: any) => toPlainObject(o))
}

export async function getPendingApprovalCount(companyId: string): Promise<number> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    return 0
  }
  
  const count = await Order.countDocuments({
    companyId: company._id,
    status: 'Awaiting approval',
  })
  
  return count
}

// ========== RELATIONSHIP FUNCTIONS ==========

export async function getProductCompanies(): Promise<any[]> {
  await connectDB()
  
  const relationships = await ProductCompany.find()
    .populate('productId', 'id name')
    .populate('companyId', 'id name')
    .lean()

  return relationships.map((rel: any) => ({
    productId: rel.productId?.id || rel.productId?.toString(),
    companyId: rel.companyId?.id || rel.companyId?.toString(),
  }))
}

export async function getProductVendors(): Promise<any[]> {
  await connectDB()
  
  const relationships = await ProductVendor.find()
    .populate('productId', 'id name')
    .populate('vendorId', 'id name')
    .lean()

  return relationships.map((rel: any) => ({
    productId: rel.productId?.id || rel.productId?.toString(),
    vendorId: rel.vendorId?.id || rel.vendorId?.toString(),
  }))
}

export async function getVendorCompanies(): Promise<any[]> {
  await connectDB()
  
  const relationships = await VendorCompany.find()
    .populate('vendorId', 'id name')
    .populate('companyId', 'id name')
    .lean()

  return relationships.map((rel: any) => ({
    vendorId: rel.vendorId?.id || rel.vendorId?.toString(),
    companyId: rel.companyId?.id || rel.companyId?.toString(),
  }))
}

// ========== CREATE/UPDATE FUNCTIONS ==========

export async function createProductCompany(productId: string, companyId: string): Promise<void> {
  await connectDB()
  
  console.log('createProductCompany - Looking for productId:', productId, 'companyId:', companyId)
  
  const product = await Uniform.findOne({ id: productId })
  const company = await Company.findOne({ id: companyId })
  
  console.log('createProductCompany - Product found:', product ? product.id : 'NOT FOUND')
  console.log('createProductCompany - Company found:', company ? company.id : 'NOT FOUND')
  
  if (!product) {
    // List available product IDs for debugging
    const allProducts = await Uniform.find({}, 'id name').limit(5).lean()
    console.log('Available products (sample):', allProducts.map(p => p.id))
    throw new Error(`Product not found: ${productId}`)
  }
  
  if (!company) {
    // List available company IDs for debugging
    const allCompanies = await Company.find({}, 'id name').limit(5).lean()
    console.log('Available companies (sample):', allCompanies.map(c => c.id))
    throw new Error(`Company not found: ${companyId}`)
  }

  await ProductCompany.findOneAndUpdate(
    { productId: product._id, companyId: company._id },
    { productId: product._id, companyId: company._id },
    { upsert: true }
  )
  
  console.log('createProductCompany - Successfully created relationship')
}

export async function deleteProductCompany(productId: string, companyId: string): Promise<void> {
  await connectDB()
  
  const product = await Uniform.findOne({ id: productId })
  const company = await Company.findOne({ id: companyId })
  
  if (!product || !company) return

  await ProductCompany.deleteOne({ productId: product._id, companyId: company._id })
}

export async function createProductVendor(productId: string, vendorId: string): Promise<void> {
  await connectDB()
  
  const product = await Uniform.findOne({ id: productId })
  const vendor = await Vendor.findOne({ id: vendorId })
  
  if (!product || !vendor) {
    throw new Error('Product or Vendor not found')
  }

  await ProductVendor.findOneAndUpdate(
    { productId: product._id, vendorId: vendor._id },
    { productId: product._id, vendorId: vendor._id },
    { upsert: true }
  )
}

export async function deleteProductVendor(productId: string, vendorId: string): Promise<void> {
  await connectDB()
  
  const product = await Uniform.findOne({ id: productId })
  const vendor = await Vendor.findOne({ id: vendorId })
  
  if (!product || !vendor) return

  await ProductVendor.deleteOne({ productId: product._id, vendorId: vendor._id })
}

export async function createVendorCompany(vendorId: string, companyId: string): Promise<void> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  const company = await Company.findOne({ id: companyId })
  
  if (!vendor || !company) {
    throw new Error('Vendor or Company not found')
  }

  await VendorCompany.findOneAndUpdate(
    { vendorId: vendor._id, companyId: company._id },
    { vendorId: vendor._id, companyId: company._id },
    { upsert: true }
  )
}

export async function deleteVendorCompany(vendorId: string, companyId: string): Promise<void> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  const company = await Company.findOne({ id: companyId })
  
  if (!vendor || !company) return

  await VendorCompany.deleteOne({ vendorId: vendor._id, companyId: company._id })
}

