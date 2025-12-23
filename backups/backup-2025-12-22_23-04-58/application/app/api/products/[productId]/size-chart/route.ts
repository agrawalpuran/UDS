import { NextResponse } from 'next/server'
import { getProductSizeChart } from '@/lib/db/data-access'

export async function GET(
  request: Request,
  { params }: { params: { productId: string } }
) {
  try {
    const { productId } = params

    if (!productId) {
      return NextResponse.json(
        { error: 'Product ID is required' },
        { status: 400 }
      )
    }

    // Validate product ID format (6-digit numeric)
    if (!/^\d{6}$/.test(productId)) {
      return NextResponse.json(
        { error: 'Invalid product ID format. Must be 6-digit numeric string.' },
        { status: 400 }
      )
    }

    const sizeChart = await getProductSizeChart(productId)

    if (!sizeChart) {
      return NextResponse.json(
        { error: 'Size chart not found for this product' },
        { status: 404 }
      )
    }

    return NextResponse.json(sizeChart, { status: 200 })
  } catch (error: any) {
    console.error('Error fetching size chart:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch size chart' },
      { status: 500 }
    )
  }
}

