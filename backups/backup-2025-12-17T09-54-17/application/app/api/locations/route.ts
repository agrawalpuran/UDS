import { NextResponse } from 'next/server'
import { 
  createLocation,
  getLocationsByCompany,
  getLocationById,
  updateLocation,
  deleteLocation,
  getAllLocations,
  isCompanyAdmin,
  getLocationByAdminEmail
} from '@/lib/db/data-access'

/**
 * GET /api/locations
 * Query params:
 * - companyId: Get locations for a specific company
 * - locationId: Get a specific location
 * - email: Check if user is Company Admin (for authorization)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const locationId = searchParams.get('locationId')
    const email = searchParams.get('email')
    const getByAdminEmail = searchParams.get('getByAdminEmail') === 'true'

    // Get location by admin email
    if (getByAdminEmail && email) {
      const location = await getLocationByAdminEmail(email)
      // Return 200 with null instead of 404 - 404 is expected when user is not a location admin
      // This prevents console errors for normal cases
      return NextResponse.json(location || null, { status: 200 })
    }

    // Get specific location
    if (locationId) {
      const location = await getLocationById(locationId)
      if (!location) {
        return NextResponse.json({ error: 'Location not found' }, { status: 404 })
      }
      return NextResponse.json(location)
    }

    // Get locations for a company
    if (companyId) {
      // Verify authorization if email provided
      if (email) {
        const isAdmin = await isCompanyAdmin(email, companyId)
        if (!isAdmin) {
          return NextResponse.json({ error: 'Unauthorized: Company Admin access required' }, { status: 403 })
        }
      }
      
      const locations = await getLocationsByCompany(companyId)
      return NextResponse.json(locations)
    }

    // Get all locations (Super Admin only - no auth check here, should be done at UI level)
    const locations = await getAllLocations()
    return NextResponse.json(locations)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * POST /api/locations
 * Create a new location
 * Body: { name, companyId, adminId, address?, city?, state?, pincode?, phone?, email?, status? }
 * Authorization: Company Admin of the specified company
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, companyId, adminId, adminEmail, email, address, city, state, pincode, phone, locationEmail, status } = body

    // Validate required fields (adminId is now optional)
    if (!name || !companyId) {
      return NextResponse.json({ 
        error: 'Missing required fields: name and companyId are required' 
      }, { status: 400 })
    }
    
    // Use adminEmail from body or email parameter
    const userEmail = adminEmail || email

    // Verify authorization: user must be Company Admin
    if (!userEmail) {
      return NextResponse.json({ error: 'Email is required for authorization' }, { status: 401 })
    }

    const isAdmin = await isCompanyAdmin(userEmail, companyId)
    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Unauthorized: Only Company Admins can create locations' 
      }, { status: 403 })
    }

    // Create location (adminId is optional)
    const location = await createLocation({
      name,
      companyId,
      adminId: adminId || undefined, // Optional
      address,
      city,
      state,
      pincode,
      phone,
      email: locationEmail, // Use locationEmail to avoid conflict with user email
      status: status || 'active'
    })

    return NextResponse.json(location, { status: 201 })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * PATCH /api/locations
 * Update a location
 * Body: { locationId, email, ...updateFields }
 * Authorization: Company Admin of the location's company
 */
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { locationId, email, ...updateFields } = body

    if (!locationId) {
      return NextResponse.json({ error: 'Location ID is required' }, { status: 400 })
    }

    if (!email) {
      return NextResponse.json({ error: 'Email is required for authorization' }, { status: 401 })
    }

    // Get location to find its company
    const location = await getLocationById(locationId)
    if (!location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 })
    }

    // Verify authorization: user must be Company Admin of the location's company
    const isAdmin = await isCompanyAdmin(email, location.companyId?.id || location.companyId)
    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Unauthorized: Only Company Admins can update locations' 
      }, { status: 403 })
    }

    // Update location
    const updated = await updateLocation(locationId, updateFields)
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

/**
 * DELETE /api/locations
 * Delete a location
 * Query params: locationId, adminEmail, companyId
 * Authorization: Company Admin of the location's company
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const locationId = searchParams.get('locationId')
    const adminEmail = searchParams.get('adminEmail')
    const companyId = searchParams.get('companyId')

    if (!locationId || !adminEmail || !companyId) {
      return NextResponse.json({ 
        error: 'Location ID, admin email, and company ID are required' 
      }, { status: 400 })
    }

    // Verify authorization: user must be Company Admin
    const isAdmin = await isCompanyAdmin(adminEmail, companyId)
    if (!isAdmin) {
      return NextResponse.json({ 
        error: 'Unauthorized: Only Company Admins can delete locations' 
      }, { status: 403 })
    }

    // Delete location
    await deleteLocation(locationId)
    return NextResponse.json({ success: true, message: 'Location deleted successfully' })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

