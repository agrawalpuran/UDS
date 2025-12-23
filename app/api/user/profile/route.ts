import { NextResponse } from 'next/server'
import { 
  getEmployeeByEmail,
  isCompanyAdmin,
  getLocationByAdminEmail,
  getBranchByAdminEmail
} from '@/lib/db/data-access'

/**
 * GET /api/user/profile
 * Returns authenticated user profile information including:
 * - User name (firstName + lastName)
 * - Company name
 * - Role (EMPLOYEE, COMPANY_ADMIN, LOCATION_ADMIN, BRANCH_ADMIN)
 * - Location (only for Location Admin)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json(
        { error: 'Email parameter is required' },
        { status: 400 }
      )
    }

    // Get employee by email
    const employee = await getEmployeeByEmail(email)
    
    if (!employee) {
      return NextResponse.json(
        { error: 'Employee not found' },
        { status: 404 }
      )
    }

    // Extract company ID
    const companyId = typeof employee.companyId === 'object' && employee.companyId?.id
      ? employee.companyId.id
      : employee.companyId

    if (!companyId) {
      return NextResponse.json(
        { error: 'Employee is not associated with a company' },
        { status: 400 }
      )
    }

    // Determine user role
    let role: string = 'EMPLOYEE'
    let location: any = null

    // Check if user is Company Admin
    const isAdmin = await isCompanyAdmin(email, companyId)
    if (isAdmin) {
      role = 'COMPANY_ADMIN'
    } else {
      // Check if user is Location Admin
      const locationData = await getLocationByAdminEmail(email)
      if (locationData) {
        role = 'LOCATION_ADMIN'
        location = {
          id: locationData.id,
          name: locationData.name,
          address: locationData.address || null,
          city: locationData.city || null,
          state: locationData.state || null,
          pincode: locationData.pincode || null
        }
      } else {
        // Check if user is Branch Admin
        try {
          const branchData = await getBranchByAdminEmail(email)
          if (branchData) {
            role = 'BRANCH_ADMIN'
          }
        } catch (error) {
          // Branch functionality might not exist, ignore
        }
      }
    }

    // Build user name from firstName and lastName
    const firstName = employee.firstName || ''
    const lastName = employee.lastName || ''
    const fullName = `${firstName} ${lastName}`.trim() || employee.employeeId || 'User'

    // Get company name
    const companyName = employee.companyName || employee.companyId?.name || '-'

    // Return profile
    return NextResponse.json({
      name: fullName,
      firstName: firstName,
      lastName: lastName,
      email: employee.email,
      employeeId: employee.employeeId,
      company: {
        id: companyId,
        name: companyName
      },
      role: role,
      location: location // Only populated for LOCATION_ADMIN
    })

  } catch (error: any) {
    console.error('API Error in /api/user/profile:', error)
    return NextResponse.json(
      { 
        error: error.message || 'Failed to fetch user profile',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

