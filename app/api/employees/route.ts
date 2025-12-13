import { NextResponse } from 'next/server'
// Ensure Branch model is registered before Employee queries
import '@/lib/models/Branch'
import { 
  getAllEmployees, 
  getEmployeeByEmail, 
  getEmployeeById, 
  getEmployeesByCompany,
  createEmployee,
  updateEmployee,
  deleteEmployee
} from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')
    const employeeId = searchParams.get('employeeId')
    const companyId = searchParams.get('companyId')

    if (email) {
      console.log(`[API /api/employees] Getting employee by email: ${email}`)
      const employee = await getEmployeeByEmail(email)
      if (!employee) {
        console.log(`[API /api/employees] Employee not found for email: ${email}`)
        return NextResponse.json(null, { status: 404 })
      }
      console.log(`[API /api/employees] Employee found:`, {
        id: employee.id,
        email: employee.email,
        companyId: employee.companyId,
        companyIdType: typeof employee.companyId,
        companyName: employee.companyName
      })
      console.log(`[API /api/employees] Full employee object keys:`, Object.keys(employee))
      return NextResponse.json(employee)
    }

    if (employeeId) {
      const employee = await getEmployeeById(employeeId)
      return NextResponse.json(employee)
    }

    if (companyId) {
      const employees = await getEmployeesByCompany(companyId)
      console.log(`[API /api/employees] Returning ${employees?.length || 0} employees for companyId: ${companyId}`)
      if (employees && employees.length > 0) {
        console.log(`[API /api/employees] First employee sample:`, {
          id: employees[0].id,
          employeeId: employees[0].employeeId,
          firstName: employees[0].firstName,
          lastName: employees[0].lastName,
          companyId: employees[0].companyId
        })
      }
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

export async function POST(request: Request) {
  try {
    const body = await request.json()
    
    // Validate that companyId is provided and not empty
    if (!body.companyId || body.companyId.trim() === '') {
      return NextResponse.json({ 
        error: 'companyId is required and cannot be empty. Every employee must be associated with a company.'
      }, { status: 400 })
    }
    
    // companyName is optional - it will be derived from companyId lookup
    // Remove companyName from body to ensure it's always derived from companyId
    if (body.companyName) {
      delete body.companyName
    }
    
    const employee = await createEmployee(body)
    
    return NextResponse.json(employee, { status: 201 })
  } catch (error: any) {
    console.error('API Error creating employee:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to create employee'
    }, { status: 400 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { employeeId, ...updateData } = body
    
    if (!employeeId) {
      return NextResponse.json({ 
        error: 'Employee ID is required'
      }, { status: 400 })
    }
    
    const employee = await updateEmployee(employeeId, updateData)
    
    return NextResponse.json(employee)
  } catch (error: any) {
    console.error('API Error updating employee:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to update employee'
    }, { status: 400 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    
    if (!employeeId) {
      return NextResponse.json({ 
        error: 'Employee ID is required'
      }, { status: 400 })
    }
    
    await deleteEmployee(employeeId)
    
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API Error deleting employee:', error)
    return NextResponse.json({ 
      error: error.message || 'Failed to delete employee'
    }, { status: 400 })
  }
}

