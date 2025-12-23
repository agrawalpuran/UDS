# Mongoose Index Duplicate Fix - Complete Resolution

## Root Cause Analysis

Duplicate index warnings occurred due to three main patterns:

### 1. **Fields with `unique: true` + `index: true`**
- `unique: true` automatically creates a unique index
- Adding `index: true` creates a redundant regular index
- **Fix**: Removed `index: true` from all fields with `unique: true`

### 2. **Fields with `index: true` + Explicit `schema.index()`**
- Field definition had `index: true`
- Same field also had explicit `Schema.index({ field: 1 })`
- **Fix**: Removed explicit index calls for fields with `index: true`

### 3. **Fields with `index: true` + Compound Index Prefix**
- Field had `index: true` 
- Field was also the first field in compound indexes (e.g., `{ companyId: 1, status: 1 }`)
- MongoDB can use compound indexes for prefix queries, making single-field index redundant
- **Fix**: Removed `index: true` from fields that are prefixes of compound indexes

## Complete List of Fixes

### Models Fixed:

1. **Company.ts**
   - ✅ Removed `index: true` from `id` (has `unique: true`)
   - ✅ Removed explicit `CompanySchema.index({ id: 1 })`

2. **Employee.ts**
   - ✅ Removed `index: true` from `id` (has `unique: true`)
   - ✅ Removed `index: true` from `employeeId` (has `unique: true`)
   - ✅ Removed `index: true` from `email` (has `unique: true`)
   - ✅ Removed `index: true` from `companyId` (prefix of compound indexes)
   - ✅ Removed `index: true` from `locationId` (prefix of compound indexes)
   - ✅ Removed explicit `EmployeeSchema.index({ id: 1 })`
   - ✅ Removed explicit `EmployeeSchema.index({ email: 1 })`
   - ✅ Removed explicit `EmployeeSchema.index({ employeeId: 1 })`

3. **Vendor.ts**
   - ✅ Removed `index: true` from `id` (has `unique: true`)
   - ✅ Removed explicit `VendorSchema.index({ id: 1 })`
   - ✅ Removed explicit `VendorSchema.index({ email: 1 })` (email has `unique: true`)

4. **Order.ts**
   - ✅ Removed `index: true` from `id` (has `unique: true`)
   - ✅ Removed `index: true` from `employeeId` (prefix of compound indexes)
   - ✅ Removed explicit `OrderSchema.index({ id: 1 })`
   - ✅ Removed explicit `OrderSchema.index({ vendorId: 1 })`

5. **Branch.ts**
   - ✅ Removed `index: true` from `id` (has `unique: true`)
   - ✅ Removed explicit `BranchSchema.index({ id: 1 })`
   - ✅ Removed explicit `BranchSchema.index({ companyId: 1 })`
   - ✅ Removed explicit `BranchSchema.index({ adminId: 1 })`

6. **Location.ts**
   - ✅ Removed `index: true` from `id` (has `unique: true`)

7. **DesignationProductEligibility.ts**
   - ✅ Removed `index: true` from `id` (has `unique: true`)
   - ✅ Removed `index: true` from `companyId` (prefix of compound indexes)
   - ✅ Removed explicit `DesignationProductEligibilitySchema.index({ id: 1 })`

8. **Uniform.ts**
   - ✅ Removed `index: true` from `id` (has `unique: true`)

9. **VendorInventory.ts**
   - ✅ Removed `index: true` from `id` (has `unique: true`)
   - ✅ Removed `index: true` from `vendorId` (prefix of compound indexes)
   - ✅ Removed `index: true` from `productId` (prefix of compound indexes)

10. **Relationship.ts** (ProductCompany, ProductVendor, VendorCompany)
    - ✅ Removed `index: true` from `productId` (prefix of compound indexes)
    - ✅ Removed `index: true` from `companyId` (prefix of compound indexes)
    - ✅ Removed `index: true` from `vendorId` (prefix of compound indexes)

11. **CompanyAdmin.ts** & **CompanyAdmin-BLR-AA207014.ts**
    - ✅ Removed explicit `CompanyAdminSchema.index({ companyId: 1 })`
    - ✅ Removed explicit `CompanyAdminSchema.index({ employeeId: 1 })`

12. **LocationAdmin.ts**
    - ✅ Removed explicit `LocationAdminSchema.index({ locationId: 1 })`
    - ✅ Removed explicit `LocationAdminSchema.index({ employeeId: 1 })`

## Index Sync Script

**Location**: `scripts/sync-mongoose-indexes.js`

### Features:
- ✅ Uses `mongoose.syncIndexes()` - safe and non-destructive
- ✅ Only modifies indexes, NOT data or collections
- ✅ Drops indexes that don't match schemas
- ✅ Creates missing indexes from schemas
- ✅ Environment safety checks (warns in production)
- ✅ Shows before/after index counts
- ✅ Lists all dropped indexes

### Usage:
```bash
node scripts/sync-mongoose-indexes.js
```

### Safety:
- ✅ Checks `NODE_ENV` and warns if running in production
- ✅ Requires explicit confirmation before proceeding
- ✅ Safe to run in development/staging environments
- ✅ Logs all operations for audit trail

## Next Steps

1. **Run the sync script** to clean up existing duplicate indexes:
   ```bash
   node scripts/sync-mongoose-indexes.js
   ```

2. **Restart the application** - duplicate index warnings should be completely gone

3. **Verify** - Check application logs for any remaining index warnings

## Index Strategy

### Single-Field Indexes (kept):
- Fields with `unique: true` (automatically indexed)
- Fields that are NOT prefixes of compound indexes
- Fields used in standalone queries

### Compound Indexes (kept):
- All compound indexes are preserved
- They can serve queries on prefix fields
- More efficient for multi-field queries

### Removed:
- Redundant `index: true` on fields with `unique: true`
- Redundant `index: true` on fields that are compound index prefixes
- Explicit `schema.index()` calls for fields with `index: true`

## Verification

After running the sync script and restarting:
- ✅ No duplicate index warnings in console
- ✅ All indexes match schema definitions
- ✅ Query performance maintained (compound indexes serve prefix queries)
- ✅ No data loss or schema changes

