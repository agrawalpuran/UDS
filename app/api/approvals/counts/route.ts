import { NextResponse } from 'next/server'
import { 
  getPendingApprovalCount,
  getPendingReturnRequestCount,
  getPendingApprovalCountByLocation,
  getPendingOrderCountByVendor,
  getPendingReplacementOrderCountByVendor
} from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const locationId = searchParams.get('locationId')
    const vendorId = searchParams.get('vendorId')
    const role = searchParams.get('role') || 'company' // company, location, vendor

    const counts: {
      pendingOrderApprovals?: number
      pendingReturnRequests?: number
      pendingOrders?: number
      pendingReplacementOrders?: number
    } = {}

    if (role === 'company' && companyId) {
      // Company Admin: Get order approvals and return requests
      const [orderCount, returnCount] = await Promise.all([
        getPendingApprovalCount(companyId),
        getPendingReturnRequestCount(companyId)
      ])
      counts.pendingOrderApprovals = orderCount
      counts.pendingReturnRequests = returnCount
    } else if (role === 'location' && locationId) {
      // Location Admin: Get order approvals for their location
      const orderCount = await getPendingApprovalCountByLocation(locationId)
      counts.pendingOrderApprovals = orderCount
    } else if (role === 'vendor' && vendorId) {
      // Vendor: Get pending orders and replacement orders
      const [orderCount, replacementCount] = await Promise.all([
        getPendingOrderCountByVendor(vendorId),
        getPendingReplacementOrderCountByVendor(vendorId)
      ])
      counts.pendingOrders = orderCount
      counts.pendingReplacementOrders = replacementCount
    }

    return NextResponse.json(counts, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching approval counts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch approval counts' },
      { status: 500 }
    )
  }
}

