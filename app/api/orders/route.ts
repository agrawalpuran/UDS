import { NextResponse } from 'next/server'
import { 
  getAllOrders, 
  getOrdersByCompany, 
  getOrdersByEmployee,
  getOrdersByVendor,
  createOrder, 
  getConsumedEligibility,
  approveOrder,
  bulkApproveOrders,
  updateOrderStatus,
  getPendingApprovals,
  getPendingApprovalCount
} from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const employeeId = searchParams.get('employeeId')
    const vendorId = searchParams.get('vendorId')
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

    // Get orders by vendor (for vendor dashboard)
    if (vendorId) {
      const orders = await getOrdersByVendor(vendorId)
      return NextResponse.json(orders)
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
    console.error('API Error in /api/orders GET:', error)
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

export async function POST(request: Request) {
  let body: any = null
  try {
    body = await request.json()
    const { action, orderId, orderIds, adminEmail, status } = body

    // Bulk approve orders
    if (action === 'bulkApprove' && orderIds && Array.isArray(orderIds) && adminEmail) {
      const result = await bulkApproveOrders(orderIds, adminEmail)
      return NextResponse.json(result, { status: 200 })
    }

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
    console.log('API /api/orders POST: Creating order with data:', {
      employeeId: body.employeeId,
      itemsCount: body.items?.length || 0,
      items: body.items?.map((i: any) => ({ uniformId: i.uniformId, uniformName: i.uniformName }))
    })
    
    const order = await createOrder(body)
    console.log('API /api/orders POST: Order created successfully:', order.id || order.parentOrderId)
    return NextResponse.json(order, { status: 201 })
  } catch (error: any) {
    console.error('API Error in /api/orders POST:', error)
    console.error('Error name:', error?.name)
    console.error('Error message:', error?.message)
    console.error('Error stack:', error?.stack)
    console.error('Request body:', body ? JSON.stringify(body, null, 2) : 'Could not parse request body')
    
    // Extract error message more reliably
    let errorMessage = 'Unknown error occurred'
    if (error?.message) {
      errorMessage = error.message
    } else if (typeof error === 'string') {
      errorMessage = error
    } else if (error?.toString) {
      errorMessage = error.toString()
    }
    
    const isConnectionError = errorMessage.includes('Mongo') || errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')
    const isVendorError = errorMessage.includes('vendor') || errorMessage.includes('Vendor') || errorMessage.includes('No vendor found')
    const isNotFoundError = errorMessage.includes('not found') || errorMessage.includes('Not found')
    
    // Return appropriate status code based on error type
    let statusCode = 500
    if (isConnectionError) {
      statusCode = 503 // Service Unavailable
    } else if (isVendorError || isNotFoundError) {
      statusCode = 400 // Bad Request
    }
    
    console.error('Returning error response:', {
      errorMessage,
      statusCode,
      type: isConnectionError ? 'database_connection_error' : (isVendorError ? 'vendor_configuration_error' : 'api_error')
    })
    
    return NextResponse.json({ 
      error: errorMessage,
      type: isConnectionError ? 'database_connection_error' : (isVendorError ? 'vendor_configuration_error' : 'api_error'),
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: statusCode })
  }
}

