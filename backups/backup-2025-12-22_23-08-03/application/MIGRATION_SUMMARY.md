# UDS Migration Summary - Quick Reference

## 🚀 Quick Start (5 Steps)

1. **Copy code** to new laptop
2. **Install Node.js** (v18+) from nodejs.org
3. **Run:** `npm install`
4. **Create `.env.local`** with your MongoDB URI and encryption key
5. **Run:** `npm run dev`

---

## 📋 Critical Information to Transfer

### From Your Old Laptop's `.env.local`:

```env
MONGODB_URI=mongodb+srv://admin:Welcome%24123@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority

ENCRYPTION_KEY=default-encryption-key-change-in-production-32-chars!!

PORT=3001
```

⚠️ **IMPORTANT:** The `ENCRYPTION_KEY` must be EXACTLY the same, otherwise encrypted data won't decrypt!

---

## 📁 Files to Backup/Restore

### Must Have:
- ✅ Entire `uniform-distribution-system` folder
- ✅ `.env.local` file (with MongoDB URI and encryption key)
- ✅ `package.json`
- ✅ All code files (`app/`, `lib/`, `components/`, etc.)

### Database:
- ✅ MongoDB Atlas: No backup needed (cloud database)
- ✅ Local MongoDB: Use `mongodump` to backup

---

## 🔧 Setup Commands

```bash
# 1. Navigate to project
cd "path\to\uniform-distribution-system"

# 2. Install dependencies
npm install

# 3. Verify setup (optional)
node scripts/verify-setup.ts

# 4. Start application
npm run dev

# 5. Access in browser
# http://localhost:3001
```

---

## ✅ Verification Checklist

After migration, verify:

- [ ] Application starts: `npm run dev` runs without errors
- [ ] Can access: http://localhost:3001 loads
- [ ] Can login: Existing credentials work
- [ ] Data displays: Not showing encrypted strings
- [ ] Features work: Can create orders, view employees, etc.

---

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| Port 3001 in use | Change `PORT=3002` in `.env.local` |
| Module not found | Run `npm install` |
| Connection refused | Check `MONGODB_URI` in `.env.local` |
| Encrypted strings showing | Verify `ENCRYPTION_KEY` matches old laptop |
| Database not found | Restore database backup or check MongoDB Atlas |

---

## 📚 Detailed Guides

- **Full Guide:** See `MIGRATION_GUIDE.md`
- **Quick Checklist:** See `QUICK_MIGRATION_CHECKLIST.md`
- **Verify Setup:** Run `node scripts/verify-setup.ts`

---

## 💡 Pro Tips

1. **Test on old laptop first:** Make sure everything works before migrating
2. **Keep encryption key safe:** Write it down separately
3. **Use MongoDB Atlas:** Cloud database = no local setup needed
4. **Verify before deleting:** Test everything on new laptop before removing from old

---

## 📞 Need Help?

1. Check error messages in terminal
2. Review `MIGRATION_GUIDE.md` for detailed steps
3. Run `node scripts/verify-setup.ts` to diagnose issues
4. Check troubleshooting section in the full guide

