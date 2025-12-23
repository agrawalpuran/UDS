# Vendor Inventory Persistence Fix - Root Cause Analysis

## Problem Statement
- Vendor updates stock for individual sizes (S, M, L, etc.)
- Thresholds may also be updated
- Total stock remains unchanged
- On page refresh, values reset
- Database does NOT reflect changes

## Root Cause Identified

### Database Structure Verification ✅
- **Collection exists:** `vendorinventories` collection exists
- **Schema:** Correct structure with `vendorId`, `productId`, `sizeInventory` (Map), `totalStock`, `lowInventoryThreshold` (Map)
- **Indexes:** Proper unique index on `{ vendorId: 1, productId: 1 }`
- **Raw MongoDB updates work:** Direct `updateOne` operations succeed

### Write-Path Failure Identified ❌

**The Problem:**
The `updateVendorInventory` function was using `findOneAndUpdate` with `.lean()`, which:
1. **Bypasses Mongoose pre-save hooks** - The pre-save hook that recalculates `totalStock` from `sizeInventory` never runs
2. **Incorrect Map serialization** - `findOneAndUpdate` with plain objects doesn't properly serialize Map types
3. **No validation** - Pre-save validations don't run

**Evidence:**
- Raw MongoDB updates work (verified by test script)
- Mongoose `findOneAndUpdate` with `.lean()` doesn't trigger pre-save hooks
- The pre-save hook in `VendorInventory.ts` (lines 64-79) calculates `totalStock` from `sizeInventory`, but it never runs with `findOneAndUpdate`

### Read-Path Alignment ✅
- Read logic uses the same collection and keys
- No extra filters that exclude records
- Read and write use the same `vendorId` and `productId` ObjectIds

## Permanent Fix Implemented

### Solution: Use Document-Based Save Instead of findOneAndUpdate

**Changed from:**
```typescript
const inventory = await VendorInventory.findOneAndUpdate(
  { vendorId: vendor._id, productId: product._id },
  { $set: { ... } },
  { upsert: true, new: true, runValidators: true }
).lean()
```

**Changed to:**
```typescript
// 1. Find or create document
let inventoryDoc = await VendorInventory.findOne({
  vendorId: vendor._id,
  productId: product._id,
})

if (!inventoryDoc) {
  inventoryDoc = new VendorInventory({
    id: inventoryId,
    vendorId: vendor._id,
    productId: product._id,
    sizeInventory: new Map(),
    lowInventoryThreshold: new Map(),
    totalStock: 0,
  })
}

// 2. Update properties with Map instances
inventoryDoc.sizeInventory = sizeInventoryMap
inventoryDoc.lowInventoryThreshold = thresholdMap
inventoryDoc.totalStock = totalStock

// 3. Save - triggers pre-save hooks and proper Map serialization
const savedInventory = await inventoryDoc.save()
```

### Why This Fix Works

1. **Pre-save hooks run:** `document.save()` triggers the pre-save hook that recalculates `totalStock` from `sizeInventory`
2. **Map serialization works:** Mongoose properly serializes Map types when using `document.save()`
3. **Validations run:** All schema validations execute
4. **Atomic updates:** The save operation is atomic

### Verification Added

The fix includes comprehensive verification:
1. **Direct database query** after save to verify persistence
2. **Value matching** - verifies `totalStock` and `sizeInventory` match expected values
3. **Error throwing** - throws explicit errors if verification fails

## Proof of Fix

### Before Fix:
- `findOneAndUpdate` with `.lean()` bypasses pre-save hooks
- `totalStock` not recalculated
- Map serialization may fail
- No verification of persistence

### After Fix:
- `document.save()` triggers pre-save hooks
- `totalStock` automatically recalculated from `sizeInventory`
- Map serialization works correctly
- Direct database verification ensures persistence
- Explicit errors if verification fails

## Testing Instructions

1. **Update inventory via UI:**
   - Navigate to Vendor Portal → Inventory Management
   - Edit stock for sizes (e.g., S: 100, M: 200, L: 150)
   - Save

2. **Verify persistence:**
   - Check server logs for `[updateVendorInventory] ✅ DATABASE VERIFICATION PASSED`
   - Refresh the page
   - Verify values persist

3. **Check database directly:**
   - Query `vendorinventories` collection
   - Verify `sizeInventory` and `totalStock` match UI values

## Files Modified

- `lib/db/data-access.ts` - `updateVendorInventory` function (lines 7776-7970)
  - Changed from `findOneAndUpdate` to `document.save()` approach
  - Added comprehensive verification logic

## Constraints Met

- ✅ No business rule changes
- ✅ No breaking changes to existing inventory reads
- ✅ No new tables/collections
- ✅ Minimal, targeted fix
- ✅ Explicit error handling

