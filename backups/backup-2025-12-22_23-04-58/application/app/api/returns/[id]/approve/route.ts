import { NextResponse } from 'next/server'
import { approveReturnRequest, rejectReturnRequest } from '@/lib/db/data-access'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json()
    const { action, approvedBy, rejectedBy, rejectionReason } = body
    const resolvedParams = await params
    const returnRequestId = resolvedParams.id

    if (!returnRequestId) {
      return NextResponse.json(
        { error: 'Missing return request ID' },
        { status: 400 }
      )
    }

    if (action === 'approve') {
      if (!approvedBy) {
        return NextResponse.json(
          { error: 'Missing required field: approvedBy' },
          { status: 400 }
        )
      }

      const result = await approveReturnRequest(returnRequestId, approvedBy)
      return NextResponse.json(result, { status: 200 })
    } else if (action === 'reject') {
      if (!rejectedBy) {
        return NextResponse.json(
          { error: 'Missing required field: rejectedBy' },
          { status: 400 }
        )
      }

      const result = await rejectReturnRequest(returnRequestId, rejectedBy, rejectionReason)
      return NextResponse.json(result, { status: 200 })
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }
  } catch (error: any) {
    console.error('Error processing return request:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process return request' },
      { status: 400 }
    )
  }
}

