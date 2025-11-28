const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uniform-distribution'

async function testEmailAPI() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB')
    console.log('')

    const db = mongoose.connection.db
    const testEmail = 'rajesh.kumar@goindigo.in'
    
    console.log(`🔍 Testing email lookup: "${testEmail}"`)
    console.log('')

    // Test 1: Direct collection query
    const employee1 = await db.collection('employees').findOne({ email: testEmail })
    console.log('Test 1 - Direct collection query:')
    if (employee1) {
      console.log(`✅ Found: ${employee1.firstName} ${employee1.lastName}`)
      console.log(`   Email in DB: "${employee1.email}"`)
      console.log(`   Email length: ${employee1.email?.length}`)
      console.log(`   Email match: ${employee1.email === testEmail}`)
    } else {
      console.log('❌ Not found')
    }
    console.log('')

    // Test 2: Case insensitive
    const employee2 = await db.collection('employees').findOne({ 
      email: { $regex: new RegExp(`^${testEmail}$`, 'i') } 
    })
    console.log('Test 2 - Case insensitive regex:')
    if (employee2) {
      console.log(`✅ Found: ${employee2.firstName} ${employee2.lastName}`)
    } else {
      console.log('❌ Not found')
    }
    console.log('')

    // Test 3: Check all employees and their emails
    const allEmployees = await db.collection('employees').find({}).toArray()
    console.log('📧 All employee emails in database:')
    allEmployees.forEach((emp, idx) => {
      const emailMatch = emp.email === testEmail
      const emailSimilar = emp.email?.toLowerCase() === testEmail.toLowerCase()
      console.log(`${idx + 1}. "${emp.email}"`)
      console.log(`   Match: ${emailMatch}, Similar (case): ${emailSimilar}`)
      if (emp.email !== emp.email?.trim()) {
        console.log(`   ⚠️  Has whitespace!`)
      }
    })
    console.log('')

    // Test 4: Try the actual function
    try {
      const { getEmployeeByEmail } = require('../lib/db/data-access')
      const employee3 = await getEmployeeByEmail(testEmail)
      console.log('Test 4 - Using getEmployeeByEmail function:')
      if (employee3) {
        console.log(`✅ Found: ${employee3.firstName} ${employee3.lastName}`)
        console.log(`   ID: ${employee3.id}`)
        console.log(`   Email: ${employee3.email}`)
      } else {
        console.log('❌ Not found')
      }
    } catch (err) {
      console.log(`❌ Error calling function: ${err.message}`)
    }

  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Disconnected')
  }
}

testEmailAPI()

