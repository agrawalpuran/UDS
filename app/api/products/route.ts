import { NextResponse } from 'next/server'
import { getAllProducts, getProductsByCompany, getAllProductsByCompany, getProductById, getProductsForDesignation, getProductsByVendor, createProduct, updateProduct, deleteProduct } from '@/lib/db/data-access'
import '@/lib/models/DesignationProductEligibility' // Ensure model is registered

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const productId = searchParams.get('productId')
    const designation = searchParams.get('designation')
    const vendorId = searchParams.get('vendorId')
    const all = searchParams.get('all') === 'true' // Flag to get all products without vendor filter

    if (productId) {
      const product = await getProductById(productId)
      return NextResponse.json(product)
    }

    if (vendorId) {
      // 🔍 INSTRUMENTATION: API boundary
      console.log('[API] /api/products GET - vendorId received:', vendorId, 'type:', typeof vendorId)
      
      // Get products linked to this vendor via ProductVendor relationships
      const products = await getProductsByVendor(vendorId)
      
      console.log('[API] /api/products GET - products returned:', {
        count: products?.length || 0,
        isArray: Array.isArray(products),
        sample: products?.[0] || null
      })
      
      return NextResponse.json(products)
    }

    if (companyId && designation) {
      // Filter products by company AND designation AND gender
      const gender = searchParams.get('gender') as 'male' | 'female' | undefined
      const products = await getProductsForDesignation(companyId, designation, gender)
      console.log(`Products for company ${companyId}, designation ${designation}, gender ${gender || 'unisex'}: ${products.length} products`)
      return NextResponse.json(products)
    }

    if (companyId) {
      // If 'all=true' is specified, return all products without vendor filter (for category extraction)
      if (all) {
        const products = await getAllProductsByCompany(companyId)
        return NextResponse.json(products)
      }
      // Otherwise, return only products with vendor fulfillment (for catalog/ordering)
      const products = await getProductsByCompany(companyId)
      return NextResponse.json(products)
    }

    const products = await getAllProducts()
    return NextResponse.json(products)
  } catch (error: any) {
    console.error('API Error in /api/products:', error)
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
  try {
    const productData = await request.json()
    const newProduct = await createProduct(productData)
    return NextResponse.json(newProduct, { status: 201 })
  } catch (error: any) {
    console.error('API Error in /api/products POST:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }
    
    const updateData = await request.json()
    
    // If vendorId is provided in updateData, validate vendor ownership
    if (updateData.vendorId) {
      console.log(`[API] /api/products PUT - Validating vendor ownership for product ${productId}, vendor ${updateData.vendorId}`)
      
      // Get products for this vendor
      const vendorProducts = await getProductsByVendor(updateData.vendorId)
      const productBelongsToVendor = vendorProducts.some((p: any) => p.id === productId)
      
      if (!productBelongsToVendor) {
        console.error(`[API] /api/products PUT - Vendor ${updateData.vendorId} does not own product ${productId}`)
        return NextResponse.json({ 
          error: 'You do not have permission to update this product. It does not belong to your vendor.' 
        }, { status: 403 })
      }
      
      // Remove vendorId from updateData before passing to updateProduct (vendors cannot change ownership)
      delete updateData.vendorId
      console.log(`[API] /api/products PUT - Vendor ownership validated, proceeding with update`)
    }
    
    const updatedProduct = await updateProduct(productId, updateData)
    return NextResponse.json(updatedProduct)
  } catch (error: any) {
    console.error('API Error in /api/products PUT:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')
    
    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required' }, { status: 400 })
    }
    
    await deleteProduct(productId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API Error in /api/products DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

