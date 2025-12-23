# Quick Start Guide

## 🚀 Resuming Work

### 1. Check Current State
Read `PROJECT_CONTEXT.md` for full project details and current state.

### 2. Restore from Backup (if needed)
```bash
# Full restore (code + database)
# 1. Copy backup folder back
# 2. Restore database
npm run restore-db "../mongodb-backup-YYYY-MM-DDTHH-MM-SS/database-backup.json"
```

### 3. Start Development
```bash
# Install dependencies (if needed)
npm install

# Start MongoDB (if not running)
# Windows: Check Services or run mongod

# Start development server
npm run dev
```

### 4. Access Application
- **Landing**: http://localhost:3001
- **Super Admin**: http://localhost:3001/login/superadmin
- **Company Admin**: http://localhost:3001/login/company
- **Consumer**: http://localhost:3001/login/consumer

---

## 📋 Common Commands

```bash
# Development
npm run dev              # Start dev server (port 3001)

# Database
npm run backup-db        # Backup database
npm run restore-db <path> # Restore database
npm run migrate          # Run migration

# Backup
npm run backup           # Backup code (folder)
npm run backup-zip       # Backup code (ZIP)
npm run backup-full      # Backup code + database

# Utilities
npm run add-employees    # Add sample employees
npm run list-employees   # List all employees
npm run delete-all-orders # Clear all orders
```

---

## 🔑 Test Credentials

- **Super Admin**: admin@uniformsystem.com (no OTP)
- **Company Admin**: amit.patel@goindigo.in (OTP: 123456)
- **Consumer**: vikram.singh@goindigo.in (OTP: 123456)

---

## ⚠️ Important Notes

- Server runs on **port 3001** (not 3000)
- MongoDB must be running on `localhost:27017`
- Database name: `uniform-distribution`
- All backups stored in parent directory

---

## 🆘 Quick Troubleshooting

**Port in use?**
```powershell
netstat -ano | findstr :3001
Stop-Process -Id <PID>
```

**MongoDB not connecting?**
- Check if MongoDB service is running
- Verify connection string in `lib/db/mongodb.ts`

**Products not showing?**
- Check product-company relationships in Super Admin
- Verify employee's companyId matches

---

*For detailed information, see `PROJECT_CONTEXT.md`*






