import { NextResponse } from 'next/server'
import { getEmployeeEligibilityFromDesignation } from '@/lib/db/data-access'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const resolvedParams = await params
    const employeeId = resolvedParams.employeeId

    if (!employeeId) {
      return NextResponse.json(
        { error: 'Missing employee ID' },
        { status: 400 }
      )
    }

    const eligibility = await getEmployeeEligibilityFromDesignation(employeeId)
    return NextResponse.json(eligibility, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching employee eligibility:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch employee eligibility' },
      { status: 500 }
    )
  }
}

