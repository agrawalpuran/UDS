# UDS Application Migration Guide

This guide will help you restore the Uniform Distribution System (UDS) application on a new laptop.

## Prerequisites

### 1. Install Required Software

#### Node.js and npm
- Download and install Node.js (v18 or higher) from: https://nodejs.org/
- Verify installation:
  ```bash
  node --version
  npm --version
  ```

#### Git (Optional but recommended)
- Download from: https://git-scm.com/downloads
- Verify: `git --version`

#### MongoDB (if using local MongoDB)
- Download MongoDB Community Server from: https://www.mongodb.com/try/download/community
- Or use MongoDB Atlas (cloud) - no installation needed

---

## Step-by-Step Migration Process

### Step 1: Restore Code Files

1. **Copy your code backup** to the new laptop
   - Location: `C:\Users\[YourUsername]\OneDrive - CSG Systems Inc\Personal\Cursor AI\uniform-distribution-system`
   - Or any location you prefer

2. **Verify all files are present:**
   - `package.json` - should exist
   - `next.config.js` - should exist
   - `.env.local` - should exist (or will create in Step 3)
   - `lib/` folder - should exist
   - `app/` folder - should exist
   - All other folders and files

---

### Step 2: Install Dependencies

1. **Open PowerShell or Command Prompt** in the project directory:
   ```powershell
   cd "C:\Users\[YourUsername]\OneDrive - CSG Systems Inc\Personal\Cursor AI\uniform-distribution-system"
   ```

2. **Install npm packages:**
   ```bash
   npm install
   ```
   - This will install all dependencies listed in `package.json`
   - Wait for installation to complete (may take a few minutes)

3. **Verify installation:**
   ```bash
   npm list --depth=0
   ```

---

### Step 3: Set Up Environment Variables

1. **Create `.env.local` file** in the project root (if not already present):
   ```bash
   # In PowerShell
   New-Item -Path ".env.local" -ItemType File -Force
   ```

2. **Add the following environment variables** to `.env.local`:

   ```env
   # MongoDB Connection String
   # Option 1: MongoDB Atlas (Cloud - Recommended)
   MONGODB_URI=mongodb+srv://admin:Welcome%24123@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority

   # Option 2: Local MongoDB (if using local database)
   # MONGODB_URI=mongodb://localhost:27017/uniform-distribution

   # Encryption Key (IMPORTANT: Use the same key from your old laptop)
   # If you don't have the original key, you'll need to decrypt/re-encrypt data
   ENCRYPTION_KEY=default-encryption-key-change-in-production-32-chars!!

   # Next.js Port (optional, defaults to 3000)
   PORT=3001
   ```

3. **Important Notes:**
   - **MONGODB_URI**: Use the same connection string from your old laptop
   - **ENCRYPTION_KEY**: **CRITICAL** - Must be the same as your old laptop, otherwise encrypted data (emails, designations, etc.) cannot be decrypted
   - If you don't remember the encryption key, check your old laptop's `.env.local` file

---

### Step 4: Restore Database

#### Option A: MongoDB Atlas (Cloud Database - Recommended)

If you're using MongoDB Atlas, **no restoration needed** - the database is already in the cloud and accessible from any device.

1. **Verify connection:**
   - Your `.env.local` should have the correct `MONGODB_URI`
   - The database is automatically accessible

#### Option B: Local MongoDB (If using local database)

1. **Start MongoDB service:**
   ```powershell
   # Check if MongoDB service is running
   Get-Service MongoDB

   # Start MongoDB service (if not running)
   Start-Service MongoDB
   ```

2. **Restore database from backup:**
   ```bash
   # If you have a MongoDB dump folder
   mongorestore --db uniform-distribution "path\to\your\backup\folder"

   # If you have a .bson file
   mongorestore --db uniform-distribution --collection collectionName "path\to\file.bson"
   ```

3. **Verify database restoration:**
   ```bash
   # Connect to MongoDB
   mongosh

   # In MongoDB shell:
   use uniform-distribution
   show collections
   db.employees.countDocuments()
   db.companies.countDocuments()
   ```

---

### Step 5: Verify Application Setup

1. **Check for any missing files:**
   ```bash
   # Verify key files exist
   Test-Path "package.json"
   Test-Path ".env.local"
   Test-Path "next.config.js"
   ```

2. **Test database connection:**
   ```bash
   # Run a test script (if available)
   node scripts/check-designation-eligibility.ts
   ```

---

### Step 6: Start the Application

1. **Start the development server:**
   ```bash
   npm run dev
   ```

2. **Verify the application is running:**
   - Open browser: http://localhost:3001
   - You should see the login page

3. **Test login:**
   - Try logging in with your existing credentials
   - Verify data is loading correctly

---

## Troubleshooting

### Issue 1: "Cannot find module" errors
**Solution:**
```bash
# Delete node_modules and reinstall
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm install
```

### Issue 2: "ECONNREFUSED" MongoDB connection error
**Solutions:**
- **If using MongoDB Atlas:**
  - Check your IP is whitelisted in MongoDB Atlas
  - Verify the connection string in `.env.local`
  - Check internet connection

- **If using local MongoDB:**
  - Ensure MongoDB service is running: `Start-Service MongoDB`
  - Verify MongoDB is installed and configured

### Issue 3: Encrypted data showing as encrypted strings
**Solution:**
- Verify `ENCRYPTION_KEY` in `.env.local` matches your old laptop
- If key is different, you'll need to re-encrypt data or use the original key

### Issue 4: Port already in use
**Solution:**
```bash
# Change port in .env.local
PORT=3002

# Or kill the process using port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Issue 5: Missing dependencies
**Solution:**
```bash
# Clear cache and reinstall
npm cache clean --force
npm install
```

---

## Post-Migration Checklist

- [ ] Node.js and npm installed
- [ ] Code files copied to new laptop
- [ ] Dependencies installed (`npm install` completed)
- [ ] `.env.local` file created with correct values
- [ ] Database connection verified (MongoDB Atlas or local)
- [ ] Encryption key matches old laptop
- [ ] Application starts without errors (`npm run dev`)
- [ ] Can access application at http://localhost:3001
- [ ] Can log in with existing credentials
- [ ] Data is displaying correctly (not encrypted strings)
- [ ] All features working (create orders, view employees, etc.)

---

## Important Files to Backup/Restore

### Critical Files:
1. **`.env.local`** - Contains database connection and encryption key
2. **`package.json`** - Dependencies list
3. **`next.config.js`** - Next.js configuration
4. **All code files** - `app/`, `lib/`, `components/`, `scripts/`, etc.

### Database:
- MongoDB Atlas: No backup needed (cloud)
- Local MongoDB: Backup using `mongodump`

---

## Quick Start Commands

```bash
# 1. Navigate to project
cd "C:\Users\[YourUsername]\OneDrive - CSG Systems Inc\Personal\Cursor AI\uniform-distribution-system"

# 2. Install dependencies
npm install

# 3. Start application
npm run dev

# 4. Access application
# Open browser: http://localhost:3001
```

---

## Need Help?

If you encounter issues:
1. Check the error messages in the terminal
2. Verify all environment variables are set correctly
3. Ensure MongoDB is accessible
4. Check that the encryption key matches your old laptop
5. Review the troubleshooting section above

---

## Notes

- **Encryption Key**: The most critical piece - if this doesn't match, encrypted data won't decrypt
- **Database Connection**: Ensure MongoDB Atlas IP whitelist includes your new laptop's IP
- **Port Conflicts**: If port 3001 is in use, change it in `.env.local`
- **Dependencies**: Always run `npm install` after copying code to ensure all packages are installed

