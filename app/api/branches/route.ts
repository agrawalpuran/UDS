import { NextResponse } from 'next/server'
import { getAllBranches, getBranchById, getBranchesByCompany, getEmployeesByBranch } from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const branchId = searchParams.get('branchId')
    const companyId = searchParams.get('companyId')
    const employees = searchParams.get('employees') === 'true'

    if (branchId) {
      const branch = await getBranchById(branchId)
      if (!branch) {
        return NextResponse.json(null, { status: 404 })
      }
      
      // If employees requested, get employees for this branch
      if (employees) {
        const branchEmployees = await getEmployeesByBranch(branchId)
        return NextResponse.json({ ...branch, employees: branchEmployees })
      }
      
      return NextResponse.json(branch)
    }

    if (companyId) {
      const branches = await getBranchesByCompany(companyId)
      return NextResponse.json(branches)
    }

    const branches = await getAllBranches()
    return NextResponse.json(branches)
  } catch (error: any) {
    console.error('API Error in /api/branches:', error)
    console.error('Error stack:', error.stack)
    
    const errorMessage = error.message || 'Unknown error occurred'
    const isConnectionError = errorMessage.includes('Mongo') || errorMessage.includes('connection')
    
    return NextResponse.json({ 
      error: errorMessage,
      type: isConnectionError ? 'database_connection_error' : 'api_error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}


