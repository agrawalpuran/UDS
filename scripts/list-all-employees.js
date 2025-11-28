const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uniform-distribution'

// Employee Schema
const EmployeeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  employeeId: { type: String, required: true, unique: true, index: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true, index: true },
  companyName: { type: String, required: true },
}, { strict: false })

const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema)

async function listAllEmployees() {
  try {
    console.log('🔄 Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB successfully\n')

    const employees = await Employee.find().sort({ employeeId: 1 }).lean()
    
    console.log(`📊 Total Employees: ${employees.length}\n`)
    console.log('=' .repeat(80))
    console.log('EMPLOYEE ID LIST')
    console.log('=' .repeat(80))
    
    employees.forEach((emp, index) => {
      console.log(`${index + 1}. ${emp.employeeId}`)
      console.log(`   Name: ${emp.firstName} ${emp.lastName}`)
      console.log(`   Email: ${emp.email}`)
      console.log(`   Company: ${emp.companyName}`)
      console.log(`   Internal ID: ${emp.id}`)
      console.log('')
    })
    
    // Check for duplicates
    const employeeIds = employees.map(e => e.employeeId)
    const uniqueIds = new Set(employeeIds)
    
    if (employeeIds.length === uniqueIds.size) {
      console.log('✅ All employee IDs are unique!')
    } else {
      console.log('⚠️  WARNING: Duplicate employee IDs found!')
      const duplicates = employeeIds.filter((id, index) => employeeIds.indexOf(id) !== index)
      console.log('Duplicates:', duplicates)
    }
    
    // Check for missing IDs
    const missingIds = employees.filter(e => !e.employeeId || e.employeeId === '')
    if (missingIds.length === 0) {
      console.log('✅ All employees have employee IDs assigned!')
    } else {
      console.log(`⚠️  WARNING: ${missingIds.length} employees are missing employee IDs`)
    }
    
  } catch (error) {
    console.error('❌ Error listing employees:', error)
    process.exit(1)
  } finally {
    console.log('\n👋 Disconnecting from MongoDB...')
    await mongoose.disconnect()
    console.log('✅ Disconnected from MongoDB')
  }
}

listAllEmployees()




