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
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

