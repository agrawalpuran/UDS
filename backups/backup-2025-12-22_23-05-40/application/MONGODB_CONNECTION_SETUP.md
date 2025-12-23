# 🔌 MongoDB Connection Setup & Verification

## ✅ Current Status

**Connection Verified!** ✅

Your MongoDB is currently connected and working:
- **Database:** `uniform-distribution`
- **Connection:** Local MongoDB (`mongodb://localhost:27017`)
- **Collections:** 9 collections with data
- **Status:** ✅ Active and working

### Current Data Summary:
- 📦 **Orders:** 13 documents
- 🏢 **Companies:** 3 documents
- 👥 **Employees:** 10 documents
- 👔 **Uniforms:** 11 documents
- 🏪 **Vendors:** 3 documents
- 🔗 **Relationships:** Multiple (vendorcompanies, productcompanies, etc.)

---

## 🌐 For Vercel Deployment: MongoDB Atlas Setup

Since you already have a MongoDB account, you need to:

### Option 1: Use Existing Atlas Cluster

If you already have a MongoDB Atlas cluster:

1. **Get Your Connection String:**
   - Go to MongoDB Atlas Dashboard
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string
   - Replace `<password>` with your actual password
   - Add database name: `...mongodb.net/uniform-distribution?...`

2. **Test Connection:**
   ```powershell
   node scripts/setup-mongodb-atlas.js
   ```
   This will:
   - Test your Atlas connection
   - Verify collections
   - Save connection string to `.env.local`

3. **Verify Connection:**
   ```powershell
   # Set environment variable
   $env:MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/uniform-distribution?retryWrites=true&w=majority"
   
   # Test
   node scripts/test-mongodb-connection.js
   ```

### Option 2: Create New Atlas Cluster

If you need to create a new cluster:

1. **Create Cluster:**
   - Go to: https://cloud.mongodb.com
   - Click "Build a Database"
   - Choose **FREE (M0) Shared**
   - Select region
   - Click "Create" (takes 3-5 minutes)

2. **Create Database User:**
   - Database Access → Add New Database User
   - Username: `uniform-admin`
   - Password: Generate strong password
   - Privileges: Atlas admin
   - Click "Add User"

3. **Configure Network Access:**
   - Network Access → Add IP Address
   - Click "Allow Access from Anywhere" (0.0.0.0/0)
   - Click "Confirm"

4. **Get Connection String:**
   - Database → Connect → Connect your application
   - Copy connection string
   - Replace `<password>` with your password
   - Add `/uniform-distribution` before `?`

5. **Test Connection:**
   ```powershell
   node scripts/setup-mongodb-atlas.js
   ```

---

## 🔄 Migrate Data to Atlas

If you want to migrate your local data to Atlas:

### Step 1: Get Atlas Connection String
```powershell
node scripts/setup-mongodb-atlas.js
```

### Step 2: Run Migration
```powershell
# Set Atlas connection string
$env:MONGODB_URI_ATLAS="mongodb+srv://user:pass@cluster.mongodb.net/uniform-distribution?retryWrites=true&w=majority"

# Run migration
npm run migrate-to-atlas
```

---

## ✅ Verification Commands

### Test Local MongoDB:
```powershell
node scripts/test-mongodb-connection.js
```

### Test Atlas Connection:
```powershell
# Set environment variable
$env:MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/uniform-distribution?retryWrites=true&w=majority"

# Test
node scripts/test-mongodb-connection.js
```

### Test Application Connection:
```powershell
# Start dev server
npm run dev

# Check console for: "✅ MongoDB Connected"
```

---

## 📝 Environment Variables

### For Local Development:
Create `.env.local`:
```
MONGODB_URI=mongodb://localhost:27017/uniform-distribution
```

### For Vercel Deployment:
Add in Vercel Dashboard:
- Name: `MONGODB_URI`
- Value: `mongodb+srv://user:pass@cluster.mongodb.net/uniform-distribution?retryWrites=true&w=majority`
- Environments: Production, Preview, Development

---

## 🚨 Troubleshooting

### Connection Fails

**Check:**
- Connection string format
- Password is correct (URL-encoded if special characters)
- Network access in Atlas (0.0.0.0/0)
- Cluster is running

**Fix:**
```powershell
# Test connection string
node scripts/test-mongodb-connection.js
```

### Authentication Error

**Check:**
- Database user exists
- Password is correct
- User has proper privileges

**Fix:**
- Create new database user in Atlas
- Update connection string

### Network Access Error

**Check:**
- IP whitelist in Atlas
- Should include: `0.0.0.0/0` (for Vercel)

**Fix:**
- Network Access → Add IP Address → Allow Access from Anywhere

---

## 📊 Current Database Status

✅ **Connected:** Local MongoDB
✅ **Database:** uniform-distribution
✅ **Collections:** 9
✅ **Data:** Present and accessible

**Ready for:**
- ✅ Local development
- ⏳ Vercel deployment (needs Atlas connection string)

---

## 🎯 Next Steps

1. **Get MongoDB Atlas Connection String**
   - Use existing cluster OR create new one
   - Run: `node scripts/setup-mongodb-atlas.js`

2. **Test Atlas Connection**
   - Verify connection works
   - Check collections and data

3. **Migrate Data (if needed)**
   - Run: `npm run migrate-to-atlas`

4. **Deploy to Vercel**
   - Add `MONGODB_URI` environment variable
   - Deploy!

---

## 💡 Quick Commands

```powershell
# Test local connection
node scripts/test-mongodb-connection.js

# Setup Atlas connection
node scripts/setup-mongodb-atlas.js

# Test with custom URI
$env:MONGODB_URI="your-connection-string"
node scripts/test-mongodb-connection.js

# Migrate to Atlas
$env:MONGODB_URI_ATLAS="your-atlas-connection-string"
npm run migrate-to-atlas
```



