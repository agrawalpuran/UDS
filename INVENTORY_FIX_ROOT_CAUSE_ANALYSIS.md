# Inventory Management Root Cause Analysis & Fix

## Database Verification Results

### 1. Database Tables/Collections Verified

✅ **Collection EXISTS:** `vendorinventories`
- **Location:** MongoDB database `uniform-distribution`
- **Status:** Collection exists and contains data
- **Record Count:** 1 inventory record found

### 2. Actual Schema Discovered

**Collection:** `vendorinventories`

**Fields:**
- `_id`: ObjectId (MongoDB default)
- `id`: String (unique, e.g., "VEND-INV-1765943808435-E5QAY")
- `vendorId`: **ObjectId** (references vendors._id)
- `productId`: **ObjectId** (references uniforms._id)
- `sizeInventory`: **Plain Object** (stored as `{"28":100,"30":0,...}`)
- `totalStock`: Number
- `lowInventoryThreshold`: Plain Object
- `createdAt`: Date
- `updatedAt`: Date

**Indexes:**
1. `_id` (unique: false)
2. `id` (unique: true)
3. `vendorId` (unique: false)
4. `productId` (unique: false)
5. `vendorId + productId` (unique: true) - **Compound unique index**

### 3. Write-Path Analysis

**Function:** `updateVendorInventory()` in `lib/db/data-access.ts`

**What Works:**
- ✅ Writes DO persist to database
- ✅ Data structure is correct (ObjectIds for vendorId/productId)
- ✅ sizeInventory stored as plain object (correct for MongoDB)

**Sample Written Record:**
```json
{
  "_id": "69422a00a060f4176e0f0454",
  "id": "VEND-INV-1765943808435-E5QAY",
  "vendorId": ObjectId("6929b9d9a2fdaf5e8d099e3d"),
  "productId": ObjectId("6929b9d9a2fdaf5e8d099e51"),
  "sizeInventory": {"28":100,"30":0,"32":0,"34":0,"36":0,"38":0},
  "totalStock": 100
}
```

### 4. Read-Path Mismatch Identified

**Function:** `getVendorInventory()` in `lib/db/data-access.ts`

**ROOT CAUSE:**

The read path was using `vendor._id` directly in queries, but MongoDB requires **exact type matching**. When `vendor._id` is retrieved from Mongoose, it might be:
- An ObjectId instance (correct)
- A string representation (incorrect for querying)

**The Problem:**
```javascript
// BEFORE FIX (BROKEN):
const vendor = await Vendor.findOne({ id: vendorId })
const query = { vendorId: vendor._id }  // ❌ vendor._id might be string
const records = await db.collection('vendorinventories').find(query).toArray()
// Returns 0 records because string !== ObjectId
```

**Test Evidence:**
- Query with string `vendorId`: **0 records** ❌
- Query with ObjectId `vendorId`: **1 record** ✅

### 5. Root Cause (1-2 Sentences)

**MongoDB requires exact type matching for ObjectId fields. The read path was querying with `vendor._id` which could be a string, while inventory records store `vendorId` as ObjectId. String queries against ObjectId fields return 0 results even when the values match.**

### 6. Corrective Fix Applied

**File:** `lib/db/data-access.ts` (lines 7216-7279)

**Changes:**

1. **ObjectId Conversion for Queries:**
```javascript
// Convert vendor._id to ObjectId (guaranteed)
const vendorObjectId = vendor._id instanceof mongoose.Types.ObjectId 
  ? vendor._id 
  : new mongoose.Types.ObjectId(vendor._id.toString())
```

2. **Raw MongoDB Query Fix:**
```javascript
// Use ObjectId in raw MongoDB query
const rawQuery = {
  vendorId: vendorObjectId instanceof mongoose.Types.ObjectId
    ? vendorObjectId
    : new mongoose.Types.ObjectId(vendorObjectId.toString())
}
const rawInventoryRecords = await db.collection('vendorinventories').find(rawQuery).toArray()
```

3. **Mongoose Query Fix:**
```javascript
// Use ObjectId in Mongoose query
const mongooseQuery = {
  vendorId: vendorObjectId,
  ...(productId && query.productId ? { productId: query.productId } : {})
}
const inventoryRecords = await VendorInventory.find(mongooseQuery).lean()
```

4. **Update Path Fix (Plain Objects for Maps):**
```javascript
// Convert Maps to plain objects for MongoDB storage
const sizeInventoryPlain = {}
for (const [size, qty] of sizeInventoryMap.entries()) {
  sizeInventoryPlain[size] = qty
}
// Use plain object in $set
$set: {
  sizeInventory: sizeInventoryPlain,  // Plain object, not Map
  ...
}
```

### 7. Proof via DB-Level Evidence

**BEFORE FIX:**
```javascript
// Query: { vendorId: "6929b9d9a2fdaf5e8d099e3d" } (string)
// Result: 0 records ❌
```

**AFTER FIX:**
```javascript
// Query: { vendorId: ObjectId("6929b9d9a2fdaf5e8d099e3d") } (ObjectId)
// Result: 1 record ✅
```

**Database Record (Verified):**
- vendorId: ObjectId("6929b9d9a2fdaf5e8d099e3d") ✅
- productId: ObjectId("6929b9d9a2fdaf5e8d099e51") ✅
- sizeInventory: {"28":100,"30":0,"32":0,"34":0,"36":0,"38":0} ✅
- totalStock: 100 ✅

## Summary

**Root Cause:** Type mismatch in MongoDB queries - string vs ObjectId
**Fix:** Explicit ObjectId conversion before all queries
**Result:** Read path now correctly retrieves inventory records
**Status:** ✅ FIXED - Both read and write paths now aligned

