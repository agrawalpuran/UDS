# 📤 Push Code to GitHub - Step by Step Guide

## Step 1: Install Git (Required)

Git is not currently installed on your system. You need to install it first.

### Download and Install Git:

1. **Go to**: https://git-scm.com/download/win
2. **Download** the latest version for Windows
3. **Run the installer** and use **default settings** (just click "Next" through all steps)
4. **Important**: After installation, **close and reopen** your PowerShell/terminal

### Verify Installation:

Open a **new** PowerShell window and run:
```powershell
git --version
```

You should see something like: `git version 2.x.x`

---

## Step 2: Create a GitHub Repository

1. **Go to**: https://github.com/new
2. **Repository name**: `uniform-distribution-system` (or any name you like)
3. **Description**: "Uniform Distribution System - Multi-tenant order management platform"
4. **Visibility**: 
   - Choose **Public** (free, anyone can see your code)
   - OR **Private** (only you can see, requires GitHub Pro for free private repos)
5. **⚠️ IMPORTANT**: **DO NOT** check "Initialize with README" (we're pushing existing code)
6. Click **"Create repository"**

After creating, you'll see a page with instructions. **Copy the repository URL** - it looks like:
```
https://github.com/YOUR_USERNAME/uniform-distribution-system.git
```

---

## Step 3: Create a Personal Access Token

GitHub requires a Personal Access Token instead of your password for authentication.

1. **Go to**: https://github.com/settings/tokens
2. Click **"Generate new token"** → **"Generate new token (classic)"**
3. **Note**: Enter "Vercel Deployment" (or any name)
4. **Expiration**: Choose **90 days** or **No expiration**
5. **Select scopes**: Check the box for **`repo`** (this gives full control of private repositories)
6. Scroll down and click **"Generate token"**
7. **⚠️ COPY THE TOKEN IMMEDIATELY** - it looks like: `ghp_xxxxxxxxxxxxxxxxxxxx`
   - You won't be able to see it again!
   - Save it somewhere safe (like a text file)

---

## Step 4: Push Your Code

Open PowerShell in your project directory and run these commands **one by one**:

### 4.1 Navigate to your project (if not already there)
```powershell
cd "C:\Users\pagrawal\OneDrive - CSG Systems Inc\Personal\Cursor AI\uniform-distribution-system"
```

### 4.2 Initialize Git
```powershell
git init
```

### 4.3 Configure Git (only needed first time)
```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```
Replace with your actual name and email.

### 4.4 Add all files
```powershell
git add .
```

### 4.5 Create your first commit
```powershell
git commit -m "Initial commit: Uniform Distribution System"
```

### 4.6 Rename branch to main
```powershell
git branch -M main
```

### 4.7 Add GitHub remote
**Replace `YOUR_USERNAME` with your actual GitHub username:**
```powershell
git remote add origin https://github.com/YOUR_USERNAME/uniform-distribution-system.git
```

### 4.8 Push to GitHub
```powershell
git push -u origin main
```

**When prompted:**
- **Username**: Enter your GitHub username
- **Password**: Enter your **Personal Access Token** (the one you created in Step 3, NOT your GitHub password)

---

## Step 5: Verify

1. Go to your GitHub repository: `https://github.com/YOUR_USERNAME/uniform-distribution-system`
2. You should see all your files! ✅

---

## Quick Copy-Paste Commands

Here's everything in one block (replace `YOUR_USERNAME` and your name/email):

```powershell
# Navigate to project
cd "C:\Users\pagrawal\OneDrive - CSG Systems Inc\Personal\Cursor AI\uniform-distribution-system"

# Initialize Git
git init

# Configure (replace with your info)
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"

# Add files
git add .

# Commit
git commit -m "Initial commit: Uniform Distribution System"

# Set branch
git branch -M main

# Add remote (REPLACE YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/uniform-distribution-system.git

# Push (you'll be prompted for username and token)
git push -u origin main
```

---

## Troubleshooting

### ❌ "git is not recognized"
- **Solution**: Install Git from https://git-scm.com/download/win
- **Restart PowerShell** after installation

### ❌ "remote origin already exists"
- **Solution**: Remove and re-add:
  ```powershell
  git remote remove origin
  git remote add origin https://github.com/YOUR_USERNAME/uniform-distribution-system.git
  ```

### ❌ "Authentication failed"
- **Solution**: Use your **Personal Access Token** (not your GitHub password)
- Make sure you copied the token correctly (starts with `ghp_`)

### ❌ "fatal: not a git repository"
- **Solution**: Make sure you're in the project directory
- Run `git init` first

### ❌ "Permission denied"
- **Solution**: Check that your repository URL is correct
- Make sure you have access to the repository

---

## What's Next?

After successfully pushing to GitHub:

1. ✅ Go to **Vercel** (https://vercel.com)
2. ✅ Click **"Add New Project"**
3. ✅ Import your GitHub repository
4. ✅ Add `MONGODB_URI` environment variable
5. ✅ Deploy!

See `DEPLOYMENT_GUIDE.md` for detailed Vercel deployment instructions.

---

## Important Notes

- ✅ `.env.local` files are **automatically excluded** (won't be pushed)
- ✅ `node_modules` is **automatically excluded**
- ✅ `.next` build folder is **automatically excluded**
- ✅ Your secrets are **safe** - they won't be pushed to GitHub

---

## Future Updates

To push updates later:
```powershell
git add .
git commit -m "Your update message"
git push
```

---

**Need help?** Check the full deployment guide: `DEPLOYMENT_GUIDE.md`





