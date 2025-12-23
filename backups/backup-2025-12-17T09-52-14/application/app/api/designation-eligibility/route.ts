import { NextResponse } from 'next/server'
import {
  getDesignationEligibilitiesByCompany,
  getDesignationEligibilityById,
  getDesignationEligibilityByDesignation,
  createDesignationEligibility,
  updateDesignationEligibility,
  deleteDesignationEligibility,
} from '@/lib/db/data-access'
import '@/lib/models/DesignationProductEligibility' // Ensure model is registered

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const companyId = searchParams.get('companyId')
    const eligibilityId = searchParams.get('eligibilityId')
    const designation = searchParams.get('designation')

    if (eligibilityId) {
      const eligibility = await getDesignationEligibilityById(eligibilityId)
      if (!eligibility) {
        return NextResponse.json(null, { status: 404 })
      }
      return NextResponse.json(eligibility)
    }

    if (companyId && designation) {
      const gender = searchParams.get('gender') as 'male' | 'female' | undefined
      const eligibility = await getDesignationEligibilityByDesignation(companyId, designation, gender)
      return NextResponse.json(eligibility)
    }

    if (companyId) {
      const eligibilities = await getDesignationEligibilitiesByCompany(companyId)
      return NextResponse.json(eligibilities)
    }

    return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 })
  } catch (error: any) {
    console.error('API Error in /api/designation-eligibility:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    console.log('POST /api/designation-eligibility - Request body:', {
      companyId: body.companyId,
      designation: body.designation,
      allowedProductCategories: body.allowedProductCategories,
      itemEligibilityKeys: body.itemEligibility ? Object.keys(body.itemEligibility) : 'none',
      itemEligibilityFull: body.itemEligibility ? JSON.stringify(body.itemEligibility, null, 2) : 'none',
      gender: body.gender,
    })
    
    // Log specific values to verify they're being sent
    if (body.itemEligibility) {
      for (const [key, value] of Object.entries(body.itemEligibility)) {
        console.log(`  📤 Frontend sent ${key}:`, JSON.stringify(value, null, 2))
      }
    }

    const { companyId, designation, allowedProductCategories, itemEligibility, gender } = body

    if (!companyId || !designation || !allowedProductCategories) {
      const missingFields = []
      if (!companyId) missingFields.push('companyId')
      if (!designation) missingFields.push('designation')
      if (!allowedProductCategories) missingFields.push('allowedProductCategories')
      console.error('Missing required fields:', missingFields)
      return NextResponse.json(
        { error: `Missing required fields: ${missingFields.join(', ')}` },
        { status: 400 }
      )
    }

    const eligibility = await createDesignationEligibility(
      companyId,
      designation,
      allowedProductCategories,
      itemEligibility,
      gender || 'unisex'
    )
    
    console.log('POST /api/designation-eligibility - Success:', {
      id: eligibility?.id,
      designation: eligibility?.designation,
    })
    
    return NextResponse.json(eligibility, { status: 201 })
  } catch (error: any) {
    console.error('API Error in /api/designation-eligibility POST:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    console.log('PUT /api/designation-eligibility - Request body:', {
      eligibilityId: body.eligibilityId,
      designation: body.designation,
      allowedProductCategories: body.allowedProductCategories,
      itemEligibilityKeys: body.itemEligibility ? Object.keys(body.itemEligibility) : 'none',
      itemEligibilityFull: body.itemEligibility ? JSON.stringify(body.itemEligibility, null, 2) : 'none',
      gender: body.gender,
      status: body.status,
    })
    
    // Log specific values to verify they're being sent
    if (body.itemEligibility) {
      for (const [key, value] of Object.entries(body.itemEligibility)) {
        console.log(`  📤 Frontend sent ${key}:`, JSON.stringify(value, null, 2))
      }
    }

    const { eligibilityId, designation, allowedProductCategories, itemEligibility, gender, status, refreshEligibility } = body

    if (!eligibilityId) {
      console.error('Missing required field: eligibilityId')
      return NextResponse.json({ error: 'Missing required field: eligibilityId' }, { status: 400 })
    }

    const eligibility = await updateDesignationEligibility(
      eligibilityId,
      designation,
      allowedProductCategories,
      itemEligibility,
      gender,
      status,
      refreshEligibility
    )
    
    console.log('PUT /api/designation-eligibility - Success:', {
      id: eligibility?.id,
      designation: eligibility?.designation,
    })
    
    return NextResponse.json(eligibility)
  } catch (error: any) {
    console.error('API Error in /api/designation-eligibility PUT:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const eligibilityId = searchParams.get('eligibilityId')

    if (!eligibilityId) {
      return NextResponse.json({ error: 'Missing required field: eligibilityId' }, { status: 400 })
    }

    await deleteDesignationEligibility(eligibilityId)
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('API Error in /api/designation-eligibility DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

