# Mongoose Index Duplicate Fix

## Root Cause Summary

Multiple Mongoose schemas had duplicate index definitions where the same index was declared both:
1. Inline in the field definition: `{ field: { type: String, index: true } }`
2. Explicitly via schema method: `Schema.index({ field: 1 })`

This caused Mongoose to log warnings about duplicate indexes at runtime.

## Fixed Models

### 1. **Company.ts**
- **Removed**: `CompanySchema.index({ id: 1 })`
- **Reason**: `id` field already has `index: true` in schema definition

### 2. **Employee.ts**
- **Removed**: 
  - `EmployeeSchema.index({ id: 1 })`
  - `EmployeeSchema.index({ email: 1 })`
  - `EmployeeSchema.index({ employeeId: 1 })`
- **Reason**: All three fields already have `index: true` in schema definitions

### 3. **Vendor.ts**
- **Removed**: `VendorSchema.index({ id: 1 })`
- **Reason**: `id` field already has `index: true` in schema definition
- **Kept**: `VendorSchema.index({ email: 1 })` (email has `unique: true` but explicit index kept for clarity)

### 4. **Order.ts**
- **Removed**:
  - `OrderSchema.index({ id: 1 })`
  - `OrderSchema.index({ vendorId: 1 })`
- **Reason**: Both fields already have `index: true` in schema definitions

### 5. **Branch.ts**
- **Removed**:
  - `BranchSchema.index({ id: 1 })`
  - `BranchSchema.index({ companyId: 1 })`
  - `BranchSchema.index({ adminId: 1 })`
- **Reason**: All three fields already have `index: true` in schema definitions

### 6. **DesignationProductEligibility.ts**
- **Removed**: `DesignationProductEligibilitySchema.index({ id: 1 })`
- **Reason**: `id` field already has `index: true` in schema definition

## Index Sync Script

A safe index synchronization script has been created: `scripts/sync-mongoose-indexes.js`

### Features:
- Uses `mongoose.syncIndexes()` which is non-destructive
- Only modifies indexes, NOT data or collections
- Drops indexes that don't match schemas
- Creates missing indexes from schemas
- Includes production environment safety checks

### Usage:
```bash
node scripts/sync-mongoose-indexes.js
```

### Safety:
- Checks `NODE_ENV` and warns if running in production
- Requires explicit confirmation before proceeding in production
- Safe to run in development/staging environments

## Next Steps

1. **Run the sync script** to clean up existing duplicate indexes in the database:
   ```bash
   node scripts/sync-mongoose-indexes.js
   ```

2. **Restart the application** - duplicate index warnings should be gone

3. **Verify** - Check application logs for any remaining index warnings

## Notes

- All changes are backward compatible
- No data or schema structure changes
- Indexes are preserved, only duplicates removed
- Compound indexes (e.g., `{ companyId: 1, status: 1 }`) are kept as they provide query optimization

