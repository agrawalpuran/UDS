import { NextResponse } from 'next/server'
import { 
  getEmployeeByEmployeeId, 
  getEmployeesByCompany, 
  createOrder, 
  getConsumedEligibility,
  getProductsByCompany 
} from '@/lib/db/data-access'
import connectDB from '@/lib/db/mongodb'
import Uniform from '@/lib/models/Uniform'
import Employee from '@/lib/models/Employee'
import Company from '@/lib/models/Company'

interface BulkOrderRow {
  employeeId: string
  sku: string
  size: string
  quantity: number
  rowNumber: number
}

interface BulkOrderResult {
  rowNumber: number
  employeeId: string
  sku: string
  size: string
  quantity: number
  status: 'success' | 'failed'
  orderId?: string
  error?: string
}

export async function POST(request: Request) {
  try {
    await connectDB()
    const body = await request.json()
    const { orders, companyId } = body

    if (!orders || !Array.isArray(orders)) {
      return NextResponse.json({ error: 'Invalid orders data' }, { status: 400 })
    }

    if (!companyId) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 })
    }

    // Verify company exists
    const company = await Company.findOne({ id: companyId })
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    // Get all employees for this company (for validation)
    const companyEmployees = await Employee.find({ companyId: company._id }).lean()
    const companyEmployeeIds = new Set(companyEmployees.map((e: any) => e.employeeId))

    // Get all products for this company
    const companyProducts = await getProductsByCompany(companyId)
    const productBySku = new Map<string, any>()
    companyProducts.forEach((p: any) => {
      productBySku.set(p.sku, p)
    })

    const results: BulkOrderResult[] = []
    const employeeOrders: Map<string, BulkOrderRow[]> = new Map()

    // Group orders by employee
    for (const order of orders) {
      const employeeId = order.employeeId?.trim()
      if (!employeeId) {
        results.push({
          rowNumber: order.rowNumber || 0,
          employeeId: '',
          sku: order.sku || '',
          size: order.size || '',
          quantity: order.quantity || 0,
          status: 'failed',
          error: 'Employee ID is required'
        })
        continue
      }

      if (!employeeOrders.has(employeeId)) {
        employeeOrders.set(employeeId, [])
      }
      employeeOrders.get(employeeId)!.push({
        employeeId,
        sku: order.sku?.trim() || '',
        size: order.size?.trim() || '',
        quantity: parseInt(order.quantity) || 0,
        rowNumber: order.rowNumber || 0
      })
    }

    // Process orders for each employee
    for (const [employeeId, employeeOrderRows] of Array.from(employeeOrders.entries())) {
      try {
        // Find employee by employeeId
        const employee = await Employee.findOne({ employeeId: employeeId })
          .populate('companyId')
          .lean()

        if (!employee) {
          // Mark all rows for this employee as failed
          for (const row of employeeOrderRows) {
            results.push({
              rowNumber: row.rowNumber,
              employeeId: row.employeeId,
              sku: row.sku,
              size: row.size,
              quantity: row.quantity,
              status: 'failed',
              error: `Employee not found: ${employeeId}`
            })
          }
          continue
        }

        // Verify employee belongs to the company
        const empCompanyId = typeof (employee as any).companyId === 'object' && (employee as any).companyId?._id
          ? (employee as any).companyId._id.toString()
          : (employee as any).companyId?.toString()
        const adminCompanyId = company._id.toString()

        if (empCompanyId !== adminCompanyId) {
          // Mark all rows for this employee as failed
          for (const row of employeeOrderRows) {
            results.push({
              rowNumber: row.rowNumber,
              employeeId: row.employeeId,
              sku: row.sku,
              size: row.size,
              quantity: row.quantity,
              status: 'failed',
              error: `Employee ${employeeId} does not belong to your company`
            })
          }
          continue
        }

        // Get consumed eligibility for this employee
        const employeeIdString = (employee as any).id
        const consumedEligibility = await getConsumedEligibility(employeeIdString)
        const totalEligibility = (employee as any).eligibility || {
          shirt: 0,
          pant: 0,
          shoe: 0,
          jacket: 0
        }

        // Calculate remaining eligibility
        const remainingEligibility = {
          shirt: totalEligibility.shirt - consumedEligibility.shirt,
          pant: totalEligibility.pant - consumedEligibility.pant,
          shoe: totalEligibility.shoe - consumedEligibility.shoe,
          jacket: totalEligibility.jacket - consumedEligibility.jacket
        }

        // First pass: Validate all rows and collect valid items
        const validOrderItems: Array<{
          uniformId: string
          uniformName: string
          size: string
          quantity: number
          price: number
          rowNumber: number
          category: string
        }> = []

        for (const row of employeeOrderRows) {
          // Find product by SKU
          const product = productBySku.get(row.sku)
          if (!product) {
            results.push({
              rowNumber: row.rowNumber,
              employeeId: row.employeeId,
              sku: row.sku,
              size: row.size,
              quantity: row.quantity,
              status: 'failed',
              error: `Product not found for SKU: ${row.sku}`
            })
            continue
          }

          // Verify product is linked to company
          if (!companyProducts.some((p: any) => p.id === product.id)) {
            results.push({
              rowNumber: row.rowNumber,
              employeeId: row.employeeId,
              sku: row.sku,
              size: row.size,
              quantity: row.quantity,
              status: 'failed',
              error: `Product ${row.sku} is not available for your company`
            })
            continue
          }

          // Validate size
          if (!product.sizes || !product.sizes.includes(row.size)) {
            results.push({
              rowNumber: row.rowNumber,
              employeeId: row.employeeId,
              sku: row.sku,
              size: row.size,
              quantity: row.quantity,
              status: 'failed',
              error: `Invalid size ${row.size} for product ${row.sku}. Available sizes: ${product.sizes.join(', ')}`
            })
            continue
          }

          // Validate quantity
          if (row.quantity <= 0) {
            results.push({
              rowNumber: row.rowNumber,
              employeeId: row.employeeId,
              sku: row.sku,
              size: row.size,
              quantity: row.quantity,
              status: 'failed',
              error: `Invalid quantity: ${row.quantity}. Must be greater than 0`
            })
            continue
          }

          // Add to valid items
          validOrderItems.push({
            uniformId: product.id,
            uniformName: product.name,
            size: row.size,
            quantity: row.quantity,
            price: product.price || 0,
            rowNumber: row.rowNumber,
            category: product.category
          })
        }

        // Second pass: Check eligibility by category
        const categoryTotals: Record<string, number> = {}
        for (const item of validOrderItems) {
          categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.quantity
        }

        // Check if any category exceeds eligibility
        let hasEligibilityError = false
        for (const [category, total] of Object.entries(categoryTotals)) {
          const remaining = remainingEligibility[category as keyof typeof remainingEligibility] || 0
          if (total > remaining) {
            hasEligibilityError = true
            // Mark all items in this category as failed
            for (const item of validOrderItems) {
              if (item.category === category) {
                results.push({
                  rowNumber: item.rowNumber,
                  employeeId: employeeId,
                  sku: employeeOrderRows.find(r => r.rowNumber === item.rowNumber)?.sku || '',
                  size: item.size,
                  quantity: item.quantity,
                  status: 'failed',
                  error: `Eligibility exceeded: Requested ${total} ${category}(s), but only ${remaining} remaining (Total: ${totalEligibility[category as keyof typeof totalEligibility]}, Used: ${consumedEligibility[category as keyof typeof consumedEligibility]})`
                })
              }
            }
          }
        }

        // Filter out items that failed eligibility check
        const orderItems = hasEligibilityError
          ? validOrderItems.filter(item => {
              const categoryTotal = categoryTotals[item.category] || 0
              const remaining = remainingEligibility[item.category as keyof typeof remainingEligibility] || 0
              return categoryTotal <= remaining
            })
          : validOrderItems

        // If validation passed, create the order
        if (orderItems.length > 0) {
          try {
            // Calculate estimated delivery time
            const dispatchPreference = (employee as any).dispatchPreference || 'standard'
            let estimatedDeliveryTime = '5-7 business days'
            if (dispatchPreference === 'direct') {
              estimatedDeliveryTime = '3-5 business days'
            } else if (dispatchPreference === 'central') {
              estimatedDeliveryTime = '5-7 business days'
            } else {
              estimatedDeliveryTime = '7-10 business days'
            }

            const savedOrder = await createOrder({
              employeeId: employeeIdString,
              items: orderItems.map(item => ({
                uniformId: item.uniformId,
                uniformName: item.uniformName,
                size: item.size,
                quantity: item.quantity,
                price: item.price
              })),
              deliveryAddress: (employee as any).address || 'Address not available',
              estimatedDeliveryTime: estimatedDeliveryTime,
              dispatchLocation: dispatchPreference
            })

            // Mark all items as successful
            for (const item of orderItems) {
              const row = employeeOrderRows.find(r => r.rowNumber === item.rowNumber)
              results.push({
                rowNumber: item.rowNumber,
                employeeId: employeeId,
                sku: row?.sku || '',
                size: item.size,
                quantity: item.quantity,
                status: 'success',
                orderId: savedOrder.id
              })
            }
          } catch (error: any) {
            // Mark all items as failed
            for (const item of orderItems) {
              const row = employeeOrderRows.find(r => r.rowNumber === item.rowNumber)
              results.push({
                rowNumber: item.rowNumber,
                employeeId: employeeId,
                sku: row?.sku || '',
                size: item.size,
                quantity: item.quantity,
                status: 'failed',
                error: `Failed to create order: ${error.message}`
              })
            }
          }
        }
      } catch (error: any) {
        // Mark all rows for this employee as failed
        for (const row of employeeOrderRows) {
          results.push({
            rowNumber: row.rowNumber,
            employeeId: row.employeeId,
            sku: row.sku,
            size: row.size,
            quantity: row.quantity,
            status: 'failed',
            error: `Error processing employee ${employeeId}: ${error.message}`
          })
        }
      }
    }

    // Sort results by row number
    results.sort((a, b) => a.rowNumber - b.rowNumber)

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length
      }
    })
  } catch (error: any) {
    console.error('Bulk order API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

