import { NextResponse } from 'next/server'
import { getUniqueDesignationsByCompany } from '@/lib/db/data-access'
import '@/lib/models/Employee' // Ensure model is registered

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')

    if (!companyId) {
      return NextResponse.json({ error: 'Missing required parameter: companyId' }, { status: 400 })
    }

    const designations = await getUniqueDesignationsByCompany(companyId)
    return NextResponse.json(designations)
  } catch (error: any) {
    console.error('API Error in /api/designations:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}


