import { NextResponse } from 'next/server'
import { getVendorWiseInventoryForCompany, isCompanyAdmin } from '@/lib/db/data-access'
import '@/lib/models/VendorInventory' // Ensure model is registered

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const email = searchParams.get('email')
    
    // Validate required parameters
    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }
    
    // Role check: Only Company Admin can access this endpoint
    if (!email) {
      return NextResponse.json({ error: 'Email is required for authorization' }, { status: 401 })
    }
    
    const isAdmin = await isCompanyAdmin(email, companyId)
    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Access denied. Only Company Admin can view vendor inventory.' 
      }, { status: 403 })
    }
    
    // Fetch vendor-wise inventory for the company
    const inventory = await getVendorWiseInventoryForCompany(companyId)
    
    return NextResponse.json(inventory)
  } catch (error: any) {
    console.error('API Error in /api/company/inventory/vendor-wise GET:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

// Explicitly disable POST, PUT, DELETE methods for read-only endpoint
export async function POST() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}

