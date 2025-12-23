# 📊 How to View MongoDB Data

## Your MongoDB Connection Details

**Connection String:** `mongodb+srv://admin:Welcome$123@cluster0.owr3ooi.mongodb.net/uniform-distribution`

**Database:** `uniform-distribution`

---

## Method 1: MongoDB Compass (Recommended - GUI Tool)

### Step 1: Download MongoDB Compass
1. Go to: https://www.mongodb.com/try/download/compass
2. Download and install MongoDB Compass for Windows

### Step 2: Connect to Your Database
1. Open MongoDB Compass
2. Paste your connection string:
   ```
   mongodb+srv://admin:Welcome$123@cluster0.owr3ooi.mongodb.net/uniform-distribution
   ```
3. Click "Connect"

### Step 3: Browse Collections
- Click on `uniform-distribution` database
- You'll see all collections:
  - `uniforms` - Products
  - `employees` - Employee records
  - `companies` - Company records
  - `vendors` - Vendor records
  - `orders` - Order records
  - `productvendors` - Product-Vendor relationships
  - `productcompanies` - Product-Company relationships
  - `branches` - Branch locations
  - And more...

### Step 4: View Documents
- Click on any collection to see all documents
- Use filters to search: `{ "id": 7 }` to find product with ID 7
- Click on any document to view/edit it

---

## Method 2: MongoDB Atlas Web Interface

### Step 1: Login to MongoDB Atlas
1. Go to: https://cloud.mongodb.com/
2. Login with your MongoDB Atlas account

### Step 2: Access Your Cluster
1. Click on your cluster: `cluster0`
2. Click "Browse Collections" button

### Step 3: View Data
- Select database: `uniform-distribution`
- Browse collections and documents
- Use filters and search

---

## Method 3: MongoDB Shell (mongosh) - Command Line

### Step 1: Install MongoDB Shell
```powershell
# Download from: https://www.mongodb.com/try/download/shell
# Or install via npm:
npm install -g mongosh
```

### Step 2: Connect
```powershell
mongosh "mongodb+srv://admin:Welcome$123@cluster0.owr3ooi.mongodb.net/uniform-distribution"
```

### Step 3: Run Queries
```javascript
// Show all databases
show dbs

// Use the database
use uniform-distribution

// Show all collections
show collections

// Find product with ID 7
db.uniforms.find({ id: 7 })

// Find all employees
db.employees.find().limit(10)

// Count documents
db.uniforms.countDocuments()
db.employees.countDocuments()
db.orders.countDocuments()

// Find ProductVendor links for product ID 7
db.productvendors.find({ 
  productId: ObjectId("6929b9d9a2fdaf5e8d099e55") 
})

// Find all companies
db.companies.find()

// Find all vendors
db.vendors.find()
```

---

## Method 4: Using Node.js Scripts (What We've Been Using)

### Quick Check Scripts

**Check Product-Vendor Relationships:**
```powershell
node scripts/check-product-vendor-data.js
```

**Check All Products:**
```powershell
node scripts/list-all-employees.js
```

**Test MongoDB Connection:**
```powershell
node scripts/test-mongodb-connection.js
```

### Create Your Own Script

Create a file `scripts/view-data.js`:

```javascript
const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uniform-distribution'

try {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const mongoMatch = envContent.match(/MONGODB_URI=(.+)/)
    if (mongoMatch) {
      MONGODB_URI = mongoMatch[1].trim().replace(/^["']|["']$/g, '')
    }
  }
} catch (error) {
  console.warn('Could not read .env.local')
}

async function viewData() {
  try {
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB\n')

    const db = mongoose.connection.db

    // List all collections
    const collections = await db.listCollections().toArray()
    console.log('📁 Collections:')
    collections.forEach(col => {
      console.log(`   - ${col.name}`)
    })
    console.log()

    // Count documents in each collection
    console.log('📊 Document Counts:')
    for (const col of collections) {
      const count = await db.collection(col.name).countDocuments()
      console.log(`   ${col.name}: ${count} documents`)
    }
    console.log()

    // View sample products
    console.log('📦 Sample Products:')
    const products = await db.collection('uniforms').find({}).limit(5).toArray()
    products.forEach(p => {
      console.log(`   - ID: ${p.id}, Name: ${p.name || 'N/A'}`)
    })
    console.log()

    // View sample employees
    console.log('👥 Sample Employees:')
    const employees = await db.collection('employees').find({}).limit(5).toArray()
    employees.forEach(e => {
      console.log(`   - ID: ${e.employeeId || e.id}, Email: ${e.email || 'N/A'}`)
    })

    await mongoose.disconnect()
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

viewData()
```

Run it:
```powershell
node scripts/view-data.js
```

---

## Method 5: VS Code Extension

### Install MongoDB Extension
1. Open VS Code
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "MongoDB for VS Code"
4. Install it

### Connect
1. Click MongoDB icon in sidebar
2. Click "Add Connection"
3. Paste connection string:
   ```
   mongodb+srv://admin:Welcome$123@cluster0.owr3ooi.mongodb.net/uniform-distribution
   ```

### Browse
- Expand connection → database → collection
- View documents in VS Code

---

## Quick Reference: Common Queries

### Find Product by ID
```javascript
db.uniforms.find({ id: 7 })
```

### Find Employee by Email
```javascript
db.employees.find({ email: "rajesh.kumar@goindigo.in" })
```

### Find All Orders
```javascript
db.orders.find().sort({ orderDate: -1 }).limit(10)
```

### Find ProductVendor Links
```javascript
db.productvendors.find({ 
  productId: ObjectId("6929b9d9a2fdaf5e8d099e55") 
})
```

### Find ProductCompany Links
```javascript
db.productcompanies.find({ 
  companyId: ObjectId("6929b9d9a2fdaf5e8d099e3a") 
})
```

### Count Documents
```javascript
db.uniforms.countDocuments()
db.employees.countDocuments()
db.orders.countDocuments()
```

---

## Recommended: MongoDB Compass

**For beginners, I recommend MongoDB Compass** because:
- ✅ Visual interface (no coding needed)
- ✅ Easy to browse collections
- ✅ Can edit documents directly
- ✅ Built-in query builder
- ✅ Export/import data
- ✅ Free to use

---

## Troubleshooting

### Connection Issues
- Make sure your IP is whitelisted in MongoDB Atlas
- Check connection string format
- Verify password is correct (URL-encoded: `$` → `%24`)

### Can't See Data
- Check you're connected to the right database: `uniform-distribution`
- Verify collection names (they're case-sensitive)
- Some data might be encrypted (PII fields)

---

**Need help?** Run `node scripts/check-product-vendor-data.js` to see a sample of your data!

