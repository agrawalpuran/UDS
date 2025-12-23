import { NextResponse } from 'next/server'
import { getAllVendors, getVendorById, getVendorByEmail, createVendor } from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendorId')
    const email = searchParams.get('email')

    if (email) {
      const vendor = await getVendorByEmail(email)
      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found with this email' }, { status: 404 })
      }
      return NextResponse.json(vendor)
    }

    if (vendorId) {
      const vendor = await getVendorById(vendorId)
      return NextResponse.json(vendor)
    }

    const vendors = await getAllVendors()
    return NextResponse.json(vendors)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const vendor = await createVendor(body)
    return NextResponse.json(vendor)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}





