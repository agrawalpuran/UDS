# Quick Migration Checklist

Use this checklist to ensure nothing is missed during migration.

## Pre-Migration (Old Laptop)

- [ ] Backup code folder (entire `uniform-distribution-system` directory)
- [ ] Note down MongoDB connection string from `.env.local`
- [ ] Note down ENCRYPTION_KEY from `.env.local` (CRITICAL!)
- [ ] Backup database (if using local MongoDB)
- [ ] Note down any custom configurations

## New Laptop Setup

### 1. Install Prerequisites
- [ ] Install Node.js (v18+)
- [ ] Verify: `node --version` and `npm --version`

### 2. Restore Code
- [ ] Copy code folder to new laptop
- [ ] Verify `package.json` exists
- [ ] Verify folder structure is intact

### 3. Install Dependencies
- [ ] Run `npm install`
- [ ] Wait for completion (no errors)

### 4. Environment Setup
- [ ] Create `.env.local` file
- [ ] Add `MONGODB_URI` (same as old laptop)
- [ ] Add `ENCRYPTION_KEY` (MUST match old laptop)
- [ ] Add `PORT=3001` (if needed)

### 5. Database
- [ ] MongoDB Atlas: Verify connection string works
- [ ] Local MongoDB: Restore database backup

### 6. Test Application
- [ ] Run `npm run dev`
- [ ] Access http://localhost:3001
- [ ] Login with existing credentials
- [ ] Verify data displays correctly (not encrypted)
- [ ] Test key features (create order, view employees, etc.)

## Critical Items

⚠️ **ENCRYPTION_KEY** - Must match old laptop exactly, otherwise encrypted data won't decrypt

⚠️ **MONGODB_URI** - Must be correct for database access

⚠️ **Dependencies** - Must run `npm install` to install all packages

## Common Issues

- Port 3001 in use → Change PORT in `.env.local`
- Module not found → Run `npm install` again
- Connection refused → Check MongoDB connection string
- Encrypted strings showing → Check ENCRYPTION_KEY matches

