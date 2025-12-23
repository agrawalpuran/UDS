import { NextResponse } from 'next/server'
import { 
  getLocationById,
  updateLocation,
  isCompanyAdmin,
  getEmployeesByCompany
} from '@/lib/db/data-access'
import connectDB from '@/lib/db/mongodb'
import Employee from '@/lib/models/Employee'
import Company from '@/lib/models/Company'

/**
 * POST /api/locations/admin
 * Assign or update Location Admin for a location
 * Body: { locationId, adminId (employeeId), adminEmail, companyId }
 * Authorization: Company Admin only
 */
export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const { locationId, adminId, adminEmail, companyId } = body

    console.log('POST /api/locations/admin - Request body:', { locationId, adminId, adminEmail, companyId })

    if (!locationId || !adminEmail || !companyId) {
      console.error('Missing required fields:', { locationId: !!locationId, adminEmail: !!adminEmail, companyId: !!companyId })
      return NextResponse.json({ 
        error: 'Location ID, admin email, and company ID are required' 
      }, { status: 400 })
    }

    // Verify Company Admin authorization
    const isAdmin = await isCompanyAdmin(adminEmail, companyId)
    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Unauthorized: Only Company Admins can assign Location Admins' 
      }, { status: 403 })
    }

    // Get location to verify it belongs to the company
    const location = await getLocationById(locationId)
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    const locationCompanyId = location.companyId?.id || location.companyId
    if (locationCompanyId !== companyId) {
      return NextResponse.json({ 
        error: 'Location does not belong to your company' 
      }, { status: 403 })
    }

    // Handle adminId assignment or removal
    // adminId can be: string (employeeId), null, undefined, or empty string
    if (adminId && adminId.trim() !== '') {
      // Assign new admin - verify employee exists and belongs to the same company
      const employee = await Employee.findOne({ employeeId: adminId })
      if (!employee) {
        return NextResponse.json({ 
          error: `Employee not found: ${adminId}` 
        }, { status: 404 })
      }

      // Verify employee belongs to the same company
      const employeeCompany = await Company.findById(employee.companyId)
      if (!employeeCompany || employeeCompany.id !== companyId) {
        return NextResponse.json({ 
          error: `Employee ${adminId} does not belong to your company` 
        }, { status: 403 })
      }

      // Update location with new admin
      const updated = await updateLocation(locationId, { adminId })
      return NextResponse.json({ 
        success: true, 
        location: updated,
        message: 'Location Admin assigned successfully'
      })
    } else {
      // Remove Location Admin (adminId is null, undefined, or empty)
      console.log('Removing Location Admin for location:', locationId)
      const updated = await updateLocation(locationId, { adminId: null as any })
      console.log('Location Admin removed successfully:', updated?.id)
      return NextResponse.json({ 
        success: true, 
        location: updated,
        message: 'Location Admin removed successfully'
      })
    }
  } catch (error: any) {
    console.error('API Error in /api/locations/admin POST:', error)
    return NextResponse.json({ error: error.message || 'Failed to assign Location Admin' }, { status: 500 })
  }
}

/**
 * GET /api/locations/admin
 * Get eligible employees for Location Admin assignment
 * Query params: companyId, adminEmail, locationId (optional - if provided, filters by location)
 */
