# 🚀 Quick Deployment Guide

## TL;DR - Deploy in 5 Steps

### 1. Set Up MongoDB Atlas (5 minutes)
- Go to [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- Sign up (free tier available)
- Create cluster → Configure database user → Allow network access (0.0.0.0/0)
- Copy connection string: `mongodb+srv://user:pass@cluster.mongodb.net/uniform-distribution`

### 2. Push Code to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/uniform-distribution-system.git
git push -u origin main
```

### 3. Deploy to Vercel
- Go to [vercel.com](https://vercel.com)
- Sign up with GitHub
- Import repository
- Add environment variable: `MONGODB_URI` = your Atlas connection string
- Deploy!

### 4. Migrate Data
```bash
# Option A: Use migration script
MONGODB_URI_ATLAS="your-atlas-connection-string" npm run migrate-to-atlas

# Option B: Use MongoDB Compass (GUI)
# Export from local → Import to Atlas
```

### 5. Share URL
- Your app is live at: `https://your-project.vercel.app`
- Share with friends!

---

## Environment Variables Needed

**Vercel/Railway/Render:**
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/uniform-distribution?retryWrites=true&w=majority
```

---

## Full Guide

See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.

---

## Common Issues

**Build fails?**
- Check Node.js version (use 18.x or 20.x)
- Verify all dependencies in package.json

**Database connection fails?**
- Check MongoDB Atlas network access (allow 0.0.0.0/0 for testing)
- Verify connection string is correct
- Check environment variable is set in Vercel

**Data not showing?**
- Run migration script: `npm run migrate-to-atlas`
- Verify collections exist in Atlas
- Check browser console for errors



