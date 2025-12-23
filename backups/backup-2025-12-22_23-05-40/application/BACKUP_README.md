# 🔄 Backup & Restore System

Complete backup and restore solution for Uniform Distribution System.

## 📋 Overview

This backup system creates comprehensive backups including:
- ✅ Application source code (excluding node_modules, .next, build artifacts)
- ✅ MongoDB database (full dump with all collections and indexes)
- ✅ Configuration templates (with secrets redacted)
- ✅ Metadata and validation

## 🚀 Quick Start

### Create Backup

```bash
# Install dependencies (if not already installed)
npm install

# Create complete backup
npm run backup-complete
```

This will:
1. Create a timestamped backup directory in `backups/`
2. Backup application code
3. Backup MongoDB database
4. Create a ZIP archive
5. Validate the backup

### Restore Backup

```bash
# Restore from backup directory
npm run restore-backup backups/backup-2025-01-15T10-30-00

# Or restore from ZIP archive
npm run restore-backup backups/backup-2025-01-15T10-30-00.zip
```

## 📁 Backup Structure

```
backups/
└── backup-2025-01-15T10-30-00/
    ├── README.md                    # Restore instructions
    ├── application/                 # Application code
    │   ├── app/
    │   ├── components/
    │   ├── lib/
    │   ├── public/
    │   ├── scripts/
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── .env.local.template     # Environment template
    └── database/                    # Database backup
        ├── uniform-distribution/     # mongodump output (if available)
        └── backup-metadata.json     # Backup metadata
```

## 🔧 Configuration

### Environment Variables

The backup script reads MongoDB connection from:
1. `.env.local` file (MONGODB_URI)
2. Environment variable `MONGODB_URI`
3. Default: `mongodb://localhost:27017/uniform-distribution`

### Database Backup Methods

The script tries two methods in order:

1. **mongodump** (Preferred)
   - Official MongoDB tool
   - Faster and more reliable
   - Preserves indexes and metadata
   - Requires MongoDB Database Tools installed

2. **Code-based Backup** (Fallback)
   - Uses Mongoose to export data
   - Works without external tools
   - Creates JSON backup file
   - Also preserves indexes

## 📦 What's Included

### Application Code
- ✅ Source code (app, components, lib, public, scripts)
- ✅ Configuration files (package.json, tsconfig.json, etc.)
- ✅ Documentation (README, markdown files)
- ❌ node_modules (excluded)
- ❌ .next build directory (excluded)
- ❌ .env.local with secrets (excluded, template provided)

### Database
- ✅ All collections
- ✅ All documents
- ✅ All indexes
- ✅ Database metadata

## 🔒 Security

- **Secrets**: `.env.local` is excluded from backups
- **Template**: `.env.local.template` is included with placeholders
- **Validation**: Backup integrity is verified after creation

## 🛠️ Manual Operations

### Backup Database Only

```bash
node scripts/backup-database.js
```

### Restore Database Only

```bash
node scripts/restore-database.js [backup-path]
```

### Test Database Connection

```bash
node scripts/test-mongodb-connection.js
```

## 📝 Restore Process

### Step 1: Restore Application Code

```bash
# Extract backup if archived
unzip backup-2025-01-15T10-30-00.zip

# Navigate to backup directory
cd backup-2025-01-15T10-30-00/application

# Install dependencies
npm install

# Copy and configure environment
cp .env.local.template .env.local
# Edit .env.local with your actual credentials

# Build application
npm run build
```

### Step 2: Restore Database

#### Option A: Using mongorestore

```bash
# From backup directory
cd database

# Restore database
mongorestore --uri="your-mongodb-connection-string" ./uniform-distribution
```

#### Option B: Using restore script

```bash
# Run restore script
npm run restore-backup backups/backup-2025-01-15T10-30-00
```

### Step 3: Verify

```bash
# Test database connection
node scripts/test-mongodb-connection.js

# Start application
npm run dev
```

## ⚠️ Important Notes

1. **Environment Variables**: Always update `.env.local` with your actual credentials after restore
2. **Encryption Key**: Use the same `ENCRYPTION_KEY` from your original environment for encrypted data
3. **Database Connection**: Update `MONGODB_URI` in `.env.local` to point to your target database
4. **Dependencies**: Run `npm install` after restoring code to install all dependencies
5. **Backup Location**: Backups are stored in `backups/` directory (excluded from git)

## 🔍 Validation

The backup script validates:
- ✅ Application code backup exists
- ✅ Database backup exists
- ✅ Metadata file exists
- ✅ Collection counts and indexes

## 🐛 Troubleshooting

### mongodump not found

If you see "mongodump not found":
1. Install MongoDB Database Tools: https://www.mongodb.com/try/download/database-tools
2. Or the script will automatically use code-based backup

### Database connection failed

1. Check `.env.local` has correct `MONGODB_URI`
2. Verify MongoDB is running (for local) or accessible (for Atlas)
3. Check network connectivity and firewall rules

### Restore fails

1. Ensure target database is accessible
2. Check backup integrity (validation step)
3. Verify you have write permissions
4. Review error messages in console output

## 📚 Additional Resources

- MongoDB Backup Documentation: https://docs.mongodb.com/manual/backup/
- MongoDB Restore Documentation: https://docs.mongodb.com/manual/restore/
- Project README: `README.md`

---

**Generated by backup-complete.js**

