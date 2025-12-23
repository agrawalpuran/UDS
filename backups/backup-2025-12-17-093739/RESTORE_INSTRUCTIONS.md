# UDS Backup Restore Instructions

## Backup Information
- **Date:** 2025-12-17 09:37:39
- **Backup Type:** Full (Application + Database)
- **Database:** uniform-distribution

## Restore Application Code

1. Navigate to project root
2. Copy files from `backups/backup-2025-12-17-093739/application/` to project root
3. Restore `.env.local` from `.env.local.example` (update with actual values)
4. Run `npm install` to restore dependencies
5. Restart the application

## Restore Database

### Option 1: Using mongorestore (Recommended)

```bash
mongorestore --uri="mongodb+srv://<username>:<password>@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority" --db="uniform-distribution" --dir="backups/backup-2025-12-17-093739/database/uniform-distribution" --gzip
```

### Option 2: Using MongoDB Compass

1. Open MongoDB Compass
2. Connect to your database
3. Use the Import feature to import collections from the backup directory

### Option 3: Manual Collection Import

If you need to restore specific collections, use:

```bash
mongorestore --uri="mongodb+srv://<username>:<password>@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority" --db="uniform-distribution" --collection="<collection_name>" --dir="backups/backup-2025-12-17-093739/database/uniform-distribution/<collection_name>" --gzip
```

## Verification

After restore, verify:
1. Application starts without errors
2. Database collections are restored
3. Data integrity is maintained
4. All indexes are recreated

## Notes

- This backup includes application code and database
- Configuration files are sanitized (sensitive data removed)
- Database backup is compressed (gzip)
- Always test restore in a non-production environment first
