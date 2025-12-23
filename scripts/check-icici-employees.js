/**
 * Check for ICICI employees in local MongoDB
 */

const { MongoClient } = require('mongodb')

const MONGODB_URI_LOCAL = process.env.MONGODB_URI_LOCAL || 'mongodb://localhost:27017/uniform-distribution'

async function checkICICIEmployees() {
  const client = new MongoClient(MONGODB_URI_LOCAL)
  
  try {
    await client.connect()
    const db = client.db()
    const employees = db.collection('employees')
    const companies = db.collection('companies')
    
    console.log('🔍 Checking for ICICI Bank employees in local database...')
    console.log('')
    
    // Find ICICI company
    const iciciCompany = await companies.findOne({ 
      $or: [
        { name: { $regex: /icici/i } },
        { id: '100004' }
      ]
    })
    
    if (iciciCompany) {
      console.log(`✅ Found ICICI Company: ${iciciCompany.name} (ID: ${iciciCompany.id})`)
      console.log(`   Company ObjectId: ${iciciCompany._id}`)
      console.log('')
      
      // Find employees with this company
      const iciciEmployees = await employees.find({ 
        companyId: iciciCompany._id 
      }).toArray()
      
      console.log(`📊 ICICI employees in local DB: ${iciciEmployees.length}`)
      console.log('')
      
      if (iciciEmployees.length > 0) {
        console.log('ICICI employees:')
        for (const emp of iciciEmployees) {
          console.log(`  - ID: ${emp.id || emp.employeeId || 'N/A'}`)
          console.log(`    Email: ${emp.email || 'N/A'}`)
          console.log(`    Name: ${emp.firstName || ''} ${emp.lastName || ''}`)
          console.log(`    CompanyId: ${emp.companyId}`)
          console.log('')
        }
      } else {
        // Try finding by email pattern
        const emailPatternEmployees = await employees.find({ 
          email: { $regex: /icicibank/i } 
        }).toArray()
        
        console.log(`📊 Employees with ICICI email pattern: ${emailPatternEmployees.length}`)
        if (emailPatternEmployees.length > 0) {
          for (const emp of emailPatternEmployees) {
            console.log(`  - ID: ${emp.id || emp.employeeId || 'N/A'}`)
            console.log(`    Email: ${emp.email || 'N/A'}`)
            console.log(`    Name: ${emp.firstName || ''} ${emp.lastName || ''}`)
            console.log('')
          }
        }
      }
    } else {
      console.log('❌ ICICI Company not found in local database')
    }
    
    // Check for anjali.sharma specifically
    console.log('')
    console.log('🔍 Searching for anjali.sharma@icicibank.com...')
    const anjali = await employees.findOne({ 
      email: { $regex: /anjali.*sharma.*icici/i } 
    })
    
    if (anjali) {
      console.log('✅ Found Anjali Sharma:')
      console.log(JSON.stringify(anjali, null, 2))
    } else {
      console.log('❌ Anjali Sharma not found')
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    if (error.message.includes('ECONNREFUSED')) {
      console.log('💡 Local MongoDB is not running')
    }
  } finally {
    await client.close()
  }
}

checkICICIEmployees()

