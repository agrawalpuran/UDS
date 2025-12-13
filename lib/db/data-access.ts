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
import { ProductCompany, ProductVendor } from '../models/Relationship'
// VendorCompany relationships are now derived from ProductCompany + ProductVendor
// No need to import VendorCompany model
import DesignationProductEligibility from '../models/DesignationProductEligibility'
import VendorInventory from '../models/VendorInventory'
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
  if (obj.branchId) {
    // Handle populated branchId (object with id and name) or ObjectId
    if (obj.branchId && typeof obj.branchId === 'object') {
      if (obj.branchId.id) {
        obj.branchId = obj.branchId.id // If populated, use the id field
      } else {
        obj.branchId = obj.branchId.toString()
      }
    } else if (obj.branchId) {
      obj.branchId = obj.branchId.toString()
    }
  }
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
    
    // Use the raw products we found earlier
    productsToUse = matchingProducts.map((p: any) => {
      const product: any = { ...p }
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
  // If no vendors exist at all, show all products (for catalog display)
  const hasAnyVendors = enhancedProductVendorLinks.length > 0
  const productsWithVendors = productsToUse.filter((product: any) => {
    const productIdStr = product._id.toString()
    const vendorsForProduct = productVendorMap.get(productIdStr)
    
    // If no vendors exist in the system at all, show all products
    if (!hasAnyVendors) {
      console.log(`getProductsByCompany: No vendors in system, showing product ${product.id} (${product.name}) without vendor requirement`)
      return true
    }
    
    if (!vendorsForProduct || vendorsForProduct.size === 0) {
      console.log(`getProductsByCompany: Product ${product.id} (${product.name}) has no vendors linked - skipping`)
      return false
    }
    
    // Product is linked to company and has vendors - it can be fulfilled
    return true
  })
  
  console.log(`getProductsByCompany(${companyId}): Filtered to ${productsWithVendors.length} products${hasAnyVendors ? ' with vendors for fulfillment' : ' (no vendors in system, showing all)'}`)
  
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
    
    // Use the raw products we found earlier
    productsToUse = matchingProducts.map((p: any) => {
      const product: any = { ...p }
      // Convert _id to proper format
      if (product._id) {
        product._id = new mongoose.Types.ObjectId(product._id.toString())
      }
      // vendorId removed from Uniform model - use ProductVendor collection instead
      return product
    })
  }
  
  return productsToUse.map((p: any) => toPlainObject(p))
}

export async function getProductsByVendor(vendorId: string): Promise<any[]> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  if (!vendor) return []

  // Get products linked to this vendor via ProductVendor relationships
  const productVendorLinks = await ProductVendor.find({ vendorId: vendor._id })
    .populate('productId')
    .lean()

  if (productVendorLinks.length === 0) {
    return []
  }

  const productIds = productVendorLinks
    .map((link: any) => link.productId?._id)
    .filter((id: any) => id !== null && id !== undefined)

  if (productIds.length === 0) {
    return []
  }

  // Fetch products
  const products = await Uniform.find({
    _id: { $in: productIds },
  })
    .lean()

  // Get inventory data for these products
  const inventoryRecords = await VendorInventory.find({
    vendorId: vendor._id,
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

    return {
      ...toPlainObject(product),
      inventory: inventory.sizeInventory,
      totalStock: inventory.totalStock,
      // For backward compatibility, set stock to totalStock
      stock: inventory.totalStock,
    }
  })

  return productsWithInventory
}

