const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

// Load environment variables from env.local
const envPath = path.join(__dirname, '..', 'env.local')
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf8')
  envFile.split('\n').forEach(line => {
    // Skip comments and empty lines
    const trimmedLine = line.trim()
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const match = trimmedLine.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        let value = match[2].trim()
        // Remove quotes if present
        value = value.replace(/^["']|["']$/g, '')
        if (!process.env[key]) {
          process.env[key] = value
        }
      }
    }
  })
}

// Get MongoDB URI from environment or use default
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uniform-distribution'

console.log('🔌 Testing MongoDB Connection...')
console.log('📍 Connection String:', MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')) // Hide password
console.log('')

async function testConnection() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    })
    
    console.log('✅ Successfully connected to MongoDB!')
    console.log('')
    
    // Get database name
    const dbName = mongoose.connection.db.databaseName
    console.log(`📊 Database: ${dbName}`)
    console.log('')
    
    // List all collections
    const collections = await mongoose.connection.db.listCollections().toArray()
    console.log(`📁 Collections (${collections.length}):`)
    collections.forEach((col, index) => {
      console.log(`   ${index + 1}. ${col.name}`)
    })
    console.log('')
    
    // Count documents in each collection
    console.log('📈 Document Counts:')
    for (const col of collections) {
      try {
        const count = await mongoose.connection.db.collection(col.name).countDocuments()
        console.log(`   ${col.name}: ${count} documents`)
      } catch (err) {
        console.log(`   ${col.name}: Error counting (${err.message})`)
      }
    }
    console.log('')
    
    // Test specific collections directly
    console.log('🔍 Testing Collections:')
    
    const db = mongoose.connection.db
    
    // Test Employee collection
    try {
      const employeeCount = await db.collection('employees').countDocuments()
      const sampleEmployee = await db.collection('employees').findOne({})
      console.log(`   ✅ Employees: ${employeeCount} records`)
      if (sampleEmployee) {
        console.log(`      Sample: ${sampleEmployee.firstName || sampleEmployee.name || 'N/A'} (ID: ${sampleEmployee.id || sampleEmployee._id})`)
      }
    } catch (err) {
      console.log(`   ❌ Employees: ${err.message}`)
    }
    
    // Test Company collection
    try {
      const companyCount = await db.collection('companies').countDocuments()
      const sampleCompany = await db.collection('companies').findOne({})
      console.log(`   ✅ Companies: ${companyCount} records`)
      if (sampleCompany) {
        console.log(`      Sample: ${sampleCompany.name || 'N/A'} (ID: ${sampleCompany.id || sampleCompany._id})`)
      }
    } catch (err) {
      console.log(`   ❌ Companies: ${err.message}`)
    }
    
    // Test Uniform collection
    try {
      const uniformCount = await db.collection('uniforms').countDocuments()
      const sampleUniform = await db.collection('uniforms').findOne({})
      console.log(`   ✅ Uniforms: ${uniformCount} records`)
      if (sampleUniform) {
        console.log(`      Sample: ${sampleUniform.name || 'N/A'} (ID: ${sampleUniform.id || sampleUniform._id})`)
      }
    } catch (err) {
      console.log(`   ❌ Uniforms: ${err.message}`)
    }
    
    // Test Order collection
    try {
      const orderCount = await db.collection('orders').countDocuments()
      const sampleOrder = await db.collection('orders').findOne({})
      console.log(`   ✅ Orders: ${orderCount} records`)
      if (sampleOrder) {
        console.log(`      Sample: Order ${sampleOrder.id || sampleOrder._id} - Status: ${sampleOrder.status || 'N/A'}`)
      }
    } catch (err) {
      console.log(`   ❌ Orders: ${err.message}`)
    }
    
    // Test Vendor collection
    try {
      const vendorCount = await db.collection('vendors').countDocuments()
      const sampleVendor = await db.collection('vendors').findOne({})
      console.log(`   ✅ Vendors: ${vendorCount} records`)
      if (sampleVendor) {
        console.log(`      Sample: ${sampleVendor.name || 'N/A'} (ID: ${sampleVendor.id || sampleVendor._id})`)
      }
    } catch (err) {
      console.log(`   ❌ Vendors: ${err.message}`)
    }
    
    console.log('')
    console.log('✅ Connection test completed successfully!')
    
  } catch (error) {
    console.error('❌ Connection failed!')
    console.error('Error:', error.message)
    console.error('')
    console.error('💡 Troubleshooting:')
    console.error('   1. Check if MongoDB is running')
    console.error('   2. Verify MONGODB_URI is correct')
    console.error('   3. Check network access (for Atlas)')
    console.error('   4. Verify database user credentials')
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('🔌 Disconnected from MongoDB')
  }
}

testConnection()

