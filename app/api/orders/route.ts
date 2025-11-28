import { NextResponse } from 'next/server'
import { 
  getAllOrders, 
  getOrdersByCompany, 
  getOrdersByEmployee, 
  createOrder, 
  getConsumedEligibility,
  approveOrder,
  updateOrderStatus,
  getPendingApprovals,
  getPendingApprovalCount
} from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const employeeId = searchParams.get('employeeId')
    const consumedEligibility = searchParams.get('consumedEligibility')
    const pendingApprovals = searchParams.get('pendingApprovals')
    const pendingApprovalCount = searchParams.get('pendingApprovalCount')

    // Get pending approval count
    if (pendingApprovalCount === 'true' && companyId) {
      const count = await getPendingApprovalCount(companyId)
      return NextResponse.json({ count })
    }

    // Get pending approvals
    if (pendingApprovals === 'true' && companyId) {
      const orders = await getPendingApprovals(companyId)
      return NextResponse.json(orders)
    }

    // Return consumed eligibility for an employee
    if (consumedEligibility === 'true' && employeeId) {
      const consumed = await getConsumedEligibility(employeeId)
      return NextResponse.json(consumed)
    }

    if (companyId) {
      const orders = await getOrdersByCompany(companyId)
      return NextResponse.json(orders)
    }

    if (employeeId) {
      const orders = await getOrdersByEmployee(employeeId)
      return NextResponse.json(orders)
    }

    const orders = await getAllOrders()
    return NextResponse.json(orders)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { action, orderId, adminEmail, status } = body

    // Approve order
    if (action === 'approve' && orderId && adminEmail) {
      const order = await approveOrder(orderId, adminEmail)
      return NextResponse.json(order, { status: 200 })
    }

    // Update order status
    if (action === 'updateStatus' && orderId && status) {
      const order = await updateOrderStatus(orderId, status)
      return NextResponse.json(order, { status: 200 })
    }

    // Create new order
    const order = await createOrder(body)
    return NextResponse.json(order, { status: 201 })
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

