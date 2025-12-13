/**
 * Script to fix all employees with null companyId
 * Looks up company by companyName and sets the companyId ObjectId
 */

const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

// Try to read .env.local file manually
let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uniform-distribution'
try {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const mongoMatch = envContent.match(/MONGODB_URI=(.+)/)
    if (mongoMatch) {
      MONGODB_URI = mongoMatch[1].trim()
    }
  }
} catch (error) {
  console.log('Could not read .env.local, using default or environment variable')
}

async function fixEmployeeCompanyIds() {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('Connected to MongoDB')

    const db = mongoose.connection.db
    if (!db) {
      throw new Error('Database connection not available')
    }

    // Get all employees
    const employees = await db.collection('employees').find({}).toArray()
    console.log(`Found ${employees.length} employees`)

    // Get all companies
    const companies = await db.collection('companies').find({}).toArray()
    console.log(`Found ${companies.length} companies`)

    // Create a map of company name to company ObjectId
    const companyMap = new Map()
    companies.forEach((c) => {
      if (c.name) {
        const normalizedName = c.name.trim().toLowerCase()
        companyMap.set(normalizedName, {
          _id: c._id,
          id: c.id,
          name: c.name
        })
      }
    })

    console.log(`Company map created with ${companyMap.size} companies`)

    let fixedCount = 0
    let errorCount = 0
    const errors = []

    // Process each employee
    for (const emp of employees) {
      try {
        // Check if companyId is null or missing - be very explicit
        const hasCompanyId = emp.companyId !== null && emp.companyId !== undefined && emp.companyId !== ''
        const needsFix = !hasCompanyId || emp.companyId === null || emp.companyId === undefined
        
        console.log(`Checking employee ${emp.employeeId || emp.id}: companyId=${emp.companyId}, companyName=${emp.companyName}, needsFix=${needsFix}`)
        
        if (needsFix && emp.companyName) {
          // Try to find company by name
          const normalizedCompanyName = emp.companyName.trim().toLowerCase()
          const company = companyMap.get(normalizedCompanyName)
          
          if (company) {
            // Update employee with companyId
            await db.collection('employees').updateOne(
              { _id: emp._id },
              { 
                $set: { 
                  companyId: company._id,
                  companyName: company.name // Ensure companyName matches
                } 
              }
            )
            
            console.log(`✓ Fixed employee ${emp.employeeId || emp.id}: Set companyId to ${company.id} (${company.name})`)
            fixedCount++
          } else {
            console.warn(`⚠ Employee ${emp.employeeId || emp.id}: Company "${emp.companyName}" not found in companies collection`)
            errors.push({
              employeeId: emp.employeeId || emp.id,
              companyName: emp.companyName,
              error: 'Company not found'
            })
            errorCount++
          }
        } else if (!hasCompanyId && !emp.companyName) {
          console.warn(`⚠ Employee ${emp.employeeId || emp.id}: No companyId and no companyName`)
          errors.push({
            employeeId: emp.employeeId || emp.id,
            error: 'No companyId and no companyName'
          })
          errorCount++
        } else {
          // Employee already has companyId, verify it's valid
          if (hasCompanyId) {
            const companyIdStr = emp.companyId.toString()
            const company = companies.find((c) => c._id.toString() === companyIdStr)
            if (!company) {
              console.warn(`⚠ Employee ${emp.employeeId || emp.id}: companyId ${companyIdStr} doesn't match any company`)
              // Try to fix by companyName if available
              if (emp.companyName) {
                const normalizedCompanyName = emp.companyName.trim().toLowerCase()
                const companyByName = companyMap.get(normalizedCompanyName)
                if (companyByName) {
                  await db.collection('employees').updateOne(
                    { _id: emp._id },
                    { 
                      $set: { 
                        companyId: companyByName._id,
                        companyName: companyByName.name
                      } 
                    }
                  )
                  console.log(`✓ Fixed employee ${emp.employeeId || emp.id}: Updated invalid companyId to ${companyByName.id} (${companyByName.name})`)
                  fixedCount++
                } else {
                  errors.push({
                    employeeId: emp.employeeId || emp.id,
                    companyId: companyIdStr,
                    companyName: emp.companyName,
                    error: 'Invalid companyId and companyName not found'
                  })
                  errorCount++
                }
              } else {
                errors.push({
                  employeeId: emp.employeeId || emp.id,
                  companyId: companyIdStr,
                  error: 'Invalid companyId and no companyName'
                })
                errorCount++
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error processing employee ${emp.employeeId || emp.id}:`, error.message)
        errors.push({
          employeeId: emp.employeeId || emp.id,
          error: error.message
        })
        errorCount++
      }
    }

    console.log('\n=== Summary ===')
    console.log(`Total employees: ${employees.length}`)
    console.log(`Fixed: ${fixedCount}`)
    console.log(`Errors: ${errorCount}`)
    
    if (errors.length > 0) {
      console.log('\n=== Errors ===')
      errors.forEach((err, idx) => {
        console.log(`${idx + 1}. Employee ${err.employeeId}: ${err.error}`)
        if (err.companyName) console.log(`   CompanyName: ${err.companyName}`)
        if (err.companyId) console.log(`   CompanyId: ${err.companyId}`)
      })
    }

    await mongoose.disconnect()
    console.log('\nDisconnected from MongoDB')
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

fixEmployeeCompanyIds()
