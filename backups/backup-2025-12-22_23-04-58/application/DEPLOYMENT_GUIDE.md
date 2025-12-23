# 🚀 Cloud Deployment Guide

This guide will help you deploy the Uniform Distribution System to the cloud so your friends can access it.

## 📋 Table of Contents
1. [Prerequisites](#prerequisites)
2. [Step 1: Set Up MongoDB Atlas (Cloud Database)](#step-1-set-up-mongodb-atlas-cloud-database)
3. [Step 2: Deploy to Vercel (Recommended)](#step-2-deploy-to-vercel-recommended)
4. [Step 3: Alternative Deployment Options](#step-3-alternative-deployment-options)
5. [Step 4: Migrate Your Data](#step-4-migrate-your-data)
6. [Step 5: Share Access](#step-5-share-access)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

- ✅ GitHub account (free)
- ✅ MongoDB Atlas account (free tier available)
- ✅ Vercel account (free tier available)
- ✅ Your local database has data you want to migrate

---

## Step 1: Set Up MongoDB Atlas (Cloud Database)

### 1.1 Create MongoDB Atlas Account

1. Go to [https://www.mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
2. Click **"Try Free"** or **"Sign Up"**
3. Sign up with your email or Google account

### 1.2 Create a Cluster

1. After signing in, click **"Build a Database"**
2. Choose **"M0 FREE"** tier (512 MB storage, perfect for testing)
3. Select a cloud provider and region (choose closest to you or your users)
   - Recommended: AWS, region closest to you
4. Click **"Create"** (takes 3-5 minutes)

### 1.3 Configure Database Access

1. Go to **"Database Access"** in the left sidebar
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Enter a username (e.g., `uniform-admin`)
5. Generate a secure password (click "Autogenerate Secure Password" or create your own)
   - **⚠️ IMPORTANT: Save this password!** You'll need it for the connection string
6. Set privileges to **"Atlas admin"** or **"Read and write to any database"**
7. Click **"Add User"**

### 1.4 Configure Network Access

1. Go to **"Network Access"** in the left sidebar
2. Click **"Add IP Address"**
3. For development/testing, click **"Allow Access from Anywhere"** (0.0.0.0/0)
   - ⚠️ For production, restrict to specific IPs
4. Click **"Confirm"**

### 1.5 Get Your Connection String

1. Go to **"Database"** in the left sidebar
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Select **"Node.js"** and version **"5.5 or later"**
5. Copy the connection string (looks like):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Replace `<username>` with your database username
7. Replace `<password>` with your database password
8. Add your database name at the end:
   ```
   mongodb+srv://uniform-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/uniform-distribution?retryWrites=true&w=majority
   ```

**✅ Save this connection string - you'll need it in Step 2!**

---

## Step 2: Deploy to Vercel (Recommended)

Vercel is the easiest way to deploy Next.js applications with zero configuration.

### 2.1 Push Your Code to GitHub

1. Create a new repository on GitHub:
   - Go to [https://github.com/new](https://github.com/new)
   - Name it: `uniform-distribution-system`
   - Make it **Public** (or Private if you prefer)
   - Click **"Create repository"**

2. Push your code:
   ```bash
   cd uniform-distribution-system
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/uniform-distribution-system.git
   git push -u origin main
   ```

### 2.2 Create .env.local File (for local testing)

Create a `.env.local` file in your project root:

```env
MONGODB_URI=mongodb+srv://uniform-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/uniform-distribution?retryWrites=true&w=majority
```

**⚠️ Add `.env.local` to `.gitignore`** (don't commit secrets!)

### 2.3 Deploy to Vercel

1. Go to [https://vercel.com](https://vercel.com)
2. Click **"Sign Up"** and sign in with GitHub
3. Click **"Add New Project"**
4. Import your GitHub repository: `uniform-distribution-system`
5. Configure the project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Root Directory**: `./` (default)
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `.next` (default)

6. **Add Environment Variable**:
   - Click **"Environment Variables"**
   - Name: `MONGODB_URI`
   - Value: Your MongoDB Atlas connection string
   - Environments: Select all (Production, Preview, Development)
   - Click **"Add"**

7. Click **"Deploy"**

8. Wait 2-3 minutes for deployment to complete

9. **✅ Your app is live!** You'll get a URL like: `https://uniform-distribution-system.vercel.app`

### 2.4 Update Build Settings (if needed)

If you encounter build errors, you may need to:
1. Go to **Project Settings** → **General**
2. Set **Node.js Version** to `20.x` or `18.x`
3. Redeploy

---

## Step 3: Alternative Deployment Options

### Option A: Railway

1. Go to [https://railway.app](https://railway.app)
2. Sign up with GitHub
3. Click **"New Project"** → **"Deploy from GitHub repo"**
4. Select your repository
5. Add environment variable: `MONGODB_URI`
6. Railway auto-detects Next.js and deploys

### Option B: Render

1. Go to [https://render.com](https://render.com)
2. Sign up with GitHub
3. Click **"New +"** → **"Web Service"**
4. Connect your GitHub repository
5. Settings:
   - **Build Command**: `npm run build`
   - **Start Command**: `npm start`
   - **Environment**: `Node`
6. Add environment variable: `MONGODB_URI`
7. Click **"Create Web Service"**

### Option C: Netlify

1. Go to [https://netlify.com](https://netlify.com)
2. Sign up with GitHub
3. Click **"Add new site"** → **"Import an existing project"**
4. Connect your repository
5. Build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
6. Add environment variable: `MONGODB_URI`
7. Click **"Deploy site"**

---

## Step 4: Migrate Your Data

You need to migrate your local MongoDB data to MongoDB Atlas.

### Option A: Using MongoDB Compass (GUI - Recommended)

1. **Download MongoDB Compass**: [https://www.mongodb.com/products/compass](https://www.mongodb.com/products/compass)

2. **Connect to Local Database**:
   - Connection string: `mongodb://localhost:27017/uniform-distribution`
   - Click **"Connect"**

3. **Export Collections**:
   - For each collection (uniforms, vendors, companies, employees, orders, etc.):
     - Right-click collection → **"Export Collection"**
     - Choose **JSON** format
     - Save to a folder

4. **Connect to MongoDB Atlas**:
   - Use your Atlas connection string
   - Click **"Connect"**

5. **Import Collections**:
   - For each exported JSON file:
     - Right-click database → **"Import Collection"**
     - Select the JSON file
     - Click **"Import"**

### Option B: Using mongodump/mongorestore (Command Line)

1. **Export from local database**:
   ```bash
   mongodump --uri="mongodb://localhost:27017/uniform-distribution" --out=./backup
   ```

2. **Restore to Atlas**:
   ```bash
   mongorestore --uri="mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/uniform-distribution" ./backup/uniform-distribution
   ```

### Option C: Using Migration Script (Code-based)

1. **Update your migration script** to use Atlas connection:
   ```javascript
   // In scripts/migrate-simple.js or create new script
   const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://...'
   ```

2. **Run migration**:
   ```bash
   MONGODB_URI="your-atlas-connection-string" npm run migrate
   ```

### Option D: Using Your Backup Script

If you have existing data in your local database:

1. **Backup your local database**:
   ```bash
   npm run backup-db
   ```

2. **Create a restore script** that connects to Atlas:
   ```javascript
   // scripts/restore-to-atlas.js
   const MONGODB_URI = process.env.MONGODB_URI // Your Atlas connection string
   // ... restore logic
   ```

---

## Step 5: Share Access

### 5.1 Share the Application URL

Once deployed, share your Vercel/Railway/Render URL with your friends:
- Example: `https://uniform-distribution-system.vercel.app`

### 5.2 Create Test Accounts

Your friends can use the existing test accounts (if you migrated them) or create new ones:

**Super Admin:**
- Email: `admin@uniform.com`
- Password: (as set in your system)

**Company Admin:**
- Email: `amit.patel@goindigo.in`
- Password: (as set in your system)

**Vendor:**
- Email: `vendor@example.com`
- Password: (as set in your system)

**Consumer:**
- Email: `vikram.singh@goindigo.in`
- Password: (as set in your system)

### 5.3 Custom Domain (Optional)

1. In Vercel, go to **Project Settings** → **Domains**
2. Add your custom domain (e.g., `uniform.yourdomain.com`)
3. Follow DNS configuration instructions
4. Your app will be accessible at your custom domain

---

## Troubleshooting

### Issue: Build Fails on Vercel

**Solution:**
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `package.json`
- Check Node.js version compatibility
- Verify environment variables are set

### Issue: Database Connection Fails

**Solution:**
- Verify MongoDB Atlas connection string is correct
- Check Network Access allows Vercel IPs (or use 0.0.0.0/0 for testing)
- Ensure database user has correct permissions
- Check environment variable is set in Vercel

### Issue: "Module not found" Errors

**Solution:**
- Run `npm install` locally to ensure all dependencies are listed
- Check `package.json` has all required packages
- Remove `node_modules` and `.next` folders, then redeploy

### Issue: Data Not Showing

**Solution:**
- Verify data was migrated to Atlas
- Check connection string points to correct database
- Verify collections exist in Atlas
- Check browser console for errors

### Issue: Environment Variables Not Working

**Solution:**
- In Vercel, go to **Settings** → **Environment Variables**
- Ensure variable name matches exactly: `MONGODB_URI`
- Redeploy after adding/changing variables
- Check variable is enabled for correct environment (Production/Preview)

---

## 🔒 Security Best Practices

1. **Never commit `.env.local`** to Git
2. **Use strong passwords** for MongoDB Atlas
3. **Restrict IP access** in production (don't use 0.0.0.0/0)
4. **Use environment variables** for all secrets
5. **Enable MongoDB Atlas authentication** (already done)
6. **Regular backups** of your Atlas database

---

## 📊 Monitoring & Maintenance

### MongoDB Atlas Monitoring

1. Go to **"Metrics"** in Atlas dashboard
2. Monitor:
   - Database size
   - Connection count
   - Query performance
   - Storage usage

### Vercel Analytics

1. Enable **Vercel Analytics** in project settings
2. Monitor:
   - Page views
   - Performance metrics
   - Error rates

### Database Backups

MongoDB Atlas M0 (Free) tier includes:
- Daily automated backups
- Point-in-time recovery (limited)

For production, consider upgrading to paid tier for:
- Continuous backups
- Longer retention
- More storage

---

## 🎉 You're Done!

Your Uniform Distribution System is now live in the cloud! Share the URL with your friends and they can access it from anywhere.

**Quick Checklist:**
- ✅ MongoDB Atlas cluster created
- ✅ Database user configured
- ✅ Network access configured
- ✅ Code pushed to GitHub
- ✅ Deployed to Vercel/Railway/Render
- ✅ Environment variables set
- ✅ Data migrated to Atlas
- ✅ Application accessible via URL

---

## 📞 Need Help?

- **MongoDB Atlas Docs**: [https://docs.atlas.mongodb.com](https://docs.atlas.mongodb.com)
- **Vercel Docs**: [https://vercel.com/docs](https://vercel.com/docs)
- **Next.js Deployment**: [https://nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)

---

**Last Updated**: January 2025





