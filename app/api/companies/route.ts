import { NextResponse } from 'next/server'
import { 
  getAllCompanies, 
  getCompanyById, 
  addCompanyAdmin, 
  removeCompanyAdmin, 
  updateCompanyAdminPrivileges,
  getCompanyAdmins,
  isCompanyAdmin, 
  getCompanyByAdminEmail,
  canApproveOrders
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
      return NextResponse.json(admins)
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
    const { companyId, employeeId, action, canApproveOrders } = body

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
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

