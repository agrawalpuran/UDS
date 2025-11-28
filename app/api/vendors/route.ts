import { NextResponse } from 'next/server'
import { getAllVendors, getVendorById } from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendorId')

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




