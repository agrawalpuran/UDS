import { NextResponse } from 'next/server'
import { getProductSizeCharts } from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productIdsParam = searchParams.get('productIds')

    if (!productIdsParam) {
      return NextResponse.json(
        { error: 'productIds parameter is required' },
        { status: 400 }
      )
    }

    const productIds = productIdsParam.split(',').filter(id => /^\d{6}$/.test(id))

    if (productIds.length === 0) {
      return NextResponse.json({}, { status: 200 })
    }

    const sizeCharts = await getProductSizeCharts(productIds)

    return NextResponse.json(sizeCharts, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching size charts:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch size charts' },
      { status: 500 }
    )
  }
}

