import { NextResponse } from 'next/server'
import { 
  getAllCompanies, 
  getCompanyById, 
  addCompanyAdmin, 
  removeCompanyAdmin, 
  updateCompanyAdminPrivileges,
  updateCompanySettings,
  getCompanyAdmins,
  isCompanyAdmin, 
  getCompanyByAdminEmail,
  canApproveOrders,
  createCompany
} from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const email = searchParams.get('email')
    const checkAdmin = searchParams.get('checkAdmin')
    const getByAdminEmail = searchParams.get('getByAdminEmail')
    const getAdmins = searchParams.get('getAdmins')
    const checkCanApprove = searchParams.get('checkCanApprove')

    // Check if admin can approve orders
    if (checkCanApprove === 'true' && email && companyId) {
      const canApprove = await canApproveOrders(email, companyId)
      return NextResponse.json({ canApprove })
    }

    // Get company admins
    if (getAdmins === 'true' && companyId) {
      const admins = await getCompanyAdmins(companyId)
      console.log(`[API] Returning ${admins.length} admins for company ${companyId}`)
      return NextResponse.json(admins, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    // Check if user is admin of a company
    if (checkAdmin === 'true' && email && companyId) {
      const isAdmin = await isCompanyAdmin(email, companyId)
      return NextResponse.json({ isAdmin })
    }

    // Get company by admin email
    if (getByAdminEmail === 'true' && email) {
      const company = await getCompanyByAdminEmail(email)
      return NextResponse.json(company)
    }

    // Get company by ID
    if (companyId) {
      const company = await getCompanyById(companyId)
      return NextResponse.json(company)
    }

    // Get all companies
    const companies = await getAllCompanies()
    return NextResponse.json(companies)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { companyId, employeeId, action, canApproveOrders, showPrices, allowPersonalPayments, enableEmployeeOrder, allowLocationAdminViewFeedback, logo, primaryColor, secondaryColor, name } = body

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    if (action === 'addAdmin') {
      if (!employeeId) {
        return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
      }
      await addCompanyAdmin(companyId, employeeId, canApproveOrders || false)
      return NextResponse.json({ success: true, message: 'Company admin added successfully' })
    } else if (action === 'removeAdmin') {
      if (!employeeId) {
        return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
      }
      await removeCompanyAdmin(companyId, employeeId)
      return NextResponse.json({ success: true, message: 'Company admin removed successfully' })
    } else if (action === 'updatePrivileges') {
      if (!employeeId) {
        return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 })
      }
      if (typeof canApproveOrders !== 'boolean') {
        return NextResponse.json({ error: 'canApproveOrders must be a boolean' }, { status: 400 })
      }
      await updateCompanyAdminPrivileges(companyId, employeeId, canApproveOrders)
      return NextResponse.json({ success: true, message: 'Admin privileges updated successfully' })
    } else if (action === 'updateSettings') {
      // Log the incoming request
      console.log('[API] updateSettings request:', {
        companyId,
        enableEmployeeOrder,
        enableEmployeeOrderType: typeof enableEmployeeOrder,
        showPrices,
        allowPersonalPayments
      })
      
      const settings: { 
        showPrices?: boolean
        allowPersonalPayments?: boolean
        enableEmployeeOrder?: boolean
        allowLocationAdminViewFeedback?: boolean
        logo?: string
        primaryColor?: string
        secondaryColor?: string
        name?: string
      } = {}
      if (showPrices !== undefined) {
        if (typeof showPrices !== 'boolean') {
          return NextResponse.json({ error: 'showPrices must be a boolean' }, { status: 400 })
        }
        settings.showPrices = showPrices
      }
      if (allowPersonalPayments !== undefined) {
        if (typeof allowPersonalPayments !== 'boolean') {
          return NextResponse.json({ error: 'allowPersonalPayments must be a boolean' }, { status: 400 })
        }
        settings.allowPersonalPayments = allowPersonalPayments
      }
      if (enableEmployeeOrder !== undefined) {
        if (typeof enableEmployeeOrder !== 'boolean') {
          return NextResponse.json({ error: 'enableEmployeeOrder must be a boolean' }, { status: 400 })
        }
        settings.enableEmployeeOrder = enableEmployeeOrder
      }
      if (allowLocationAdminViewFeedback !== undefined) {
        if (typeof allowLocationAdminViewFeedback !== 'boolean') {
          return NextResponse.json({ error: 'allowLocationAdminViewFeedback must be a boolean' }, { status: 400 })
        }
        settings.allowLocationAdminViewFeedback = allowLocationAdminViewFeedback
      }
      if (logo !== undefined) {
        if (typeof logo !== 'string') {
          return NextResponse.json({ error: 'logo must be a string' }, { status: 400 })
        }
        settings.logo = logo
      }
      if (primaryColor !== undefined) {
        if (typeof primaryColor !== 'string') {
          return NextResponse.json({ error: 'primaryColor must be a string' }, { status: 400 })
        }
        settings.primaryColor = primaryColor
      }
      if (secondaryColor !== undefined) {
        if (typeof secondaryColor !== 'string') {
          return NextResponse.json({ error: 'secondaryColor must be a string' }, { status: 400 })
        }
        settings.secondaryColor = secondaryColor
      }
      if (name !== undefined) {
        if (typeof name !== 'string') {
          return NextResponse.json({ error: 'name must be a string' }, { status: 400 })
        }
        settings.name = name
      }
      const updated = await updateCompanySettings(companyId, settings)
      return NextResponse.json({ success: true, company: updated, message: 'Company settings updated successfully' })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const company = await createCompany(body)
    return NextResponse.json(company)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

