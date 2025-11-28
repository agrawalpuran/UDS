import { NextResponse } from 'next/server'
import { getAllEmployees, getEmployeeByEmail, getEmployeeById, getEmployeesByCompany } from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const employeeId = searchParams.get('employeeId')
    const companyId = searchParams.get('companyId')

    if (email) {
      const employee = await getEmployeeByEmail(email)
      if (!employee) {
        return NextResponse.json(null, { status: 404 })
      }
      return NextResponse.json(employee)
    }

    if (employeeId) {
      const employee = await getEmployeeById(employeeId)
      return NextResponse.json(employee)
    }

    if (companyId) {
      const employees = await getEmployeesByCompany(companyId)
      return NextResponse.json(employees)
    }

    const employees = await getAllEmployees()
    return NextResponse.json(employees)
  } catch (error: any) {
    console.error('API Error in /api/employees:', error)
    console.error('Error stack:', error.stack)
    
    // Provide more detailed error information
    const errorMessage = error.message || 'Unknown error occurred'
    const isConnectionError = errorMessage.includes('Mongo') || errorMessage.includes('connection')
    
    return NextResponse.json({ 
      error: errorMessage,
      type: isConnectionError ? 'database_connection_error' : 'api_error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}

