/**
 * MongoDB Data Access Layer
 * This file contains all database query functions
 */

import connectDB from './mongodb'
import mongoose from 'mongoose'
// Import Branch first to ensure it's registered before Employee uses it
import Branch from '../models/Branch'
import Uniform, { IUniform } from '../models/Uniform'
import Vendor, { IVendor } from '../models/Vendor'
import Company, { ICompany } from '../models/Company'
import Employee, { IEmployee } from '../models/Employee'
import Order, { IOrder } from '../models/Order'
import CompanyAdmin from '../models/CompanyAdmin'
import Location from '../models/Location'
import LocationAdmin from '../models/LocationAdmin'
import { ProductCompany, ProductVendor } from '../models/Relationship'
// VendorCompany relationships are now derived from ProductCompany + ProductVendor
// No need to import VendorCompany model
import DesignationProductEligibility from '../models/DesignationProductEligibility'
import VendorInventory from '../models/VendorInventory'
import ProductFeedback from '../models/ProductFeedback'
import ReturnRequest from '../models/ReturnRequest'
import ProductSizeChart from '../models/ProductSizeChart'
import { getCurrentCycleDates, isDateInCurrentCycle } from '../utils/eligibility-cycles'

// Ensure Branch model is registered
if (!mongoose.models.Branch) {
  require('../models/Branch')
}

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
  // vendorId removed from Uniform model - use ProductVendor collection instead
  // branchId and branchName removed - use locationId instead
  // Handle companyId - if it's null, don't process it (will be fixed in getEmployeeByEmail)
  // If it exists, convert it properly
  if (obj.companyId !== null && obj.companyId !== undefined) {
    // Handle populated companyId (object with id and name) or ObjectId
    if (obj.companyId && typeof obj.companyId === 'object') {
      if (obj.companyId.id) {
        // Populated object - use the id field (this is the company's string 'id' field like 'COMP-INDIGO')
        obj.companyId = obj.companyId.id
      } else if (obj.companyId._id) {
        // Populated object with _id but no id field - this shouldn't happen if populate worked correctly
        // Keep as _id string for now, will be converted in getEmployeeByEmail
        obj.companyId = obj.companyId._id.toString()
      } else if (obj.companyId.toString) {
        // ObjectId - convert to string, will be converted to company string ID in getEmployeeByEmail
        obj.companyId = obj.companyId.toString()
      }
    } else if (typeof obj.companyId === 'string') {
      // Already a string - check if it's an ObjectId string (24 hex chars) or company string ID
      // If it's an ObjectId string, it will be converted in getEmployeeByEmail
      // If it's already a company string ID (like 'COMP-INDIGO'), keep it
      obj.companyId = obj.companyId
    }
  }
  // Note: If companyId is null, we leave it as null - getEmployeeByEmail will fix it from raw document
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
      productId: item.productId || item.uniformId?.id || item.uniformId?.toString(), // Ensure productId is included
      // Ensure price and quantity are preserved as numbers
      price: typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0,
      quantity: typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0,
    }))
  }
  // Ensure numeric IDs are included in order objects
  if (obj.employeeIdNum !== undefined) {
    obj.employeeIdNum = obj.employeeIdNum
  }
  if (obj.companyIdNum !== undefined) {
    obj.companyIdNum = typeof obj.companyIdNum === 'number' ? obj.companyIdNum : Number(obj.companyIdNum) || obj.companyIdNum
  }
  // Ensure total is preserved as a number
  if (obj.total !== undefined) {
    obj.total = typeof obj.total === 'number' ? obj.total : parseFloat(obj.total) || 0
  }
  // Explicitly preserve attribute fields (they should be preserved by default, but ensure they're included)
  // Attributes are optional fields, so preserve them if they exist
  if ('attribute1_name' in obj) obj.attribute1_name = obj.attribute1_name
  if ('attribute1_value' in obj) obj.attribute1_value = obj.attribute1_value
  if ('attribute2_name' in obj) obj.attribute2_name = obj.attribute2_name
  if ('attribute2_value' in obj) obj.attribute2_value = obj.attribute2_value
  if ('attribute3_name' in obj) obj.attribute3_name = obj.attribute3_name
  if ('attribute3_value' in obj) obj.attribute3_value = obj.attribute3_value
  // Explicitly preserve company settings boolean fields (ensure they're always included, even if false)
  // For company objects, always include these fields with defaults if missing
  if (obj.id && typeof obj.id === 'string' && /^\d{6}$/.test(obj.id)) {
    // This is a company object (has 6-digit numeric ID)
    // Always include boolean settings fields, defaulting to false if not present
    // BUT: Only default if the field truly doesn't exist (use 'in' operator, not !== undefined)
    // This is critical because a field can be explicitly set to false, which is different from undefined
    if (!('showPrices' in obj)) obj.showPrices = false
    if (!('allowPersonalPayments' in obj)) obj.allowPersonalPayments = false
    if (!('allowPersonalAddressDelivery' in obj)) obj.allowPersonalAddressDelivery = false
    // CRITICAL: Only default enableEmployeeOrder if it doesn't exist in the object
    // If it exists (even as false), preserve the actual value
    if (!('enableEmployeeOrder' in obj)) {
      obj.enableEmployeeOrder = false
    } else {
      // Field exists - ensure it's a boolean
      obj.enableEmployeeOrder = Boolean(obj.enableEmployeeOrder)
    }
  } else {
    // For other objects, preserve if they exist
    if ('showPrices' in obj) obj.showPrices = obj.showPrices
    if ('allowPersonalPayments' in obj) obj.allowPersonalPayments = obj.allowPersonalPayments
    if ('allowPersonalAddressDelivery' in obj) obj.allowPersonalAddressDelivery = obj.allowPersonalAddressDelivery
    if ('enableEmployeeOrder' in obj) obj.enableEmployeeOrder = Boolean(obj.enableEmployeeOrder)
  }
  return obj
}

// ========== UNIFORM/PRODUCT FUNCTIONS ==========

export async function getProductsByCompany(companyId: string | number): Promise<any[]> {
  await connectDB()
  
  if (!companyId && companyId !== 0) {
    console.warn('getProductsByCompany: companyId is empty or undefined')
    return []
  }
  
  // Convert companyId to number if it's a string representation of a number
  let numericCompanyId: number | null = null
  if (typeof companyId === 'string') {
    // Try to parse as number
    const parsed = Number(companyId)
    if (!isNaN(parsed) && isFinite(parsed)) {
      numericCompanyId = parsed
    }
  } else if (typeof companyId === 'number') {
    numericCompanyId = companyId
  }
  
  // Find company by numeric ID first (since company.id is now numeric)
  let company = null
  if (numericCompanyId !== null) {
    company = await Company.findOne({ id: numericCompanyId })
    if (company) {
      console.log(`getProductsByCompany: Found company by numeric ID: ${numericCompanyId} (${company.name})`)
    }
  }
  
  // If not found by numeric ID, try finding by ObjectId (in case companyId is an ObjectId string)
  if (!company && typeof companyId === 'string' && mongoose.Types.ObjectId.isValid(companyId)) {
    company = await Company.findById(companyId)
    if (company) {
      console.log(`getProductsByCompany: Found company by ObjectId, using company.id: ${company.id}`)
      numericCompanyId = company.id // Use the numeric id for the rest of the function
    }
  }
  
  // If still not found, try as string ID (for backward compatibility)
  if (!company && typeof companyId === 'string') {
    company = await Company.findOne({ id: companyId })
    if (company) {
      console.log(`getProductsByCompany: Found company by string ID: ${companyId} (${company.name})`)
      numericCompanyId = company.id
    }
  }
  
  if (!company) {
    console.warn(`getProductsByCompany: Company not found for companyId: ${companyId} (type: ${typeof companyId})`)
    // List available companies for debugging
    const allCompanies = await Company.find({}, 'id name').limit(5).lean()
    console.warn(`getProductsByCompany: Available companies:`, allCompanies.map((c: any) => `${c.id} (${c.name})`))
    return []
  }

  // Only get products directly linked via ProductCompany relationship
  // Use raw MongoDB collection for reliable ObjectId comparison
  const db = mongoose.connection.db
  if (!db) {
    console.warn('getProductsByCompany: Database connection not available')
    return []
  }
  
  const companyIdStr = company._id.toString()
  const allProductCompanyLinks = await db.collection('productcompanies').find({}).toArray()
  
  // Filter by string comparison for reliable ObjectId matching
  const productCompanyLinks = allProductCompanyLinks.filter((link: any) => {
    if (!link.companyId) return false
    const linkCompanyIdStr = link.companyId.toString ? link.companyId.toString() : String(link.companyId)
    return linkCompanyIdStr === companyIdStr
  })
  
  console.log(`getProductsByCompany: Found ${productCompanyLinks.length} ProductCompany relationships for company ${companyId} (${company.name || 'Unknown'})`)
  
  if (productCompanyLinks.length === 0) {
    console.warn(`getProductsByCompany: No ProductCompany relationships found for company ${companyId} (${company.name || 'Unknown'})`)
    console.warn(`  - This means products are not linked to this company via ProductCompany relationships`)
    console.warn(`  - Total ProductCompany relationships in database: ${allProductCompanyLinks.length}`)
    if (allProductCompanyLinks.length > 0) {
      const sampleLinks = allProductCompanyLinks.slice(0, 3)
      console.warn(`  - Sample relationships:`, sampleLinks.map((l: any) => ({
        productId: l.productId?.toString?.() || l.productId,
        companyId: l.companyId?.toString?.() || l.companyId
      })))
    }
    return []
  }
  
  // Get product ObjectIds from the relationships (as strings for comparison)
  const productIdStrs = productCompanyLinks
    .map((link: any) => {
      if (!link.productId) return null
      return link.productId.toString ? link.productId.toString() : String(link.productId)
    })
    .filter((id: any) => id !== null && id !== undefined)
  
  if (productIdStrs.length === 0) {
    console.log(`No valid product IDs found in relationships for company ${companyId}`)
    return []
  }
  
  console.log(`getProductsByCompany: Looking for ${productIdStrs.length} products with IDs: ${productIdStrs.slice(0, 3).join(', ')}...`)

  // Fetch all products and filter by string comparison (most reliable)
  const allProducts = await db.collection('uniforms').find({}).toArray()
  const matchingProducts = allProducts.filter((p: any) => {
    const productIdStr = p._id.toString ? p._id.toString() : String(p._id)
    return productIdStrs.includes(productIdStr)
  })
  
  console.log(`getProductsByCompany: Found ${matchingProducts.length} products using string comparison`)
  
  if (matchingProducts.length === 0) {
    console.log(`getProductsByCompany: No products found. Sample product _ids: ${allProducts.slice(0, 3).map((p: any) => p._id.toString()).join(', ')}`)
    return []
  }
  
  // Convert to ObjectIds for Mongoose query
  const productObjectIds = matchingProducts.map((p: any) => {
    // Ensure we're using proper ObjectId
    if (p._id && typeof p._id === 'object' && p._id.toString) {
      return new mongoose.Types.ObjectId(p._id.toString())
    }
    return p._id
  })
  console.log(`getProductsByCompany: Querying ${productObjectIds.length} products by _id`)
  
  // Fetch products using Mongoose for proper population and decryption
  const products = await Uniform.find({
    _id: { $in: productObjectIds },
  })
    .populate('vendorId', 'id name')
    .lean()

  console.log(`getProductsByCompany(${companyId}): Mongoose query returned ${products.length} products`)
  
  // If Mongoose query returns 0, use raw collection data as fallback
  let productsToUse = products
  if (!products || products.length === 0) {
    console.warn(`getProductsByCompany: Mongoose query returned 0 products, using raw collection data as fallback`)
    // Use the raw products we found earlier
    // First, get all vendors for population
    const allVendors = await db.collection('vendors').find({}).toArray()
    const vendorMap = new Map()
    allVendors.forEach((v: any) => {
      vendorMap.set(v._id.toString(), { _id: v._id, id: v.id, name: v.name })
    })
    
    // Use the raw products we found earlier - preserve ALL fields including attributes
    productsToUse = matchingProducts.map((p: any) => {
      const product: any = { 
        ...p,
        // Explicitly preserve attribute fields
        attribute1_name: p.attribute1_name,
        attribute1_value: p.attribute1_value,
        attribute2_name: p.attribute2_name,
        attribute2_value: p.attribute2_value,
        attribute3_name: p.attribute3_name,
        attribute3_value: p.attribute3_value,
      }
      // Convert _id to proper format
      if (product._id) {
        product._id = new mongoose.Types.ObjectId(product._id.toString())
      }
      // vendorId removed from Uniform model - use ProductVendor collection instead
      return product
    })
  }
  
  // Filter products to only include those that have vendors linked for fulfillment
  // A product must have:
  // 1. A ProductVendor relationship (vendor supplies the product)
  // If product is linked to company and has vendors, it can be fulfilled
  
  if (productsToUse.length === 0) {
    return []
  }
  
  // Get all ProductVendor links for all products at once (using raw MongoDB)
  // Use the productIdStrs we already have from the ProductCompany relationships
  const allProductVendorLinks = await db.collection('productvendors').find({}).toArray()
  
  const productVendorLinks = allProductVendorLinks.filter((link: any) => {
    if (!link.productId) return false
    const linkProductIdStr = link.productId.toString ? link.productId.toString() : String(link.productId)
    return productIdStrs.includes(linkProductIdStr)
  })
  
  // Populate vendor details manually
  const allVendors = await db.collection('vendors').find({}).toArray()
  const vendorMap = new Map()
  allVendors.forEach((v: any) => {
    vendorMap.set(v._id.toString(), { id: v.id, name: v.name })
  })
  
  // Enhance links with vendor details
  const enhancedProductVendorLinks = productVendorLinks.map((link: any) => ({
    productId: link.productId,
    vendorId: {
      _id: link.vendorId,
      id: vendorMap.get(link.vendorId?.toString())?.id,
      name: vendorMap.get(link.vendorId?.toString())?.name
    }
  }))
  
  // Create a map of product ObjectId -> set of vendor ObjectIds that supply it
  const productVendorMap = new Map<string, Set<string>>()
  for (const pvLink of enhancedProductVendorLinks) {
    const productId = pvLink.productId?.toString()
    const vendorId = pvLink.vendorId?._id?.toString()
    
    if (productId && vendorId) {
      if (!productVendorMap.has(productId)) {
        productVendorMap.set(productId, new Set())
      }
      productVendorMap.get(productId)!.add(vendorId)
    }
  }
  
  // Filter products: only include those that have at least one vendor that supplies the product
  // Check if there are ANY vendors in the system at all (not just for these products)
  const hasAnyVendorsInSystem = allVendors.length > 0
  
  const productsWithVendors = productsToUse.filter((product: any) => {
    const productIdStr = product._id.toString()
    const vendorsForProduct = productVendorMap.get(productIdStr)
    
    // If no vendors exist in the system at all, show all products (for initial setup)
    if (!hasAnyVendorsInSystem) {
      console.log(`getProductsByCompany: No vendors in system, showing product ${product.id} (${product.name}) without vendor requirement`)
      return true
    }
    
    // If vendors exist in system, products MUST have vendors to be shown
    if (!vendorsForProduct || vendorsForProduct.size === 0) {
      console.log(`getProductsByCompany: Product ${product.id} (${product.name}) has no vendors linked - skipping (vendors exist in system)`)
      return false
    }
    
    // Product is linked to company and has vendors - it can be fulfilled
    return true
  })
  
  console.log(`getProductsByCompany(${companyId}): Filtered to ${productsWithVendors.length} products${hasAnyVendorsInSystem ? ' with vendors for fulfillment' : ' (no vendors in system, showing all)'}`)
  
  // Enhance products with all vendors that can fulfill them
  const enhancedProducts = productsWithVendors.map((product: any) => {
    const productIdStr = product._id.toString()
    const vendorsForProduct = productVendorMap.get(productIdStr) || new Set()
    
    // Get all vendors that supply this product
    const availableVendors: any[] = []
    for (const vendorIdStr of vendorsForProduct) {
      // Find vendor details from enhancedProductVendorLinks
      const pvLink = enhancedProductVendorLinks.find((link: any) => 
        link.productId?.toString() === productIdStr && 
        link.vendorId?._id?.toString() === vendorIdStr
      )
      if (pvLink && pvLink.vendorId) {
        availableVendors.push({
          id: pvLink.vendorId.id || pvLink.vendorId._id?.toString(),
          name: pvLink.vendorId.name || 'Unknown Vendor'
        })
      }
    }
    
    // Convert to plain object and add vendors array
    const plainProduct = toPlainObject(product)
    plainProduct.vendors = availableVendors
    // vendorId removed - use vendors array from ProductVendor collection instead
    // Explicitly preserve attribute fields (ensure they're included in response)
    if ((product as any).attribute1_name !== undefined) plainProduct.attribute1_name = (product as any).attribute1_name
    if ((product as any).attribute1_value !== undefined) plainProduct.attribute1_value = (product as any).attribute1_value
    if ((product as any).attribute2_name !== undefined) plainProduct.attribute2_name = (product as any).attribute2_name
    if ((product as any).attribute2_value !== undefined) plainProduct.attribute2_value = (product as any).attribute2_value
    if ((product as any).attribute3_name !== undefined) plainProduct.attribute3_name = (product as any).attribute3_name
    if ((product as any).attribute3_value !== undefined) plainProduct.attribute3_value = (product as any).attribute3_value
    
    return plainProduct
  })
  
  return enhancedProducts
}

// Get all products linked to a company (without vendor fulfillment filter)
// This is useful for category extraction and other purposes where we need all linked products
export async function getAllProductsByCompany(companyId: string | number): Promise<any[]> {
  await connectDB()
  
  if (!companyId && companyId !== 0) {
    console.warn('getAllProductsByCompany: companyId is empty or undefined')
    return []
  }
  
  // Convert companyId to number if it's a string representation of a number
  let numericCompanyId: number | null = null
  if (typeof companyId === 'string') {
    // Try to parse as number
    const parsed = Number(companyId)
    if (!isNaN(parsed) && isFinite(parsed)) {
      numericCompanyId = parsed
    }
  } else if (typeof companyId === 'number') {
    numericCompanyId = companyId
  }
  
  // Find company by numeric ID first (since company.id is now numeric)
  let company = null
  if (numericCompanyId !== null) {
    company = await Company.findOne({ id: numericCompanyId })
    if (company) {
      console.log(`getAllProductsByCompany: Found company by numeric ID: ${numericCompanyId} (${company.name})`)
    }
  }
  
  // If not found by numeric ID, try finding by ObjectId (in case companyId is an ObjectId string)
  if (!company && typeof companyId === 'string' && mongoose.Types.ObjectId.isValid(companyId)) {
    company = await Company.findById(companyId)
    if (company) {
      console.log(`getAllProductsByCompany: Found company by ObjectId, using company.id: ${company.id}`)
      numericCompanyId = company.id
    }
  }
  
  // If still not found, try as string ID (for backward compatibility)
  if (!company && typeof companyId === 'string') {
    company = await Company.findOne({ id: companyId })
    if (company) {
      console.log(`getAllProductsByCompany: Found company by string ID: ${companyId} (${company.name})`)
      numericCompanyId = company.id
    }
  }
  
  if (!company) {
    console.warn(`getAllProductsByCompany: Company not found for companyId: ${companyId} (type: ${typeof companyId})`)
    // List available companies for debugging
    const allCompanies = await Company.find({}, 'id name').limit(5).lean()
    console.warn(`getAllProductsByCompany: Available companies:`, allCompanies.map((c: any) => `${c.id} (${c.name})`))
    return []
  }

  // Get all products directly linked via ProductCompany relationship
  // Use raw MongoDB collection for reliable ObjectId comparison (same approach as getProductsByCompany)
  const db = mongoose.connection.db
  if (!db) {
    console.warn('getAllProductsByCompany: Database connection not available')
    return []
  }
  
  const companyIdStr = company._id.toString()
  const allProductCompanyLinks = await db.collection('productcompanies').find({}).toArray()
  
  // Filter by string comparison for reliable ObjectId matching
  const productCompanyLinks = allProductCompanyLinks.filter((link: any) => {
    if (!link.companyId) return false
    const linkCompanyIdStr = link.companyId.toString ? link.companyId.toString() : String(link.companyId)
    return linkCompanyIdStr === companyIdStr
  })
  
  console.log(`getAllProductsByCompany: Found ${productCompanyLinks.length} ProductCompany relationships for company ${companyId} (${company.name || 'Unknown'})`)
  
  if (productCompanyLinks.length === 0) {
    console.log(`getAllProductsByCompany: No products directly linked to company ${companyId}`)
    return []
  }
  
  // Get product ObjectIds from the relationships (as strings for comparison)
  const productIdStrs = productCompanyLinks
    .map((link: any) => {
      if (!link.productId) return null
      return link.productId.toString ? link.productId.toString() : String(link.productId)
    })
    .filter((id: any) => id !== null && id !== undefined)
  
  if (productIdStrs.length === 0) {
    console.log(`getAllProductsByCompany: No valid product IDs found in relationships for company ${companyId}`)
    return []
  }
  
  console.log(`getAllProductsByCompany: Looking for ${productIdStrs.length} products with IDs: ${productIdStrs.slice(0, 3).join(', ')}...`)

  // Fetch all products and filter by string comparison (most reliable)
  const allProducts = await db.collection('uniforms').find({}).toArray()
  const matchingProducts = allProducts.filter((p: any) => {
    const productIdStr = p._id.toString ? p._id.toString() : String(p._id)
    return productIdStrs.includes(productIdStr)
  })
  
  console.log(`getAllProductsByCompany: Found ${matchingProducts.length} products using string comparison`)
  
  if (matchingProducts.length === 0) {
    console.log(`getAllProductsByCompany: No products found. Sample product _ids: ${allProducts.slice(0, 3).map((p: any) => p._id.toString()).join(', ')}`)
    return []
  }
  
  // Convert to ObjectIds for Mongoose query
  const productObjectIds = matchingProducts.map((p: any) => {
    // Ensure we're using proper ObjectId
    if (p._id && typeof p._id === 'object' && p._id.toString) {
      return new mongoose.Types.ObjectId(p._id.toString())
    }
    return p._id
  })
  console.log(`getAllProductsByCompany: Querying ${productObjectIds.length} products by _id`)
  
  // Fetch products using Mongoose for proper population and decryption
  const products = await Uniform.find({
    _id: { $in: productObjectIds },
  })
    .populate('vendorId', 'id name')
    .lean()

  console.log(`getAllProductsByCompany(${companyId}): Mongoose query returned ${products.length} products (all, without vendor filter)`)
  
  // If Mongoose query returns 0, use raw collection data as fallback
  let productsToUse = products
  if (!products || products.length === 0) {
    console.warn(`getAllProductsByCompany: Mongoose query returned 0 products, using raw collection data as fallback`)
    // Use the raw products we found earlier
    // First, get all vendors for population
    const allVendors = await db.collection('vendors').find({}).toArray()
    const vendorMap = new Map()
    allVendors.forEach((v: any) => {
      vendorMap.set(v._id.toString(), { _id: v._id, id: v.id, name: v.name })
    })
    
    // Use the raw products we found earlier - preserve ALL fields including attributes
    productsToUse = matchingProducts.map((p: any) => {
      const product: any = { 
        ...p,
        // Explicitly preserve attribute fields
        attribute1_name: p.attribute1_name,
        attribute1_value: p.attribute1_value,
        attribute2_name: p.attribute2_name,
        attribute2_value: p.attribute2_value,
        attribute3_name: p.attribute3_name,
        attribute3_value: p.attribute3_value,
      }
      // Convert _id to proper format
      if (product._id) {
        product._id = new mongoose.Types.ObjectId(product._id.toString())
      }
      // vendorId removed from Uniform model - use ProductVendor collection instead
      return product
    })
  }
  
  // Convert to plain objects and ensure attributes are preserved
  return productsToUse.map((p: any) => {
    const plain = toPlainObject(p)
    // Explicitly preserve attribute fields
    if (p.attribute1_name !== undefined) plain.attribute1_name = p.attribute1_name
    if (p.attribute1_value !== undefined) plain.attribute1_value = p.attribute1_value
    if (p.attribute2_name !== undefined) plain.attribute2_name = p.attribute2_name
    if (p.attribute2_value !== undefined) plain.attribute2_value = p.attribute2_value
    if (p.attribute3_name !== undefined) plain.attribute3_name = p.attribute3_name
    if (p.attribute3_value !== undefined) plain.attribute3_value = p.attribute3_value
    return plain
  })
}

/**
 * PERMANENT FIX: Centralized vendor resolution + resilient product fetching
 * 
 * This function now:
 * 1. Uses centralized vendor resolution (single source of truth)
 * 2. Falls back to inventory records if ProductVendor relationships don't exist
 * 3. Includes comprehensive logging for future debugging
 * 4. Fails fast with clear errors if vendor cannot be resolved
 */
export async function getProductsByVendor(vendorId: string): Promise<any[]> {
  await connectDB()
  
  // 🔍 LOG: Service boundary
  console.log(`[getProductsByVendor] START - vendorId: "${vendorId}" (type: ${typeof vendorId})`)
  
  // STEP 1: Resolve vendor using centralized resolver (SINGLE SOURCE OF TRUTH)
  let vendorResolution: { vendorId: string; vendorObjectId: mongoose.Types.ObjectId; vendorName: string }
  try {
    const { resolveVendorId } = await import('../utils/vendor-resolution')
    const resolution = await resolveVendorId(vendorId)
    vendorResolution = {
      vendorId: resolution.vendorId,
      vendorObjectId: resolution.vendorObjectId,
      vendorName: resolution.vendorName
    }
    console.log(`[getProductsByVendor] ✅ Vendor resolved: ${vendorResolution.vendorName} (${vendorResolution.vendorId})`)
  } catch (error: any) {
    console.error(`[getProductsByVendor] ❌ Vendor resolution failed:`, error.message)
    throw new Error(`Failed to resolve vendor: ${error.message}`)
  }
  
  const { vendorObjectId, vendorName } = vendorResolution
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('Database connection not available')
  }

  // STEP 2: Try to get products from ProductVendor relationships (primary method)
  console.log(`[getProductsByVendor] Querying ProductVendor relationships for vendor: ${vendorName} (${vendorId})`)
  const productVendorLinks = await db.collection('productvendors').find({ 
    vendorId: vendorObjectId 
  }).toArray()

  console.log(`[getProductsByVendor] ProductVendor relationships found: ${productVendorLinks.length}`)

  let productIds: mongoose.Types.ObjectId[] = []

  if (productVendorLinks.length > 0) {
    // Primary method: Extract product IDs from ProductVendor relationships
    console.log(`[getProductsByVendor] Using ProductVendor relationships (primary method)`)
    
    productIds = productVendorLinks
      .map((link: any, index: number) => {
        const productId = link.productId
        if (!productId) {
          console.warn(`[getProductsByVendor] ⚠️ Link ${index} has no productId`)
          return null
        }
        
        if (productId instanceof mongoose.Types.ObjectId) {
          return productId
        }
        if (mongoose.Types.ObjectId.isValid(productId)) {
          return new mongoose.Types.ObjectId(productId)
        }
        
        console.warn(`[getProductsByVendor] ⚠️ Link ${index} has invalid productId`)
        return null
      })
      .filter((id: any) => id !== null) as mongoose.Types.ObjectId[]
    
    console.log(`[getProductsByVendor] Extracted ${productIds.length} product IDs from ProductVendor relationships`)
  } else {
    // FALLBACK METHOD 1: Derive products from inventory records (PERMANENT FIX)
    console.log(`[getProductsByVendor] ⚠️ No ProductVendor relationships found. Using FALLBACK: deriving products from inventory records...`)
    
    const inventoryRecords = await VendorInventory.find({ vendorId: vendorObjectId })
      .select('productId')
    .lean()

    console.log(`[getProductsByVendor] Found ${inventoryRecords.length} inventory records for vendor ${vendorName}`)
    
    if (inventoryRecords.length > 0) {
      const inventoryProductIds = inventoryRecords
        .map((inv: any) => {
          const productId = inv.productId
          if (!productId) return null
          
          if (productId instanceof mongoose.Types.ObjectId) {
            return productId
          }
          if (mongoose.Types.ObjectId.isValid(productId)) {
            return new mongoose.Types.ObjectId(productId)
          }
          return null
        })
        .filter((id: any) => id !== null) as mongoose.Types.ObjectId[]
      
      productIds = inventoryProductIds
      console.log(`[getProductsByVendor] ✅ Derived ${productIds.length} product IDs from inventory records`)
    } else {
      // FALLBACK METHOD 2: Find products from orders
      console.log(`[getProductsByVendor] No inventory records found. Using FALLBACK 2: checking orders...`)
      const ordersWithVendor = await Order.find({ vendorId: vendorObjectId })
        .select('items')
        .lean()
      
      console.log(`[getProductsByVendor] Found ${ordersWithVendor.length} orders for vendor ${vendorName}`)
      
      const productIdSet = new Set<string>()
      ordersWithVendor.forEach((order: any) => {
        if (order.items && Array.isArray(order.items)) {
          order.items.forEach((item: any) => {
            if (item.uniformId) {
              productIdSet.add(item.uniformId.toString())
            }
          })
        }
      })
      
      productIds = Array.from(productIdSet)
        .map((idStr: string) => {
          if (mongoose.Types.ObjectId.isValid(idStr)) {
            return new mongoose.Types.ObjectId(idStr)
          }
          return null
        })
        .filter((id: any) => id !== null) as mongoose.Types.ObjectId[]
      
      if (productIds.length > 0) {
        console.log(`[getProductsByVendor] ✅ Derived ${productIds.length} product IDs from orders`)
      }
    }
  }

  // STEP 3: Validate we have products
  if (productIds.length === 0) {
    console.error(`[getProductsByVendor] ❌ CRITICAL: No products found for vendor ${vendorName} (${vendorId})`)
    console.error(`[getProductsByVendor] Diagnostic info:`)
    console.error(`  - ProductVendor relationships: ${productVendorLinks.length}`)
    console.error(`  - Inventory records: ${await VendorInventory.countDocuments({ vendorId: vendorObjectId })}`)
    console.error(`  - Orders with vendor: ${await Order.countDocuments({ vendorId: vendorObjectId })}`)
    console.error(`[getProductsByVendor] This vendor has no products linked via any method.`)
    return []
  }

  console.log(`[getProductsByVendor] ✅ Proceeding with ${productIds.length} product IDs`)

  // STEP 4: Fetch products from database
  console.log(`[getProductsByVendor] Querying uniforms collection for ${productIds.length} products`)
  console.log(`[getProductsByVendor] Product ObjectIds to query:`, productIds.map(id => id.toString()))
  
  // 🔍 DIAGNOSTIC: Log ObjectId types before query
  console.log(`[getProductsByVendor] 🔍 DIAGNOSTIC: ObjectId types before query:`)
  productIds.forEach((id, idx) => {
    console.log(`[getProductsByVendor]   productIds[${idx}]:`, {
      id: id.toString(),
      type: id.constructor.name,
      isValid: mongoose.Types.ObjectId.isValid(id),
      instanceOf: id instanceof mongoose.Types.ObjectId
    })
  })
  
  let products = await Uniform.find({
    _id: { $in: productIds },
  })
    .lean()

  console.log(`[getProductsByVendor] Products query result: ${products.length} products found by _id`)
  
  // 🔍 DIAGNOSTIC: If query returned 0, try individual queries
  if (products.length === 0 && productIds.length > 0) {
    console.log(`[getProductsByVendor] 🔍 DIAGNOSTIC: Query returned 0. Trying individual findById queries...`)
    for (const oid of productIds) {
      try {
        const individualProduct = await Uniform.findById(oid).lean()
        if (individualProduct) {
          console.log(`[getProductsByVendor] ✅ Individual findById(${oid.toString()}) found product: ${individualProduct.id || individualProduct._id}`)
        } else {
          console.log(`[getProductsByVendor] ❌ Individual findById(${oid.toString()}) returned null`)
        }
      } catch (err: any) {
        console.error(`[getProductsByVendor] ❌ Error in individual findById(${oid.toString()}):`, err.message)
      }
    }
  }
  
  // FALLBACK: If no products found by _id, try to find products that exist in database
  if (products.length === 0) {
    console.warn(`[getProductsByVendor] ⚠️ No products found by _id. Checking if products exist in database...`)
    
    // Get all products to see what's available
    const allProducts = await Uniform.find({}).select('_id id name').limit(10).lean()
    console.log(`[getProductsByVendor] Sample products in database:`, allProducts.map((p: any) => ({
      _id: p._id?.toString(),
      id: p.id,
      name: p.name
    })))
    
    // Try to find products by matching ObjectId strings
    const productIdStrings = productIds.map(id => id.toString())
    const matchingProducts = allProducts.filter((p: any) => {
      const pIdStr = p._id?.toString ? p._id.toString() : String(p._id || '')
      return productIdStrings.includes(pIdStr)
    })
    
    if (matchingProducts.length > 0) {
      console.log(`[getProductsByVendor] Found ${matchingProducts.length} products by string comparison`)
      
      // 🔍 DIAGNOSTIC: Log the matching products and their _id types
      console.log(`[getProductsByVendor] 🔍 DIAGNOSTIC: Matching products _id details:`)
      matchingProducts.forEach((p: any, idx: number) => {
        const pIdStr = p._id?.toString ? p._id.toString() : String(p._id || '')
        console.log(`[getProductsByVendor]   matchingProducts[${idx}]:`, {
          _id: p._id,
          _idType: typeof p._id,
          _idConstructor: p._id?.constructor?.name,
          _idString: pIdStr,
          isValid: mongoose.Types.ObjectId.isValid(pIdStr),
          id: p.id,
          name: p.name
        })
      })
      
      // CRITICAL FIX: Use the matching products directly instead of re-querying
      // Since we already have the products from allProducts, just use them
      // But we need to fetch full product data (not just _id, id, name)
      const matchingProductIds = matchingProducts.map((p: any) => {
        const pIdStr = p._id?.toString ? p._id.toString() : String(p._id || '')
        if (mongoose.Types.ObjectId.isValid(pIdStr)) {
          return new mongoose.Types.ObjectId(pIdStr)
        }
        return null
      }).filter((id: any) => id !== null) as mongoose.Types.ObjectId[]
      
      console.log(`[getProductsByVendor] Fetching full product data for ${matchingProductIds.length} products`)
      console.log(`[getProductsByVendor] 🔍 DIAGNOSTIC: ObjectIds to query:`, matchingProductIds.map(oid => ({
        oid: oid.toString(),
        type: oid.constructor.name,
        isValid: mongoose.Types.ObjectId.isValid(oid)
      })))
      
      // CRITICAL FIX: Products exist but findById with ObjectId fails
      // Query by numeric 'id' field instead (which we have from matchingProducts)
      console.log(`[getProductsByVendor] Products found by string comparison. Fetching full product data by numeric id...`)
      
      const numericIds = matchingProducts.map((p: any) => p.id).filter((id: any) => id)
      console.log(`[getProductsByVendor] 🔍 DIAGNOSTIC: Numeric IDs to query:`, numericIds)
      
      if (numericIds.length > 0) {
        // Query by numeric 'id' field (this is the reliable field)
        products = await Uniform.find({
          id: { $in: numericIds }
        }).lean()
        
        console.log(`[getProductsByVendor] Query by numeric id result: ${products.length} products found`)
        
        if (products.length === 0) {
          // Fallback: Query individually
          console.log(`[getProductsByVendor] ⚠️ Query by $in failed, trying individual queries...`)
          const directProducts: any[] = []
          for (const numericId of numericIds) {
            try {
              const directProduct = await Uniform.findOne({ id: numericId }).lean()
              if (directProduct) {
                directProducts.push(directProduct)
                console.log(`[getProductsByVendor] ✅ Found product by numeric id: ${numericId}`)
              } else {
                console.log(`[getProductsByVendor] ❌ Product not found by numeric id: ${numericId}`)
              }
            } catch (err: any) {
              console.error(`[getProductsByVendor] ❌ Error querying product ${numericId}:`, err.message)
            }
          }
          if (directProducts.length > 0) {
            products = directProducts
            console.log(`[getProductsByVendor] ✅ Using ${directProducts.length} products from individual queries`)
          }
        }
      }
      
      if (products.length === 0) {
        console.error(`[getProductsByVendor] ❌ All query methods failed. Products exist but cannot be retrieved.`)
      }
    } else {
      console.error(`[getProductsByVendor] ❌ CRITICAL: Product IDs from ProductVendor do not match any products in database`)
      console.error(`[getProductsByVendor] This indicates data inconsistency. ProductVendor relationships may be orphaned.`)
      console.error(`[getProductsByVendor] Attempting fallback to inventory records...`)
      
      // Use the fallback method to derive products from inventory
      const inventoryRecords = await VendorInventory.find({ vendorId: vendorObjectId })
        .select('productId')
        .lean()
      
      if (inventoryRecords.length > 0) {
        const inventoryProductIds = inventoryRecords
          .map((inv: any) => inv.productId)
          .filter((id: any) => id !== null)
          .map((id: any) => id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(id))
        
        if (inventoryProductIds.length > 0) {
          console.log(`[getProductsByVendor] ✅ Using ${inventoryProductIds.length} products from inventory records`)
          products = await Uniform.find({
            _id: { $in: inventoryProductIds },
          }).lean()
        }
      }
    }
  }
  
  if (products.length === 0) {
    console.error(`[getProductsByVendor] ❌ CRITICAL: No products found after all fallback attempts`)
    return []
  }
  
  if (products.length < productIds.length) {
    console.warn(`[getProductsByVendor] ⚠️ Some product IDs not found: expected ${productIds.length}, found ${products.length}`)
  }
  
  console.log(`[getProductsByVendor] ✅ Successfully found ${products.length} products`)

  // Get inventory data for these products
  const inventoryRecords = await VendorInventory.find({
    vendorId: vendorObjectId,
    productId: { $in: productIds },
  })
    .lean()

  // Create a map of productId -> inventory
  const inventoryMap = new Map()
  inventoryRecords.forEach((inv: any) => {
    const productIdStr = inv.productId?.toString()
    if (productIdStr) {
      // Convert Map to object if needed
      const sizeInventory = inv.sizeInventory instanceof Map
        ? Object.fromEntries(inv.sizeInventory)
        : inv.sizeInventory || {}
      
      inventoryMap.set(productIdStr, {
        sizeInventory,
        totalStock: inv.totalStock || 0,
      })
    }
  })

  // Attach inventory data to products
  const productsWithInventory = products.map((product: any) => {
    const productIdStr = product._id.toString()
    const inventory = inventoryMap.get(productIdStr) || {
      sizeInventory: {},
      totalStock: 0,
    }

    const plainProduct = toPlainObject(product)
    // Explicitly preserve attribute fields
    if (product.attribute1_name !== undefined) plainProduct.attribute1_name = product.attribute1_name
    if (product.attribute1_value !== undefined) plainProduct.attribute1_value = product.attribute1_value
    if (product.attribute2_name !== undefined) plainProduct.attribute2_name = product.attribute2_name
    if (product.attribute2_value !== undefined) plainProduct.attribute2_value = product.attribute2_value
    if (product.attribute3_name !== undefined) plainProduct.attribute3_name = product.attribute3_name
    if (product.attribute3_value !== undefined) plainProduct.attribute3_value = product.attribute3_value

    return {
      ...plainProduct,
      inventory: inventory.sizeInventory,
      totalStock: inventory.totalStock,
      // For backward compatibility, set stock to totalStock
      stock: inventory.totalStock,
    }
  })

  // STEP 5: Final validation and logging
  console.log(`[getProductsByVendor] ✅ SUCCESS - Returning ${productsWithInventory.length} products for vendor ${vendorName} (${vendorId})`)
  if (productsWithInventory.length > 0) {
    console.log(`[getProductsByVendor] Sample products:`, productsWithInventory.slice(0, 3).map((p: any) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      hasInventory: !!p.inventory
    })))
  } else {
    console.error(`[getProductsByVendor] ❌ CRITICAL: Returning empty array despite having ${productIds.length} product IDs`)
    console.error(`[getProductsByVendor] This indicates a data inconsistency. Products exist but cannot be returned.`)
  }

  return productsWithInventory
}

export async function getAllProducts(): Promise<any[]> {
  await connectDB()
  
  const products = await Uniform.find()
    .populate('vendorId', 'id name')
    .lean()

  // Convert to plain objects and ensure attributes are preserved
  return products.map((p: any) => {
    const plain = toPlainObject(p)
    // Explicitly preserve attribute fields
    if (p.attribute1_name !== undefined) plain.attribute1_name = p.attribute1_name
    if (p.attribute1_value !== undefined) plain.attribute1_value = p.attribute1_value
    if (p.attribute2_name !== undefined) plain.attribute2_name = p.attribute2_name
    if (p.attribute2_value !== undefined) plain.attribute2_value = p.attribute2_value
    if (p.attribute3_name !== undefined) plain.attribute3_name = p.attribute3_name
    if (p.attribute3_value !== undefined) plain.attribute3_value = p.attribute3_value
    return plain
  })
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
  // Optional SKU attributes
  attribute1_name?: string
  attribute1_value?: string | number
  attribute2_name?: string
  attribute2_value?: string | number
  attribute3_name?: string
  attribute3_value?: string | number
}): Promise<any> {
  await connectDB()
  
  // Generate unique 6-digit numeric product ID (starting from 200001)
  const existingProducts = await Uniform.find({})
    .sort({ id: -1 })
    .limit(1)
    .lean()
  
  let nextProductId = 200001 // Start from 200001
  if (existingProducts.length > 0) {
    const lastId = existingProducts[0].id
    if (/^\d{6}$/.test(String(lastId))) {
      const lastIdNum = parseInt(String(lastId), 10)
      if (lastIdNum >= 200001 && lastIdNum < 300000) {
        nextProductId = lastIdNum + 1
      }
    }
  }
  
  let productId = String(nextProductId).padStart(6, '0')
  
  // Check if this ID already exists (safety check)
    const existingProduct = await Uniform.findOne({ id: productId })
  if (existingProduct) {
    // Find next available ID
    for (let i = nextProductId + 1; i < 300000; i++) {
      const testId = String(i).padStart(6, '0')
      const exists = await Uniform.findOne({ id: testId })
      if (!exists) {
        productId = testId
        break
      }
    }
  }
  
  // Check if SKU already exists
  const existingBySku = await Uniform.findOne({ sku: productData.sku })
  if (existingBySku) {
    throw new Error(`Product with SKU already exists: ${productData.sku}`)
  }
  
  // Handle vendor if provided (optional - can be linked later via relationships)
  // vendorId removed from Uniform model - use ProductVendor collection to link products to vendors
  
  const productDataToCreate: any = {
    id: productId,
    name: productData.name,
    category: productData.category,
    gender: productData.gender,
    sizes: productData.sizes || [],
    price: productData.price,
    image: productData.image || '',
    sku: productData.sku,
    companyIds: [],
  }
  
  // Add optional attributes (only include if name is provided - name is required for attribute to be valid)
  // This ensures attributes are saved to the database when provided
  if (productData.attribute1_name !== undefined && productData.attribute1_name !== null && String(productData.attribute1_name).trim() !== '') {
    productDataToCreate.attribute1_name = String(productData.attribute1_name).trim()
    if (productData.attribute1_value !== undefined && productData.attribute1_value !== null && String(productData.attribute1_value).trim() !== '') {
      productDataToCreate.attribute1_value = productData.attribute1_value
    } else {
      // Even if value is empty, save the name (value can be added later)
      productDataToCreate.attribute1_value = null
    }
  }
  if (productData.attribute2_name !== undefined && productData.attribute2_name !== null && String(productData.attribute2_name).trim() !== '') {
    productDataToCreate.attribute2_name = String(productData.attribute2_name).trim()
    if (productData.attribute2_value !== undefined && productData.attribute2_value !== null && String(productData.attribute2_value).trim() !== '') {
      productDataToCreate.attribute2_value = productData.attribute2_value
    } else {
      productDataToCreate.attribute2_value = null
    }
  }
  if (productData.attribute3_name !== undefined && productData.attribute3_name !== null && String(productData.attribute3_name).trim() !== '') {
    productDataToCreate.attribute3_name = String(productData.attribute3_name).trim()
    if (productData.attribute3_value !== undefined && productData.attribute3_value !== null && String(productData.attribute3_value).trim() !== '') {
      productDataToCreate.attribute3_value = productData.attribute3_value
    } else {
      productDataToCreate.attribute3_value = null
    }
  }
  
  // ============================================================
  // FORENSIC DIAGNOSTIC: STEP 3 - INSPECT ACTUAL PAYLOAD
  // ============================================================
  console.log('\n╔════════════════════════════════════════════════════════════╗')
  console.log('║  FORENSIC: PRODUCT PAYLOAD INSPECTION                     ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('[FORENSIC] Product data to create:')
  console.log(JSON.stringify(productDataToCreate, null, 2))
  console.log('\n[FORENSIC] Field-by-field type analysis:')
  Object.keys(productDataToCreate).forEach(key => {
    const value = productDataToCreate[key]
    const type = typeof value
    const isArray = Array.isArray(value)
    console.log(`  ${key}: ${isArray ? 'Array' : type} = ${isArray ? `[${value.length} items]` : JSON.stringify(value)}`)
  })
  
  // ============================================================
  // FORENSIC DIAGNOSTIC: STEP 4 - SCHEMA VS PAYLOAD COMPARISON
  // ============================================================
  console.log('\n[FORENSIC] Schema requirements vs Payload:')
  const schemaChecks = {
    'id': {
      required: true,
      type: 'string',
      validation: '6 digits',
      provided: productDataToCreate.id,
      typeMatch: typeof productDataToCreate.id === 'string',
      validationMatch: /^\d{6}$/.test(String(productDataToCreate.id || '')),
    },
    'name': {
      required: true,
      type: 'string',
      provided: productDataToCreate.name,
      typeMatch: typeof productDataToCreate.name === 'string',
      notEmpty: productDataToCreate.name && String(productDataToCreate.name).trim().length > 0,
    },
    'category': {
      required: true,
      type: 'string',
      enum: ['shirt', 'pant', 'shoe', 'jacket', 'accessory'],
      provided: productDataToCreate.category,
      typeMatch: typeof productDataToCreate.category === 'string',
      enumMatch: ['shirt', 'pant', 'shoe', 'jacket', 'accessory'].includes(productDataToCreate.category),
    },
    'gender': {
      required: true,
      type: 'string',
      enum: ['male', 'female', 'unisex'],
      provided: productDataToCreate.gender,
      typeMatch: typeof productDataToCreate.gender === 'string',
      enumMatch: ['male', 'female', 'unisex'].includes(productDataToCreate.gender),
    },
    'sizes': {
      required: true,
      type: 'array',
      provided: productDataToCreate.sizes,
      isArray: Array.isArray(productDataToCreate.sizes),
      notEmpty: Array.isArray(productDataToCreate.sizes) && productDataToCreate.sizes.length > 0,
    },
    'price': {
      required: true,
      type: 'number',
      provided: productDataToCreate.price,
      typeMatch: typeof productDataToCreate.price === 'number',
      isFinite: typeof productDataToCreate.price === 'number' && isFinite(productDataToCreate.price),
    },
    'image': {
      required: true,
      type: 'string',
      provided: productDataToCreate.image,
      typeMatch: typeof productDataToCreate.image === 'string',
      notEmpty: productDataToCreate.image && String(productDataToCreate.image).trim().length > 0,
    },
    'sku': {
      required: true,
      type: 'string',
      provided: productDataToCreate.sku,
      typeMatch: typeof productDataToCreate.sku === 'string',
      notEmpty: productDataToCreate.sku && String(productDataToCreate.sku).trim().length > 0,
    },
    'companyIds': {
      required: false,
      type: 'array',
      default: [],
      provided: productDataToCreate.companyIds,
      isArray: Array.isArray(productDataToCreate.companyIds),
    },
  }
  
  Object.keys(schemaChecks).forEach(field => {
    const check = schemaChecks[field as keyof typeof schemaChecks]
    const status = check.required 
      ? (check.typeMatch && (check.enumMatch !== undefined ? check.enumMatch : true) && (check.notEmpty !== undefined ? check.notEmpty : true) && (check.validationMatch !== undefined ? check.validationMatch : true) && (check.isFinite !== undefined ? check.isFinite : true))
      : 'N/A (optional)'
    console.log(`  ${field}:`)
    console.log(`    Required: ${check.required}`)
    console.log(`    Expected Type: ${check.type}`)
    if (check.enum) console.log(`    Enum: ${JSON.stringify(check.enum)}`)
    if (check.validation) console.log(`    Validation: ${check.validation}`)
    console.log(`    Provided: ${JSON.stringify(check.provided)}`)
    console.log(`    Type Match: ${check.typeMatch !== undefined ? check.typeMatch : 'N/A'}`)
    if (check.enumMatch !== undefined) console.log(`    Enum Match: ${check.enumMatch}`)
    if (check.validationMatch !== undefined) console.log(`    Validation Match: ${check.validationMatch}`)
    if (check.notEmpty !== undefined) console.log(`    Not Empty: ${check.notEmpty}`)
    if (check.isFinite !== undefined) console.log(`    Is Finite: ${check.isFinite}`)
    console.log(`    ✅ Status: ${status === true ? 'PASS' : status === false ? '❌ FAIL' : status}`)
  })
  
  // ============================================================
  // FORENSIC DIAGNOSTIC: STEP 6 - FORCE ERROR SURFACING
  // ============================================================
  console.log('\n[FORENSIC] Attempting Uniform.create()...')
  let newProduct
  try {
    newProduct = await Uniform.create(productDataToCreate)
    console.log('[FORENSIC] ✅ Uniform.create() succeeded')
    console.log('[FORENSIC] Created product object:')
    console.log(JSON.stringify(newProduct.toObject(), null, 2))
  } catch (err: any) {
    console.error('\n╔════════════════════════════════════════════════════════════╗')
    console.error('║  ❌ UNIFORM SAVE FAILED - VALIDATION ERROR                ║')
    console.error('╚════════════════════════════════════════════════════════════╝')
    console.error(`[FORENSIC] Error Name: ${err.name}`)
    console.error(`[FORENSIC] Error Message: ${err.message}`)
    console.error(`[FORENSIC] Error Code: ${err.code || 'N/A'}`)
    if (err.errors) {
      console.error('[FORENSIC] Validation Errors:')
      Object.keys(err.errors).forEach(key => {
        const error = err.errors[key]
        console.error(`  ${key}:`)
        console.error(`    Kind: ${error.kind}`)
        console.error(`    Path: ${error.path}`)
        console.error(`    Value: ${JSON.stringify(error.value)}`)
        console.error(`    Message: ${error.message}`)
      })
    }
    if (err.keyPattern) {
      console.error('[FORENSIC] Duplicate Key Pattern:')
      console.error(JSON.stringify(err.keyPattern, null, 2))
    }
    if (err.keyValue) {
      console.error('[FORENSIC] Duplicate Key Value:')
      console.error(JSON.stringify(err.keyValue, null, 2))
    }
    console.error('[FORENSIC] Full Error Stack:')
    console.error(err.stack)
    throw err
  }
  
  // Fetch the created product with populated fields using the string ID (more reliable)
  const created = await Uniform.findOne({ id: productId })
    .populate('vendorId', 'id name')
    .lean()
  
  if (!created) {
    // Fallback: try to use the created product directly
    await newProduct.populate('vendorId', 'id name')
    return toPlainObject(newProduct)
  }
  
  return toPlainObject(created)
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
    // Optional SKU attributes
    attribute1_name?: string
    attribute1_value?: string | number
    attribute2_name?: string
    attribute2_value?: string | number
    attribute3_name?: string
    attribute3_value?: string | number
  }
): Promise<any> {
  await connectDB()
  
  // First, verify the product exists and get its current SKU for validation
  let product: any = await Uniform.findOne({ id: productId }).lean()
  
  // If not found by id, try by _id (ObjectId) as fallback
  if (!product && mongoose.Types.ObjectId.isValid(productId)) {
    product = await Uniform.findById(productId).lean()
  }
  
  if (!product) {
    throw new Error(`Product not found: ${productId}`)
  }
  
  // Handle SKU update (check for duplicates) - must check before update
  if (updateData.sku !== undefined && updateData.sku !== (product as any).sku) {
    const existingBySku = await Uniform.findOne({ sku: updateData.sku }).lean()
    if (existingBySku && (existingBySku as any).id !== productId) {
      throw new Error(`Product with SKU already exists: ${updateData.sku}`)
    }
  }
  
  // Build update object - only include fields that are defined
  const updateObject: any = {}
  if (updateData.name !== undefined) updateObject.name = updateData.name
  if (updateData.category !== undefined) updateObject.category = updateData.category
  if (updateData.gender !== undefined) updateObject.gender = updateData.gender
  if (updateData.sizes !== undefined) updateObject.sizes = updateData.sizes
  if (updateData.price !== undefined) updateObject.price = updateData.price
  if (updateData.image !== undefined) updateObject.image = updateData.image
  if (updateData.sku !== undefined) updateObject.sku = updateData.sku
  
  console.log('[updateProduct] Update data received:', JSON.stringify(updateData, null, 2))
  
  // Update optional attributes (only save if name is provided - name is required for attribute to be valid)
  // IMPORTANT: Check for both undefined and empty string, as form data may send empty strings
  if (updateData.attribute1_name !== undefined) {
    const attr1Name = updateData.attribute1_name ? String(updateData.attribute1_name).trim() : ''
    if (attr1Name !== '') {
      // Name is provided - save it
      updateObject.attribute1_name = attr1Name
      // Save value if provided, otherwise don't include it (preserve existing or leave empty)
      if (updateData.attribute1_value !== undefined && updateData.attribute1_value !== null && String(updateData.attribute1_value).trim() !== '') {
        updateObject.attribute1_value = updateData.attribute1_value
      }
      // Note: If value is empty, we don't set it to null - we just don't update it
    } else {
      // Name is empty - clear the entire attribute
      updateObject.attribute1_name = null
      updateObject.attribute1_value = null
    }
  } else if (updateData.attribute1_value !== undefined) {
    // Only value is being updated (name not provided, preserve existing name)
    if (updateData.attribute1_value !== null && String(updateData.attribute1_value).trim() !== '') {
      updateObject.attribute1_value = updateData.attribute1_value
    } else {
      // Value is being cleared
      updateObject.attribute1_value = null
    }
  }
  
  if (updateData.attribute2_name !== undefined) {
    const attr2Name = updateData.attribute2_name ? String(updateData.attribute2_name).trim() : ''
    if (attr2Name !== '') {
      updateObject.attribute2_name = attr2Name
      if (updateData.attribute2_value !== undefined && updateData.attribute2_value !== null && String(updateData.attribute2_value).trim() !== '') {
        updateObject.attribute2_value = updateData.attribute2_value
      }
    } else {
      updateObject.attribute2_name = null
      updateObject.attribute2_value = null
    }
  } else if (updateData.attribute2_value !== undefined) {
    if (updateData.attribute2_value !== null && String(updateData.attribute2_value).trim() !== '') {
      updateObject.attribute2_value = updateData.attribute2_value
    } else {
      updateObject.attribute2_value = null
    }
  }
  
  if (updateData.attribute3_name !== undefined) {
    const attr3Name = updateData.attribute3_name ? String(updateData.attribute3_name).trim() : ''
    if (attr3Name !== '') {
      updateObject.attribute3_name = attr3Name
      if (updateData.attribute3_value !== undefined && updateData.attribute3_value !== null && String(updateData.attribute3_value).trim() !== '') {
        updateObject.attribute3_value = updateData.attribute3_value
      }
    } else {
      updateObject.attribute3_name = null
      updateObject.attribute3_value = null
    }
  } else if (updateData.attribute3_value !== undefined) {
    if (updateData.attribute3_value !== null && String(updateData.attribute3_value).trim() !== '') {
      updateObject.attribute3_value = updateData.attribute3_value
    } else {
      updateObject.attribute3_value = null
    }
  }
  
  // Build the update query - use $set for all fields
  // Only use $unset to remove fields when name is explicitly cleared
  const updateQuery: any = { $set: {} }
  const unsetFields: any = {}
  
  // Process attributes specially: if name is being cleared, unset both name and value
  // Otherwise, set the name and value (value can be null if not provided)
  const attributeNames = ['attribute1', 'attribute2', 'attribute3']
  attributeNames.forEach(attrPrefix => {
    const nameKey = `${attrPrefix}_name`
    const valueKey = `${attrPrefix}_value`
    
    if (nameKey in updateObject) {
      if (updateObject[nameKey] === null) {
        // Name is being cleared - unset both name and value
        unsetFields[nameKey] = ''
        unsetFields[valueKey] = ''
      } else {
        // Name is being set - include it in $set
        updateQuery.$set[nameKey] = updateObject[nameKey]
        // If value is also being updated, include it (even if null)
        if (valueKey in updateObject) {
          if (updateObject[valueKey] === null) {
            // Value is being cleared but name exists - unset only the value
            unsetFields[valueKey] = ''
          } else {
            updateQuery.$set[valueKey] = updateObject[valueKey]
          }
        }
      }
    } else if (valueKey in updateObject) {
      // Only value is being updated (name not provided)
      if (updateObject[valueKey] === null) {
        unsetFields[valueKey] = ''
      } else {
        updateQuery.$set[valueKey] = updateObject[valueKey]
      }
    }
  })
  
  // Process non-attribute fields
  Object.keys(updateObject).forEach(key => {
    if (!key.startsWith('attribute')) {
      if (updateObject[key] === null) {
        unsetFields[key] = ''
      } else {
        updateQuery.$set[key] = updateObject[key]
      }
    }
  })
  
  if (Object.keys(unsetFields).length > 0) {
    updateQuery.$unset = unsetFields
  }
  
  // Use findOneAndUpdate to update directly in database (avoids save() issues)
  // Try by id field first
  let updated = await Uniform.findOneAndUpdate(
    { id: productId },
    updateQuery,
    { new: true, runValidators: true }
  ).lean()
  
  // If not found by id, try by _id (ObjectId) as fallback
  if (!updated && mongoose.Types.ObjectId.isValid(productId)) {
    updated = await Uniform.findByIdAndUpdate(
      productId,
      updateQuery,
      { new: true, runValidators: true }
    ).lean()
  }
  
  if (!updated) {
    throw new Error(`Product not found for update: ${productId}`)
  }
  
  return toPlainObject(updated)
}

export async function deleteProduct(productId: string): Promise<void> {
  await connectDB()
  
  const product = await Uniform.findOne({ id: productId })
  if (!product) {
    throw new Error(`Product not found: ${productId}`)
  }
  
  // Delete product-company relationships
  await ProductCompany.deleteMany({ productId: product._id })
  
  // Delete product-vendor relationships
  await ProductVendor.deleteMany({ productId: product._id })
  
  // Delete the product
  await Uniform.deleteOne({ _id: product._id })
}

export async function getProductById(productId: string): Promise<any | null> {
  await connectDB()
  
  if (!productId) {
    console.warn('[getProductById] No productId provided.')
    return null
  }
  
  // Try finding by the 'id' field (string ID) first
  let product = await Uniform.findOne({ id: productId })
    .populate('vendorId', 'id name')
    .lean()

  // If not found by string 'id' and productId looks like an ObjectId, try finding by '_id'
  if (!product && mongoose.Types.ObjectId.isValid(productId) && productId.length === 24) {
    console.log(`[getProductById] Product not found by string ID "${productId}", trying ObjectId lookup.`)
    product = await Uniform.findById(productId)
      .populate('vendorId', 'id name')
      .lean()
  }
  
  if (!product) {
    console.warn(`[getProductById] No product found for ID: ${productId}`)
    return null
  }
  
  const plain = toPlainObject(product)
  // Explicitly preserve attribute fields
  const productAny = product as any
  if (productAny.attribute1_name !== undefined) plain.attribute1_name = productAny.attribute1_name
  if (productAny.attribute1_value !== undefined) plain.attribute1_value = productAny.attribute1_value
  if (productAny.attribute2_name !== undefined) plain.attribute2_name = productAny.attribute2_name
  if (productAny.attribute2_value !== undefined) plain.attribute2_value = productAny.attribute2_value
  if (productAny.attribute3_name !== undefined) plain.attribute3_name = productAny.attribute3_name
  if (productAny.attribute3_value !== undefined) plain.attribute3_value = productAny.attribute3_value
  
  return plain
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

export async function getVendorByEmail(email: string): Promise<any | null> {
  await connectDB()
  
  if (!email) {
    return null
  }
  
  const normalizedEmail = email.trim().toLowerCase()
  
  // Try case-insensitive search using regex
  let vendor = await Vendor.findOne({ 
    email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  }).lean()
  
  // If not found, try fetching all and comparing (fallback)
  if (!vendor) {
    const allVendors = await Vendor.find({}).lean()
    for (const v of allVendors) {
      if (v.email && v.email.trim().toLowerCase() === normalizedEmail) {
        vendor = v
        break
      }
    }
  }
  
  return vendor ? toPlainObject(vendor) : null
}

export async function createVendor(vendorData: {
  name: string
  email: string
  phone: string
  logo: string
  website: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  theme?: 'light' | 'dark' | 'custom'
}): Promise<any> {
  await connectDB()
  
  // Check if email already exists
  const existingByEmail = await Vendor.findOne({ email: vendorData.email })
  if (existingByEmail) {
    throw new Error(`Vendor with email already exists: ${vendorData.email}`)
  }
  
  // Generate next 6-digit numeric vendor ID
  // Find the highest existing vendor ID
  const existingVendors = await Vendor.find({})
    .sort({ id: -1 })
    .limit(1)
    .lean()
  
  let nextVendorId = 100001 // Start from 100001
  if (existingVendors.length > 0) {
    const lastId = existingVendors[0].id
    // Extract numeric part if it's already numeric
    if (/^\d{6}$/.test(lastId)) {
      const lastIdNum = parseInt(lastId, 10)
      nextVendorId = lastIdNum + 1
    } else {
      // If old format exists, start from 100001
      nextVendorId = 100001
    }
  }
  
  // Ensure it's 6 digits
  let vendorId = String(nextVendorId).padStart(6, '0')
  
  // Check if this ID already exists (shouldn't happen, but safety check)
  const existingById = await Vendor.findOne({ id: vendorId })
  if (existingById) {
    // Find next available ID
    let foundId = false
    for (let i = nextVendorId + 1; i < 999999; i++) {
      const testId = String(i).padStart(6, '0')
      const exists = await Vendor.findOne({ id: testId })
      if (!exists) {
        vendorId = testId
        foundId = true
        break
      }
    }
    if (!foundId) {
      throw new Error('Unable to generate unique vendor ID')
    }
  }
  
  const vendorDataToCreate: any = {
    id: vendorId,
    name: vendorData.name,
    email: vendorData.email,
    phone: vendorData.phone,
    logo: vendorData.logo,
    website: vendorData.website,
    primaryColor: vendorData.primaryColor,
    secondaryColor: vendorData.secondaryColor,
    accentColor: vendorData.accentColor,
    theme: vendorData.theme || 'light',
  }
  
  const newVendor = await Vendor.create(vendorDataToCreate)
  return toPlainObject(newVendor)
}

export async function updateVendor(vendorId: string, vendorData: {
  name?: string
  email?: string
  phone?: string
  logo?: string
  website?: string
  primaryColor?: string
  secondaryColor?: string
  accentColor?: string
  theme?: 'light' | 'dark' | 'custom'
}): Promise<any> {
  await connectDB()
  
  // Find vendor by id
  const vendor = await Vendor.findOne({ id: vendorId })
  if (!vendor) {
    throw new Error(`Vendor not found with id: ${vendorId}`)
  }
  
  // If email is being updated, check if it conflicts with another vendor
  if (vendorData.email && vendorData.email !== vendor.email) {
    const existingByEmail = await Vendor.findOne({ email: vendorData.email })
    if (existingByEmail && existingByEmail.id !== vendorId) {
      throw new Error(`Vendor with email already exists: ${vendorData.email}`)
    }
  }
  
  // Update only provided fields
  if (vendorData.name !== undefined) vendor.name = vendorData.name
  if (vendorData.email !== undefined) vendor.email = vendorData.email
  if (vendorData.phone !== undefined) vendor.phone = vendorData.phone
  if (vendorData.logo !== undefined) vendor.logo = vendorData.logo
  if (vendorData.website !== undefined) vendor.website = vendorData.website
  if (vendorData.primaryColor !== undefined) vendor.primaryColor = vendorData.primaryColor
  if (vendorData.secondaryColor !== undefined) vendor.secondaryColor = vendorData.secondaryColor
  if (vendorData.accentColor !== undefined) vendor.accentColor = vendorData.accentColor
  if (vendorData.theme !== undefined) vendor.theme = vendorData.theme
  
  await vendor.save()
  return toPlainObject(vendor)
}

// ========== COMPANY FUNCTIONS ==========

export async function createCompany(companyData: {
  name: string
  logo: string
  website: string
  primaryColor: string
  secondaryColor?: string
  showPrices?: boolean
  allowPersonalPayments?: boolean
}): Promise<any> {
  await connectDB()
  
  // Check if company name already exists
  const existingByName = await Company.findOne({ name: companyData.name })
  if (existingByName) {
    throw new Error(`Company with name already exists: ${companyData.name}`)
  }
  
  // Generate next 6-digit numeric company ID (starting from 100001)
  const existingCompanies = await Company.find({})
    .sort({ id: -1 })
    .limit(1)
    .lean()
  
  let nextCompanyId = 100001 // Start from 100001
  if (existingCompanies.length > 0) {
    const lastId = existingCompanies[0].id
    if (/^\d{6}$/.test(String(lastId))) {
      const lastIdNum = parseInt(String(lastId), 10)
      if (lastIdNum >= 100001 && lastIdNum < 200000) {
        nextCompanyId = lastIdNum + 1
      }
    }
  }
  
  let companyId = String(nextCompanyId).padStart(6, '0')
  
  // Check if this ID already exists (safety check)
  const existingById = await Company.findOne({ id: companyId })
  if (existingById) {
    // Find next available ID
    for (let i = nextCompanyId + 1; i < 200000; i++) {
      const testId = String(i).padStart(6, '0')
      const exists = await Company.findOne({ id: testId })
      if (!exists) {
        companyId = testId
        break
      }
    }
  }
  
  const companyDataToCreate: any = {
    id: companyId,
    name: companyData.name,
    logo: companyData.logo,
    website: companyData.website,
    primaryColor: companyData.primaryColor,
    secondaryColor: companyData.secondaryColor || '#f76b1c',
    showPrices: companyData.showPrices || false,
    allowPersonalPayments: companyData.allowPersonalPayments || false,
  }
  
  const newCompany = await Company.create(companyDataToCreate)
  return toPlainObject(newCompany)
}

export async function getAllCompanies(): Promise<any[]> {
  await connectDB()
  
  const companies = await Company.find()
    .populate('adminId', 'id employeeId firstName lastName email')
    .lean()
  
  // Convert to plain objects but preserve _id for ObjectId matching
  return companies.map((c: any) => {
    const plain = toPlainObject(c)
    // Preserve _id for ObjectId matching (needed for companyId conversion)
    if (c._id) {
      plain._id = c._id.toString()
    }
    return plain
  })
}

// ========== LOCATION FUNCTIONS ==========

/**
 * Create a new Location
 * @param locationData Location data including companyId and adminId (required)
 * @returns Created location object
 */
export async function createLocation(locationData: {
  name: string
  companyId: string // Company ID (6-digit numeric string)
  adminId?: string // Employee ID (6-digit numeric string) - Location Admin (optional)
  address?: string
  city?: string
  state?: string
  pincode?: string
  phone?: string
  email?: string
  status?: 'active' | 'inactive'
}): Promise<any> {
  await connectDB()
  
  // Find company by ID
  const company = await Company.findOne({ id: locationData.companyId })
  if (!company) {
    throw new Error(`Company not found: ${locationData.companyId}`)
  }
  
  // Find employee (Location Admin) by employeeId if provided
  let adminEmployee = null
  if (locationData.adminId) {
    adminEmployee = await Employee.findOne({ employeeId: locationData.adminId })
    if (!adminEmployee) {
      throw new Error(`Employee not found for Location Admin: ${locationData.adminId}`)
    }
    
    // Verify employee belongs to the same company
    const employeeCompanyId = typeof adminEmployee.companyId === 'object' && adminEmployee.companyId?.id
      ? adminEmployee.companyId.id
      : (await Company.findById(adminEmployee.companyId))?.id
    
    if (employeeCompanyId !== locationData.companyId) {
      throw new Error(`Employee ${locationData.adminId} does not belong to company ${locationData.companyId}`)
    }
  }
  
  // Check if location name already exists for this company
  const existingLocation = await Location.findOne({ 
    companyId: company._id, 
    name: locationData.name.trim() 
  })
  if (existingLocation) {
    throw new Error(`Location with name "${locationData.name}" already exists for this company`)
  }
  
  // Generate next 6-digit numeric location ID (starting from 400001)
  const existingLocations = await Location.find({})
    .sort({ id: -1 })
    .limit(1)
    .lean()
  
  let nextLocationId = 400001 // Start from 400001
  if (existingLocations.length > 0) {
    const lastId = existingLocations[0].id
    if (/^\d{6}$/.test(String(lastId))) {
      const lastIdNum = parseInt(String(lastId), 10)
      if (lastIdNum >= 400001 && lastIdNum < 500000) {
        nextLocationId = lastIdNum + 1
      }
    }
  }
  
  let locationId = String(nextLocationId).padStart(6, '0')
  
  // Check if this ID already exists (safety check)
  const existingById = await Location.findOne({ id: locationId })
  if (existingById) {
    // Find next available ID
    for (let i = nextLocationId + 1; i < 500000; i++) {
      const testId = String(i).padStart(6, '0')
      const exists = await Location.findOne({ id: testId })
      if (!exists) {
        locationId = testId
        break
      }
    }
  }
  
  // Create location
  const locationDataToCreate: any = {
    id: locationId,
    name: locationData.name.trim(),
    companyId: company._id,
    status: locationData.status || 'active',
  }
  
  // Add adminId if provided
  if (adminEmployee) {
    locationDataToCreate.adminId = adminEmployee._id
  }
  
  // Add optional fields
  if (locationData.address) locationDataToCreate.address = locationData.address.trim()
  if (locationData.city) locationDataToCreate.city = locationData.city.trim()
  if (locationData.state) locationDataToCreate.state = locationData.state.trim()
  if (locationData.pincode) locationDataToCreate.pincode = locationData.pincode.trim()
  if (locationData.phone) locationDataToCreate.phone = locationData.phone.trim()
  if (locationData.email) locationDataToCreate.email = locationData.email.trim()
  
  const newLocation = await Location.create(locationDataToCreate)
  
  // Create LocationAdmin relationship if admin exists
  if (adminEmployee) {
    await LocationAdmin.findOneAndUpdate(
      { locationId: newLocation._id, employeeId: adminEmployee._id },
      { locationId: newLocation._id, employeeId: adminEmployee._id },
      { upsert: true }
    )
  }
  
  // Populate and return
  const populated = await Location.findById(newLocation._id)
    .populate('companyId', 'id name')
    .populate('adminId', 'id employeeId firstName lastName email')
    .lean()
  
  return toPlainObject(populated)
}

/**
 * Get all locations for a company
 * @param companyId Company ID (6-digit numeric string)
 * @returns Array of locations
 */
export async function getLocationsByCompany(companyId: string): Promise<any[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    return []
  }
  
  const locations = await Location.find({ companyId: company._id })
    .populate('companyId', 'id name')
    .populate('adminId', 'id employeeId firstName lastName email')
    .sort({ name: 1 })
    .lean()
  
  return locations.map((l: any) => toPlainObject(l))
}

/**
 * Get location by ID
 * @param locationId Location ID (6-digit numeric string)
 * @returns Location object or null
 */
export async function getLocationById(locationId: string): Promise<any | null> {
  await connectDB()
  
  const location = await Location.findOne({ id: locationId })
    .populate('companyId', 'id name')
    .populate('adminId', 'id employeeId firstName lastName email')
    .lean()
  
  return location ? toPlainObject(location) : null
}

/**
 * Update location
 * @param locationId Location ID
 * @param updateData Fields to update
 * @returns Updated location
 */
export async function updateLocation(
  locationId: string,
  updateData: {
    name?: string
    adminId?: string // New Location Admin employee ID
    address?: string
    city?: string
    state?: string
    pincode?: string
    phone?: string
    email?: string
    status?: 'active' | 'inactive'
  }
): Promise<any> {
  await connectDB()
  
  const location = await Location.findOne({ id: locationId })
  if (!location) {
    throw new Error(`Location not found: ${locationId}`)
  }
  
    // If updating admin (including removal)
    if (updateData.adminId !== undefined) {
      if (updateData.adminId) {
        // Assign new admin - populate companyId to ensure we can compare
        const newAdmin = await Employee.findOne({ employeeId: updateData.adminId })
          .populate('companyId', 'id name')
        if (!newAdmin) {
          throw new Error(`Employee not found: ${updateData.adminId}`)
        }
        
        // Verify employee belongs to same company as location
        // Extract location's company ID
        // Note: location.companyId is NOT populated, so it's an ObjectId
        let locationCompanyId: string | null = null
        if (location.companyId) {
          // location.companyId is an ObjectId (not populated), so fetch the company
          const locationCompany = await Company.findById(location.companyId).select('id').lean()
          if (locationCompany && locationCompany.id) {
            locationCompanyId = locationCompany.id
          }
        }
        
        if (!locationCompanyId) {
          throw new Error(`Location ${locationId} has no associated company`)
        }
        
        // Extract employee's company ID
        // Note: newAdmin.companyId is populated, so it should be an object with id property
        let employeeCompanyId: string | null = null
        if (newAdmin.companyId) {
          if (typeof newAdmin.companyId === 'object') {
            // Populated: { _id: ObjectId, id: '100004', name: '...' }
            if (newAdmin.companyId.id) {
              employeeCompanyId = newAdmin.companyId.id
            } else {
              // Populated but id field missing - try to fetch by _id
              const employeeCompany = await Company.findById(newAdmin.companyId._id || newAdmin.companyId).select('id').lean()
              employeeCompanyId = employeeCompany?.id || null
            }
          } else if (typeof newAdmin.companyId === 'string') {
            // Not populated: ObjectId string - need to fetch company
            if (newAdmin.companyId.length === 24 && /^[0-9a-fA-F]{24}$/.test(newAdmin.companyId)) {
              const employeeCompany = await Company.findById(newAdmin.companyId).select('id').lean()
              employeeCompanyId = employeeCompany?.id || null
            }
          }
        }
        
        if (!employeeCompanyId) {
          throw new Error(`Employee ${updateData.adminId} has no associated company`)
        }
        
        console.log(`[updateLocation] Company ID comparison: locationCompanyId=${locationCompanyId}, employeeCompanyId=${employeeCompanyId}`)
        
        if (!locationCompanyId || !employeeCompanyId || employeeCompanyId !== locationCompanyId) {
          throw new Error(`Employee ${updateData.adminId} does not belong to location's company. Location company: ${locationCompanyId}, Employee company: ${employeeCompanyId}`)
        }
        
        // Update adminId
        location.adminId = newAdmin._id
        
        // Update LocationAdmin relationship (remove old, add new)
        await LocationAdmin.findOneAndDelete({ locationId: location._id })
        await LocationAdmin.create({
          locationId: location._id,
          employeeId: newAdmin._id
        })
      } else {
        // Remove admin (adminId is null/undefined/empty string)
        // Set to null explicitly so Mongoose will update the field
        location.adminId = null as any
        // Remove LocationAdmin relationship (safe - won't error if record doesn't exist)
        try {
          const deleted = await LocationAdmin.findOneAndDelete({ locationId: location._id })
          if (!deleted) {
            // LocationAdmin record might not exist, which is fine
            console.log('LocationAdmin record not found for deletion (this is OK):', location._id)
          }
        } catch (error: any) {
          // Log but don't fail - LocationAdmin deletion is not critical
          console.error('Error deleting LocationAdmin record (non-critical):', error.message)
        }
      }
    }
  
  // Update other fields
  if (updateData.name !== undefined) location.name = updateData.name.trim()
  if (updateData.address !== undefined) location.address = updateData.address?.trim()
  if (updateData.city !== undefined) location.city = updateData.city?.trim()
  if (updateData.state !== undefined) location.state = updateData.state?.trim()
  if (updateData.pincode !== undefined) location.pincode = updateData.pincode?.trim()
  if (updateData.phone !== undefined) location.phone = updateData.phone?.trim()
  if (updateData.email !== undefined) location.email = updateData.email?.trim()
  if (updateData.status !== undefined) location.status = updateData.status
  
  await location.save()
  
  // Populate and return
  const populated = await Location.findById(location._id)
    .populate('companyId', 'id name')
    .populate('adminId', 'id employeeId firstName lastName email')
    .lean()
  
  return toPlainObject(populated)
}

/**
 * Delete location
 * @param locationId Location ID
 * @returns Success status
 */
export async function deleteLocation(locationId: string): Promise<void> {
  await connectDB()
  
  const location = await Location.findOne({ id: locationId })
  if (!location) {
    throw new Error(`Location not found: ${locationId}`)
  }
  
  // Check if any employees are assigned to this location
  const employeesWithLocation = await Employee.countDocuments({ locationId: location._id })
  if (employeesWithLocation > 0) {
    throw new Error(`Cannot delete location: ${employeesWithLocation} employee(s) are assigned to this location`)
  }
  
  // Delete LocationAdmin relationships
  await LocationAdmin.deleteMany({ locationId: location._id })
  
  // Delete location
  await Location.deleteOne({ _id: location._id })
}

/**
 * Get all locations (for Super Admin)
 * @returns Array of all locations
 */
export async function getAllLocations(): Promise<any[]> {
  await connectDB()
  
  const locations = await Location.find({})
    .populate('companyId', 'id name')
    .populate('adminId', 'id employeeId firstName lastName email')
    .sort({ companyId: 1, name: 1 })
    .lean()
  
  return locations.map((l: any) => toPlainObject(l))
}

export async function getCompanyById(companyId: string | number): Promise<any | null> {
  await connectDB()
  
  // Convert companyId to number if it's a string representation of a number
  let numericCompanyId: number | null = null
  if (typeof companyId === 'string') {
    const parsed = Number(companyId)
    if (!isNaN(parsed) && isFinite(parsed)) {
      numericCompanyId = parsed
    }
  } else if (typeof companyId === 'number') {
    numericCompanyId = companyId
  }
  
  // Find company by numeric ID first (since company.id is now numeric)
  // Explicitly select all fields including enableEmployeeOrder, allowLocationAdminViewFeedback, and allowEligibilityConsumptionReset to ensure they're included
  let company = null
  if (numericCompanyId !== null) {
    company = await Company.findOne({ id: numericCompanyId })
      .select('id name logo website primaryColor secondaryColor showPrices allowPersonalPayments allowPersonalAddressDelivery enableEmployeeOrder allowLocationAdminViewFeedback allowEligibilityConsumptionReset adminId createdAt updatedAt')
      .populate('adminId', 'id employeeId firstName lastName email')
      .lean()
  }
  
  // If not found by numeric ID, try as string ID (for backward compatibility)
  if (!company && typeof companyId === 'string') {
    company = await Company.findOne({ id: companyId })
      .select('id name logo website primaryColor secondaryColor showPrices allowPersonalPayments allowPersonalAddressDelivery enableEmployeeOrder allowLocationAdminViewFeedback allowEligibilityConsumptionReset adminId createdAt updatedAt')
      .populate('adminId', 'id employeeId firstName lastName email')
      .lean()
  }
  
  return company ? toPlainObject(company) : null
}

export async function updateCompanySettings(
  companyId: string,
  settings: { 
    showPrices?: boolean
    allowPersonalPayments?: boolean
    enableEmployeeOrder?: boolean
    allowLocationAdminViewFeedback?: boolean
    allowEligibilityConsumptionReset?: boolean
    logo?: string
    primaryColor?: string
    secondaryColor?: string
    name?: string
  }
): Promise<any> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }
  
  if (settings.showPrices !== undefined) {
    company.showPrices = settings.showPrices
  }
  
  if (settings.allowPersonalPayments !== undefined) {
    company.allowPersonalPayments = settings.allowPersonalPayments
  }
  
  if (settings.enableEmployeeOrder !== undefined) {
    // Explicitly set the field to ensure it's saved to database (even if false)
    console.log(`[updateCompanySettings] Setting enableEmployeeOrder to: ${settings.enableEmployeeOrder} (type: ${typeof settings.enableEmployeeOrder})`)
    const boolValue = Boolean(settings.enableEmployeeOrder) // Ensure it's a boolean
    company.enableEmployeeOrder = boolValue
    // Mark the field as modified to ensure Mongoose saves it
    company.markModified('enableEmployeeOrder')
    // Also explicitly set it using set() to ensure it's tracked
    company.set('enableEmployeeOrder', boolValue)
    console.log(`[updateCompanySettings] After setting - company.enableEmployeeOrder=${company.enableEmployeeOrder}, type=${typeof company.enableEmployeeOrder}`)
  } else {
    console.log(`[updateCompanySettings] enableEmployeeOrder is undefined in settings`)
  }
  
  if (settings.allowLocationAdminViewFeedback !== undefined) {
    const boolValue = Boolean(settings.allowLocationAdminViewFeedback)
    company.allowLocationAdminViewFeedback = boolValue
    company.markModified('allowLocationAdminViewFeedback')
    company.set('allowLocationAdminViewFeedback', boolValue)
  }
  
  if (settings.allowEligibilityConsumptionReset !== undefined) {
    const boolValue = Boolean(settings.allowEligibilityConsumptionReset)
    company.allowEligibilityConsumptionReset = boolValue
    company.markModified('allowEligibilityConsumptionReset')
    company.set('allowEligibilityConsumptionReset', boolValue)
  }
  
  if (settings.logo !== undefined) {
    company.logo = settings.logo
  }
  
  if (settings.primaryColor !== undefined) {
    company.primaryColor = settings.primaryColor
  }
  
  if (settings.secondaryColor !== undefined) {
    company.secondaryColor = settings.secondaryColor
  }
  
  if (settings.name !== undefined) {
    company.name = settings.name
  }
  
  // Log before save
  console.log(`[updateCompanySettings] Before save - company.enableEmployeeOrder=${company.enableEmployeeOrder}, type=${typeof company.enableEmployeeOrder}`)
  
  // Save the company - explicitly save to ensure enableEmployeeOrder is persisted
  await company.save({ validateBeforeSave: true })
  
  // Verify the save by checking the database directly using raw MongoDB query
  const db = mongoose.connection.db
  let rawDbValue: boolean | null = null
  if (db) {
    const rawCompany = await db.collection('companies').findOne({ id: companyId })
    rawDbValue = rawCompany?.enableEmployeeOrder !== undefined ? Boolean(rawCompany.enableEmployeeOrder) : null
    console.log(`[updateCompanySettings] Raw DB value after save - enableEmployeeOrder=${rawDbValue}, type=${typeof rawDbValue}, exists=${rawCompany?.enableEmployeeOrder !== undefined}`)
  }
  
  console.log(`[updateCompanySettings] After save - company.enableEmployeeOrder=${company.enableEmployeeOrder}`)
  
  // Fetch the updated company using Mongoose document (not lean) to ensure all fields are included
  // Then convert to plain object
  const updatedDoc = await Company.findOne({ id: companyId })
    .select('id name logo website primaryColor secondaryColor showPrices allowPersonalPayments allowPersonalAddressDelivery enableEmployeeOrder allowLocationAdminViewFeedback allowEligibilityConsumptionReset adminId createdAt updatedAt')
  
  if (!updatedDoc) {
    // Fallback: try to use the saved company directly (convert to plain object)
    const savedPlain = company.toObject ? company.toObject() : company
    console.log(`[updateCompanySettings] Using saved company directly, enableEmployeeOrder=${savedPlain.enableEmployeeOrder}`)
    return toPlainObject(savedPlain)
  }
  
  // Convert Mongoose document to plain object - this ensures enableEmployeeOrder is included
  const updated = updatedDoc.toObject ? updatedDoc.toObject() : updatedDoc
  
  // CRITICAL FIX: Override with raw database value if available (raw DB is source of truth)
  // This ensures we use the actual database value, not Mongoose's interpretation
  if (rawDbValue !== null && rawDbValue !== undefined) {
    updated.enableEmployeeOrder = Boolean(rawDbValue)
    console.log(`[updateCompanySettings] Overriding Mongoose value with raw DB value: enableEmployeeOrder=${rawDbValue}`)
  }
  
  // Log the value to verify it's being read correctly
  console.log(`[updateCompanySettings] Final company ${companyId}, enableEmployeeOrder=${updated.enableEmployeeOrder}, type=${typeof updated.enableEmployeeOrder}`)
  console.log(`[updateCompanySettings] Updated object keys:`, Object.keys(updated))
  console.log(`[updateCompanySettings] Updated object enableEmployeeOrder property:`, 'enableEmployeeOrder' in updated)
  
  // Double-check by querying raw MongoDB (reuse existing db variable)
  if (db) {
    const rawCheck = await db.collection('companies').findOne({ id: companyId })
    console.log(`[updateCompanySettings] Final raw DB check - enableEmployeeOrder=${rawCheck?.enableEmployeeOrder}, type=${typeof rawCheck?.enableEmployeeOrder}`)
  }
  
  const plainObj = toPlainObject(updated)
  console.log(`[updateCompanySettings] After toPlainObject - enableEmployeeOrder=${plainObj.enableEmployeeOrder}, type=${typeof plainObj.enableEmployeeOrder}`)
  
  return plainObj
}

// ========== BRANCH FUNCTIONS ==========

export async function getAllBranches(): Promise<any[]> {
  await connectDB()
  
  const branches = await Branch.find()
    .populate('companyId', 'id name')
    .populate('adminId', 'id employeeId firstName lastName email designation')
    .lean()
  return branches.map((b: any) => toPlainObject(b))
}

export async function getBranchById(branchId: string): Promise<any | null> {
  await connectDB()
  
  const branch = await Branch.findOne({ id: branchId })
    .populate('companyId', 'id name')
    .populate('adminId', 'id employeeId firstName lastName email designation')
    .lean()
  return branch ? toPlainObject(branch) : null
}

export async function getBranchesByCompany(companyId: string): Promise<any[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) return []

  const branches = await Branch.find({ companyId: company._id })
    .populate('companyId', 'id name')
    .populate('adminId', 'id employeeId firstName lastName email designation')
    .lean()

  return branches.map((b: any) => toPlainObject(b))
}

export async function getEmployeesByBranch(branchId: string): Promise<any[]> {
  await connectDB()
  
  const branch = await Branch.findOne({ id: branchId })
  if (!branch) return []

  const employees = await Employee.find({ branchId: branch._id })
    .populate('companyId', 'id name')
    .populate({
      path: 'branchId',
      select: 'id name address',
      strictPopulate: false
    })
    .lean()

  return employees.map((e: any) => toPlainObject(e))
}

// ========== COMPANY ADMIN FUNCTIONS (Multiple Admins) ==========

export async function addCompanyAdmin(companyId: string, employeeId: string, canApproveOrders: boolean = false): Promise<void> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }
  
  // Try multiple lookup methods to find the employee
  let employee: any = null
  
  // Method 1: Try by id field (most common)
  employee = await Employee.findOne({ id: employeeId }).populate('companyId')
  
  // Method 2: If not found, try by employeeId field (business ID like "IND-001")
  if (!employee) {
    employee = await Employee.findOne({ employeeId: employeeId }).populate('companyId')
  }
  
  // Method 3: If not found and employeeId looks like MongoDB ObjectId, try by _id
  if (!employee && mongoose.Types.ObjectId.isValid(employeeId)) {
    try {
      employee = await Employee.findById(employeeId).populate('companyId')
    } catch (error) {
      // Ignore invalid ObjectId errors
    }
  }
  
  // Method 4: If still not found and employeeId looks like an email, try by email (with encryption handling)
  if (!employee && employeeId.includes('@')) {
    const { encrypt, decrypt } = require('../utils/encryption')
    const trimmedEmail = employeeId.trim()
    
    try {
      // Try encrypted email lookup
      const encryptedEmail = encrypt(trimmedEmail)
      employee = await Employee.findOne({ email: encryptedEmail }).populate('companyId')
    } catch (error) {
      // If encryption fails, try decryption matching
      const allEmployees = await Employee.find({ companyId: company._id }).populate('companyId').lean()
      for (const emp of allEmployees) {
        if (emp.email && typeof emp.email === 'string') {
          try {
            const decryptedEmail = decrypt(emp.email)
            if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
              employee = await Employee.findById(emp._id).populate('companyId')
              break
            }
          } catch (error) {
            continue
          }
        }
      }
    }
  }
  
  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}. Please ensure the employee exists and belongs to the company.`)
  }
  
  // Verify employee belongs to this company
  // First, try to get the raw companyId without population
  let employeeRaw = await Employee.findOne({ 
    $or: [
      { id: employeeId },
      { employeeId: employeeId }
    ]
  }).lean()
  
  if (!employeeRaw) {
    throw new Error(`Employee not found: ${employeeId}`)
  }
  
  // Get the companyId directly from the raw document
  const employeeCompanyIdRaw = employeeRaw.companyId
  
  // Convert both to strings for comparison
  const employeeCompanyIdStr = employeeCompanyIdRaw ? employeeCompanyIdRaw.toString() : null
  const companyIdStr = company._id.toString()
  
  console.log(`[addCompanyAdmin] Debug - Employee: ${employeeId}, Employee companyId: ${employeeCompanyIdStr}, Company _id: ${companyIdStr}`)
  
  if (!employeeCompanyIdStr || employeeCompanyIdStr !== companyIdStr) {
    console.error(`[addCompanyAdmin] Company mismatch - Employee companyId: ${employeeCompanyIdStr}, Company _id: ${companyIdStr}`)
    // Don't auto-fix - throw error instead to prevent wrong assignments
    const employeeDisplayId = employeeRaw.employeeId || employeeRaw.id || employeeId
    throw new Error(`Employee ${employeeDisplayId} does not belong to company ${companyId} (${company.name}). Employee is associated with a different company. Please select an employee that belongs to ${company.name}.`)
  }
  
  // Create or update company admin record
  // Use employee._id directly (Mongoose ObjectId)
  // Use raw MongoDB to ensure the reference is correct
  const db = mongoose.connection.db
  
  // First, try to delete any existing record for this company+employee combo
  await db.collection('companyadmins').deleteMany({
    companyId: company._id,
    employeeId: employee._id
  })
  
  // Create new record using raw MongoDB to ensure correct ObjectId reference
  const adminRecord = await db.collection('companyadmins').insertOne({
    companyId: company._id,
    employeeId: employee._id,
    canApproveOrders: canApproveOrders,
    createdAt: new Date(),
    updatedAt: new Date()
  })
  
  console.log(`[addCompanyAdmin] Created admin record:`, {
    adminId: adminRecord.insertedId,
    companyId: company._id.toString(),
    employeeId: employee._id.toString(),
    employeeEmployeeId: employee.employeeId || employee.id
  })
  
  // Verify the record was created correctly
  if (!adminRecord.insertedId) {
    throw new Error(`Failed to create admin record for employee ${employeeId}`)
  }
  
  // Verify it can be found
  const verifyRecord = await db.collection('companyadmins').findOne({ _id: adminRecord.insertedId })
  if (!verifyRecord) {
    throw new Error(`Admin record was created but cannot be found: ${adminRecord.insertedId}`)
  }
  
  console.log(`[addCompanyAdmin] Verified admin record exists with employeeId:`, verifyRecord.employeeId?.toString())
  
  console.log(`Successfully added employee ${employeeId} (${employee.id || employee._id}) as admin for company ${companyId} (canApproveOrders: ${canApproveOrders})`)
}

export async function removeCompanyAdmin(companyId: string, employeeId: string): Promise<void> {
  await connectDB()
  
  if (!employeeId) {
    throw new Error('Employee ID is required')
  }
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }
  
  // Try multiple lookup methods to find the employee
  let employee: any = null
  
  // Method 1: Try by id field (most common)
  employee = await Employee.findOne({ id: employeeId })
  
  // Method 2: If not found, try by employeeId field (business ID like "IND-001")
  if (!employee) {
    employee = await Employee.findOne({ employeeId: employeeId })
  }
  
  // Method 3: If not found and employeeId looks like MongoDB ObjectId, try by _id
  if (!employee && mongoose.Types.ObjectId.isValid(employeeId)) {
    try {
      employee = await Employee.findById(employeeId)
    } catch (error) {
      // Ignore invalid ObjectId errors
    }
  }
  
  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`)
  }
  
  // Force remove: Find and delete the admin record using multiple methods
  const employeeIdStr = employee._id.toString()
  const companyIdStr = company._id.toString()
  
  // Method 1: Try standard lookup
  let result = await CompanyAdmin.findOneAndDelete({
    companyId: company._id,
    employeeId: employee._id,
  })
  
  // Method 2: If not found, get all admins and match by ObjectId string comparison
  if (!result) {
    const allAdmins = await CompanyAdmin.find({ companyId: company._id }).lean()
    
    // Find matching admin by comparing ObjectId strings
    for (const adm of allAdmins) {
      const admCompanyIdStr = adm.companyId ? adm.companyId.toString() : null
      const admEmployeeIdStr = adm.employeeId ? adm.employeeId.toString() : null
      
      // Check if this admin matches both company and employee
      if (admCompanyIdStr === companyIdStr && admEmployeeIdStr === employeeIdStr) {
        // Delete using the admin record's _id
        result = await CompanyAdmin.findByIdAndDelete(adm._id)
        if (result) {
          break
        }
      }
    }
  }
  
  // Method 3: If still not found, try to find by employee id/employeeId fields
  if (!result) {
    // Try to find admin where employeeId matches employee's id or employeeId
    const allAdmins = await CompanyAdmin.find({ companyId: company._id })
      .populate('employeeId', 'id employeeId')
      .lean()
    
    for (const adm of allAdmins) {
      const populatedEmployee = adm.employeeId
      if (populatedEmployee && typeof populatedEmployee === 'object') {
        const empId = populatedEmployee.id || populatedEmployee.employeeId
        if (empId === employee.id || empId === employee.employeeId || empId === employeeId) {
          result = await CompanyAdmin.findByIdAndDelete(adm._id)
          if (result) {
            break
          }
        }
      }
    }
  }
  
  // Method 4: Last resort - delete by employee ObjectId string in raw collection
  if (!result) {
    const db = mongoose.connection.db
    const adminCollection = db.collection('companyadmins')
    const allAdminsRaw = await adminCollection.find({ 
      companyId: company._id 
    }).toArray()
    
    for (const adm of allAdminsRaw) {
      const admEmployeeIdStr = adm.employeeId ? adm.employeeId.toString() : null
      if (admEmployeeIdStr === employeeIdStr) {
        await adminCollection.deleteOne({ _id: adm._id })
        result = { _id: adm._id } // Mark as deleted
        break
      }
    }
  }
  
  if (!result) {
    throw new Error(`Admin relationship not found for employee ${employeeId} (${employee.id || employee.employeeId}) in company ${companyId}`)
  }
}

export async function updateCompanyAdminPrivileges(companyId: string, employeeId: string, canApproveOrders: boolean): Promise<void> {
  await connectDB()
  
  if (!employeeId) {
    throw new Error('Employee ID is required')
  }
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }
  
  // Try multiple lookup methods to find the employee
  let employee: any = null
  
  // Method 1: Try by id field (most common)
  employee = await Employee.findOne({ id: employeeId })
  
  // Method 2: If not found, try by employeeId field (business ID like "IND-001")
  if (!employee) {
    employee = await Employee.findOne({ employeeId: employeeId })
  }
  
  // Method 3: If not found and employeeId looks like MongoDB ObjectId, try by _id
  if (!employee && mongoose.Types.ObjectId.isValid(employeeId)) {
    try {
      employee = await Employee.findById(employeeId)
    } catch (error) {
      // Ignore invalid ObjectId errors
    }
  }
  
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
  
  console.log(`Successfully updated admin privileges for ${employeeId} (${employee.id || employee.employeeId}) in company ${companyId}`)
}

export async function getCompanyAdmins(companyId: string): Promise<any[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    console.log(`[getCompanyAdmins] Company ${companyId} not found, returning empty array`)
    return []
  }
  
  const admins = await CompanyAdmin.find({ companyId: company._id })
    .populate({
      path: 'employeeId',
      select: 'id employeeId firstName lastName email',
      model: 'Employee'
    })
    .lean()
  
  console.log(`[getCompanyAdmins] Found ${admins.length} admins for company ${companyId}`)
  if (admins.length > 0) {
    console.log(`[getCompanyAdmins] Admin employeeIds (raw):`, admins.map((a: any) => ({
      employeeId: a.employeeId,
      isNull: a.employeeId === null,
      isObject: typeof a.employeeId === 'object',
      populated: a.employeeId?.employeeId || 'N/A'
    })))
  }
  
  // Filter out admins with null or invalid employeeId
  // Also manually populate if populate failed
  const validAdmins = []
  const { decrypt } = require('../utils/encryption')
  
  for (const admin of admins) {
    if (!admin.employeeId) {
      console.log(`[getCompanyAdmins] Admin has null employeeId, trying manual lookup:`, admin._id)
      // Use raw MongoDB collection to get the actual ObjectId
      const db = mongoose.connection.db
      const rawAdmin = await db.collection('companyadmins').findOne({ _id: admin._id })
      if (rawAdmin && rawAdmin.employeeId) {
        console.log(`[getCompanyAdmins] Raw admin employeeId:`, rawAdmin.employeeId, 'type:', typeof rawAdmin.employeeId)
        
        // Convert employeeId to string for reliable comparison
        const employeeIdStr = rawAdmin.employeeId.toString()
        
        // Find all employees and match by string comparison (more reliable than direct ObjectId query)
        const allEmployees = await db.collection('employees').find({}).toArray()
        const employee = allEmployees.find((e: any) => e._id.toString() === employeeIdStr)
        
        if (employee) {
          console.log(`[getCompanyAdmins] Found employee via string matching: ${employee.employeeId || employee.id || employee._id}`)
          // Convert to format expected by the rest of the code
          admin.employeeId = {
            _id: employee._id,
            id: employee.id || employee._id.toString(),
            employeeId: employee.employeeId,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            companyName: employee.companyName
          }
          validAdmins.push(admin)
          console.log(`[getCompanyAdmins] Manually populated employee: ${employee.employeeId || employee.id || employee._id}`)
        } else {
          console.log(`[getCompanyAdmins] Employee not found for admin:`, admin._id, 'employeeId:', employeeIdStr)
          // Don't delete - the employee might exist but lookup is failing
          console.log(`[getCompanyAdmins] Keeping admin record - employee lookup failed but record exists`)
        }
      } else {
        console.log(`[getCompanyAdmins] Filtering out admin with null employeeId:`, admin._id)
      }
      continue
    }
    
    // If populated, check if employee exists and has required fields
    if (typeof admin.employeeId === 'object') {
      if (!admin.employeeId._id && !admin.employeeId.id && !admin.employeeId.employeeId) {
        console.log(`[getCompanyAdmins] Invalid populated employee, trying manual lookup:`, admin._id)
        // Try manual lookup using raw collection
        const db = mongoose.connection.db
        const rawAdmin = await db.collection('companyadmins').findOne({ _id: admin._id })
        if (rawAdmin && rawAdmin.employeeId) {
          let employee = await Employee.findById(rawAdmin.employeeId)
            .select('id employeeId firstName lastName email')
            .lean()
          
          // If not found, try raw collection
          if (!employee) {
            const employeeByMongoId = await db.collection('employees').findOne({ _id: rawAdmin.employeeId })
            if (employeeByMongoId) {
              employee = employeeByMongoId
            }
          }
          
          if (employee) {
            admin.employeeId = employee
            validAdmins.push(admin)
            console.log(`[getCompanyAdmins] Manually populated employee: ${employee.employeeId || employee.id || employee._id}`)
            continue
          }
        }
        console.log(`[getCompanyAdmins] Filtering out admin with invalid populated employee:`, admin._id)
        continue
      }
    }
    
    validAdmins.push(admin)
  }
  
  console.log(`[getCompanyAdmins] Valid admins after filtering: ${validAdmins.length}`)
  
  // Decrypt employee data and format properly
  const formattedAdmins = validAdmins.map((admin: any) => {
    const adminObj: any = {
      employeeId: admin.employeeId?._id?.toString() || admin.employeeId?.toString() || admin.employeeId,
      canApproveOrders: admin.canApproveOrders || false,
      companyId: admin.companyId?.toString() || admin.companyId,
    }
    
    // If employee is populated, decrypt and add employee data
    if (admin.employeeId && typeof admin.employeeId === 'object') {
      const emp = admin.employeeId
      const sensitiveFields = ['email', 'firstName', 'lastName']
      
      adminObj.employee = {
        id: emp.id,
        employeeId: emp.employeeId,
        email: emp.email || '',
        firstName: emp.firstName || '',
        lastName: emp.lastName || '',
        companyName: emp.companyName || ''
      }
      
      // Decrypt sensitive fields
      for (const field of sensitiveFields) {
        if (adminObj.employee[field] && typeof adminObj.employee[field] === 'string' && adminObj.employee[field].includes(':')) {
          try {
            adminObj.employee[field] = decrypt(adminObj.employee[field])
          } catch (error) {
            // Keep original if decryption fails
            console.warn(`Failed to decrypt ${field} for employee ${emp.id}:`, error)
          }
        }
      }
    }
    
    return adminObj
  })
  
  return formattedAdmins
}

export async function isCompanyAdmin(email: string, companyId: string): Promise<boolean> {
  await connectDB()
  
  // Since email is encrypted, we need to find employee by decrypting
  const { encrypt, decrypt } = require('../utils/encryption')
  const trimmedEmail = email.trim()
  let encryptedEmail: string
  
  try {
    encryptedEmail = encrypt(trimmedEmail)
  } catch (error) {
    encryptedEmail = ''
  }
  
  // Try finding with encrypted email first
  let employee = await Employee.findOne({ email: encryptedEmail }).lean()
  
  // If not found, try decryption matching
  if (!employee && encryptedEmail) {
    const allEmployees = await Employee.find({}).lean()
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const decryptedEmail = decrypt(emp.email)
          if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
            employee = emp
            break
          }
        } catch (error) {
          continue
        }
      }
    }
  }
  
  if (!employee) {
    return false
  }
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    return false
  }
  
  // Use raw MongoDB collection for reliable lookup
  const db = mongoose.connection.db
  const employeeIdStr = (employee._id || employee.id).toString()
  const companyIdStr = company._id.toString()
  
  // Find all admins and match by string comparison
  const allAdmins = await db.collection('companyadmins').find({}).toArray()
  const admin = allAdmins.find((a: any) => 
    a.employeeId && 
    a.employeeId.toString() === employeeIdStr &&
    a.companyId &&
    a.companyId.toString() === companyIdStr
  )
  
  return !!admin
}

export async function canApproveOrders(email: string, companyId: string): Promise<boolean> {
  await connectDB()
  
  // Since email is encrypted, we need to find employee by decrypting
  const { encrypt, decrypt } = require('../utils/encryption')
  const trimmedEmail = email.trim()
  let encryptedEmail: string
  
  try {
    encryptedEmail = encrypt(trimmedEmail)
  } catch (error) {
    encryptedEmail = ''
  }
  
  // Try finding with encrypted email first
  let employee = await Employee.findOne({ email: encryptedEmail }).lean()
  
  // If not found, try decryption matching
  if (!employee && encryptedEmail) {
    const allEmployees = await Employee.find({}).lean()
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const decryptedEmail = decrypt(emp.email)
          if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
            employee = emp
            break
          }
        } catch (error) {
          continue
        }
      }
    }
  }
  
  if (!employee) {
    return false
  }
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    return false
  }
  
  // Use raw MongoDB collection for reliable lookup (similar to isCompanyAdmin)
  const db = mongoose.connection.db
  if (!db) {
    // Fallback to Mongoose if raw DB not available
  const admin = await CompanyAdmin.findOne({
    companyId: company._id,
    employeeId: employee._id,
  })
    return admin?.canApproveOrders || false
  }
  
  const employeeIdStr = (employee._id || employee.id).toString()
  const companyIdStr = company._id.toString()
  
  // Find all admins and match by string comparison
  const allAdmins = await db.collection('companyadmins').find({}).toArray()
  const admin = allAdmins.find((a: any) => 
    a.employeeId && 
    a.employeeId.toString() === employeeIdStr &&
    a.companyId &&
    a.companyId.toString() === companyIdStr
  )
  
  return admin?.canApproveOrders || false
}

// ========== BRANCH ADMIN AUTHORIZATION FUNCTIONS ==========

/**
 * Check if an employee is a Branch Admin for a specific branch
 * @param email Employee email
 * @param branchId Branch ID (string)
 * @returns true if employee is Branch Admin for the branch
 */
export async function isBranchAdmin(email: string, branchId: string): Promise<boolean> {
  await connectDB()
  
  // Find employee by email (handle encryption)
  const { encrypt, decrypt } = require('../utils/encryption')
  const trimmedEmail = email.trim()
  let encryptedEmail: string
  
  try {
    encryptedEmail = encrypt(trimmedEmail)
  } catch (error) {
    encryptedEmail = ''
  }
  
  // Try finding with encrypted email first
  let employee = await Employee.findOne({ email: encryptedEmail }).lean()
  
  // If not found, try decryption matching
  if (!employee && encryptedEmail) {
    const allEmployees = await Employee.find({}).lean()
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const decryptedEmail = decrypt(emp.email)
          if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
            employee = emp
            break
          }
        } catch (error) {
          continue
        }
      }
    }
  }
  
  if (!employee) {
    return false
  }
  
  // Find branch
  const Branch = require('../models/Branch').default
  const branch = await Branch.findOne({ id: branchId })
  if (!branch) {
    return false
  }
  
  // Check if employee is the Branch Admin
  const employeeIdStr = (employee._id || employee.id).toString()
  const branchAdminIdStr = branch.adminId?.toString()
  
  return employeeIdStr === branchAdminIdStr
}

/**
 * Get the branch for which an employee is Branch Admin
 * @param email Employee email
 * @returns Branch object if employee is a Branch Admin, null otherwise
 */
export async function getBranchByAdminEmail(email: string): Promise<any | null> {
  await connectDB()
  
  // Find employee by email (handle encryption)
  const { encrypt, decrypt } = require('../utils/encryption')
  const trimmedEmail = email.trim()
  let encryptedEmail: string
  
  try {
    encryptedEmail = encrypt(trimmedEmail)
  } catch (error) {
    encryptedEmail = ''
  }
  
  // Try finding with encrypted email first
  let employee = await Employee.findOne({ email: encryptedEmail }).lean()
  
  // If not found, try decryption matching
  if (!employee && encryptedEmail) {
    const allEmployees = await Employee.find({}).lean()
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const decryptedEmail = decrypt(emp.email)
          if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
            employee = emp
            break
          }
        } catch (error) {
          continue
        }
      }
    }
  }
  
  if (!employee) {
    return null
  }
  
  // Find branch where this employee is admin
  const Branch = require('../models/Branch').default
  const branch = await Branch.findOne({ adminId: employee._id })
    .populate('companyId', 'id name')
    .lean()
  
  if (!branch) {
    return null
  }
  
  return toPlainObject(branch)
}

// ========== LOCATION ADMIN AUTHORIZATION FUNCTIONS ==========

/**
 * Check if an employee is a Location Admin for a specific location
 * @param email Employee email
 * @param locationId Location ID (6-digit numeric string)
 * @returns true if employee is Location Admin for the location
 */
export async function isLocationAdmin(email: string, locationId: string): Promise<boolean> {
  await connectDB()
  
  // Find employee by email (handle encryption)
  const { encrypt, decrypt } = require('../utils/encryption')
  const trimmedEmail = email.trim()
  let encryptedEmail: string
  
  try {
    encryptedEmail = encrypt(trimmedEmail)
  } catch (error) {
    encryptedEmail = ''
  }
  
  // Try finding with encrypted email first
  let employee = await Employee.findOne({ email: encryptedEmail }).lean()
  
  // If not found, try decryption matching
  if (!employee && encryptedEmail) {
    const allEmployees = await Employee.find({}).lean()
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const decryptedEmail = decrypt(emp.email)
          if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
            employee = emp
            break
          }
        } catch (error) {
          continue
        }
      }
    }
  }
  
  if (!employee) {
    return false
  }
  
  // Find location
  const location = await Location.findOne({ id: locationId })
  if (!location) {
    return false
  }
  
  // Check if employee is the Location Admin
  const employeeIdStr = (employee._id || employee.id).toString()
  const locationAdminIdStr = location.adminId?.toString()
  
  return employeeIdStr === locationAdminIdStr
}

/**
 * Get the location ID for which an employee is Location Admin
 * @param email Employee email
 * @returns Location ID if employee is a Location Admin, null otherwise
 */
export async function getLocationByAdminEmail(email: string): Promise<any | null> {
  await connectDB()
  
  // Find employee by email (handle encryption)
  const { encrypt, decrypt } = require('../utils/encryption')
  const trimmedEmail = email.trim()
  let encryptedEmail: string
  
  try {
    encryptedEmail = encrypt(trimmedEmail)
  } catch (error) {
    encryptedEmail = ''
  }
  
  // Try finding with encrypted email first
  let employee = await Employee.findOne({ email: encryptedEmail }).lean()
  
  // If not found, try decryption matching
  if (!employee && encryptedEmail) {
    const allEmployees = await Employee.find({}).lean()
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const decryptedEmail = decrypt(emp.email)
          if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
            employee = emp
            break
          }
        } catch (error) {
          continue
        }
      }
    }
  }
  
  if (!employee) {
    return null
  }
  
  // Find location where this employee is admin
  const location = await Location.findOne({ adminId: employee._id })
    .populate('companyId', 'id name')
    .populate('adminId', 'id employeeId firstName lastName email')
    .lean()
  
  return location ? toPlainObject(location) : null
}

/**
 * Check if an employee is a regular employee (not Company Admin or Location Admin)
 * Used for enableEmployeeOrder enforcement: only regular employees are restricted
 * @param email Employee email
 * @param companyId Company ID (6-digit numeric string)
 * @returns true if employee is a regular employee (not admin)
 */
export async function isRegularEmployee(email: string, companyId: string): Promise<boolean> {
  await connectDB()
  
  // Check if employee is Company Admin
  const isAdmin = await isCompanyAdmin(email, companyId)
  if (isAdmin) {
    return false // Company Admin is not a regular employee
  }
  
  // Check if employee is Location Admin
  const location = await getLocationByAdminEmail(email)
  if (location) {
    return false // Location Admin is not a regular employee
  }
  
  // Check if employee is Branch Admin (if branch functionality exists)
  // Note: Branch functionality may have been replaced by Location, but check for backward compatibility
  try {
    const branch = await getBranchByAdminEmail(email)
    if (branch) {
      return false // Branch Admin is not a regular employee
    }
  } catch (error) {
    // Branch functionality might not exist, ignore
  }
  
  // If not any type of admin, it's a regular employee
  return true
}

/**
 * Verify that an employee belongs to a specific location
 * Used for Location Admin authorization: Location Admin can only manage employees of their location
 * @param employeeId Employee ID (6-digit numeric string)
 * @param locationId Location ID (6-digit numeric string)
 * @returns true if employee belongs to the location
 */
export async function isEmployeeInLocation(employeeId: string, locationId: string): Promise<boolean> {
  await connectDB()
  
  const employee = await Employee.findOne({ employeeId: employeeId })
  if (!employee) {
    return false
  }
  
  const location = await Location.findOne({ id: locationId })
  if (!location) {
    return false
  }
  
  // Check if employee's locationId matches
  if (!employee.locationId) {
    return false // Employee has no location assigned
  }
  
  const employeeLocationIdStr = employee.locationId.toString()
  const locationIdStr = location._id.toString()
  
  return employeeLocationIdStr === locationIdStr
}

/**
 * Get all employees for a specific location
 * @param locationId Location ID (6-digit numeric string or ObjectId)
 * @returns Array of employees
 */
export async function getEmployeesByLocation(locationId: string): Promise<any[]> {
  await connectDB()
  
  // Find location by id (string) - locationId is always a 6-digit string like "400006"
  // Do NOT try to use it as ObjectId (_id) as it will cause cast errors
  const location = await Location.findOne({ id: locationId })
  
  if (!location) {
    console.warn(`[getEmployeesByLocation] Location not found: ${locationId}`)
    return []
  }
  
  console.log(`[getEmployeesByLocation] Found location: ${location.id} (${location._id}), name: ${location.name}`)
  console.log(`[getEmployeesByLocation] Location companyId type: ${typeof location.companyId}, value:`, location.companyId)
  
  // Find employees with this locationId (using ObjectId)
  let employees = await Employee.find({ locationId: location._id })
    .populate('companyId', 'id name')
    .populate('locationId', 'id name')
    .sort({ employeeId: 1 })
    .lean()
  
  console.log(`[getEmployeesByLocation] Found ${employees.length} employees by locationId ObjectId`)
  
  // Also try matching by location.id string if employees have locationId populated with id field
  if (employees.length === 0) {
    // Extract companyId ObjectId properly - handle both populated and non-populated cases
    let companyObjectId = null
    if (location.companyId) {
      if (typeof location.companyId === 'object') {
        // Populated: { _id: ObjectId, id: '100004', name: '...' }
        companyObjectId = location.companyId._id || location.companyId
      } else if (typeof location.companyId === 'string') {
        // ObjectId string or company ID string
        if (location.companyId.length === 24 && /^[0-9a-fA-F]{24}$/.test(location.companyId)) {
          // It's an ObjectId string
          const mongoose = require('mongoose')
          companyObjectId = new mongoose.Types.ObjectId(location.companyId)
        } else {
          // It's a company ID string (like '100004'), need to look up the company
          const Company = require('../models/Company').default
          const company = await Company.findOne({ id: location.companyId }).select('_id').lean()
          if (company) {
            companyObjectId = company._id
          }
        }
      }
    }
    
    if (!companyObjectId) {
      console.warn(`[getEmployeesByLocation] Could not extract companyId ObjectId from location. Location companyId:`, location.companyId)
      // Try to get company by location's companyId string if available
      if (location.companyId && typeof location.companyId === 'object' && location.companyId.id) {
        const Company = require('../models/Company').default
        const company = await Company.findOne({ id: location.companyId.id }).select('_id').lean()
        if (company) {
          companyObjectId = company._id
        }
      }
    }
    
    if (!companyObjectId) {
      console.error(`[getEmployeesByLocation] Cannot query employees: no valid companyId ObjectId found`)
      return []
    }
    
    console.log(`[getEmployeesByLocation] Querying employees for company ObjectId: ${companyObjectId}`)
    const allCompanyEmployees = await Employee.find({ 
      companyId: companyObjectId
    })
      .populate('companyId', 'id name')
      .populate('locationId', 'id name')
      .sort({ employeeId: 1 })
      .lean()
    
    // Filter employees where locationId.id matches location.id
    const matchedByLocationIdString = allCompanyEmployees.filter((emp: any) => {
      if (emp.locationId) {
        const empLocationId = typeof emp.locationId === 'object' 
          ? (emp.locationId.id || emp.locationId._id?.toString())
          : emp.locationId
        return empLocationId === location.id || empLocationId === location._id?.toString()
      }
      return false
    })
    
    if (matchedByLocationIdString.length > 0) {
      console.log(`[getEmployeesByLocation] Found ${matchedByLocationIdString.length} employees by locationId string match`)
      employees = matchedByLocationIdString
    }
  }
  
  // Fallback: If no employees found by locationId, try matching by location name (text field)
  // This handles cases where employees might not have locationId set but have location text field
  if (employees.length === 0) {
    const locationName = location.name
    console.log(`[getEmployeesByLocation] Trying fallback: searching by location name "${locationName}"`)
    
    // Extract key location identifiers from location name
    // Examples: "ICICI Bank Chennai Branch" -> ["chennai"]
    //           "Mumbai Office" -> ["mumbai"]
    const locationNameLower = locationName.toLowerCase()
    const locationNameParts = locationNameLower.split(/\s+/)
    
    // Find city/location keywords (exclude common words)
    const excludeWords = ['bank', 'branch', 'office', 'location', 'icici', 'indigo', 'company', 'ltd', 'limited']
    const keyWords = locationNameParts
      .filter((part: string) => part.length > 2 && !excludeWords.includes(part))
      .map((part: string) => part.trim())
    
    // Also try city name from location if available
    if (location.city) {
      keyWords.push(location.city.toLowerCase())
    }
    
    console.log(`[getEmployeesByLocation] Searching for employees with location containing keywords:`, keyWords)
    
    // Get all employees for the same company as the location
    // Extract companyId ObjectId properly - handle both populated and non-populated cases
    let companyObjectId = null
    if (location.companyId) {
      if (typeof location.companyId === 'object') {
        // Populated: { _id: ObjectId, id: '100004', name: '...' }
        companyObjectId = location.companyId._id || location.companyId
      } else if (typeof location.companyId === 'string') {
        // ObjectId string or company ID string
        if (location.companyId.length === 24 && /^[0-9a-fA-F]{24}$/.test(location.companyId)) {
          // It's an ObjectId string
          const mongoose = require('mongoose')
          companyObjectId = new mongoose.Types.ObjectId(location.companyId)
        } else {
          // It's a company ID string (like '100004'), need to look up the company
          const Company = require('../models/Company').default
          const company = await Company.findOne({ id: location.companyId }).select('_id').lean()
          if (company) {
            companyObjectId = company._id
          }
        }
      }
    }
    
    if (!companyObjectId) {
      console.warn(`[getEmployeesByLocation] Location has no valid companyId, cannot filter employees. Location companyId:`, location.companyId)
      return []
    }
    
    console.log(`[getEmployeesByLocation] Querying employees for company ObjectId: ${companyObjectId}`)
    const allCompanyEmployees = await Employee.find({ companyId: companyObjectId })
      .populate('companyId', 'id name')
      .populate('locationId', 'id name')
      .sort({ employeeId: 1 })
      .lean()
    
    console.log(`[getEmployeesByLocation] Found ${allCompanyEmployees.length} total employees for company`)
    
    // Location field is NOT encrypted (not employee PII) - use as plaintext
    const filteredByLocationName = allCompanyEmployees.filter((emp: any) => {
      if (!emp.location) return false
      
      // Location is stored as plaintext - no decryption needed
      const empLocationText = emp.location
      const empLocationLower = empLocationText.toLowerCase()
      
      // Check if any keyword appears in employee location
      const matchesKeyword = keyWords.some((keyword: string) => 
        empLocationLower.includes(keyword) || keyword.includes(empLocationLower)
      )
      
      // Also check direct/partial matches
      const directMatch = empLocationLower === locationNameLower ||
                         empLocationLower.includes(locationNameLower) ||
                         locationNameLower.includes(empLocationLower)
      
      if (matchesKeyword || directMatch) {
        console.log(`[getEmployeesByLocation] Matched employee ${emp.employeeId || emp.id}: location="${empLocationText}" with location name="${locationName}"`)
        return true
      }
      return false
    })
    
    if (filteredByLocationName.length > 0) {
      console.log(`[getEmployeesByLocation] Found ${filteredByLocationName.length} employees by location name fallback`)
      employees = filteredByLocationName
    } else {
      console.warn(`[getEmployeesByLocation] No employees found even with fallback matching. Location: "${locationName}", Keywords:`, keyWords)
      console.log(`[getEmployeesByLocation] Sample employee locations:`, 
        allCompanyEmployees.slice(0, 5).map((e: any) => ({ 
          id: e.employeeId || e.id, 
          location: e.location,
          locationId: e.locationId ? (e.locationId.id || e.locationId) : 'none'
        }))
      )
    }
  }
  
  // Decrypt employee fields (required since we use .lean())
  // Note: location field is NOT normally encrypted (not in sensitiveFields), but handle edge cases
  const decryptedEmployees = employees.map((e: any) => {
    if (!e) return null
    const sensitiveFields = ['email', 'mobile', 'address', 'firstName', 'lastName', 'designation']
    for (const field of sensitiveFields) {
      if (e[field] && typeof e[field] === 'string' && e[field].includes(':')) {
        try {
          e[field] = decrypt(e[field])
        } catch (error) {
          // If decryption fails, keep original value
        }
      }
    }
    // Location field is NOT encrypted (not employee PII) - no decryption needed
    return e
  }).filter((e: any) => e !== null)
  
  console.log(`[getEmployeesByLocation] Returning ${decryptedEmployees.length} employees after decryption`)
  
  return decryptedEmployees.map((e: any) => toPlainObject(e))
}

export async function getCompanyByAdminEmail(email: string): Promise<any | null> {
  await connectDB()
  
  if (!email) {
    return null
  }
  
  // Use getEmployeeByEmail which has robust fallback logic for finding employees
  // This ensures we can find the employee even if encryption doesn't match exactly
  const employee = await getEmployeeByEmail(email)
  
  if (!employee) {
    console.warn(`[getCompanyByAdminEmail] Employee not found for email: ${email}`)
    return null
  }
  
  // Find company where this employee is an admin
  // We need the employee's _id (ObjectId) to match against admin records
  // Since getEmployeeByEmail returns a plain object, we need to fetch the raw employee document
  const db = mongoose.connection.db
  if (!db) {
    console.error(`[getCompanyByAdminEmail] Database connection not available`)
    return null
  }
  
  // Get the employee's _id from the database using the employee's id or email
  let employeeId: any = null
  
  // Try to get _id from raw MongoDB document using employee.id
  if (employee.id) {
    const rawEmployee = await db.collection('employees').findOne({ id: employee.id })
    if (rawEmployee && rawEmployee._id) {
      employeeId = rawEmployee._id
    }
  }
  
  // Fallback: try to get _id using encrypted email
  if (!employeeId && employee.email) {
    const { encrypt } = require('../utils/encryption')
    try {
      const encryptedEmail = encrypt(employee.email.trim())
      const rawEmployee = await db.collection('employees').findOne({ email: encryptedEmail })
      if (rawEmployee && rawEmployee._id) {
        employeeId = rawEmployee._id
      }
    } catch (error) {
      console.warn(`[getCompanyByAdminEmail] Failed to encrypt email for lookup:`, error)
    }
  }
  
  if (!employeeId) {
    console.warn(`[getCompanyByAdminEmail] Could not find employee _id for employee:`, employee.id || employee.employeeId)
    return null
  }
  
  // Convert to string for reliable comparison
  const employeeIdStr = employeeId.toString()
  console.log(`[getCompanyByAdminEmail] Looking for admin record with employeeId: ${employeeIdStr}`)
  
  // Find all admins and match by string comparison (same approach as getCompanyAdmins)
  const allAdmins = await db.collection('companyadmins').find({}).toArray()
  console.log(`[getCompanyByAdminEmail] Found ${allAdmins.length} total admin records`)
  
  // Debug: log all admin employeeIds
  console.log(`[getCompanyByAdminEmail] Admin employeeIds:`, allAdmins.map((a: any) => ({
    employeeId: a.employeeId?.toString(),
    companyId: a.companyId?.toString()
  })))
  
  const adminRecord = allAdmins.find((a: any) => {
    if (!a.employeeId) return false
    const adminEmployeeIdStr = a.employeeId.toString()
    const matches = adminEmployeeIdStr === employeeIdStr
    if (matches) {
      console.log(`[getCompanyByAdminEmail] Found matching admin record:`, {
        adminEmployeeId: adminEmployeeIdStr,
        companyId: a.companyId?.toString(),
        canApproveOrders: a.canApproveOrders
      })
    }
    return matches
  })
  
  if (!adminRecord) {
    console.warn(`[getCompanyByAdminEmail] No admin record found for employee: ${employeeIdStr}`)
    console.warn(`[getCompanyByAdminEmail] Employee details:`, {
      id: employee.id,
      employeeId: employee.employeeId,
      _id: employee._id?.toString(),
      email: email
    })
    return null
  }
  
  // Get the company using string comparison (same issue as employee lookup)
  const companyIdStr = adminRecord.companyId.toString()
  console.log(`[getCompanyByAdminEmail] Looking for company with _id: ${companyIdStr}`)
  
  const allCompanies = await db.collection('companies').find({}).toArray()
  console.log(`[getCompanyByAdminEmail] Found ${allCompanies.length} companies`)
  
  const companyDoc = allCompanies.find((c: any) => c._id.toString() === companyIdStr)
  
  if (!companyDoc) {
    console.error(`[getCompanyByAdminEmail] Company not found for admin record: ${companyIdStr}`)
    console.error(`[getCompanyByAdminEmail] Available company _ids:`, allCompanies.map((c: any) => c._id.toString()))
    return null
  }
  
  console.log(`[getCompanyByAdminEmail] Found company: ${companyDoc.name} (id: ${companyDoc.id}, type: ${typeof companyDoc.id})`)
  
  // Convert to format expected by the rest of the code
  const company = toPlainObject(companyDoc)
  
  // Ensure company.id is preserved (should be numeric now)
  if (companyDoc.id !== undefined) {
    company.id = companyDoc.id
  }
  
  console.log(`[getCompanyByAdminEmail] Returning company:`, {
    id: company.id,
    idType: typeof company.id,
    name: company.name
  })
  return company
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
    .populate('locationId', 'id name address city state pincode')
    .lean()

  // Since we used .lean(), the post hooks don't run, so we need to manually decrypt sensitive fields
  const { decrypt } = require('../utils/encryption')
  const decryptedEmployees = employees.map((e: any) => {
    const sensitiveFields = ['email', 'mobile', 'address', 'firstName', 'lastName', 'designation']
    for (const field of sensitiveFields) {
      if (e[field] && typeof e[field] === 'string' && e[field].includes(':')) {
        try {
          e[field] = decrypt(e[field])
        } catch (error) {
          console.warn(`Failed to decrypt field ${field} for employee ${e.id}:`, error)
        }
      }
    }
    return e
  })

  return decryptedEmployees.map((e: any) => toPlainObject(e))
}

export async function getEmployeeByEmail(email: string): Promise<any | null> {
  await connectDB()
  
  if (!email) {
    return null
  }
  
  // Trim whitespace
  const trimmedEmail = email.trim()
  
  // Since email is encrypted in the database, we need to encrypt the search term
  // or search through all employees and decrypt to match
  // The more efficient approach is to encrypt the search term and query
  
  const { encrypt, decrypt } = require('../utils/encryption')
  let encryptedEmail: string
  
  try {
    encryptedEmail = encrypt(trimmedEmail)
  } catch (error) {
    console.warn('Failed to encrypt email for query, will use decryption matching:', error)
    encryptedEmail = ''
  }
  
  // Try finding with encrypted email first (faster)
  // Use raw MongoDB query to get the employee with companyId ObjectId
  const db = mongoose.connection.db
  let employee: any = null
  
  if (db && encryptedEmail) {
    // First, try with encrypted email (for encrypted data)
    let rawEmployee = await db.collection('employees').findOne({ email: encryptedEmail })
    
    // If not found with encrypted email, try with plain text email (for plain text data)
    if (!rawEmployee) {
      rawEmployee = await db.collection('employees').findOne({ email: trimmedEmail })
    }
    
    // Also try case-insensitive plain text search
    if (!rawEmployee) {
      rawEmployee = await db.collection('employees').findOne({ 
        email: { $regex: new RegExp(`^${trimmedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
      })
    }
    
    if (rawEmployee) {
      console.log(`[getEmployeeByEmail] Raw employee companyId:`, rawEmployee.companyId, 'Type:', typeof rawEmployee.companyId)
      
      // Now fetch with Mongoose to get populated fields and decryption
      // Use the email from rawEmployee (could be encrypted or plain text)
      const emailToSearch = rawEmployee.email
      employee = await Employee.findOne({ email: emailToSearch })
        .populate('companyId', 'id name')
        .populate('locationId', 'id name address city state pincode')
        .lean()
      
      console.log(`[getEmployeeByEmail] Mongoose employee companyId after populate:`, employee?.companyId, 'Type:', typeof employee?.companyId)
      
      // ALWAYS ensure companyId is set from raw document if it exists
      if (employee && rawEmployee.companyId) {
        const rawCompanyIdStr = rawEmployee.companyId.toString()
        
        // Check if companyId was properly populated or is null/missing
        if (!employee.companyId || 
            employee.companyId === null ||
            (typeof employee.companyId === 'object' && !employee.companyId.id && !employee.companyId._id) ||
            (typeof employee.companyId === 'object' && employee.companyId._id && employee.companyId._id.toString() !== rawCompanyIdStr)) {
          // Populate failed, is null, or incorrect - manually look up the company
          console.log(`[getEmployeeByEmail] Populate failed or companyId is null, manually looking up company with ObjectId: ${rawCompanyIdStr}`)
          const allCompanies = await db.collection('companies').find({}).toArray()
          const companyDoc = allCompanies.find((c: any) => c._id.toString() === rawCompanyIdStr)
          if (companyDoc) {
            // Set directly to string ID to avoid any conversion issues
            employee.companyId = companyDoc.id
            console.log(`[getEmployeeByEmail] Manually set companyId to string ID: ${companyDoc.id} for employee ${employee.id || employee.employeeId}`)
          } else {
            console.warn(`[getEmployeeByEmail] Company not found for ObjectId: ${rawCompanyIdStr}`)
            // Set it as the ObjectId string so conversion logic can handle it
            employee.companyId = rawCompanyIdStr
          }
        } else if (employee.companyId && typeof employee.companyId === 'object' && employee.companyId.id) {
          // Already populated correctly, but ensure it's the string ID
          employee.companyId = employee.companyId.id
          console.log(`[getEmployeeByEmail] CompanyId already populated, using id field: ${employee.companyId}`)
        }
      } else if (employee && !employee.companyId && rawEmployee.companyId) {
        // Employee from Mongoose doesn't have companyId, but raw document does
        console.log(`[getEmployeeByEmail] Mongoose employee missing companyId, fetching from raw document...`)
        const rawCompanyIdStr = rawEmployee.companyId.toString()
        const allCompanies = await db.collection('companies').find({}).toArray()
        const companyDoc = allCompanies.find((c: any) => c._id.toString() === rawCompanyIdStr)
        if (companyDoc) {
          employee.companyId = companyDoc.id
          console.log(`[getEmployeeByEmail] Set companyId from raw document: ${companyDoc.id}`)
        }
      }
    }
  }
  
  // Fallback: if raw query didn't work, try Mongoose query
  if (!employee && encryptedEmail) {
    employee = await Employee.findOne({ email: encryptedEmail })
      .populate('companyId', 'id name')
      .populate('locationId', 'id name address city state pincode')
      .lean()
    
    // If employee found but companyId is not populated (ObjectId instead of object), populate it manually
    if (employee && employee.companyId) {
      let companyIdStr: string | null = null
      
      if (typeof employee.companyId === 'object' && employee.companyId !== null) {
        if (employee.companyId.id) {
          // Already populated correctly
          companyIdStr = null // No need to fix
        } else if (employee.companyId._id) {
          companyIdStr = employee.companyId._id.toString()
        } else if (employee.companyId.toString) {
          companyIdStr = employee.companyId.toString()
        }
      } else if (typeof employee.companyId === 'string') {
        companyIdStr = employee.companyId
      }
      
      if (companyIdStr && /^[0-9a-fA-F]{24}$/.test(companyIdStr)) {
        // It's an ObjectId string, need to find the company
        const db = mongoose.connection.db
        if (db) {
          const allCompanies = await db.collection('companies').find({}).toArray()
          const companyDoc = allCompanies.find((c: any) => c._id.toString() === companyIdStr)
          if (companyDoc) {
            employee.companyId = {
              _id: companyDoc._id,
              id: companyDoc.id,
              name: companyDoc.name
            }
            console.log(`[getEmployeeByEmail] Manually populated companyId (fallback): ${companyDoc.id}`)
          }
        }
      }
    }
  }
  
  // If not found with encrypted email, try case-insensitive encrypted search
  if (!employee && encryptedEmail) {
    // For encrypted values, we can't do regex search easily
    // So we'll fall back to fetching all and decrypting (less efficient but works)
    const allEmployees = await Employee.find({})
      .populate('companyId', 'id name')
      .populate('locationId', 'id name address city state pincode')
      .lean()
    
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const decryptedEmail = decrypt(emp.email)
          // Check if decryption succeeded (decrypted should be different from encrypted and not contain ':')
          const isDecrypted = decryptedEmail !== emp.email && !decryptedEmail.includes(':') && decryptedEmail.length < 200
          if (isDecrypted && decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
            employee = emp
            // Decrypt all sensitive fields for this employee
            if (employee.firstName && typeof employee.firstName === 'string' && employee.firstName.includes(':')) {
              try { employee.firstName = decrypt(employee.firstName) } catch {}
            }
            if (employee.lastName && typeof employee.lastName === 'string' && employee.lastName.includes(':')) {
              try { employee.lastName = decrypt(employee.lastName) } catch {}
            }
            if (employee.mobile && typeof employee.mobile === 'string' && employee.mobile.includes(':')) {
              try { employee.mobile = decrypt(employee.mobile) } catch {}
            }
            if (employee.address && typeof employee.address === 'string' && employee.address.includes(':')) {
              try { employee.address = decrypt(employee.address) } catch {}
            }
            if (employee.designation && typeof employee.designation === 'string' && employee.designation.includes(':')) {
              try { employee.designation = decrypt(employee.designation) } catch {}
            }
            // If companyId is not populated, populate it manually
            if (employee.companyId && typeof employee.companyId === 'object' && !employee.companyId.id) {
              const db = mongoose.connection.db
              if (db) {
                const companyIdStr = employee.companyId.toString()
                const allCompanies = await db.collection('companies').find({}).toArray()
                const companyDoc = allCompanies.find((c: any) => c._id.toString() === companyIdStr)
                if (companyDoc) {
                  employee.companyId = {
                    _id: companyDoc._id,
                    id: companyDoc.id,
                    name: companyDoc.name
                  }
                }
              }
            }
            break
          }
        } catch (error) {
          // Skip employees with decryption errors
          continue
        }
      }
    }
  }

  if (!employee) {
    return null
  }
  
  // ALWAYS ensure companyId is set from raw document BEFORE toPlainObject
  // This is critical because Mongoose populate might fail or return null
  if (employee && db && encryptedEmail) {
    // Get raw document to ensure we have companyId
    const rawEmp = await db.collection('employees').findOne({ email: encryptedEmail })
    if (rawEmp && rawEmp.companyId) {
      const rawCompanyIdStr = rawEmp.companyId.toString()
      
      // Only set if employee.companyId is missing, null, or not the correct company ID
      // Note: company.id is now numeric, so we check for numeric values
      const needsUpdate = !employee.companyId || 
                         employee.companyId === null ||
                         (typeof employee.companyId === 'string' && employee.companyId !== rawCompanyIdStr && !/^\d+$/.test(employee.companyId)) ||
                         (typeof employee.companyId === 'object' && (!employee.companyId.id || employee.companyId.id !== rawCompanyIdStr))
      
      if (needsUpdate) {
        console.log(`[getEmployeeByEmail] Setting companyId from raw document: ${rawCompanyIdStr}`)
        const allCompanies = await db.collection('companies').find({}).toArray()
        const companyDoc = allCompanies.find((c: any) => c._id.toString() === rawCompanyIdStr)
        if (companyDoc && companyDoc.id) {
          // Set directly to string ID
          employee.companyId = companyDoc.id
          console.log(`[getEmployeeByEmail] Set companyId to string ID: ${companyDoc.id}`)
        } else {
          console.warn(`[getEmployeeByEmail] Company not found for ObjectId: ${rawCompanyIdStr}, keeping as ObjectId string`)
          employee.companyId = rawCompanyIdStr
        }
      }
    } else if (rawEmp && !rawEmp.companyId) {
      console.warn(`[getEmployeeByEmail] WARNING: Raw document has no companyId for employee ${employee.id || employee.employeeId}`)
    }
  }
  
  // Now convert companyId if it exists
  if (employee && employee.companyId) {
    let companyIdToConvert: any = employee.companyId
    
    // If it's an object with id field, use it
    if (typeof companyIdToConvert === 'object' && companyIdToConvert !== null && companyIdToConvert.id) {
      employee.companyId = companyIdToConvert.id
      console.log(`[getEmployeeByEmail] Pre-converted companyId from object.id: ${companyIdToConvert.id}`)
    } 
    // If it's an object with _id, look up the company
    else if (typeof companyIdToConvert === 'object' && companyIdToConvert !== null && companyIdToConvert._id) {
      const companyIdStr = companyIdToConvert._id.toString()
      if (db) {
        const allCompanies = await db.collection('companies').find({}).toArray()
        const companyDoc = allCompanies.find((c: any) => c._id.toString() === companyIdStr)
        if (companyDoc && companyDoc.id) {
          employee.companyId = companyDoc.id
          console.log(`[getEmployeeByEmail] Pre-converted companyId from object._id: ${companyDoc.id}`)
        }
      }
    }
    // If it's a string that looks like ObjectId, convert it
    else if (typeof companyIdToConvert === 'string' && /^[0-9a-fA-F]{24}$/.test(companyIdToConvert)) {
      if (db) {
        const allCompanies = await db.collection('companies').find({}).toArray()
        const companyDoc = allCompanies.find((c: any) => c._id.toString() === companyIdToConvert)
        if (companyDoc && companyDoc.id) {
          employee.companyId = companyDoc.id
          console.log(`[getEmployeeByEmail] Pre-converted companyId from ObjectId string: ${companyDoc.id}`)
        }
      }
    }
  }
  
  const plainEmployee = toPlainObject(employee)
  
  console.log(`[getEmployeeByEmail] DEBUG - After toPlainObject, companyId type: ${typeof plainEmployee.companyId}, value:`, plainEmployee.companyId)
  console.log(`[getEmployeeByEmail] DEBUG - Full employee object keys:`, Object.keys(plainEmployee))
  console.log(`[getEmployeeByEmail] DEBUG - Employee ID: ${plainEmployee.id}, Email: ${plainEmployee.email}`)
  
  // CRITICAL: Always ensure companyId is set - ALWAYS fetch from raw document to ensure we have the correct value
  // Even if companyId exists, verify it's the numeric ID, not ObjectId
  if (db) {
    console.log(`[getEmployeeByEmail] ALWAYS fetching companyId from raw document to ensure correct conversion...`)
    try {
      // ALWAYS fetch from raw document to get the actual ObjectId
      let rawEmp = null
      if (encryptedEmail) {
        rawEmp = await db.collection('employees').findOne({ email: encryptedEmail })
      }
      if (!rawEmp && plainEmployee.id) {
        rawEmp = await db.collection('employees').findOne({ id: plainEmployee.id })
      }
      if (!rawEmp && plainEmployee.employeeId) {
        rawEmp = await db.collection('employees').findOne({ employeeId: plainEmployee.employeeId })
      }
      
      if (rawEmp && rawEmp.companyId) {
        const rawCompanyIdStr = rawEmp.companyId.toString()
        console.log(`[getEmployeeByEmail] Found companyId ObjectId in raw document: ${rawCompanyIdStr}`)
        const allCompanies = await db.collection('companies').find({}).toArray()
        const companyDoc = allCompanies.find((c: any) => c._id.toString() === rawCompanyIdStr)
        if (companyDoc && companyDoc.id) {
          // ALWAYS set companyId to the numeric ID, regardless of what toPlainObject returned
          plainEmployee.companyId = companyDoc.id
          console.log(`[getEmployeeByEmail] ✓ ALWAYS SET companyId from raw document: ${companyDoc.id} (${companyDoc.name})`)
          
          // Also update the employee document in database to ensure it persists
          try {
            const employeeDoc = await Employee.findOne({ id: plainEmployee.id })
            if (employeeDoc) {
              employeeDoc.companyId = companyDoc._id
              employeeDoc.companyName = companyDoc.name
              await employeeDoc.save()
              console.log(`[getEmployeeByEmail] Updated employee document in database`)
            }
          } catch (updateError) {
            console.error(`[getEmployeeByEmail] Error updating employee document:`, updateError)
          }
        } else {
          console.warn(`[getEmployeeByEmail] Company not found for ObjectId: ${rawCompanyIdStr}`)
          // Try to find by companyName as fallback
          if (plainEmployee.companyName || rawEmp.companyName) {
            const companyNameToSearch = plainEmployee.companyName || rawEmp.companyName
            const companyDocByName = allCompanies.find((c: any) => 
              c.name && c.name.trim().toLowerCase() === companyNameToSearch.trim().toLowerCase()
            )
            if (companyDocByName && companyDocByName.id) {
              plainEmployee.companyId = companyDocByName.id
              console.log(`[getEmployeeByEmail] FALLBACK - Found company by name: ${companyDocByName.id} (${companyDocByName.name})`)
              
              // Update employee document
              try {
                const employeeDoc = await Employee.findOne({ id: plainEmployee.id })
                if (employeeDoc) {
                  employeeDoc.companyId = companyDocByName._id
                  employeeDoc.companyName = companyDocByName.name
                  await employeeDoc.save()
                  console.log(`[getEmployeeByEmail] Updated employee document with company from name lookup`)
                }
              } catch (updateError) {
                console.error(`[getEmployeeByEmail] Error updating employee document:`, updateError)
              }
            }
          }
        }
      } else {
        console.warn(`[getEmployeeByEmail] No companyId found in raw MongoDB document`)
        // Try companyName fallback
        if (plainEmployee.companyName) {
          const allCompanies = await db.collection('companies').find({}).toArray()
          const companyDocByName = allCompanies.find((c: any) => 
            c.name && c.name.trim().toLowerCase() === plainEmployee.companyName.trim().toLowerCase()
          )
          if (companyDocByName && companyDocByName.id) {
            plainEmployee.companyId = companyDocByName.id
            console.log(`[getEmployeeByEmail] FALLBACK - Found company by name when no companyId in raw doc: ${companyDocByName.id} (${companyDocByName.name})`)
            
            // Update employee document
            try {
              const employeeDoc = await Employee.findOne({ id: plainEmployee.id })
              if (employeeDoc) {
                employeeDoc.companyId = companyDocByName._id
                employeeDoc.companyName = companyDocByName.name
                await employeeDoc.save()
                console.log(`[getEmployeeByEmail] Updated employee document with company from name lookup`)
              }
            } catch (updateError) {
              console.error(`[getEmployeeByEmail] Error updating employee document:`, updateError)
            }
          }
        }
      }
    } catch (error) {
      console.error(`[getEmployeeByEmail] Error fetching raw companyId:`, error)
    }
  }
  
  // If companyId is missing or null after toPlainObject, try to get it from raw employee or database
  if (!plainEmployee.companyId && employee && db) {
    console.warn(`[getEmployeeByEmail] DEBUG - companyId is missing after toPlainObject, trying to recover from raw employee...`)
    // Try to get companyId from the employee object before toPlainObject
    if (employee.companyId) {
      let rawCompanyId: any = employee.companyId
      if (typeof rawCompanyId === 'object' && rawCompanyId !== null) {
        if (rawCompanyId.id) {
          plainEmployee.companyId = rawCompanyId.id
          console.log(`[getEmployeeByEmail] Recovered companyId from employee.companyId.id: ${rawCompanyId.id}`)
        } else if (rawCompanyId._id) {
          const companyIdStr = rawCompanyId._id.toString()
          const allCompanies = await db.collection('companies').find({}).toArray()
          const companyDoc = allCompanies.find((c: any) => c._id.toString() === companyIdStr)
          if (companyDoc && companyDoc.id) {
            plainEmployee.companyId = companyDoc.id
            console.log(`[getEmployeeByEmail] Recovered companyId from employee.companyId._id: ${companyDoc.id}`)
          }
        }
      } else if (typeof rawCompanyId === 'string' && /^[0-9a-fA-F]{24}$/.test(rawCompanyId)) {
        // It's an ObjectId string
        const allCompanies = await db.collection('companies').find({}).toArray()
        const companyDoc = allCompanies.find((c: any) => c._id.toString() === rawCompanyId)
        if (companyDoc && companyDoc.id) {
          plainEmployee.companyId = companyDoc.id
          console.log(`[getEmployeeByEmail] Recovered companyId from employee.companyId string: ${companyDoc.id}`)
        }
      }
    }
    
    // If still missing, try to get from raw MongoDB document
    if (!plainEmployee.companyId && encryptedEmail) {
      const rawEmp = await db.collection('employees').findOne({ email: encryptedEmail })
      if (rawEmp && rawEmp.companyId) {
        const rawCompanyIdStr = rawEmp.companyId.toString()
        const allCompanies = await db.collection('companies').find({}).toArray()
        const companyDoc = allCompanies.find((c: any) => c._id.toString() === rawCompanyIdStr)
        if (companyDoc && companyDoc.id) {
          plainEmployee.companyId = companyDoc.id
          console.log(`[getEmployeeByEmail] Recovered companyId from raw MongoDB document: ${companyDoc.id}`)
        }
      }
    }
  }
  
  // Ensure companyId is converted to company string ID (not ObjectId)
  if (plainEmployee.companyId) {
    console.log(`[getEmployeeByEmail] DEBUG - companyId exists, type: ${typeof plainEmployee.companyId}, isObject: ${typeof plainEmployee.companyId === 'object'}, isNull: ${plainEmployee.companyId === null}`)
    
    // If companyId is an object (populated), extract the id field
    if (typeof plainEmployee.companyId === 'object' && plainEmployee.companyId !== null) {
      console.log(`[getEmployeeByEmail] DEBUG - companyId is object, keys:`, Object.keys(plainEmployee.companyId))
      console.log(`[getEmployeeByEmail] DEBUG - companyId.id:`, plainEmployee.companyId.id)
      console.log(`[getEmployeeByEmail] DEBUG - companyId._id:`, plainEmployee.companyId._id)
      
      if (plainEmployee.companyId.id) {
        console.log(`[getEmployeeByEmail] DEBUG - Using companyId.id: ${plainEmployee.companyId.id}`)
        plainEmployee.companyId = plainEmployee.companyId.id
      } else if (plainEmployee.companyId._id) {
        // If only _id is present, look up the company to get the string id
        console.log(`[getEmployeeByEmail] DEBUG - Only _id present, looking up company...`)
        const db = mongoose.connection.db
        if (db) {
          try {
            const companyIdStr = plainEmployee.companyId._id.toString()
            console.log(`[getEmployeeByEmail] DEBUG - Looking for company with _id: ${companyIdStr}`)
            const allCompanies = await db.collection('companies').find({}).toArray()
            console.log(`[getEmployeeByEmail] DEBUG - Found ${allCompanies.length} companies in database`)
            const companyDoc = allCompanies.find((c: any) => c._id.toString() === companyIdStr)
            if (companyDoc && companyDoc.id) {
              console.log(`[getEmployeeByEmail] DEBUG - Found company: ${companyDoc.id} (${companyDoc.name})`)
              plainEmployee.companyId = companyDoc.id
              console.log(`[getEmployeeByEmail] Converted populated companyId ObjectId to company ID: ${companyDoc.id}`)
            } else {
              console.warn(`[getEmployeeByEmail] DEBUG - Company not found for _id: ${companyIdStr}`)
            }
          } catch (error) {
            console.warn(`[getEmployeeByEmail] Error converting populated companyId to company ID:`, error)
          }
        } else {
          console.warn(`[getEmployeeByEmail] DEBUG - Database connection not available`)
        }
      } else {
        console.warn(`[getEmployeeByEmail] DEBUG - companyId object has neither id nor _id field`)
      }
    } else if (typeof plainEmployee.companyId === 'string') {
      console.log(`[getEmployeeByEmail] DEBUG - companyId is string: ${plainEmployee.companyId}`)
      // Check if it looks like an ObjectId (24 hex characters), convert it to company string ID
      if (/^[0-9a-fA-F]{24}$/.test(plainEmployee.companyId)) {
        console.log(`[getEmployeeByEmail] DEBUG - companyId looks like ObjectId, converting...`)
        // It's an ObjectId string, need to look up the company
        const db = mongoose.connection.db
        if (db) {
          try {
            const allCompanies = await db.collection('companies').find({}).toArray()
            console.log(`[getEmployeeByEmail] DEBUG - Found ${allCompanies.length} companies for ObjectId lookup`)
            const companyDoc = allCompanies.find((c: any) => c._id.toString() === plainEmployee.companyId)
            if (companyDoc && companyDoc.id) {
              console.log(`[getEmployeeByEmail] DEBUG - Found company: ${companyDoc.id} (${companyDoc.name})`)
              plainEmployee.companyId = companyDoc.id
              console.log(`[getEmployeeByEmail] Converted companyId ObjectId string to company ID: ${companyDoc.id}`)
            } else {
              console.warn(`[getEmployeeByEmail] DEBUG - Company not found for ObjectId: ${plainEmployee.companyId}`)
            }
          } catch (error) {
            console.warn(`[getEmployeeByEmail] Error converting companyId ObjectId to company ID:`, error)
          }
        }
      } else {
        console.log(`[getEmployeeByEmail] DEBUG - companyId is already a string ID: ${plainEmployee.companyId}`)
      }
    } else {
      console.warn(`[getEmployeeByEmail] DEBUG - Unexpected companyId type: ${typeof plainEmployee.companyId}`)
    }
  } else {
    console.warn(`[getEmployeeByEmail] DEBUG - companyId is missing or falsy!`)
  }
  
  // FINAL FALLBACK: If companyId is still null or missing, fetch from raw document one more time
  if ((!plainEmployee.companyId || plainEmployee.companyId === null) && db && encryptedEmail) {
    console.error(`[getEmployeeByEmail] FINAL FALLBACK - companyId is still null, fetching from raw document one last time...`)
    try {
      const rawEmp = await db.collection('employees').findOne({ email: encryptedEmail })
      if (rawEmp && rawEmp.companyId) {
        const rawCompanyIdStr = rawEmp.companyId.toString()
        const allCompanies = await db.collection('companies').find({}).toArray()
        const companyDoc = allCompanies.find((c: any) => c._id.toString() === rawCompanyIdStr)
        if (companyDoc && companyDoc.id) {
          plainEmployee.companyId = companyDoc.id
          console.error(`[getEmployeeByEmail] FINAL FALLBACK SUCCESS - Set companyId: ${companyDoc.id}`)
        } else {
          console.error(`[getEmployeeByEmail] FINAL FALLBACK FAILED - Company not found for ObjectId: ${rawCompanyIdStr}`)
        }
      } else {
        console.error(`[getEmployeeByEmail] FINAL FALLBACK FAILED - No companyId in raw document`)
      }
    } catch (error) {
      console.error(`[getEmployeeByEmail] FINAL FALLBACK ERROR:`, error)
    }
  }
  
  console.log(`[getEmployeeByEmail] DEBUG - Final companyId: ${plainEmployee.companyId}, type: ${typeof plainEmployee.companyId}`)
  console.log(`[getEmployeeByEmail] DEBUG - Final employee object:`, {
    id: plainEmployee.id,
    email: plainEmployee.email,
    companyId: plainEmployee.companyId,
    companyName: plainEmployee.companyName
  })
  
  // Ensure companyId is never null in the final response
  // If companyId is missing, try to find and update it from the raw employee document or companyName
  if (!plainEmployee.companyId || plainEmployee.companyId === null) {
    console.error(`[getEmployeeByEmail] ERROR - companyId is still null after all attempts! Employee ID: ${plainEmployee.id}`)
    // Try to get companyId from raw employee document and update the employee record
    try {
      const rawEmployee = await db.collection('employees').findOne({ 
        $or: [
          { id: plainEmployee.id },
          { email: encryptedEmail },
          { _id: new mongoose.Types.ObjectId(plainEmployee.id) }
        ]
      })
      
      if (rawEmployee && rawEmployee.companyId) {
        const companyIdStr = rawEmployee.companyId.toString()
        const allCompanies = await db.collection('companies').find({}).toArray()
        const companyDoc = allCompanies.find((c: any) => c._id.toString() === companyIdStr)
        
        if (companyDoc && companyDoc.id) {
          plainEmployee.companyId = companyDoc.id
          console.log(`[getEmployeeByEmail] Recovered companyId from raw document: ${companyDoc.id}`)
          
          // Update the employee document to ensure companyId is set
          const employeeDoc = await Employee.findOne({ id: plainEmployee.id })
          if (employeeDoc && (!employeeDoc.companyId || employeeDoc.companyId.toString() !== companyIdStr)) {
            employeeDoc.companyId = new mongoose.Types.ObjectId(companyIdStr)
            await employeeDoc.save()
            console.log(`[getEmployeeByEmail] Updated employee companyId in database`)
          }
        }
      } else if (plainEmployee.companyName || (rawEmployee && rawEmployee.companyName)) {
        // Last resort: try to find company by companyName and set companyId
        const companyNameToSearch = plainEmployee.companyName || rawEmployee?.companyName
        if (companyNameToSearch) {
          console.log(`[getEmployeeByEmail] Attempting to find company by name: ${companyNameToSearch}`)
          const allCompanies = await db.collection('companies').find({}).toArray()
          const companyDoc = allCompanies.find((c: any) => 
            c.name && c.name.trim().toLowerCase() === companyNameToSearch.trim().toLowerCase()
          )
          
          if (companyDoc && companyDoc._id && companyDoc.id) {
            plainEmployee.companyId = companyDoc.id
            console.log(`[getEmployeeByEmail] ✓ Found company by name and set companyId: ${companyDoc.id} (${companyDoc.name})`)
            
            // Update the employee document to set companyId
            const employeeDoc = await Employee.findOne({ id: plainEmployee.id })
            if (employeeDoc) {
              employeeDoc.companyId = companyDoc._id
              employeeDoc.companyName = companyDoc.name // Ensure companyName matches
              await employeeDoc.save()
              console.log(`[getEmployeeByEmail] ✓ Updated employee companyId in database from companyName`)
            } else {
              // Try to update using raw collection
              await db.collection('employees').updateOne(
                { _id: rawEmployee?._id || new mongoose.Types.ObjectId(plainEmployee.id) },
                { 
                  $set: { 
                    companyId: companyDoc._id,
                    companyName: companyDoc.name
                  } 
                }
              )
              console.log(`[getEmployeeByEmail] ✓ Updated employee companyId in raw collection from companyName`)
            }
          } else {
            console.error(`[getEmployeeByEmail] ❌ Company not found by name: ${companyNameToSearch}`)
            console.error(`[getEmployeeByEmail] Available companies:`, allCompanies.map((c: any) => c.name))
          }
        }
      }
    } catch (error) {
      console.error(`[getEmployeeByEmail] Error recovering companyId:`, error)
    }
  }
  
  return plainEmployee
}

export async function getEmployeeById(employeeId: string): Promise<any | null> {
  await connectDB()
  
  const employee = await Employee.findOne({ id: employeeId })
    .populate('companyId', 'id name')
    .populate('locationId', 'id name address city state pincode')
    .lean()
  
  if (!employee) return null
  
  // Since we used .lean(), the post hooks don't run, so we need to manually decrypt sensitive fields
  const { decrypt } = require('../utils/encryption')
  const sensitiveFields = ['email', 'mobile', 'address', 'firstName', 'lastName', 'designation']
  for (const field of sensitiveFields) {
    if (employee[field] && typeof employee[field] === 'string' && employee[field].includes(':')) {
      try {
        employee[field] = decrypt(employee[field])
      } catch (error) {
        console.warn(`Failed to decrypt field ${field} for employee ${employeeId}:`, error)
      }
    }
  }
  
  const plainEmployee = toPlainObject(employee)
  
  // Ensure companyId is converted to company string ID (not ObjectId)
  if (plainEmployee.companyId) {
    if (typeof plainEmployee.companyId === 'object' && plainEmployee.companyId !== null) {
      if (plainEmployee.companyId.id) {
        plainEmployee.companyId = plainEmployee.companyId.id
      } else if (plainEmployee.companyId._id) {
        const db = mongoose.connection.db
        if (db) {
          try {
            const companyIdStr = plainEmployee.companyId._id.toString()
            const allCompanies = await db.collection('companies').find({}).toArray()
            const companyDoc = allCompanies.find((c: any) => c._id.toString() === companyIdStr)
            if (companyDoc && companyDoc.id) {
              plainEmployee.companyId = companyDoc.id
            }
          } catch (error) {
            console.warn(`[getEmployeeById] Error converting companyId:`, error)
          }
        }
      }
    } else if (typeof plainEmployee.companyId === 'string' && /^[0-9a-fA-F]{24}$/.test(plainEmployee.companyId)) {
      const db = mongoose.connection.db
      if (db) {
        try {
          const allCompanies = await db.collection('companies').find({}).toArray()
          const companyDoc = allCompanies.find((c: any) => c._id.toString() === plainEmployee.companyId)
          if (companyDoc && companyDoc.id) {
            plainEmployee.companyId = companyDoc.id
          }
        } catch (error) {
          console.warn(`[getEmployeeById] Error converting companyId ObjectId:`, error)
        }
      }
    }
  }
  
  return plainEmployee
}

export async function getEmployeeByPhone(phone: string): Promise<any | null> {
  await connectDB()
  
  if (!phone) {
    return null
  }
  
  // Normalize phone number (remove spaces, dashes, etc.)
  let normalizedPhone = phone.trim().replace(/[\s\-\(\)]/g, '')
  
  // Since mobile is encrypted in the database, we need to encrypt the search term
  const { encrypt, decrypt } = require('../utils/encryption')
  
  // Generate multiple phone number format variations to try
  // Phone numbers can be stored in different formats in the database
  const phoneVariations: string[] = []
  
  // 1. Original format (as received)
  phoneVariations.push(normalizedPhone)
  
  // 2. If it starts with +91, try without +
  if (normalizedPhone.startsWith('+91')) {
    phoneVariations.push(normalizedPhone.substring(1)) // Remove +
    phoneVariations.push(normalizedPhone.substring(3)) // Remove +91
  }
  // 3. If it starts with 91 (without +), try without country code
  else if (normalizedPhone.startsWith('91') && normalizedPhone.length === 12) {
    phoneVariations.push('+' + normalizedPhone) // Add +
    phoneVariations.push(normalizedPhone.substring(2)) // Remove 91
  }
  // 4. If it's 10 digits (Indian number without country code), try with country code
  else if (normalizedPhone.length === 10 && /^\d+$/.test(normalizedPhone)) {
    phoneVariations.push('+91' + normalizedPhone) // Add +91
    phoneVariations.push('91' + normalizedPhone) // Add 91
    if (normalizedPhone.startsWith('0')) {
      phoneVariations.push(normalizedPhone.substring(1)) // Remove leading 0
      phoneVariations.push('+91' + normalizedPhone.substring(1)) // Remove 0 and add +91
    }
  }
  // 5. If it starts with 0, try without 0
  else if (normalizedPhone.startsWith('0') && normalizedPhone.length === 11) {
    phoneVariations.push(normalizedPhone.substring(1)) // Remove 0
    phoneVariations.push('+91' + normalizedPhone.substring(1)) // Remove 0 and add +91
    phoneVariations.push('91' + normalizedPhone.substring(1)) // Remove 0 and add 91
  }
  
  // Remove duplicates
  const uniqueVariations = [...new Set(phoneVariations)]
  
  console.log(`[getEmployeeByPhone] Trying phone number variations for: ${phone.substring(0, 5)}...`, uniqueVariations.length, 'variations')
  
  // Try finding with each phone number variation
  const db = mongoose.connection.db
  let employee: any = null
  
  // Try each variation
  for (const phoneVar of uniqueVariations) {
    if (!phoneVar || phoneVar.length === 0) continue
    
    let encryptedPhone: string = ''
    try {
      encryptedPhone = encrypt(phoneVar)
    } catch (error) {
      console.warn(`[getEmployeeByPhone] Failed to encrypt phone variation "${phoneVar}":`, error)
      continue
    }
    
    if (!encryptedPhone) continue
    
    // Try finding with encrypted phone
    if (db) {
      const rawEmployee = await db.collection('employees').findOne({ mobile: encryptedPhone })
      
      if (rawEmployee) {
        // Found employee! Now fetch with Mongoose to get populated fields and decryption
        employee = await Employee.findOne({ mobile: encryptedPhone })
          .populate('companyId', 'id name')
          .populate('locationId', 'id name address city state pincode')
          .lean()
        
        if (employee) {
          console.log(`[getEmployeeByPhone] ✅ Found employee with phone variation: ${phoneVar.substring(0, 5)}...`)
          break // Found employee, stop searching
        }
      }
    }
    
    // Also try Mongoose query as fallback
    if (!employee) {
      employee = await Employee.findOne({ mobile: encryptedPhone })
        .populate('companyId', 'id name')
        .populate('locationId', 'id name address city state pincode')
        .lean()
      
      if (employee) {
        console.log(`[getEmployeeByPhone] ✅ Found employee with Mongoose query (variation: ${phoneVar.substring(0, 5)}...)`)
        break // Found employee, stop searching
      }
    }
  }
  
  // If still not found, try decryption-based search (slower but more thorough)
  if (!employee && db) {
    console.log(`[getEmployeeByPhone] Trying decryption-based search...`)
    try {
      const allEmployees = await db.collection('employees').find({}).toArray()
      for (const emp of allEmployees) {
        if (emp.mobile && typeof emp.mobile === 'string') {
          try {
            const decryptedMobile = decrypt(emp.mobile)
            // Check if any variation matches
            for (const phoneVar of uniqueVariations) {
              if (decryptedMobile === phoneVar || decryptedMobile.replace(/[\s\-\(\)]/g, '') === phoneVar) {
                // Found match! Fetch with Mongoose
                employee = await Employee.findOne({ _id: emp._id })
                  .populate('companyId', 'id name')
                  .populate('locationId', 'id name address city state pincode')
                  .lean()
                if (employee) {
                  console.log(`[getEmployeeByPhone] ✅ Found employee via decryption search`)
                  break
                }
              }
            }
            if (employee) break
          } catch (decryptError) {
            // Skip employees with decryption errors
            continue
          }
        }
      }
    } catch (error) {
      console.warn(`[getEmployeeByPhone] Decryption-based search failed:`, error)
    }
  }
  
  if (!employee) {
    console.log(`[getEmployeeByPhone] ❌ Employee not found for phone: ${phone.substring(0, 5)}... (tried ${uniqueVariations.length} variations)`)
    return null
  }
  
  // Ensure companyId is properly set
  if (employee.companyId) {
    if (typeof employee.companyId === 'object' && employee.companyId !== null) {
      if (employee.companyId.id) {
        employee.companyId = employee.companyId.id
      } else if (employee.companyId._id) {
        const db = mongoose.connection.db
        if (db) {
          try {
            const companyIdStr = employee.companyId._id.toString()
            const allCompanies = await db.collection('companies').find({}).toArray()
            const companyDoc = allCompanies.find((c: any) => c._id.toString() === companyIdStr)
            if (companyDoc && companyDoc.id) {
              employee.companyId = companyDoc.id
            }
          } catch (error) {
            console.warn(`[getEmployeeByPhone] Error converting companyId:`, error)
          }
        }
      }
    }
  }
  
  // Decrypt sensitive fields (required since we use .lean())
  const sensitiveFields = ['email', 'mobile', 'address', 'firstName', 'lastName', 'designation']
  for (const field of sensitiveFields) {
    if (employee[field] && typeof employee[field] === 'string' && employee[field].includes(':')) {
      try {
        employee[field] = decrypt(employee[field])
      } catch (error) {
        console.warn(`Failed to decrypt field ${field} for employee:`, error)
      }
    }
  }
  
  const plainEmployee = toPlainObject(employee)
  
  // Ensure companyId is converted to company string ID
  if (plainEmployee.companyId) {
    if (typeof plainEmployee.companyId === 'object' && plainEmployee.companyId !== null) {
      if (plainEmployee.companyId.id) {
        plainEmployee.companyId = plainEmployee.companyId.id
      }
    }
  }
  
  return plainEmployee
}

export async function getEmployeeByEmployeeId(employeeId: string): Promise<any | null> {
  await connectDB()
  
  const employee = await Employee.findOne({ employeeId: employeeId })
    .populate('companyId', 'id name')
    .lean()
  
  if (!employee) return null
  
  const plainEmployee = toPlainObject(employee)
  
  // Ensure companyId is converted to company string ID (not ObjectId)
  if (plainEmployee.companyId) {
    if (typeof plainEmployee.companyId === 'object' && plainEmployee.companyId !== null) {
      if (plainEmployee.companyId.id) {
        plainEmployee.companyId = plainEmployee.companyId.id
      } else if (plainEmployee.companyId._id) {
        const db = mongoose.connection.db
        if (db) {
          try {
            const companyIdStr = plainEmployee.companyId._id.toString()
            const allCompanies = await db.collection('companies').find({}).toArray()
            const companyDoc = allCompanies.find((c: any) => c._id.toString() === companyIdStr)
            if (companyDoc && companyDoc.id) {
              plainEmployee.companyId = companyDoc.id
            }
          } catch (error) {
            console.warn(`[getEmployeeByEmployeeId] Error converting companyId:`, error)
          }
        }
      }
    } else if (typeof plainEmployee.companyId === 'string' && /^[0-9a-fA-F]{24}$/.test(plainEmployee.companyId)) {
      const db = mongoose.connection.db
      if (db) {
        try {
          const allCompanies = await db.collection('companies').find({}).toArray()
          const companyDoc = allCompanies.find((c: any) => c._id.toString() === plainEmployee.companyId)
          if (companyDoc && companyDoc.id) {
            plainEmployee.companyId = companyDoc.id
          }
        } catch (error) {
          console.warn(`[getEmployeeByEmployeeId] Error converting companyId ObjectId:`, error)
        }
      }
    }
  }
  
  return plainEmployee
}

export async function getEmployeesByCompany(companyId: string): Promise<any[]> {
  await connectDB()
  
  console.log(`[getEmployeesByCompany] Looking up company with id: ${companyId}`)
  const company = await Company.findOne({ id: companyId }).select('_id id name').lean()
  if (!company) {
    console.warn(`[getEmployeesByCompany] Company not found with id: ${companyId}`)
    return []
  }

  console.log(`[getEmployeesByCompany] Found company: ${company.name} (${company.id}), ObjectId: ${company._id}`)

  // OPTIMIZATION: Use indexed query directly instead of fetch-all + filter
  // This leverages the companyId index for O(log n) lookup instead of O(n) scan
  // Direct indexed query - much faster than fetch-all
  console.log(`[getEmployeesByCompany] Querying employees with companyId: ${company._id}`)
  const query = Employee.find({ companyId: company._id })
    .populate('companyId', 'id name')
    .populate('locationId', 'id name address city state pincode')

  const employees = await query.lean()
  
  console.log(`[getEmployeesByCompany] Raw query returned ${employees?.length || 0} employees`)
  
  if (!employees || employees.length === 0) {
    console.warn(`[getEmployeesByCompany] No employees found for company ${companyId} (${company.name})`)
    return []
  }

  // Decrypt sensitive fields (required since we use .lean())
  const { decrypt } = require('../utils/encryption')
  const companyIdStr = company._id.toString()
  const companyStringId = company.id
  
  const decryptedEmployees = employees.map((e: any) => {
    if (!e) return null
    const sensitiveFields = ['email', 'mobile', 'address', 'firstName', 'lastName', 'designation']
    for (const field of sensitiveFields) {
      if (e[field] && typeof e[field] === 'string' && e[field].includes(':')) {
        try {
          e[field] = decrypt(e[field])
        } catch (error) {
          // If decryption fails, keep original value
        }
      }
    }
    // OPTIMIZATION: Set companyId directly from company lookup (already have it)
    if (e.companyId) {
      if (typeof e.companyId === 'object' && e.companyId._id) {
        e.companyId = e.companyId.id || companyStringId
      } else if (typeof e.companyId === 'string' && e.companyId.length === 24 && /^[0-9a-fA-F]{24}$/.test(e.companyId)) {
        // ObjectId string - use the company ID we already have
        e.companyId = companyStringId
      }
        } else {
      // Fallback: set from known company
      e.companyId = companyStringId
    }
    return e
  }).filter((e: any) => e !== null)
  
  // Convert to plain objects
  const plainEmployees = decryptedEmployees.map((e: any) => toPlainObject(e)).filter((e: any) => e !== null)
  
  return plainEmployees
}

export async function getUniqueDesignationsByCompany(companyId: string): Promise<string[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) return []

  // Get all employees for this company (we need to decrypt designations)
  // Using find instead of distinct to get decrypted values through Mongoose hooks
  const employees = await Employee.find({ 
    companyId: company._id,
    designation: { $exists: true, $ne: null, $ne: '' }
  })
    .select('designation')
    .lean()

  // Import decrypt function
  const { decrypt } = require('../utils/encryption')
  // Use a Map to store normalized (lowercase) -> original designation mapping
  // This ensures case-insensitive uniqueness while preserving original case for display
  const designationMap = new Map<string, string>()
  
  for (const emp of employees) {
    if (emp.designation) {
      let designation = emp.designation as string
      // Check if it's encrypted (contains ':' which is the separator in our encryption format)
      if (typeof designation === 'string' && designation.includes(':')) {
        try {
          designation = decrypt(designation)
        } catch (error) {
          console.warn('Failed to decrypt designation:', error)
          // If decryption fails, skip this designation
          continue
        }
      }
      // Clean and normalize for case-insensitive uniqueness
      if (designation && typeof designation === 'string' && designation.trim().length > 0) {
        const trimmed = designation.trim()
        const normalized = trimmed.toLowerCase()
        // Store the first occurrence (or prefer capitalized versions)
        if (!designationMap.has(normalized)) {
          designationMap.set(normalized, trimmed)
        } else {
          // If we already have this designation, prefer the one with better capitalization
          // (e.g., prefer "Co-Pilot" over "co-pilot")
          const existing = designationMap.get(normalized)!
          // Prefer the one that starts with uppercase
          if (trimmed[0] && trimmed[0] === trimmed[0].toUpperCase() && 
              existing[0] && existing[0] !== existing[0].toUpperCase()) {
            designationMap.set(normalized, trimmed)
          }
        }
      }
    }
  }

  // Convert to array and sort alphabetically (case-insensitive)
  return Array.from(designationMap.values()).sort((a, b) => 
    a.toLowerCase().localeCompare(b.toLowerCase())
  )
}

/**
 * Get unique shirt sizes for a company
 * @param companyId Company ID (6-digit numeric string)
 * @returns Array of unique shirt sizes
 */
export async function getUniqueShirtSizesByCompany(companyId: string): Promise<string[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) return []

  const employees = await Employee.find({ 
    companyId: company._id,
    shirtSize: { $exists: true, $ne: null, $ne: '' }
  })
    .select('shirtSize')
    .lean()

  const { decrypt } = require('../utils/encryption')
  const sizeSet = new Set<string>()
  
  for (const emp of employees) {
    if (emp.shirtSize) {
      let size = emp.shirtSize as string
      // Check if it's encrypted
      if (typeof size === 'string' && size.includes(':')) {
        try {
          size = decrypt(size)
        } catch (error) {
          continue
        }
      }
      if (size && typeof size === 'string' && size.trim().length > 0) {
        sizeSet.add(size.trim())
      }
    }
  }

  // Sort sizes intelligently (handle numeric and alphanumeric)
  return Array.from(sizeSet).sort((a, b) => {
    // Try to parse as numbers first
    const aNum = parseFloat(a)
    const bNum = parseFloat(b)
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum
    }
    // Otherwise sort alphabetically
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/**
 * Get unique pant sizes for a company
 * @param companyId Company ID (6-digit numeric string)
 * @returns Array of unique pant sizes
 */
export async function getUniquePantSizesByCompany(companyId: string): Promise<string[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) return []

  const employees = await Employee.find({ 
    companyId: company._id,
    pantSize: { $exists: true, $ne: null, $ne: '' }
  })
    .select('pantSize')
    .lean()

  const { decrypt } = require('../utils/encryption')
  const sizeSet = new Set<string>()
  
  for (const emp of employees) {
    if (emp.pantSize) {
      let size = emp.pantSize as string
      // Check if it's encrypted
      if (typeof size === 'string' && size.includes(':')) {
        try {
          size = decrypt(size)
        } catch (error) {
          continue
        }
      }
      if (size && typeof size === 'string' && size.trim().length > 0) {
        sizeSet.add(size.trim())
      }
    }
  }

  // Sort sizes intelligently (handle numeric and alphanumeric)
  return Array.from(sizeSet).sort((a, b) => {
    const aNum = parseFloat(a)
    const bNum = parseFloat(b)
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
}

/**
 * Get unique shoe sizes for a company
 * @param companyId Company ID (6-digit numeric string)
 * @returns Array of unique shoe sizes
 */
export async function getUniqueShoeSizesByCompany(companyId: string): Promise<string[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) return []

  const employees = await Employee.find({ 
    companyId: company._id,
    shoeSize: { $exists: true, $ne: null, $ne: '' }
  })
    .select('shoeSize')
    .lean()

  const { decrypt } = require('../utils/encryption')
  const sizeSet = new Set<string>()
  
  for (const emp of employees) {
    if (emp.shoeSize) {
      let size = emp.shoeSize as string
      // Check if it's encrypted
      if (typeof size === 'string' && size.includes(':')) {
        try {
          size = decrypt(size)
        } catch (error) {
          continue
        }
      }
      if (size && typeof size === 'string' && size.trim().length > 0) {
        sizeSet.add(size.trim())
      }
    }
  }

  // Sort sizes intelligently (handle numeric and alphanumeric)
  return Array.from(sizeSet).sort((a, b) => {
    const aNum = parseFloat(a)
    const bNum = parseFloat(b)
    if (!isNaN(aNum) && !isNaN(bNum)) {
      return aNum - bNum
    }
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
  })
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
  companyName?: string // Optional - will be derived from companyId lookup
  branchId?: string
  branchName?: string
  locationId?: string // Location ID (6-digit numeric string) - official delivery location
  eligibility?: { shirt: number; pant: number; shoe: number; jacket: number }
  cycleDuration?: { shirt: number; pant: number; shoe: number; jacket: number }
  dispatchPreference?: 'direct' | 'central' | 'regional'
  status?: 'active' | 'inactive'
  period?: string
  dateOfJoining?: Date
}): Promise<any> {
  await connectDB()
  
  // Find company by companyId only - companyName is not used for lookup
  const company = await Company.findOne({ id: employeeData.companyId })
  if (!company) {
    throw new Error(`Company not found: ${employeeData.companyId}`)
  }

  // Generate unique 6-digit numeric employee ID if not provided (starting from 300001)
  let employeeId = employeeData.employeeId
  if (!employeeId) {
    // Find the highest existing employee ID
    const existingEmployees = await Employee.find({})
      .sort({ id: -1 })
      .limit(1)
      .lean()
    
    let nextEmployeeId = 300001 // Start from 300001
    if (existingEmployees.length > 0) {
      const lastId = existingEmployees[0].id
      if (/^\d{6}$/.test(String(lastId))) {
        const lastIdNum = parseInt(String(lastId), 10)
        if (lastIdNum >= 300001 && lastIdNum < 400000) {
          nextEmployeeId = lastIdNum + 1
        }
      }
    }
    
    employeeId = String(nextEmployeeId).padStart(6, '0')
    
    // Check if this ID already exists (safety check)
    const existingById = await Employee.findOne({ id: employeeId })
    if (existingById) {
      // Find next available ID
      for (let i = nextEmployeeId + 1; i < 400000; i++) {
        const testId = String(i).padStart(6, '0')
        const exists = await Employee.findOne({ id: testId })
        if (!exists) {
          employeeId = testId
          break
        }
      }
    }
  }

  // Check if employee ID already exists
  const existingById = await Employee.findOne({ id: employeeId })
  if (existingById) {
    throw new Error(`Employee ID already exists: ${employeeId}`)
  }

  // Check if email already exists (email is encrypted, so we need to encrypt the search term)
  const { encrypt } = require('../utils/encryption')
  let encryptedEmail: string
  try {
    encryptedEmail = encrypt(employeeData.email.trim())
  } catch (error) {
    console.warn('Failed to encrypt email for duplicate check:', error)
    encryptedEmail = ''
  }
  
  // Try finding with encrypted email
  let existingByEmail = null
  if (encryptedEmail) {
    existingByEmail = await Employee.findOne({ email: encryptedEmail })
  }
  
  // If not found with encrypted email, also check by decrypting all emails (fallback)
  if (!existingByEmail) {
    const allEmployees = await Employee.find({}).select('email').lean()
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const { decrypt } = require('../utils/encryption')
          const decryptedEmail = decrypt(emp.email)
          if (decryptedEmail.toLowerCase() === employeeData.email.trim().toLowerCase()) {
            existingByEmail = emp
            break
          }
        } catch (error) {
          // Skip employees with decryption errors
          continue
        }
      }
    }
  }
  
  if (existingByEmail) {
    throw new Error(`Employee with email already exists: ${employeeData.email}`)
  }

  // Get location if locationId is provided
  let locationIdObj = null
  if (employeeData.locationId) {
    const Location = require('../models/Location').default
    // Fetch location with populated companyId for reliable company ID extraction
    const location = await Location.findOne({ id: employeeData.locationId })
      .populate('companyId', 'id name')
      .lean()
    
    if (!location) {
      throw new Error(`Location not found: ${employeeData.locationId}`)
    }
    
    // Verify location belongs to the same company
    let locationCompanyId: string | null = null
    if (location.companyId) {
      if (typeof location.companyId === 'object' && location.companyId !== null && !Array.isArray(location.companyId)) {
        // Populated company object (from .populate())
        if (location.companyId.id && typeof location.companyId.id === 'string') {
          locationCompanyId = String(location.companyId.id).trim()
        } else if (location.companyId._id) {
          // Populated but no id field - fetch company
          const locCompany = await Company.findById(location.companyId._id).select('id').lean()
          if (locCompany && locCompany.id) {
            locationCompanyId = String(locCompany.id).trim()
          }
        }
      } else if (typeof location.companyId === 'string' || location.companyId instanceof mongoose.Types.ObjectId) {
        // ObjectId string or ObjectId - fetch company
        const locCompany = await Company.findById(location.companyId).select('id').lean()
        if (locCompany && locCompany.id) {
          locationCompanyId = String(locCompany.id).trim()
        }
      }
    }
    
    // Validate that we have a valid company ID
    if (!locationCompanyId) {
      throw new Error(`Cannot determine location's company ID for location ${employeeData.locationId}. The location may have an invalid company association.`)
    }
    
    // Ensure employeeData.companyId is a string for comparison
    const employeeCompanyIdStr = String(employeeData.companyId).trim()
    
    if (locationCompanyId !== employeeCompanyIdStr) {
      throw new Error(`Location ${employeeData.locationId} does not belong to company ${employeeCompanyIdStr}`)
    }
    
    // Get location document _id (since we used .lean(), we need to fetch it again or use the _id from lean result)
    if (location._id) {
      locationIdObj = location._id
    } else {
      // Fallback: fetch location document if _id is missing (shouldn't happen)
      const locationDoc = await Location.findOne({ id: employeeData.locationId })
      if (locationDoc) {
        locationIdObj = locationDoc._id
      } else {
        throw new Error(`Location ${employeeData.locationId} not found when setting employee location`)
      }
    }
  }

  const newEmployee = new Employee({
    id: employeeId,
    employeeId: employeeId,
    firstName: employeeData.firstName,
    lastName: employeeData.lastName,
    designation: employeeData.designation,
    gender: employeeData.gender,
    location: employeeData.location,
    email: employeeData.email,
    mobile: employeeData.mobile,
    shirtSize: employeeData.shirtSize,
    pantSize: employeeData.pantSize,
    shoeSize: employeeData.shoeSize,
    address: employeeData.address,
    companyId: company._id,
    companyName: company.name, // Derived from company lookup, not from input
    locationId: locationIdObj, // Official delivery location (optional for backward compatibility)
    eligibility: employeeData.eligibility || { shirt: 0, pant: 0, shoe: 0, jacket: 0 },
    cycleDuration: employeeData.cycleDuration || { shirt: 6, pant: 6, shoe: 6, jacket: 12 },
    dispatchPreference: employeeData.dispatchPreference || 'direct',
    status: employeeData.status || 'active',
    period: employeeData.period || '2024-2025',
    dateOfJoining: employeeData.dateOfJoining || new Date('2025-10-01T00:00:00.000Z'),
  })

  await newEmployee.save()
  
  // Fetch the created employee with populated fields
  const created = await Employee.findOne({ id: employeeId })
    .populate('companyId', 'id name')
    .populate('locationId', 'id name address city state pincode')
    .lean()

  return created ? toPlainObject(created) : null
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
    companyId?: string
    // companyName removed - it's derived from companyId lookup only
    locationId?: string // Location ID (6-digit numeric string) - official delivery location
    eligibility?: { shirt: number; pant: number; shoe: number; jacket: number }
    cycleDuration?: { shirt: number; pant: number; shoe: number; jacket: number }
    dispatchPreference?: 'direct' | 'central' | 'regional'
    status?: 'active' | 'inactive'
    period?: string
    dateOfJoining?: Date
  }
): Promise<any> {
  await connectDB()
  
  // Fetch employee with companyId populated for proper validation
  const employee = await Employee.findOne({ id: employeeId })
    .populate('companyId', 'id name')
  
  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`)
  }

  // Check if email is being updated and if it conflicts with another employee
  // Since email is encrypted, we need to handle this carefully
  if (updateData.email) {
    // Decrypt current employee email to compare
    const { encrypt, decrypt } = require('../utils/encryption')
    let currentEmail = employee.email
    try {
      if (typeof currentEmail === 'string' && currentEmail.includes(':')) {
        currentEmail = decrypt(currentEmail)
      }
    } catch (error) {
      // If decryption fails, keep original
    }
    
    // Only check if email is actually changing
    if (updateData.email.trim().toLowerCase() !== currentEmail.toLowerCase()) {
      // Encrypt the new email to check for duplicates
      let encryptedNewEmail: string
      try {
        encryptedNewEmail = encrypt(updateData.email.trim())
      } catch (error) {
        console.warn('Failed to encrypt email for duplicate check:', error)
        encryptedNewEmail = ''
      }
      
      // Try finding with encrypted email
      let existingByEmail = null
      if (encryptedNewEmail) {
        existingByEmail = await Employee.findOne({ 
          email: encryptedNewEmail,
          _id: { $ne: employee._id }
        })
      }
      
      // If not found, check by decrypting all emails (fallback)
      if (!existingByEmail) {
        const allEmployees = await Employee.find({ _id: { $ne: employee._id } })
          .select('email')
          .lean()
        for (const emp of allEmployees) {
          if (emp.email && typeof emp.email === 'string') {
            try {
              const decryptedEmail = decrypt(emp.email)
              if (decryptedEmail.toLowerCase() === updateData.email.trim().toLowerCase()) {
                existingByEmail = emp
                break
              }
            } catch (error) {
              continue
            }
          }
        }
      }
      
      if (existingByEmail) {
        throw new Error(`Employee with email already exists: ${updateData.email}`)
      }
    }
  }

  // Validate and update companyId if provided - it cannot be removed or set to empty
  if (updateData.companyId !== undefined) {
    if (!updateData.companyId || (typeof updateData.companyId === 'string' && updateData.companyId.trim() === '')) {
      throw new Error('companyId cannot be empty or null. Every employee must be associated with a company.')
    }
    
    // Verify the company exists
    const company = await Company.findOne({ id: updateData.companyId })
    if (!company) {
      throw new Error(`Company not found: ${updateData.companyId}`)
    }
    
    // Update companyId - always set from company lookup
    employee.companyId = company._id
    // Update companyName to match the company (derived from companyId, for display purposes only)
    employee.companyName = company.name
  }
  
  // If companyName is provided in updateData, ignore it - it's derived from companyId only
  // This ensures companyName is always in sync with the company table

  // Update location if locationId is provided
  if (updateData.locationId !== undefined) {
    if (updateData.locationId) {
      const Location = require('../models/Location').default
      // Fetch location with populated companyId for reliable company ID extraction
      const location = await Location.findOne({ id: updateData.locationId })
        .populate('companyId', 'id name')
        .lean()
      
      if (!location) {
        throw new Error(`Location not found: ${updateData.locationId}`)
      }
      
      // Verify location belongs to the employee's company
      // Get employee's company ID - handle both populated and ObjectId cases
      let employeeCompanyId: string | null = null
      if (employee.companyId) {
        if (typeof employee.companyId === 'object' && employee.companyId !== null && !Array.isArray(employee.companyId)) {
          // Populated company object
          if (employee.companyId.id && typeof employee.companyId.id === 'string') {
            employeeCompanyId = String(employee.companyId.id).trim()
          } else if (employee.companyId._id) {
            // Populated but no id field - fetch company
            const empCompany = await Company.findById(employee.companyId._id).select('id').lean()
            if (empCompany && empCompany.id) {
              employeeCompanyId = String(empCompany.id).trim()
            }
          }
        } else if (typeof employee.companyId === 'string' || employee.companyId instanceof mongoose.Types.ObjectId) {
          // ObjectId string or ObjectId - fetch company
          const empCompany = await Company.findById(employee.companyId).select('id').lean()
          if (empCompany && empCompany.id) {
            employeeCompanyId = String(empCompany.id).trim()
          }
        }
      }
      
      // Get location's company ID - handle both populated and ObjectId cases
      let locationCompanyId: string | null = null
      if (location.companyId) {
        if (typeof location.companyId === 'object' && location.companyId !== null && !Array.isArray(location.companyId)) {
          // Populated company object (from .populate())
          if (location.companyId.id && typeof location.companyId.id === 'string') {
            locationCompanyId = String(location.companyId.id).trim()
          } else if (location.companyId._id) {
            // Populated but no id field - fetch company
            const locCompany = await Company.findById(location.companyId._id).select('id').lean()
            if (locCompany && locCompany.id) {
              locationCompanyId = String(locCompany.id).trim()
            }
          }
        } else if (typeof location.companyId === 'string' || location.companyId instanceof mongoose.Types.ObjectId) {
          // ObjectId string or ObjectId - fetch company
          const locCompany = await Company.findById(location.companyId).select('id').lean()
          if (locCompany && locCompany.id) {
            locationCompanyId = String(locCompany.id).trim()
          }
        }
      }
      
      // Validate that we have valid company IDs
      if (!employeeCompanyId) {
        throw new Error(`Cannot determine employee's company ID. Please ensure the employee has a valid company association.`)
      }
      
      if (!locationCompanyId) {
        throw new Error(`Cannot determine location's company ID for location ${updateData.locationId}. The location may have an invalid company association.`)
      }
      
      // Debug logging
      console.log(`[updateEmployee] Location-Company validation:`, {
        employeeId: employee.employeeId || employee.id,
        locationId: updateData.locationId,
        employeeCompanyId: employeeCompanyId,
        locationCompanyId: locationCompanyId,
        match: employeeCompanyId === locationCompanyId
      })
      
      // Compare company IDs (both should be strings at this point)
      if (locationCompanyId !== employeeCompanyId) {
        throw new Error(`Location ${updateData.locationId} does not belong to employee's company. Employee company: ${employeeCompanyId}, Location company: ${locationCompanyId}`)
      }
      
      // Set locationId - .lean() preserves _id field
      if (location._id) {
        employee.locationId = location._id
      } else {
        // Fallback: fetch location document if _id is missing (shouldn't happen)
        const locationDoc = await Location.findOne({ id: updateData.locationId })
        if (locationDoc) {
          employee.locationId = locationDoc._id
        } else {
          throw new Error(`Location ${updateData.locationId} not found when setting employee location`)
        }
      }
    } else {
      employee.locationId = undefined
    }
  }

  // Update other fields
  if (updateData.firstName !== undefined) employee.firstName = updateData.firstName
  if (updateData.lastName !== undefined) employee.lastName = updateData.lastName
  if (updateData.designation !== undefined) employee.designation = updateData.designation
  if (updateData.gender !== undefined) employee.gender = updateData.gender
  if (updateData.location !== undefined) employee.location = updateData.location
  if (updateData.email !== undefined) employee.email = updateData.email
  if (updateData.mobile !== undefined) employee.mobile = updateData.mobile
  if (updateData.shirtSize !== undefined) employee.shirtSize = updateData.shirtSize
  if (updateData.pantSize !== undefined) employee.pantSize = updateData.pantSize
  if (updateData.shoeSize !== undefined) employee.shoeSize = updateData.shoeSize
  if (updateData.address !== undefined) employee.address = updateData.address
  if (updateData.eligibility !== undefined) employee.eligibility = updateData.eligibility
  if (updateData.cycleDuration !== undefined) employee.cycleDuration = updateData.cycleDuration
  if (updateData.dispatchPreference !== undefined) employee.dispatchPreference = updateData.dispatchPreference
  if (updateData.status !== undefined) employee.status = updateData.status
  if (updateData.period !== undefined) employee.period = updateData.period
  if (updateData.dateOfJoining !== undefined) employee.dateOfJoining = updateData.dateOfJoining

  await employee.save()
  
  // Fetch the updated employee with populated fields
  const updated = await Employee.findOne({ id: employeeId })
    .populate('companyId', 'id name')
    .populate('locationId', 'id name address city state pincode')
    .lean()

  if (!updated) return null
  
  // Since we used .lean(), the post hooks don't run, so we need to manually decrypt sensitive fields
  const { decrypt } = require('../utils/encryption')
  const sensitiveFields = ['email', 'mobile', 'address', 'firstName', 'lastName', 'designation']
  for (const field of sensitiveFields) {
    if (updated[field] && typeof updated[field] === 'string' && updated[field].includes(':')) {
      try {
        updated[field] = decrypt(updated[field])
      } catch (error) {
        console.warn(`Failed to decrypt field ${field} for employee ${employeeId}:`, error)
      }
    }
  }

  return toPlainObject(updated)
}

export async function deleteEmployee(employeeId: string): Promise<boolean> {
  await connectDB()
  
  const employee = await Employee.findOne({ id: employeeId })
  if (!employee) {
    throw new Error(`Employee not found: ${employeeId}`)
  }

  await Employee.deleteOne({ id: employeeId })
  return true
}

// ========== VENDOR-PRODUCT-COMPANY MAPPING FUNCTIONS ==========

/**
 * Find which vendor(s) supply a specific product to a specific company
 * Returns an array of vendors (for multi-vendor support), or empty array if no vendors found
 * If preferFirst is true, returns only the first vendor (for backward compatibility)
 */
export async function getVendorsForProductCompany(
  productId: string, 
  companyId: string | number, 
  preferFirst: boolean = true
): Promise<Array<{ vendorId: string, vendorName: string }>> {
  await connectDB()
  
  console.log(`[getVendorsForProductCompany] ===== FUNCTION CALLED =====`)
  console.log(`[getVendorsForProductCompany] Looking for productId=${productId} (type: ${typeof productId}), companyId=${companyId} (type: ${typeof companyId})`)
  
  // Find product and company by their string/numeric IDs
  // Handle both string and numeric product IDs
  let product = await Uniform.findOne({ id: productId })
  if (!product) {
    // If productId is numeric, try converting to string
    const productIdStr = String(productId)
    product = await Uniform.findOne({ id: productIdStr })
  }
  if (!product) {
    // If productId is string, try converting to number
    const productIdNum = Number(productId)
    if (!isNaN(productIdNum)) {
      product = await Uniform.findOne({ id: productIdNum })
    }
  }
  if (!product) {
    console.error(`[getVendorsForProductCompany] Product not found: ${productId} (type: ${typeof productId})`)
    // List available products for debugging
    const allProducts = await Uniform.find({}, 'id name').limit(5).lean()
    console.error(`[getVendorsForProductCompany] Available products (sample):`, allProducts.map((p: any) => `id=${p.id} (type: ${typeof p.id})`))
    return []
  }
  
  // Try to find company - handle both numeric and string IDs
  let company = await Company.findOne({ id: companyId })
  if (!company) {
    // If companyId is numeric, try converting to string
    const companyIdStr = String(companyId)
    company = await Company.findOne({ id: companyIdStr })
  }
  
  if (!company) {
    console.error(`[getVendorsForProductCompany] Company not found: ${companyId} (type: ${typeof companyId})`)
    // List available companies for debugging
    const allCompanies = await Company.find({}, 'id name').limit(5).lean()
    console.error(`[getVendorsForProductCompany] Available companies (sample):`, allCompanies.map((c: any) => `id=${c.id}, name=${c.name}`))
    return []
  }
  
  console.log(`[getVendorsForProductCompany] Found product: ${product.id}, company: ${company.id}`)
  console.log(`[getVendorsForProductCompany] Product _id: ${product._id}, Company _id: ${company._id}`)
  
  // Check if product is directly linked to company
  // Use raw MongoDB as fallback for more reliable lookup
  const db = mongoose.connection.db
  let productCompanyLink = await ProductCompany.findOne({
    productId: product._id,
    companyId: company._id
  })
  
  // Fallback: use raw MongoDB collection if Mongoose lookup fails
  if (!productCompanyLink && db) {
    console.log(`[getVendorsForProductCompany] ProductCompany not found via Mongoose, trying raw MongoDB collection`)
    const rawProductCompanies = await db.collection('productcompanies').find({
      productId: product._id,
      companyId: company._id
    }).toArray()
    
    if (rawProductCompanies.length > 0) {
      console.log(`[getVendorsForProductCompany] ✓ Found ProductCompany link in raw collection`)
      // Set productCompanyLink to a truthy value so the function continues
      // We know the relationship exists, so we can proceed even if Mongoose query fails
      productCompanyLink = rawProductCompanies[0] as any
    }
  }
  
  if (!productCompanyLink) {
    console.error(`[getVendorsForProductCompany] ❌ Product ${productId} (${product.name || product.id}) is not linked to company ${companyId} (${company.name || company.id})`)
    console.error(`[getVendorsForProductCompany] Product _id: ${product._id}, Company _id: ${company._id}`)
    // List existing ProductCompany relationships for debugging
    const allProductCompanies = await ProductCompany.find({ productId: product._id }).populate('companyId', 'id name').limit(5).lean()
    console.error(`[getVendorsForProductCompany] Product is linked to companies:`, allProductCompanies.map((pc: any) => pc.companyId?.id || pc.companyId?.toString()))
    
    // Also check raw collection
    if (db) {
      const rawProductCompanies = await db.collection('productcompanies').find({ productId: product._id }).toArray()
      console.error(`[getVendorsForProductCompany] Raw ProductCompany links for product:`, rawProductCompanies.map((pc: any) => `companyId=${pc.companyId?.toString()}`))
    }
    return []
  }
  
  console.log(`[getVendorsForProductCompany] ✓ Product-Company link found`)
  
  // ALWAYS use raw MongoDB for ProductVendor lookup - most reliable method
  if (!db) {
    console.error(`[getVendorsForProductCompany] Database connection not available`)
    return []
  }
  
  const productIdStr = product._id.toString()
  console.log(`[getVendorsForProductCompany] Searching for ProductVendor links with productId: ${productIdStr}`)
  
  // Get all ProductVendor links from raw collection
  const rawProductVendors = await db.collection('productvendors').find({}).toArray()
  console.log(`[getVendorsForProductCompany] Total ProductVendor links in DB: ${rawProductVendors.length}`)
  
  console.log(`[getVendorsForProductCompany] Filtering by productId=${productIdStr}`)
  
  // Filter by productId - ProductCompany link already validates company access
  // ProductVendor links are product-vendor only (no companyId needed)
  const matchingLinks = rawProductVendors.filter((pv: any) => {
    if (!pv.productId) return false
    const pvProductIdStr = pv.productId.toString()
    return pvProductIdStr === productIdStr
  })
  
  console.log(`[getVendorsForProductCompany] Found ${matchingLinks.length} ProductVendor link(s) for product ${productId} and company ${companyId}`)
  
  if (matchingLinks.length === 0) {
    console.error(`[getVendorsForProductCompany] ❌ No ProductVendor relationships found for product ${productId} (${product.name || product.id})`)
    console.error(`[getVendorsForProductCompany] Product _id: ${productIdStr}`)
    console.error(`[getVendorsForProductCompany] All ProductVendor links in DB:`)
    rawProductVendors.forEach((pv: any, i: number) => {
      console.error(`  ${i + 1}. productId: ${pv.productId?.toString()}, vendorId: ${pv.vendorId?.toString()}`)
    })
    return []
  }
  
  // Get all vendors for lookup
  const allVendors = await db.collection('vendors').find({}).toArray()
  const vendorMap = new Map<string, { id: string, name: string, _id: any }>()
  allVendors.forEach((v: any) => {
    vendorMap.set(v._id.toString(), { id: v.id, name: v.name, _id: v._id })
  })
  
  // Extract vendor information from matching links
  const matchingVendors: Array<{ vendorId: string, vendorName: string }> = []
  
  for (const pvLink of matchingLinks) {
    if (!pvLink.vendorId) {
      console.warn(`[getVendorsForProductCompany] ProductVendor link has no vendorId`)
      continue
    }
    
    const vendorIdStr = pvLink.vendorId.toString()
    const vendor = vendorMap.get(vendorIdStr)
    
    if (vendor) {
      matchingVendors.push({
        vendorId: vendor.id,
        vendorName: vendor.name || 'Unknown Vendor'
      })
      console.log(`[getVendorsForProductCompany] ✓ Added vendor: ${vendor.id} (${vendor.name})`)
    } else {
      console.warn(`[getVendorsForProductCompany] Vendor not found for vendorId: ${vendorIdStr}`)
    }
  }
  
  // OLD CODE BELOW - REMOVED - Using raw MongoDB directly above
  // Old duplicate code removed - using raw MongoDB directly above
  
  // Return results
  if (matchingVendors.length === 0) {
    console.error(`[getVendorsForProductCompany] No vendors found for product ${productId}`)
  } else {
    console.log(`[getVendorsForProductCompany] ✓ Returning ${matchingVendors.length} vendor(s):`, matchingVendors.map(v => `${v.vendorId} (${v.vendorName})`))
  }
  
  // If preferFirst is true, return only the first vendor
  if (preferFirst && matchingVendors.length > 0) {
    return [matchingVendors[0]]
  }
  
  return matchingVendors
}

/**
 * Find which vendor supplies a specific product to a specific company
 * Returns the vendor ID and name, or null if no vendor found
 * This is a convenience wrapper that returns only the first vendor (for backward compatibility)
 */
export async function getVendorForProductCompany(productId: string, companyId: string): Promise<{ vendorId: string, vendorName: string } | null> {
  await connectDB()
  
  const vendors = await getVendorsForProductCompany(productId, companyId, true)
  return vendors.length > 0 ? vendors[0] : null
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
    .populate('employeeId', 'id firstName lastName email locationId')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .populate('vendorId', 'id name')
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

/**
 * Get all orders for employees in a specific location
 * @param locationId Location ID (6-digit numeric string or ObjectId)
 * @returns Array of orders for employees in that location
 */
export async function getOrdersByLocation(locationId: string): Promise<any[]> {
  await connectDB()
  
  const Location = require('../models/Location').default
  const location = await Location.findOne({ 
    $or: [
      { id: locationId },
      { _id: locationId }
    ]
  })
  
  if (!location) {
    return []
  }

  // Get all employees in this location
  const locationEmployees = await Employee.find({ locationId: location._id })
    .select('_id employeeId id')
    .lean()
  
  if (locationEmployees.length === 0) {
    return []
  }

  // Get employee ObjectIds
  const employeeObjectIds = locationEmployees.map((e: any) => e._id)

  // Find orders for these employees
  const orders = await Order.find({ employeeId: { $in: employeeObjectIds } })
    .populate('employeeId', 'id firstName lastName email locationId')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .populate('vendorId', 'id name')
    .sort({ orderDate: -1 })
    .lean()

  return orders.map((o: any) => toPlainObject(o))
}

export async function getOrdersByVendor(vendorId: string): Promise<any[]> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  if (!vendor) return []

  const orders = await Order.find({ vendorId: vendor._id })
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .populate('vendorId', 'id name')
    .sort({ orderDate: -1 })
    .lean()

  return orders.map((o: any) => toPlainObject(o))
}

export async function getOrdersByEmployee(employeeId: string): Promise<any[]> {
  await connectDB()
  
  // OPTIMIZATION: Combine employee lookups into single query with $or
  const employee = await Employee.findOne({
    $or: [
      { employeeId: employeeId },
      { id: employeeId }
    ]
  }).select('_id employeeId id').lean()
  
  if (!employee) {
    return []
  }

  // OPTIMIZATION: Build query conditions once, use indexed fields
  const employeeIdNum = employee.employeeId || employee.id
  const orderQueryConditions: any[] = [
    { employeeId: employee._id } // Primary: ObjectId reference (indexed)
  ]
  
  // Add employeeIdNum conditions for backward compatibility
  if (employeeIdNum) {
    orderQueryConditions.push({ employeeIdNum: employeeIdNum })
    if (typeof employeeIdNum !== 'string') {
      orderQueryConditions.push({ employeeIdNum: String(employeeIdNum) })
    }
  }
  
  const orderQuery: any = orderQueryConditions.length > 1 ? { $or: orderQueryConditions } : orderQueryConditions[0]

  // OPTIMIZATION: Use select() to limit fields, reduce payload size
  const orders = await Order.find(orderQuery)
    .select('id employeeId employeeIdNum employeeName items total status orderDate dispatchLocation companyId deliveryAddress parentOrderId vendorId vendorName isPersonalPayment personalPaymentAmount createdAt')
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .populate('vendorId', 'id name')
    .sort({ orderDate: -1 })
    .lean()

  // Group orders by parentOrderId if they are split orders
  const orderMap = new Map<string, any[]>()
  const standaloneOrders: any[] = []

  for (const order of orders) {
    const plainOrder = toPlainObject(order)
    if (plainOrder.parentOrderId) {
      if (!orderMap.has(plainOrder.parentOrderId)) {
        orderMap.set(plainOrder.parentOrderId, [])
      }
      orderMap.get(plainOrder.parentOrderId)!.push(plainOrder)
    } else {
      standaloneOrders.push(plainOrder)
    }
  }

  // Create grouped orders (one per parentOrderId) and add standalone orders
  const groupedOrders: any[] = []
  
  for (const [parentOrderId, splitOrders] of orderMap.entries()) {
    // Sort split orders by vendor name for consistency
    splitOrders.sort((a, b) => (a.vendorName || '').localeCompare(b.vendorName || ''))
    
    // Create a grouped order object
    const totalAmount = splitOrders.reduce((sum, o) => sum + (o.total || 0), 0)
    const totalItems = splitOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0)
    const allItems = splitOrders.flatMap(o => o.items || [])
    
    // Calculate aggregated status for split orders
    // Status priority: Delivered > Dispatched > Awaiting fulfilment > Awaiting approval
    // For split orders, we need to show the "most advanced" status, but also track per-item status
    const statusPriority: Record<string, number> = {
      'Delivered': 4,
      'Dispatched': 3,
      'Awaiting fulfilment': 2,
      'Awaiting approval': 1,
      'Rejected': 0,
      'Cancelled': 0
    }
    
    // Find the highest priority status among all child orders
    let aggregatedStatus = splitOrders[0].status
    let maxPriority = statusPriority[splitOrders[0].status] || 0
    
    for (const childOrder of splitOrders) {
      const priority = statusPriority[childOrder.status] || 0
      if (priority > maxPriority) {
        maxPriority = priority
        aggregatedStatus = childOrder.status
      }
    }
    
    // For split orders, also create item-level status mapping
    // Each item should know which child order it belongs to and that order's status
    const itemsWithStatus = allItems.map((item: any, globalIndex: number) => {
      // Find which child order this item belongs to
      let currentIndex = 0
      for (const childOrder of splitOrders) {
        const childItems = childOrder.items || []
        if (globalIndex >= currentIndex && globalIndex < currentIndex + childItems.length) {
          return {
            ...item,
            _itemStatus: childOrder.status, // Store the status of the child order containing this item
            _childOrderId: childOrder.id // Store the child order ID for reference
          }
        }
        currentIndex += childItems.length
      }
      return item
    })
    
    groupedOrders.push({
      ...splitOrders[0], // Use first order as base
      id: parentOrderId, // Use parent order ID as the main ID
      isSplitOrder: true,
      splitOrders: splitOrders,
      status: aggregatedStatus, // Use calculated aggregated status
      total: totalAmount,
      items: itemsWithStatus, // Items with per-item status
      vendorCount: splitOrders.length,
      vendors: splitOrders.map(o => o.vendorName).filter(Boolean)
    })
  }

  // Combine grouped and standalone orders, sorted by date
  const allOrders = [...groupedOrders, ...standaloneOrders]
  allOrders.sort((a, b) => {
    const dateA = new Date(a.orderDate || 0).getTime()
    const dateB = new Date(b.orderDate || 0).getTime()
    return dateB - dateA
  })

  return allOrders
}

export async function getOrdersByParentOrderId(parentOrderId: string): Promise<any[]> {
  await connectDB()
  
  const orders = await Order.find({ parentOrderId: parentOrderId })
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .populate('vendorId', 'id name')
    .sort({ orderDate: -1 })
    .lean()

  return orders.map((o: any) => toPlainObject(o))
}

/**
 * Get employee eligibility from designation rules
 * Falls back to employee-level eligibility if no designation rule exists
 */
export async function getEmployeeEligibilityFromDesignation(employeeId: string): Promise<{
  shirt: number
  pant: number
  shoe: number
  jacket: number
  cycleDurations: {
    shirt: number
    pant: number
    shoe: number
    jacket: number
  }
}> {
  await connectDB()
  
  // Use employeeId field instead of id field
  let employee = await Employee.findOne({ employeeId: employeeId })
  if (!employee) {
    // Fallback: try by id field for backward compatibility
    employee = await Employee.findOne({ id: employeeId })
  }
  if (!employee) {
    return {
      shirt: 0,
      pant: 0,
      shoe: 0,
      jacket: 0,
      cycleDurations: { shirt: 6, pant: 6, shoe: 6, jacket: 12 }
    }
  }

  // Get company ID
  const company = await Company.findById(employee.companyId)
  if (!company) {
    // Fallback to employee-level eligibility
    return {
      shirt: employee.eligibility?.shirt || 0,
      pant: employee.eligibility?.pant || 0,
      shoe: employee.eligibility?.shoe || 0,
      jacket: employee.eligibility?.jacket || 0,
      cycleDurations: employee.cycleDuration || { shirt: 6, pant: 6, shoe: 6, jacket: 12 }
    }
  }

  // Get designation eligibility (with gender filter)
  const designationEligibility = await getDesignationEligibilityByDesignation(
    company.id, 
    employee.designation,
    employee.gender as 'male' | 'female'
  )
  
  if (designationEligibility && designationEligibility.itemEligibility) {
    // Use designation-level eligibility
    const itemElig = designationEligibility.itemEligibility
    const eligibility = {
      shirt: itemElig.shirt?.quantity || 0,
      pant: itemElig.trouser?.quantity || itemElig.pant?.quantity || 0,
      shoe: itemElig.shoe?.quantity || 0,
      jacket: itemElig.blazer?.quantity || itemElig.jacket?.quantity || 0,
    }
    
    // Convert renewal frequency to months for cycle duration
    const convertToMonths = (itemElig: any): number => {
      if (!itemElig) return 6 // Default
      if (itemElig.renewalUnit === 'years') {
        return itemElig.renewalFrequency * 12
      }
      return itemElig.renewalFrequency || 6
    }
    
    const cycleDurations = {
      shirt: convertToMonths(itemElig.shirt),
      pant: convertToMonths(itemElig.trouser || itemElig.pant),
      shoe: convertToMonths(itemElig.shoe),
      jacket: convertToMonths(itemElig.blazer || itemElig.jacket),
    }
    
    return { ...eligibility, cycleDurations }
  }

  // Fallback to employee-level eligibility
  return {
    shirt: employee.eligibility?.shirt || 0,
    pant: employee.eligibility?.pant || 0,
    shoe: employee.eligibility?.shoe || 0,
    jacket: employee.eligibility?.jacket || 0,
    cycleDurations: employee.cycleDuration || { shirt: 6, pant: 6, shoe: 6, jacket: 12 }
  }
}

export async function getConsumedEligibility(employeeId: string): Promise<{
  shirt: number
  pant: number
  shoe: number
  jacket: number
}> {
  await connectDB()
  
  // Use employeeId field instead of id field
  let employee = await Employee.findOne({ employeeId: employeeId })
  if (!employee) {
    // Fallback: try by id field for backward compatibility
    employee = await Employee.findOne({ id: employeeId })
  }
  if (!employee) {
    return { shirt: 0, pant: 0, shoe: 0, jacket: 0 }
  }

  // Get employee's date of joining (default to Oct 1, 2025 if not set)
  const dateOfJoining = employee.dateOfJoining 
    ? new Date(employee.dateOfJoining) 
    : new Date('2025-10-01T00:00:00.000Z')

  // Get cycle durations from designation rules (or fallback to employee-level)
  const { cycleDurations } = await getEmployeeEligibilityFromDesignation(employeeId)

  // Get all orders that count towards consumed eligibility (all except cancelled)
  // We'll filter by item-specific cycles below
  const orders = await Order.find({
    employeeId: employee._id,
    status: { $in: ['Awaiting approval', 'Awaiting fulfilment', 'Dispatched', 'Delivered'] }
  })
    .populate('items.uniformId', 'id category')
    .lean()

  const consumed = { shirt: 0, pant: 0, shoe: 0, jacket: 0 }

  // Get eligibility reset dates for this employee (if any)
  const resetDates = employee.eligibilityResetDates || {}

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
        
        // Check if order date is after the reset date for this category (if reset date exists)
        const resetDate = resetDates[category as keyof typeof resetDates]
        if (resetDate && orderDate < new Date(resetDate)) {
          // Order is before reset date, skip it
          continue
        }
        
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

/**
 * Reusable eligibility validation function
 * Validates if order items would exceed employee eligibility limits
 * Used by both single order creation and bulk uploads
 * 
 * @param employeeId Employee ID (6-digit numeric string)
 * @param orderItems Array of order items with category and quantity
 * @returns Validation result with success status and error details
 */
export async function validateEmployeeEligibility(
  employeeId: string,
  orderItems: Array<{
    uniformId: string
    uniformName: string
    category: 'shirt' | 'pant' | 'shoe' | 'jacket' | 'accessory'
    quantity: number
  }>
): Promise<{
  valid: boolean
  errors: Array<{ item: string, category: string, error: string }>
  remainingEligibility: { shirt: number, pant: number, shoe: number, jacket: number }
}> {
  await connectDB()
  
  // Find employee
  let employee = await Employee.findOne({ employeeId: employeeId })
  if (!employee) {
    employee = await Employee.findOne({ id: employeeId })
  }
  if (!employee) {
    return {
      valid: false,
      errors: [{ item: 'Employee', category: 'general', error: `Employee not found: ${employeeId}` }],
      remainingEligibility: { shirt: 0, pant: 0, shoe: 0, jacket: 0 }
    }
  }
  
  // Get employee eligibility (from designation rules or employee-level)
  // Function returns: { shirt, pant, shoe, jacket, cycleDurations }
  const eligibilityData = await getEmployeeEligibilityFromDesignation(employeeId)
  
  // Extract eligibility values (function returns them directly, not wrapped in totalEligibility)
  const totalEligibility = {
    shirt: eligibilityData.shirt || 0,
    pant: eligibilityData.pant || 0,
    shoe: eligibilityData.shoe || 0,
    jacket: eligibilityData.jacket || 0
  }
  
  // Get consumed eligibility
  const consumedEligibility = await getConsumedEligibility(employeeId)
  
  // Calculate remaining eligibility
  const remainingEligibility = {
    shirt: Math.max(0, totalEligibility.shirt - consumedEligibility.shirt),
    pant: Math.max(0, totalEligibility.pant - consumedEligibility.pant),
    shoe: Math.max(0, totalEligibility.shoe - consumedEligibility.shoe),
    jacket: Math.max(0, totalEligibility.jacket - consumedEligibility.jacket)
  }
  
  // Validate each order item
  const errors: Array<{ item: string, category: string, error: string }> = []
  const categoryQuantities: { shirt: number, pant: number, shoe: number, jacket: number } = {
    shirt: 0,
    pant: 0,
    shoe: 0,
    jacket: 0
  }
  
  // Sum quantities by category from order items
  for (const item of orderItems) {
    const category = item.category
    if (category === 'shirt' || category === 'pant' || category === 'shoe' || category === 'jacket') {
      categoryQuantities[category] += item.quantity || 0
    }
  }
  
  // Check if quantities exceed remaining eligibility
  if (categoryQuantities.shirt > remainingEligibility.shirt) {
    errors.push({
      item: orderItems.find(i => i.category === 'shirt')?.uniformName || 'Shirt',
      category: 'shirt',
      error: `Exceeds eligibility: Requested ${categoryQuantities.shirt}, Available ${remainingEligibility.shirt}`
    })
  }
  
  if (categoryQuantities.pant > remainingEligibility.pant) {
    errors.push({
      item: orderItems.find(i => i.category === 'pant')?.uniformName || 'Pant',
      category: 'pant',
      error: `Exceeds eligibility: Requested ${categoryQuantities.pant}, Available ${remainingEligibility.pant}`
    })
  }
  
  if (categoryQuantities.shoe > remainingEligibility.shoe) {
    errors.push({
      item: orderItems.find(i => i.category === 'shoe')?.uniformName || 'Shoe',
      category: 'shoe',
      error: `Exceeds eligibility: Requested ${categoryQuantities.shoe}, Available ${remainingEligibility.shoe}`
    })
  }
  
  if (categoryQuantities.jacket > remainingEligibility.jacket) {
    errors.push({
      item: orderItems.find(i => i.category === 'jacket')?.uniformName || 'Jacket',
      category: 'jacket',
      error: `Exceeds eligibility: Requested ${categoryQuantities.jacket}, Available ${remainingEligibility.jacket}`
    })
  }
  
  return {
    valid: errors.length === 0,
    errors,
    remainingEligibility
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
  isPersonalPayment?: boolean
  personalPaymentAmount?: number
  usePersonalAddress?: boolean // Flag: true if using personal address, false if using official location (default: false)
}): Promise<any> {
  await connectDB()
  
  // Find employee and company - use employeeId field first
  console.log(`[createOrder] Looking for employee with employeeId=${orderData.employeeId} (type: ${typeof orderData.employeeId})`)
  
  // Use employeeId field first (primary lookup)
  let employee = await Employee.findOne({ employeeId: orderData.employeeId })
  
  // If not found by employeeId, try by id field (fallback for backward compatibility)
  if (!employee) {
    console.log(`[createOrder] Employee not found by employeeId, trying id field`)
    employee = await Employee.findOne({ id: orderData.employeeId })
  }
  
  // If still not found, try by _id (ObjectId)
  if (!employee && mongoose.Types.ObjectId.isValid(orderData.employeeId)) {
    console.log(`[createOrder] Employee not found by employeeId or id, trying _id lookup`)
    employee = await Employee.findById(orderData.employeeId)
  }
  
  if (!employee) {
    console.error(`[createOrder] ❌ Employee not found with any ID format: ${orderData.employeeId}`)
    // List available employees for debugging
    const sampleEmployees = await Employee.find({}, 'id employeeId email firstName lastName').limit(5).lean()
    console.error(`[createOrder] Available employees (sample):`, sampleEmployees.map((e: any) => `id=${e.id}, employeeId=${e.employeeId}, email=${e.email}`))
    throw new Error(`Employee not found: ${orderData.employeeId}. Please ensure you are logged in with a valid employee account.`)
  }
  
  console.log(`[createOrder] ✓ Found employee: id=${employee.id}, employeeId=${employee.employeeId}, email=${employee.email}`)
  console.log(`[createOrder] Employee companyId type=${typeof employee.companyId}, value=${employee.companyId}`)
  console.log(`[createOrder] Employee companyId isObject=${typeof employee.companyId === 'object'}, isNull=${employee.companyId === null}`)

  // Use raw MongoDB collection to reliably get the employee's companyId ObjectId
  // This is necessary because Mongoose populate might fail or return inconsistent data
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('Database connection not available')
  }

  // Get raw employee document to ensure we have the actual companyId ObjectId
  // Try multiple lookup methods - use employeeId field first
  let rawEmployee = await db.collection('employees').findOne({ employeeId: orderData.employeeId })
  
  if (!rawEmployee) {
    rawEmployee = await db.collection('employees').findOne({ id: orderData.employeeId })
  }
  
  if (!rawEmployee && mongoose.Types.ObjectId.isValid(orderData.employeeId)) {
    rawEmployee = await db.collection('employees').findOne({ _id: new mongoose.Types.ObjectId(orderData.employeeId) })
  }
  
  if (!rawEmployee) {
    console.error(`[createOrder] ❌ Raw employee document not found for any ID format: ${orderData.employeeId}`)
    throw new Error(`Employee not found: ${orderData.employeeId}. Please ensure you are logged in with a valid employee account.`)
  }

  console.log(`[createOrder] Raw employee companyId:`, rawEmployee.companyId, 'Type:', typeof rawEmployee.companyId)
  
  // Extract companyId ObjectId from raw document
  let companyIdObjectId: any = null
  if (rawEmployee.companyId) {
    companyIdObjectId = rawEmployee.companyId
    console.log(`[createOrder] Extracted companyId ObjectId from raw document: ${companyIdObjectId.toString()}`)
  } else {
    console.error(`[createOrder] Raw employee document has no companyId`)
  }
  
  // ENFORCEMENT: Check if employee order is enabled (only for regular employees, not admins)
  // Get employee email to check admin status
  const { decrypt } = require('../utils/encryption')
  let employeeEmail: string | null = null
  if (employee.email) {
    try {
      if (typeof employee.email === 'string' && employee.email.includes(':')) {
        employeeEmail = decrypt(employee.email)
      } else {
        employeeEmail = employee.email
      }
    } catch (error) {
      console.warn('[createOrder] Failed to decrypt employee email for enforcement check')
    }
  }
  
  // Get company ID string for checking
  const companyIdString = await (async () => {
    if (companyIdObjectId) {
      const companyDoc = await Company.findById(companyIdObjectId).select('id').lean()
      return companyDoc?.id || null
    }
    return null
  })()
  
  // If we have employee email and company ID, check enforcement
  if (employeeEmail && companyIdString) {
    const isAdmin = await isCompanyAdmin(employeeEmail, companyIdString)
    const location = await getLocationByAdminEmail(employeeEmail)
    
    // If not an admin, check if employee order is enabled
    if (!isAdmin && !location) {
      const company = await Company.findById(companyIdObjectId).select('enableEmployeeOrder').lean()
      if (company && company.enableEmployeeOrder === false) {
        throw new Error('Employee orders are currently disabled for your company. Please contact your administrator.')
      }
    }
  }
  
  // Find company using ObjectId from raw document
  let company
  if (!companyIdObjectId) {
    console.error(`[createOrder] Employee ${orderData.employeeId} has no companyId in raw document`)
    // Employee must have a companyId - this is a data integrity issue
    // List available companies for debugging
    const allCompanies = await Company.find({}, 'id name').limit(10).lean()
    console.error(`[createOrder] Available companies (sample):`, allCompanies.map((c: any) => `id=${c.id}, name=${c.name}, _id=${c._id}`))
    throw new Error(`Employee ${orderData.employeeId} has no companyId. Please ensure the employee is linked to a valid company using companyId.`)
  } else {
    // Use ObjectId to find company
    const companyIdStr = companyIdObjectId.toString()
    console.log(`[createOrder] Looking for company by ObjectId: ${companyIdStr}`)
    
    // Ensure companyIdObjectId is a proper ObjectId instance
    let companyObjectId: mongoose.Types.ObjectId
    if (companyIdObjectId instanceof mongoose.Types.ObjectId) {
      companyObjectId = companyIdObjectId
    } else if (typeof companyIdObjectId === 'string') {
      companyObjectId = new mongoose.Types.ObjectId(companyIdObjectId)
    } else {
      companyObjectId = companyIdObjectId
    }
    
    // Try findById first
    company = await Company.findById(companyObjectId)
    
    if (!company) {
      console.warn(`[createOrder] Company not found by ObjectId ${companyIdStr}, trying alternative lookup methods`)
      
      // Method 1: Try raw MongoDB collection lookup
      const allCompanies = await db.collection('companies').find({}).toArray()
      console.log(`[createOrder] Found ${allCompanies.length} companies in raw collection`)
      
      const companyDoc = allCompanies.find((c: any) => {
        const cIdStr = c._id.toString()
        return cIdStr === companyIdStr
      })
      
      if (companyDoc) {
        console.log(`[createOrder] ✓ Found company in raw collection: id=${companyDoc.id}, name=${companyDoc.name}, _id=${companyDoc._id}`)
        // Try multiple ways to fetch using Mongoose
        company = await Company.findById(companyDoc._id)
        
        if (!company) {
          // Try by numeric id
          if (companyDoc.id) {
            company = await Company.findOne({ id: companyDoc.id })
          }
        }
        
        if (!company) {
          // Try by name as last resort
          if (companyDoc.name) {
            company = await Company.findOne({ name: companyDoc.name })
          }
        }
      } else {
        console.error(`[createOrder] ❌ Company not found in raw collection with _id: ${companyIdStr}`)
        console.error(`[createOrder] Available company _id values:`)
        allCompanies.slice(0, 10).forEach((c: any) => {
          console.error(`[createOrder]   _id=${c._id.toString()}, id=${c.id}, name=${c.name}`)
        })
      }
      
      if (!company) {
        console.error(`[createOrder] ❌ Company not found by ObjectId ${companyIdStr} after all lookup attempts`)
        // List available companies for debugging
        const allCompaniesList = await Company.find({}, 'id name _id').limit(10).lean()
        console.error(`[createOrder] Available companies via Mongoose (sample):`, allCompaniesList.map((c: any) => `id=${c.id}, name=${c.name}, _id=${c._id?.toString()}`))
        console.error(`[createOrder] Looking for company with _id matching: ${companyIdStr}`)
        throw new Error(`Company not found for employee: ${orderData.employeeId} (companyId ObjectId: ${companyIdStr}). Please ensure the employee is linked to a valid company using companyId.`)
      }
    }
  }
  
  if (!company) {
    console.error(`[createOrder] Company lookup failed for employee ${orderData.employeeId}`)
    console.error(`[createOrder] companyId ObjectId was: ${companyIdObjectId?.toString() || 'null'}`)
    // List available companies for debugging
    const allCompanies = await Company.find({}, 'id name').limit(10).lean()
    console.error(`[createOrder] Available companies (sample):`, allCompanies.map((c: any) => `id=${c.id}, name=${c.name}, _id=${c._id}`))
    throw new Error(`Company not found for employee: ${orderData.employeeId}. Please ensure the employee is linked to a valid company.`)
  }
  
  console.log(`[createOrder] ✓ Found company: id=${company.id}, name=${company.name}, _id=${company._id}`)

  // ========== DELIVERY LOCATION VALIDATION ==========
  // Enforce company-level delivery location rules based on allowPersonalAddressDelivery
  const allowPersonalAddressDelivery = company.allowPersonalAddressDelivery ?? false // Default: false for backward compatibility
  
  let deliveryAddressToUse: string
  
  // If company does NOT allow personal address delivery
  if (!allowPersonalAddressDelivery) {
    // Personal address must NOT be selectable - enforce official location delivery only
    if (orderData.usePersonalAddress === true) {
      throw new Error('Personal address delivery is not allowed for this company. Orders must be delivered to the official location.')
    }
    
    // Get employee's official location address
    if (!employee.locationId) {
      // For backward compatibility: if employee has no locationId, use their personal address as fallback
      // But log a warning that locationId should be set
      console.warn(`[createOrder] Employee ${orderData.employeeId} has no locationId. Using personal address as fallback.`)
      deliveryAddressToUse = orderData.deliveryAddress || employee.address || 'Address not available'
    } else {
      // Employee has locationId - fetch location and use its address
      const Location = require('../models/Location').default
      const location = await Location.findById(employee.locationId)
      
      if (!location) {
        throw new Error(`Employee's assigned location not found. Please ensure the employee has a valid location assigned.`)
      }
      
      // Build location address from location fields
      const locationAddressParts = [
        location.address,
        location.city,
        location.state,
        location.pincode
      ].filter(Boolean) // Remove empty parts
      
      deliveryAddressToUse = locationAddressParts.length > 0
        ? locationAddressParts.join(', ')
        : location.name || 'Location address not available'
      
      console.log(`[createOrder] Using official location address: ${deliveryAddressToUse}`)
    }
  } else {
    // Company ALLOWS personal address delivery
    if (orderData.usePersonalAddress === true) {
      // Employee explicitly chose personal address
      deliveryAddressToUse = orderData.deliveryAddress || employee.address || 'Address not available'
      console.log(`[createOrder] Using personal address (explicitly chosen): ${deliveryAddressToUse}`)
    } else {
      // Default: use official location address
      if (!employee.locationId) {
        // Fallback to personal address if no locationId
        console.warn(`[createOrder] Employee ${orderData.employeeId} has no locationId. Using personal address as default.`)
        deliveryAddressToUse = orderData.deliveryAddress || employee.address || 'Address not available'
      } else {
        // Employee has locationId - use official location address as default
        const Location = require('../models/Location').default
        const location = await Location.findById(employee.locationId)
        
        if (!location) {
          // Fallback to personal address if location not found
          console.warn(`[createOrder] Employee's location not found. Using personal address as fallback.`)
          deliveryAddressToUse = orderData.deliveryAddress || employee.address || 'Address not available'
        } else {
          const locationAddressParts = [
            location.address,
            location.city,
            location.state,
            location.pincode
          ].filter(Boolean)
          
          deliveryAddressToUse = locationAddressParts.length > 0
            ? locationAddressParts.join(', ')
            : location.name || 'Location address not available'
          
          console.log(`[createOrder] Using official location address (default): ${deliveryAddressToUse}`)
        }
      }
    }
  }
  // ========== END DELIVERY LOCATION VALIDATION ==========

  // Get company numeric ID for vendor lookup
  const companyStringId = company.id
  if (!companyStringId) {
    console.error(`[createOrder] Company found but has no numeric id field! Company _id: ${company._id}`)
    throw new Error(`Company found but missing numeric ID. Please ensure the company has a valid numeric ID.`)
  }
  console.log(`[createOrder] Using company ID for vendor lookup: ${companyStringId}`)

  // Group items by vendor
  const itemsByVendor = new Map<string, Array<{
    uniformId: mongoose.Types.ObjectId
    productId: string // Numeric/string product ID for correlation
    uniformName: string
    size: string
    quantity: number
    price: number
  }>>()

  const vendorInfoMap = new Map<string, { vendorId: string, vendorName: string, vendorObjectId: mongoose.Types.ObjectId }>()

  // Process each item and find its vendor
  for (const item of orderData.items) {
      console.log(`[createOrder] Processing order item: productId=${item.uniformId}, productName=${item.uniformName}, companyId=${companyStringId}`)
      
      const uniform = await Uniform.findOne({ id: item.uniformId })
      if (!uniform) {
        console.error(`[createOrder] Uniform not found for productId=${item.uniformId}`)
        throw new Error(`Product not found: ${item.uniformName || item.uniformId}`)
      }

      // Use price from item if provided and > 0, otherwise use product price
      const itemPrice = (item.price && item.price > 0) ? item.price : (uniform.price || 0)

    // Find all vendors for this product-company combination (multi-vendor support)
    console.log(`[createOrder] Looking for vendors for product ${item.uniformId} (${uniform.name || item.uniformName}) and company ${companyStringId}`)
    const vendors = await getVendorsForProductCompany(item.uniformId, companyStringId, false)
    console.log(`[createOrder] Found ${vendors.length} vendor(s) for product ${item.uniformId}`)
    
    if (!vendors || vendors.length === 0) {
      console.error(`[createOrder] ❌ No vendor found for product ${item.uniformId} (${uniform.name || item.uniformName}) and company ${companyStringId}`)
      console.error(`[createOrder] This means either:`)
      console.error(`[createOrder]   1. Product ${item.uniformId} is not linked to company ${companyStringId} (ProductCompany relationship missing)`)
      console.error(`[createOrder]   2. Product ${item.uniformId} is not linked to any vendor (ProductVendor relationship missing)`)
      throw new Error(`No vendor found for product "${uniform.name || item.uniformName}" (${item.uniformId}). Please ensure the product is linked to your company and to at least one vendor.`)
    }

    // For now, use the first vendor (can be enhanced later for vendor selection or load balancing)
    // If the same product appears multiple times in the order, we could distribute across vendors
    const vendorInfo = vendors[0]
    console.log(`[createOrder] Using vendor: ${vendorInfo.vendorId} (${vendorInfo.vendorName})`)

    // Get vendor ObjectId
    const vendor = await Vendor.findOne({ id: vendorInfo.vendorId })
    if (!vendor) {
      console.error(`[createOrder] ❌ Vendor not found: ${vendorInfo.vendorId}`)
      throw new Error(`Vendor not found: ${vendorInfo.vendorId}`)
    }
    console.log(`[createOrder] ✓ Vendor found: ${vendor.id}, _id=${vendor._id}`)

    // Group items by vendor
    if (!itemsByVendor.has(vendorInfo.vendorId)) {
      itemsByVendor.set(vendorInfo.vendorId, [])
      vendorInfoMap.set(vendorInfo.vendorId, {
        vendorId: vendorInfo.vendorId,
        vendorName: vendorInfo.vendorName,
        vendorObjectId: vendor._id
      })
    }

    itemsByVendor.get(vendorInfo.vendorId)!.push({
        uniformId: uniform._id,
        productId: uniform.id, // Store numeric/string product ID for correlation
        uniformName: item.uniformName,
        size: item.size,
        quantity: item.quantity,
        price: itemPrice,
    })
  }

  // Generate parent order ID (for grouping split orders)
  const parentOrderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`

  // Create separate orders for each vendor
  const createdOrders = []
  const employeeName = `${employee.firstName} ${employee.lastName}`
  
  // Get numeric IDs for correlation
  const employeeIdNum = employee.employeeId || employee.id // Use employeeId field first, fallback to id
  const companyIdNum = company.id // Company.id is already numeric

  let isFirstOrder = true
  for (const [vendorId, items] of itemsByVendor.entries()) {
    const vendorInfo = vendorInfoMap.get(vendorId)!
    
    // Calculate total for this vendor's order
    const total = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

    // Generate unique order ID for this vendor order
    const orderId = `${parentOrderId}-${vendorId.substring(0, 8).toUpperCase()}`

    // For split orders: Only the first order should be 'Awaiting approval'
    // Other split orders inherit approval status from parent (approved when parent is approved)
    // This ensures only ONE approval request per parent order
    const orderStatus = itemsByVendor.size > 1 && !isFirstOrder 
      ? 'Awaiting fulfilment' // Child orders skip approval, inherit from parent
      : 'Awaiting approval'   // First order (or single order) requires approval

    // Create order for this vendor with numeric IDs for correlation
  const order = await Order.create({
    id: orderId,
    employeeId: employee._id,
    employeeIdNum: employeeIdNum, // Numeric/string employee ID for correlation
      employeeName: employeeName,
      items: items, // Each item already has productId
    total: total,
    status: orderStatus,
    orderDate: new Date(),
    dispatchLocation: orderData.dispatchLocation || employee.dispatchPreference || 'standard',
    companyId: company._id,
    companyIdNum: companyIdNum, // Numeric company ID for correlation
    deliveryAddress: deliveryAddressToUse, // Use validated/derived delivery address
    estimatedDeliveryTime: orderData.estimatedDeliveryTime,
      parentOrderId: parentOrderId, // Link to parent order
      vendorId: vendorInfo.vendorObjectId,
      vendorName: vendorInfo.vendorName,
      isPersonalPayment: orderData.isPersonalPayment || false,
      personalPaymentAmount: orderData.personalPaymentAmount || 0,
  })

    isFirstOrder = false

    // Populate and add to results
  const populatedOrder = await Order.findById(order._id)
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
      .populate('vendorId', 'id name')
    .lean()

    createdOrders.push(toPlainObject(populatedOrder))
  }

  // If only one order was created, return it directly
  // Otherwise, return the first order with metadata about split orders
  if (createdOrders.length === 1) {
    return createdOrders[0]
  }

  // Return the first order with information about split orders
  // The frontend can query for all orders with the same parentOrderId
  return {
    ...createdOrders[0],
    isSplitOrder: true,
    parentOrderId: parentOrderId,
    totalOrders: createdOrders.length,
    splitOrders: createdOrders.map(o => ({
      orderId: o.id,
      vendorName: o.vendorName,
      total: o.total,
      itemCount: o.items?.length || 0
    }))
  }
}

export async function approveOrder(orderId: string, adminEmail: string): Promise<any> {
  await connectDB()
  
  // First, try to find order by id field
  let order = await Order.findOne({ id: orderId })
  
  // If not found by id, check if orderId is a parentOrderId (from grouped approval view)
  // This happens when getPendingApprovals returns parent order ID as the id field
  if (!order) {
    const ordersWithParent = await Order.find({ parentOrderId: orderId })
    if (ordersWithParent.length > 0) {
      // This is a parent order ID, approve all child orders
      return await approveOrderByParentId(orderId, adminEmail)
    }
    
    // If still not found, throw error
    throw new Error(`Order not found: ${orderId}`)
  }
  
  // If this order has a parentOrderId, approve all child orders
  if (order.parentOrderId) {
    return await approveOrderByParentId(order.parentOrderId, adminEmail)
  }
  
  if (order.status !== 'Awaiting approval') {
    throw new Error(`Order ${orderId} is not in 'Awaiting approval' status`)
  }
  
  // Verify admin can approve orders
  // Use raw MongoDB for reliable ObjectId lookup (similar to createOrder)
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('Database connection not available')
  }

  // Convert companyId to ObjectId if needed (handle both ObjectId and string)
  let companyIdObjectId: any = order.companyId
  if (companyIdObjectId && !(companyIdObjectId instanceof mongoose.Types.ObjectId)) {
    if (mongoose.Types.ObjectId.isValid(companyIdObjectId)) {
      companyIdObjectId = new mongoose.Types.ObjectId(companyIdObjectId)
    }
  }

  let company = await Company.findById(companyIdObjectId)
  
  // Fallback: Use raw MongoDB if Mongoose lookup fails
  if (!company) {
    const companyIdStr = companyIdObjectId?.toString()
    console.log(`[approveOrder] Company not found by ObjectId ${companyIdStr}, trying raw MongoDB lookup`)
    
    // Try raw MongoDB lookup with proper ObjectId conversion
    const rawCompany = await db.collection('companies').findOne({ _id: companyIdObjectId })
    if (rawCompany) {
      // Try to find using Mongoose with the raw company data
      if (rawCompany.id) {
        company = await Company.findOne({ id: rawCompany.id })
      }
      if (!company && rawCompany._id) {
        company = await Company.findById(rawCompany._id)
      }
    }
    
    // If still not found, try lookup by business ID (companyIdNum from order)
    if (!company && order.companyIdNum) {
      console.log(`[approveOrder] Trying lookup by business ID: ${order.companyIdNum}`)
      company = await Company.findOne({ id: String(order.companyIdNum) })
    }
    
    if (!company) {
      console.error(`[approveOrder] Company not found for order ${orderId}, companyId: ${companyIdStr}, companyIdNum: ${order.companyIdNum}`)
      const allCompanies = await Company.find({}, 'id name _id').limit(5).lean()
      console.error(`[approveOrder] Available companies:`, allCompanies.map((c: any) => `id=${c.id}, _id=${c._id?.toString()}`))
    throw new Error(`Company not found for order ${orderId}`)
    }
  }
  
  // Find employee by email (handle encryption)
  // Use the same pattern as canApproveOrders for reliable lookup
  const { encrypt, decrypt } = require('../utils/encryption')
  const trimmedEmail = adminEmail.trim()
  let encryptedEmail: string
  
  try {
    encryptedEmail = encrypt(trimmedEmail)
  } catch (error) {
    encryptedEmail = ''
  }
  
  // Try finding with encrypted email first
  let employee = await Employee.findOne({ email: encryptedEmail }).lean()
  
  // If not found, try decryption matching
  if (!employee && encryptedEmail) {
    const allEmployees = await Employee.find({}).lean()
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const decryptedEmail = decrypt(emp.email)
          if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
            employee = emp
            break
          }
        } catch (error) {
          continue
        }
      }
    }
  }
  
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
    .populate('vendorId', 'id name')
    .lean()
  
  return toPlainObject(populatedOrder)
}

async function approveOrderByParentId(parentOrderId: string, adminEmail: string): Promise<any> {
  await connectDB()
  
  // Find all orders with this parentOrderId
  const childOrders = await Order.find({ parentOrderId: parentOrderId })
  if (childOrders.length === 0) {
    throw new Error(`No orders found with parentOrderId: ${parentOrderId}`)
  }
  
  // Verify at least one order is awaiting approval
  const pendingOrders = childOrders.filter(o => o.status === 'Awaiting approval')
  if (pendingOrders.length === 0) {
    throw new Error(`No orders with parentOrderId ${parentOrderId} are in 'Awaiting approval' status`)
  }
  
  // Verify admin can approve orders (check once using first order's company)
  const firstOrder = childOrders[0]
  
  // Use raw MongoDB for reliable ObjectId lookup
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('Database connection not available')
  }

  // Convert companyId to ObjectId if needed (handle both ObjectId and string)
  let companyIdObjectId: any = firstOrder.companyId
  if (companyIdObjectId && !(companyIdObjectId instanceof mongoose.Types.ObjectId)) {
    if (mongoose.Types.ObjectId.isValid(companyIdObjectId)) {
      companyIdObjectId = new mongoose.Types.ObjectId(companyIdObjectId)
    }
  }

  let company = await Company.findById(companyIdObjectId)
  
  // Fallback: Use raw MongoDB if Mongoose lookup fails
  if (!company) {
    const companyIdStr = companyIdObjectId?.toString()
    console.log(`[approveOrderByParentId] Company not found by ObjectId ${companyIdStr}, trying raw MongoDB lookup`)
    
    // Try raw MongoDB lookup with proper ObjectId conversion
    const rawCompany = await db.collection('companies').findOne({ _id: companyIdObjectId })
    if (rawCompany) {
      // Try to find using Mongoose with the raw company data
      if (rawCompany.id) {
        company = await Company.findOne({ id: rawCompany.id })
      }
      if (!company && rawCompany._id) {
        company = await Company.findById(rawCompany._id)
      }
    }
    
    // If still not found, try lookup by business ID (companyIdNum from order)
    if (!company && firstOrder.companyIdNum) {
      console.log(`[approveOrderByParentId] Trying lookup by business ID: ${firstOrder.companyIdNum}`)
      company = await Company.findOne({ id: String(firstOrder.companyIdNum) })
    }
    
    if (!company) {
      console.error(`[approveOrderByParentId] Company not found for parent order ${parentOrderId}, companyId: ${companyIdStr}, companyIdNum: ${firstOrder.companyIdNum}`)
      const allCompanies = await Company.find({}, 'id name _id').limit(5).lean()
      console.error(`[approveOrderByParentId] Available companies:`, allCompanies.map((c: any) => `id=${c.id}, _id=${c._id?.toString()}`))
      throw new Error(`Company not found for parent order ${parentOrderId}`)
    }
  }
  
  // Find employee by email (handle encryption)
  // Use the same pattern as canApproveOrders for reliable lookup
  const { encrypt, decrypt } = require('../utils/encryption')
  const trimmedEmail = adminEmail.trim()
  let encryptedEmail: string
  
  try {
    encryptedEmail = encrypt(trimmedEmail)
  } catch (error) {
    encryptedEmail = ''
  }
  
  // Try finding with encrypted email first
  let employee = await Employee.findOne({ email: encryptedEmail }).lean()
  
  // If not found, try decryption matching
  if (!employee && encryptedEmail) {
    const allEmployees = await Employee.find({}).lean()
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const decryptedEmail = decrypt(emp.email)
          if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
            employee = emp
            break
          }
        } catch (error) {
          continue
        }
      }
    }
  }
  
  if (!employee) {
    throw new Error(`Employee not found: ${adminEmail}`)
  }
  
  const canApprove = await canApproveOrders(adminEmail, company.id)
  if (!canApprove) {
    throw new Error(`User ${adminEmail} does not have permission to approve orders`)
  }
  
  // Approve all child orders (including those that skipped approval)
  for (const childOrder of childOrders) {
    if (childOrder.status === 'Awaiting approval' || childOrder.status === 'Awaiting fulfilment') {
      childOrder.status = 'Awaiting fulfilment'
      await childOrder.save()
    }
  }
  
  // Return the first order as representative
  const populatedOrder = await Order.findById(firstOrder._id)
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .populate('vendorId', 'id name')
    .lean()
  
  return toPlainObject(populatedOrder)
}

export async function bulkApproveOrders(orderIds: string[], adminEmail: string): Promise<{ success: string[], failed: Array<{ orderId: string, error: string }> }> {
  await connectDB()
  
  const results = {
    success: [] as string[],
    failed: [] as Array<{ orderId: string, error: string }>
  }
  
  // Verify admin can approve orders (check once for all orders)
  // Find employee by email (handle encryption)
  // Use the same pattern as canApproveOrders for reliable lookup
  const { encrypt, decrypt } = require('../utils/encryption')
  const trimmedEmail = adminEmail.trim()
  let encryptedEmail: string
  
  try {
    encryptedEmail = encrypt(trimmedEmail)
  } catch (error) {
    encryptedEmail = ''
  }
  
  // Try finding with encrypted email first
  let employee = await Employee.findOne({ email: encryptedEmail }).lean()
  
  // If not found, try decryption matching
  if (!employee && encryptedEmail) {
    const allEmployees = await Employee.find({}).lean()
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const decryptedEmail = decrypt(emp.email)
          if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
            employee = emp
            break
          }
        } catch (error) {
          continue
        }
      }
    }
  }
  
  if (!employee) {
    throw new Error(`Employee not found: ${adminEmail}`)
  }
  
  // Track processed parentOrderIds to avoid duplicate approvals
  const processedParentIds = new Set<string>()
  
  // Process each order
  for (const orderId of orderIds) {
    try {
      // First, try to find order by id field
      let order = await Order.findOne({ id: orderId })
      
      // If not found by id, check if orderId is a parentOrderId (from grouped approval view)
      if (!order) {
        const ordersWithParent = await Order.find({ parentOrderId: orderId })
        if (ordersWithParent.length > 0) {
          // This is a parent order ID, approve all child orders
          if (processedParentIds.has(orderId)) {
            // Already processed this parent order, skip
            results.success.push(orderId)
            continue
          }
          processedParentIds.add(orderId)
          
          // Approve all orders with this parentOrderId
          const childOrders = await Order.find({ parentOrderId: orderId })
          if (childOrders.length === 0) {
            results.failed.push({ orderId, error: 'No child orders found' })
            continue
          }
          
          // Verify admin can approve orders for this company (check once per parent)
          // Use raw MongoDB for reliable ObjectId lookup
          const db = mongoose.connection.db
          let company = null
          
          if (db) {
            // Convert companyId to ObjectId if needed
            let companyIdObjectId: any = childOrders[0].companyId
            if (companyIdObjectId && !(companyIdObjectId instanceof mongoose.Types.ObjectId)) {
              if (mongoose.Types.ObjectId.isValid(companyIdObjectId)) {
                companyIdObjectId = new mongoose.Types.ObjectId(companyIdObjectId)
              }
            }
            
            company = await Company.findById(companyIdObjectId)
            
            // Fallback: Use raw MongoDB if Mongoose lookup fails
            if (!company) {
              const companyIdStr = companyIdObjectId?.toString()
              const rawCompany = await db.collection('companies').findOne({ _id: companyIdObjectId })
              if (rawCompany) {
                if (rawCompany.id) {
                  company = await Company.findOne({ id: rawCompany.id })
                }
                if (!company && rawCompany._id) {
                  company = await Company.findById(rawCompany._id)
                }
              }
              
              // If still not found, try lookup by business ID
              if (!company && childOrders[0].companyIdNum) {
                company = await Company.findOne({ id: String(childOrders[0].companyIdNum) })
              }
            }
          } else {
            company = await Company.findById(childOrders[0].companyId)
          }
          
          if (!company) {
            results.failed.push({ orderId, error: 'Company not found' })
            continue
          }
          
          const canApprove = await canApproveOrders(adminEmail, company.id)
          if (!canApprove) {
            results.failed.push({ orderId, error: 'User does not have permission to approve orders' })
            continue
          }
          
          // Approve all child orders
          for (const childOrder of childOrders) {
            if (childOrder.status === 'Awaiting approval' || childOrder.status === 'Awaiting fulfilment') {
              childOrder.status = 'Awaiting fulfilment'
              await childOrder.save()
            }
          }
          
          results.success.push(orderId)
          continue
        }
        
        // If still not found, mark as failed
        results.failed.push({ orderId, error: 'Order not found' })
        continue
      }
      
      // If this order has a parentOrderId, check if we've already processed it
      if (order.parentOrderId) {
        if (processedParentIds.has(order.parentOrderId)) {
          // Already processed this parent order, skip
          results.success.push(orderId)
          continue
        }
        processedParentIds.add(order.parentOrderId)
        
        // Approve all orders with this parentOrderId
        const childOrders = await Order.find({ parentOrderId: order.parentOrderId })
        if (childOrders.length === 0) {
          results.failed.push({ orderId, error: 'No child orders found' })
          continue
        }
        
        // Verify admin can approve orders for this company (check once per parent)
        // Use raw MongoDB for reliable ObjectId lookup
        const db = mongoose.connection.db
        let company = null
        
        if (db) {
          // Convert companyId to ObjectId if needed
          let companyIdObjectId: any = order.companyId
          if (companyIdObjectId && !(companyIdObjectId instanceof mongoose.Types.ObjectId)) {
            if (mongoose.Types.ObjectId.isValid(companyIdObjectId)) {
              companyIdObjectId = new mongoose.Types.ObjectId(companyIdObjectId)
            }
          }
          
          company = await Company.findById(companyIdObjectId)
          
          // Fallback: Use raw MongoDB if Mongoose lookup fails
          if (!company) {
            const companyIdStr = companyIdObjectId?.toString()
            const rawCompany = await db.collection('companies').findOne({ _id: companyIdObjectId })
            if (rawCompany) {
              if (rawCompany.id) {
                company = await Company.findOne({ id: rawCompany.id })
              }
              if (!company && rawCompany._id) {
                company = await Company.findById(rawCompany._id)
              }
            }
            
            // If still not found, try lookup by business ID
            if (!company && order.companyIdNum) {
              company = await Company.findOne({ id: String(order.companyIdNum) })
            }
          }
        } else {
          company = await Company.findById(order.companyId)
        }
        
        if (!company) {
          results.failed.push({ orderId, error: 'Company not found' })
          continue
        }
        
        const canApprove = await canApproveOrders(adminEmail, company.id)
        if (!canApprove) {
          results.failed.push({ orderId, error: 'User does not have permission to approve orders' })
          continue
        }
        
        // Approve all child orders
        for (const childOrder of childOrders) {
          if (childOrder.status === 'Awaiting approval' || childOrder.status === 'Awaiting fulfilment') {
            childOrder.status = 'Awaiting fulfilment'
            await childOrder.save()
          }
        }
        
        results.success.push(orderId)
      } else {
        // Standalone order
      if (order.status !== 'Awaiting approval') {
        results.failed.push({ orderId, error: `Order is not in 'Awaiting approval' status (current: ${order.status})` })
        continue
      }
      
      // Verify admin can approve orders for this company
      // Use raw MongoDB for reliable ObjectId lookup
      const db = mongoose.connection.db
      let company = null
      
      if (db) {
        // Convert companyId to ObjectId if needed
        let companyIdObjectId: any = order.companyId
        if (companyIdObjectId && !(companyIdObjectId instanceof mongoose.Types.ObjectId)) {
          if (mongoose.Types.ObjectId.isValid(companyIdObjectId)) {
            companyIdObjectId = new mongoose.Types.ObjectId(companyIdObjectId)
          }
        }
        
        company = await Company.findById(companyIdObjectId)
        
        // Fallback: Use raw MongoDB if Mongoose lookup fails
        if (!company) {
          const companyIdStr = companyIdObjectId?.toString()
          const rawCompany = await db.collection('companies').findOne({ _id: companyIdObjectId })
          if (rawCompany) {
            if (rawCompany.id) {
              company = await Company.findOne({ id: rawCompany.id })
            }
            if (!company && rawCompany._id) {
              company = await Company.findById(rawCompany._id)
            }
          }
          
          // If still not found, try lookup by business ID
          if (!company && order.companyIdNum) {
            company = await Company.findOne({ id: String(order.companyIdNum) })
          }
        }
      } else {
        company = await Company.findById(order.companyId)
      }
      
      if (!company) {
        results.failed.push({ orderId, error: 'Company not found' })
        continue
      }
      
      const canApprove = await canApproveOrders(adminEmail, company.id)
      if (!canApprove) {
        results.failed.push({ orderId, error: 'User does not have permission to approve orders' })
        continue
      }
      
      // Update order status
      order.status = 'Awaiting fulfilment'
      await order.save()
      
      results.success.push(orderId)
      }
    } catch (error: any) {
      results.failed.push({ orderId, error: error.message || 'Unknown error' })
    }
  }
  
  return results
}

export async function updateOrderStatus(orderId: string, status: 'Awaiting approval' | 'Awaiting fulfilment' | 'Dispatched' | 'Delivered'): Promise<any> {
  console.log(`\n[updateOrderStatus] 🚀 ========== STARTING ORDER STATUS UPDATE ==========`)
  console.log(`[updateOrderStatus] 📋 Parameters: orderId=${orderId}, status=${status}`)
  console.log(`[updateOrderStatus] ⏰ Timestamp: ${new Date().toISOString()}`)
  
  await connectDB()
  console.log(`[updateOrderStatus] ✅ Database connected`)
  
  // First, get order without populate to see raw data
  const orderRaw = await Order.findOne({ id: orderId }).lean()
  if (!orderRaw) {
    console.error(`[updateOrderStatus] ❌ Order not found: ${orderId}`)
    throw new Error(`Order not found: ${orderId}`)
  }
  
  console.log(`[updateOrderStatus] 🔍 Raw order data:`, {
    orderId: orderRaw.id,
    vendorIdRaw: orderRaw.vendorId,
    vendorIdType: typeof orderRaw.vendorId,
    vendorName: (orderRaw as any).vendorName,
    status: orderRaw.status
  })
  
  // Now get order with populate for processing
  const order = await Order.findOne({ id: orderId })
    .populate('vendorId', 'id')
    .populate('items.uniformId', 'id')
  
  if (!order) {
    console.error(`[updateOrderStatus] ❌ Order not found after populate: ${orderId}`)
    throw new Error(`Order not found: ${orderId}`)
  }
  
  // Get vendorId - handle both populated and unpopulated cases, and also check vendorName field
  let vendorIdValue: string | null = null
  let vendorObjectId: mongoose.Types.ObjectId | null = null
  
  // Check raw vendorId first (before populate)
  if (orderRaw.vendorId) {
    if (orderRaw.vendorId instanceof mongoose.Types.ObjectId) {
      vendorObjectId = orderRaw.vendorId
      vendorIdValue = 'ObjectId:' + orderRaw.vendorId.toString()
      console.log(`[updateOrderStatus] 🔍 Found vendorId from raw order: ${vendorObjectId.toString()}`)
    } else {
      // Try to convert string to ObjectId
      try {
        vendorObjectId = new mongoose.Types.ObjectId(orderRaw.vendorId as any)
        vendorIdValue = 'ObjectId:' + vendorObjectId.toString()
        console.log(`[updateOrderStatus] 🔍 Converted vendorId string to ObjectId: ${vendorObjectId.toString()}`)
      } catch (e) {
        console.warn(`[updateOrderStatus] ⚠️ Could not convert vendorId to ObjectId: ${orderRaw.vendorId}`)
      }
    }
  }
  
  // Check populated vendorId
  if (!vendorObjectId && order.vendorId) {
    if (order.vendorId instanceof mongoose.Types.ObjectId) {
      vendorObjectId = order.vendorId
      vendorIdValue = 'ObjectId:' + order.vendorId.toString()
      console.log(`[updateOrderStatus] 🔍 Found vendorId from populated order: ${vendorObjectId.toString()}`)
    } else if (typeof order.vendorId === 'object' && (order.vendorId as any).id) {
      vendorIdValue = (order.vendorId as any).id
      vendorObjectId = (order.vendorId as any)._id || order.vendorId
      console.log(`[updateOrderStatus] 🔍 Found vendorId from populated object: ${vendorIdValue}`)
    }
  }
  
  // Try to find vendor by name if vendorId is still missing
  if (!vendorObjectId && (order as any).vendorName) {
    console.log(`[updateOrderStatus] ⚠️ Order has vendorName but no vendorId, attempting to find vendor by name: ${(order as any).vendorName}`)
    const vendorByName = await Vendor.findOne({ name: (order as any).vendorName })
    if (vendorByName) {
      vendorObjectId = vendorByName._id
      vendorIdValue = vendorByName.id
      // Update the order with the vendorId for future use
      order.vendorId = vendorByName._id
      await order.save()
      console.log(`[updateOrderStatus] ✅ Found and updated vendorId for order: ${vendorIdValue}`)
    } else {
      console.error(`[updateOrderStatus] ❌ Could not find vendor by name: ${(order as any).vendorName}`)
    }
  }
  
  // Try to extract vendorId from order ID (format: ORD-XXX-YYYY-100001 where 100001 might be vendorId)
  if (!vendorObjectId) {
    const orderIdParts = orderId.split('-')
    const lastPart = orderIdParts[orderIdParts.length - 1]
    if (lastPart && /^\d+$/.test(lastPart)) {
      console.log(`[updateOrderStatus] 🔍 Attempting to find vendor by ID from order ID: ${lastPart}`)
      const vendorById = await Vendor.findOne({ id: lastPart })
      if (vendorById) {
        vendorObjectId = vendorById._id
        vendorIdValue = vendorById.id
        // Update the order with the vendorId for future use
        order.vendorId = vendorById._id
        await order.save()
        console.log(`[updateOrderStatus] ✅ Found vendor by ID from order ID: ${vendorIdValue}`)
      }
    }
  }
  
  console.log(`[updateOrderStatus] ✅ Order found:`, {
    orderId: order.id,
    currentStatus: order.status,
    vendorId: vendorIdValue || 'N/A',
    vendorObjectId: vendorObjectId?.toString() || 'N/A',
    vendorName: (order as any).vendorName || 'N/A',
    itemsCount: order.items?.length || 0
  })
  
  const previousStatus = order.status
  order.status = status
  await order.save()
  console.log(`[updateOrderStatus] ✅ Order status updated: ${previousStatus} -> ${status}`)
  
  // If this is a replacement order being shipped or delivered, handle return request and inventory updates
  // Business Rules:
  // 1. When shipped (Dispatched): Decrement inventory for NEW size (replacement item) - handled by normal flow below
  // 2. When delivered (Delivered): Increment inventory for ORIGINAL size (returned item) - handled here
  const isReplacementOrder = (order as any).orderType === 'REPLACEMENT'
  const hasReturnRequestId = (order as any).returnRequestId
  
  if ((status === 'Dispatched' || status === 'Delivered') && isReplacementOrder && hasReturnRequestId) {
    try {
      const returnRequestId = (order as any).returnRequestId
      console.log(`[updateOrderStatus] 🔄 Replacement order ${status.toLowerCase()}, processing return request: ${returnRequestId}`)
      
      const returnRequest = await ReturnRequest.findOne({ returnRequestId })
        .populate('uniformId', 'id name')
        .lean()
      
      if (!returnRequest) {
        console.warn(`[updateOrderStatus] ⚠️ Return request not found:`, returnRequestId)
        // For replacement orders, missing return request is critical
        throw new Error(`Return request ${returnRequestId} not found for replacement order ${orderId}`)
      }
      
      if (returnRequest.status === 'APPROVED') {
        // Only update return request status to COMPLETED when delivered
        if (status === 'Delivered') {
          await ReturnRequest.updateOne(
            { returnRequestId },
            { status: 'COMPLETED' }
          )
          console.log(`[updateOrderStatus] ✅ Return request completed: ${returnRequestId}`)
        }
        
        // Increment inventory for the returned item (original size) when delivered
        // Business rule: Inventory for returned item increases ONLY when replacement is delivered/confirmed
        if (status === 'Delivered' && returnRequest.uniformId && returnRequest.originalSize && returnRequest.requestedQty) {
          try {
            console.log(`[updateOrderStatus] 📦 Incrementing inventory for returned item (ORIGINAL size):`, {
              productId: (returnRequest.uniformId as any)?._id || returnRequest.uniformId,
              originalSize: returnRequest.originalSize,
              quantity: returnRequest.requestedQty,
              note: 'This is the size being returned (e.g., XXL)'
            })
            
            // Get the vendor from the replacement order
            // Use vendorObjectId if available (from earlier lookup), otherwise try order.vendorId
            let replacementOrderVendorId = vendorObjectId || order.vendorId
            if (!replacementOrderVendorId) {
              console.warn(`[updateOrderStatus] ⚠️ Replacement order has no vendorId, cannot increment inventory for returned item`)
              console.warn(`[updateOrderStatus] ⚠️ Order vendorId: ${order.vendorId}, vendorObjectId: ${vendorObjectId}`)
            } else {
              // Get vendor ObjectId - reuse vendorObjectId if it's already an ObjectId, otherwise look it up
              let returnVendorObjectId: mongoose.Types.ObjectId
              if (replacementOrderVendorId instanceof mongoose.Types.ObjectId) {
                returnVendorObjectId = replacementOrderVendorId
              } else if (vendorObjectId instanceof mongoose.Types.ObjectId) {
                // Reuse the vendorObjectId we already found
                returnVendorObjectId = vendorObjectId
              } else {
                const vendor = await Vendor.findOne({ id: replacementOrderVendorId })
                if (!vendor) {
                  throw new Error(`Vendor not found: ${replacementOrderVendorId}`)
                }
                returnVendorObjectId = vendor._id
              }
              
              // Get product ObjectId
              const productObjectId = (returnRequest.uniformId as any)?._id || returnRequest.uniformId
              if (!productObjectId) {
                throw new Error('Product ID not found in return request')
              }
              
              const product = await Uniform.findById(productObjectId)
              if (!product) {
                throw new Error(`Product not found: ${productObjectId}`)
              }
              
              // Use MongoDB transaction for atomic inventory update
              const session = await mongoose.startSession()
              session.startTransaction()
              
              try {
                // Find or create inventory record
                let inventory = await VendorInventory.findOne({
                  vendorId: returnVendorObjectId,
                  productId: product._id,
                }).session(session)
                
                if (!inventory) {
                  console.warn(`[updateOrderStatus] ⚠️ No inventory record found for vendor ${returnVendorObjectId} and product ${product.id}, creating one`)
                  const inventoryId = `VEND-INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
                  const created = await VendorInventory.create([{
                    id: inventoryId,
                    vendorId: returnVendorObjectId,
                    productId: product._id,
                    sizeInventory: new Map(),
                    totalStock: 0,
                    lowInventoryThreshold: new Map(),
                  }], { session })
                  inventory = created[0]
                }
                
                // Get current size inventory
                const sizeInventory = inventory.sizeInventory instanceof Map
                  ? new Map(inventory.sizeInventory)
                  : new Map(Object.entries(inventory.sizeInventory || {}))
                
                // Increment inventory for the returned size
                const originalSize = returnRequest.originalSize
                const returnedQty = returnRequest.requestedQty
                const currentStock = sizeInventory.get(originalSize) || 0
                const newStock = currentStock + returnedQty
                
                console.log(`[updateOrderStatus] 📊 Return inventory calculation:`, {
                  originalSize,
                  currentStock,
                  returnedQty,
                  newStock,
                  calculation: `${currentStock} + ${returnedQty} = ${newStock}`
                })
                
                sizeInventory.set(originalSize, newStock)
                
                // Calculate new total stock
                let totalStock = 0
                for (const qty of sizeInventory.values()) {
                  totalStock += qty
                }
                
                // Update inventory
                inventory.sizeInventory = sizeInventory
                inventory.totalStock = totalStock
                inventory.markModified('sizeInventory')
                
                await inventory.save({ session })
                await session.commitTransaction()
                
                console.log(`[updateOrderStatus] ✅ Successfully incremented inventory for returned item: product ${product.id}, size ${originalSize}, ${currentStock} -> ${newStock} (incremented ${returnedQty})`)
              } catch (error: any) {
                console.error(`[updateOrderStatus] ❌ Error incrementing inventory for returned item:`, error)
                await session.abortTransaction()
                throw error
              } finally {
                session.endSession()
              }
            }
          } catch (error: any) {
            console.error(`[updateOrderStatus] ❌ Failed to increment inventory for returned item: ${error.message}`)
            console.error(`[updateOrderStatus] ❌ Error stack:`, error.stack)
            // For replacement orders, inventory update is critical - rethrow the error
            throw error
          }
        }
      } else {
        console.warn(`[updateOrderStatus] ⚠️ Return request not in APPROVED status:`, {
          returnRequestId,
          status: returnRequest.status,
          orderStatus: status
        })
        // For replacement orders, this is unexpected - log but don't throw (status might be COMPLETED already)
      }
    } catch (error: any) {
      console.error(`[updateOrderStatus] ❌ Failed to process return request for replacement order: ${error.message}`)
      console.error(`[updateOrderStatus] ❌ Error stack:`, error.stack)
      // For replacement orders, this is critical - rethrow the error to prevent silent failures
      throw error
    }
  }
  
  // If status is being changed to "Dispatched" or "Delivered", decrement inventory
  // IMPORTANT: We need to check if inventory was already decremented by looking at order history
  // For now, we'll decrement when:
  // 1. Order goes from "Awaiting fulfilment" -> "Dispatched" (normal flow)
  // 2. Order goes from "Awaiting fulfilment" -> "Delivered" (direct delivery, skipping dispatch)
  // 3. Order goes from "Dispatched" -> "Delivered" (only if inventory wasn't decremented during Dispatched)
  // 
  // NOTE: We check previousStatus to avoid double-decrementing, but if the order was marked as "Dispatched"
  // without inventory being updated (due to missing vendorId or other error), we should still update when marking as "Delivered"
  const shouldUpdateInventory = (status === 'Dispatched' || status === 'Delivered') && 
                                 previousStatus !== 'Dispatched' && 
                                 previousStatus !== 'Delivered'
  
  // SPECIAL CASE: If going from "Dispatched" to "Delivered" and vendorId exists but wasn't processed before,
  // we should still update inventory (in case the previous Dispatched update failed)
  const isDispatchedToDelivered = status === 'Delivered' && previousStatus === 'Dispatched'
  const shouldUpdateInventoryForDelivered = isDispatchedToDelivered && vendorObjectId !== null
  
  const isReplacementOrderForLogging = (order as any).orderType === 'REPLACEMENT'
  console.log(`[updateOrderStatus] 🔍 Inventory update check:`, {
    shouldUpdate: shouldUpdateInventory,
    shouldUpdateForDelivered: shouldUpdateInventoryForDelivered,
    status,
    previousStatus,
    isDispatchedToDelivered,
    hasVendorId: vendorObjectId !== null,
    orderType: isReplacementOrderForLogging ? 'REPLACEMENT' : 'NORMAL',
    returnRequestId: (order as any).returnRequestId || 'N/A',
    condition1: status === 'Dispatched' || status === 'Delivered',
    condition2: previousStatus !== 'Dispatched',
    condition3: previousStatus !== 'Delivered'
  })
  
  // Update inventory if either condition is true
  // NOTE: This applies to BOTH normal orders AND replacement orders
  // For replacement orders: decrement inventory for the NEW size (replacement item)
  // For normal orders: decrement inventory for ordered items
  if (shouldUpdateInventory || shouldUpdateInventoryForDelivered) {
    const isReplacementOrder = (order as any).orderType === 'REPLACEMENT'
    console.log(`\n[updateOrderStatus] 📦 ========== INVENTORY UPDATE REQUIRED ==========`)
    console.log(`[updateOrderStatus] 📦 Order ${orderId}: ${previousStatus} -> ${status}, will decrement inventory`)
    console.log(`[updateOrderStatus] 📦 Order type: ${isReplacementOrder ? 'REPLACEMENT' : 'NORMAL'}`)
    console.log(`[updateOrderStatus] 📦 Update reason: ${shouldUpdateInventory ? 'Normal flow' : 'Dispatched->Delivered (recovery)'}`)
    
    if (!vendorObjectId) {
      const isReplacementOrder = (order as any).orderType === 'REPLACEMENT'
      console.error(`[updateOrderStatus] ❌ Order ${orderId} has no vendorId, cannot update inventory`)
      console.error(`[updateOrderStatus] ❌ Order details:`, {
        vendorId: order.vendorId,
        vendorName: (order as any).vendorName,
        vendorIdValue: vendorIdValue,
        orderType: isReplacementOrder ? 'REPLACEMENT' : 'NORMAL',
        returnRequestId: (order as any).returnRequestId || 'N/A'
      })
      // For replacement orders, this is critical - throw error instead of silently failing
      if (isReplacementOrder) {
        throw new Error(`Replacement order ${orderId} has no vendorId - inventory update cannot proceed. This will cause inventory discrepancies.`)
      }
    } else {
      try {
        console.log(`[updateOrderStatus] 🔍 Processing vendor for inventory update`)
        console.log(`[updateOrderStatus] 🔍 Using vendorObjectId: ${vendorObjectId.toString()}, vendorId: ${vendorIdValue}`)
        
        // Ensure vendorObjectId is a proper ObjectId
        let vendorObjectIdToUse: mongoose.Types.ObjectId
        if (vendorObjectId instanceof mongoose.Types.ObjectId) {
          vendorObjectIdToUse = vendorObjectId
        } else {
          try {
            vendorObjectIdToUse = new mongoose.Types.ObjectId(vendorObjectId.toString())
            console.log(`[updateOrderStatus] 🔍 Converted vendorObjectId string to ObjectId: ${vendorObjectIdToUse.toString()}`)
          } catch (e) {
            console.error(`[updateOrderStatus] ❌ Failed to convert vendorObjectId to ObjectId: ${vendorObjectId}`, e)
            throw new Error(`Invalid vendorObjectId: ${vendorObjectId}`)
          }
        }
        
        // Try multiple lookup methods
        let vendor = await Vendor.findById(vendorObjectIdToUse)
        if (!vendor) {
          console.log(`[updateOrderStatus] ⚠️ Vendor not found by _id, trying by id field: ${vendorIdValue}`)
          vendor = await Vendor.findOne({ id: vendorIdValue })
        }
        if (!vendor && (order as any).vendorName) {
          console.log(`[updateOrderStatus] ⚠️ Vendor not found by id, trying by name: ${(order as any).vendorName}`)
          vendor = await Vendor.findOne({ name: (order as any).vendorName })
        }
        
        if (!vendor) {
          console.error(`[updateOrderStatus] ❌ Vendor not found for order ${orderId}`)
          console.error(`[updateOrderStatus] ❌ Tried: _id=${vendorObjectIdToUse.toString()}, id=${vendorIdValue}, name=${(order as any).vendorName || 'N/A'}`)
        } else {
          console.log(`[updateOrderStatus] ✅ Vendor found:`, {
            vendorId: vendor.id,
            vendorName: vendor.name,
            vendorObjectId: vendor._id.toString(),
            lookupMethod: vendor._id.toString() === vendorObjectIdToUse.toString() ? 'by _id' : 'by id/name'
          })
          // Update vendorObjectId to the actual vendor's _id to ensure consistency
          vendorObjectId = vendor._id
          const isReplacementOrder = (order as any).orderType === 'REPLACEMENT'
          console.log(`[updateOrderStatus] 📦 Processing ${order.items.length} order items`)
          if (isReplacementOrder) {
            console.log(`[updateOrderStatus] 🔄 REPLACEMENT ORDER: Will decrement inventory for NEW size (replacement item)`)
          }
          
          // Process each item in the order
          let itemIndex = 0
          for (const item of order.items) {
            itemIndex++
            console.log(`\n[updateOrderStatus] 📦 ========== PROCESSING ITEM ${itemIndex}/${order.items.length} ==========`)
            console.log(`[updateOrderStatus] 📦 Item details:`, {
              uniformId: item.uniformId,
              uniformName: item.uniformName || 'N/A',
              size: item.size,
              quantity: item.quantity,
              price: item.price
            })
            // Get product ObjectId - handle both populated and unpopulated cases
            let productObjectId: mongoose.Types.ObjectId
            if (item.uniformId instanceof mongoose.Types.ObjectId) {
              productObjectId = item.uniformId
              console.log(`[updateOrderStatus] 🔍 Product ID is ObjectId: ${productObjectId.toString()}`)
            } else {
              // Populated product document
              productObjectId = (item.uniformId as any)._id || item.uniformId
              console.log(`[updateOrderStatus] 🔍 Product ID from populated doc: ${productObjectId?.toString() || 'N/A'}`)
            }
            
            const size = item.size
            const quantity = item.quantity
            
            if (!size || !quantity) {
              console.error(`[updateOrderStatus] ❌ Order ${orderId} item ${itemIndex} missing size or quantity:`, {
                size,
                quantity,
                item
              })
              continue
            }
            
            console.log(`[updateOrderStatus] 🔍 Looking up product:`, {
              productObjectId: productObjectId.toString(),
              size,
              quantity
            })
            
            // Get product to verify it exists
            const product = await Uniform.findById(productObjectId)
            
            if (!product) {
              console.error(`[updateOrderStatus] ❌ Product not found for order ${orderId}, item ${itemIndex}:`, {
                productObjectId: productObjectId.toString(),
                item
              })
              continue
            }
          
            console.log(`[updateOrderStatus] ✅ Product found:`, {
              productId: product.id,
              productName: product.name,
              productObjectId: product._id.toString()
            })
          
            // Use MongoDB transaction for atomic inventory update
            console.log(`[updateOrderStatus] 🔄 Starting MongoDB transaction for inventory update`)
            const session = await mongoose.startSession()
            session.startTransaction()
            console.log(`[updateOrderStatus] ✅ Transaction started`)
            
            try {
              // Find or create inventory record (with lock to prevent race conditions)
              console.log(`[updateOrderStatus] 🔍 Looking up VendorInventory:`, {
                vendorId: vendor._id.toString(),
                vendorIdString: vendor.id,
                productId: product._id.toString(),
                productIdString: product.id
              })
              
            let inventory = await VendorInventory.findOne({
              vendorId: vendor._id,
              productId: product._id,
              }).session(session)
            
            if (!inventory) {
                console.warn(`[updateOrderStatus] ⚠️ No inventory record found for vendor ${vendor.id} and product ${product.id}, creating one with 0 stock`)
              // Create inventory record with 0 stock if it doesn't exist
              const inventoryId = `VEND-INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
                const created = await VendorInventory.create([{
                id: inventoryId,
                vendorId: vendor._id,
                productId: product._id,
                sizeInventory: new Map(),
                totalStock: 0,
                  lowInventoryThreshold: new Map(),
                }], { session })
                inventory = created[0]
              }
              
              console.log(`[updateOrderStatus] ✅ Inventory record found/created:`, {
                inventoryId: inventory.id,
                currentSizeInventory: inventory.sizeInventory instanceof Map 
                  ? Object.fromEntries(inventory.sizeInventory)
                  : inventory.sizeInventory,
                currentTotalStock: inventory.totalStock
              })
            
            // Get current size inventory
            const sizeInventory = inventory.sizeInventory instanceof Map
              ? new Map(inventory.sizeInventory)
              : new Map(Object.entries(inventory.sizeInventory || {}))
            
              console.log(`[updateOrderStatus] 🔍 Current sizeInventory Map:`, Object.fromEntries(sizeInventory))
              
              // Decrement inventory for this size (prevent negative inventory)
            const currentStock = sizeInventory.get(size) || 0
              console.log(`[updateOrderStatus] 📊 Stock calculation:`, {
                size,
                currentStock,
                quantity,
                willDecrement: quantity
              })
            
            if (currentStock < quantity) {
                console.warn(`[updateOrderStatus] ⚠️ Insufficient inventory for order ${orderId}: product ${product.id}, size ${size}. Current: ${currentStock}, Requested: ${quantity}`)
                // Still allow the order to be shipped, but inventory goes to 0 (not negative)
              }
              
              const newStock = Math.max(0, currentStock - quantity) // Don't go below 0
              console.log(`[updateOrderStatus] 📊 Stock calculation result:`, {
                currentStock,
                quantity,
                newStock,
                calculation: `${currentStock} - ${quantity} = ${newStock}`
              })
            
            sizeInventory.set(size, newStock)
              console.log(`[updateOrderStatus] ✅ Updated sizeInventory Map:`, Object.fromEntries(sizeInventory))
            
            // Calculate new total stock
            let totalStock = 0
            for (const qty of sizeInventory.values()) {
              totalStock += qty
            }
            
              // Update inventory atomically
              console.log(`[updateOrderStatus] 🔄 Updating inventory object...`)
              console.log(`[updateOrderStatus] 🔄 Before assignment:`, {
                inventorySizeInventoryType: typeof inventory.sizeInventory,
                inventorySizeInventoryIsMap: inventory.sizeInventory instanceof Map,
                newSizeInventoryType: typeof sizeInventory,
                newSizeInventoryIsMap: sizeInventory instanceof Map
              })
              
            inventory.sizeInventory = sizeInventory
            inventory.totalStock = totalStock
              
              console.log(`[updateOrderStatus] 🔄 After assignment:`, {
                inventorySizeInventoryType: typeof inventory.sizeInventory,
                inventorySizeInventoryIsMap: inventory.sizeInventory instanceof Map,
                inventorySizeInventoryValue: inventory.sizeInventory instanceof Map
                  ? Object.fromEntries(inventory.sizeInventory)
                  : inventory.sizeInventory
              })
              
              // CRITICAL: Mark Map fields as modified to ensure Mongoose saves them
              // Mongoose doesn't always detect changes to Map objects, so we must explicitly mark them
              console.log(`[updateOrderStatus] 🔄 Marking sizeInventory as modified...`)
              inventory.markModified('sizeInventory')
              console.log(`[updateOrderStatus] ✅ markModified('sizeInventory') called`)
              console.log(`[updateOrderStatus] 🔄 Modified paths after markModified:`, inventory.modifiedPaths())
              
              console.log(`[Inventory Update] 🔍 Before save - inventory record:`, {
                inventoryId: inventory.id,
                vendorId: vendor.id,
                productId: product.id,
                size: size,
                sizeInventory: Object.fromEntries(sizeInventory),
                totalStock: totalStock,
                currentStock: currentStock,
                newStock: newStock,
                quantity: quantity
              })
              
              console.log(`[updateOrderStatus] 💾 ========== SAVING INVENTORY ==========`)
              console.log(`[updateOrderStatus] 💾 Attempting to save inventory with session...`)
              console.log(`[updateOrderStatus] 💾 Pre-save state:`, {
                inventoryId: inventory.id,
                inventoryIsNew: inventory.isNew,
                inventoryIsModified: inventory.isModified(),
                modifiedPaths: inventory.modifiedPaths(),
                sizeInventoryBeforeSave: inventory.sizeInventory instanceof Map
                  ? Object.fromEntries(inventory.sizeInventory)
                  : inventory.sizeInventory,
                totalStockBeforeSave: inventory.totalStock,
                markModifiedCalled: true // We called it above
              })
              
              const saveResult = await inventory.save({ session })
              
              console.log(`[updateOrderStatus] ✅ Inventory save() completed:`, {
                inventoryId: saveResult.id,
                savedSizeInventory: saveResult.sizeInventory instanceof Map
                  ? Object.fromEntries(saveResult.sizeInventory)
                  : saveResult.sizeInventory,
                savedTotalStock: saveResult.totalStock,
                savedSizeStock: saveResult.sizeInventory instanceof Map
                  ? saveResult.sizeInventory.get(size)
                  : (saveResult.sizeInventory as any)?.[size],
                expectedSizeStock: newStock,
                saveMatch: (saveResult.sizeInventory instanceof Map
                  ? saveResult.sizeInventory.get(size)
                  : (saveResult.sizeInventory as any)?.[size]) === newStock
              })
              
              console.log(`[updateOrderStatus] 💾 Committing transaction...`)
              console.log(`[updateOrderStatus] 💾 Transaction state before commit:`, {
                hasActiveTransaction: session.inTransaction(),
                transactionOptions: session.transaction?.options
              })
              
              await session.commitTransaction()
              
              console.log(`[updateOrderStatus] ✅ Transaction committed successfully`)
              console.log(`[updateOrderStatus] 💾 Transaction state after commit:`, {
                hasActiveTransaction: session.inTransaction()
              })
              
              console.log(`[updateOrderStatus] ✅ Successfully updated VendorInventory for order ${orderId}: product ${product.id}, size ${size}, ${currentStock} -> ${newStock} (decremented ${quantity})`)
              
              // CRITICAL VERIFICATION: Query database directly to confirm update persisted
              // IMPORTANT: Query OUTSIDE the transaction session to see committed data
              console.log(`[updateOrderStatus] 🔍 ========== POST-SAVE VERIFICATION ==========`)
              console.log(`[updateOrderStatus] 🔍 Waiting 200ms for database write to complete...`)
              await new Promise(resolve => setTimeout(resolve, 200))
              
              // Query using raw MongoDB to bypass any Mongoose caching
              // Query WITHOUT session to see committed data
              const db = mongoose.connection.db
              const vendorInventoriesCollection = db.collection('vendorinventories')
              
              console.log(`[updateOrderStatus] 🔍 Querying raw MongoDB (outside transaction)...`)
              const rawInventoryDoc = await vendorInventoriesCollection.findOne({
                vendorId: vendor._id,
                productId: product._id,
              })
              
              console.log(`[updateOrderStatus] 🔍 Raw MongoDB query result:`, {
                found: !!rawInventoryDoc,
                inventoryId: rawInventoryDoc?.id,
                sizeInventory: rawInventoryDoc?.sizeInventory,
                totalStock: rawInventoryDoc?.totalStock,
                sizeStock: rawInventoryDoc?.sizeInventory?.[size],
                expectedStock: newStock
              })
              
              // Also verify using Mongoose (without session to see committed data)
              console.log(`[updateOrderStatus] 🔍 Querying Mongoose (outside transaction)...`)
              const verifyInventory = await VendorInventory.findOne({
                vendorId: vendor._id,
                productId: product._id,
              }).lean()
              
              if (verifyInventory) {
                const verifySizeStock = verifyInventory.sizeInventory instanceof Map
                  ? verifyInventory.sizeInventory.get(size)
                  : (verifyInventory.sizeInventory as any)?.[size]
                const verifyTotalStock = verifyInventory.totalStock
                
                console.log(`[updateOrderStatus] ✅ Mongoose verification result:`, {
                  inventoryId: verifyInventory.id,
                  size,
                  expectedStock: newStock,
                  actualStock: verifySizeStock,
                  match: verifySizeStock === newStock,
                  expectedTotal: totalStock,
                  actualTotal: verifyTotalStock,
                  totalMatch: verifyTotalStock === totalStock,
                  sizeInventoryType: typeof verifyInventory.sizeInventory,
                  sizeInventoryIsMap: verifyInventory.sizeInventory instanceof Map,
                  sizeInventoryKeys: verifyInventory.sizeInventory instanceof Map 
                    ? Array.from(verifyInventory.sizeInventory.keys())
                    : Object.keys(verifyInventory.sizeInventory || {})
                })
                
                // Compare raw MongoDB vs Mongoose
                const rawSizeStock = rawInventoryDoc?.sizeInventory?.[size]
                console.log(`[updateOrderStatus] 🔍 Raw vs Mongoose comparison:`, {
                  rawSizeStock,
                  mongooseSizeStock: verifySizeStock,
                  match: rawSizeStock === verifySizeStock
                })
                
                if (verifySizeStock !== newStock) {
                  console.error(`[updateOrderStatus] ❌❌❌ VERIFICATION FAILED: Expected stock ${newStock} but got ${verifySizeStock}`)
                  console.error(`[updateOrderStatus] ❌❌❌ This indicates the inventory update did NOT persist!`)
                  console.error(`[updateOrderStatus] ❌❌❌ Debug info:`, {
                    beforeSave: currentStock,
                    quantity: quantity,
                    calculatedNewStock: newStock,
                    afterSave: verifySizeStock,
                    rawMongoDB: rawSizeStock
                  })
                } else {
                  console.log(`[updateOrderStatus] ✅✅✅ VERIFICATION PASSED: Stock correctly saved and persisted`)
                  console.log(`[updateOrderStatus] ✅✅✅ Inventory decremented: ${currentStock} - ${quantity} = ${newStock}`)
                }
              } else {
                console.error(`[updateOrderStatus] ❌ Verification failed: Could not find inventory record after save`)
                console.error(`[updateOrderStatus] ❌ Query used:`, {
                  vendorId: vendor._id.toString(),
                  productId: product._id.toString()
                })
              }
              
              console.log(`[updateOrderStatus] 📦 ========== ITEM ${itemIndex} PROCESSING COMPLETE ==========\n`)
            } catch (error: any) {
              console.error(`[updateOrderStatus] ❌ Error in transaction for item ${itemIndex}:`, error)
              console.error(`[updateOrderStatus] ❌ Error details:`, {
                message: error?.message,
                stack: error?.stack,
                name: error?.name
              })
              await session.abortTransaction()
              console.error(`[updateOrderStatus] ❌ Transaction aborted`)
              throw error
            } finally {
              session.endSession()
              console.log(`[updateOrderStatus] ✅ Session ended`)
            }
          }
          
          console.log(`[updateOrderStatus] 📦 ========== ALL ITEMS PROCESSED ==========`)
          
          // FINAL VERIFICATION: Query all inventory records for this vendor-product to confirm
          console.log(`[updateOrderStatus] 🔍 ========== FINAL INVENTORY VERIFICATION ==========`)
          const finalInventoryCheck = await VendorInventory.find({
            vendorId: vendor._id,
            productId: product._id,
          }).lean()
          
          console.log(`[updateOrderStatus] 🔍 Final inventory check found ${finalInventoryCheck.length} record(s):`)
          finalInventoryCheck.forEach((inv, idx) => {
            console.log(`[updateOrderStatus] 🔍 Inventory record ${idx + 1}:`, {
              id: inv.id,
              sizeInventory: inv.sizeInventory,
              totalStock: inv.totalStock,
              sizeInventoryType: typeof inv.sizeInventory,
              sizeInventoryKeys: inv.sizeInventory instanceof Map
                ? Array.from(inv.sizeInventory.keys())
                : Object.keys(inv.sizeInventory || {})
            })
          })
          console.log(`[updateOrderStatus] 📦 ========== ALL ITEMS PROCESSED ==========\n`)
        }
      } catch (error: any) {
        console.error(`[updateOrderStatus] ❌❌❌ CRITICAL ERROR updating inventory for order ${orderId}:`, error)
        console.error(`[updateOrderStatus] ❌ Error details:`, {
          message: error?.message,
          stack: error?.stack,
          name: error?.name,
          code: error?.code
        })
        // Don't throw - we still want to update the order status even if inventory update fails
      }
    }
  } else {
    // Log when inventory update is skipped
    if (status === 'Dispatched' || status === 'Delivered') {
      console.log(`[updateOrderStatus] ⏭️ Skipping inventory update for order ${orderId}: ${previousStatus} -> ${status} (already processed or invalid transition)`)
    }
  }
  
  // Populate and return
  console.log(`[updateOrderStatus] 🔄 Populating order for response...`)
  const populatedOrder = await Order.findById(order._id)
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .lean()
  
  console.log(`[updateOrderStatus] ✅ Order populated successfully`)
  console.log(`[updateOrderStatus] 🚀 ========== ORDER STATUS UPDATE COMPLETE ==========\n`)
  
  return toPlainObject(populatedOrder)
}

export async function getPendingApprovals(companyId: string): Promise<any[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId }).select('_id id name').lean()
  if (!company) {
    return []
  }
  
  // OPTIMIZATION: Fetch all pending orders (parent + child) in single query using $or
  // This eliminates the need for two separate queries
  const pendingOrders = await Order.find({
    companyId: company._id,
    status: 'Awaiting approval',
  })
    .select('id employeeId employeeIdNum employeeName items total status orderDate dispatchLocation companyId deliveryAddress parentOrderId vendorId vendorName isPersonalPayment personalPaymentAmount createdAt')
    .populate('employeeId', 'id employeeId firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .populate('vendorId', 'id name')
    .sort({ orderDate: -1 })
    .lean()
  
  // OPTIMIZATION: Also fetch child orders in same query using aggregation or separate optimized query
  const parentOrderIds = new Set<string>()
  const standaloneOrders: any[] = []
  const plainOrders = pendingOrders.map((o: any) => toPlainObject(o))

  for (const order of plainOrders) {
    if (order.parentOrderId) {
      parentOrderIds.add(order.parentOrderId)
    } else {
      standaloneOrders.push(order)
    }
  }

  // OPTIMIZATION: Fetch child orders with field projection to reduce payload
  const orderMap = new Map<string, any[]>()
  if (parentOrderIds.size > 0) {
    const allChildOrders = await Order.find({
      companyId: company._id,
      parentOrderId: { $in: Array.from(parentOrderIds) }
    })
      .select('id employeeId employeeIdNum employeeName items total status orderDate dispatchLocation companyId deliveryAddress parentOrderId vendorId vendorName isPersonalPayment personalPaymentAmount createdAt')
      .populate('employeeId', 'id employeeId firstName lastName email')
      .populate('companyId', 'id name')
      .populate('items.uniformId', 'id name')
      .populate('vendorId', 'id name')
      .lean()
    
    const allChildOrdersPlain = allChildOrders.map((o: any) => toPlainObject(o))
    
    for (const order of allChildOrdersPlain) {
    if (order.parentOrderId) {
      if (!orderMap.has(order.parentOrderId)) {
        orderMap.set(order.parentOrderId, [])
      }
      orderMap.get(order.parentOrderId)!.push(order)
      }
    }
  }

  // Create grouped orders (one per parentOrderId) and add standalone orders
  const groupedOrders: any[] = []
  
  for (const [parentOrderId, splitOrders] of orderMap.entries()) {
    // Sort split orders by vendor name for consistency
    splitOrders.sort((a, b) => (a.vendorName || '').localeCompare(b.vendorName || ''))
    
    // Create a grouped order object
    const totalAmount = splitOrders.reduce((sum, o) => sum + (o.total || 0), 0)
    const totalItems = splitOrders.reduce((sum, o) => sum + (o.items?.length || 0), 0)
    const allItems = splitOrders.flatMap(o => o.items || [])
    
    groupedOrders.push({
      ...splitOrders[0], // Use first order as base
      id: parentOrderId, // Use parent order ID as the main ID
      isSplitOrder: true,
      splitOrders: splitOrders,
      splitOrderIds: splitOrders.map(o => o.id), // Store all order IDs for bulk approval
      total: totalAmount,
      items: allItems,
      vendorCount: splitOrders.length,
      vendors: splitOrders.map(o => o.vendorName).filter(Boolean)
    })
  }

  // Combine grouped and standalone orders, sorted by date
  const allOrders = [...groupedOrders, ...standaloneOrders]
  allOrders.sort((a, b) => {
    const dateA = new Date(a.orderDate || 0).getTime()
    const dateB = new Date(b.orderDate || 0).getTime()
    return dateB - dateA // Most recent first
  })

  return allOrders
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

/**
 * Get pending return request count for a company
 */
export async function getPendingReturnRequestCount(companyId: string): Promise<number> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId }).select('_id id').lean()
  if (!company) {
    // Try with _id if companyId looks like ObjectId
    if (companyId && companyId.length === 24 && /^[0-9a-fA-F]{24}$/.test(companyId)) {
      const companyById = await Company.findById(companyId).select('_id id').lean()
      if (!companyById) return 0
      return await ReturnRequest.countDocuments({
        companyId: companyById._id,
        status: 'REQUESTED',
      })
    }
    return 0
  }
  
  const count = await ReturnRequest.countDocuments({
    companyId: company._id,
    status: 'REQUESTED',
  })
  
  return count
}

/**
 * Get pending order approval count for a location (for Location Admin)
 */
export async function getPendingApprovalCountByLocation(locationId: string): Promise<number> {
  await connectDB()
  
  const location = await Location.findOne({ id: locationId }).select('_id id companyId').lean()
  if (!location) {
    return 0
  }
  
  // Get all employees in this location
  const employees = await Employee.find({ locationId: location._id }).select('_id').lean()
  const employeeIds = employees.map(e => e._id)
  
  if (employeeIds.length === 0) {
    return 0
  }
  
  const count = await Order.countDocuments({
    employeeId: { $in: employeeIds },
    status: 'Awaiting approval',
  })
  
  return count
}

/**
 * Get pending order count for a vendor (orders awaiting fulfilment/dispatch)
 */
export async function getPendingOrderCountByVendor(vendorId: string): Promise<number> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId }).select('_id id').lean()
  if (!vendor) {
    return 0
  }
  
  // Count orders that are awaiting fulfilment or dispatched (vendor needs to act on)
  const count = await Order.countDocuments({
    vendorId: vendor._id,
    status: { $in: ['Awaiting fulfilment', 'Dispatched'] },
  })
  
  return count
}

/**
 * Get pending replacement order count for a vendor
 */
export async function getPendingReplacementOrderCountByVendor(vendorId: string): Promise<number> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId }).select('_id id').lean()
  if (!vendor) {
    return 0
  }
  
  // Count replacement orders that are awaiting fulfilment or dispatched
  const count = await Order.countDocuments({
    vendorId: vendor._id,
    orderType: 'REPLACEMENT',
    status: { $in: ['Awaiting fulfilment', 'Dispatched'] },
  })
  
  return count
}

// ========== RELATIONSHIP FUNCTIONS ==========

export async function getProductCompanies(): Promise<any[]> {
  await connectDB()
  
  // Use raw MongoDB collection for reliable ObjectId comparison
  const db = mongoose.connection.db
  if (!db) return []
  
  const rawRelationships = await db.collection('productcompanies').find({}).toArray()
  
  // Get all products and companies for mapping
  const allProducts = await db.collection('uniforms').find({}).toArray()
  const allCompanies = await db.collection('companies').find({}).toArray()
  
  // Create maps for quick lookup
  const productMap = new Map()
  const companyMap = new Map()
  
  allProducts.forEach((p: any) => {
    productMap.set(p._id.toString(), p.id)
  })
  
  allCompanies.forEach((c: any) => {
    companyMap.set(c._id.toString(), c.id)
  })
  
  // Map relationships to use string IDs
  return rawRelationships.map((rel: any) => {
    const productIdStr = rel.productId?.toString()
    const companyIdStr = rel.companyId?.toString()
    
    return {
      productId: productMap.get(productIdStr) || productIdStr,
      companyId: companyMap.get(companyIdStr) || companyIdStr,
    }
  }).filter((rel: any) => rel.productId && rel.companyId)
}

export async function getProductVendors(): Promise<any[]> {
  await connectDB()
  
  // Use raw MongoDB collection for reliable ObjectId comparison
  const db = mongoose.connection.db
  if (!db) return []
  
  const rawRelationships = await db.collection('productvendors').find({}).toArray()
  
  // Get all products and vendors for mapping
  const allProducts = await db.collection('uniforms').find({}).toArray()
  const allVendors = await db.collection('vendors').find({}).toArray()
  
  // Create maps for quick lookup
  const productMap = new Map()
  const vendorMap = new Map()
  
  allProducts.forEach((p: any) => {
    productMap.set(p._id.toString(), p.id)
  })
  
  allVendors.forEach((v: any) => {
    vendorMap.set(v._id.toString(), v.id)
  })
  
  // Map relationships to use string IDs (companyId removed from ProductVendor)
  return rawRelationships.map((rel: any) => {
    const productIdStr = rel.productId?.toString()
    const vendorIdStr = rel.vendorId?.toString()
    
    return {
      productId: productMap.get(productIdStr) || productIdStr,
      vendorId: vendorMap.get(vendorIdStr) || vendorIdStr,
    }
  }).filter((rel: any) => rel.productId && rel.vendorId)
}

export async function getVendorCompanies(): Promise<any[]> {
  // Vendor-company relationships are no longer used
  // Products are linked to companies directly, and vendors supply products
  // No explicit vendor-company relationship is needed
  return []
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

export async function createProductCompanyBatch(productIds: string[], companyId: string): Promise<{ success: string[], failed: Array<{ productId: string, error: string }> }> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }

  const success: string[] = []
  const failed: Array<{ productId: string, error: string }> = []

  for (const productId of productIds) {
    try {
      const product = await Uniform.findOne({ id: productId })
      if (!product) {
        failed.push({ productId, error: `Product not found: ${productId}` })
        continue
      }

      await ProductCompany.findOneAndUpdate(
        { productId: product._id, companyId: company._id },
        { productId: product._id, companyId: company._id },
        { upsert: true }
      )

      success.push(productId)
      console.log(`createProductCompanyBatch - Successfully linked product ${productId} to company ${companyId}`)
    } catch (error: any) {
      failed.push({ productId, error: error.message || 'Unknown error' })
    }
  }

  return { success, failed }
}

export async function deleteProductCompany(productId: string, companyId: string): Promise<void> {
  await connectDB()
  
  const product = await Uniform.findOne({ id: productId })
  const company = await Company.findOne({ id: companyId })
  
  if (!product) {
    throw new Error(`Product not found: ${productId}`)
  }
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }

  // Use raw MongoDB collection for reliable ObjectId comparison
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('Database connection not available')
  }

  const productIdStr = product._id.toString()
  const companyIdStr = company._id.toString()

  const result = await db.collection('productcompanies').deleteOne({
    productId: product._id,
    companyId: company._id
  })
  
  if (result.deletedCount === 0) {
    // Try with string comparison as fallback
    const allLinks = await db.collection('productcompanies').find({}).toArray()
    const matchingLink = allLinks.find((link: any) => {
      const linkProductIdStr = link.productId?.toString()
      const linkCompanyIdStr = link.companyId?.toString()
      return linkProductIdStr === productIdStr && linkCompanyIdStr === companyIdStr
    })
    
    if (matchingLink) {
      await db.collection('productcompanies').deleteOne({ _id: matchingLink._id })
      console.log(`Successfully deleted relationship between product ${productId} and company ${companyId}`)
    } else {
      throw new Error(`No relationship found to delete between product ${productId} and company ${companyId}`)
    }
  } else {
    console.log(`Successfully deleted relationship between product ${productId} and company ${companyId}`)
  }
}

export async function createProductVendor(productId: string, vendorId: string): Promise<void> {
  await connectDB()
  
  console.log('[createProductVendor] Looking for productId:', productId, 'vendorId:', vendorId)
  
  // Try to find product by id field first, then fallback to _id if productId looks like ObjectId
  let product = await Uniform.findOne({ id: productId })
  if (!product && mongoose.Types.ObjectId.isValid(productId)) {
    // Fallback: try finding by _id if productId is a valid ObjectId
    product = await Uniform.findById(productId)
    if (product) {
      console.log('[createProductVendor] Found product by _id, using product.id:', product.id)
    }
  }
  
  const vendor = await Vendor.findOne({ id: vendorId })
  
  console.log('[createProductVendor] Product found:', product ? product.id : 'NOT FOUND')
  console.log('[createProductVendor] Vendor found:', vendor ? vendor.id : 'NOT FOUND')
  
  if (!product) {
    // List available product IDs for debugging
    const allProducts = await Uniform.find({}, 'id name').limit(5).lean()
    console.log('[createProductVendor] Available products (sample):', allProducts.map(p => p.id))
    throw new Error(`Product not found: ${productId}`)
  }
  
  if (!vendor) {
    // List available vendor IDs for debugging
    const allVendors = await Vendor.find({}, 'id name').limit(5).lean()
    console.log('Available vendors (sample):', allVendors.map(v => v.id))
    throw new Error(`Vendor not found: ${vendorId}`)
  }

  // Validate: Product can only be linked to ONE vendor
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('Database connection not available')
  }

  const existingLinks = await db.collection('productvendors').find({ productId: product._id }).toArray()
  if (existingLinks.length > 0) {
    const existingVendorIdStr = existingLinks[0].vendorId?.toString()
    const newVendorIdStr = vendor._id.toString()
    
    if (existingVendorIdStr !== newVendorIdStr) {
      const existingVendor = await Vendor.findById(existingLinks[0].vendorId)
      throw new Error(`Product "${product.name || productId}" is already linked to vendor "${existingVendor?.name || existingVendorIdStr}". A product can only be linked to one vendor.`)
    }
  }

  // Use MongoDB session for transactional safety
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    // Create ProductVendor relationship
  await ProductVendor.findOneAndUpdate(
      { productId: product._id, vendorId: vendor._id },
      { productId: product._id, vendorId: vendor._id },
      { upsert: true, session }
    )
    
    console.log('[createProductVendor] ✅ Successfully created ProductVendor relationship')
    
        // Auto-create VendorInventory record with all sizes initialized
        // This must succeed for the transaction to commit
        await ensureVendorInventoryExists(vendor._id, product._id, session)
    
    // Commit transaction - both ProductVendor and VendorInventory are created together
    await session.commitTransaction()
    console.log('[createProductVendor] ✅ Transaction committed: Product-Vendor link and inventory initialized')
  } catch (error: any) {
    // Rollback transaction on any error
    await session.abortTransaction()
    console.error('[createProductVendor] ❌ Transaction aborted:', {
      vendorId: vendor.id,
      productId: product.id,
      error: error.message,
    })
    throw error
  } finally {
    session.endSession()
  }
}

export async function createProductVendorBatch(productIds: string[], vendorId: string): Promise<{ success: string[], failed: Array<{ productId: string, error: string }> }> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  if (!vendor) {
    throw new Error(`Vendor not found: ${vendorId}`)
  }

  const db = mongoose.connection.db
  if (!db) {
    throw new Error('Database connection not available')
  }

  const success: string[] = []
  const failed: Array<{ productId: string, error: string }> = []

  for (const productId of productIds) {
    try {
      // Try to find product by id field first, then fallback to _id if productId looks like ObjectId
      let product = await Uniform.findOne({ id: productId })
      if (!product && mongoose.Types.ObjectId.isValid(productId)) {
        // Fallback: try finding by _id if productId is a valid ObjectId
        product = await Uniform.findById(productId)
        if (product) {
          console.log(`[createProductVendorBatch] Found product ${productId} by _id, using product.id: ${product.id}`)
        }
      }
      
      if (!product) {
        failed.push({ productId, error: `Product not found: ${productId}` })
        continue
      }

      // Validate: Product can only be linked to ONE vendor
      const existingLinks = await db.collection('productvendors').find({ productId: product._id }).toArray()
      if (existingLinks.length > 0) {
        const existingVendorIdStr = existingLinks[0].vendorId?.toString()
        const newVendorIdStr = vendor._id.toString()
        
        if (existingVendorIdStr !== newVendorIdStr) {
          const existingVendor = await Vendor.findById(existingLinks[0].vendorId)
          failed.push({ 
            productId, 
            error: `Already linked to vendor "${existingVendor?.name || existingVendorIdStr}". A product can only be linked to one vendor.` 
          })
          continue
        }
      }

      // Use MongoDB session for transactional safety per product
      const session = await mongoose.startSession()
      session.startTransaction()

      try {
        // Create ProductVendor relationship
        await ProductVendor.findOneAndUpdate(
          { productId: product._id, vendorId: vendor._id },
          { productId: product._id, vendorId: vendor._id },
          { upsert: true, session }
        )

        // Auto-create VendorInventory record with all sizes initialized
        // This must succeed for the transaction to commit
        await ensureVendorInventoryExists(vendor._id, product._id, session)
        
        // Commit transaction - both ProductVendor and VendorInventory are created together
        await session.commitTransaction()
        
        success.push(productId)
        console.log(`[createProductVendorBatch] ✅ Successfully linked product ${productId} to vendor ${vendorId} with inventory initialized`)
      } catch (error: any) {
        // Rollback transaction on any error
        await session.abortTransaction()
        console.error(`[createProductVendorBatch] ❌ Transaction aborted for product ${productId}:`, error.message)
        failed.push({ productId, error: error.message || 'Unknown error' })
      } finally {
        session.endSession()
      }
    } catch (error: any) {
      failed.push({ productId, error: error.message || 'Unknown error' })
    }
  }

  return { success, failed }
}

export async function deleteProductVendor(productId: string, vendorId: string): Promise<void> {
  await connectDB()
  
  const product = await Uniform.findOne({ id: productId })
  const vendor = await Vendor.findOne({ id: vendorId })
  
  if (!product) {
    throw new Error(`Product not found: ${productId}`)
  }
  if (!vendor) {
    throw new Error(`Vendor not found: ${vendorId}`)
  }

  // Use raw MongoDB collection for reliable ObjectId comparison
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('Database connection not available')
  }

  const productIdStr = product._id.toString()
  const vendorIdStr = vendor._id.toString()

  const result = await db.collection('productvendors').deleteOne({
    productId: product._id,
    vendorId: vendor._id
  })
  
  if (result.deletedCount === 0) {
    // Try with string comparison as fallback
    const allLinks = await db.collection('productvendors').find({}).toArray()
    const matchingLink = allLinks.find((link: any) => {
      const linkProductIdStr = link.productId?.toString()
      const linkVendorIdStr = link.vendorId?.toString()
      return linkProductIdStr === productIdStr && linkVendorIdStr === vendorIdStr
    })
    
    if (matchingLink) {
      await db.collection('productvendors').deleteOne({ _id: matchingLink._id })
      console.log(`Successfully deleted relationship between product ${productId} and vendor ${vendorId}`)
  } else {
      throw new Error(`No relationship found to delete between product ${productId} and vendor ${vendorId}`)
    }
  } else {
    console.log(`Successfully deleted relationship between product ${productId} and vendor ${vendorId}`)
  }
}

export async function createVendorCompany(vendorId: string, companyId: string): Promise<void> {
  // Vendor-company relationships are now automatically derived from ProductCompany + ProductVendor
  // This function is kept for backward compatibility but does nothing
  // To create a vendor-company relationship, create ProductCompany and ProductVendor links instead
  console.log(`createVendorCompany: Vendor-company relationships are now derived from ProductCompany + ProductVendor relationships.`)
  console.log(`  To link vendor ${vendorId} to company ${companyId}, ensure there's at least one product that:`)
  console.log(`  1. Is linked to company ${companyId} (via ProductCompany)`)
  console.log(`  2. Is supplied by vendor ${vendorId} (via ProductVendor)`)
}

export async function deleteVendorCompany(vendorId: string, companyId: string): Promise<void> {
  // Vendor-company relationships are now automatically derived from ProductCompany + ProductVendor
  // This function is kept for backward compatibility but does nothing
  // To remove a vendor-company relationship, delete the ProductCompany or ProductVendor links that create it
  console.log(`deleteVendorCompany: Vendor-company relationships are now derived from ProductCompany + ProductVendor relationships.`)
  console.log(`  To unlink vendor ${vendorId} from company ${companyId}, delete ProductCompany or ProductVendor links that connect them.`)
}

// ========== VENDOR INVENTORY FUNCTIONS ==========

/**
 * Get low stock items for a vendor (items where stock <= threshold)
 */
export async function getLowStockItems(vendorId: string): Promise<any[]> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  if (!vendor) return []

  const inventoryRecords = await VendorInventory.find({ vendorId: vendor._id })
    .populate('productId', 'id name category gender sizes price sku')
    .populate('vendorId', 'id name')
    .lean()

  const lowStockItems: any[] = []

  for (const inv of inventoryRecords) {
    const sizeInventory = inv.sizeInventory instanceof Map
      ? Object.fromEntries(inv.sizeInventory)
      : inv.sizeInventory || {}
    
    const lowInventoryThreshold = inv.lowInventoryThreshold instanceof Map
      ? Object.fromEntries(inv.lowInventoryThreshold)
      : inv.lowInventoryThreshold || {}

    // Check each size for low stock
    const lowStockSizes: { [size: string]: { stock: number, threshold: number } } = {}
    for (const [size, stock] of Object.entries(sizeInventory)) {
      const threshold = lowInventoryThreshold[size] || 0
      if (threshold > 0 && stock <= threshold) {
        lowStockSizes[size] = { stock, threshold }
      }
    }

    if (Object.keys(lowStockSizes).length > 0) {
      lowStockItems.push({
        id: inv.id,
        vendorId: inv.vendorId?.id || inv.vendorId?.toString(),
        vendorName: inv.vendorId?.name,
        productId: inv.productId?.id || inv.productId?.toString(),
        productName: inv.productId?.name,
        productCategory: inv.productId?.category,
        productGender: inv.productId?.gender,
        productSku: inv.productId?.sku,
        sizeInventory,
        lowInventoryThreshold,
        lowStockSizes,
        totalStock: inv.totalStock || 0,
      })
    }
  }

  return lowStockItems
}

/**
 * Get vendor inventory summary (total products, total stock, low stock count)
 */
export async function getVendorInventorySummary(vendorId: string): Promise<{
  totalProducts: number
  totalStock: number
  lowStockCount: number
}> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  if (!vendor) {
    return { totalProducts: 0, totalStock: 0, lowStockCount: 0 }
  }

  const inventoryRecords = await VendorInventory.find({ vendorId: vendor._id }).lean()
  
  let totalStock = 0
  let lowStockCount = 0

  for (const inv of inventoryRecords) {
    const sizeInventory = inv.sizeInventory instanceof Map
      ? Object.fromEntries(inv.sizeInventory)
      : inv.sizeInventory || {}
    
    const lowInventoryThreshold = inv.lowInventoryThreshold instanceof Map
      ? Object.fromEntries(inv.lowInventoryThreshold)
      : inv.lowInventoryThreshold || {}

    totalStock += inv.totalStock || 0

    // Check if any size is low stock
    let isLowStock = false
    for (const [size, stock] of Object.entries(sizeInventory)) {
      const threshold = lowInventoryThreshold[size] || 0
      if (threshold > 0 && stock <= threshold) {
        isLowStock = true
        break
      }
    }
    if (isLowStock) {
      lowStockCount++
    }
  }

  return {
    totalProducts: inventoryRecords.length,
    totalStock,
    lowStockCount,
  }
}

export async function getVendorInventory(vendorId: string, productId?: string): Promise<any[]> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  if (!vendor) {
    console.log(`[getVendorInventory] ❌ Vendor not found for id: ${vendorId}`)
    return []
  }

  // CRITICAL FIX: Ensure vendor._id is converted to ObjectId for query
  // MongoDB requires exact type matching - inventory stores ObjectId, so query must use ObjectId
  const vendorObjectId = vendor._id instanceof mongoose.Types.ObjectId 
    ? vendor._id 
    : new mongoose.Types.ObjectId(vendor._id.toString())
  
  console.log(`[getVendorInventory] 🔍 Querying inventory for vendor: ${vendor.name} (id: ${vendor.id}, _id: ${vendorObjectId.toString()})`)

  const query: any = { vendorId: vendorObjectId }
  if (productId) {
    const product = await Uniform.findOne({ id: productId })
    if (product) {
      // CRITICAL FIX: Ensure product._id is converted to ObjectId
      const productObjectId = product._id instanceof mongoose.Types.ObjectId
        ? product._id
        : new mongoose.Types.ObjectId(product._id.toString())
      query.productId = productObjectId
      console.log(`[getVendorInventory] 🔍 Filtering by product: ${product.name} (id: ${product.id}, _id: ${productObjectId.toString()})`)
    } else {
      console.log(`[getVendorInventory] ❌ Product not found for id: ${productId}`)
      return []
    }
  }

  // CRITICAL FIX: Get raw inventory records FIRST to preserve ObjectIds
  // This ensures we always have the productId ObjectId even if populate fails
  const db = mongoose.connection.db
  if (!db) {
    console.error('[getVendorInventory] Database connection not available')
    return []
  }
  
  // CRITICAL FIX: Ensure raw MongoDB query uses ObjectId (not string)
  // MongoDB requires exact type matching - must use ObjectId instances
  const rawQuery: any = {
    vendorId: vendorObjectId instanceof mongoose.Types.ObjectId
      ? vendorObjectId
      : new mongoose.Types.ObjectId(vendorObjectId.toString())
  }
  if (productId && query.productId) {
    rawQuery.productId = query.productId instanceof mongoose.Types.ObjectId
      ? query.productId
      : new mongoose.Types.ObjectId(query.productId.toString())
  }
  
  console.log(`[getVendorInventory] 🔍 Raw MongoDB query:`, {
    vendorId: rawQuery.vendorId.toString(),
    vendorIdType: rawQuery.vendorId.constructor.name,
    productId: rawQuery.productId ? rawQuery.productId.toString() : 'none'
  })
  
  const rawInventoryRecords = await db.collection('vendorinventories').find(rawQuery).toArray()
  console.log(`[getVendorInventory] ✅ Found ${rawInventoryRecords.length} raw inventory records`)
  
  // Create a map of inventory ID -> raw productId ObjectId for fallback
  const rawProductIdMap = new Map<string, any>()
  rawInventoryRecords.forEach((raw: any) => {
    if (raw.productId && raw.id) {
      rawProductIdMap.set(raw.id, raw.productId)
    }
  })
  
  // Now get populated records for product data
  // CRITICAL FIX: Use ObjectId query for Mongoose model (same as raw query)
  const mongooseQuery: any = {
    vendorId: vendorObjectId,
    ...(productId && query.productId ? { productId: query.productId } : {})
  }
  
  console.log(`[getVendorInventory] 🔍 Mongoose query:`, {
    vendorId: mongooseQuery.vendorId.toString(),
    vendorIdType: mongooseQuery.vendorId.constructor.name,
    productId: mongooseQuery.productId ? mongooseQuery.productId.toString() : 'none'
  })
  
  const inventoryRecords = await VendorInventory.find(mongooseQuery)
    .populate('productId', 'id name category gender sizes price sku')
    .populate('vendorId', 'id name')
    .lean()

  console.log(`[getVendorInventory] ✅ Found ${inventoryRecords.length} inventory records via Mongoose`)
  console.log(`[getVendorInventory] ✅ Found ${rawInventoryRecords.length} raw inventory records from DB`)

  // CRITICAL FIX: If Mongoose query returned 0 but raw query found records, use raw records
  // This handles cases where Mongoose query fails but data exists in DB
  if (inventoryRecords.length === 0 && rawInventoryRecords.length > 0) {
    console.warn(`[getVendorInventory] ⚠️ Mongoose query returned 0 records but raw query found ${rawInventoryRecords.length} records`)
    console.warn(`[getVendorInventory] ⚠️ This indicates a query mismatch. Using raw records as fallback.`)
    
    // Build inventory records from raw data
    // We'll process rawInventoryRecords directly instead of inventoryRecords
    const rawBasedRecords: any[] = rawInventoryRecords.map((raw: any) => ({
      _id: raw._id,
      id: raw.id,
      vendorId: raw.vendorId,
      productId: raw.productId,
      sizeInventory: raw.sizeInventory,
      lowInventoryThreshold: raw.lowInventoryThreshold,
      totalStock: raw.totalStock,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt
    }))
    
    // Replace inventoryRecords with raw-based records for processing
    // Clear and repopulate the array
    while (inventoryRecords.length > 0) {
      inventoryRecords.pop()
    }
    rawBasedRecords.forEach(record => inventoryRecords.push(record as any))
    console.log(`[getVendorInventory] ✅ Replaced inventoryRecords with ${inventoryRecords.length} raw-based records`)
  }

  // 🔍 LOG: Check populate results and raw data
  console.log(`[getVendorInventory] Processing ${inventoryRecords.length} inventory records`)
  
  // DIAGNOSTIC: Check raw productId values in database AND after lean()
  if (inventoryRecords.length > 0) {
    const db = mongoose.connection.db
    if (db) {
      const rawInventory = await db.collection('vendorinventories').find(rawQuery).toArray()
      console.log(`[getVendorInventory] 🔍 DIAGNOSTIC: Raw inventory records from DB:`)
      rawInventory.slice(0, 3).forEach((raw: any, idx: number) => {
        console.log(`[getVendorInventory]   Raw[${idx}]:`, {
          id: raw.id,
          productId: raw.productId,
          productIdType: typeof raw.productId,
          productIdIsNull: raw.productId === null,
          productIdIsUndefined: raw.productId === undefined,
          productIdIsEmpty: raw.productId === '',
          productIdString: raw.productId?.toString ? raw.productId.toString() : String(raw.productId)
        })
      })
      
      // Also check what we got after lean() - this is CRITICAL for debugging
      console.log(`[getVendorInventory] 🔍 DIAGNOSTIC: Inventory records after lean():`)
      inventoryRecords.slice(0, 3).forEach((inv: any, idx: number) => {
        const pid = inv.productId
        console.log(`[getVendorInventory]   Lean[${idx}]:`, {
          id: inv.id,
          productId: pid,
          productIdType: typeof pid,
          productIdIsNull: pid === null,
          productIdIsUndefined: pid === undefined,
          productIdIsEmpty: pid === '',
          productIdConstructor: pid?.constructor?.name,
          productIdKeys: pid && typeof pid === 'object' ? Object.keys(pid) : null,
          productIdHasId: pid?.id !== undefined,
          productIdHas_id: pid?._id !== undefined,
          productIdIdValue: pid?.id,
          productId_idValue: pid?._id?.toString ? pid._id.toString() : pid?._id,
          productIdString: pid?.toString ? pid.toString() : (pid ? String(pid) : 'N/A'),
          productIdJSON: pid ? JSON.stringify(pid, (key, value) => {
            if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'ObjectId') {
              return value.toString()
            }
            return value
          }) : 'null'
        })
      })
    }
  }
  
  // CRITICAL FIX: Handle populate failures by querying products directly
  // Collect ObjectIds that failed to populate
  const failedPopulates: mongoose.Types.ObjectId[] = []
  const productIdMap = new Map<string, any>() // Map ObjectId string -> product data
  let orphanedObjectIdStrings = new Set<string>() // Track ObjectIds of products that don't exist
  
  for (const inv of inventoryRecords) {
    // After .lean(), ObjectIds become plain objects, not Mongoose ObjectId instances
    // Check if productId is a populated object (has .id field) or a plain ObjectId object
    if (inv.productId && typeof inv.productId === 'object') {
      if (inv.productId.id) {
        // Populate succeeded - productId is an object with .id field
        productIdMap.set(inv.productId._id?.toString() || '', inv.productId)
        console.log(`[getVendorInventory] ✅ Populate succeeded for inventory ${inv.id}, productId: ${inv.productId.id}`)
      } else {
        // Populate failed - productId is a plain ObjectId object (after .lean())
        // Extract ObjectId string for lookup - try multiple methods
        let objectIdStr = ''
        if (inv.productId._id) {
          objectIdStr = inv.productId._id.toString ? inv.productId._id.toString() : String(inv.productId._id)
        } else if (inv.productId.toString) {
          objectIdStr = inv.productId.toString()
        } else {
          objectIdStr = String(inv.productId)
        }
        
        if (objectIdStr && mongoose.Types.ObjectId.isValid(objectIdStr)) {
          failedPopulates.push(new mongoose.Types.ObjectId(objectIdStr))
          console.log(`[getVendorInventory] 🔍 Populate failed for inventory ${inv.id}, will query by ObjectId: ${objectIdStr}`)
        } else {
          console.warn(`[getVendorInventory] ⚠️ Invalid ObjectId format for inventory ${inv.id}: ${objectIdStr}, productId:`, inv.productId)
        }
      }
    } else if (inv.productId instanceof mongoose.Types.ObjectId) {
      // Still a Mongoose ObjectId (shouldn't happen after .lean(), but handle it)
      failedPopulates.push(inv.productId)
      console.log(`[getVendorInventory] 🔍 Populate failed for inventory ${inv.id}, will query by ObjectId: ${inv.productId.toString()}`)
    } else if (inv.productId === null || inv.productId === undefined) {
      // Populate failed - productId is null, but check if we have raw productId
      const rawProductId = rawProductIdMap.get(inv.id)
      if (rawProductId) {
        // We have raw productId - use it to query
        const objectIdStr = rawProductId.toString ? rawProductId.toString() : String(rawProductId)
        if (objectIdStr && mongoose.Types.ObjectId.isValid(objectIdStr)) {
          failedPopulates.push(new mongoose.Types.ObjectId(objectIdStr))
          console.log(`[getVendorInventory] 🔍 Populate failed (null) for inventory ${inv.id}, using raw productId ObjectId: ${objectIdStr}`)
        } else {
          console.warn(`[getVendorInventory] ⚠️ Invalid raw productId ObjectId for inventory ${inv.id}: ${objectIdStr}`)
        }
      } else {
        // Truly null/undefined - data integrity issue (will be filtered out)
        console.error(`[getVendorInventory] ❌ Inventory ${inv.id} has null/undefined productId after populate and no raw productId - will be filtered out`)
      }
    } else {
      // Unexpected type
      console.warn(`[getVendorInventory] ⚠️ Unexpected productId type for inventory ${inv.id}:`, typeof inv.productId, inv.productId)
    }
  }
  
  // Query products that failed to populate
  if (failedPopulates.length > 0) {
    console.warn(`[getVendorInventory] ⚠️ ${failedPopulates.length} products failed to populate. Querying directly...`)
    
    const products = await Uniform.find({
      _id: { $in: failedPopulates }
    })
      .select('id name category gender sizes price sku')
      .lean()
    
    console.log(`[getVendorInventory] Found ${products.length} products by direct query`)
    
    // Add to map
    products.forEach((p: any) => {
      productIdMap.set(p._id.toString(), {
        id: p.id,
        name: p.name,
        category: p.category,
        gender: p.gender,
        sizes: p.sizes || [],
        price: p.price,
        sku: p.sku,
        _id: p._id
      })
    })
    
    // Track orphaned inventory records (products that don't exist)
    if (products.length < failedPopulates.length) {
      const foundIds = new Set(products.map((p: any) => p._id.toString()))
      const orphanedObjectIds = failedPopulates.filter(oid => !foundIds.has(oid.toString()))
      console.error(`[getVendorInventory] ❌ ${orphanedObjectIds.length} orphaned inventory records (products don't exist): ${orphanedObjectIds.map(oid => oid.toString()).join(', ')}`)
      
      // Store orphaned ObjectIds to filter out their inventory records later
      orphanedObjectIdStrings = new Set(orphanedObjectIds.map(oid => oid.toString()))
    }
  }

  // CRITICAL: Filter using raw inventory records to check for actual null/empty productIds
  // After .lean(), if populate fails, productId might be null even though raw DB has ObjectId
  // So we check the raw records to determine validity
  let validInventoryRecords = inventoryRecords.filter((inv: any) => {
    // Check raw record first (most reliable)
    const rawProductId = rawProductIdMap.get(inv.id)
    if (!rawProductId || rawProductId === null || rawProductId === undefined) {
      console.warn(`[getVendorInventory] ⚠️ Skipping inventory record ${inv.id} - raw productId is null/undefined (data integrity issue)`)
      return false
    }
    
    // Also check populated record (might be null if populate failed, but that's okay - we have raw)
    if (inv.productId === null || inv.productId === undefined) {
      // This is okay if we have raw productId - populate just failed
      console.log(`[getVendorInventory] ℹ️ Inventory ${inv.id} has null productId after populate, but raw productId exists: ${rawProductId.toString()}`)
      return true // Keep it - we'll use raw productId
    }
    
    // Check if it's an empty string (shouldn't happen, but be safe)
    if (typeof inv.productId === 'string' && inv.productId.trim() === '') {
      // Check if raw has valid productId
      if (rawProductId) {
        return true // Keep it - we'll use raw productId
      }
      console.warn(`[getVendorInventory] ⚠️ Skipping inventory record ${inv.id} - productId is empty string (data integrity issue)`)
      return false
    }
    
    // Everything else is valid - keep them
    return true
  })
  
  // Filter out orphaned inventory records (products that don't exist)
  if (orphanedObjectIdStrings.size > 0) {
    const beforeCount = validInventoryRecords.length
    validInventoryRecords = validInventoryRecords.filter((inv: any) => {
      const rawProductId = rawProductIdMap.get(inv.id)
      if (rawProductId) {
        const objectIdStr = rawProductId.toString ? rawProductId.toString() : String(rawProductId)
        if (orphanedObjectIdStrings.has(objectIdStr)) {
          console.warn(`[getVendorInventory] ⚠️ Filtering out inventory ${inv.id} - product ${objectIdStr} does not exist`)
          return false
        }
      }
      return true
    })
    console.log(`[getVendorInventory] Filtered out ${beforeCount - validInventoryRecords.length} orphaned inventory records`)
  }
  
  console.log(`[getVendorInventory] Filtered ${inventoryRecords.length} records to ${validInventoryRecords.length} valid records (removed ${inventoryRecords.length - validInventoryRecords.length} with null/empty/orphaned productIds)`)
  
  return validInventoryRecords.map((inv: any) => {
    const sizeInventory = inv.sizeInventory instanceof Map
      ? Object.fromEntries(inv.sizeInventory)
      : inv.sizeInventory || {}
    
    const lowInventoryThreshold = inv.lowInventoryThreshold instanceof Map
      ? Object.fromEntries(inv.lowInventoryThreshold)
      : inv.lowInventoryThreshold || {}
    
    // Get product data (from populate or direct query)
    let productData: any = null
    
    // CRITICAL: After .lean(), ObjectIds are plain objects, not Mongoose ObjectId instances
    // Check if productId is a populated object (has .id field) or a plain ObjectId object/string
    if (inv.productId && typeof inv.productId === 'object' && inv.productId.id) {
      // Populate succeeded - productId is an object with .id field
      productData = inv.productId
      console.log(`[getVendorInventory] ✅ Populate succeeded for inventory ${inv.id}, productId: ${productData.id}`)
    } else if (inv.productId) {
      // Populate failed or productId is still an ObjectId (plain object after .lean())
      // Extract ObjectId string for lookup
      let productObjectIdStr: string = ''
      
      if (inv.productId instanceof mongoose.Types.ObjectId) {
        // Still a Mongoose ObjectId (shouldn't happen after .lean(), but handle it)
        productObjectIdStr = inv.productId.toString()
      } else if (typeof inv.productId === 'object' && inv.productId._id) {
        // Plain object with _id field
        productObjectIdStr = inv.productId._id.toString ? inv.productId._id.toString() : String(inv.productId._id)
      } else if (typeof inv.productId === 'object' && inv.productId.toString) {
        // Plain object with toString method
        productObjectIdStr = inv.productId.toString()
      } else if (typeof inv.productId === 'string') {
        // Already a string (ObjectId string)
        productObjectIdStr = inv.productId
      } else {
        // Try to convert to string
        productObjectIdStr = String(inv.productId)
      }
      
      console.log(`[getVendorInventory] 🔍 Looking up product for inventory ${inv.id}, productObjectId: ${productObjectIdStr}`)
      productData = productIdMap.get(productObjectIdStr) || null
      
      // Note: We can't do async queries inside map, so if product is not in map,
      // we'll use the ObjectId string as fallback in finalProductId extraction below
      if (!productData && productObjectIdStr) {
        console.warn(`[getVendorInventory] ⚠️ Product not found in map for ObjectId: ${productObjectIdStr}. Will use ObjectId as fallback.`)
      }
    } else {
      // inv.productId is null/undefined - use raw productId from rawProductIdMap
      const rawProductId = rawProductIdMap.get(inv.id)
      if (rawProductId) {
        const objectIdStr = rawProductId.toString ? rawProductId.toString() : String(rawProductId)
        console.log(`[getVendorInventory] 🔍 Looking up product for inventory ${inv.id} using raw productId: ${objectIdStr}`)
        
        // 🔍 DIAGNOSTIC: Log the lookup attempt
        console.log(`[getVendorInventory] 🔍 DIAGNOSTIC: Lookup details:`)
        console.log(`[getVendorInventory]   - Lookup key: "${objectIdStr}" (type: ${typeof objectIdStr}, length: ${objectIdStr.length})`)
        console.log(`[getVendorInventory]   - productIdMap.size: ${productIdMap.size}`)
        console.log(`[getVendorInventory]   - productIdMap.has("${objectIdStr}"): ${productIdMap.has(objectIdStr)}`)
        
        // Try exact match first
        productData = productIdMap.get(objectIdStr) || null
        
        // 🔍 DIAGNOSTIC: If not found, try variations
        if (!productData) {
          console.log(`[getVendorInventory] 🔍 DIAGNOSTIC: Exact match failed, trying variations...`)
          // Try with ObjectId wrapper
          if (mongoose.Types.ObjectId.isValid(objectIdStr)) {
            const oid = new mongoose.Types.ObjectId(objectIdStr)
            const oidStr = oid.toString()
            console.log(`[getVendorInventory]   - Trying ObjectId.toString(): "${oidStr}"`)
            productData = productIdMap.get(oidStr) || null
          }
          
          // Try all keys in map to see if there's a match
          if (!productData) {
            console.log(`[getVendorInventory] 🔍 DIAGNOSTIC: Checking all map keys for similarity:`)
            productIdMap.forEach((value, key) => {
              const match = key === objectIdStr || key.toLowerCase() === objectIdStr.toLowerCase()
              console.log(`[getVendorInventory]   - map["${key}"] === "${objectIdStr}": ${match}`)
            })
          }
        }
        
        if (!productData && objectIdStr) {
          console.warn(`[getVendorInventory] ⚠️ Product not found in map for raw ObjectId: ${objectIdStr}. Will use ObjectId as fallback.`)
        } else if (productData) {
          console.log(`[getVendorInventory] ✅ Found product in map: ${productData.id} - ${productData.name}`)
        }
      }
    }
    
    // CRITICAL: Always return product string ID, not ObjectId
    // Priority: 1) productData.id (string ID), 2) productData._id (ObjectId as string), 3) inv.productId (raw ObjectId as fallback)
    let finalProductId = ''
    
    if (productData?.id) {
      finalProductId = String(productData.id)
      console.log(`[getVendorInventory] ✅ Using productData.id: ${finalProductId}`)
    } else if (productData?._id) {
      // If we have productData but no string id, use ObjectId as fallback
      finalProductId = productData._id.toString ? productData._id.toString() : String(productData._id)
      console.log(`[getVendorInventory] ⚠️ Using productData._id as fallback: ${finalProductId}`)
    } else {
      // Last resort: use the raw productId from raw inventory records (preserved ObjectId)
      const rawProductId = rawProductIdMap.get(inv.id)
      if (rawProductId) {
        // Extract ObjectId string from raw record
        const objectIdStr = rawProductId.toString ? rawProductId.toString() : String(rawProductId)
        if (objectIdStr && mongoose.Types.ObjectId.isValid(objectIdStr)) {
          finalProductId = objectIdStr
          console.warn(`[getVendorInventory] ⚠️ Using raw productId ObjectId from raw record for inventory ${inv.id}: ${finalProductId}`)
        }
      }
      
      // If still empty, try inv.productId (might be null after populate failure)
      if (!finalProductId && inv.productId) {
        if (inv.productId instanceof mongoose.Types.ObjectId) {
          finalProductId = inv.productId.toString()
        } else if (typeof inv.productId === 'object' && inv.productId._id) {
          finalProductId = inv.productId._id.toString ? inv.productId._id.toString() : String(inv.productId._id)
        } else if (typeof inv.productId === 'object' && inv.productId.toString) {
          finalProductId = inv.productId.toString()
        } else if (typeof inv.productId === 'string') {
          finalProductId = inv.productId
        } else {
          finalProductId = String(inv.productId)
        }
        if (finalProductId) {
          console.warn(`[getVendorInventory] ⚠️ Using inv.productId as fallback for inventory ${inv.id}: ${finalProductId}`)
        }
      }
    }
    
    // FINAL SAFEGUARD: If we still don't have a productId, try to extract it from the raw inv.productId
    // This handles edge cases where all previous methods failed
    if (!finalProductId || finalProductId === '') {
      console.error(`[getVendorInventory] ❌ CRITICAL: Cannot extract product ID for inventory ${inv.id}`)
      console.error(`[getVendorInventory]   - inv.productId:`, inv.productId)
      console.error(`[getVendorInventory]   - inv.productId type:`, typeof inv.productId)
      console.error(`[getVendorInventory]   - inv.productId constructor:`, inv.productId?.constructor?.name)
      console.error(`[getVendorInventory]   - productData:`, productData)
      console.error(`[getVendorInventory]   - productData?.id:`, productData?.id)
      console.error(`[getVendorInventory]   - productData?._id:`, productData?._id)
      
      // Last-ditch effort: try to extract from raw inv.productId
      if (inv.productId) {
        if (typeof inv.productId === 'string' && inv.productId.length > 0) {
          finalProductId = inv.productId
          console.warn(`[getVendorInventory] ⚠️ Using raw string productId as last resort: ${finalProductId}`)
        } else if (typeof inv.productId === 'object') {
          // Try to get _id from the object
          const rawId = (inv.productId as any)?._id || (inv.productId as any)?.id || inv.productId
          if (rawId) {
            finalProductId = rawId.toString ? rawId.toString() : String(rawId)
            if (finalProductId && finalProductId !== '') {
              console.warn(`[getVendorInventory] ⚠️ Using raw object productId as last resort: ${finalProductId}`)
            }
          }
        }
      }
      
      // If still empty, this is a data integrity issue
      if (!finalProductId || finalProductId === '') {
        console.error(`[getVendorInventory] ❌❌❌ FATAL: Inventory record ${inv.id} has no valid productId. This is a data integrity issue.`)
      }
    }
    
    return {
      id: inv.id,
      vendorId: inv.vendorId?.id || (inv.vendorId as any)?.toString(),
      vendorName: (inv.vendorId as any)?.name,
      productId: finalProductId, // ALWAYS use string id, never ObjectId
      productName: productData?.name || undefined,
      productCategory: productData?.category || undefined,
      productGender: productData?.gender || undefined,
      productSizes: productData?.sizes || [],
      productPrice: productData?.price || undefined,
      productSku: productData?.sku || undefined,
      sizeInventory,
      lowInventoryThreshold,
      totalStock: inv.totalStock || 0,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    }
  })
}

/**
 * Get vendor-wise inventory for a company (read-only view for Company Admin)
 * Returns all inventory records for products linked to the company, grouped by vendor
 * @param companyId - Company ID (string or number)
 * @returns Array of inventory records with product and vendor details
 */
export async function getVendorWiseInventoryForCompany(companyId: string | number): Promise<any[]> {
  await connectDB()
  
  // Get company ObjectId
  const company = await Company.findOne({ id: String(companyId) })
  if (!company) {
    console.warn(`[getVendorWiseInventoryForCompany] Company not found: ${companyId}`)
    return []
  }
  
  // Get all products linked to this company via ProductCompany
  const db = mongoose.connection.db
  if (!db) {
    console.error('[getVendorWiseInventoryForCompany] Database connection not available')
    return []
  }
  
  const productCompanyLinks = await db.collection('productcompanies').find({
    companyId: company._id
  }).toArray()
  
  if (productCompanyLinks.length === 0) {
    console.log(`[getVendorWiseInventoryForCompany] No products linked to company ${companyId}`)
    return []
  }
  
  const productObjectIds = productCompanyLinks
    .map((link: any) => link.productId)
    .filter((id: any) => id)
  
  if (productObjectIds.length === 0) {
    return []
  }
  
  console.log(`[getVendorWiseInventoryForCompany] 🔍 Finding inventory for ${productObjectIds.length} products`)
  
  // First, get raw inventory records to inspect vendorId structure
  const rawInventoryRecords = await db.collection('vendorinventories').find({
    productId: { $in: productObjectIds }
  }).toArray()
  
  console.log(`[getVendorWiseInventoryForCompany] 📊 Raw inventory records from DB: ${rawInventoryRecords.length}`)
  if (rawInventoryRecords.length > 0) {
    const sampleRaw = rawInventoryRecords[0]
    console.log(`[getVendorWiseInventoryForCompany] 📋 Sample raw inventory record:`, {
      id: sampleRaw.id,
      vendorId: sampleRaw.vendorId,
      vendorIdType: sampleRaw.vendorId?.constructor?.name,
      vendorIdString: sampleRaw.vendorId?.toString(),
      productId: sampleRaw.productId,
      productIdType: sampleRaw.productId?.constructor?.name
    })
  }
  
  // Get all vendor inventories for these products
  const inventoryRecords = await VendorInventory.find({
    productId: { $in: productObjectIds }
  })
    .populate('productId', 'id name sku category gender')
    .populate('vendorId', 'id name')
    .lean()
  
  console.log(`[getVendorWiseInventoryForCompany] ✅ Found ${inventoryRecords.length} inventory records via Mongoose`)
  
  // Log sample of populated records
  if (inventoryRecords.length > 0) {
    const samplePopulated = inventoryRecords[0]
    console.log(`[getVendorWiseInventoryForCompany] 📋 Sample populated inventory record:`, {
      id: samplePopulated.id,
      vendorId: samplePopulated.vendorId,
      vendorIdType: typeof samplePopulated.vendorId,
      vendorIdIsObject: typeof samplePopulated.vendorId === 'object',
      vendorIdKeys: samplePopulated.vendorId && typeof samplePopulated.vendorId === 'object' ? Object.keys(samplePopulated.vendorId) : 'N/A',
      productId: samplePopulated.productId,
      productIdType: typeof samplePopulated.productId
    })
  }
  
  // Get all vendors for manual lookup (fallback if populate fails)
  const allVendors = await Vendor.find({}).lean()
  console.log(`[getVendorWiseInventoryForCompany] 📦 Loaded ${allVendors.length} vendors from database`)
  
  const vendorMap = new Map()
  allVendors.forEach((v: any) => {
    if (v._id) {
      const vendorIdStr = v._id.toString()
      vendorMap.set(vendorIdStr, { id: v.id, name: v.name })
      console.log(`[getVendorWiseInventoryForCompany] 📝 Mapped vendor: ${vendorIdStr} -> ${v.name} (id: ${v.id})`)
    }
  })
  
  console.log(`[getVendorWiseInventoryForCompany] 🗺️  Vendor map size: ${vendorMap.size}`)
  
  // Build a map of inventory ID -> vendorId from raw records for reliable lookup
  const inventoryVendorMap = new Map<string, any>()
  rawInventoryRecords.forEach((raw: any) => {
    if (raw.id && raw.vendorId) {
      let vendorIdStr: string | null = null
      if (typeof raw.vendorId === 'string') {
        vendorIdStr = raw.vendorId
      } else if (raw.vendorId.toString) {
        vendorIdStr = raw.vendorId.toString()
      } else if (raw.vendorId._id) {
        vendorIdStr = raw.vendorId._id.toString()
      }
      
      if (vendorIdStr) {
        inventoryVendorMap.set(raw.id, vendorIdStr)
        console.log(`[getVendorWiseInventoryForCompany] 📝 Mapped inventory ${raw.id} -> vendorId ${vendorIdStr}`)
      }
    }
  })
  
  console.log(`[getVendorWiseInventoryForCompany] 🗺️  Inventory-Vendor map size: ${inventoryVendorMap.size}`)
  
  // Format the data for display
  const formattedInventory = inventoryRecords.map((inv: any, index: number) => {
    console.log(`\n[getVendorWiseInventoryForCompany] 🔄 Processing inventory record ${index + 1}/${inventoryRecords.length}`)
    console.log(`[getVendorWiseInventoryForCompany]   Inventory ID: ${inv.id || 'N/A'}`)
    console.log(`[getVendorWiseInventoryForCompany]   Raw vendorId type: ${typeof inv.vendorId}`)
    console.log(`[getVendorWiseInventoryForCompany]   Raw vendorId value:`, inv.vendorId)
    console.log(`[getVendorWiseInventoryForCompany]   Raw vendorId constructor: ${inv.vendorId?.constructor?.name}`)
    
    // Also get the raw record for comparison
    const rawRecord = rawInventoryRecords.find((r: any) => r.id === inv.id)
    if (rawRecord) {
      console.log(`[getVendorWiseInventoryForCompany]   📦 Raw DB vendorId:`, rawRecord.vendorId)
      console.log(`[getVendorWiseInventoryForCompany]   📦 Raw DB vendorId type: ${rawRecord.vendorId?.constructor?.name}`)
      console.log(`[getVendorWiseInventoryForCompany]   📦 Raw DB vendorId string: ${rawRecord.vendorId?.toString()}`)
    }
    
    const product = inv.productId
    let vendor = inv.vendorId
    
    console.log(`[getVendorWiseInventoryForCompany]   Initial vendor from populate:`, vendor)
    console.log(`[getVendorWiseInventoryForCompany]   Has vendor.name? ${!!(vendor && vendor.name)}`)
    
    // Fallback: if populate didn't work, try manual lookup
    if (!vendor || !vendor.name) {
      console.log(`[getVendorWiseInventoryForCompany]   ⚠️  Populate failed, trying manual lookup...`)
      
      // Try multiple ways to extract vendorId
      let vendorIdStr: string | null = null
      
      if (inv.vendorId) {
        if (typeof inv.vendorId === 'string') {
          vendorIdStr = inv.vendorId
          console.log(`[getVendorWiseInventoryForCompany]   📌 vendorId is string: ${vendorIdStr}`)
        } else if (inv.vendorId._id) {
          vendorIdStr = inv.vendorId._id.toString()
          console.log(`[getVendorWiseInventoryForCompany]   📌 vendorId._id found: ${vendorIdStr}`)
        } else if (inv.vendorId.toString) {
          vendorIdStr = inv.vendorId.toString()
          console.log(`[getVendorWiseInventoryForCompany]   📌 vendorId.toString(): ${vendorIdStr}`)
        } else if (typeof inv.vendorId === 'object' && inv.vendorId.constructor?.name === 'ObjectId') {
          vendorIdStr = inv.vendorId.toString()
          console.log(`[getVendorWiseInventoryForCompany]   📌 vendorId is ObjectId: ${vendorIdStr}`)
        }
      }
      
      // Also check raw vendorId field from inventory record
      if (!vendorIdStr && inv.vendorId) {
        const rawVendorId = inv.vendorId
        if (rawVendorId && typeof rawVendorId === 'object' && rawVendorId._id) {
          vendorIdStr = rawVendorId._id.toString()
          console.log(`[getVendorWiseInventoryForCompany]   📌 Found vendorId from raw field: ${vendorIdStr}`)
        }
      }
      
      if (vendorIdStr) {
        console.log(`[getVendorWiseInventoryForCompany]   🔍 Looking up vendorId: ${vendorIdStr}`)
        console.log(`[getVendorWiseInventoryForCompany]   🗺️  Vendor map has key? ${vendorMap.has(vendorIdStr)}`)
        
        if (vendorMap.has(vendorIdStr)) {
          vendor = vendorMap.get(vendorIdStr)
          console.log(`[getVendorWiseInventoryForCompany]   ✅ Found vendor in map:`, vendor)
        } else {
          console.log(`[getVendorWiseInventoryForCompany]   ❌ Vendor not found in map for ID: ${vendorIdStr}`)
          console.log(`[getVendorWiseInventoryForCompany]   📋 Available vendor IDs in map:`, Array.from(vendorMap.keys()).slice(0, 5))
        }
      } else {
        console.log(`[getVendorWiseInventoryForCompany]   ❌ Could not extract vendorId string`)
      }
      
      // Try to extract from populated object structure
      if ((!vendor || !vendor.name) && inv.vendorId && typeof inv.vendorId === 'object') {
        console.log(`[getVendorWiseInventoryForCompany]   🔄 Trying to extract from populated object...`)
        console.log(`[getVendorWiseInventoryForCompany]   📦 Populated object keys:`, Object.keys(inv.vendorId))
        vendor = {
          id: inv.vendorId.id || inv.vendorId._id?.toString() || 'N/A',
          name: inv.vendorId.name || 'Unknown Vendor'
        }
        console.log(`[getVendorWiseInventoryForCompany]   📝 Extracted vendor:`, vendor)
      }
    }
    
    // Final fallback: use inventory-vendor map built from raw records
    if (!vendor || !vendor.name || vendor.name === 'Unknown Vendor') {
      console.log(`[getVendorWiseInventoryForCompany]   🔄 Final fallback: using inventory-vendor map...`)
      
      const mappedVendorId = inventoryVendorMap.get(inv.id)
      if (mappedVendorId) {
        console.log(`[getVendorWiseInventoryForCompany]   📝 Found vendorId from map: ${mappedVendorId}`)
        if (vendorMap.has(mappedVendorId)) {
          vendor = vendorMap.get(mappedVendorId)
          console.log(`[getVendorWiseInventoryForCompany]   ✅ Final lookup successful:`, vendor)
        } else {
          console.log(`[getVendorWiseInventoryForCompany]   ❌ VendorId ${mappedVendorId} not in vendor map`)
          console.log(`[getVendorWiseInventoryForCompany]   📋 Available vendor IDs:`, Array.from(vendorMap.keys()).slice(0, 10))
        }
      } else {
        console.log(`[getVendorWiseInventoryForCompany]   ❌ Inventory ${inv.id} not in inventory-vendor map`)
      }
    }
    
    // Log final vendor result
    console.log(`[getVendorWiseInventoryForCompany]   ✅ Final vendor for record:`, vendor)
    console.log(`[getVendorWiseInventoryForCompany]   📝 Vendor name: ${vendor?.name || 'MISSING'}`)
    
    // Ensure we always have a vendor object
    if (!vendor || !vendor.name) {
      console.log(`[getVendorWiseInventoryForCompany]   ⚠️  WARNING: No vendor found, using fallback`)
      vendor = { id: 'N/A', name: 'Unknown Vendor' }
    }
    
    // Convert sizeInventory Map to object
    const sizeInventoryObj = inv.sizeInventory instanceof Map
      ? Object.fromEntries(inv.sizeInventory)
      : (inv.sizeInventory || {})
    
    // Convert lowInventoryThreshold Map to object
    const thresholdObj = inv.lowInventoryThreshold instanceof Map
      ? Object.fromEntries(inv.lowInventoryThreshold)
      : (inv.lowInventoryThreshold || {})
    
    // Calculate overall threshold (minimum threshold across all sizes, or 0 if none set)
    const thresholdValues = Object.values(thresholdObj).filter((v: any) => typeof v === 'number' && v > 0)
    const overallThreshold = thresholdValues.length > 0 ? Math.min(...thresholdValues as number[]) : 0
    
    // Determine stock status
    const totalStock = inv.totalStock || 0
    let stockStatus = 'in_stock'
    if (totalStock === 0) {
      stockStatus = 'out_of_stock'
    } else if (overallThreshold > 0 && totalStock <= overallThreshold) {
      stockStatus = 'low_stock'
    }
    
    return {
      sku: product?.sku || 'N/A',
      productName: product?.name || 'Unknown Product',
      productId: product?.id || 'N/A',
      vendorName: vendor?.name || 'Unknown Vendor',
      vendorId: vendor?.id || 'N/A',
      availableStock: totalStock,
      threshold: overallThreshold,
      sizeInventory: sizeInventoryObj,
      lowInventoryThreshold: thresholdObj,
      stockStatus,
      lastUpdated: inv.updatedAt || inv.createdAt || null,
      category: product?.category || 'N/A',
      gender: product?.gender || 'N/A',
    }
  })
  
  // Summary log
  const vendorNameCounts = new Map<string, number>()
  formattedInventory.forEach((item: any) => {
    const vendorName = item.vendorName || 'Unknown Vendor'
    vendorNameCounts.set(vendorName, (vendorNameCounts.get(vendorName) || 0) + 1)
  })
  
  console.log(`\n[getVendorWiseInventoryForCompany] 📊 SUMMARY:`)
  console.log(`[getVendorWiseInventoryForCompany]   Total inventory records: ${formattedInventory.length}`)
  console.log(`[getVendorWiseInventoryForCompany]   Vendor distribution:`)
  vendorNameCounts.forEach((count, vendorName) => {
    console.log(`[getVendorWiseInventoryForCompany]     - ${vendorName}: ${count} record(s)`)
  })
  console.log(`[getVendorWiseInventoryForCompany] ✅ Returning ${formattedInventory.length} formatted inventory records\n`)
  
  return formattedInventory
}

/**
 * Initialize vendor inventory for a product-vendor combination
 * Creates inventory record with all product sizes initialized to 0 stock and 0 threshold
 * Idempotent: Safe to call multiple times, won't create duplicates
 * This is called automatically when products are linked to vendors
 * @param vendorId - Vendor ObjectId
 * @param productId - Product ObjectId
 * @param session - Optional MongoDB session for transactional operations
 */
async function ensureVendorInventoryExists(
  vendorId: mongoose.Types.ObjectId, 
  productId: mongoose.Types.ObjectId,
  session?: mongoose.ClientSession
): Promise<void> {
  try {
    // CRITICAL: Verify product exists before creating inventory
    const product = await Uniform.findById(productId)
    if (!product) {
      console.error(`[ensureVendorInventoryExists] ❌ Product not found: ObjectId ${productId}`)
      throw new Error(`Product not found: ${productId.toString()}`)
    }

    // Check if inventory already exists (idempotency check)
    const findQuery = VendorInventory.findOne({
      vendorId: vendorId,
      productId: productId,
    })
    const existingInventory = session ? await findQuery.session(session) : await findQuery

    if (existingInventory) {
      // Inventory already exists, no need to create (idempotent)
      console.log(`[ensureVendorInventoryExists] ✅ Inventory already exists for vendor ${vendorId.toString()} / product ${product.id || productId.toString()}`)
      return
    }

    // Get product sizes - initialize inventory for each size
    const productSizes = product.sizes || []
    if (!Array.isArray(productSizes) || productSizes.length === 0) {
      console.warn(`[ensureVendorInventoryExists] ⚠️  Product ${product.id || productId.toString()} has no sizes defined. Creating inventory with empty size map.`)
    }

    // Initialize sizeInventory Map with all product sizes set to 0
    const sizeInventoryMap = new Map<string, number>()
    for (const size of productSizes) {
      if (size && typeof size === 'string' && size.trim()) {
        sizeInventoryMap.set(size.trim(), 0)
      }
    }

    // Initialize lowInventoryThreshold Map with all product sizes set to 0
    const thresholdMap = new Map<string, number>()
    for (const size of productSizes) {
      if (size && typeof size === 'string' && size.trim()) {
        thresholdMap.set(size.trim(), 0)
      }
    }

    // Generate unique inventory ID
    let inventoryId = `VEND-INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
    let isUnique = false
    let attempts = 0
    while (!isUnique && attempts < 10) {
      const checkQuery = VendorInventory.findOne({ id: inventoryId })
      const existing = session ? await checkQuery.session(session) : await checkQuery
      if (!existing) {
        isUnique = true
      } else {
        inventoryId = `VEND-INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
        attempts++
      }
    }

    // Create inventory record with all sizes initialized to 0
    const inventoryDoc = new VendorInventory({
      id: inventoryId,
      vendorId: vendorId,
      productId: productId,
      sizeInventory: sizeInventoryMap,
      totalStock: 0, // Will be recalculated by pre-save hook (sum of all sizes = 0)
      lowInventoryThreshold: thresholdMap,
    })

    // Mark Map fields as modified to ensure Mongoose saves them
    inventoryDoc.markModified('sizeInventory')
    inventoryDoc.markModified('lowInventoryThreshold')

    // Save with session if provided (for transactional operations)
    if (session) {
      await inventoryDoc.save({ session })
    } else {
      await inventoryDoc.save()
    }

    console.log(`[ensureVendorInventoryExists] ✅ Created VendorInventory for vendor ${vendorId.toString()} / product ${product.id || productId.toString()}`)
    console.log(`[ensureVendorInventoryExists] 📊 Initialized ${sizeInventoryMap.size} sizes: ${Array.from(sizeInventoryMap.keys()).join(', ')}`)
  } catch (error: any) {
    // If error is due to duplicate (race condition), that's okay (idempotent)
    if (error.code === 11000 || error.message?.includes('duplicate')) {
      console.log(`[ensureVendorInventoryExists] ⚠️  VendorInventory already exists for vendor ${vendorId.toString()} / product ${productId.toString()} (race condition)`)
      return
    }
    // Re-throw other errors (including product not found)
    console.error(`[ensureVendorInventoryExists] ❌ Error creating VendorInventory:`, {
      vendorId: vendorId.toString(),
      productId: productId.toString(),
      error: error.message,
      code: error.code,
    })
    throw error
  }
}

export async function updateVendorInventory(
  vendorId: string,
  productId: string,
  sizeInventory: { [size: string]: number },
  lowInventoryThreshold?: { [size: string]: number }
): Promise<any> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  const product = await Uniform.findOne({ id: productId })
  
  if (!vendor || !product) {
    throw new Error('Vendor or Product not found')
  }

  // Get existing inventory to preserve threshold if not provided
  const existingInventory = await VendorInventory.findOne({
    vendorId: vendor._id,
    productId: product._id,
  })

  // Generate unique inventory ID if creating new
  let inventoryId = existingInventory?.id || `VEND-INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
  if (!existingInventory) {
  let isUnique = false
  while (!isUnique) {
    const existing = await VendorInventory.findOne({ id: inventoryId })
    if (!existing) {
      isUnique = true
    } else {
      inventoryId = `VEND-INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
      }
    }
  }

  // Convert sizeInventory object to Map for Mongoose schema
  // Mongoose Map type requires actual Map instances for proper serialization
  const sizeInventoryMap = new Map<string, number>()
  for (const [size, quantity] of Object.entries(sizeInventory)) {
    sizeInventoryMap.set(size, typeof quantity === 'number' ? quantity : 0)
  }

  // Handle lowInventoryThreshold - merge with existing if provided
  let thresholdMap: Map<string, number>
  if (lowInventoryThreshold !== undefined) {
    thresholdMap = new Map<string, number>()
    for (const [size, threshold] of Object.entries(lowInventoryThreshold)) {
      thresholdMap.set(size, typeof threshold === 'number' ? threshold : 0)
    }
  } else if (existingInventory?.lowInventoryThreshold) {
    // Preserve existing thresholds if not provided
    thresholdMap = existingInventory.lowInventoryThreshold instanceof Map
      ? new Map(existingInventory.lowInventoryThreshold)
      : new Map(Object.entries(existingInventory.lowInventoryThreshold || {}))
  } else {
    thresholdMap = new Map<string, number>()
  }

  // Calculate total stock
  let totalStock = 0
  for (const quantity of Object.values(sizeInventory)) {
    totalStock += typeof quantity === 'number' ? quantity : 0
  }

  console.log('[updateVendorInventory] 🔍 DIAGNOSTIC: Update payload:', {
    vendorId: vendor.id,
    productId: product.id,
    sizeInventory: Object.fromEntries(sizeInventoryMap),
    totalStock,
    lowInventoryThreshold: Object.fromEntries(thresholdMap),
    inventoryId
  })

  // CRITICAL FIX: Use document.save() instead of findOneAndUpdate
  // findOneAndUpdate with .lean() bypasses Mongoose pre-save hooks and Map serialization
  // document.save() ensures:
  // 1. Pre-save hook runs (recalculates totalStock from sizeInventory)
  // 2. Map serialization works correctly
  // 3. Data persists properly to database
  
  let inventoryDoc = await VendorInventory.findOne({
    vendorId: vendor._id,
    productId: product._id,
  })

  if (!inventoryDoc) {
    // Create new inventory document if it doesn't exist
    inventoryDoc = new VendorInventory({
      id: inventoryId,
      vendorId: vendor._id,
      productId: product._id,
      sizeInventory: new Map(),
      lowInventoryThreshold: new Map(),
      totalStock: 0,
    })
    console.log('[updateVendorInventory] 🔍 DIAGNOSTIC: Created new inventory document.')
  } else {
    console.log('[updateVendorInventory] 🔍 DIAGNOSTIC: Found existing inventory document.')
  }

  // Update properties - use Map instances (schema expects Map type)
  inventoryDoc.sizeInventory = sizeInventoryMap
  inventoryDoc.lowInventoryThreshold = thresholdMap
  // Note: totalStock will be recalculated by pre-save hook, but we set it explicitly too
  inventoryDoc.totalStock = totalStock

  // CRITICAL: Mark Map fields as modified to ensure Mongoose saves them
  // Mongoose doesn't always detect changes to Map objects, so we must explicitly mark them
  inventoryDoc.markModified('sizeInventory')
  inventoryDoc.markModified('lowInventoryThreshold')

  console.log('[updateVendorInventory] 🔍 DIAGNOSTIC: Before save - inventoryDoc:', {
    id: inventoryDoc.id,
    vendorId: inventoryDoc.vendorId.toString(),
    productId: inventoryDoc.productId.toString(),
    sizeInventory: Object.fromEntries(inventoryDoc.sizeInventory),
    lowInventoryThreshold: Object.fromEntries(inventoryDoc.lowInventoryThreshold),
    totalStock: inventoryDoc.totalStock, // Will be recalculated by pre-save hook
  })

  // Save the document - this triggers pre-save hooks and proper Map serialization
  let savedInventory
  try {
    savedInventory = await inventoryDoc.save()
    console.log('[updateVendorInventory] ✅ Document.save() completed successfully')
  } catch (saveError: any) {
    console.error('[updateVendorInventory] ❌ CRITICAL: Document.save() failed:', saveError)
    console.error('[updateVendorInventory] ❌ Save error details:', {
      message: saveError.message,
      stack: saveError.stack,
      name: saveError.name,
      code: saveError.code,
    })
    throw new Error(`Failed to save inventory: ${saveError.message}`)
  }
  
  console.log('[updateVendorInventory] ✅ Inventory document saved successfully.')
  console.log('[updateVendorInventory] 🔍 DIAGNOSTIC: After save - savedInventory:', {
    id: savedInventory.id,
    totalStock: savedInventory.totalStock,
    sizeInventorySize: savedInventory.sizeInventory.size,
    lowInventoryThresholdSize: savedInventory.lowInventoryThreshold.size,
  })

  // Populate and return the saved document
  const inventory = await VendorInventory.findById(savedInventory._id)
    .populate('productId', 'id name category gender sizes price sku')
    .populate('vendorId', 'id name')
    .lean()

  if (!inventory) {
    console.error('[updateVendorInventory] ❌ CRITICAL: Failed to retrieve populated inventory after save.')
    throw new Error('Failed to update inventory')
  }

  // Verify the update persisted correctly
  const inventoryAny = inventory as any
  console.log('[updateVendorInventory] ✅ Update result (after save and populate):', {
    inventoryId: inventoryAny.id,
    persistedSizeInventory: inventoryAny.sizeInventory,
    persistedTotalStock: inventoryAny.totalStock,
    persistedThreshold: inventoryAny.lowInventoryThreshold,
    sizeInventoryType: typeof inventoryAny.sizeInventory,
    sizeInventoryIsMap: inventoryAny.sizeInventory instanceof Map,
    sizeInventoryConstructor: inventoryAny.sizeInventory?.constructor?.name
  })
  
  // CRITICAL: Verify data was actually persisted by querying database directly
  const db = mongoose.connection.db
  if (db) {
    const rawInventory = await db.collection('vendorinventories').findOne({
      vendorId: vendor._id,
      productId: product._id,
    })
    if (rawInventory) {
      console.log('[updateVendorInventory] ✅ DATABASE VERIFICATION: Raw DB record:', {
        id: rawInventory.id,
        sizeInventory: rawInventory.sizeInventory,
        totalStock: rawInventory.totalStock,
        lowInventoryThreshold: rawInventory.lowInventoryThreshold,
        updatedAt: rawInventory.updatedAt,
      })
      
      // Verify the values match what we tried to save
      const expectedTotal = Object.values(sizeInventory).reduce((sum, qty) => sum + (typeof qty === 'number' ? qty : 0), 0)
      if (rawInventory.totalStock !== expectedTotal) {
        console.error(`[updateVendorInventory] ❌ DATABASE VERIFICATION FAILED: totalStock mismatch! Expected: ${expectedTotal}, Got: ${rawInventory.totalStock}`)
        throw new Error(`Inventory totalStock mismatch: expected ${expectedTotal}, got ${rawInventory.totalStock}`)
      }
      
      // Verify sizeInventory matches
      const rawSizeInv = rawInventory.sizeInventory || {}
      const sizeInventoryKeys = Object.keys(sizeInventory)
      for (const size of sizeInventoryKeys) {
        const expectedQty = sizeInventory[size]
        const actualQty = rawSizeInv[size]
        if (actualQty !== expectedQty) {
          console.error(`[updateVendorInventory] ❌ DATABASE VERIFICATION FAILED: sizeInventory mismatch for size ${size}! Expected: ${expectedQty}, Got: ${actualQty}`)
          throw new Error(`Inventory sizeInventory mismatch for size ${size}: expected ${expectedQty}, got ${actualQty}`)
        }
      }
      
      console.log('[updateVendorInventory] ✅ DATABASE VERIFICATION PASSED: All values match expected values')
    } else {
      console.error('[updateVendorInventory] ❌ DATABASE VERIFICATION FAILED: Record not found in DB after save!')
      throw new Error('Inventory update did not persist to database')
    }
  }

  // Convert retrieved Maps to plain objects for response
  // After .lean(), Maps are returned as plain objects
  const responseSizeInventory = inventoryAny.sizeInventory instanceof Map
    ? Object.fromEntries(inventoryAny.sizeInventory)
    : inventoryAny.sizeInventory || {}
  
  const responseThreshold = inventoryAny.lowInventoryThreshold instanceof Map
    ? Object.fromEntries(inventoryAny.lowInventoryThreshold)
    : inventoryAny.lowInventoryThreshold || {}

  return {
    id: inventoryAny.id,
    vendorId: inventoryAny.vendorId?.id || inventoryAny.vendorId?.toString(),
    vendorName: inventoryAny.vendorId?.name,
    productId: inventoryAny.productId?.id || inventoryAny.productId?.toString(),
    productName: inventoryAny.productId?.name,
    productCategory: inventoryAny.productId?.category,
    productGender: inventoryAny.productId?.gender,
    productSizes: inventoryAny.productId?.sizes || [],
    productPrice: inventoryAny.productId?.price,
    productSku: inventoryAny.productId?.sku,
    sizeInventory: responseSizeInventory,
    lowInventoryThreshold: responseThreshold,
    totalStock: inventoryAny.totalStock || 0,
    createdAt: inventoryAny.createdAt,
    updatedAt: inventoryAny.updatedAt,
  }
}

// ========== DESIGNATION PRODUCT ELIGIBILITY FUNCTIONS ==========

export async function getDesignationEligibilitiesByCompany(companyId: string): Promise<any[]> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    console.warn(`Company not found: ${companyId}`)
    return []
  }

  // First try with status filter
  let eligibilities = await DesignationProductEligibility.find({ 
    companyId: company._id,
    status: 'active'
  })
    .populate('companyId', 'id name')
    .sort({ designation: 1 })
    .lean()

  // If no active records found, also check for inactive records (for debugging)
  if (eligibilities.length === 0) {
    const inactiveCount = await DesignationProductEligibility.countDocuments({ 
      companyId: company._id,
      status: 'inactive'
    })
    if (inactiveCount > 0) {
      console.warn(`Found ${inactiveCount} inactive designation eligibilities for company ${companyId}. Only active records are returned.`)
    }
    
    // Also check if there are any records with this companyId but no status filter
    const allCount = await DesignationProductEligibility.countDocuments({ 
      companyId: company._id
    })
    if (allCount > 0 && allCount !== inactiveCount) {
      console.warn(`Found ${allCount} total designation eligibilities for company ${companyId}, but none are active.`)
    }
  }

  // Import decrypt function and crypto for alternative decryption
  const { decrypt } = require('../utils/encryption')
  const crypto = require('crypto')
  
  // Helper function to get encryption key
  const getKey = () => {
    const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production-32-chars!!'
    const key = Buffer.from(ENCRYPTION_KEY, 'utf8')
    if (key.length !== 32) {
      return crypto.createHash('sha256').update(ENCRYPTION_KEY).digest()
    }
    return key
  }
  
  // Decrypt designations manually since .lean() bypasses Mongoose hooks
  const decryptedEligibilities = eligibilities.map((e: any) => {
    // Log raw data from DB before processing
    console.log('🔍 Raw eligibility from DB:', {
      id: e.id,
      hasItemEligibility: !!e.itemEligibility,
      itemEligibilityKeys: e.itemEligibility ? Object.keys(e.itemEligibility) : 'none',
      itemEligibilityRaw: e.itemEligibility ? JSON.stringify(e.itemEligibility, null, 2) : 'none',
      allowedProductCategories: e.allowedProductCategories,
    })
    
    // Convert to plain object first
    const plainObj = toPlainObject(e)
    
    // Ensure allowedProductCategories includes all categories from itemEligibility
    // This fixes existing data where categories might be missing
    if (plainObj.itemEligibility && typeof plainObj.itemEligibility === 'object') {
      const categoriesFromItemEligibility = Object.keys(plainObj.itemEligibility).filter(key => 
        key !== '_id' && plainObj.itemEligibility[key] && typeof plainObj.itemEligibility[key] === 'object'
      )
      const existingCategories = new Set(plainObj.allowedProductCategories || [])
      
      // Add missing categories from itemEligibility
      categoriesFromItemEligibility.forEach(cat => {
        // Handle aliases: pant -> trouser, jacket -> blazer
        if (cat === 'pant') {
          existingCategories.add('trouser')
          existingCategories.add('pant')
        } else if (cat === 'jacket') {
          existingCategories.add('blazer')
          existingCategories.add('jacket')
        } else {
          existingCategories.add(cat)
        }
      })
      
      // Update if categories were added
      if (existingCategories.size > (plainObj.allowedProductCategories?.length || 0)) {
        plainObj.allowedProductCategories = Array.from(existingCategories)
        console.log(`✅ Fixed missing categories for ${plainObj.id}:`, {
          original: e.allowedProductCategories,
          fixed: plainObj.allowedProductCategories,
          fromItemEligibility: categoriesFromItemEligibility,
        })
      }
    }
    
    // Log after toPlainObject
    console.log('🔍 After toPlainObject:', {
      id: plainObj.id,
      hasItemEligibility: !!plainObj.itemEligibility,
      itemEligibilityKeys: plainObj.itemEligibility ? Object.keys(plainObj.itemEligibility) : 'none',
      itemEligibilityPlain: plainObj.itemEligibility ? JSON.stringify(plainObj.itemEligibility, null, 2) : 'none',
    })
    
    // DesignationProductEligibility.designation is now stored as PLAINTEXT (encryption removed)
    // No decryption needed - designation is already in plaintext format
    
    return plainObj
  })

  console.log(`📊 Returning ${decryptedEligibilities.length} eligibilities`)
  return decryptedEligibilities
}

export async function getDesignationEligibilityById(eligibilityId: string): Promise<any | null> {
  await connectDB()
  
  const eligibility = await DesignationProductEligibility.findOne({ id: eligibilityId })
    .populate('companyId', 'id name')
    .lean()

  if (!eligibility) return null

  // Convert to plain object first
  const plainObj = toPlainObject(eligibility)
  
  // DesignationProductEligibility.designation is now stored as PLAINTEXT (encryption removed)
  // No decryption needed

  return plainObj
}

export async function getDesignationEligibilityByDesignation(
  companyId: string, 
  designation: string, 
  gender?: 'male' | 'female'
): Promise<any | null> {
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) return null

  // DesignationProductEligibility.designation is now PLAINTEXT (encryption removed)
  // Employee.designation is ENCRYPTED (employee PII)
  // Strategy: Decrypt employee.designation, then match with plaintext eligibility.designation
  
  const { decrypt } = require('../utils/encryption')
  
  // Decrypt the input designation (from employee) for matching
  // The input designation comes from Employee.designation which is encrypted
  let decryptedDesignation: string = designation.trim()
  if (decryptedDesignation && typeof decryptedDesignation === 'string' && decryptedDesignation.includes(':')) {
    try {
      decryptedDesignation = decrypt(decryptedDesignation)
  } catch (error) {
      console.warn('Failed to decrypt employee designation for eligibility lookup:', error)
      // If decryption fails, try using as-is (might already be plaintext)
    }
  }
  
  // Normalize designation to lowercase for case-insensitive matching
  const normalizedDesignation = decryptedDesignation.trim().toLowerCase()

  // Build query filter - prioritize gender-specific rules, then 'unisex' rules
  const queryFilter: any = {
    companyId: company._id,
    status: 'active'
  }

  // Query with plaintext designation (DesignationProductEligibility.designation is now plaintext)
  // Try exact match first, then case-insensitive match
  let eligibility = await DesignationProductEligibility.findOne({ 
    ...queryFilter,
    designation: { $regex: new RegExp(`^${normalizedDesignation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
  })
    .populate('companyId', 'id name')
    .lean()

  // If not found with exact match, fetch all and match case-insensitively
  if (!eligibility) {
    const allEligibilities = await DesignationProductEligibility.find(queryFilter)
      .populate('companyId', 'id name')
      .lean()

    // Find matching eligibility (eligibility.designation is now plaintext, no decryption needed)
    // Priority: gender-specific first, then 'unisex'
    const matchingEligibilities: any[] = []
    for (const elig of allEligibilities) {
      const eligDesignation = (elig.designation as string) || ''
      // Match designation (case-insensitive) - no decryption needed (already plaintext)
      const normalizedEligDesignation = eligDesignation.trim().toLowerCase()
      if (normalizedEligDesignation && normalizedEligDesignation === normalizedDesignation) {
        const eligGender = elig.gender || 'unisex'
        matchingEligibilities.push({ ...elig, gender: eligGender })
      }
    }

    // Prioritize gender-specific rules over 'unisex'
    if (gender) {
      const genderSpecific = matchingEligibilities.find(e => e.gender === gender)
      if (genderSpecific) {
        eligibility = genderSpecific
      } else {
        // Fall back to 'unisex' if no gender-specific rule found
        eligibility = matchingEligibilities.find(e => e.gender === 'unisex' || !e.gender)
      }
    } else {
      // If no gender specified, prefer 'unisex', otherwise take first match
      eligibility = matchingEligibilities.find(e => e.gender === 'unisex' || !e.gender) || matchingEligibilities[0]
    }
  } else {
    // Check if gender matches (if gender is specified)
    if (gender && eligibility.gender && eligibility.gender !== 'unisex' && eligibility.gender !== gender) {
      // Gender doesn't match, try to find 'unisex' or matching gender rule
      const allEligibilities = await DesignationProductEligibility.find({
        companyId: company._id,
        status: 'active'
      })
        .populate('companyId', 'id name')
        .lean()
      
      for (const elig of allEligibilities) {
        const eligDesignation = (elig.designation as string) || ''
        // No decryption needed - eligibility.designation is now plaintext
        const normalizedEligDesignation = eligDesignation.trim().toLowerCase()
        if (normalizedEligDesignation && normalizedEligDesignation === normalizedDesignation) {
          const eligGender = elig.gender || 'unisex'
          if (eligGender === gender || eligGender === 'unisex') {
            eligibility = elig
            break
          }
        }
      }
    }
  }

  return eligibility || null
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
  await connectDB()
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }

  // Generate unique ID by finding the highest existing ID number
  let eligibilityId: string
  let attempts = 0
  const maxAttempts = 10
  
  while (attempts < maxAttempts) {
    // Find the highest existing ID
    const existingEligibilities = await DesignationProductEligibility.find({}, 'id')
      .sort({ id: -1 })
      .limit(1)
      .lean()
    
    let nextIdNumber = 1
    if (existingEligibilities.length > 0 && existingEligibilities[0].id) {
      const lastId = existingEligibilities[0].id as string
      const match = lastId.match(/^DESIG-ELIG-(\d+)$/)
      if (match) {
        nextIdNumber = parseInt(match[1], 10) + 1
      }
    }
    
    eligibilityId = `DESIG-ELIG-${String(nextIdNumber).padStart(6, '0')}`
    
    // Check if this ID already exists (race condition protection)
    const existing = await DesignationProductEligibility.findOne({ id: eligibilityId })
    if (!existing) {
      break // ID is available
    }
    
    // ID exists, try next number
    nextIdNumber++
    eligibilityId = `DESIG-ELIG-${String(nextIdNumber).padStart(6, '0')}`
    attempts++
  }
  
  if (attempts >= maxAttempts) {
    throw new Error('Failed to generate unique eligibility ID after multiple attempts')
  }

  // Structure itemEligibility to match schema exactly
  let structuredItemEligibility: any = undefined
  if (itemEligibility) {
    structuredItemEligibility = {}
    for (const [key, value] of Object.entries(itemEligibility)) {
      if (value && typeof value === 'object' && 'quantity' in value && 'renewalFrequency' in value) {
        // Preserve actual values - don't default to 0 if value is provided
        const qty = typeof value.quantity === 'number' ? value.quantity : (value.quantity ? Number(value.quantity) : 0)
        const freq = typeof value.renewalFrequency === 'number' ? value.renewalFrequency : (value.renewalFrequency ? Number(value.renewalFrequency) : 0)
        const unit = value.renewalUnit || 'months'
        
        structuredItemEligibility[key] = {
          quantity: qty,
          renewalFrequency: freq,
          renewalUnit: unit,
        }
        console.log(`  ✅ Structured ${key}: quantity=${qty}, frequency=${freq}, unit=${unit}`)
      }
    }
  }

  // Normalize category names function (same as in UI)
  const normalizeCategory = (cat: string): string => {
    if (!cat) return ''
    const lower = cat.toLowerCase().trim()
    if (lower.includes('shirt')) return 'shirt'
    if (lower.includes('trouser') || lower.includes('pant')) return 'trouser'
    if (lower.includes('shoe')) return 'shoe'
    if (lower.includes('blazer') || lower.includes('jacket')) return 'blazer'
    if (lower.includes('accessory')) return 'accessory'
    return lower
  }

  // Ensure allowedProductCategories includes all categories from itemEligibility
  // This ensures consistency - if itemEligibility has entries, they should be in allowedProductCategories
  const categoriesFromItemEligibility = structuredItemEligibility ? Object.keys(structuredItemEligibility) : []
  const normalizedAllowedCategories = new Set<string>()
  
  // Normalize and add categories from allowedProductCategories
  ;(allowedProductCategories || []).forEach(cat => {
    normalizedAllowedCategories.add(normalizeCategory(cat))
  })
  
  // Add normalized categories from itemEligibility that might be missing
  categoriesFromItemEligibility.forEach(cat => {
    // Normalize aliases: pant -> trouser, jacket -> blazer
    normalizedAllowedCategories.add(normalizeCategory(cat))
  })
  
  const finalAllowedCategories = Array.from(normalizedAllowedCategories)

  console.log('🔍 Creating new eligibility with itemEligibility:', {
    eligibilityId,
    designation,
    originalAllowedCategories: allowedProductCategories,
    categoriesFromItemEligibility,
    finalAllowedCategories,
    originalItemEligibility: itemEligibility ? JSON.stringify(itemEligibility, null, 2) : 'none',
    structuredItemEligibility: structuredItemEligibility ? JSON.stringify(structuredItemEligibility, null, 2) : 'none',
    gender: gender || 'unisex',
  })

  const eligibility = new DesignationProductEligibility({
    id: eligibilityId,
    companyId: company._id,
    companyName: company.name,
    designation: designation,
    gender: gender || 'unisex', // Use 'unisex' instead of 'all' to match model enum
    allowedProductCategories: finalAllowedCategories,
    itemEligibility: structuredItemEligibility,
    status: 'active',
  })
  
  console.log('🔍 Eligibility object created:', {
    itemEligibility: eligibility.itemEligibility ? JSON.stringify(eligibility.itemEligibility, null, 2) : 'none',
    itemEligibilityType: typeof eligibility.itemEligibility,
  })

  try {
    // Log before save
    console.log('🔍 Document state BEFORE save (create):', {
      itemEligibility: eligibility.itemEligibility ? JSON.stringify(eligibility.itemEligibility, null, 2) : 'none',
      isNew: eligibility.isNew,
    })
    
    await eligibility.save()
    console.log('✅ Eligibility document created successfully')
    
    // Log after save
    console.log('🔍 Document state AFTER save (create):', {
      itemEligibility: eligibility.itemEligibility ? JSON.stringify(eligibility.itemEligibility, null, 2) : 'none',
    })
    
    // Verify by fetching from DB
    const verifyCreated = await DesignationProductEligibility.findOne({ id: eligibilityId }).lean()
    if (verifyCreated) {
      console.log('✅ Verification - Created document from DB:', {
        id: verifyCreated.id,
        itemEligibility: verifyCreated.itemEligibility ? JSON.stringify(verifyCreated.itemEligibility, null, 2) : 'none',
      })
    }
  } catch (saveError: any) {
    console.error('❌ Error saving eligibility:', saveError)
    // If still a duplicate key error, try one more time with a higher ID
    if (saveError.code === 11000 && saveError.keyPattern?.id) {
      const existingEligibilities = await DesignationProductEligibility.find({}, 'id')
        .sort({ id: -1 })
        .limit(1)
        .lean()
      
      let nextIdNumber = 1
      if (existingEligibilities.length > 0 && existingEligibilities[0].id) {
        const lastId = existingEligibilities[0].id as string
        const match = lastId.match(/^DESIG-ELIG-(\d+)$/)
        if (match) {
          nextIdNumber = parseInt(match[1], 10) + 1
        }
      }
      
      eligibilityId = `DESIG-ELIG-${String(nextIdNumber).padStart(6, '0')}`
      eligibility.id = eligibilityId
      await eligibility.save()
      console.log('✅ Eligibility document created successfully after retry')
    } else {
      throw saveError
    }
  }
  
  // Fetch the created eligibility with proper decryption
  const createdEligibility = await getDesignationEligibilityById(eligibilityId)
  if (createdEligibility) {
    return createdEligibility
  }
  
  // Fallback: manually decrypt if fetch fails
  const plainObj = toPlainObject(eligibility)
  const { decrypt } = require('../utils/encryption')
  if (plainObj.designation && typeof plainObj.designation === 'string' && plainObj.designation.includes(':')) {
    try {
      plainObj.designation = decrypt(plainObj.designation)
    } catch (error: any) {
      console.error('Failed to decrypt designation after create:', error.message)
    }
  }
  return plainObj
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
  await connectDB()
  
  // Build update object
  const updateData: any = {}
  
  if (designation !== undefined) {
    // Designation will be encrypted by pre-save hook, so pass it as-is
    updateData.designation = designation
  }
  if (allowedProductCategories !== undefined) {
    updateData.allowedProductCategories = allowedProductCategories
  }
  if (itemEligibility !== undefined) {
    updateData.itemEligibility = itemEligibility
  }
  if (gender !== undefined) {
    updateData.gender = gender
  }
  if (status !== undefined) {
    updateData.status = status
  }

  console.log('Updating eligibility with data:', {
    eligibilityId,
    updateData: {
      ...updateData,
      itemEligibility: itemEligibility ? Object.keys(itemEligibility) : undefined,
    },
  })

  // Use findOneAndUpdate for atomic update
  // DesignationProductEligibility.designation is now stored as plaintext (encryption removed)
  // No encryption needed - store designation as-is

  // Log the actual update data being sent to MongoDB
  console.log('MongoDB update query:', {
    filter: { id: eligibilityId },
    update: { $set: updateData },
    itemEligibilityKeys: updateData.itemEligibility ? Object.keys(updateData.itemEligibility) : 'none',
    itemEligibilityFull: updateData.itemEligibility,
  })

  // Try using findOne + save approach to ensure pre-save hooks run and changes are detected
  const eligibility = await DesignationProductEligibility.findOne({ id: eligibilityId })
  if (!eligibility) {
    throw new Error(`Designation eligibility not found: ${eligibilityId}`)
  }

  // Structure itemEligibility first if provided
  let structuredItemEligibility: any = undefined
  if (itemEligibility !== undefined) {
    // Ensure the structure matches the schema exactly
    // The schema expects: { shirt?: {...}, trouser?: {...}, pant?: {...}, shoe?: {...}, blazer?: {...}, jacket?: {...} }
    structuredItemEligibility = {}
    for (const [key, value] of Object.entries(itemEligibility)) {
      if (value && typeof value === 'object' && 'quantity' in value && 'renewalFrequency' in value) {
        // Preserve actual values - don't default to 0 if value is provided
        const qty = typeof value.quantity === 'number' ? value.quantity : (value.quantity ? Number(value.quantity) : 0)
        const freq = typeof value.renewalFrequency === 'number' ? value.renewalFrequency : (value.renewalFrequency ? Number(value.renewalFrequency) : 0)
        const unit = value.renewalUnit || 'months'
        
        structuredItemEligibility[key] = {
          quantity: qty,
          renewalFrequency: freq,
          renewalUnit: unit,
        }
        console.log(`  ✅ Structured ${key}: quantity=${qty}, frequency=${freq}, unit=${unit}`)
      }
    }
  }

  // Ensure allowedProductCategories includes all categories from itemEligibility
  // This ensures consistency - if itemEligibility has entries, they should be in allowedProductCategories
  let finalAllowedCategories = allowedProductCategories
  if (allowedProductCategories !== undefined || structuredItemEligibility !== undefined) {
    const categoriesFromItemEligibility = structuredItemEligibility ? Object.keys(structuredItemEligibility) : []
    // Normalize category names function (same as in create)
    const normalizeCategory = (cat: string): string => {
      if (!cat) return ''
      const lower = cat.toLowerCase().trim()
      if (lower.includes('shirt')) return 'shirt'
      if (lower.includes('trouser') || lower.includes('pant')) return 'trouser'
      if (lower.includes('shoe')) return 'shoe'
      if (lower.includes('blazer') || lower.includes('jacket')) return 'blazer'
      if (lower.includes('accessory')) return 'accessory'
      return lower
    }

    const normalizedAllowedCategories = new Set<string>()
    
    // Normalize and add categories from allowedProductCategories or existing eligibility
    const categoriesToNormalize = allowedProductCategories || eligibility.allowedProductCategories || []
    categoriesToNormalize.forEach(cat => {
      normalizedAllowedCategories.add(normalizeCategory(cat))
    })
    
    // Add normalized categories from itemEligibility that might be missing
    categoriesFromItemEligibility.forEach(cat => {
      // Normalize aliases: pant -> trouser, jacket -> blazer
      normalizedAllowedCategories.add(normalizeCategory(cat))
    })
    
    finalAllowedCategories = Array.from(normalizedAllowedCategories)
  }

  // Update fields
  if (designation !== undefined) {
    eligibility.designation = designation // Stored as plaintext (encryption removed from DesignationProductEligibility)
  }
  if (finalAllowedCategories !== undefined) {
    eligibility.allowedProductCategories = finalAllowedCategories
    console.log('🔍 Updated allowedProductCategories:', finalAllowedCategories)
  }
  if (structuredItemEligibility !== undefined) {
    // MERGE with existing itemEligibility instead of replacing
    // This preserves categories that exist in DB but aren't in the current form
    const existingItemEligibility = eligibility.itemEligibility || {}
    const mergedItemEligibility = {
      ...existingItemEligibility, // Preserve existing categories
      ...structuredItemEligibility, // Override with new/updated categories
    }
    
    // Log what we're about to save
    console.log('🔍 Merging itemEligibility on eligibility document:', {
      before: eligibility.itemEligibility ? JSON.stringify(eligibility.itemEligibility, null, 2) : 'none',
      newValue: JSON.stringify(structuredItemEligibility, null, 2),
      merged: JSON.stringify(mergedItemEligibility, null, 2),
      existingKeys: Object.keys(existingItemEligibility),
      newKeys: Object.keys(structuredItemEligibility),
      mergedKeys: Object.keys(mergedItemEligibility),
    })
    
    // Use set() method to explicitly set the merged nested object
    eligibility.set('itemEligibility', mergedItemEligibility)
    // Mark as modified to ensure Mongoose saves it
    eligibility.markModified('itemEligibility')
    
    // Verify it was set
    console.log('🔍 After setting itemEligibility:', {
      eligibilityItemEligibility: eligibility.itemEligibility ? JSON.stringify(eligibility.itemEligibility, null, 2) : 'none',
      isModified: eligibility.isModified('itemEligibility'),
      type: typeof eligibility.itemEligibility,
      directAccess: eligibility.get('itemEligibility') ? JSON.stringify(eligibility.get('itemEligibility'), null, 2) : 'none',
    })
  }
  if (gender !== undefined) {
    eligibility.gender = gender
  }
  if (status !== undefined) {
    eligibility.status = status
  }

  // Save the document (designation is stored as plaintext - encryption removed)
  try {
    // Log the document state before save
    console.log('🔍 Document state BEFORE save:', {
      itemEligibility: eligibility.itemEligibility ? JSON.stringify(eligibility.itemEligibility, null, 2) : 'none',
      itemEligibilityType: typeof eligibility.itemEligibility,
      itemEligibilityKeys: eligibility.itemEligibility ? Object.keys(eligibility.itemEligibility) : [],
      isModified: eligibility.isModified('itemEligibility'),
      isNew: eligibility.isNew,
      documentId: eligibility._id,
    })
    
    await eligibility.save()
    console.log('✅ Eligibility document saved successfully using save() method')
    
    // Log the document state after save
    console.log('🔍 Document state AFTER save:', {
      itemEligibility: eligibility.itemEligibility ? JSON.stringify(eligibility.itemEligibility, null, 2) : 'none',
    })
  } catch (saveError: any) {
    console.error('❌ Error saving eligibility:', saveError)
    console.error('❌ Save error details:', {
      message: saveError.message,
      code: saveError.code,
      errors: saveError.errors,
      stack: saveError.stack,
    })
    throw new Error(`Failed to save eligibility: ${saveError.message}`)
  }

  const updated = eligibility
  
  // Verify the update was successful by fetching the document directly (without lean to get Mongoose document)
  const verifyUpdatedDoc = await DesignationProductEligibility.findOne({ id: eligibilityId })
  if (verifyUpdatedDoc) {
    console.log('✅ Verification - Updated document from DB (Mongoose doc):', {
      id: verifyUpdatedDoc.id,
      hasItemEligibility: !!verifyUpdatedDoc.itemEligibility,
      itemEligibilityKeys: verifyUpdatedDoc.itemEligibility ? Object.keys(verifyUpdatedDoc.itemEligibility) : 'none',
      itemEligibilityFull: verifyUpdatedDoc.itemEligibility ? JSON.stringify(verifyUpdatedDoc.itemEligibility, null, 2) : 'none',
    })
    
    // Log specific values to verify they were saved
    if (verifyUpdatedDoc.itemEligibility) {
      for (const [key, value] of Object.entries(verifyUpdatedDoc.itemEligibility)) {
        console.log(`  📊 ${key}:`, JSON.stringify(value, null, 2))
      }
    }
  }
  
  // Also verify with lean() to see what's actually in the database
  const verifyUpdated = await DesignationProductEligibility.findOne({ id: eligibilityId }).lean()
  if (verifyUpdated) {
    console.log('✅ Verification - Updated document from DB (lean):', {
      id: verifyUpdated.id,
      hasItemEligibility: !!verifyUpdated.itemEligibility,
      itemEligibilityKeys: verifyUpdated.itemEligibility ? Object.keys(verifyUpdated.itemEligibility) : 'none',
      itemEligibilityFull: verifyUpdated.itemEligibility ? JSON.stringify(verifyUpdated.itemEligibility, null, 2) : 'none',
      allowedCategories: verifyUpdated.allowedProductCategories,
      gender: verifyUpdated.gender,
    })
    
    // Log specific values to verify they were saved
    if (verifyUpdated.itemEligibility) {
      for (const [key, value] of Object.entries(verifyUpdated.itemEligibility)) {
        console.log(`  📊 ${key} (lean):`, JSON.stringify(value, null, 2))
      }
    }
  }

  // Fetch the updated eligibility with proper decryption
  // Use getDesignationEligibilityById to ensure proper decryption
  const updatedEligibility = await getDesignationEligibilityById(eligibilityId)
  if (!updatedEligibility) {
    // Fallback: manually decrypt if fetch fails
    const plainObj = toPlainObject(updated || verifyUpdated)
    const { decrypt } = require('../utils/encryption')
    if (plainObj && plainObj.designation && typeof plainObj.designation === 'string' && plainObj.designation.includes(':')) {
      try {
        plainObj.designation = decrypt(plainObj.designation)
      } catch (error: any) {
        console.error('Failed to decrypt designation after update:', error.message)
      }
    }
    return plainObj
  }
  
  console.log('✅ Returning updated eligibility with decrypted designation')
  
  // If refreshEligibility is true, update all employees with this designation
  if (refreshEligibility && updatedEligibility) {
    try {
      // Get company ID - handle both string ID and ObjectId
      let companyIdForRefresh: string | undefined
      if (updatedEligibility.companyId) {
        // If it's already a string ID, use it
        if (typeof updatedEligibility.companyId === 'string') {
          companyIdForRefresh = updatedEligibility.companyId
        } else if (typeof updatedEligibility.companyId === 'object' && updatedEligibility.companyId.id) {
          companyIdForRefresh = updatedEligibility.companyId.id
        }
      }
      
      // If still not found, get from eligibility document
      if (!companyIdForRefresh && eligibility && eligibility.companyId) {
        if (typeof eligibility.companyId === 'object') {
          const company = await Company.findById(eligibility.companyId)
          if (company) {
            companyIdForRefresh = company.id
          }
        } else {
          companyIdForRefresh = eligibility.companyId.toString()
        }
      }
      
      if (companyIdForRefresh) {
        // Check if company allows eligibility consumption reset
        const company = await Company.findOne({ id: companyIdForRefresh })
        const allowReset = company?.allowEligibilityConsumptionReset === true
        
        // Refresh employee eligibility
        await refreshEmployeeEligibilityForDesignation(
          companyIdForRefresh,
          updatedEligibility.designation || designation || '',
          updatedEligibility.gender || gender || 'unisex',
          updatedEligibility.itemEligibility || itemEligibility
        )
        console.log('✅ Successfully refreshed employee entitlements for designation')
        
        // If company allows reset, reset consumed eligibility for affected employees
        if (allowReset) {
          await resetConsumedEligibilityForDesignation(
            companyIdForRefresh,
            updatedEligibility.designation || designation || '',
            updatedEligibility.gender || gender || 'unisex',
            updatedEligibility.itemEligibility || itemEligibility
          )
          console.log('✅ Successfully reset consumed eligibility for designation')
        }
      } else {
        console.warn('⚠️ Could not determine company ID for refresh, skipping employee entitlement update')
      }
    } catch (error: any) {
      console.error('⚠️ Error refreshing employee entitlements:', error)
      // Don't fail the update if refresh fails, just log it
    }
  }
  
  return updatedEligibility
}

/**
 * Reset consumed eligibility for employees with a specific designation
 * This sets eligibilityResetDates for affected categories, effectively resetting consumed eligibility to 0
 */
async function resetConsumedEligibilityForDesignation(
  companyId: string,
  designation: string,
  gender: 'male' | 'female' | 'unisex',
  itemEligibility?: {
    shirt?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    trouser?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    pant?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    shoe?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    blazer?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    jacket?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
  }
): Promise<void> {
  await connectDB()
  
  if (!itemEligibility) {
    console.warn('No itemEligibility provided, skipping consumed eligibility reset')
    return
  }
  
  // Find company
  let company = await Company.findOne({ id: companyId })
  if (!company && mongoose.Types.ObjectId.isValid(companyId)) {
    company = await Company.findById(companyId)
  }
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }
  
  // DesignationProductEligibility.designation is now plaintext, but Employee.designation is encrypted
  // Strategy: Decrypt employee designations, then match with plaintext eligibility designations
  const { decrypt } = require('../utils/encryption')
  
  // Find all employees with this company
  const allEmployees = await Employee.find({ companyId: company._id })
    .lean()
  
  const matchingEmployees: any[] = []
  for (const emp of allEmployees) {
    let empDesignation = emp.designation
    if (empDesignation && typeof empDesignation === 'string' && empDesignation.includes(':')) {
      try {
        empDesignation = decrypt(empDesignation)
      } catch (error) {
        continue
      }
    }
    
    // Check if designation matches (case-insensitive)
    if (empDesignation && empDesignation.trim().toLowerCase() === designation.trim().toLowerCase()) {
      // Check gender filter
      if (gender === 'unisex' || !gender || emp.gender === gender) {
        matchingEmployees.push(emp)
      }
    }
  }
  
  if (matchingEmployees.length === 0) {
    console.log(`No employees found with designation "${designation}" and gender "${gender || 'all'}" for reset`)
    return
  }
  
  // Determine which categories need reset based on itemEligibility
  const resetCategories: string[] = []
  if (itemEligibility.shirt) resetCategories.push('shirt')
  if (itemEligibility.trouser || itemEligibility.pant) resetCategories.push('pant')
  if (itemEligibility.shoe) resetCategories.push('shoe')
  if (itemEligibility.blazer || itemEligibility.jacket) resetCategories.push('jacket')
  
  if (resetCategories.length === 0) {
    console.log('No categories to reset')
    return
  }
  
  // Current timestamp for reset dates
  const resetDate = new Date()
  
  // Update each matching employee's eligibilityResetDates
  for (const emp of matchingEmployees) {
    try {
      const employee = await Employee.findById(emp._id)
      if (!employee) continue
      
      // Initialize eligibilityResetDates if it doesn't exist
      if (!employee.eligibilityResetDates) {
        employee.eligibilityResetDates = {}
      }
      
      // Set reset date for each affected category
      for (const category of resetCategories) {
        (employee.eligibilityResetDates as any)[category] = resetDate
      }
      
      await employee.save()
      console.log(`✅ Reset consumed eligibility for employee ${employee.employeeId || employee.id} (categories: ${resetCategories.join(', ')})`)
    } catch (error: any) {
      console.error(`⚠️ Error resetting consumed eligibility for employee ${emp.employeeId || emp.id}:`, error.message)
      // Continue with other employees even if one fails
    }
  }
  
  console.log(`✅ Successfully reset consumed eligibility for ${matchingEmployees.length} employees with designation "${designation}"`)
}

/**
 * Refresh employee entitlements based on updated designation eligibility
 */
async function refreshEmployeeEligibilityForDesignation(
  companyId: string,
  designation: string,
  gender: 'male' | 'female' | 'unisex',
  itemEligibility?: {
    shirt?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    trouser?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    pant?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    shoe?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    blazer?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
    jacket?: { quantity: number; renewalFrequency: number; renewalUnit: 'months' | 'years' }
  }
): Promise<void> {
  await connectDB()
  
  if (!itemEligibility) {
    console.warn('No itemEligibility provided, skipping employee entitlement refresh')
    return
  }
  
  // Find company
  let company = await Company.findOne({ id: companyId })
  if (!company && mongoose.Types.ObjectId.isValid(companyId)) {
    company = await Company.findById(companyId)
  }
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }
  
  // DesignationProductEligibility.designation is now plaintext, but Employee.designation is encrypted
  // Strategy: Decrypt employee designations, then match with plaintext eligibility designations
  const { encrypt, decrypt } = require('../utils/encryption')
  
  // Find all employees with this company
  const allEmployees = await Employee.find({ companyId: company._id })
    .lean()
  
  // Filter employees by designation (case-insensitive, handling encryption)
  const matchingEmployees: any[] = []
  for (const emp of allEmployees) {
    let empDesignation = emp.designation
    if (empDesignation && typeof empDesignation === 'string' && empDesignation.includes(':')) {
      try {
        empDesignation = decrypt(empDesignation)
      } catch (error) {
        continue
      }
    }
    
    // Check if designation matches (case-insensitive)
    if (empDesignation && empDesignation.trim().toLowerCase() === designation.trim().toLowerCase()) {
      // Check gender filter
      if (gender === 'unisex' || !gender || emp.gender === gender) {
        matchingEmployees.push(emp)
      }
    }
  }
  
  if (matchingEmployees.length === 0) {
    console.log(`No employees found with designation "${designation}" and gender "${gender || 'all'}"`)
    return
  }
  
  // Calculate eligibility and cycle duration from itemEligibility
  // IMPORTANT: Start with a clean slate - reset all values to 0 first, then apply new values
  // This ensures that categories removed from designation eligibility are properly cleared
  const eligibility = {
    shirt: 0,
    pant: 0,
    shoe: 0,
    jacket: 0,
  }
  
  // Apply new eligibility values from itemEligibility (only for configured categories)
  if (itemEligibility.shirt) {
    eligibility.shirt = itemEligibility.shirt.quantity || 0
  }
  if (itemEligibility.trouser || itemEligibility.pant) {
    eligibility.pant = (itemEligibility.trouser?.quantity || itemEligibility.pant?.quantity || 0)
  }
  if (itemEligibility.shoe) {
    eligibility.shoe = itemEligibility.shoe.quantity || 0
  }
  if (itemEligibility.blazer || itemEligibility.jacket) {
    eligibility.jacket = (itemEligibility.blazer?.quantity || itemEligibility.jacket?.quantity || 0)
  }
  
  // Convert renewal frequency to months for cycle duration
  // IMPORTANT: Start with default values, then apply configured values
  const convertToMonths = (itemElig: any): number => {
    if (!itemElig) return 6 // Default
    if (itemElig.renewalUnit === 'years') {
      return itemElig.renewalFrequency * 12
    }
    return itemElig.renewalFrequency || 6
  }
  
  // Initialize with default cycle durations
  const cycleDuration = {
    shirt: 6, // Default
    pant: 6,  // Default
    shoe: 6,  // Default
    jacket: 12, // Default
  }
  
  // Apply configured cycle durations
  if (itemEligibility.shirt) {
    cycleDuration.shirt = convertToMonths(itemEligibility.shirt)
  }
  if (itemEligibility.trouser || itemEligibility.pant) {
    cycleDuration.pant = convertToMonths(itemEligibility.trouser || itemEligibility.pant)
  }
  if (itemEligibility.shoe) {
    cycleDuration.shoe = convertToMonths(itemEligibility.shoe)
  }
  if (itemEligibility.blazer || itemEligibility.jacket) {
    cycleDuration.jacket = convertToMonths(itemEligibility.blazer || itemEligibility.jacket)
  }
  
  console.log(`🔄 Refreshing entitlements for ${matchingEmployees.length} employees:`, {
    designation,
    gender: gender || 'all',
    eligibility,
    cycleDuration,
    note: 'All eligibility values reset to 0 first, then new values applied'
  })
  
  // Update all matching employees
  // IMPORTANT: Use a transaction-like approach - reset first, then apply new values
  let updatedCount = 0
  for (const emp of matchingEmployees) {
    try {
      const employee = await Employee.findById(emp._id)
      if (employee) {
        // STEP 1: Reset all eligibility fields to 0 (clear existing values)
        employee.eligibility = {
          shirt: 0,
          pant: 0,
          shoe: 0,
          jacket: 0,
        }
        
        // STEP 2: Reset cycle durations to defaults
        employee.cycleDuration = {
          shirt: 6,
          pant: 6,
          shoe: 6,
          jacket: 12,
        }
        
        // STEP 3: Apply new eligibility values (from current designation configuration)
        employee.eligibility = eligibility
        employee.cycleDuration = cycleDuration
        
        await employee.save()
        updatedCount++
        
        console.log(`✅ Updated employee ${emp.id || emp.employeeId}:`, {
          eligibility: employee.eligibility,
          cycleDuration: employee.cycleDuration,
        })
      }
    } catch (error: any) {
      console.error(`Error updating employee ${emp.id}:`, error)
    }
  }
  
  console.log(`✅ Successfully updated entitlements for ${updatedCount} out of ${matchingEmployees.length} employees`)
}

export async function deleteDesignationEligibility(eligibilityId: string): Promise<void> {
  await connectDB()
  
  await DesignationProductEligibility.deleteOne({ id: eligibilityId })
}

export async function getProductsForDesignation(
  companyId: string, 
  designation: string, 
  gender?: 'male' | 'female'
): Promise<any[]> {
  await connectDB()
  
  console.log(`getProductsForDesignation: companyId=${companyId}, designation="${designation}", gender="${gender || 'all'}"`)
  
  // Get all products for the company
  const companyProducts = await getProductsByCompany(companyId)
  console.log(`getProductsForDesignation: Found ${companyProducts.length} company products`)
  
  // If no designation provided, still filter by gender if specified
  if (!designation || designation.trim().length === 0) {
    if (gender) {
      // Filter by product gender even without designation
      const genderFiltered = companyProducts.filter((product: any) => {
        const productGender = product.gender || 'unisex'
        return productGender === gender || productGender === 'unisex'
      })
      console.log(`getProductsForDesignation: No designation provided, returning ${genderFiltered.length} products filtered by gender (${gender})`)
      return genderFiltered
    }
    console.log('getProductsForDesignation: No designation provided, returning all company products')
    return companyProducts
  }
  
  // Get designation eligibility (with gender filter)
  const eligibility = await getDesignationEligibilityByDesignation(companyId, designation.trim(), gender)
  
  if (!eligibility || !eligibility.allowedProductCategories || eligibility.allowedProductCategories.length === 0) {
    // If no eligibility rules, still filter by gender if specified (backward compatibility)
    if (gender) {
      const genderFiltered = companyProducts.filter((product: any) => {
        const productGender = product.gender || 'unisex'
        return productGender === gender || productGender === 'unisex'
      })
      console.log(`getProductsForDesignation: No eligibility rules found for designation "${designation}", returning ${genderFiltered.length} products filtered by gender (${gender})`)
      return genderFiltered
    }
    console.log(`getProductsForDesignation: No eligibility rules found for designation "${designation}", returning all company products`)
    return companyProducts
  }

  console.log(`getProductsForDesignation: Found eligibility rule with categories:`, eligibility.allowedProductCategories)
  console.log(`getProductsForDesignation: Eligibility itemEligibility keys:`, eligibility.itemEligibility ? Object.keys(eligibility.itemEligibility) : 'none')

  // Filter products by allowed categories
  // Normalize category names (handle variations like "shirt"/"shirts", "trouser"/"trousers"/"pant"/"pants")
  // IMPORTANT: Must match the normalization used in createDesignationEligibility and updateDesignationEligibility
  const normalizeCategory = (cat: string): string => {
    if (!cat) return ''
    const lower = cat.toLowerCase().trim()
    if (lower.includes('shirt')) return 'shirt'
    if (lower.includes('trouser') || lower.includes('pant')) return 'trouser'
    if (lower.includes('shoe')) return 'shoe'
    if (lower.includes('blazer') || lower.includes('jacket')) return 'blazer'
    if (lower.includes('accessory')) return 'accessory' // Explicitly handle accessory category
    return lower
  }

  // Build allowed categories from BOTH allowedProductCategories AND itemEligibility keys
  // This ensures that if itemEligibility has categories defined, they're included even if not in allowedProductCategories
  const allowedCategoriesSet = new Set<string>()
  
  // Add categories from allowedProductCategories
  if (eligibility.allowedProductCategories && eligibility.allowedProductCategories.length > 0) {
    eligibility.allowedProductCategories.forEach(cat => {
      allowedCategoriesSet.add(normalizeCategory(cat))
    })
  }
  
  // Also add categories from itemEligibility keys (if itemEligibility exists)
  // This handles cases where itemEligibility has categories but allowedProductCategories is incomplete
  if (eligibility.itemEligibility && typeof eligibility.itemEligibility === 'object') {
    Object.keys(eligibility.itemEligibility).forEach(key => {
      // Normalize itemEligibility keys (handle aliases: pant -> trouser, jacket -> blazer)
      const normalizedKey = normalizeCategory(key)
      allowedCategoriesSet.add(normalizedKey)
    })
  }
  
  const allowedCategories = Array.from(allowedCategoriesSet)
  console.log(`getProductsForDesignation: Normalized allowed categories (from both sources):`, allowedCategories)
  
  const filteredProducts = companyProducts.filter((product: any) => {
    // Filter by category
    const productCategory = normalizeCategory(product.category || product.name || '')
    const isCategoryAllowed = allowedCategories.includes(productCategory)
    
    // Filter by product gender
    // If employee gender is specified, show products matching their gender or 'unisex'
    // If no employee gender specified, show all products
    let isGenderAllowed = true
    if (gender) {
      const productGender = product.gender || 'unisex'
      isGenderAllowed = productGender === gender || productGender === 'unisex'
    }
    
    const isAllowed = isCategoryAllowed && isGenderAllowed
    if (!isAllowed) {
      if (!isCategoryAllowed) {
        console.log(`getProductsForDesignation: Filtered out product "${product.name}" (category: ${productCategory} not allowed)`)
      } else if (!isGenderAllowed) {
        console.log(`getProductsForDesignation: Filtered out product "${product.name}" (gender: ${product.gender} doesn't match employee gender: ${gender})`)
      }
    }
    return isAllowed
  })

  console.log(`getProductsForDesignation: Returning ${filteredProducts.length} filtered products out of ${companyProducts.length} total (filtered by category and gender)`)
  return filteredProducts
}

// ========== PRODUCT FEEDBACK FUNCTIONS ==========

/**
 * Create product feedback
 * @param feedbackData Feedback data
 * @returns Created feedback
 */
export async function createProductFeedback(feedbackData: {
  orderId: string
  productId: string
  employeeId: string
  companyId: string
  vendorId?: string
  rating: number
  comment?: string
}): Promise<any> {
  await connectDB()
  
  // Get employee
  const employee = await Employee.findOne({
    $or: [
      { employeeId: feedbackData.employeeId },
      { id: feedbackData.employeeId }
    ]
  }).lean()
  
  if (!employee) {
    throw new Error(`Employee not found: ${feedbackData.employeeId}`)
  }
  
  // Get company
  const company = await Company.findOne({
    $or: [
      { id: feedbackData.companyId },
      { _id: mongoose.Types.ObjectId.isValid(feedbackData.companyId) ? new mongoose.Types.ObjectId(feedbackData.companyId) : null }
    ]
  }).lean()
  
  if (!company) {
    throw new Error(`Company not found: ${feedbackData.companyId}`)
  }
  
  // Get order to verify it belongs to employee and is delivered
  // Handle both parent order IDs and split order IDs
  let order = await Order.findOne({ id: feedbackData.orderId }).lean()
  let isParentOrder = false
  
  // If found order has a parentOrderId, it's a child order (split order)
  // If found order doesn't have parentOrderId but has split orders, it's a parent
  if (order && !order.parentOrderId) {
    // Check if this is a parent order with split children
    const splitOrders = await Order.find({ parentOrderId: feedbackData.orderId }).lean()
    if (splitOrders.length > 0) {
      // This is a parent order, find the specific split order that contains the product
      isParentOrder = true
      for (const splitOrder of splitOrders) {
        const hasProduct = splitOrder.items?.some((item: any) => {
          const itemProductId = item.productId || (item.uniformId?.toString()) || (item.uniformId?.id)
          return itemProductId === feedbackData.productId
        })
        if (hasProduct) {
          order = splitOrder
          console.log(`[createProductFeedback] Found split child order for product:`, {
            parentOrderId: feedbackData.orderId,
            childOrderId: splitOrder.id,
            childOrderStatus: splitOrder.status,
            productId: feedbackData.productId
          })
          break
        }
      }
    }
  }
  
  // If not found, check if it's a parent order ID and find the specific split order
  if (!order && feedbackData.orderId.startsWith('ORD-')) {
    // Check if this looks like a split order ID (has format: ORD-timestamp-vendorId)
    // If it contains a dash after the timestamp, it might be a split order
    const parts = feedbackData.orderId.split('-')
    if (parts.length >= 3) {
      // This is likely a split order ID, try exact match again with trimmed ID
      const trimmedId = feedbackData.orderId.trim()
      order = await Order.findOne({ id: trimmedId }).lean()
    }
    
    // If still not found, try to find split orders with this as parentOrderId
    if (!order) {
      const splitOrders = await Order.find({ parentOrderId: feedbackData.orderId }).lean()
      
      if (splitOrders.length > 0) {
        // Find the specific split order that contains the product
        for (const splitOrder of splitOrders) {
          const hasProduct = splitOrder.items?.some((item: any) => {
            const itemProductId = item.productId || (item.uniformId?.toString()) || (item.uniformId?.id)
            return itemProductId === feedbackData.productId
          })
          if (hasProduct) {
            order = splitOrder
            console.log(`[createProductFeedback] Found split child order (fallback):`, {
              parentOrderId: feedbackData.orderId,
              childOrderId: splitOrder.id,
              childOrderStatus: splitOrder.status,
              productId: feedbackData.productId
            })
            break
          }
        }
      }
    }
  }
  
  if (!order) {
    console.error(`[createProductFeedback] Order not found:`, {
      orderId: feedbackData.orderId,
      productId: feedbackData.productId,
      employeeId: feedbackData.employeeId,
      employeeIdStr: employee._id?.toString()
    })
    throw new Error(`Order not found: ${feedbackData.orderId}. Please ensure the order is delivered and belongs to you.`)
  }
  
  console.log(`[createProductFeedback] Order found:`, {
    orderId: order.id,
    status: order.status,
    statusType: typeof order.status,
    parentOrderId: order.parentOrderId,
    isSplitOrder: !!order.parentOrderId,
    itemCount: order.items?.length
  })
  
  // Verify order belongs to employee
  const employeeIdStr = (employee._id || employee.id).toString()
  const orderEmployeeIdStr = order.employeeId?.toString()
  
  // Handle both ObjectId and string comparisons
  const employeeObjectId = employee._id || (mongoose.Types.ObjectId.isValid(employee.id) ? new mongoose.Types.ObjectId(employee.id) : null)
  const orderEmployeeObjectId = order.employeeId || (order.employeeId && mongoose.Types.ObjectId.isValid(order.employeeId) ? new mongoose.Types.ObjectId(order.employeeId) : null)
  
  const employeeMatches = 
    employeeIdStr === orderEmployeeIdStr ||
    (employeeObjectId && orderEmployeeObjectId && employeeObjectId.equals(orderEmployeeObjectId)) ||
    (order.employeeIdNum && (order.employeeIdNum === employee.employeeId || order.employeeIdNum === employee.id))
  
  if (!employeeMatches) {
    console.error(`[createProductFeedback] Order employee mismatch:`, {
      orderId: order.id,
      orderEmployeeId: orderEmployeeIdStr,
      orderEmployeeIdNum: order.employeeIdNum,
      employeeId: employeeIdStr,
      employeeIdNum: employee.employeeId || employee.id
    })
    throw new Error('Order does not belong to employee')
  }
  
  // Verify order is delivered
  // Normalize status: trim whitespace and handle case variations
  const normalizedStatus = order.status?.toString().trim()
  const isDelivered = normalizedStatus === 'Delivered' || normalizedStatus?.toLowerCase() === 'delivered'
  
  console.log(`[createProductFeedback] Order status check:`, {
    orderId: order.id,
    rawStatus: order.status,
    normalizedStatus: normalizedStatus,
    isDelivered: isDelivered,
    statusType: typeof order.status
  })
  
  if (!isDelivered) {
    console.error(`[createProductFeedback] Order status validation failed:`, {
      orderId: order.id,
      status: order.status,
      normalizedStatus: normalizedStatus,
      expected: 'Delivered',
      allOrderFields: Object.keys(order)
    })
    throw new Error(`Feedback can only be submitted for delivered orders. Current order status: "${order.status || 'Unknown'}"`)
  }
  
  // Verify product is in order
  const orderItem = order.items?.find((item: any) => {
    const itemProductId = item.productId || (item.uniformId?.toString()) || (item.uniformId?.id) || (typeof item.uniformId === 'object' && item.uniformId?.id)
    return itemProductId === feedbackData.productId
  })
  
  if (!orderItem) {
    console.error(`[createProductFeedback] Product not found in order:`, {
      orderId: order.id,
      productId: feedbackData.productId,
      orderItems: order.items?.map((item: any) => ({
        productId: item.productId,
        uniformId: item.uniformId?.toString(),
        uniformName: item.uniformName
      }))
    })
    throw new Error(`Product not found in order. Please ensure you're submitting feedback for a product in this order.`)
  }
  
  // Get uniform/product
  const uniform = await Uniform.findOne({
    $or: [
      { id: feedbackData.productId },
      { _id: mongoose.Types.ObjectId.isValid(feedbackData.productId) ? new mongoose.Types.ObjectId(feedbackData.productId) : null }
    ]
  }).lean()
  
  // Use the actual order ID (might be a split order child ID)
  const actualOrderId = order.id
  
  // Check if feedback already exists for this order+product+employee combination
  // This ensures one feedback per product per order per employee
  const existingFeedback = await ProductFeedback.findOne({
    orderId: actualOrderId,
    productId: feedbackData.productId,
    employeeId: employee._id
  }).lean()
  
  if (existingFeedback) {
    throw new Error('Feedback already submitted for this product')
  }
  
  // Get vendorId - try from order first, then from ProductVendor relationship
  let vendorId: mongoose.Types.ObjectId | undefined = undefined
  
  if (order.vendorId) {
    // VendorId exists in order
    vendorId = typeof order.vendorId === 'object' 
      ? order.vendorId 
      : new mongoose.Types.ObjectId(order.vendorId)
    console.log(`[createProductFeedback] Using vendorId from order: ${vendorId}`)
  } else if (uniform?._id) {
    // Try to get vendorId from ProductVendor relationship
    const db = mongoose.connection.db
    if (db) {
      const productVendorLink = await db.collection('productvendors').findOne({ 
        productId: uniform._id 
      })
      
      if (productVendorLink && productVendorLink.vendorId) {
        vendorId = typeof productVendorLink.vendorId === 'object'
          ? productVendorLink.vendorId
          : new mongoose.Types.ObjectId(productVendorLink.vendorId)
        console.log(`[createProductFeedback] Using vendorId from ProductVendor relationship: ${vendorId}`)
      } else {
        console.warn(`[createProductFeedback] No vendorId found in order or ProductVendor relationship for product: ${feedbackData.productId}`)
      }
    }
  }
  
  // Create feedback
  const feedback = new ProductFeedback({
    orderId: actualOrderId,
    productId: feedbackData.productId,
    uniformId: uniform?._id,
    employeeId: employee._id,
    employeeIdNum: employee.employeeId || employee.id,
    companyId: company._id,
    companyIdNum: typeof company.id === 'string' ? parseInt(company.id) : company.id,
    vendorId: vendorId,
    rating: feedbackData.rating,
    comment: feedbackData.comment || undefined,
  })
  
  await feedback.save()
  return toPlainObject(feedback)
}

/**
 * Get feedback with role-based access control
 * @param userEmail User email
 * @param filters Optional filters (orderId, productId, employeeId, companyId, vendorId)
 * @returns Array of feedback
 */
export async function getProductFeedback(
  userEmail: string,
  filters?: {
    orderId?: string
    productId?: string
    employeeId?: string
    companyId?: string
    vendorId?: string
  }
): Promise<any[]> {
  try {
    await connectDB()
  } catch (error: any) {
    console.error('[getProductFeedback] Database connection error:', error.message)
    throw new Error(`Database connection failed: ${error.message}`)
  }
  
  // Find user by email
  const { encrypt, decrypt } = require('../utils/encryption')
  const trimmedEmail = userEmail.trim()
  let encryptedEmail: string
  
  try {
    encryptedEmail = encrypt(trimmedEmail)
  } catch (error) {
    encryptedEmail = ''
  }
  
  // FIRST: Check if user is a Company Admin (most privileged role)
  // This must be checked BEFORE employee lookup to handle edge cases
  console.log(`[getProductFeedback] Checking Company Admin status first for: ${trimmedEmail}`)
  const db = mongoose.connection.db
  let companyId: string | null = null
  let isCompanyAdminUser = false
  let employee: any = null
  
  // Get all companies and check if user is admin of any
  const allCompanies = await Company.find({}).lean()
  for (const company of allCompanies) {
    const adminCheck = await isCompanyAdmin(trimmedEmail, company.id)
    if (adminCheck) {
      companyId = company.id
      isCompanyAdminUser = true
      console.log(`[getProductFeedback] ✅ Found Company Admin - email: ${trimmedEmail}, companyId: ${companyId}, companyName: ${company.name}`)
      
      // Get employee record from CompanyAdmin
      const adminRecords = await db.collection('companyadmins').find({ 
        companyId: company._id 
      }).toArray()
      
      // Find the admin record that matches this email
      for (const adminRecord of adminRecords) {
        if (adminRecord.employeeId) {
          const emp = await Employee.findById(adminRecord.employeeId).lean()
          if (emp) {
            // Verify this employee's email matches
            let empEmailMatches = false
            if (emp.email === encryptedEmail) {
              empEmailMatches = true
            } else if (emp.email) {
              try {
                const decryptedEmpEmail = decrypt(emp.email)
                if (decryptedEmpEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
                  empEmailMatches = true
                }
              } catch (error) {
                // Continue checking
              }
            }
            
            if (empEmailMatches) {
              employee = emp
              console.log(`[getProductFeedback] Found employee record for Company Admin - employeeId: ${employee._id}`)
              break
            }
          }
        }
      }
      break
    }
  }
  
  // If not Company Admin, check if user is a vendor
  if (!isCompanyAdminUser) {
    const vendor = await Vendor.findOne({ email: trimmedEmail }).lean()
    if (vendor) {
      // Vendor can see feedback for their products
      const query: any = {}
      if (filters?.vendorId) {
        query.vendorId = mongoose.Types.ObjectId.isValid(filters.vendorId) ? new mongoose.Types.ObjectId(filters.vendorId) : null
      } else {
        query.vendorId = vendor._id
      }
      if (filters?.productId) {
        query.productId = filters.productId
      }
      
      const feedback = await ProductFeedback.find(query)
        .populate('employeeId', 'id employeeId firstName lastName')
        .populate('companyId', 'id name')
        .populate('uniformId', 'id name')
        .populate('vendorId', 'id name')
        .sort({ createdAt: -1 })
        .lean()
      
      return feedback.map((f: any) => toPlainObject(f))
    }
  }
  
  // If not Company Admin and not Vendor, try to find as employee
  if (!employee && !isCompanyAdminUser) {
    // Try finding with encrypted email first
    employee = await Employee.findOne({ email: encryptedEmail }).lean()
    
    // If not found, try decryption matching
    if (!employee && encryptedEmail) {
      const allEmployees = await Employee.find({}).lean()
      for (const emp of allEmployees) {
        if (emp.email && typeof emp.email === 'string') {
          try {
            const decryptedEmail = decrypt(emp.email)
            if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
              employee = emp
              break
            }
          } catch (error) {
            continue
          }
        }
      }
    }
    
    if (!employee) {
      throw new Error('User not found')
    }
    
    // Employee found - get companyId and check if Company Admin
    const employeeIdStr = (employee._id || employee.id).toString()
    companyId = employee.companyId ? (typeof employee.companyId === 'object' ? employee.companyId.id : employee.companyId) : null
    
    // If companyId is an ObjectId string, try to find the company by _id and get its id
    if (companyId && typeof companyId === 'string' && mongoose.Types.ObjectId.isValid(companyId) && companyId.length === 24) {
      const companyForIdConversion = await Company.findById(companyId).select('id').lean()
      if (companyForIdConversion) {
        companyId = companyForIdConversion.id
        console.log(`[getProductFeedback] Converted ObjectId companyId to string ID: ${companyId}`)
      }
    }
    
    // Check if Company Admin
    if (companyId) {
      isCompanyAdminUser = await isCompanyAdmin(trimmedEmail, companyId)
      console.log(`[getProductFeedback] Company Admin check - email: ${trimmedEmail}, companyId: ${companyId}, isAdmin: ${isCompanyAdminUser}`)
    } else {
      console.warn(`[getProductFeedback] No companyId found for employee: ${employeeIdStr}`)
    }
  }
  
  // Check if Location Admin
  const location = await getLocationByAdminEmail(trimmedEmail)
  const isLocationAdminUser = !!location
  let locationEmployees: any[] = [] // Store for debugging later
  
  // Build query based on role
  const query: any = {}
  
  if (isCompanyAdminUser && companyId) {
    // Company Admin can see all feedback for their company
    console.log(`[getProductFeedback] Processing Company Admin request - companyId: ${companyId}, email: ${trimmedEmail}`)
    
    const companyForAdmin = await Company.findOne({ id: companyId }).lean()
    if (companyForAdmin) {
      query.companyId = companyForAdmin._id
      console.log(`[getProductFeedback] Company Admin query - companyId: ${companyId}, company._id: ${companyForAdmin._id}, company.name: ${companyForAdmin.name}`)
    } else {
      console.error(`[getProductFeedback] Company not found for Company Admin - companyId: ${companyId}`)
      // Try alternative lookup methods
      const companyByObjectId = mongoose.Types.ObjectId.isValid(companyId) 
        ? await Company.findById(companyId).lean()
        : null
      if (companyByObjectId) {
        query.companyId = companyByObjectId._id
        console.log(`[getProductFeedback] Found company by ObjectId lookup - companyId: ${companyByObjectId.id}, name: ${companyByObjectId.name}`)
      } else {
        // Last resort: Find company by checking CompanyAdmin records
        console.log(`[getProductFeedback] Trying to find company via CompanyAdmin records...`)
        const db = mongoose.connection.db
        const employeeIdStr = employee._id.toString()
        const adminRecords = await db.collection('companyadmins').find({ 
          employeeId: employee._id 
        }).toArray()
        
        if (adminRecords.length > 0) {
          const adminRecord = adminRecords[0]
          const companyFromAdmin = await Company.findById(adminRecord.companyId).lean()
          if (companyFromAdmin) {
            query.companyId = companyFromAdmin._id
            companyId = companyFromAdmin.id
            console.log(`[getProductFeedback] Found company via CompanyAdmin record - companyId: ${companyId}, name: ${companyFromAdmin.name}`)
          } else {
            console.error(`[getProductFeedback] Company not found by any method - returning empty array`)
            return []
          }
        } else {
          console.error(`[getProductFeedback] No CompanyAdmin records found for employee - returning empty array`)
          return []
        }
      }
    }
    if (filters?.orderId) {
      query.orderId = filters.orderId
    }
    if (filters?.productId) {
      query.productId = filters.productId
    }
    if (filters?.employeeId) {
      const filterEmployee = await Employee.findOne({
        $or: [
          { employeeId: filters.employeeId },
          { id: filters.employeeId }
        ]
      }).lean()
      if (filterEmployee) {
        query.employeeId = filterEmployee._id
      }
    }
    
    // IMPORTANT: Also match by companyIdNum as fallback
    // Some feedback records may have companyId as ObjectId but companyIdNum matches
    // Get companyForAdmin from the variable scope (might be set in the if/else above)
    let companyForQuery = companyForAdmin
    if (!companyForQuery && query.companyId) {
      // Try to find company by the _id we're querying
      companyForQuery = await Company.findById(query.companyId).lean()
    }
    
    if (companyForQuery && companyForQuery.id && query.companyId) {
      const companyIdNum = typeof companyForQuery.id === 'string' 
        ? parseInt(companyForQuery.id) 
        : companyForQuery.id
      
      // Use $or to match either by companyId ObjectId OR companyIdNum
      const companyIdObjectId = query.companyId
      query.$or = [
        { companyId: companyIdObjectId },
        { companyIdNum: companyIdNum }
      ]
      // Remove the direct companyId since we're using $or
      delete query.companyId
      console.log(`[getProductFeedback] Using $or query to match by companyId ObjectId OR companyIdNum:`, {
        companyIdObjectId: companyIdObjectId.toString(),
        companyIdNum: companyIdNum
      })
    }
  } else if (isLocationAdminUser && location) {
    // Location Admin can see feedback only if setting is enabled
    console.log(`[getProductFeedback] 🔍 Location Admin detected - location:`, {
      locationId: location.id,
      locationName: location.name,
      locationCompanyId: location.companyId,
      locationCompanyIdType: typeof location.companyId,
      locationCompanyIdId: location.companyId?.id,
      locationCompanyId_id: location.companyId?._id?.toString()
    })
    
    // Get company ID from location - handle both populated and non-populated cases
    let locationCompanyIdStr: string | null = null
    if (location.companyId) {
      if (typeof location.companyId === 'object' && location.companyId !== null) {
        // Populated company object
        locationCompanyIdStr = location.companyId.id || null
      } else if (typeof location.companyId === 'string') {
        // Check if it's a company ID string (6-digit) or ObjectId string (24 hex)
        if (/^\d{6}$/.test(location.companyId)) {
          locationCompanyIdStr = location.companyId
        } else if (mongoose.Types.ObjectId.isValid(location.companyId)) {
          // It's an ObjectId - need to find company
          const companyByObjectId = await Company.findById(location.companyId).select('id').lean()
          locationCompanyIdStr = companyByObjectId?.id || null
        }
      }
    }
    
    if (!locationCompanyIdStr) {
      console.error(`[getProductFeedback] ❌ Could not determine company ID from location`)
      return []
    }
    
    console.log(`[getProductFeedback] 🔍 Location company ID: ${locationCompanyIdStr}`)
    
    // Get company and check setting
    const companyForLocationAdmin = await Company.findOne({ id: locationCompanyIdStr }).lean()
    if (!companyForLocationAdmin) {
      console.error(`[getProductFeedback] ❌ Company not found for Location Admin - companyId: ${locationCompanyIdStr}`)
      return []
    }
    
    console.log(`[getProductFeedback] 🔍 Company found: ${companyForLocationAdmin.name} (${companyForLocationAdmin.id})`)
    console.log(`[getProductFeedback] 🔍 allowLocationAdminViewFeedback setting:`, companyForLocationAdmin.allowLocationAdminViewFeedback)
    
    if (!companyForLocationAdmin.allowLocationAdminViewFeedback) {
      // Setting is OFF - return empty array
      console.log(`[getProductFeedback] ❌ Location Admin access denied - setting is OFF`)
      return []
    }
    
    // Setting is ON - Location Admin can see feedback ONLY for employees in their location
    console.log(`[getProductFeedback] ✅ Location Admin access granted - filtering by location: ${location.id} (${location.name})`)
    
    // Get location ObjectId - location from getLocationByAdminEmail should have _id
    let locationObjectId = null
    if (location._id) {
      locationObjectId = typeof location._id === 'string' ? new mongoose.Types.ObjectId(location._id) : location._id
    } else if (location.id) {
      // If _id is not present, find location by id to get _id
      const locationDoc = await Location.findOne({ id: location.id }).select('_id').lean()
      if (locationDoc && locationDoc._id) {
        locationObjectId = locationDoc._id
      }
    }
    
    if (!locationObjectId) {
      console.error(`[getProductFeedback] ❌ Location has no _id or id - cannot filter employees. Location:`, location)
      return []
    }
    
    console.log(`[getProductFeedback] 🔍 Location ObjectId: ${locationObjectId.toString()}`)
    
    // Find all employees in this location using location ObjectId
    locationEmployees = await Employee.find({ locationId: locationObjectId })
      .select('_id employeeId id firstName lastName')
      .lean()
    
    console.log(`[getProductFeedback] 🔍 Found ${locationEmployees.length} employees in location ${location.id} (${location.name})`)
    
    if (locationEmployees.length === 0) {
      // No employees in this location - return empty array
      console.log(`[getProductFeedback] ⚠️ No employees found in location - returning empty array`)
      return []
    }
    
    // Log employee details for debugging
    const { decrypt } = require('../utils/encryption')
    console.log(`[getProductFeedback] 🔍 Employees in location:`)
    locationEmployees.slice(0, 5).forEach((emp: any) => {
      let firstName = emp.firstName
      let lastName = emp.lastName
      try {
        firstName = decrypt(firstName)
        lastName = decrypt(lastName)
      } catch (e) {
        // Not encrypted
      }
      console.log(`  - ${firstName} ${lastName} (${emp.employeeId || emp.id}) - locationId: ${emp.locationId?.toString() || 'none'}`)
    })
    
    // Get employee ObjectIds
    const employeeObjectIds = locationEmployees.map((e: any) => e._id)
    
    // Filter feedback to only include feedback from employees in this location
    // IMPORTANT: Use $in for employeeId to match multiple employees
    query.employeeId = { $in: employeeObjectIds }
    // Also filter by company to ensure we only get feedback for this company
    query.companyId = companyForLocationAdmin._id
    
    // Remove any $or that might have been set earlier (for Company Admin)
    if (query.$or) {
      delete query.$or
    }
    
    if (filters?.orderId) {
      query.orderId = filters.orderId
    }
    if (filters?.productId) {
      query.productId = filters.productId
    }
    
    // IMPORTANT: Also match by companyIdNum as fallback (similar to Company Admin)
    // Some feedback records may have companyId as ObjectId but companyIdNum matches
    const companyIdNum = typeof companyForLocationAdmin.id === 'string' 
      ? parseInt(companyForLocationAdmin.id) 
      : companyForLocationAdmin.id
    
    // Use $or to match either by companyId ObjectId OR companyIdNum
    // But keep employeeId filter separate (not in $or)
    const companyIdObjectId = companyForLocationAdmin._id
    query.$or = [
      { companyId: companyIdObjectId },
      { companyIdNum: companyIdNum }
    ]
    // Remove the direct companyId since we're using $or
    delete query.companyId
    
    console.log(`[getProductFeedback] ✅ Location Admin query built with $or:`, {
      location: location.id,
      locationName: location.name,
      employeeCount: employeeObjectIds.length,
      companyIdObjectId: companyIdObjectId.toString(),
      companyIdNum: companyIdNum,
      companyName: companyForLocationAdmin.name,
      employeeObjectIds: employeeObjectIds.map((id: any) => id.toString()).slice(0, 3),
      queryStructure: {
        employeeId: '$in with ' + employeeObjectIds.length + ' employees',
        $or: 'companyId ObjectId OR companyIdNum'
      }
    })
  } else {
    // Regular employee can only see their own feedback
    query.employeeId = employee._id
    if (filters?.orderId) {
      query.orderId = filters.orderId
    }
    if (filters?.productId) {
      query.productId = filters.productId
    }
  }
  
  // Convert ObjectId in query to ensure proper matching
  if (query.companyId && typeof query.companyId === 'object') {
    // Already an ObjectId, keep it
  } else if (query.companyId && typeof query.companyId === 'string' && mongoose.Types.ObjectId.isValid(query.companyId)) {
    query.companyId = new mongoose.Types.ObjectId(query.companyId)
  }
  
  // Ensure query is not empty
  const hasQueryParams = Object.keys(query).length > 0
  if (!hasQueryParams) {
    console.warn(`[getProductFeedback] Empty query - returning empty array`)
    return []
  }
  
  try {
    console.log(`[getProductFeedback] Query:`, {
      companyId: query.companyId?.toString(),
      employeeId: query.employeeId?.toString(),
      orderId: query.orderId,
      productId: query.productId,
      vendorId: query.vendorId?.toString()
    })
  } catch (logError) {
    console.log(`[getProductFeedback] Query built (logging failed)`)
  }
  
  let feedback: any[] = []
  try {
    console.log(`[getProductFeedback] Executing query with:`, {
      companyId: query.companyId?.toString(),
      employeeId: query.employeeId?.toString(),
      orderId: query.orderId,
      productId: query.productId,
      vendorId: query.vendorId?.toString(),
      isCompanyAdmin: isCompanyAdminUser,
      isLocationAdmin: isLocationAdminUser
    })
    
    // Fetch feedback with population
    // Note: populate('vendorId') will return null if vendorId is null in DB, not an empty object
    // Log the full query including $or
    const queryForLog = {
      ...query,
      companyId: query.companyId?.toString(),
      employeeId: query.employeeId?.toString(),
      $or: query.$or ? query.$or.map((or: any) => ({
        companyId: or.companyId?.toString(),
        companyIdNum: or.companyIdNum
      })) : undefined
    }
    console.log(`[getProductFeedback] 🔍 Executing query:`, JSON.stringify(queryForLog, null, 2))
    
    // For Location Admin: Log detailed query structure
    if (isLocationAdminUser) {
      console.log(`[getProductFeedback] 🔍 Location Admin query details:`, {
        hasEmployeeIdFilter: !!query.employeeId,
        employeeIdType: typeof query.employeeId,
        employeeIdIsIn: query.employeeId && typeof query.employeeId === 'object' && '$in' in query.employeeId,
        employeeIdInCount: query.employeeId && typeof query.employeeId === 'object' && '$in' in query.employeeId 
          ? (query.employeeId.$in?.length || 0) 
          : 0,
        hasOr: !!query.$or,
        orConditions: query.$or ? query.$or.map((or: any) => ({
          companyId: or.companyId?.toString(),
          companyIdNum: or.companyIdNum
        })) : null,
        fullQueryKeys: Object.keys(query)
      })
    }
    
    // BEFORE query: Check if the specific feedback exists and what its companyId is
    const specificFeedbackCheck = await ProductFeedback.findOne({ 
      orderId: 'ORD-1765652961649-4ZMRWCRMB-100001' 
    })
      .populate('companyId', 'id name')
      .lean()
    
    if (specificFeedbackCheck) {
      console.log(`[getProductFeedback] 🔍 SPECIFIC FEEDBACK CHECK - Found feedback ORD-1765652961649-4ZMRWCRMB-100001:`, {
        _id: specificFeedbackCheck._id?.toString(),
        orderId: specificFeedbackCheck.orderId,
        companyId: specificFeedbackCheck.companyId?._id?.toString() || specificFeedbackCheck.companyId?.toString(),
        companyIdNum: specificFeedbackCheck.companyIdNum,
        companyName: specificFeedbackCheck.companyId?.name,
        companyIdFromQuery: query.companyId?.toString(),
        queryHasOr: !!query.$or,
        orConditions: query.$or ? query.$or.map((or: any) => ({
          companyId: or.companyId?.toString(),
          companyIdNum: or.companyIdNum
        })) : null
      })
      
      // Test if this feedback would match the query
      const testQuery = { ...query }
      const wouldMatch = await ProductFeedback.findOne({
        _id: specificFeedbackCheck._id,
        ...testQuery
      }).lean()
      
      console.log(`[getProductFeedback] 🔍 Would this feedback match the query?`, {
        wouldMatch: !!wouldMatch,
        testQuery: JSON.stringify({
          ...testQuery,
          companyId: testQuery.companyId?.toString(),
          employeeId: testQuery.employeeId?.toString(),
          $or: testQuery.$or ? testQuery.$or.map((or: any) => ({
            companyId: or.companyId?.toString(),
            companyIdNum: or.companyIdNum
          })) : undefined
        }, null, 2)
      })
    } else {
      console.warn(`[getProductFeedback] 🔍 SPECIFIC FEEDBACK CHECK - Feedback ORD-1765652961649-4ZMRWCRMB-100001 NOT FOUND in database`)
    }
    
    feedback = await ProductFeedback.find(query)
      .populate('employeeId', 'id employeeId firstName lastName')
      .populate('companyId', 'id name')
      .populate('uniformId', 'id name')
      .populate({
        path: 'vendorId',
        select: 'id name',
        model: 'Vendor'
      })
      .sort({ createdAt: -1 })
      .lean()
    
    console.log(`[getProductFeedback] Initial query returned ${feedback.length} records`)
    
    // Location Admin specific debugging
    if (isLocationAdminUser && location) {
      console.log(`[getProductFeedback] 🔍 Location Admin query results:`, {
        locationId: location.id,
        locationName: location.name,
        feedbackCount: feedback.length,
        feedbackOrderIds: feedback.map((f: any) => f.orderId).slice(0, 5),
        feedbackEmployees: feedback.slice(0, 3).map((f: any) => ({
          orderId: f.orderId,
          employeeId: f.employeeId?.employeeId || f.employeeId?.id || f.employeeId,
          employeeName: f.employeeId?.firstName && f.employeeId?.lastName 
            ? `${f.employeeId.firstName} ${f.employeeId.lastName}` 
            : 'N/A'
        }))
      })
      
      // Verify all feedback belongs to location employees
      if (feedback.length > 0) {
        const feedbackEmployeeIds = feedback
          .map((f: any) => f.employeeId?._id?.toString() || f.employeeId?.toString())
          .filter((id: any) => id)
        
        const locationEmployeeIds = locationEmployees.map((e: any) => e._id.toString())
        const allInLocation = feedbackEmployeeIds.every((id: string) => locationEmployeeIds.includes(id))
        
        console.log(`[getProductFeedback] 🔍 Location Admin feedback validation:`, {
          feedbackEmployeeIds: feedbackEmployeeIds.slice(0, 3),
          locationEmployeeIds: locationEmployeeIds.slice(0, 3),
          allInLocation: allInLocation,
          feedbackCount: feedback.length,
          locationEmployeeCount: locationEmployees.length
        })
        
        if (!allInLocation && feedback.length > 0) {
          console.warn(`[getProductFeedback] ⚠️ WARNING: Some feedback employees are not in location!`)
        }
      }
    }
    
    // Check if the specific feedback is in the results
    const specificOrderId = 'ORD-1765652961649-4ZMRWCRMB-100001'
    const foundInResults = feedback.find((f: any) => f.orderId === specificOrderId)
    console.log(`[getProductFeedback] 🔍 Is ORD-1765652961649-4ZMRWCRMB-100001 in results?`, {
      found: !!foundInResults,
      totalResults: feedback.length,
      orderIds: feedback.map((f: any) => f.orderId)
    })
    
    // Debug: Check if the missing feedback would match the query
    if (isCompanyAdminUser && !foundInResults) {
      const missingFeedbackOrderId = 'ORD-1765652961649-4ZMRWCRMB-100001'
      const missingFeedbackCheck = await ProductFeedback.findOne({ 
        orderId: missingFeedbackOrderId 
      })
        .populate('companyId', 'id name')
        .lean()
      
      if (missingFeedbackCheck) {
        const queryCompanyId = query.companyId?.toString() || (query.$or && query.$or[0]?.companyId?.toString())
        const queryCompanyIdNum = query.$or && query.$or[1]?.companyIdNum
        
        console.log(`[getProductFeedback] 🔍 DEBUG: Missing feedback analysis for ${missingFeedbackOrderId}:`, {
          feedbackCompanyId: missingFeedbackCheck.companyId?._id?.toString() || missingFeedbackCheck.companyId?.toString(),
          feedbackCompanyIdNum: missingFeedbackCheck.companyIdNum,
          feedbackCompanyName: missingFeedbackCheck.companyId?.name,
          queryCompanyId: queryCompanyId,
          queryCompanyIdNum: queryCompanyIdNum,
          queryHasOr: !!query.$or,
          matchesById: missingFeedbackCheck.companyId?._id?.toString() === queryCompanyId || missingFeedbackCheck.companyId?.toString() === queryCompanyId,
          matchesByNum: missingFeedbackCheck.companyIdNum === queryCompanyIdNum,
          queryStructure: JSON.stringify({
            ...query,
            companyId: query.companyId?.toString(),
            $or: query.$or ? query.$or.map((or: any) => ({
              companyId: or.companyId?.toString(),
              companyIdNum: or.companyIdNum
            })) : undefined
          }, null, 2)
        })
        
        // Test direct query match with $or
        if (query.$or) {
          const directMatchTest = await ProductFeedback.findOne({
            orderId: missingFeedbackOrderId,
            $or: query.$or
          }).lean()
          console.log(`[getProductFeedback] 🔍 Direct $or query test:`, {
            matches: !!directMatchTest,
            orConditions: query.$or.map((or: any) => ({
              companyId: or.companyId?.toString(),
              companyIdNum: or.companyIdNum
            }))
          })
        }
        
        // Test if it matches by companyId ObjectId
        if (query.companyId) {
          const directMatchById = await ProductFeedback.findOne({
            orderId: missingFeedbackOrderId,
            companyId: query.companyId
          }).lean()
          console.log(`[getProductFeedback] 🔍 Direct companyId ObjectId test:`, {
            matches: !!directMatchById,
            queryCompanyId: query.companyId.toString()
          })
        }
        
        // Also check by companyIdNum
        if (missingFeedbackCheck.companyIdNum) {
          const companyForNumCheck = await Company.findOne({ id: companyId }).lean()
          if (companyForNumCheck) {
            const companyIdNumMatch = typeof companyForNumCheck.id === 'string' 
              ? parseInt(companyForNumCheck.id) === missingFeedbackCheck.companyIdNum
              : companyForNumCheck.id === missingFeedbackCheck.companyIdNum
            console.log(`[getProductFeedback] 🔍 DEBUG: companyIdNum check:`, {
              feedbackCompanyIdNum: missingFeedbackCheck.companyIdNum,
              companyIdNum: companyForNumCheck.id,
              matches: companyIdNumMatch
            })
          }
        }
      } else {
        console.warn(`[getProductFeedback] 🔍 DEBUG: Missing feedback ${missingFeedbackOrderId} not found in database`)
      }
    }
    if (feedback.length > 0) {
      const vendorStats = {
        hasVendorId: feedback.filter(f => f.vendorId && f.vendorId.name).length,
        nullVendorId: feedback.filter(f => f.vendorId === null || f.vendorId === undefined).length,
        emptyVendorId: feedback.filter(f => f.vendorId && !f.vendorId.name).length
      }
      console.log(`[getProductFeedback] VendorId population stats:`, vendorStats)
    }
    
    console.log(`[getProductFeedback] Found ${feedback.length} feedback records`)
    
    // Debug: Log sample feedback structure
    if (feedback.length > 0) {
      const sample = feedback[0]
      console.log(`[getProductFeedback] Sample feedback structure:`, {
        hasVendorId: !!sample.vendorId,
        vendorIdType: typeof sample.vendorId,
        vendorIdValue: sample.vendorId,
        hasUniformId: !!sample.uniformId,
        uniformIdType: typeof sample.uniformId,
        uniformIdValue: sample.uniformId,
        hasEmployeeId: !!sample.employeeId,
        employeeIdType: typeof sample.employeeId,
        employeeIdValue: sample.employeeId,
        employeeIdIsObject: typeof sample.employeeId === 'object' && sample.employeeId !== null,
        employeeFirstName: sample.employeeId?.firstName,
        employeeLastName: sample.employeeId?.lastName,
        employeeIdKeys: sample.employeeId && typeof sample.employeeId === 'object' ? Object.keys(sample.employeeId) : []
      })
      
      // Check all feedback records for employee data
      const employeeStats = {
        hasEmployeeId: feedback.filter(f => f.employeeId).length,
        hasFirstName: feedback.filter(f => f.employeeId?.firstName).length,
        hasLastName: feedback.filter(f => f.employeeId?.lastName).length,
        hasFullName: feedback.filter(f => f.employeeId?.firstName && f.employeeId?.lastName).length,
        nullEmployeeId: feedback.filter(f => !f.employeeId || f.employeeId === null).length
      }
      console.log(`[getProductFeedback] Employee data stats:`, employeeStats)
    }
    
    // Post-process: Fill in missing vendorIds from ProductVendor relationships
    // CRITICAL: This ensures Company Admin always sees vendor information
    // OPTIMIZED: Batch process to avoid blocking
    const db = mongoose.connection.db
    if (db && feedback.length > 0) {
      console.log(`[getProductFeedback] Post-processing ${feedback.length} feedback records for vendorId population`)
      
      // Batch process: Only process feedback missing vendorId, limit to prevent blocking
      const feedbackNeedingVendor = feedback.filter(fb => {
        const hasValidVendorId = fb.vendorId && 
          typeof fb.vendorId === 'object' && 
          fb.vendorId !== null &&
          !Array.isArray(fb.vendorId) &&
          fb.vendorId.name && 
          typeof fb.vendorId.name === 'string' &&
          fb.vendorId.name.trim() !== '' &&
          fb.vendorId.name !== 'null' &&
          fb.vendorId.name !== 'undefined'
        return !hasValidVendorId
      })
      
      console.log(`[getProductFeedback] ${feedbackNeedingVendor.length} feedback records need vendorId population`)
      
      // Process in parallel batches to avoid blocking
      // PRIORITY 1: Try to get vendorId from Order (most reliable)
      // PRIORITY 2: Fall back to ProductVendor relationship
      if (feedbackNeedingVendor.length > 0) {
        // STEP 1: Try to get vendorId from orders (batch lookup)
        console.log(`[getProductFeedback] 🔍 DEBUG: Sample feedback orderIds:`, 
          feedbackNeedingVendor.slice(0, 3).map(fb => ({
            feedbackId: fb._id?.toString(),
            orderId: fb.orderId,
            orderIdType: typeof fb.orderId,
            orderIdLength: fb.orderId?.length
          })))
        
        const orderIds = feedbackNeedingVendor
          .map(fb => fb.orderId)
          .filter((id): id is string => !!id && typeof id === 'string')
        
        if (orderIds.length > 0) {
          console.log(`[getProductFeedback] 🔍 DEBUG: Looking up vendorId from ${orderIds.length} orders`)
          console.log(`[getProductFeedback] 🔍 DEBUG: Order IDs to search:`, orderIds.slice(0, 3), orderIds.length > 3 ? `... (${orderIds.length - 3} more)` : '')
          
          // Try multiple query strategies
          let orders: any[] = []
          
          // Strategy 1: Direct id match
          orders = await Order.find({ id: { $in: orderIds } })
            .select('id vendorId')
            .lean()
          console.log(`[getProductFeedback] 🔍 DEBUG: Strategy 1 (id: $in) found ${orders.length} orders`)
          
          // Strategy 2: If no matches, try exact string match (case sensitive)
          if (orders.length === 0) {
            console.log(`[getProductFeedback] 🔍 DEBUG: Strategy 1 failed, trying individual queries...`)
            for (const orderId of orderIds.slice(0, 2)) { // Test first 2
              const testOrder = await Order.findOne({ id: orderId }).select('id vendorId').lean()
              if (testOrder) {
                console.log(`[getProductFeedback] 🔍 DEBUG: Found order with direct findOne:`, {
                  searchedId: orderId,
                  foundId: testOrder.id,
                  hasVendorId: !!testOrder.vendorId,
                  vendorIdType: typeof testOrder.vendorId,
                  vendorIdValue: testOrder.vendorId
                })
              } else {
                console.log(`[getProductFeedback] 🔍 DEBUG: Order NOT found with id:`, orderId)
                // Try to find any order with similar pattern
                const similarOrders = await Order.find({ id: { $regex: orderId.substring(0, 20) } })
                  .select('id vendorId')
                  .limit(3)
                  .lean()
                console.log(`[getProductFeedback] 🔍 DEBUG: Found ${similarOrders.length} orders with similar pattern:`, 
                  similarOrders.map((o: any) => ({ id: o.id, hasVendorId: !!o.vendorId })))
              }
            }
          }
          
          // Strategy 3: Try using the raw MongoDB collection
          if (orders.length === 0) {
            console.log(`[getProductFeedback] 🔍 DEBUG: Trying raw MongoDB collection query...`)
            const db = mongoose.connection.db
            if (db) {
              const rawOrders = await db.collection('orders').find({ id: { $in: orderIds } })
                .project({ id: 1, vendorId: 1 })
                .toArray()
              console.log(`[getProductFeedback] 🔍 DEBUG: Raw collection query found ${rawOrders.length} orders`)
              if (rawOrders.length > 0) {
                console.log(`[getProductFeedback] 🔍 DEBUG: Sample raw order:`, {
                  id: rawOrders[0].id,
                  vendorId: rawOrders[0].vendorId,
                  vendorIdType: typeof rawOrders[0].vendorId,
                  _id: rawOrders[0]._id
                })
                orders = rawOrders
              }
            }
          }
          
          console.log(`[getProductFeedback] 🔍 DEBUG: Total orders found: ${orders.length}`)
          if (orders.length > 0) {
            console.log(`[getProductFeedback] 🔍 DEBUG: Sample order structure:`, {
              id: orders[0].id,
              vendorId: orders[0].vendorId,
              vendorIdType: typeof orders[0].vendorId,
              vendorIdIsObject: typeof orders[0].vendorId === 'object',
              vendorIdIsObjectId: orders[0].vendorId instanceof mongoose.Types.ObjectId
            })
          }
          
          const orderVendorMap = new Map<string, any>()
          const vendorIdsFromOrders = new Set<string>()
          
          for (const order of orders) {
            if (order.vendorId) {
              let vendorIdStr: string
              if (typeof order.vendorId === 'object') {
                if (order.vendorId._id) {
                  vendorIdStr = order.vendorId._id.toString()
                } else if (order.vendorId.toString) {
                  vendorIdStr = order.vendorId.toString()
                } else {
                  console.warn(`[getProductFeedback] 🔍 DEBUG: Order ${order.id} has vendorId object but can't extract string:`, order.vendorId)
                  continue
                }
              } else {
                vendorIdStr = order.vendorId.toString()
              }
              
              orderVendorMap.set(order.id, vendorIdStr)
              vendorIdsFromOrders.add(vendorIdStr)
              console.log(`[getProductFeedback] 🔍 DEBUG: Mapped order ${order.id} -> vendorId ${vendorIdStr}`)
            } else {
              console.warn(`[getProductFeedback] 🔍 DEBUG: Order ${order.id} has no vendorId`)
            }
          }
          
          console.log(`[getProductFeedback] 🔍 DEBUG: Order-vendor mapping: ${orderVendorMap.size} mappings, ${vendorIdsFromOrders.size} unique vendors`)
          
          // Get all vendors in database for fallback (do this once, outside the loop)
          const allVendors = await Vendor.find({}).select('_id id name').lean()
          console.log(`[getProductFeedback] 🔍 DEBUG: Total vendors in database: ${allVendors.length}`)
          if (allVendors.length > 0) {
            console.log(`[getProductFeedback] 🔍 DEBUG: Sample of existing vendors:`, 
              allVendors.slice(0, 5).map((v: any) => ({ _id: v._id.toString(), id: v.id, name: v.name })))
          } else {
            console.warn(`[getProductFeedback] 🔍 DEBUG: ⚠️ NO VENDORS EXIST IN DATABASE!`)
          }
          
          // Batch lookup vendors from orders
          if (vendorIdsFromOrders.size > 0) {
            const vendorIdArray = Array.from(vendorIdsFromOrders)
            console.log(`[getProductFeedback] 🔍 DEBUG: Vendor IDs to lookup:`, vendorIdArray)
            
            const vendorObjectIds = vendorIdArray
              .filter(id => {
                const isValid = mongoose.Types.ObjectId.isValid(id)
                if (!isValid) {
                  console.warn(`[getProductFeedback] 🔍 DEBUG: Invalid ObjectId: ${id}`)
                }
                return isValid
              })
              .map(id => new mongoose.Types.ObjectId(id))
            
            console.log(`[getProductFeedback] 🔍 DEBUG: Looking up ${vendorObjectIds.length} vendors (${vendorIdsFromOrders.size} unique vendor IDs)`)
            console.log(`[getProductFeedback] 🔍 DEBUG: Vendor ObjectIds:`, vendorObjectIds.map(id => id.toString()))
            
            // Strategy 1: Try Mongoose query
            let vendorsFromOrders = await Vendor.find({ _id: { $in: vendorObjectIds } })
              .select('id name')
              .lean()
            
            console.log(`[getProductFeedback] 🔍 DEBUG: Strategy 1 (Mongoose $in) found ${vendorsFromOrders.length} vendors`)
            
            // Strategy 2: If no results, try individual findById queries (more reliable)
            if (vendorsFromOrders.length === 0 && vendorObjectIds.length > 0) {
              console.log(`[getProductFeedback] 🔍 DEBUG: Strategy 1 failed, trying individual findById queries...`)
              const individualVendors: any[] = []
              
              for (const vendorObjectId of vendorObjectIds) {
                try {
                  // Try findById first
                  let vendor = await Vendor.findById(vendorObjectId).select('id name').lean()
                  
                  if (vendor) {
                    individualVendors.push(vendor)
                    console.log(`[getProductFeedback] 🔍 DEBUG: ✅ Found vendor ${vendorObjectId} with findById: ${vendor.name || 'no name'}`)
                  } else {
                    // Try finding by _id as string
                    const vendorIdStr = vendorObjectId.toString()
                    vendor = await Vendor.findOne({ _id: vendorIdStr }).select('id name').lean()
                    
                    if (vendor) {
                      individualVendors.push(vendor)
                      console.log(`[getProductFeedback] 🔍 DEBUG: ✅ Found vendor ${vendorIdStr} with findOne(_id as string): ${vendor.name || 'no name'}`)
                    } else {
                      // Try finding by id field (not _id)
                      vendor = await Vendor.findOne({ id: vendorIdStr }).select('id name').lean()
                      
                      if (vendor) {
                        individualVendors.push(vendor)
                        console.log(`[getProductFeedback] 🔍 DEBUG: ✅ Found vendor ${vendorIdStr} with findOne(id field): ${vendor.name || 'no name'}`)
                      } else {
                        console.warn(`[getProductFeedback] 🔍 DEBUG: ❌ Vendor ${vendorObjectId} not found with any Mongoose query`)
                      }
                    }
                  }
                } catch (error: any) {
                  console.error(`[getProductFeedback] 🔍 DEBUG: Error finding vendor ${vendorObjectId}:`, error.message)
                }
              }
              
              if (individualVendors.length > 0) {
                vendorsFromOrders = individualVendors
                console.log(`[getProductFeedback] 🔍 DEBUG: Strategy 2 (individual findById) found ${vendorsFromOrders.length} vendors`)
              }
            }
            
            // Strategy 3: If still no results, try raw MongoDB collection
            if (vendorsFromOrders.length === 0) {
              console.log(`[getProductFeedback] 🔍 DEBUG: Strategy 2 failed, trying raw MongoDB collection...`)
              const db = mongoose.connection.db
              if (db) {
                // First, check what collections exist
                const collections = await db.listCollections().toArray()
                const vendorCollectionNames = collections
                  .map(c => c.name)
                  .filter(name => name.toLowerCase().includes('vendor'))
                console.log(`[getProductFeedback] 🔍 DEBUG: Collections with 'vendor' in name:`, vendorCollectionNames)
                
                // Try the standard 'vendors' collection
                let rawVendors = await db.collection('vendors').find({ 
                  _id: { $in: vendorObjectIds } 
                })
                  .project({ id: 1, name: 1, _id: 1 })
                  .toArray()
                
                console.log(`[getProductFeedback] 🔍 DEBUG: Raw 'vendors' collection query found ${rawVendors.length} vendors`)
                
                // If no results, try individual lookups with detailed debugging
                if (rawVendors.length === 0) {
                  console.log(`[getProductFeedback] 🔍 DEBUG: Trying individual raw collection lookups with detailed debugging...`)
                  const individualRawVendors: any[] = []
                  
                  for (const vendorObjectId of vendorObjectIds) {
                    try {
                      // Try exact _id match
                      let rawVendor = await db.collection('vendors').findOne({ _id: vendorObjectId })
                      
                      if (rawVendor) {
                        individualRawVendors.push(rawVendor)
                        console.log(`[getProductFeedback] 🔍 DEBUG: ✅ Found vendor in raw collection with _id ObjectId:`, {
                          _id: rawVendor._id,
                          _idType: typeof rawVendor._id,
                          id: rawVendor.id,
                          name: rawVendor.name
                        })
                      } else {
                        // Try as string
                        const vendorIdStr = vendorObjectId.toString()
                        rawVendor = await db.collection('vendors').findOne({ _id: vendorIdStr })
                        
                        if (rawVendor) {
                          individualRawVendors.push(rawVendor)
                          console.log(`[getProductFeedback] 🔍 DEBUG: ✅ Found vendor with _id as string:`, {
                            _id: rawVendor._id,
                            _idType: typeof rawVendor._id,
                            id: rawVendor.id,
                            name: rawVendor.name
                          })
                        } else {
                          // Try finding by id field
                          rawVendor = await db.collection('vendors').findOne({ id: vendorIdStr })
                          
                          if (rawVendor) {
                            individualRawVendors.push(rawVendor)
                            console.log(`[getProductFeedback] 🔍 DEBUG: ✅ Found vendor with id field:`, {
                              _id: rawVendor._id,
                              id: rawVendor.id,
                              name: rawVendor.name
                            })
                          } else {
                            // Debug: Check what _id values actually exist in the collection
                            const sampleVendors = await db.collection('vendors').find({}).limit(5).toArray()
                            console.log(`[getProductFeedback] 🔍 DEBUG: Sample vendor _id types in collection:`, 
                              sampleVendors.map((v: any) => ({
                                _id: v._id,
                                _idType: typeof v._id,
                                _idIsObjectId: v._id instanceof mongoose.Types.ObjectId,
                                id: v.id,
                                name: v.name
                              })))
                            
                            console.warn(`[getProductFeedback] 🔍 DEBUG: ❌ Vendor ${vendorObjectId} (${vendorIdStr}) not found with any query method`)
                          }
                        }
                      }
                    } catch (error: any) {
                      console.error(`[getProductFeedback] 🔍 DEBUG: Error in raw lookup ${vendorObjectId}:`, error.message, error.stack)
                    }
                  }
                  
                  if (individualRawVendors.length > 0) {
                    vendorsFromOrders = individualRawVendors
                    console.log(`[getProductFeedback] 🔍 DEBUG: Strategy 3 (individual raw) found ${vendorsFromOrders.length} vendors`)
                  }
                } else {
                  vendorsFromOrders = rawVendors
                  console.log(`[getProductFeedback] 🔍 DEBUG: Strategy 3 (raw $in) found ${vendorsFromOrders.length} vendors`)
                }
              }
            }
            
            console.log(`[getProductFeedback] 🔍 DEBUG: Found ${vendorsFromOrders.length} vendors`)
            
            const vendorMap = new Map<string, any>()
            for (const vendor of vendorsFromOrders) {
              if (vendor) {
                const vendorIdStr = vendor._id.toString()
                if (vendor.name) {
                  vendorMap.set(vendorIdStr, {
                    _id: vendor._id,
                    id: vendor.id,
                    name: vendor.name
                  })
                  console.log(`[getProductFeedback] 🔍 DEBUG: Mapped vendor ${vendorIdStr} -> ${vendor.name}`)
                } else {
                  console.warn(`[getProductFeedback] 🔍 DEBUG: Vendor ${vendorIdStr} found but has no name`)
                }
              }
            }
            
            // Apply vendorId from orders to feedback
            // FALLBACK: If vendor lookup fails, still use the vendorId ObjectId from order
            let ordersMatched = 0
            for (const fb of feedbackNeedingVendor) {
              if (fb.orderId) {
                const hasMapping = orderVendorMap.has(fb.orderId)
                console.log(`[getProductFeedback] 🔍 DEBUG: Feedback ${fb._id} orderId ${fb.orderId} has mapping: ${hasMapping}`)
                
                if (hasMapping) {
                  const vendorIdStr = orderVendorMap.get(fb.orderId)!
                  const vendor = vendorMap.get(vendorIdStr)
                  
                  console.log(`[getProductFeedback] 🔍 DEBUG: Feedback ${fb._id} vendorIdStr ${vendorIdStr} -> vendor:`, !!vendor, vendor ? vendor.name : 'NOT FOUND')
                  
                  if (vendor) {
                    // Full vendor object with name
                    fb.vendorId = vendor
                    ordersMatched++
                    console.log(`[getProductFeedback] 🔍 DEBUG: ✅ Applied vendor ${vendor.name} to feedback ${fb._id}`)
                    // Update database asynchronously
                    ProductFeedback.updateOne(
                      { _id: fb._id },
                      { $set: { vendorId: vendor._id } }
                    ).catch(err => console.error(`[getProductFeedback] Error updating feedback ${fb._id} from order:`, err))
                  } else {
                    // FALLBACK: Vendor not found in lookup, but we have vendorId from order
                    // The vendor might not exist, but we should still try ProductVendor as fallback
                    console.warn(`[getProductFeedback] 🔍 DEBUG: ⚠️ Vendor ${vendorIdStr} not found in batch lookup`)
                    
                    // FALLBACK: Try to find vendor through ProductVendor relationship
                    // This is more reliable since ProductVendor should have valid vendorIds
                    let foundViaProductVendor = false
                    if (fb.uniformId) {
                      try {
                        const db = mongoose.connection.db
                        if (db) {
                          // Extract uniformId ObjectId
                          let uniformObjectId: mongoose.Types.ObjectId | null = null
                          
                          if (fb.uniformId._id) {
                            uniformObjectId = typeof fb.uniformId._id === 'object' && fb.uniformId._id instanceof mongoose.Types.ObjectId
                              ? fb.uniformId._id
                              : new mongoose.Types.ObjectId(fb.uniformId._id.toString())
                          } else if (fb.uniformId instanceof mongoose.Types.ObjectId) {
                            uniformObjectId = fb.uniformId
                          } else if (typeof fb.uniformId === 'string' && mongoose.Types.ObjectId.isValid(fb.uniformId)) {
                            uniformObjectId = new mongoose.Types.ObjectId(fb.uniformId)
                          } else if (typeof fb.uniformId === 'object' && fb.uniformId._id) {
                            uniformObjectId = new mongoose.Types.ObjectId(fb.uniformId._id.toString())
                          }
                          
                          if (uniformObjectId) {
                            console.log(`[getProductFeedback] 🔍 DEBUG: Trying ProductVendor lookup for uniform ${uniformObjectId}`)
                            const productVendorLink = await db.collection('productvendors').findOne({ 
                              productId: uniformObjectId 
                            })
                            
                            if (productVendorLink && productVendorLink.vendorId) {
                              const productVendorIdStr = productVendorLink.vendorId.toString()
                              console.log(`[getProductFeedback] 🔍 DEBUG: Found ProductVendor link with vendorId: ${productVendorIdStr}`)
                              
                              // Try to find this vendor
                              const productVendor = await Vendor.findById(productVendorIdStr).select('id name').lean()
                              if (productVendor && productVendor.name) {
                                fb.vendorId = {
                                  _id: productVendor._id,
                                  id: productVendor.id,
                                  name: productVendor.name
                                }
                                ordersMatched++
                                foundViaProductVendor = true
                                console.log(`[getProductFeedback] 🔍 DEBUG: ✅ Found vendor via ProductVendor: ${productVendor.name}`)
                                // Update database
                                ProductFeedback.updateOne(
                                  { _id: fb._id },
                                  { $set: { vendorId: productVendor._id } }
                                ).catch(err => console.error(`[getProductFeedback] Error updating feedback ${fb._id} from ProductVendor:`, err))
                              } else {
                                console.warn(`[getProductFeedback] 🔍 DEBUG: ProductVendor vendorId ${productVendorIdStr} also doesn't exist`)
                              }
                            } else {
                              console.warn(`[getProductFeedback] 🔍 DEBUG: No ProductVendor link found for uniform ${uniformObjectId}`)
                            }
                          } else {
                            console.warn(`[getProductFeedback] 🔍 DEBUG: Could not extract uniformId ObjectId from:`, fb.uniformId)
                          }
                        }
                      } catch (productVendorError: any) {
                        console.error(`[getProductFeedback] 🔍 DEBUG: Error in ProductVendor fallback:`, productVendorError.message)
                      }
                    }
                    
                    // Only set placeholder if ProductVendor also failed
                    if (!foundViaProductVendor) {
                      // Do NOT use fallback vendor - show "Unknown" if vendor cannot be found
                      // This allows proper troubleshooting to identify the correct vendor
                      if (mongoose.Types.ObjectId.isValid(vendorIdStr)) {
                        const vendorObjectId = new mongoose.Types.ObjectId(vendorIdStr)
                        // Set "Unknown" vendor so it's clear the vendor needs to be identified
                        fb.vendorId = {
                          _id: vendorObjectId,
                          id: 'unknown',
                          name: 'Unknown'
                        }
                        // Do NOT update database - keep the original vendorId ObjectId for troubleshooting
                        console.warn(`[getProductFeedback] 🔍 DEBUG: ⚠️ Vendor ${vendorIdStr} not found - showing "Unknown" for feedback ${fb._id}`)
                        console.warn(`[getProductFeedback] 🔍 DEBUG: OrderId: ${fb.orderId}, ProductId: ${fb.productId}, UniformId: ${fb.uniformId?.name || fb.uniformId?._id}`)
                      } else {
                        // Invalid vendorId - set to null/unknown
                        fb.vendorId = {
                          _id: null,
                          id: 'unknown',
                          name: 'Unknown'
                        }
                        console.warn(`[getProductFeedback] 🔍 DEBUG: ⚠️ Invalid vendorId format: ${vendorIdStr} - showing "Unknown"`)
                      }
                    }
                  }
                } else {
                  console.warn(`[getProductFeedback] 🔍 DEBUG: ⚠️ No order mapping found for orderId ${fb.orderId} (feedback ${fb._id})`)
                }
              } else {
                console.warn(`[getProductFeedback] 🔍 DEBUG: ⚠️ Feedback ${fb._id} has no orderId`)
              }
            }
            console.log(`[getProductFeedback] ✅ Populated vendorId from orders for ${ordersMatched} feedback records`)
          } else {
            console.warn(`[getProductFeedback] 🔍 DEBUG: ⚠️ No vendorIds extracted from ${orders.length} orders`)
          }
        }
        
        // STEP 2: For feedback still missing vendorId, try ProductVendor relationship
        const stillNeedingVendor = feedbackNeedingVendor.filter(fb => {
          const hasValidVendorId = fb.vendorId && 
            typeof fb.vendorId === 'object' && 
            fb.vendorId !== null &&
            !Array.isArray(fb.vendorId) &&
            fb.vendorId.name && 
            typeof fb.vendorId.name === 'string' &&
            fb.vendorId.name.trim() !== '' &&
            fb.vendorId.name !== 'null' &&
            fb.vendorId.name !== 'undefined'
          return !hasValidVendorId
        })
        
        if (stillNeedingVendor.length > 0) {
          console.log(`[getProductFeedback] ${stillNeedingVendor.length} feedback records still need vendorId, trying ProductVendor lookup`)
          
          // Get all uniformIds that need vendor lookup
          const uniformIdsToLookup = new Map<string, any>()
          
          for (const fb of stillNeedingVendor) {
            let uniformObjectId = null
            if (fb.uniformId) {
              if (typeof fb.uniformId === 'object' && fb.uniformId._id) {
                uniformObjectId = fb.uniformId._id.toString()
              } else if (fb.uniformId instanceof mongoose.Types.ObjectId) {
                uniformObjectId = fb.uniformId.toString()
              } else if (typeof fb.uniformId === 'string' && mongoose.Types.ObjectId.isValid(fb.uniformId)) {
                uniformObjectId = fb.uniformId
              }
            }
            if (uniformObjectId) {
              if (!uniformIdsToLookup.has(uniformObjectId)) {
                uniformIdsToLookup.set(uniformObjectId, [])
              }
              uniformIdsToLookup.get(uniformObjectId)!.push(fb)
            }
          }
          
          // Batch lookup all ProductVendor relationships at once
          if (uniformIdsToLookup.size > 0) {
            const uniformObjectIds = Array.from(uniformIdsToLookup.keys()).map(id => new mongoose.Types.ObjectId(id))
            const productVendorLinks = await db.collection('productvendors')
              .find({ productId: { $in: uniformObjectIds } })
              .toArray()
            
            // Batch lookup all vendors at once
            const uniqueVendorIds = [...new Set(productVendorLinks
              .filter(link => link.vendorId)
              .map(link => link.vendorId.toString()))]
              .map(id => new mongoose.Types.ObjectId(id))
            
            const vendors = await Vendor.find({ _id: { $in: uniqueVendorIds } })
              .select('id name')
              .lean()
            
            const vendorIdMap = new Map<string, any>()
            for (const vendor of vendors) {
              if (vendor && vendor.name) {
                vendorIdMap.set(vendor._id.toString(), {
                  _id: vendor._id,
                  id: vendor.id,
                  name: vendor.name
                })
              }
            }
            
            // Apply vendorId to all feedback records from ProductVendor
            let productVendorMatched = 0
            for (const [uniformIdStr, feedbackList] of uniformIdsToLookup.entries()) {
              const uniformObjectId = new mongoose.Types.ObjectId(uniformIdStr)
              const link = productVendorLinks.find(l => l.productId.toString() === uniformObjectId.toString())
              
              if (link && link.vendorId) {
                const vendorIdStr = link.vendorId.toString()
                const vendor = vendorIdMap.get(vendorIdStr)
                
                if (vendor) {
                  for (const fb of feedbackList) {
                    // Only update if still missing vendorId
                    const stillMissing = !fb.vendorId || 
                      !fb.vendorId.name || 
                      fb.vendorId.name.trim() === ''
                    if (stillMissing) {
                      fb.vendorId = vendor
                      productVendorMatched++
                      // Update database asynchronously
                      ProductFeedback.updateOne(
                        { _id: fb._id },
                        { $set: { vendorId: vendor._id } }
                      ).catch(err => console.error(`[getProductFeedback] Error updating feedback ${fb._id} from ProductVendor:`, err))
                    }
                  }
                }
              }
            }
            console.log(`[getProductFeedback] ✅ Populated vendorId from ProductVendor for ${productVendorMatched} feedback records`)
          }
        }
      }
    }
    
    // Decrypt employee fields (firstName, lastName are encrypted)
    const { decrypt } = require('../utils/encryption')
    for (const fb of feedback) {
      if (fb.employeeId) {
        const sensitiveFields = ['firstName', 'lastName']
        for (const field of sensitiveFields) {
          if (fb.employeeId[field] && typeof fb.employeeId[field] === 'string' && fb.employeeId[field].includes(':')) {
            try {
              fb.employeeId[field] = decrypt(fb.employeeId[field])
              console.log(`[getProductFeedback] Decrypted employee ${field} for feedback ${fb._id}`)
            } catch (error) {
              console.warn(`[getProductFeedback] Failed to decrypt employee ${field} for feedback ${fb._id}:`, error)
            }
          }
        }
      }
    }
    
    // Final verification: Ensure all feedback has vendorId populated (especially for Company Admin)
    if (isCompanyAdminUser && feedback.length > 0) {
      const feedbackWithoutVendor = feedback.filter(fb => !fb.vendorId || !fb.vendorId.name)
      if (feedbackWithoutVendor.length > 0) {
        console.warn(`[getProductFeedback] ⚠️ WARNING: ${feedbackWithoutVendor.length} feedback records still missing vendorId for Company Admin`)
        for (const fb of feedbackWithoutVendor) {
          console.warn(`[getProductFeedback] Missing vendorId for feedback:`, {
            feedbackId: fb._id,
            orderId: fb.orderId,
            productId: fb.productId,
            uniformId: fb.uniformId?.name || fb.uniformId?._id
          })
        }
      } else {
        console.log(`[getProductFeedback] ✅ All ${feedback.length} feedback records have vendorId populated for Company Admin`)
      }
    }
    
    // Additional debug: Check populated fields
    if (feedback.length > 0) {
      const sampleFeedback = feedback[0]
      console.log(`[getProductFeedback] Final sample feedback:`, {
        feedbackId: sampleFeedback._id?.toString(),
        orderId: sampleFeedback.orderId,
        productId: sampleFeedback.productId,
        vendorId: sampleFeedback.vendorId ? {
          name: sampleFeedback.vendorId.name,
          id: sampleFeedback.vendorId.id,
          _id: sampleFeedback.vendorId._id?.toString(),
          isValid: !!(sampleFeedback.vendorId.name && sampleFeedback.vendorId.name.trim() !== '')
        } : null,
        employeeId: sampleFeedback.employeeId ? {
          firstName: sampleFeedback.employeeId.firstName,
          lastName: sampleFeedback.employeeId.lastName,
          id: sampleFeedback.employeeId.id
        } : null,
        uniformId: sampleFeedback.uniformId ? {
          name: sampleFeedback.uniformId.name,
          id: sampleFeedback.uniformId.id,
          _id: sampleFeedback.uniformId._id?.toString()
        } : null
      })
    }
  } catch (queryError: any) {
    console.error(`[getProductFeedback] Error executing query:`, queryError.message)
    console.error(`[getProductFeedback] Error stack:`, queryError.stack)
    console.error(`[getProductFeedback] Query that failed:`, JSON.stringify({
      companyId: query.companyId?.toString(),
      employeeId: query.employeeId?.toString(),
      orderId: query.orderId,
      productId: query.productId,
      vendorId: query.vendorId?.toString()
    }, null, 2))
    throw new Error(`Failed to fetch product feedback: ${queryError.message}`)
  }
  
  // If no feedback found and we're querying by companyId, try a more flexible query
  if (feedback.length === 0 && query.companyId) {
    console.log(`[getProductFeedback] No feedback found with strict query, trying alternative query...`)
    // Get company once for all fallback queries
    const companyForFallback = await Company.findOne({ _id: query.companyId }).lean()
    
    if (companyForFallback && companyForFallback.id) {
      // Try querying with companyIdNum as well (fallback)
      const companyIdNum = typeof companyForFallback.id === 'string' ? parseInt(companyForFallback.id) : companyForFallback.id
      const altQuery: any = {}
      if (query.employeeId) altQuery.employeeId = query.employeeId
      if (query.orderId) altQuery.orderId = query.orderId
      if (query.productId) altQuery.productId = query.productId
      if (query.vendorId) altQuery.vendorId = query.vendorId
      altQuery.companyIdNum = companyIdNum
      
      const altFeedback = await ProductFeedback.find(altQuery)
        .populate('employeeId', 'id employeeId firstName lastName')
        .populate('companyId', 'id name')
        .populate('uniformId', 'id name')
        .populate('vendorId', 'id name')
        .sort({ createdAt: -1 })
        .lean()
      console.log(`[getProductFeedback] Alternative query (by companyIdNum) found ${altFeedback.length} feedback records`)
      
      // Post-process: Fill in missing vendorIds
      // PRIORITY 1: Try to get vendorId from Order (most reliable)
      // PRIORITY 2: Fall back to ProductVendor relationship
      const dbForAlt = mongoose.connection.db
      if (altFeedback.length > 0 && dbForAlt) {
        // STEP 1: Try to get vendorId from orders (batch lookup)
        const altFeedbackNeedingVendor = altFeedback.filter(fb => {
          const hasVendorId = fb.vendorId && 
            typeof fb.vendorId === 'object' && 
            fb.vendorId !== null &&
            !Array.isArray(fb.vendorId) &&
            fb.vendorId.name && 
            typeof fb.vendorId.name === 'string' &&
            fb.vendorId.name.trim() !== '' &&
            fb.vendorId.name !== 'null' &&
            fb.vendorId.name !== 'undefined'
          return !hasVendorId
        })
        
        if (altFeedbackNeedingVendor.length > 0) {
          const altOrderIds = altFeedbackNeedingVendor
            .map(fb => fb.orderId)
            .filter((id): id is string => !!id && typeof id === 'string')
          
          if (altOrderIds.length > 0) {
            console.log(`[getProductFeedback] [Alt Query] Looking up vendorId from ${altOrderIds.length} orders`)
            const altOrders = await Order.find({ id: { $in: altOrderIds } })
              .select('id vendorId')
              .lean()
            
            const altOrderVendorMap = new Map<string, any>()
            const altVendorIdsFromOrders = new Set<string>()
            
            for (const order of altOrders) {
              if (order.vendorId) {
                const vendorIdStr = typeof order.vendorId === 'object' && order.vendorId._id 
                  ? order.vendorId._id.toString() 
                  : order.vendorId.toString()
                altOrderVendorMap.set(order.id, vendorIdStr)
                altVendorIdsFromOrders.add(vendorIdStr)
              }
            }
            
            // Batch lookup vendors from orders
            if (altVendorIdsFromOrders.size > 0) {
              const altVendorObjectIds = Array.from(altVendorIdsFromOrders).map(id => new mongoose.Types.ObjectId(id))
              const altVendorsFromOrders = await Vendor.find({ _id: { $in: altVendorObjectIds } })
                .select('id name')
                .lean()
              
              const altVendorMap = new Map<string, any>()
              for (const vendor of altVendorsFromOrders) {
                if (vendor && vendor.name) {
                  altVendorMap.set(vendor._id.toString(), {
                    _id: vendor._id,
                    id: vendor.id,
                    name: vendor.name
                  })
                }
              }
              
              // Apply vendorId from orders to feedback
              let altOrdersMatched = 0
              for (const fb of altFeedbackNeedingVendor) {
                if (fb.orderId && altOrderVendorMap.has(fb.orderId)) {
                  const vendorIdStr = altOrderVendorMap.get(fb.orderId)!
                  const vendor = altVendorMap.get(vendorIdStr)
                  
                  if (vendor) {
                    fb.vendorId = vendor
                    altOrdersMatched++
                    // Update database asynchronously
                    ProductFeedback.updateOne(
                      { _id: fb._id },
                      { $set: { vendorId: vendor._id } }
                    ).catch(err => console.error(`[getProductFeedback] [Alt Query] Error updating feedback ${fb._id} from order:`, err))
                  }
                }
              }
              console.log(`[getProductFeedback] [Alt Query] ✅ Populated vendorId from orders for ${altOrdersMatched} feedback records`)
            }
          }
          
          // STEP 2: For feedback still missing vendorId, try ProductVendor relationship
          const altStillNeedingVendor = altFeedbackNeedingVendor.filter(fb => {
            const hasValidVendorId = fb.vendorId && 
              typeof fb.vendorId === 'object' && 
              fb.vendorId !== null &&
              !Array.isArray(fb.vendorId) &&
              fb.vendorId.name && 
              typeof fb.vendorId.name === 'string' &&
              fb.vendorId.name.trim() !== '' &&
              fb.vendorId.name !== 'null' &&
              fb.vendorId.name !== 'undefined'
            return !hasValidVendorId
          })
          
          if (altStillNeedingVendor.length > 0) {
            console.log(`[getProductFeedback] [Alt Query] ${altStillNeedingVendor.length} feedback records still need vendorId, trying ProductVendor lookup`)
            
            for (const fb of altStillNeedingVendor) {
              // Get uniformId ObjectId - when using .lean(), populated fields are plain objects
              let uniformObjectId = null
              
              if (fb.uniformId) {
                if (typeof fb.uniformId === 'object' && fb.uniformId._id) {
                  uniformObjectId = fb.uniformId._id
                } else if (fb.uniformId instanceof mongoose.Types.ObjectId) {
                  uniformObjectId = fb.uniformId
                } else if (typeof fb.uniformId === 'string') {
                  uniformObjectId = new mongoose.Types.ObjectId(fb.uniformId)
                }
              }
              
              if (!uniformObjectId && fb.uniformId) {
                const rawFeedback = await ProductFeedback.findById(fb._id).select('uniformId').lean()
                if (rawFeedback && rawFeedback.uniformId) {
                  uniformObjectId = rawFeedback.uniformId
                }
              }
              
              if (uniformObjectId) {
                const productVendorLink = await dbForAlt.collection('productvendors').findOne({ 
                  productId: uniformObjectId 
                })
                
                if (productVendorLink && productVendorLink.vendorId) {
                  const vendor = await Vendor.findById(productVendorLink.vendorId)
                    .select('id name')
                    .lean()
                  
                  if (vendor) {
                    await ProductFeedback.updateOne(
                      { _id: fb._id },
                      { $set: { vendorId: vendor._id } }
                    )
                    
                    fb.vendorId = {
                      _id: vendor._id,
                      id: vendor.id,
                      name: vendor.name
                    }
                    console.log(`[getProductFeedback] [Alt Query] ✅ Populated vendorId for alt feedback ${fb._id}: ${vendor.name}`)
                  }
                }
              }
            }
          }
        }
      }
      
      // Decrypt employee fields for alternative query results
      if (altFeedback.length > 0) {
        const { decrypt: decryptAlt } = require('../utils/encryption')
        for (const fb of altFeedback) {
          if (fb.employeeId) {
            const sensitiveFields = ['firstName', 'lastName']
            for (const field of sensitiveFields) {
              if (fb.employeeId[field] && typeof fb.employeeId[field] === 'string' && fb.employeeId[field].includes(':')) {
                try {
                  fb.employeeId[field] = decryptAlt(fb.employeeId[field])
                } catch (error) {
                  console.warn(`[getProductFeedback] Failed to decrypt employee ${field} for alt feedback ${fb._id}:`, error)
                }
              }
            }
          }
        }
      }
      
      if (altFeedback.length > 0) {
        return altFeedback.map((f: any) => toPlainObject(f))
      }
      
      // Last resort: try to find all feedback and filter by company manually
      console.log(`[getProductFeedback] Trying manual company matching...`)
      const allFeedback = await ProductFeedback.find({
        ...(query.employeeId ? { employeeId: query.employeeId } : {}),
        ...(query.orderId ? { orderId: query.orderId } : {}),
        ...(query.productId ? { productId: query.productId } : {}),
        ...(query.vendorId ? { vendorId: query.vendorId } : {})
      })
        .populate('companyId', 'id name')
        .lean()
      
      const filteredFeedback = allFeedback.filter((fb: any) => {
        const fbCompanyId = fb.companyId?._id?.toString() || fb.companyId?.toString()
        const targetCompanyId = companyForFallback._id.toString()
        return fbCompanyId === targetCompanyId
      })
      
      // Populate other fields
      const populatedFeedback = await ProductFeedback.find({
        _id: { $in: filteredFeedback.map((f: any) => f._id) }
      })
        .populate('employeeId', 'id employeeId firstName lastName')
        .populate('companyId', 'id name')
        .populate('uniformId', 'id name')
        .populate('vendorId', 'id name')
        .sort({ createdAt: -1 })
        .lean()
      
      console.log(`[getProductFeedback] Manual matching found ${populatedFeedback.length} feedback records`)
      
      // Apply vendorId population to manually matched feedback as well
      // PRIORITY 1: Try to get vendorId from Order (most reliable)
      // PRIORITY 2: Fall back to ProductVendor relationship
      if (db && populatedFeedback.length > 0) {
        const manualFeedbackNeedingVendor = populatedFeedback.filter(fb => {
          const hasValidVendorId = fb.vendorId && 
            typeof fb.vendorId === 'object' && 
            fb.vendorId !== null &&
            !Array.isArray(fb.vendorId) &&
            fb.vendorId.name && 
            typeof fb.vendorId.name === 'string' &&
            fb.vendorId.name.trim() !== '' &&
            fb.vendorId.name !== 'null' &&
            fb.vendorId.name !== 'undefined'
          return !hasValidVendorId
        })
        
        if (manualFeedbackNeedingVendor.length > 0) {
          // STEP 1: Try to get vendorId from orders (batch lookup)
          const manualOrderIds = manualFeedbackNeedingVendor
            .map(fb => fb.orderId)
            .filter((id): id is string => !!id && typeof id === 'string')
          
          if (manualOrderIds.length > 0) {
            console.log(`[getProductFeedback] [Manual Match] Looking up vendorId from ${manualOrderIds.length} orders`)
            const manualOrders = await Order.find({ id: { $in: manualOrderIds } })
              .select('id vendorId')
              .lean()
            
            const manualOrderVendorMap = new Map<string, any>()
            const manualVendorIdsFromOrders = new Set<string>()
            
            for (const order of manualOrders) {
              if (order.vendorId) {
                const vendorIdStr = typeof order.vendorId === 'object' && order.vendorId._id 
                  ? order.vendorId._id.toString() 
                  : order.vendorId.toString()
                manualOrderVendorMap.set(order.id, vendorIdStr)
                manualVendorIdsFromOrders.add(vendorIdStr)
              }
            }
            
            // Batch lookup vendors from orders
            if (manualVendorIdsFromOrders.size > 0) {
              const manualVendorObjectIds = Array.from(manualVendorIdsFromOrders).map(id => new mongoose.Types.ObjectId(id))
              const manualVendorsFromOrders = await Vendor.find({ _id: { $in: manualVendorObjectIds } })
                .select('id name')
                .lean()
              
              const manualVendorMap = new Map<string, any>()
              for (const vendor of manualVendorsFromOrders) {
                if (vendor && vendor.name) {
                  manualVendorMap.set(vendor._id.toString(), {
                    _id: vendor._id,
                    id: vendor.id,
                    name: vendor.name
                  })
                }
              }
              
              // Apply vendorId from orders to feedback
              let manualOrdersMatched = 0
              for (const fb of manualFeedbackNeedingVendor) {
                if (fb.orderId && manualOrderVendorMap.has(fb.orderId)) {
                  const vendorIdStr = manualOrderVendorMap.get(fb.orderId)!
                  const vendor = manualVendorMap.get(vendorIdStr)
                  
                  if (vendor) {
                    fb.vendorId = vendor
                    manualOrdersMatched++
                  }
                }
              }
              console.log(`[getProductFeedback] [Manual Match] ✅ Populated vendorId from orders for ${manualOrdersMatched} feedback records`)
            }
          }
          
          // STEP 2: For feedback still missing vendorId, try ProductVendor relationship
          const manualStillNeedingVendor = manualFeedbackNeedingVendor.filter(fb => {
            const hasValidVendorId = fb.vendorId && 
              typeof fb.vendorId === 'object' && 
              fb.vendorId !== null &&
              !Array.isArray(fb.vendorId) &&
              fb.vendorId.name && 
              typeof fb.vendorId.name === 'string' &&
              fb.vendorId.name.trim() !== '' &&
              fb.vendorId.name !== 'null' &&
              fb.vendorId.name !== 'undefined'
            return !hasValidVendorId
          })
          
          if (manualStillNeedingVendor.length > 0 && db) {
            console.log(`[getProductFeedback] [Manual Match] ${manualStillNeedingVendor.length} feedback records still need vendorId, trying ProductVendor lookup`)
            for (const fb of manualStillNeedingVendor) {
              if (fb.uniformId?._id) {
                const productVendorLink = await db.collection('productvendors').findOne({ 
                  productId: fb.uniformId._id 
                })
                
                if (productVendorLink && productVendorLink.vendorId) {
                  const vendor = await Vendor.findById(productVendorLink.vendorId).select('id name').lean()
                  if (vendor && vendor.name) {
                    fb.vendorId = {
                      _id: vendor._id,
                      id: vendor.id,
                      name: vendor.name
                    }
                  }
                }
              }
            }
          }
        }
      }
      
      // Apply same vendorId population and transformation to alternative query results
      const transformedAltFeedback = populatedFeedback.map((f: any) => {
        // Preserve employee data before toPlainObject converts it
        const employeeData = f.employeeId && typeof f.employeeId === 'object' && f.employeeId !== null
          ? {
              _id: f.employeeId._id?.toString() || f.employeeId._id,
              id: f.employeeId.id,
              employeeId: f.employeeId.employeeId,
              firstName: f.employeeId.firstName,
              lastName: f.employeeId.lastName
            }
          : null
        
        const plain = toPlainObject(f)
        
        // Restore employee data if it was populated
        if (employeeData) {
          plain.employeeId = employeeData
        }
        
        // Ensure vendorId structure is correct
        if (plain.vendorId && typeof plain.vendorId === 'object' && !plain.vendorId.name) {
          console.warn(`[getProductFeedback] ⚠️ vendorId object missing name in alt query transform:`, plain.vendorId)
        }
        return plain
      })
      
      console.log(`[getProductFeedback] Returning ${transformedAltFeedback.length} feedback records from alternative query`)
      if (transformedAltFeedback.length > 0 && isCompanyAdminUser) {
        const vendorsInAltResponse = new Set(transformedAltFeedback
          .filter(f => f.vendorId && f.vendorId.name && f.vendorId.name.trim() !== '')
          .map(f => f.vendorId.name))
        console.log(`[getProductFeedback] ✅ Alternative query includes ${vendorsInAltResponse.size} unique vendors:`, Array.from(vendorsInAltResponse))
      }
      
      return transformedAltFeedback
    }
  }
  
  // Final transformation: Ensure vendorId and employeeId are properly formatted in response
  const transformedFeedback = feedback.map((f: any, index: number) => {
    // Preserve employee data before toPlainObject converts it
    let employeeData = null
    
    if (f.employeeId && typeof f.employeeId === 'object' && f.employeeId !== null && !Array.isArray(f.employeeId)) {
      // Employee is populated - extract the data
      employeeData = {
        _id: f.employeeId._id?.toString() || f.employeeId._id,
        id: f.employeeId.id,
        employeeId: f.employeeId.employeeId,
        firstName: f.employeeId.firstName,
        lastName: f.employeeId.lastName
      }
      
      // Debug first few records
      if (index < 3) {
        console.log(`[getProductFeedback] 🔍 Employee data BEFORE toPlainObject for feedback ${f.orderId}:`, {
          employeeIdType: typeof f.employeeId,
          employeeIdIsObject: typeof f.employeeId === 'object',
          employeeIdKeys: Object.keys(f.employeeId),
          firstName: f.employeeId.firstName,
          lastName: f.employeeId.lastName,
          extractedData: employeeData
        })
      }
    } else if (f.employeeId) {
      // EmployeeId exists but is not an object (might be ObjectId string)
      if (index < 3) {
        console.warn(`[getProductFeedback] ⚠️ EmployeeId is not populated for feedback ${f.orderId}:`, {
          employeeIdType: typeof f.employeeId,
          employeeIdValue: f.employeeId,
          employeeIdString: f.employeeId?.toString()
        })
      }
    } else {
      // No employeeId at all
      if (index < 3) {
        console.warn(`[getProductFeedback] ⚠️ No employeeId for feedback ${f.orderId || f._id}`)
      }
    }
    
    const plain = toPlainObject(f)
    
    // Restore employee data if it was populated
    if (employeeData) {
      plain.employeeId = employeeData
      if (index < 3) {
        console.log(`[getProductFeedback] ✅ Preserved employee data for feedback ${plain.orderId}:`, {
          firstName: employeeData.firstName,
          lastName: employeeData.lastName,
          employeeId: employeeData.employeeId
        })
      }
    }
    
    // Ensure vendorId structure is correct for frontend
    if (plain.vendorId && typeof plain.vendorId === 'object') {
      // Ensure name is present and not empty
      if (!plain.vendorId.name || plain.vendorId.name.trim() === '') {
        console.warn(`[getProductFeedback] ⚠️ vendorId object missing valid name in final transform for feedback ${plain._id}`)
      }
    }
    
    return plain
  })
  
  // Batch lookup employees that weren't populated
  const feedbackNeedingEmployee = transformedFeedback.filter(f => 
    !f.employeeId || 
    typeof f.employeeId === 'string' || 
    (typeof f.employeeId === 'object' && (!f.employeeId.firstName || !f.employeeId.lastName))
  )
  
  if (feedbackNeedingEmployee.length > 0) {
    console.log(`[getProductFeedback] 🔍 ${feedbackNeedingEmployee.length} feedback records need employee data, attempting batch lookup...`)
    
    const employeeIdsToLookup: mongoose.Types.ObjectId[] = []
    const feedbackEmployeeMap = new Map<string, any[]>() // Map employeeId to feedback records
    
    feedbackNeedingEmployee.forEach(f => {
      let employeeIdToLookup: mongoose.Types.ObjectId | null = null
      
      if (typeof f.employeeId === 'string' && mongoose.Types.ObjectId.isValid(f.employeeId)) {
        employeeIdToLookup = new mongoose.Types.ObjectId(f.employeeId)
      } else if (f.employeeId?._id && mongoose.Types.ObjectId.isValid(f.employeeId._id)) {
        employeeIdToLookup = new mongoose.Types.ObjectId(f.employeeId._id)
      } else if (f._id && mongoose.Types.ObjectId.isValid(f._id)) {
        // Try to get employeeId from the original feedback document
        const originalFeedback = feedback.find((orig: any) => orig._id?.toString() === f._id?.toString())
        if (originalFeedback?.employeeId) {
          const origEmployeeId = originalFeedback.employeeId
          if (typeof origEmployeeId === 'object' && origEmployeeId._id) {
            employeeIdToLookup = new mongoose.Types.ObjectId(origEmployeeId._id)
          } else if (mongoose.Types.ObjectId.isValid(origEmployeeId)) {
            employeeIdToLookup = new mongoose.Types.ObjectId(origEmployeeId)
          }
        }
      }
      
      if (employeeIdToLookup) {
        const key = employeeIdToLookup.toString()
        if (!employeeIdsToLookup.find(id => id.toString() === key)) {
          employeeIdsToLookup.push(employeeIdToLookup)
        }
        if (!feedbackEmployeeMap.has(key)) {
          feedbackEmployeeMap.set(key, [])
        }
        feedbackEmployeeMap.get(key)!.push(f)
      }
    })
    
    if (employeeIdsToLookup.length > 0) {
      console.log(`[getProductFeedback] 🔍 Looking up ${employeeIdsToLookup.length} unique employees...`)
      const employees = await Employee.find({ _id: { $in: employeeIdsToLookup } })
        .select('id employeeId firstName lastName')
        .lean()
      
      console.log(`[getProductFeedback] 🔍 Found ${employees.length} employees in batch lookup`)
      
      // Create a map for quick lookup
      const employeeMap = new Map()
      employees.forEach((emp: any) => {
        const empData = {
          _id: emp._id.toString(),
          id: emp.id,
          employeeId: emp.employeeId,
          firstName: emp.firstName,
          lastName: emp.lastName
        }
        employeeMap.set(emp._id.toString(), empData)
      })
      
      // Update feedback records with employee data
      let updatedCount = 0
      feedbackEmployeeMap.forEach((feedbackRecords, employeeIdStr) => {
        if (employeeMap.has(employeeIdStr)) {
          const empData = employeeMap.get(employeeIdStr)
          feedbackRecords.forEach(f => {
            f.employeeId = empData
            updatedCount++
            console.log(`[getProductFeedback] ✅ Manually populated employee for feedback ${f.orderId}: ${empData.firstName} ${empData.lastName}`)
          })
        } else {
          console.warn(`[getProductFeedback] ⚠️ Employee ${employeeIdStr} not found in database`)
        }
      })
      
      console.log(`[getProductFeedback] ✅ Updated ${updatedCount} feedback records with employee data`)
    }
  }
  
  console.log(`[getProductFeedback] Returning ${transformedFeedback.length} feedback records`)
  
  // Debug: Log ALL feedback records with their vendor assignments
  console.log(`[getProductFeedback] 📊 COMPLETE FEEDBACK LIST (${transformedFeedback.length} records):`)
  transformedFeedback.forEach((fb: any, index: number) => {
    console.log(`[getProductFeedback]   [${index + 1}] OrderId: ${fb.orderId}, ProductId: ${fb.productId}, Uniform: ${fb.uniformId?.name || 'N/A'}, Vendor: ${fb.vendorId?.name || 'Unknown'}, VendorId: ${fb.vendorId?._id || 'null'}`)
  })
  
  if (transformedFeedback.length > 0 && isCompanyAdminUser) {
    const vendorsInResponse = new Set(transformedFeedback
      .filter(f => f.vendorId && f.vendorId.name && f.vendorId.name.trim() !== '')
      .map(f => f.vendorId.name))
    console.log(`[getProductFeedback] ✅ Company Admin response includes ${vendorsInResponse.size} unique vendors:`, Array.from(vendorsInResponse))
    
    // Group by vendor for debugging
    const vendorGroups = transformedFeedback.reduce((acc: any, fb: any) => {
      const vendorName = fb.vendorId?.name || 'Unknown'
      if (!acc[vendorName]) {
        acc[vendorName] = []
      }
      acc[vendorName].push({
        orderId: fb.orderId,
        productId: fb.productId,
        uniformName: fb.uniformId?.name
      })
      return acc
    }, {})
    
    console.log(`[getProductFeedback] 📊 Feedback grouped by vendor:`, 
      Object.entries(vendorGroups).map(([vendor, items]: [string, any]) => ({
        vendor,
        count: items.length,
        items: items
      }))
    )
    
    // Final check: Log any feedback still missing vendor
    const missingVendor = transformedFeedback.filter(f => !f.vendorId || !f.vendorId.name || f.vendorId.name.trim() === '')
    if (missingVendor.length > 0) {
      console.error(`[getProductFeedback] ❌ CRITICAL: ${missingVendor.length} feedback records still missing vendorId for Company Admin:`, 
        missingVendor.map(f => ({ id: f._id, orderId: f.orderId, productId: f.productId })))
    }
  }
  
  return transformedFeedback
}

// ============================================================================
// RETURN & REPLACEMENT REQUEST FUNCTIONS
// ============================================================================

/**
 * Generate unique return request ID (6-digit, starting from 600001)
 */
async function generateReturnRequestId(): Promise<string> {
  await connectDB()
  
  // Find the highest existing return request ID
  const lastRequest = await ReturnRequest.findOne()
    .sort({ returnRequestId: -1 })
    .select('returnRequestId')
    .lean()
  
  if (!lastRequest || !lastRequest.returnRequestId) {
    return '600001'
  }
  
  const lastId = parseInt(lastRequest.returnRequestId)
  const nextId = lastId + 1
  
  // Ensure we stay within 6-digit range (600001-699999)
  if (nextId >= 700000) {
    throw new Error('Return request ID limit reached (699999). Please contact system administrator.')
  }
  
  return nextId.toString().padStart(6, '0')
}

/**
 * Validate if a product in a delivered order is eligible for return
 * 
 * Rules:
 * 1. Order status must be DELIVERED
 * 2. Product must not already have an active/completed replacement
 * 3. Return request must be within return window (default: 14 days)
 * 4. Quantity requested ≤ quantity delivered
 */
export async function validateReturnEligibility(
  orderId: string,
  itemIndex: number,
  requestedQty: number,
  returnWindowDays: number = 14
): Promise<{
  eligible: boolean
  errors: string[]
  orderItem?: any
  deliveredDate?: Date
}> {
  await connectDB()
  
  const errors: string[] = []
  
  // Find the order - try multiple formats for robustness
  let order = await Order.findOne({ id: orderId }).lean()
  let isSplitOrder = false
  let actualChildOrder: any = null
  
  if (!order) {
    // Try with _id if orderId looks like ObjectId
    if (orderId && orderId.length === 24 && /^[0-9a-fA-F]{24}$/.test(orderId)) {
      order = await Order.findById(orderId).lean()
    }
    // Try with parentOrderId (for split orders)
    if (!order) {
      // This might be a parent order ID - find all child orders
      const childOrders = await Order.find({ parentOrderId: orderId })
        .populate('items.uniformId', 'id name')
        .lean()
        .sort({ vendorName: 1 }) // Sort by vendor name for consistency
      
      if (childOrders.length > 0) {
        isSplitOrder = true
        console.log(`[validateReturnEligibility] Found split order with ${childOrders.length} child orders`)
        
        // Reconstruct the grouped order items (same logic as getOrdersByEmployee)
        let currentItemIndex = 0
        for (const childOrder of childOrders) {
          const childItems = childOrder.items || []
          // Check if the requested itemIndex falls within this child order's items
          if (itemIndex >= currentItemIndex && itemIndex < currentItemIndex + childItems.length) {
            // Found the child order containing this item
            actualChildOrder = childOrder
            const localItemIndex = itemIndex - currentItemIndex
            order = {
              ...childOrder,
              items: childItems,
            }
            console.log(`[validateReturnEligibility] Item at index ${itemIndex} is in child order ${childOrder.id} at local index ${localItemIndex}`)
            break
          }
          currentItemIndex += childItems.length
        }
        
        // If we didn't find the item, create a grouped order for error checking
        if (!order) {
          const allItems = childOrders.flatMap(o => o.items || [])
          order = {
            ...childOrders[0],
            id: orderId,
            items: allItems,
            isSplitOrder: true,
          }
        }
      } else {
        // Try finding by parentOrderId as a direct lookup (single child order)
        order = await Order.findOne({ parentOrderId: orderId }).lean()
      }
    }
  }
  
  if (!order) {
    return {
      eligible: false,
      errors: ['Order not found'],
    }
  }
  
  // For split orders, check the status of the specific child order containing the item
  const orderToCheck = actualChildOrder || order
  const statusToCheck = orderToCheck.status
  
  // Check order status
  if (statusToCheck !== 'Delivered') {
    errors.push(`Order status must be "Delivered". Current status: "${statusToCheck}"`)
    if (isSplitOrder && actualChildOrder) {
      errors.push(`Note: This is a split order. The item you're returning is in order ${actualChildOrder.id} which has status "${statusToCheck}"`)
    }
  }
  
  // For split orders, we need to find the correct item in the correct child order
  let orderItem: any = null
  if (isSplitOrder && actualChildOrder) {
    // Recalculate the local item index within the child order
    let currentItemIndex = 0
    const childOrders = await Order.find({ parentOrderId: orderId })
      .populate('items.uniformId', 'id name')
      .lean()
      .sort({ vendorName: 1 })
    
    for (const childOrder of childOrders) {
      const childItems = childOrder.items || []
      if (itemIndex >= currentItemIndex && itemIndex < currentItemIndex + childItems.length) {
        const localItemIndex = itemIndex - currentItemIndex
        orderItem = childItems[localItemIndex]
        break
      }
      currentItemIndex += childItems.length
    }
  } else {
    // Regular order - use itemIndex directly
    orderItem = order.items?.[itemIndex]
  }
  
  // Check item index
  if (!orderItem) {
    errors.push('Invalid item index')
    return { eligible: false, errors }
  }
  
  // Check if there's already an active/completed return request for this product in this order
  const existingReturn = await ReturnRequest.findOne({
    originalOrderId: orderId,
    originalOrderItemIndex: itemIndex,
    status: { $in: ['REQUESTED', 'APPROVED', 'COMPLETED'] },
  }).lean()
  
  if (existingReturn) {
    errors.push('A return request already exists for this product in this order')
  }
  
  // Check quantity
  if (requestedQty <= 0) {
    errors.push('Requested quantity must be greater than 0')
  } else if (requestedQty > orderItem.quantity) {
    errors.push(`Requested quantity (${requestedQty}) cannot exceed delivered quantity (${orderItem.quantity})`)
  }
  
  // Check return window (if order has updatedAt, use that; otherwise use orderDate)
  // For split orders, use the actual child order's date
  const orderForDate = actualChildOrder || order
  const deliveredDate = orderForDate.updatedAt || orderForDate.orderDate || new Date()
  const daysSinceDelivery = Math.floor((Date.now() - new Date(deliveredDate).getTime()) / (1000 * 60 * 60 * 24))
  
  if (daysSinceDelivery > returnWindowDays) {
    errors.push(`Return request must be submitted within ${returnWindowDays} days of delivery. ${daysSinceDelivery} days have passed.`)
  }
  
  return {
    eligible: errors.length === 0,
    errors,
    orderItem: toPlainObject(orderItem),
    deliveredDate: deliveredDate ? new Date(deliveredDate) : undefined,
  }
}

/**
 * Create a return request
 */
export async function createReturnRequest(requestData: {
  originalOrderId: string
  originalOrderItemIndex: number
  requestedQty: number
  requestedSize: string
  reason?: string
  comments?: string
  requestedBy: string // Employee email/ID
  returnWindowDays?: number
}): Promise<any> {
  await connectDB()
  
  // Validate eligibility
  const validation = await validateReturnEligibility(
    requestData.originalOrderId,
    requestData.originalOrderItemIndex,
    requestData.requestedQty,
    requestData.returnWindowDays || 14
  )
  
  if (!validation.eligible) {
    throw new Error(`Return request not eligible: ${validation.errors.join(', ')}`)
  }
  
  // Get order and item details - try multiple formats for robustness
  // Handle split orders correctly (same logic as validateReturnEligibility)
  let order = await Order.findOne({ id: requestData.originalOrderId })
    .populate('employeeId', 'id employeeId firstName lastName email')
    .populate('companyId', 'id name')
    .populate('items.uniformId', 'id name')
    .lean()
  
  let isSplitOrder = false
  let actualChildOrder: any = null
  
  if (!order) {
    // Try with _id if originalOrderId looks like ObjectId
    if (requestData.originalOrderId && requestData.originalOrderId.length === 24 && /^[0-9a-fA-F]{24}$/.test(requestData.originalOrderId)) {
      order = await Order.findById(requestData.originalOrderId)
        .populate('employeeId', 'id employeeId firstName lastName email')
        .populate('companyId', 'id name')
        .populate('items.uniformId', 'id name')
        .lean()
    }
    // Try with parentOrderId (for split orders)
    if (!order) {
      // This might be a parent order ID - find all child orders
      const childOrders = await Order.find({ parentOrderId: requestData.originalOrderId })
        .populate('employeeId', 'id employeeId firstName lastName email')
        .populate('companyId', 'id name')
        .populate('items.uniformId', 'id name')
        .lean()
        .sort({ vendorName: 1 }) // Sort by vendor name for consistency
      
      if (childOrders.length > 0) {
        isSplitOrder = true
        console.log(`[createReturnRequest] Found split order with ${childOrders.length} child orders`)
        
        // Reconstruct the grouped order items (same logic as validateReturnEligibility)
        let currentItemIndex = 0
        for (const childOrder of childOrders) {
          const childItems = childOrder.items || []
          // Check if the requested itemIndex falls within this child order's items
          if (requestData.originalOrderItemIndex >= currentItemIndex && requestData.originalOrderItemIndex < currentItemIndex + childItems.length) {
            // Found the child order containing this item
            actualChildOrder = childOrder
            const localItemIndex = requestData.originalOrderItemIndex - currentItemIndex
            order = {
              ...childOrder,
              items: childItems,
            }
            console.log(`[createReturnRequest] Item at index ${requestData.originalOrderItemIndex} is in child order ${childOrder.id} at local index ${localItemIndex}`)
            break
          }
          currentItemIndex += childItems.length
        }
        
        // If we didn't find the item, create a grouped order for error checking
        if (!order) {
          const allItems = childOrders.flatMap(o => o.items || [])
          order = {
            ...childOrders[0],
            id: requestData.originalOrderId,
            items: allItems,
            isSplitOrder: true,
          }
        }
      } else {
        // Try finding by parentOrderId as a direct lookup (single child order)
        order = await Order.findOne({ parentOrderId: requestData.originalOrderId })
          .populate('employeeId', 'id employeeId firstName lastName email')
          .populate('companyId', 'id name')
          .populate('items.uniformId', 'id name')
          .lean()
      }
    }
  }
  
  if (!order) {
    throw new Error('Order not found')
  }
  
  // For split orders, we need to find the correct item in the correct child order
  let orderItem: any = null
  if (isSplitOrder && actualChildOrder) {
    // Recalculate the local item index within the child order
    let currentItemIndex = 0
    const childOrders = await Order.find({ parentOrderId: requestData.originalOrderId })
      .populate('items.uniformId', 'id name')
      .lean()
      .sort({ vendorName: 1 })
    
    for (const childOrder of childOrders) {
      const childItems = childOrder.items || []
      if (requestData.originalOrderItemIndex >= currentItemIndex && requestData.originalOrderItemIndex < currentItemIndex + childItems.length) {
        const localItemIndex = requestData.originalOrderItemIndex - currentItemIndex
        orderItem = childItems[localItemIndex]
        break
      }
      currentItemIndex += childItems.length
    }
  } else {
    // Regular order - use itemIndex directly
    orderItem = order.items?.[requestData.originalOrderItemIndex]
  }
  
  // Validate that orderItem exists
  if (!orderItem) {
    throw new Error(`Order item not found at index ${requestData.originalOrderItemIndex}. Order has ${order.items?.length || 0} items.`)
  }
  
  // Validate that orderItem has uniformId
  if (!orderItem.uniformId) {
    throw new Error(`Order item at index ${requestData.originalOrderItemIndex} is missing uniformId. Item data: ${JSON.stringify(orderItem)}`)
  }
  
  // Get employee - prefer using the employee from the order (already populated)
  // This is more reliable than looking up by email again
  let employee: any = null
  
  // First, try to use the employee from the order (most reliable)
  if (order.employeeId) {
    if (typeof order.employeeId === 'object' && order.employeeId._id) {
      // It's a populated object, use it directly
      employee = order.employeeId
      // Ensure it's a plain object
      if (employee.toObject) {
        employee = employee.toObject()
      }
      employee = toPlainObject(employee)
    } else if (typeof order.employeeId === 'object' && order.employeeId.id) {
      // It's a populated object with id field
      employee = order.employeeId
      employee = toPlainObject(employee)
    } else {
      // It's an ObjectId, fetch the employee
      employee = await Employee.findById(order.employeeId)
        .populate('companyId', 'id name')
        .populate('locationId', 'id name address city state pincode')
        .lean()
      if (employee) {
        employee = toPlainObject(employee)
      }
    }
  }
  
  // If order employee lookup failed, try by email (handles encrypted emails)
  if (!employee) {
    console.log(`[createReturnRequest] Order employee not found, trying email lookup: ${requestData.requestedBy}`)
    employee = await getEmployeeByEmail(requestData.requestedBy)
  }
  
  // If still not found by email, try by employeeId or id
  if (!employee) {
    console.log(`[createReturnRequest] Email lookup failed, trying ID lookup: ${requestData.requestedBy}`)
    const employeeDoc = await Employee.findOne({
      $or: [
        { employeeId: requestData.requestedBy },
        { id: requestData.requestedBy },
      ],
    })
      .populate('companyId', 'id name')
      .populate('locationId', 'id name address city state pincode')
      .lean()
    
    if (employeeDoc) {
      employee = toPlainObject(employeeDoc)
    }
  }
  
  // Final fallback: if requestedBy looks like an ObjectId, try that
  if (!employee && requestData.requestedBy && requestData.requestedBy.length === 24 && /^[0-9a-fA-F]{24}$/.test(requestData.requestedBy)) {
    console.log(`[createReturnRequest] Trying ObjectId lookup: ${requestData.requestedBy}`)
    const employeeDoc = await Employee.findById(requestData.requestedBy)
      .populate('companyId', 'id name')
      .populate('locationId', 'id name address city state pincode')
      .lean()
    
    if (employeeDoc) {
      employee = toPlainObject(employeeDoc)
    }
  }
  
  if (!employee) {
    console.error(`[createReturnRequest] Employee lookup failed for: ${requestData.requestedBy}`)
    console.error(`[createReturnRequest] Order employeeId:`, order.employeeId)
    throw new Error(`Employee not found: ${requestData.requestedBy}`)
  }
  
  // Validate that the requestedBy email matches the order's employee (security check)
  // Get the employee's email for comparison (decrypt if needed)
  let employeeEmail = employee.email
  if (employeeEmail) {
    try {
      const { decrypt } = require('../utils/encryption')
      employeeEmail = decrypt(employeeEmail)
    } catch (error) {
      // Email might already be decrypted or decryption failed, use as-is
      console.log(`[createReturnRequest] Email decryption not needed or failed, using as-is`)
    }
  }
  
  // Compare requestedBy with employee email (case-insensitive)
  if (requestData.requestedBy && employeeEmail && 
      requestData.requestedBy.toLowerCase().trim() !== employeeEmail.toLowerCase().trim() &&
      requestData.requestedBy !== employee.id &&
      requestData.requestedBy !== employee.employeeId) {
    console.warn(`[createReturnRequest] Email mismatch: requestedBy=${requestData.requestedBy}, employeeEmail=${employeeEmail}`)
    // Don't throw error, just log warning - the order's employee is the authoritative source
  }
  
  // Get uniform
  const uniform = await Uniform.findById(orderItem.uniformId).lean()
  if (!uniform) {
    throw new Error('Uniform product not found')
  }
  
  // Generate return request ID
  const returnRequestId = await generateReturnRequestId()
  
  // Get company ID - extract ObjectId from populated object or use directly
  let companyIdObjectId: mongoose.Types.ObjectId
  if (typeof order.companyId === 'object' && order.companyId !== null) {
    if (order.companyId._id) {
      companyIdObjectId = order.companyId._id instanceof mongoose.Types.ObjectId
        ? order.companyId._id
        : new mongoose.Types.ObjectId(order.companyId._id.toString())
    } else {
      // Populated object without _id - fetch company to get _id
      const company = await Company.findOne({ 
        $or: [
          { id: order.companyId.id },
          { _id: order.companyId }
        ]
      }).select('_id').lean()
      if (company && company._id) {
        companyIdObjectId = company._id instanceof mongoose.Types.ObjectId
          ? company._id
          : new mongoose.Types.ObjectId(company._id.toString())
      } else {
        throw new Error('Company not found for return request')
      }
    }
  } else if (mongoose.Types.ObjectId.isValid(order.companyId)) {
    companyIdObjectId = new mongoose.Types.ObjectId(order.companyId.toString())
  } else {
    throw new Error('Invalid companyId format')
  }
  
  // Get employee ID - CRITICAL: Fetch employee from DB to get actual _id ObjectId
  // The employee object we have might be a plain object from populate, which doesn't have _id
  let employeeIdObjectId: mongoose.Types.ObjectId
  
  // Use the employee's id or employeeId to fetch the actual document with _id
  const employeeIdToSearch = employee?.id || employee?.employeeId
  if (!employeeIdToSearch) {
    throw new Error('Employee ID not found in employee object')
  }
  
  // Fetch employee from database to get the actual _id ObjectId
  const db = mongoose.connection.db
  if (!db) {
    throw new Error('Database connection not available')
  }
  
  const rawEmployee = await db.collection('employees').findOne({
    $or: [
      { id: employeeIdToSearch },
      { employeeId: employeeIdToSearch }
    ]
  })
  
  if (!rawEmployee || !rawEmployee._id) {
    console.error(`[createReturnRequest] Employee not found in database for id: ${employeeIdToSearch}`)
    throw new Error(`Employee not found in database: ${employeeIdToSearch}`)
  }
  
  employeeIdObjectId = rawEmployee._id instanceof mongoose.Types.ObjectId
    ? rawEmployee._id
    : new mongoose.Types.ObjectId(rawEmployee._id.toString())
  
  const employeeIdNum = employee.employeeId || employee.id || ''
  
  // Create return request
  const returnRequest = await ReturnRequest.create({
    returnRequestId,
    originalOrderId: requestData.originalOrderId,
    originalOrderItemIndex: requestData.originalOrderItemIndex,
    productId: orderItem.productId,
    uniformId: orderItem.uniformId,
    uniformName: orderItem.uniformName,
    employeeId: employeeIdObjectId, // Ensure this is an ObjectId, not an object
    employeeIdNum,
    companyId: companyIdObjectId,
    requestedQty: requestData.requestedQty,
    originalSize: orderItem.size,
    requestedSize: requestData.requestedSize,
    reason: requestData.reason,
    comments: requestData.comments,
    status: 'REQUESTED',
    requestedBy: requestData.requestedBy,
    returnWindowDays: requestData.returnWindowDays || 14,
  })
  
  return toPlainObject(returnRequest)
}

/**
 * Get return requests for an employee
 */
export async function getReturnRequestsByEmployee(employeeId: string): Promise<any[]> {
  await connectDB()
  
  // Find employee
  const employee = await Employee.findOne({
    $or: [
      { employeeId: employeeId },
      { id: employeeId },
    ],
  }).select('_id employeeId id').lean()
  
  if (!employee) {
    return []
  }
  
  const employeeIdNum = employee.employeeId || employee.id
  
  // Find return requests
  const returnRequests = await ReturnRequest.find({
    $or: [
      { employeeId: employee._id },
      { employeeIdNum: employeeIdNum },
    ],
  })
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('uniformId', 'id name')
    .sort({ createdAt: -1 })
    .lean()
  
  return returnRequests.map((rr) => toPlainObject(rr))
}

/**
 * Get return requests for a company (for admin approval)
 */
export async function getReturnRequestsByCompany(companyId: string, status?: string): Promise<any[]> {
  await connectDB()
  
  // Find company - try multiple formats for robustness
  let company = await Company.findOne({ id: companyId }).select('_id id').lean()
  
  if (!company) {
    // Try with _id if companyId looks like ObjectId
    if (companyId && companyId.length === 24 && /^[0-9a-fA-F]{24}$/.test(companyId)) {
      company = await Company.findById(companyId).select('_id id').lean()
    }
    // Try as numeric ID (if companyId is a number string)
    if (!company && !isNaN(Number(companyId))) {
      company = await Company.findOne({ id: Number(companyId) }).select('_id id').lean()
    }
  }
  
  if (!company) {
    console.error(`[getReturnRequestsByCompany] Company not found for companyId: ${companyId}`)
    return []
  }
  
  const query: any = {
    companyId: company._id,
  }
  
  if (status) {
    query.status = status
  }
  
  // Find return requests
  const returnRequests = await ReturnRequest.find(query)
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('uniformId', 'id name')
    .sort({ createdAt: -1 })
    .lean()
  
  // Enrich return requests with vendor information from original order
  const enrichedReturnRequests = await Promise.all(
    returnRequests.map(async (rr) => {
      const plainRR = toPlainObject(rr)
      
      // Fetch the original order to get vendor information
      // Use the same robust logic as validateReturnEligibility and createReturnRequest
      let vendorName = null
      try {
        const itemIndex = rr.originalOrderItemIndex || 0
        
        // First, try to find order by id
        let originalOrder = await Order.findOne({ id: rr.originalOrderId })
          .populate('vendorId', 'id name')
          .lean()
        
        // If not found, try with _id (if originalOrderId is an ObjectId)
        if (!originalOrder && rr.originalOrderId && rr.originalOrderId.length === 24 && /^[0-9a-fA-F]{24}$/.test(rr.originalOrderId)) {
          originalOrder = await Order.findById(rr.originalOrderId)
            .populate('vendorId', 'id name')
            .lean()
        }
        
        // Check if this might be a parent order (has child orders) - same logic as validateReturnEligibility
        if (!originalOrder || !originalOrder.parentOrderId) {
          // Try finding child orders with parentOrderId (this might be a parent order ID)
          const childOrders = await Order.find({ parentOrderId: rr.originalOrderId })
            .populate('vendorId', 'id name')
            .sort({ vendorName: 1 }) // Sort by vendor name for consistency (same as validateReturnEligibility)
            .lean()
          
          if (childOrders.length > 0) {
            // This is a parent order with child orders - find which child contains the item
            let currentIndex = 0
            for (const childOrder of childOrders) {
              const childItems = childOrder.items || []
              if (itemIndex >= currentIndex && itemIndex < currentIndex + childItems.length) {
                // This child order contains the item - use its vendor
                if (childOrder.vendorName) {
                  vendorName = childOrder.vendorName
                } else if (childOrder.vendorId && typeof childOrder.vendorId === 'object' && childOrder.vendorId.name) {
                  vendorName = childOrder.vendorId.name
                } else if (childOrder.vendorId) {
                  // vendorId is an ObjectId, fetch vendor name
                  const vendor = await Vendor.findById(childOrder.vendorId).select('name').lean()
                  if (vendor) {
                    vendorName = vendor.name
                  }
                }
                console.log(`[getReturnRequestsByCompany] Found vendor ${vendorName} from child order ${childOrder.id} for item index ${itemIndex}`)
                break
              }
              currentIndex += childItems.length
            }
          } else if (originalOrder) {
            // Single order (not split) - use its vendor
            if (originalOrder.vendorName) {
              vendorName = originalOrder.vendorName
            } else if (originalOrder.vendorId && typeof originalOrder.vendorId === 'object' && originalOrder.vendorId.name) {
              vendorName = originalOrder.vendorId.name
            } else if (originalOrder.vendorId) {
              // vendorId is an ObjectId, fetch vendor name
              const vendor = await Vendor.findById(originalOrder.vendorId).select('name').lean()
              if (vendor) {
                vendorName = vendor.name
              }
            }
            console.log(`[getReturnRequestsByCompany] Found vendor ${vendorName} from single order ${originalOrder.id}`)
          }
        } else {
          // This is a child order - check if it contains the item
          if (originalOrder.items && originalOrder.items.length > itemIndex) {
            // This child order contains the item
            if (originalOrder.vendorName) {
              vendorName = originalOrder.vendorName
            } else if (originalOrder.vendorId && typeof originalOrder.vendorId === 'object' && originalOrder.vendorId.name) {
              vendorName = originalOrder.vendorId.name
            } else if (originalOrder.vendorId) {
              // vendorId is an ObjectId, fetch vendor name
              const vendor = await Vendor.findById(originalOrder.vendorId).select('name').lean()
              if (vendor) {
                vendorName = vendor.name
              }
            }
            console.log(`[getReturnRequestsByCompany] Found vendor ${vendorName} from child order ${originalOrder.id} for item index ${itemIndex}`)
          }
        }
      } catch (error) {
        console.error(`[getReturnRequestsByCompany] Error fetching vendor for return request ${rr.returnRequestId}:`, error)
      }
      
      return {
        ...plainRR,
        vendorName: vendorName || 'N/A'
      }
    })
  )
  
  return enrichedReturnRequests
}

/**
 * Get a single return request by ID
 */
export async function getReturnRequestById(returnRequestId: string): Promise<any> {
  await connectDB()
  
  const returnRequest = await ReturnRequest.findOne({ returnRequestId })
    .populate('employeeId', 'id firstName lastName email')
    .populate('companyId', 'id name')
    .populate('uniformId', 'id name')
    .lean()
  
  if (!returnRequest) {
    return null
  }
  
  return toPlainObject(returnRequest)
}

/**
 * Approve a return request and create replacement order
 */
export async function approveReturnRequest(
  returnRequestId: string,
  approvedBy: string
): Promise<any> {
  await connectDB()
  
  // Get return request
  const returnRequest = await ReturnRequest.findOne({ returnRequestId })
    .populate('employeeId', 'id employeeId firstName lastName email')
    .populate('companyId', 'id name')
    .populate('uniformId', 'id name')
    .lean()
  
  if (!returnRequest) {
    throw new Error('Return request not found')
  }
  
  if (returnRequest.status !== 'REQUESTED') {
    throw new Error(`Return request cannot be approved. Current status: ${returnRequest.status}`)
  }
  
  // Get original order - try multiple formats for robustness
  let originalOrder = await Order.findOne({ id: returnRequest.originalOrderId })
    .populate('employeeId', 'id employeeId firstName lastName email')
    .populate('companyId', 'id name')
    .lean()
  
  if (!originalOrder) {
    // Try with _id if originalOrderId looks like ObjectId
    if (returnRequest.originalOrderId && returnRequest.originalOrderId.length === 24 && /^[0-9a-fA-F]{24}$/.test(returnRequest.originalOrderId)) {
      originalOrder = await Order.findById(returnRequest.originalOrderId)
        .populate('employeeId', 'id employeeId firstName lastName email')
        .populate('companyId', 'id name')
        .lean()
    }
    // Try with parentOrderId (for split orders - the stored ID might be a parent order ID)
    if (!originalOrder) {
      originalOrder = await Order.findOne({ parentOrderId: returnRequest.originalOrderId })
        .populate('employeeId', 'id employeeId firstName lastName email')
        .populate('companyId', 'id name')
        .lean()
    }
  }
  
  if (!originalOrder) {
    throw new Error(`Original order not found: ${returnRequest.originalOrderId}`)
  }
  
  // Get uniform to get price and product ID
  const uniform = await Uniform.findById(returnRequest.uniformId).lean()
  if (!uniform) {
    throw new Error('Uniform product not found')
  }
  
  // Get product ID (string) - createOrder expects the product ID, not ObjectId
  const productId = uniform.id || uniform._id?.toString()
  if (!productId) {
    throw new Error('Product ID not found for uniform')
  }
  
  // Get employee
  const employee = typeof originalOrder.employeeId === 'object' && originalOrder.employeeId?._id
    ? originalOrder.employeeId
    : await Employee.findById(originalOrder.employeeId)
  
  if (!employee) {
    throw new Error('Employee not found')
  }
  
  const employeeId = employee.employeeId || employee.id
  
  // CRITICAL: For replacement orders, we must use the SAME vendor as the original order
  // Find the vendor from the original order (handle split orders)
  let originalVendorId: mongoose.Types.ObjectId | null = null
  let originalVendorName: string | null = null
  
  // For split orders, find the specific child order that contains the returned item
  if (originalOrder.parentOrderId || (originalOrder as any).isSplitOrder) {
    // This is a parent order - find the child order containing the item
    const childOrders = await Order.find({ 
      parentOrderId: originalOrder.id || originalOrder._id 
    }).lean()
    
    // Find which child order contains the item at originalOrderItemIndex
    let currentItemIndex = 0
    for (const childOrder of childOrders) {
      const childItems = childOrder.items || []
      if (returnRequest.originalOrderItemIndex >= currentItemIndex && 
          returnRequest.originalOrderItemIndex < currentItemIndex + childItems.length) {
        // Found the child order containing this item
        originalVendorId = childOrder.vendorId instanceof mongoose.Types.ObjectId
          ? childOrder.vendorId
          : (childOrder.vendorId ? new mongoose.Types.ObjectId(childOrder.vendorId.toString()) : null)
        originalVendorName = (childOrder as any).vendorName || null
        console.log(`[approveReturnRequest] Found vendor from child order: ${originalVendorName} (${originalVendorId})`)
        break
      }
      currentItemIndex += childItems.length
    }
  } else {
    // Regular order - use vendor directly
    originalVendorId = originalOrder.vendorId instanceof mongoose.Types.ObjectId
      ? originalOrder.vendorId
      : (originalOrder.vendorId ? new mongoose.Types.ObjectId(originalOrder.vendorId.toString()) : null)
    originalVendorName = (originalOrder as any).vendorName || null
    console.log(`[approveReturnRequest] Using vendor from original order: ${originalVendorName} (${originalVendorId})`)
  }
  
  if (!originalVendorId) {
    throw new Error('Original order does not have a vendor assigned. Cannot create replacement order.')
  }
  
  // Create replacement order using existing createOrder function
  // Replacement order uses same SKU, new size, requested quantity
  const replacementOrder = await createOrder({
    employeeId: employeeId,
    items: [
      {
        uniformId: productId, // Use product ID (string), not ObjectId
        uniformName: returnRequest.uniformName,
        size: returnRequest.requestedSize,
        quantity: returnRequest.requestedQty,
        price: uniform.price || 0, // Use current price from uniform
      },
    ],
    deliveryAddress: originalOrder.deliveryAddress,
    estimatedDeliveryTime: originalOrder.estimatedDeliveryTime,
    dispatchLocation: originalOrder.dispatchLocation,
  })
  
  // Get the replacement order ID (could be parentOrderId if split)
  const replacementOrderId = replacementOrder.parentOrderId || replacementOrder.id
  
  // Update replacement orders to mark them as REPLACEMENT type, use original vendor, and auto-approve
  // If it's a split order, update all child orders
  const ordersToUpdate = replacementOrder.parentOrderId
    ? await Order.find({ parentOrderId: replacementOrder.parentOrderId })
    : [await Order.findOne({ id: replacementOrderId })]
  
  for (const order of ordersToUpdate) {
    if (order) {
      order.orderType = 'REPLACEMENT'
      order.returnRequestId = returnRequestId
      // CRITICAL: Use the same vendor as the original order
      order.vendorId = originalVendorId
      if (originalVendorName) {
        order.vendorName = originalVendorName
      }
      // Auto-approve replacement orders since return request is already approved by company admin
      if (order.status === 'Awaiting approval' || order.status === 'Awaiting fulfilment') {
        order.status = 'Awaiting fulfilment'
      }
      await order.save()
      console.log(`[approveReturnRequest] Updated replacement order ${order.id} with vendor ${originalVendorName} (${originalVendorId})`)
    }
  }
  
  // Update return request
  await ReturnRequest.updateOne(
    { returnRequestId },
    {
      status: 'APPROVED',
      replacementOrderId,
      approvedBy,
      approvedAt: new Date(),
    }
  )
  
  // Get updated return request
  const updatedRequest = await getReturnRequestById(returnRequestId)
  
  return {
    returnRequest: updatedRequest,
    replacementOrder,
  }
}

/**
 * Reject a return request
 */
export async function rejectReturnRequest(
  returnRequestId: string,
  rejectedBy: string,
  rejectionReason?: string
): Promise<any> {
  await connectDB()
  
  // Get return request
  const returnRequest = await ReturnRequest.findOne({ returnRequestId }).lean()
  
  if (!returnRequest) {
    throw new Error('Return request not found')
  }
  
  if (returnRequest.status !== 'REQUESTED') {
    throw new Error(`Return request cannot be rejected. Current status: ${returnRequest.status}`)
  }
  
  // Update return request
  await ReturnRequest.updateOne(
    { returnRequestId },
    {
      status: 'REJECTED',
      approvedBy: rejectedBy,
      approvedAt: new Date(),
      comments: rejectionReason
        ? `${returnRequest.comments || ''}\n\nRejection reason: ${rejectionReason}`.trim()
        : returnRequest.comments,
    }
  )
  
  // Get updated return request
  const updatedRequest = await getReturnRequestById(returnRequestId)
  
  return updatedRequest
}

/**
 * Mark return request as completed when replacement is delivered
 * This should be called when replacement order status changes to "Delivered"
 */
export async function completeReturnRequest(returnRequestId: string): Promise<any> {
  await connectDB()
  
  // Get return request
  const returnRequest = await ReturnRequest.findOne({ returnRequestId }).lean()
  
  if (!returnRequest) {
    throw new Error('Return request not found')
  }
  
  if (returnRequest.status !== 'APPROVED') {
    throw new Error(`Return request cannot be completed. Current status: ${returnRequest.status}`)
  }
  
  // Update return request
  await ReturnRequest.updateOne(
    { returnRequestId },
    {
      status: 'COMPLETED',
    }
  )
  
  // Get updated return request
  const updatedRequest = await getReturnRequestById(returnRequestId)
  
  return updatedRequest
}

// ============================================================================
// PRODUCT SIZE CHART FUNCTIONS
// ============================================================================

/**
 * Get size chart for a product
 */
export async function getProductSizeChart(productId: string): Promise<any | null> {
  await connectDB()
  
  const sizeChart = await ProductSizeChart.findOne({ productId }).lean()
  
  if (!sizeChart) {
    return null
  }
  
  return toPlainObject(sizeChart)
}

/**
 * Get size charts for multiple products (bulk fetch)
 */
export async function getProductSizeCharts(productIds: string[]): Promise<Record<string, any>> {
  await connectDB()
  
  const sizeCharts = await ProductSizeChart.find({ productId: { $in: productIds } }).lean()
  
  const result: Record<string, any> = {}
  sizeCharts.forEach((chart) => {
    result[chart.productId] = toPlainObject(chart)
  })
  
  return result
}

/**
 * Create or update size chart for a product
 */
export async function upsertProductSizeChart(
  productId: string,
  imageUrl: string,
  imageType: 'jpg' | 'jpeg' | 'png' | 'webp',
  fileName: string,
  fileSize: number
): Promise<any> {
  await connectDB()
  
  // Validate product exists
  const product = await Uniform.findOne({ id: productId }).lean()
  if (!product) {
    throw new Error(`Product with ID ${productId} not found`)
  }
  
  // Check if size chart already exists
  const existing = await ProductSizeChart.findOne({ productId })
  
  if (existing) {
    // Update existing
    existing.imageUrl = imageUrl
    existing.imageType = imageType
    existing.fileName = fileName
    existing.fileSize = fileSize
    await existing.save()
    return toPlainObject(existing)
  } else {
    // Create new
    const sizeChart = new ProductSizeChart({
      productId,
      imageUrl,
      imageType,
      fileName,
      fileSize,
    })
    await sizeChart.save()
    return toPlainObject(sizeChart)
  }
}

/**
 * Delete size chart for a product
 */
export async function deleteProductSizeChart(productId: string): Promise<boolean> {
  await connectDB()
  
  const result = await ProductSizeChart.deleteOne({ productId })
  return result.deletedCount > 0
}

