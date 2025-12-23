import { NextResponse } from 'next/server'
import {
  getProductCompanies,
  getProductVendors,
  createProductCompany,
  createProductCompanyBatch,
  deleteProductCompany,
  createProductVendor,
  createProductVendorBatch,
  deleteProductVendor,
} from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'productCompany') {
      const relationships = await getProductCompanies()
      return NextResponse.json(relationships)
    }

    if (type === 'productVendor') {
      const relationships = await getProductVendors()
      return NextResponse.json(relationships)
    }

    return NextResponse.json({
      productCompanies: await getProductCompanies(),
      productVendors: await getProductVendors(),
    })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, productId, productIds, companyId, vendorId } = body

    // Batch operations
    if (type === 'productCompany' && productIds && Array.isArray(productIds) && companyId) {
      const result = await createProductCompanyBatch(productIds, companyId)
      return NextResponse.json({ success: true, result })
    }

    if (type === 'productVendor' && productIds && Array.isArray(productIds) && vendorId) {
      const result = await createProductVendorBatch(productIds, vendorId)
      return NextResponse.json({ success: true, result })
    }

    // Single operations (backward compatibility)
    if (type === 'productCompany' && productId && companyId) {
      await createProductCompany(productId, companyId)
      return NextResponse.json({ success: true })
    }

    if (type === 'productVendor' && productId && vendorId) {
      await createProductVendor(productId, vendorId)
      return NextResponse.json({ success: true })
    }

    if (type === 'vendorCompany' && vendorId && companyId) {
      // Vendor-company relationships are no longer used
      return NextResponse.json({ 
        error: 'Vendor-company relationships are no longer used. Products are linked to companies directly, and vendors supply products. No explicit vendor-company relationship is needed.'
      }, { status: 400 })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const productId = searchParams.get('productId')
    const companyId = searchParams.get('companyId')
    const vendorId = searchParams.get('vendorId')

    if (type === 'productCompany' && productId && companyId) {
      await deleteProductCompany(productId, companyId)
      return NextResponse.json({ success: true })
    }

    if (type === 'productVendor' && productId && vendorId) {
      await deleteProductVendor(productId, vendorId)
      return NextResponse.json({ success: true })
    }

    if (type === 'vendorCompany' && vendorId && companyId) {
      // Vendor-company relationships are no longer used
      return NextResponse.json({ 
        error: 'Vendor-company relationships are no longer used. Products are linked to companies directly, and vendors supply products. No explicit vendor-company relationship exists to delete.'
      }, { status: 400 })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}






