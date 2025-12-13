import { NextResponse } from 'next/server'
import { getVendorInventory, updateVendorInventory } from '@/lib/db/data-access'
import '@/lib/models/VendorInventory' // Ensure model is registered

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const vendorId = searchParams.get('vendorId')
    const productId = searchParams.get('productId')

    if (!vendorId) {
      return NextResponse.json({ error: 'Vendor ID is required' }, { status: 400 })
    }

    const inventory = await getVendorInventory(vendorId, productId || undefined)
    return NextResponse.json(inventory)
  } catch (error: any) {
    console.error('API Error in /api/vendor-inventory GET:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { vendorId, productId, sizeInventory } = body

    if (!vendorId || !productId) {
      return NextResponse.json(
        { error: 'Vendor ID and Product ID are required' },
        { status: 400 }
      )
    }

    if (!sizeInventory || typeof sizeInventory !== 'object') {
      return NextResponse.json(
        { error: 'sizeInventory must be an object with size: quantity pairs' },
        { status: 400 }
      )
    }

    const updated = await updateVendorInventory(vendorId, productId, sizeInventory)
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('API Error in /api/vendor-inventory PUT:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

