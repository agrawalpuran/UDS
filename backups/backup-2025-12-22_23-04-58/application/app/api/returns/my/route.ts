import { NextResponse } from 'next/server'
import { getReturnRequestsByEmployee } from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Missing required parameter: employeeId' },
        { status: 400 }
      )
    }

    const returnRequests = await getReturnRequestsByEmployee(employeeId)
    return NextResponse.json(returnRequests, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching return requests:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch return requests' },
      { status: 500 }
    )
  }
}