export async function GET(request: Request) {
  try {
    await connectDB()
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const adminEmail = searchParams.get('adminEmail')
    const locationId = searchParams.get('locationId') // Optional: filter by location

    if (!companyId || !adminEmail) {
      return NextResponse.json({ 
        error: 'Company ID and admin email are required' 
      }, { status: 400 })
    }

    // Verify Company Admin authorization
    const isAdmin = await isCompanyAdmin(adminEmail, companyId)
    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Unauthorized: Only Company Admins can view eligible employees' 
      }, { status: 403 })
    }

    // Get employees - filter by location if locationId is provided
    let employees: any[] = []
    if (locationId) {
      console.log(`[GET /api/locations/admin] ===== START =====`)
      console.log(`[GET /api/locations/admin] Request params: locationId=${locationId}, companyId=${companyId}, adminEmail=${adminEmail}`)
      
      // Verify location belongs to the company first
      const location = await getLocationById(locationId)
      if (!location) {
        console.error(`[GET /api/locations/admin] Location not found: ${locationId}`)
        return NextResponse.json({ 
          error: 'Location not found' 
        }, { status: 404 })
      }
      
      console.log(`[GET /api/locations/admin] Location found:`, {
        id: location.id,
        name: location.name,
        companyId: location.companyId,
        companyIdType: typeof location.companyId,
        companyIdValue: location.companyId?.id || location.companyId
      })
      
      const locationCompanyId = location.companyId?.id || location.companyId
      console.log(`[GET /api/locations/admin] Location companyId: ${locationCompanyId}, Request companyId: ${companyId}, Match: ${locationCompanyId === companyId}`)
      
      if (locationCompanyId !== companyId) {
        console.error(`[GET /api/locations/admin] Location ${locationId} belongs to company ${locationCompanyId}, but request is for company ${companyId}`)
        return NextResponse.json({ 
          error: 'Location does not belong to your company' 
        }, { status: 403 })
      }
      
      // Get employees for the specific location
      // IMPORTANT: If no location-specific employees found, fallback to ALL company employees
      // This allows assigning Location Admin even if employees don't have locationId set yet
      const { getEmployeesByLocation, getEmployeesByCompany } = await import('@/lib/db/data-access')
      
      try {
        // Try to get location-specific employees first
        employees = await getEmployeesByLocation(locationId)
        console.log(`[GET /api/locations/admin] getEmployeesByLocation returned ${employees.length} employees for location ${locationId}`)
      } catch (error: any) {
        console.error(`[GET /api/locations/admin] Error in getEmployeesByLocation:`, error.message)
        employees = []
      }
      
      // ALWAYS fallback to all company employees if location-specific query returns 0
      // This is intentional - allows Location Admin assignment even without locationId set on employees
      if (employees.length === 0) {
        console.warn(`[GET /api/locations/admin] No location-specific employees found. Fetching ALL company employees as fallback.`)
        try {
          employees = await getEmployeesByCompany(companyId)
          console.log(`[GET /api/locations/admin] Fallback: getEmployeesByCompany returned ${employees.length} total company employees`)
          
          if (employees.length > 0) {
            console.log(`[GET /api/locations/admin] Sample employees (first 3):`, 
              employees.slice(0, 3).map((e: any) => ({
                id: e.id,
                employeeId: e.employeeId,
                location: e.location,
                locationId: e.locationId ? (e.locationId.id || e.locationId) : 'none',
                companyId: e.companyId?.id || e.companyId,
                status: e.status,
                firstName: e.firstName,
                lastName: e.lastName
              }))
            )
          } else {
            console.error(`[GET /api/locations/admin] CRITICAL: No employees found for company ${companyId} at all!`)
          }
        } catch (fallbackError: any) {
          console.error(`[GET /api/locations/admin] CRITICAL: Fallback also failed:`, fallbackError.message)
          console.error(`[GET /api/locations/admin] Fallback error stack:`, fallbackError.stack)
          employees = []
        }
      }
    } else {
      // Get all employees for the company (backward compatibility)
      console.log(`[GET /api/locations/admin] Fetching all employees for companyId: ${companyId}`)
      employees = await getEmployeesByCompany(companyId)
      console.log(`[GET /api/locations/admin] Found ${employees.length} total employees for company`)
    }
    
    // Note: Fallback to all company employees is now handled above in the try-catch block
    // This ensures employees are always available for Location Admin assignment
    
    console.log(`[GET /api/locations/admin] Total employees before filtering: ${employees.length}`)
    
    // Return simplified employee list for dropdown
    const eligibleEmployees = employees
      .filter((emp: any) => {
        const isActive = emp.status === 'active'
        if (!isActive && employees.length > 0) {
          console.log(`[GET /api/locations/admin] Filtering out inactive employee: ${emp.employeeId || emp.id} (status: ${emp.status})`)
        }
        return isActive
      })
      .map((emp: any) => ({
        id: emp.id,
        employeeId: emp.employeeId || emp.id,
        firstName: emp.firstName,
        lastName: emp.lastName,
        designation: emp.designation,
        email: emp.email,
        displayName: `${emp.firstName} ${emp.lastName} (${emp.employeeId || emp.id}) - ${emp.designation || 'N/A'}`
      }))
      .sort((a: any, b: any) => {
        // Sort by name
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase()
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase()
        return nameA.localeCompare(nameB)
      })

    console.log(`[GET /api/locations/admin] ===== END =====`)
    console.log(`[GET /api/locations/admin] Returning ${eligibleEmployees.length} eligible employees (after filtering for active status).`)
    
    if (eligibleEmployees.length === 0 && employees.length > 0) {
      console.warn(`[GET /api/locations/admin] WARNING: ${employees.length} employees found but all are inactive!`)
    } else if (eligibleEmployees.length === 0 && employees.length === 0) {
      console.error(`[GET /api/locations/admin] CRITICAL: No employees found at all for company ${companyId}!`)
    }

    return NextResponse.json({ employees: eligibleEmployees })
  } catch (error: any) {
    console.error('API Error in /api/locations/admin GET:', error)
    return NextResponse.json({ error: error.message || 'Failed to fetch eligible employees' }, { status: 500 })
  }
}

