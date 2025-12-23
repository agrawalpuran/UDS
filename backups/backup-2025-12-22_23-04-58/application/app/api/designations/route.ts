import { NextResponse } from 'next/server'
import { 
  getUniqueDesignationsByCompany,
  getUniqueShirtSizesByCompany,
  getUniquePantSizesByCompany,
  getUniqueShoeSizesByCompany
} from '@/lib/db/data-access'
import '@/lib/models/Employee' // Ensure model is registered

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const type = searchParams.get('type') // 'designation', 'shirtSize', 'pantSize', 'shoeSize'

    if (!companyId) {
      return NextResponse.json({ error: 'Missing required parameter: companyId' }, { status: 400 })
    }

    if (type === 'shirtSize') {
      const sizes = await getUniqueShirtSizesByCompany(companyId)
      return NextResponse.json(sizes)
    } else if (type === 'pantSize') {
      const sizes = await getUniquePantSizesByCompany(companyId)
      return NextResponse.json(sizes)
    } else if (type === 'shoeSize') {
      const sizes = await getUniqueShoeSizesByCompany(companyId)
      return NextResponse.json(sizes)
    } else {
      // Default: return designations
      const designations = await getUniqueDesignationsByCompany(companyId)
      return NextResponse.json(designations)
    }
  } catch (error: any) {
    console.error('API Error in /api/designations:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


