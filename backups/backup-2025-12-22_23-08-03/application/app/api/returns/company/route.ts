import { NextResponse } from 'next/server'
import { getReturnRequestsByCompany } from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const status = searchParams.get('status')

    if (!companyId) {
      return NextResponse.json(
        { error: 'Missing required parameter: companyId' },
        { status: 400 }
      )
    }

    // Only pass status if it's a valid value (not empty string)
    const statusFilter = status && status.trim() ? status.trim() : undefined
    
    const returnRequests = await getReturnRequestsByCompany(companyId, statusFilter)
    return NextResponse.json(returnRequests, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching company return requests:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch return requests' },
      { status: 500 }
    )
  }
}

