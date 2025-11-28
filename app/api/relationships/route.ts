import { NextResponse } from 'next/server'
import {
  getProductCompanies,
  getProductVendors,
  getVendorCompanies,
  createProductCompany,
  deleteProductCompany,
  createProductVendor,
  deleteProductVendor,
  createVendorCompany,
  deleteVendorCompany,
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

    if (type === 'vendorCompany') {
      const relationships = await getVendorCompanies()
      return NextResponse.json(relationships)
    }

    return NextResponse.json({
      productCompanies: await getProductCompanies(),
      productVendors: await getProductVendors(),
      vendorCompanies: await getVendorCompanies(),
    })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { type, productId, companyId, vendorId } = body

    if (type === 'productCompany' && productId && companyId) {
      await createProductCompany(productId, companyId)
      return NextResponse.json({ success: true })
    }

    if (type === 'productVendor' && productId && vendorId) {
      await createProductVendor(productId, vendorId)
      return NextResponse.json({ success: true })
    }

    if (type === 'vendorCompany' && vendorId && companyId) {
      await createVendorCompany(vendorId, companyId)
      return NextResponse.json({ success: true })
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
      await deleteVendorCompany(vendorId, companyId)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}