export async function getAllProducts(): Promise<any[]> {
  await connectDB()
  
  const products = await Uniform.find()
    .populate('vendorId', 'id name')
    .lean()

  return products.map((p: any) => toPlainObject(p))
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
  await connectDB()
  
  // Generate unique product ID
  let nextIdNum = 1
  let productId = ''
  let isUnique = false
  while (!isUnique) {
    productId = `PROD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
    const existingProduct = await Uniform.findOne({ id: productId })
    if (!existingProduct) {
      isUnique = true
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
    stock: productData.stock || 0,
    companyIds: [],
  }
  
  const newProduct = await Uniform.create(productDataToCreate)
  
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
  }
): Promise<any> {
  await connectDB()
  
  const product = await Uniform.findOne({ id: productId })
  if (!product) {
    throw new Error(`Product not found: ${productId}`)
  }
  
  // Update fields
  if (updateData.name !== undefined) product.name = updateData.name
  if (updateData.category !== undefined) product.category = updateData.category
  if (updateData.gender !== undefined) product.gender = updateData.gender
  if (updateData.sizes !== undefined) product.sizes = updateData.sizes
  if (updateData.price !== undefined) product.price = updateData.price
  if (updateData.image !== undefined) product.image = updateData.image
  if (updateData.stock !== undefined) product.stock = updateData.stock
  
  // Handle SKU update (check for duplicates)
  if (updateData.sku !== undefined && updateData.sku !== product.sku) {
    const existingBySku = await Uniform.findOne({ sku: updateData.sku })
    if (existingBySku && existingBySku.id !== productId) {
      throw new Error(`Product with SKU already exists: ${updateData.sku}`)
    }
    product.sku = updateData.sku
  }
  
  // vendorId removed from Uniform model - use ProductVendor collection to manage vendor relationships
  // To update vendor relationships, use createProductVendor or deleteProductVendor functions
  
  await product.save()
  
  // Fetch the updated product with populated fields using the string ID (more reliable)
  const updated = await Uniform.findOne({ id: productId })
    .populate('vendorId', 'id name')
    .lean()
  
  if (!updated) {
    // Fallback: try to use the saved product directly
    await product.populate('vendorId', 'id name')
    return toPlainObject(product)
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

// ========== COMPANY FUNCTIONS ==========

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
  let company = null
  if (numericCompanyId !== null) {
    company = await Company.findOne({ id: numericCompanyId })
      .populate('adminId', 'id employeeId firstName lastName email')
      .lean()
  }
  
  // If not found by numeric ID, try as string ID (for backward compatibility)
  if (!company && typeof companyId === 'string') {
    company = await Company.findOne({ id: companyId })
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
  
  await company.save()
  
  // Fetch the updated company using the string ID (more reliable than using the saved document)
  // Don't populate adminId to avoid any issues - it's not needed for settings response
  const updated = await Company.findOne({ id: companyId }).lean()
  
  if (!updated) {
    // Fallback: try to use the saved company directly (convert to plain object)
    const savedPlain = company.toObject ? company.toObject() : company
    return toPlainObject(savedPlain)
  }
  
  return toPlainObject(updated)
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
    .populate('branchId', 'id name address city pincode')
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
    // First, get the raw employee document to ensure we have the companyId ObjectId
    const rawEmployee = await db.collection('employees').findOne({ email: encryptedEmail })
    
    if (rawEmployee) {
      console.log(`[getEmployeeByEmail] Raw employee companyId:`, rawEmployee.companyId, 'Type:', typeof rawEmployee.companyId)
      
      // Now fetch with Mongoose to get populated fields and decryption
      employee = await Employee.findOne({ email: encryptedEmail })
        .populate('companyId', 'id name')
        .populate('branchId', 'id name address city pincode')
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
      .populate('branchId', 'id name address city pincode')
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
      .populate('branchId', 'id name address city pincode')
      .lean()
    
    for (const emp of allEmployees) {
      if (emp.email && typeof emp.email === 'string') {
        try {
          const decryptedEmail = decrypt(emp.email)
          if (decryptedEmail.toLowerCase() === trimmedEmail.toLowerCase()) {
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
    .populate('branchId', 'id name address city pincode')
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
  
  // Ensure Branch model is registered before any Employee queries
  if (!mongoose.models.Branch) {
    require('../models/Branch')
  }
  
  const company = await Company.findOne({ id: companyId })
  if (!company) {
    console.log(`[getEmployeesByCompany] Company not found: ${companyId}`)
    return []
  }

  console.log(`[getEmployeesByCompany] Looking for employees with companyId: ${company._id} (${company.id})`)

  // Check if branchId exists in Employee schema paths
  const employeeSchema = Employee.schema
  const hasBranchId = employeeSchema.paths.branchId !== undefined

  // Use raw MongoDB collection for more reliable ObjectId comparison
  const db = mongoose.connection.db
  if (!db) {
    console.log(`[getEmployeesByCompany] Database connection not available`)
    return []
  }
  
  // Use string comparison approach (most reliable for ObjectId matching)
  const companyIdStr = company._id.toString()
  const allEmployees = await db.collection('employees').find({}).toArray()
  
  const rawEmployees = allEmployees.filter((e: any) => {
    if (!e.companyId) return false
    const empCompanyId = e.companyId.toString ? e.companyId.toString() : String(e.companyId)
    return empCompanyId === companyIdStr
  })
  
  console.log(`[getEmployeesByCompany] Found ${rawEmployees.length} employees using string comparison for company ${companyId} (target companyId: ${companyIdStr})`)

  // If no employees found, return empty array
  if (rawEmployees.length === 0) {
    console.log(`[getEmployeesByCompany] No employees found. Company _id: ${company._id}, Company id: ${companyId}`)
    // Debug: Check what companyIds exist in employees
    const sampleEmployees = await db.collection('employees').find({}).limit(3).toArray()
    console.log(`[getEmployeesByCompany] Sample employee companyIds:`, sampleEmployees.map((e: any) => ({
      employeeId: e.employeeId || e.id,
      companyId: e.companyId,
      companyIdType: typeof e.companyId,
      companyIdStr: e.companyId?.toString ? e.companyId.toString() : String(e.companyId)
    })))
    return []
  }

  // Convert to ObjectIds for Mongoose query
  const employeeIds = rawEmployees.map(e => {
    // Ensure we're using proper ObjectId
    if (e._id && typeof e._id === 'object' && e._id.toString) {
      return new mongoose.Types.ObjectId(e._id.toString())
    }
    return e._id
  })
  console.log(`[getEmployeesByCompany] Querying ${employeeIds.length} employees by _id`)
  console.log(`[getEmployeesByCompany] Sample employeeIds:`, employeeIds.slice(0, 2).map(id => id.toString()))
  
  let query = Employee.find({ _id: { $in: employeeIds } })
    .populate('companyId', 'id name')
  
  // Only populate branchId if the field exists in the schema
  if (hasBranchId) {
    try {
      query = query.populate('branchId', 'id name address city pincode')
    } catch (error) {
      // If populate fails, continue without populating branchId
      console.warn('Could not populate branchId:', error)
    }
  }

  const employees = await query.lean()
  console.log(`[getEmployeesByCompany] Mongoose query returned ${employees?.length || 0} employees`)
  
  // If Mongoose query returns 0, try using raw collection as fallback
  if (!employees || employees.length === 0) {
    console.warn(`[getEmployeesByCompany] Mongoose query returned 0 employees, using raw collection data as fallback`)
    // Use the raw employees we found earlier, but we need to decrypt them
    const { decrypt } = require('../utils/encryption')
    
    // Get all companies for companyId conversion
    const allCompanies = await db.collection('companies').find({}).toArray()
    const companyMap = new Map()
    allCompanies.forEach((c: any) => {
      companyMap.set(c._id.toString(), c.id)
    })
    
    const decryptedRawEmployees = rawEmployees.map((e: any) => {
      const sensitiveFields = ['email', 'mobile', 'address', 'firstName', 'lastName', 'designation']
      const decrypted: any = { ...e }
      for (const field of sensitiveFields) {
        if (decrypted[field] && typeof decrypted[field] === 'string' && decrypted[field].includes(':')) {
          try {
            decrypted[field] = decrypt(decrypted[field])
          } catch (error) {
            console.warn(`Failed to decrypt field ${field}:`, error)
          }
        }
      }
      // Convert _id to id
      if (decrypted._id) {
        decrypted.id = decrypted._id.toString()
      }
      // Convert companyId ObjectId to string ID
      if (decrypted.companyId) {
        const companyIdStr = decrypted.companyId.toString()
        const companyStringId = companyMap.get(companyIdStr)
        if (companyStringId) {
          decrypted.companyId = companyStringId
        }
      }
      return decrypted
    })
    
    const plainEmployees = decryptedRawEmployees.map((e: any) => {
      const plain = toPlainObject(e)
      // Ensure companyId is the string ID
      if (plain && plain.companyId && typeof plain.companyId === 'string' && plain.companyId.length === 24 && /^[0-9a-fA-F]{24}$/.test(plain.companyId)) {
        const companyStringId = companyMap.get(plain.companyId)
        if (companyStringId) {
          plain.companyId = companyStringId
        }
      }
      return plain
    })
    
    return plainEmployees
  }

  // Since we used .lean(), the post hooks don't run, so we need to manually decrypt sensitive fields
  const { decrypt } = require('../utils/encryption')
  const decryptedEmployees = employees.map((e: any) => {
    if (!e) return null
    const sensitiveFields = ['email', 'mobile', 'address', 'firstName', 'lastName', 'designation']
    for (const field of sensitiveFields) {
      if (e[field] && typeof e[field] === 'string' && e[field].includes(':')) {
        try {
          e[field] = decrypt(e[field])
        } catch (error) {
          // If decryption fails, keep original value
          console.warn(`Failed to decrypt field ${field} for employee ${e.id || e._id}:`, error)
        }
      }
    }
    return e
  }).filter((e: any) => e !== null)

  console.log(`[getEmployeesByCompany] After decryption: ${decryptedEmployees.length} employees`)
  
  // Get all companies for companyId conversion
  const allCompanies = await db.collection('companies').find({}).toArray()
  const companyMap = new Map()
  allCompanies.forEach((c: any) => {
    companyMap.set(c._id.toString(), c.id)
  })
  
  // Convert to plain objects and ensure companyId is the string ID
  const plainEmployees = decryptedEmployees.map((e: any) => {
    const plain = toPlainObject(e)
    
    // Ensure companyId is converted to string ID (not ObjectId string)
    if (plain && plain.companyId) {
      // If companyId is an ObjectId string (24 hex chars), look it up
      if (typeof plain.companyId === 'string' && plain.companyId.length === 24 && /^[0-9a-fA-F]{24}$/.test(plain.companyId)) {
        const companyStringId = companyMap.get(plain.companyId)
        if (companyStringId) {
          plain.companyId = companyStringId
          console.log(`[getEmployeesByCompany] Converted companyId from ObjectId ${plain.companyId.substring(0, 8)}... to string ID: ${companyStringId}`)
        } else {
          console.warn(`[getEmployeesByCompany] Company not found for ObjectId: ${plain.companyId}`)
        }
      } else if (typeof plain.companyId === 'object' && plain.companyId._id) {
        // If it's still an object with _id, convert it
        const companyStringId = companyMap.get(plain.companyId._id.toString())
        if (companyStringId) {
          plain.companyId = companyStringId
        }
      }
      // If companyId is already a string ID (like 'COMP-INDIGO'), keep it as is
    } else if (plain && !plain.companyId) {
      // If companyId is missing, try to get it from the raw employee document
      const rawEmployee = rawEmployees.find((r: any) => {
        const rawId = r._id?.toString ? r._id.toString() : String(r._id)
        const plainId = plain.id || plain._id?.toString()
        return rawId === plainId
      })
      if (rawEmployee && rawEmployee.companyId) {
        const rawCompanyIdStr = rawEmployee.companyId.toString()
        const companyStringId = companyMap.get(rawCompanyIdStr)
        if (companyStringId) {
          plain.companyId = companyStringId
          console.log(`[getEmployeesByCompany] Recovered companyId from raw document: ${companyStringId}`)
        }
      }
    }
    
    return plain
  }).filter((e: any) => e !== null)
  
  console.log(`[getEmployeesByCompany] After toPlainObject: ${plainEmployees.length} employees`)
  if (plainEmployees.length > 0) {
    console.log(`[getEmployeesByCompany] Sample employee companyId:`, plainEmployees[0].companyId)
  }
  
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

  // Generate unique employee ID if not provided
  let employeeId = employeeData.employeeId
  if (!employeeId) {
    // Find the highest existing employee ID number
    const existingEmployees = await Employee.find({ companyId: company._id })
      .sort({ id: -1 })
      .limit(1)
      .lean()
    
    let nextIdNumber = 1
    if (existingEmployees.length > 0) {
      const lastId = existingEmployees[0].id
      const match = lastId.match(/(\d+)$/)
      if (match) {
        nextIdNumber = parseInt(match[1], 10) + 1
      }
    }
    
    // Generate ID based on company name prefix (since company.id is now numeric)
    // Use first 3 letters of company name, or fallback to numeric ID
    const companyNamePrefix = company.name 
      ? company.name.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, '') || String(company.id)
      : String(company.id)
    employeeId = `${companyNamePrefix}-${String(nextIdNumber).padStart(3, '0')}`
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

  // Get branch if branchId is provided
  let branchIdObj = null
  if (employeeData.branchId) {
    const Branch = require('../models/Branch').default
    const branch = await Branch.findOne({ id: employeeData.branchId })
    if (branch) {
      branchIdObj = branch._id
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
    branchId: branchIdObj,
    branchName: employeeData.branchName,
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
    .populate('branchId', 'id name address city pincode')
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
  await connectDB()
  
  const employee = await Employee.findOne({ id: employeeId })
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

  // Update branch if branchId is provided
  if (updateData.branchId !== undefined) {
    if (updateData.branchId) {
      const Branch = require('../models/Branch').default
      const branch = await Branch.findOne({ id: updateData.branchId })
      if (branch) {
        employee.branchId = branch._id
        if (updateData.branchName) {
          employee.branchName = updateData.branchName
        }
      }
    } else {
      employee.branchId = undefined
      employee.branchName = undefined
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
  if (updateData.branchName !== undefined && !updateData.branchId) employee.branchName = updateData.branchName

  await employee.save()
  
  // Fetch the updated employee with populated fields
  const updated = await Employee.findOne({ id: employeeId })
    .populate('companyId', 'id name')
    .populate('branchId', 'id name address city pincode')
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
  
  // Get company ObjectId for filtering
  const companyIdStr = company._id.toString()
  console.log(`[getVendorsForProductCompany] Filtering by productId=${productIdStr} and companyId=${companyIdStr}`)
  
  // Filter by productId - if ProductCompany link exists, we accept ProductVendor links
  // regardless of companyId in ProductVendor (since ProductCompany already validates company access)
  const matchingLinks = rawProductVendors.filter((pv: any) => {
    if (!pv.productId) return false
    const pvProductIdStr = pv.productId.toString()
    const productMatches = pvProductIdStr === productIdStr
    
    // Since we've already verified ProductCompany link exists above,
    // we accept ProductVendor links for this product regardless of companyId
    // The companyId in ProductVendor is optional and mainly for optimization
    if (pv.companyId) {
      const pvCompanyIdStr = pv.companyId.toString()
      // Prefer links with matching companyId, but don't exclude others
      if (pvCompanyIdStr === companyIdStr) {
        console.log(`[getVendorsForProductCompany] ✓ ProductVendor link matches companyId`)
      } else {
        console.log(`[getVendorsForProductCompany] ⚠ ProductVendor link has different companyId (${pvCompanyIdStr} vs ${companyIdStr}), but including since ProductCompany link exists`)
      }
    } else {
      // If companyId is missing from ProductVendor link, include it (backward compatibility)
      console.log(`[getVendorsForProductCompany] ProductVendor link missing companyId - including (ProductCompany link validates company access)`)
    }
    
    return productMatches
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
    .populate('employeeId', 'id firstName lastName email')
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
  
  // Use employeeId field instead of id field
  let employee = await Employee.findOne({ employeeId: employeeId })
  if (!employee) {
    // Fallback: try by id field for backward compatibility
    employee = await Employee.findOne({ id: employeeId })
  }
  if (!employee) return []

  const orders = await Order.find({ employeeId: employee._id })
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
    
    groupedOrders.push({
      ...splitOrders[0], // Use first order as base
      id: parentOrderId, // Use parent order ID as the main ID
      isSplitOrder: true,
      splitOrders: splitOrders,
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
  isPersonalPayment?: boolean
  personalPaymentAmount?: number
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

  for (const [vendorId, items] of itemsByVendor.entries()) {
    const vendorInfo = vendorInfoMap.get(vendorId)!
    
    // Calculate total for this vendor's order
    const total = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0)

    // Generate unique order ID for this vendor order
    const orderId = `${parentOrderId}-${vendorId.substring(0, 8).toUpperCase()}`

    // Create order for this vendor with numeric IDs for correlation
  const order = await Order.create({
    id: orderId,
    employeeId: employee._id,
    employeeIdNum: employeeIdNum, // Numeric/string employee ID for correlation
      employeeName: employeeName,
      items: items, // Each item already has productId
    total: total,
    status: 'Awaiting approval',
    orderDate: new Date(),
    dispatchLocation: orderData.dispatchLocation || employee.dispatchPreference || 'standard',
    companyId: company._id,
    companyIdNum: companyIdNum, // Numeric company ID for correlation
    deliveryAddress: orderData.deliveryAddress,
    estimatedDeliveryTime: orderData.estimatedDeliveryTime,
      parentOrderId: parentOrderId, // Link to parent order
      vendorId: vendorInfo.vendorObjectId,
      vendorName: vendorInfo.vendorName,
      isPersonalPayment: orderData.isPersonalPayment || false,
      personalPaymentAmount: orderData.personalPaymentAmount || 0,
  })

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

export async function bulkApproveOrders(orderIds: string[], adminEmail: string): Promise<{ success: string[], failed: Array<{ orderId: string, error: string }> }> {
  await connectDB()
  
  const results = {
    success: [] as string[],
    failed: [] as Array<{ orderId: string, error: string }>
  }
  
  // Verify admin can approve orders (check once for all orders)
  const employee = await Employee.findOne({ email: adminEmail })
  if (!employee) {
    throw new Error(`Employee not found: ${adminEmail}`)
  }
  
  // Process each order
  for (const orderId of orderIds) {
    try {
      const order = await Order.findOne({ id: orderId })
      if (!order) {
        results.failed.push({ orderId, error: 'Order not found' })
        continue
      }
      
      if (order.status !== 'Awaiting approval') {
        results.failed.push({ orderId, error: `Order is not in 'Awaiting approval' status (current: ${order.status})` })
        continue
      }
      
      // Verify admin can approve orders for this company
      const company = await Company.findById(order.companyId)
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
    } catch (error: any) {
      results.failed.push({ orderId, error: error.message || 'Unknown error' })
    }
  }
  
  return results
}

export async function updateOrderStatus(orderId: string, status: 'Awaiting approval' | 'Awaiting fulfilment' | 'Dispatched' | 'Delivered'): Promise<any> {
  await connectDB()
  
  const order = await Order.findOne({ id: orderId })
    .populate('vendorId', 'id')
    .populate('items.uniformId', 'id')
  
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }
  
  const previousStatus = order.status
  order.status = status
  await order.save()
  
  // If status is being changed to "Dispatched" and wasn't already dispatched/delivered, decrement inventory
  if (status === 'Dispatched' && previousStatus !== 'Dispatched' && previousStatus !== 'Delivered') {
    if (!order.vendorId) {
      console.warn(`Order ${orderId} has no vendorId, cannot update inventory`)
    } else {
      try {
        // Get vendor ObjectId - handle both populated and unpopulated cases
        let vendorObjectId: mongoose.Types.ObjectId
        if (order.vendorId instanceof mongoose.Types.ObjectId) {
          vendorObjectId = order.vendorId
        } else {
          // Populated vendor document
          vendorObjectId = (order.vendorId as any)._id || order.vendorId
        }
        
        const vendor = await Vendor.findById(vendorObjectId)
        if (!vendor) {
          console.warn(`Vendor not found for order ${orderId}`)
        } else {
          // Process each item in the order
          for (const item of order.items) {
            // Get product ObjectId - handle both populated and unpopulated cases
            let productObjectId: mongoose.Types.ObjectId
            if (item.uniformId instanceof mongoose.Types.ObjectId) {
              productObjectId = item.uniformId
            } else {
              // Populated product document
              productObjectId = (item.uniformId as any)._id || item.uniformId
            }
            
            const size = item.size
            const quantity = item.quantity
            
            if (!size || !quantity) {
              console.warn(`Order ${orderId} item missing size or quantity`, item)
              continue
            }
            
            // Get product to verify it exists
            const product = await Uniform.findById(productObjectId)
            
            if (!product) {
              console.warn(`Product not found for order ${orderId}`, { productObjectId })
              continue
            }
          
            // Find or create inventory record
            let inventory = await VendorInventory.findOne({
              vendorId: vendor._id,
              productId: product._id,
            })
            
            if (!inventory) {
              console.warn(`No inventory record found for vendor ${vendor.id} and product ${product.id}, creating one with 0 stock`)
              // Create inventory record with 0 stock if it doesn't exist
              const inventoryId = `VEND-INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
              inventory = await VendorInventory.create({
                id: inventoryId,
                vendorId: vendor._id,
                productId: product._id,
                sizeInventory: new Map(),
                totalStock: 0,
              })
            }
            
            // Get current size inventory
            const sizeInventory = inventory.sizeInventory instanceof Map
              ? new Map(inventory.sizeInventory)
              : new Map(Object.entries(inventory.sizeInventory || {}))
            
            // Decrement inventory for this size
            const currentStock = sizeInventory.get(size) || 0
            const newStock = Math.max(0, currentStock - quantity) // Don't go below 0
            
            if (currentStock < quantity) {
              console.warn(`Insufficient inventory for order ${orderId}: product ${product.id}, size ${size}. Current: ${currentStock}, Requested: ${quantity}`)
            }
            
            sizeInventory.set(size, newStock)
            
            // Calculate new total stock
            let totalStock = 0
            for (const qty of sizeInventory.values()) {
              totalStock += qty
            }
            
            // Update inventory
            inventory.sizeInventory = sizeInventory
            inventory.totalStock = totalStock
            await inventory.save()
            
            console.log(`Updated inventory for order ${orderId}: product ${product.id}, size ${size}, ${currentStock} -> ${newStock} (decremented ${quantity})`)
          }
        }
      } catch (error) {
        console.error(`Error updating inventory for order ${orderId}:`, error)
        // Don't throw - we still want to update the order status even if inventory update fails
      }
    }
  }
  
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
    .populate('vendorId', 'id name')
    .sort({ orderDate: -1 })
    .lean()
  
  const plainOrders = orders.map((o: any) => toPlainObject(o))
  
  // Group orders by parentOrderId if they are split orders
  const orderMap = new Map<string, any[]>()
  const standaloneOrders: any[] = []

  for (const order of plainOrders) {
    if (order.parentOrderId) {
      if (!orderMap.has(order.parentOrderId)) {
        orderMap.set(order.parentOrderId, [])
      }
      orderMap.get(order.parentOrderId)!.push(order)
    } else {
      standaloneOrders.push(order)
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
  
  // Get all products, vendors, and companies for mapping
  const allProducts = await db.collection('uniforms').find({}).toArray()
  const allVendors = await db.collection('vendors').find({}).toArray()
  const allCompanies = await db.collection('companies').find({}).toArray()
  
  // Create maps for quick lookup
  const productMap = new Map()
  const vendorMap = new Map()
  const companyMap = new Map()
  
  allProducts.forEach((p: any) => {
    productMap.set(p._id.toString(), p.id)
  })
  
  allVendors.forEach((v: any) => {
    vendorMap.set(v._id.toString(), v.id)
  })
  
  allCompanies.forEach((c: any) => {
    companyMap.set(c._id.toString(), c.id)
  })
  
  // Map relationships to use string IDs, including companyId
  return rawRelationships.map((rel: any) => {
    const productIdStr = rel.productId?.toString()
    const vendorIdStr = rel.vendorId?.toString()
    const companyIdStr = rel.companyId?.toString()
    
    return {
      productId: productMap.get(productIdStr) || productIdStr,
      vendorId: vendorMap.get(vendorIdStr) || vendorIdStr,
      companyId: companyMap.get(companyIdStr) || companyIdStr,
    }
  }).filter((rel: any) => rel.productId && rel.vendorId && rel.companyId)
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

  const result = await ProductCompany.deleteOne({ productId: product._id, companyId: company._id })
  
  if (result.deletedCount === 0) {
    console.warn(`No relationship found to delete between product ${productId} and company ${companyId}`)
  } else {
    console.log(`Successfully deleted relationship between product ${productId} and company ${companyId}`)
  }
}

export async function createProductVendor(productId: string, vendorId: string, companyId: string): Promise<void> {
  await connectDB()
  
  console.log('createProductVendor - Looking for productId:', productId, 'vendorId:', vendorId, 'companyId:', companyId)
  
  const product = await Uniform.findOne({ id: productId })
  const vendor = await Vendor.findOne({ id: vendorId })
  const company = await Company.findOne({ id: companyId })
  
  console.log('createProductVendor - Product found:', product ? product.id : 'NOT FOUND')
  console.log('createProductVendor - Vendor found:', vendor ? vendor.id : 'NOT FOUND')
  console.log('createProductVendor - Company found:', company ? company.id : 'NOT FOUND')
  
  if (!product) {
    // List available product IDs for debugging
    const allProducts = await Uniform.find({}, 'id name').limit(5).lean()
    console.log('Available products (sample):', allProducts.map(p => p.id))
    throw new Error(`Product not found: ${productId}`)
  }
  
  if (!vendor) {
    // List available vendor IDs for debugging
    const allVendors = await Vendor.find({}, 'id name').limit(5).lean()
    console.log('Available vendors (sample):', allVendors.map(v => v.id))
    throw new Error(`Vendor not found: ${vendorId}`)
  }

  if (!company) {
    // List available company IDs for debugging
    const allCompanies = await Company.find({}, 'id name').limit(5).lean()
    console.log('Available companies (sample):', allCompanies.map(c => c.id))
    throw new Error(`Company not found: ${companyId}`)
  }

  await ProductVendor.findOneAndUpdate(
    { productId: product._id, vendorId: vendor._id, companyId: company._id },
    { productId: product._id, vendorId: vendor._id, companyId: company._id },
    { upsert: true }
  )
  
  console.log('createProductVendor - Successfully created relationship')
}

export async function deleteProductVendor(productId: string, vendorId: string, companyId: string): Promise<void> {
  await connectDB()
  
  const product = await Uniform.findOne({ id: productId })
  const vendor = await Vendor.findOne({ id: vendorId })
  const company = await Company.findOne({ id: companyId })
  
  if (!product) {
    throw new Error(`Product not found: ${productId}`)
  }
  if (!vendor) {
    throw new Error(`Vendor not found: ${vendorId}`)
  }
  if (!company) {
    throw new Error(`Company not found: ${companyId}`)
  }

  const result = await ProductVendor.deleteOne({ productId: product._id, vendorId: vendor._id, companyId: company._id })
  
  if (result.deletedCount === 0) {
    console.warn(`No relationship found to delete between product ${productId}, vendor ${vendorId}, and company ${companyId}`)
  } else {
    console.log(`Successfully deleted relationship between product ${productId}, vendor ${vendorId}, and company ${companyId}`)
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

export async function getVendorInventory(vendorId: string, productId?: string): Promise<any[]> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  if (!vendor) return []

  const query: any = { vendorId: vendor._id }
  if (productId) {
    const product = await Uniform.findOne({ id: productId })
    if (product) {
      query.productId = product._id
    } else {
      return []
    }
  }

  const inventoryRecords = await VendorInventory.find(query)
    .populate('productId', 'id name category gender sizes price sku')
    .populate('vendorId', 'id name')
    .lean()

  return inventoryRecords.map((inv: any) => {
    const sizeInventory = inv.sizeInventory instanceof Map
      ? Object.fromEntries(inv.sizeInventory)
      : inv.sizeInventory || {}
    
    return {
      id: inv.id,
      vendorId: inv.vendorId?.id || inv.vendorId?.toString(),
      vendorName: inv.vendorId?.name,
      productId: inv.productId?.id || inv.productId?.toString(),
      productName: inv.productId?.name,
      productCategory: inv.productId?.category,
      productGender: inv.productId?.gender,
      productSizes: inv.productId?.sizes || [],
      productPrice: inv.productId?.price,
      productSku: inv.productId?.sku,
      sizeInventory,
      totalStock: inv.totalStock || 0,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
    }
  })
}

export async function updateVendorInventory(
  vendorId: string,
  productId: string,
  sizeInventory: { [size: string]: number }
): Promise<any> {
  await connectDB()
  
  const vendor = await Vendor.findOne({ id: vendorId })
  const product = await Uniform.findOne({ id: productId })
  
  if (!vendor || !product) {
    throw new Error('Vendor or Product not found')
  }

  // Generate unique inventory ID if creating new
  let inventoryId = `VEND-INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
  let isUnique = false
  while (!isUnique) {
    const existing = await VendorInventory.findOne({ id: inventoryId })
    if (!existing) {
      isUnique = true
    } else {
      inventoryId = `VEND-INV-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`
    }
  }

  // Convert sizeInventory object to Map for storage
  const sizeInventoryMap = new Map(Object.entries(sizeInventory))

  // Calculate total stock
  let totalStock = 0
  for (const quantity of Object.values(sizeInventory)) {
    totalStock += typeof quantity === 'number' ? quantity : 0
  }

  const inventory = await VendorInventory.findOneAndUpdate(
    { vendorId: vendor._id, productId: product._id },
    {
      id: inventoryId,
      vendorId: vendor._id,
      productId: product._id,
      sizeInventory: sizeInventoryMap,
      totalStock,
    },
    { upsert: true, new: true }
  )
    .populate('productId', 'id name category gender sizes price sku')
    .populate('vendorId', 'id name')
    .lean()

  if (!inventory) {
    throw new Error('Failed to update inventory')
  }

  const sizeInventoryObj = inventory.sizeInventory instanceof Map
    ? Object.fromEntries(inventory.sizeInventory)
    : inventory.sizeInventory || {}

  return {
    id: inventory.id,
    vendorId: inventory.vendorId?.id || inventory.vendorId?.toString(),
    vendorName: inventory.vendorId?.name,
    productId: inventory.productId?.id || inventory.productId?.toString(),
    productName: inventory.productId?.name,
    productCategory: inventory.productId?.category,
    productGender: inventory.productId?.gender,
    productSizes: inventory.productId?.sizes || [],
    productPrice: inventory.productId?.price,
    productSku: inventory.productId?.sku,
    sizeInventory: sizeInventoryObj,
    totalStock: inventory.totalStock || 0,
    createdAt: inventory.createdAt,
    updatedAt: inventory.updatedAt,
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
    
    // Decrypt designation if it's encrypted (check after toPlainObject)
    if (plainObj.designation && typeof plainObj.designation === 'string') {
      const encryptedValue = plainObj.designation
      // Check if it looks encrypted (contains ':' separator - format is iv:encryptedData)
      if (encryptedValue.includes(':')) {
        try {
          const decrypted = decrypt(encryptedValue)
          // Always update designation if decryption returned a different value
          // Even if it still contains ':', it might be partially decrypted
          if (decrypted && decrypted !== encryptedValue) {
            plainObj.designation = decrypted
            // If decrypted value still contains ':', try one more time (might be double-encrypted)
            if (decrypted.includes(':')) {
              try {
                const doubleDecrypted = decrypt(decrypted)
                if (doubleDecrypted && doubleDecrypted !== decrypted && !doubleDecrypted.includes(':')) {
                  plainObj.designation = doubleDecrypted
                  console.log(`✅ Successfully decrypted designation (double): "${doubleDecrypted}"`)
                } else {
                  console.log(`✅ Decrypted designation: "${decrypted}" (may still be encrypted)`)
                }
              } catch (doubleError) {
                // Use the first decryption result
                console.log(`✅ Decrypted designation: "${decrypted}"`)
              }
            } else {
              console.log(`✅ Successfully decrypted designation: "${decrypted}"`)
            }
          } else {
            // Decryption returned the same value - might be using wrong format
            console.error(`❌ Decryption returned encrypted value for designation`)
            console.error(`   Encrypted value: ${encryptedValue.substring(0, 60)}...`)
            // Try alternative decryption methods (hex vs base64)
            try {
              const parts = encryptedValue.split(':')
              if (parts.length === 2) {
                // Try hex decoding for IV and encrypted data
                const key = getKey()
                try {
                  const iv = Buffer.from(parts[0], 'hex')
                  const encrypted = parts[1]
                  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
                  let hexDecrypted = decipher.update(encrypted, 'hex', 'utf8')
                  hexDecrypted += decipher.final('utf8')
                  if (hexDecrypted && hexDecrypted !== encryptedValue && !hexDecrypted.includes(':')) {
                    plainObj.designation = hexDecrypted
                    console.log(`✅ Successfully decrypted designation using hex: "${hexDecrypted}"`)
                  }
                } catch (hexError) {
                  // Hex failed, keep original encrypted value
                  console.error(`❌ Hex decryption also failed:`, hexError.message)
                }
              }
            } catch (altError: any) {
              console.error(`❌ Alternative decryption failed:`, altError.message)
            }
          }
        } catch (error: any) {
          console.error('❌ Exception during decryption:', error.message)
          // Try to decrypt with hex format as fallback
          try {
            const parts = encryptedValue.split(':')
            if (parts.length === 2) {
              const key = getKey()
              const iv = Buffer.from(parts[0], 'hex')
              const encrypted = parts[1]
              const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
              let hexDecrypted = decipher.update(encrypted, 'hex', 'utf8')
              hexDecrypted += decipher.final('utf8')
              if (hexDecrypted && hexDecrypted !== encryptedValue) {
                plainObj.designation = hexDecrypted
                console.log(`✅ Successfully decrypted designation using hex fallback: "${hexDecrypted}"`)
              }
            }
          } catch (hexError: any) {
            console.error(`❌ Hex fallback decryption failed:`, hexError.message)
            // Keep encrypted value if all decryption attempts fail
          }
        }
      } else {
        // Not encrypted, already decrypted
        console.log(`ℹ️  Designation appears unencrypted: "${plainObj.designation}"`)
      }
    }
    
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
  
  // Import decrypt function
  const { decrypt } = require('../utils/encryption')
  
  // Decrypt designation manually since .lean() bypasses Mongoose hooks
  if (plainObj.designation && typeof plainObj.designation === 'string' && plainObj.designation.includes(':')) {
    try {
      const decrypted = decrypt(plainObj.designation)
      if (decrypted && decrypted !== plainObj.designation) {
        plainObj.designation = decrypted
      }
    } catch (error: any) {
      console.error('Failed to decrypt designation in eligibility:', error.message)
      // If decryption fails, keep the original encrypted value
    }
  }

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

  // Since designation is encrypted in the database, we need to fetch all eligibilities
  // and decrypt them to find a match, OR encrypt the input designation to match
  // We'll fetch all and match after decryption for reliability (case-insensitive)
  const { encrypt, decrypt } = require('../utils/encryption')
  
  // Normalize designation to lowercase for case-insensitive matching
  const normalizedDesignation = designation.trim().toLowerCase()
  
  // Try to find by encrypted designation first (faster if it works)
  // Note: We'll try both the original and normalized versions since stored designations
  // might have different cases, but we'll primarily rely on decryption matching for case-insensitivity
  let encryptedDesignation: string
  let encryptedNormalizedDesignation: string
  try {
    encryptedDesignation = encrypt(designation.trim())
    encryptedNormalizedDesignation = encrypt(normalizedDesignation)
  } catch (error) {
    console.warn('Failed to encrypt designation for query, will use decryption matching:', error)
    encryptedDesignation = ''
    encryptedNormalizedDesignation = ''
  }

  // Build query filter - prioritize gender-specific rules, then 'unisex' rules
  const queryFilter: any = {
    companyId: company._id,
    status: 'active'
  }

  // Try finding with encrypted designation first (try both original and normalized)
  // Since encryption is case-sensitive, we need to try both
  let eligibility = await DesignationProductEligibility.findOne({ 
    ...queryFilter,
    $or: [
      { designation: encryptedDesignation },
      { designation: encryptedNormalizedDesignation },
      { designation: designation.trim() } // Fallback to plain text if encryption failed
    ].filter(condition => condition.designation) // Remove empty conditions
  })
    .populate('companyId', 'id name')
    .lean()

  // If not found, fetch all and match after decryption (case-insensitive)
  if (!eligibility) {
    const allEligibilities = await DesignationProductEligibility.find(queryFilter)
      .populate('companyId', 'id name')
      .lean()

    // Find matching eligibility by decrypting and comparing
    // Priority: gender-specific first, then 'unisex'
    const matchingEligibilities: any[] = []
    for (const elig of allEligibilities) {
      let eligDesignation = elig.designation as string
      // Decrypt if encrypted
      if (eligDesignation && typeof eligDesignation === 'string' && eligDesignation.includes(':')) {
        try {
          eligDesignation = decrypt(eligDesignation)
        } catch (error) {
          console.warn('Failed to decrypt eligibility designation:', error)
          continue
        }
      }
      // Match decrypted designation (case-insensitive)
      const normalizedEligDesignation = eligDesignation ? eligDesignation.trim().toLowerCase() : ''
      if (normalizedEligDesignation && normalizedEligDesignation === normalizedDesignation) {
        const eligGender = elig.gender || 'unisex'
        // Decrypt the designation in the result
        elig.designation = eligDesignation
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
    // If found, decrypt the designation field
    if (eligibility.designation && typeof eligibility.designation === 'string' && eligibility.designation.includes(':')) {
      try {
        eligibility.designation = decrypt(eligibility.designation as string)
      } catch (error) {
        console.warn('Failed to decrypt eligibility designation:', error)
      }
    }
    
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
        let eligDesignation = elig.designation as string
        if (eligDesignation && typeof eligDesignation === 'string' && eligDesignation.includes(':')) {
          try {
            eligDesignation = decrypt(eligDesignation)
          } catch (error) {
            continue
          }
        }
        // Match decrypted designation (case-insensitive)
        const normalizedEligDesignation = eligDesignation ? eligDesignation.trim().toLowerCase() : ''
        if (normalizedEligDesignation && normalizedEligDesignation === normalizedDesignation) {
          const eligGender = elig.gender || 'unisex'
          if (eligGender === gender || eligGender === 'unisex') {
            elig.designation = eligDesignation
            eligibility = elig
            break
          }
        }
      }
    }
  }

  return eligibility ? toPlainObject(eligibility) : null
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
  // Note: We need to handle encryption manually since pre-save hooks don't run with findOneAndUpdate
  const { encrypt } = require('../utils/encryption')
  if (updateData.designation && !updateData.designation.includes(':')) {
    // Encrypt designation if not already encrypted
    try {
      updateData.designation = encrypt(updateData.designation)
    } catch (error: any) {
      console.error('Failed to encrypt designation:', error)
      throw new Error(`Failed to encrypt designation: ${error.message}`)
    }
  }

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
    eligibility.designation = designation // Will be encrypted by pre-save hook
  }
  if (finalAllowedCategories !== undefined) {
    eligibility.allowedProductCategories = finalAllowedCategories
    console.log('🔍 Updated allowedProductCategories:', finalAllowedCategories)
  }
  if (structuredItemEligibility !== undefined) {
    // Log what we're about to save
    console.log('🔍 Setting itemEligibility on eligibility document:', {
      before: eligibility.itemEligibility ? JSON.stringify(eligibility.itemEligibility, null, 2) : 'none',
      newValue: JSON.stringify(structuredItemEligibility, null, 2),
      keys: Object.keys(structuredItemEligibility),
    })
    
    // Use set() method to explicitly set the nested object
    eligibility.set('itemEligibility', structuredItemEligibility)
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

  // Save the document (pre-save hook will encrypt designation)
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
        await refreshEmployeeEligibilityForDesignation(
          companyIdForRefresh,
          updatedEligibility.designation || designation || '',
          updatedEligibility.gender || gender || 'unisex',
          updatedEligibility.itemEligibility || itemEligibility
        )
        console.log('✅ Successfully refreshed employee entitlements for designation')
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
  
  // Encrypt designation for query (since it's stored encrypted)
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
  const eligibility = {
    shirt: itemEligibility.shirt?.quantity || 0,
    pant: (itemEligibility.trouser?.quantity || itemEligibility.pant?.quantity || 0),
    shoe: itemEligibility.shoe?.quantity || 0,
    jacket: (itemEligibility.blazer?.quantity || itemEligibility.jacket?.quantity || 0),
  }
  
  // Convert renewal frequency to months for cycle duration
  const convertToMonths = (itemElig: any): number => {
    if (!itemElig) return 6 // Default
    if (itemElig.renewalUnit === 'years') {
      return itemElig.renewalFrequency * 12
    }
    return itemElig.renewalFrequency || 6
  }
  
  const cycleDuration = {
    shirt: convertToMonths(itemEligibility.shirt),
    pant: convertToMonths(itemEligibility.trouser || itemEligibility.pant),
    shoe: convertToMonths(itemEligibility.shoe),
    jacket: convertToMonths(itemEligibility.blazer || itemEligibility.jacket),
  }
  
  console.log(`🔄 Refreshing entitlements for ${matchingEmployees.length} employees:`, {
    designation,
    gender: gender || 'all',
    eligibility,
    cycleDuration,
  })
  
  // Update all matching employees
  let updatedCount = 0
  for (const emp of matchingEmployees) {
    try {
      const employee = await Employee.findById(emp._id)
      if (employee) {
        employee.eligibility = eligibility
        employee.cycleDuration = cycleDuration
        await employee.save()
        updatedCount++
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

  // Filter products by allowed categories
  // Normalize category names (handle variations like "shirt"/"shirts", "trouser"/"trousers"/"pant"/"pants")
  const normalizeCategory = (cat: string): string => {
    if (!cat) return ''
    const lower = cat.toLowerCase().trim()
    if (lower.includes('shirt')) return 'shirt'
    if (lower.includes('trouser') || lower.includes('pant')) return 'trouser'
    if (lower.includes('shoe')) return 'shoe'
    if (lower.includes('blazer') || lower.includes('jacket')) return 'blazer'
    return lower
  }

  const allowedCategories = eligibility.allowedProductCategories.map(normalizeCategory)
  console.log(`getProductsForDesignation: Normalized allowed categories:`, allowedCategories)
  
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

