import { NextResponse } from 'next/server'
import { getAllProducts, getProductsByCompany, getProductById } from '@/lib/db/data-access'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const productId = searchParams.get('productId')

    if (productId) {
      const product = await getProductById(productId)
      return NextResponse.json(product)
    }

    if (companyId) {
      const products = await getProductsByCompany(companyId)
      return NextResponse.json(products)
    }

    const products = await getAllProducts()
    return NextResponse.json(products)
  } catch (error: any) {
    console.error('API Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}




