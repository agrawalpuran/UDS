# 🚀 Complete Vercel Deployment Guide

This guide will walk you through deploying your Uniform Distribution System to Vercel step by step.

## Prerequisites

- A GitHub account
- A MongoDB Atlas account (free tier works)
- Node.js installed locally (for testing)
- Git installed

---

## Step 1: Prepare Your Code for GitHub

### 1.1 Initialize Git (if not already done)

```bash
cd uniform-distribution-system
git init
```

### 1.2 Create/Update .gitignore

Make sure your `.gitignore` includes:
- `.env*.local` (local environment files)
- `node_modules/`
- `.next/`
- `.vercel/`

### 1.3 Commit Your Code

```bash
git add .
git commit -m "Prepare for Vercel deployment"
```

---

## Step 2: Push to GitHub

### 2.1 Create a New Repository on GitHub

1. Go to [github.com](https://github.com)
2. Click "New repository"
3. Name it: `uniform-distribution-system` (or your preferred name)
4. **Do NOT** initialize with README, .gitignore, or license
5. Click "Create repository"

### 2.2 Push Your Code

```bash
# Add your GitHub repository as remote
git remote add origin https://github.com/YOUR_USERNAME/uniform-distribution-system.git

# Push to GitHub
git branch -M main
git push -u origin main
```

**Note:** Replace `YOUR_USERNAME` with your actual GitHub username.

---

## Step 3: Set Up MongoDB Atlas

### 3.1 Create MongoDB Atlas Account

1. Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Sign up for a free account
3. Choose the **FREE (M0) Shared** cluster

### 3.2 Create a Cluster

1. Select a cloud provider (AWS recommended)
2. Choose a region closest to you
3. Name your cluster (e.g., "Cluster0")
4. Click "Create Cluster" (takes 3-5 minutes)

### 3.3 Create Database User

1. Go to **Database Access** → **Add New Database User**
2. Choose **Password** authentication
3. Username: `uniform-admin` (or your choice)
4. Password: Generate a strong password (save it!)
5. Database User Privileges: **Atlas admin** (or **Read and write to any database**)
6. Click "Add User"

### 3.4 Configure Network Access

1. Go to **Network Access** → **Add IP Address**
2. Click **"Allow Access from Anywhere"** (for Vercel deployment)
   - This adds `0.0.0.0/0` to the whitelist
3. Click "Confirm"

### 3.5 Get Connection String

1. Go to **Database** → **Connect**
2. Choose **"Connect your application"**
3. Driver: **Node.js**, Version: **5.5 or later**
4. Copy the connection string:
   ```
   mongodb+srv://uniform-admin:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
5. **Replace `<password>`** with your actual database user password
6. **Add database name** at the end:
   ```
   mongodb+srv://uniform-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/uniform-distribution?retryWrites=true&w=majority
   ```

**Save this connection string!** You'll need it for Vercel.

---

## Step 4: Deploy to Vercel

### 4.1 Sign Up/Login to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** or **"Login"**
3. Choose **"Continue with GitHub"** (recommended)
4. Authorize Vercel to access your GitHub account

### 4.2 Import Your Project

1. Click **"Add New..."** → **"Project"**
2. Find your `uniform-distribution-system` repository
3. Click **"Import"**

### 4.3 Configure Project Settings

Vercel will auto-detect Next.js. Configure:

**Framework Preset:** Next.js (auto-detected)

**Root Directory:** `./` (default)

**Build Command:** `npm run build` (default)

**Output Directory:** `.next` (default)

**Install Command:** `npm install` (default)

### 4.4 Add Environment Variables

Click **"Environment Variables"** and add:

| Name | Value | Environment |
|------|-------|-------------|
| `MONGODB_URI` | `mongodb+srv://uniform-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/uniform-distribution?retryWrites=true&w=majority` | Production, Preview, Development |

**Important:**
- Replace `YOUR_PASSWORD` with your actual MongoDB password
- Replace `cluster0.xxxxx` with your actual cluster URL
- Add to **all three environments** (Production, Preview, Development)

### 4.5 Deploy

1. Click **"Deploy"**
2. Wait 2-3 minutes for the build to complete
3. Your app will be live at: `https://your-project-name.vercel.app`

---

## Step 5: Migrate Your Data to MongoDB Atlas

### Option A: Using Migration Script (Recommended)

1. **Update the migration script** (if needed) to use your Atlas connection string:

```bash
# Set environment variable
$env:MONGODB_URI_ATLAS="mongodb+srv://uniform-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/uniform-distribution?retryWrites=true&w=majority"

# Run migration
npm run migrate-to-atlas
```

### Option B: Using MongoDB Compass (GUI)

1. Download [MongoDB Compass](https://www.mongodb.com/products/compass)
2. Connect to your **local MongoDB**:
   - Connection string: `mongodb://localhost:27017/uniform-distribution`
3. Export collections:
   - Right-click each collection → Export Collection
   - Save as JSON files
4. Connect to **MongoDB Atlas**:
   - Use your Atlas connection string
5. Import collections:
   - Create database: `uniform-distribution`
   - Import each JSON file

### Option C: Using mongodump/mongorestore

```bash
# Export from local
mongodump --uri="mongodb://localhost:27017/uniform-distribution" --out=./backup

# Import to Atlas
mongorestore --uri="mongodb+srv://uniform-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/uniform-distribution" ./backup/uniform-distribution
```

---

## Step 6: Verify Deployment

### 6.1 Test Your Live Site

1. Visit: `https://your-project-name.vercel.app`
2. Test login functionality
3. Verify data is loading correctly
4. Check browser console for errors

### 6.2 Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → **"Deployments"**
2. Click on the latest deployment
3. Check **"Logs"** tab for any errors

### 6.3 Common Issues

**Issue: "Database connection failed"**
- ✅ Check MongoDB Atlas Network Access (allow 0.0.0.0/0)
- ✅ Verify environment variable `MONGODB_URI` is set correctly
- ✅ Check connection string includes database name

**Issue: "Build failed"**
- ✅ Check Node.js version (Vercel uses 18.x by default)
- ✅ Verify all dependencies are in `package.json`
- ✅ Check build logs in Vercel dashboard

**Issue: "Data not showing"**
- ✅ Run migration script to copy data to Atlas
- ✅ Verify collections exist in MongoDB Atlas
- ✅ Check browser console for API errors

---

## Step 7: Custom Domain (Optional)

### 7.1 Add Custom Domain

1. Go to Vercel Dashboard → Your Project → **"Settings"** → **"Domains"**
2. Enter your domain (e.g., `uniforms.yourcompany.com`)
3. Follow DNS configuration instructions
4. Wait for DNS propagation (5-30 minutes)

---

## Step 8: Set Up Automatic Deployments

Vercel automatically deploys when you push to GitHub:

### 8.1 Production Deployments

- **Branch:** `main` or `master`
- **Trigger:** Every push to main branch
- **URL:** `https://your-project-name.vercel.app`

### 8.2 Preview Deployments

- **Branches:** All other branches
- **Trigger:** Every push to feature branches
- **URL:** `https://your-project-name-git-branch-name.vercel.app`

### 8.3 Workflow

```bash
# Make changes locally
git checkout -b feature/new-feature
# ... make changes ...
git add .
git commit -m "Add new feature"
git push origin feature/new-feature

# Vercel automatically creates a preview deployment
# Test the preview URL
# Merge to main when ready
git checkout main
git merge feature/new-feature
git push origin main

# Vercel automatically deploys to production
```

---

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://user:pass@cluster.mongodb.net/uniform-distribution?retryWrites=true&w=majority` |

### Optional Variables

You can add these if needed:
- `NODE_ENV=production` (auto-set by Vercel)
- `NEXT_PUBLIC_API_URL` (if using external APIs)

---

## Post-Deployment Checklist

- [ ] MongoDB Atlas cluster created and running
- [ ] Database user created with proper permissions
- [ ] Network access configured (0.0.0.0/0)
- [ ] Code pushed to GitHub
- [ ] Project imported to Vercel
- [ ] Environment variables set in Vercel
- [ ] Initial deployment successful
- [ ] Data migrated to MongoDB Atlas
- [ ] Site tested and working
- [ ] Custom domain configured (if applicable)

---

## Troubleshooting

### Build Errors

**Error: "Module not found"**
```bash
# Solution: Ensure all dependencies are in package.json
npm install
git add package.json package-lock.json
git commit -m "Update dependencies"
git push
```

**Error: "TypeScript errors"**
```bash
# Solution: Fix TypeScript errors locally first
npm run build  # Test build locally
```

### Runtime Errors

**Error: "Cannot connect to MongoDB"**
- Check MongoDB Atlas connection string
- Verify network access settings
- Check environment variable in Vercel dashboard

**Error: "API route not found"**
- Verify API routes are in `app/api/` directory
- Check Next.js routing structure

### Performance Issues

- Enable Vercel Analytics (optional)
- Use Vercel Edge Functions for API routes (if needed)
- Optimize images using Next.js Image component
- Enable caching headers

---

## Support Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/deployment)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Vercel Community](https://github.com/vercel/vercel/discussions)

---

## Quick Commands Reference

```bash
# Local development
npm run dev

# Build locally
npm run build

# Test production build
npm start

# Push to GitHub
git add .
git commit -m "Your message"
git push origin main

# Check Vercel deployment status
# Visit: https://vercel.com/dashboard
```

---

## Next Steps

1. ✅ Set up monitoring (Vercel Analytics)
2. ✅ Configure backup strategy for MongoDB Atlas
3. ✅ Set up CI/CD workflows
4. ✅ Add error tracking (Sentry, etc.)
5. ✅ Configure custom domain
6. ✅ Set up staging environment

---

**Congratulations! 🎉 Your app is now live on Vercel!**

For questions or issues, check the Vercel dashboard logs or MongoDB Atlas logs.



