# Inventory Auto-Initialization on Product-Vendor Link

## Overview
Automatic inventory initialization when a product is linked to a vendor via Super Admin Relationship Management.

## Implementation Summary

### 1. Enhanced `ensureVendorInventoryExists` Function

**Location:** `lib/db/data-access.ts` (lines 7748-7850)

**Key Changes:**
- **Size Initialization:** Now initializes `sizeInventory` and `lowInventoryThreshold` Maps with all product sizes from `product.sizes` array
- **Default Values:** Each size is initialized to:
  - `stock = 0` (in `sizeInventory`)
  - `threshold = 0` (in `lowInventoryThreshold`)
- **Total Stock:** Automatically calculated by pre-save hook (sum of all sizes = 0)
- **Idempotency:** Checks for existing inventory before creating (safe to call multiple times)
- **Transactional Support:** Accepts optional MongoDB session parameter for transactional operations

**Code Flow:**
```typescript
1. Verify product exists
2. Check if inventory already exists (idempotency)
3. Extract product.sizes array
4. Initialize sizeInventory Map: { "S": 0, "M": 0, "L": 0, ... }
5. Initialize lowInventoryThreshold Map: { "S": 0, "M": 0, "L": 0, ... }
6. Generate unique inventory ID
7. Create VendorInventory document with Maps
8. Mark Map fields as modified
9. Save with session (if provided) or without
```

### 2. Transactional Product-Vendor Linking

**Location:** `lib/db/data-access.ts`
- `createProductVendor` (lines 6950-6978)
- `createProductVendorBatch` (lines 7008-7035)

**Key Changes:**
- **MongoDB Transactions:** Both functions now use MongoDB sessions for transactional safety
- **Atomic Operations:** ProductVendor relationship and VendorInventory creation happen in a single transaction
- **Rollback on Failure:** If inventory creation fails, the ProductVendor link is also rolled back
- **Error Handling:** Explicit error logging with vendorId, productId, and error details

**Transaction Flow:**
```typescript
1. Start MongoDB session
2. Start transaction
3. Create/update ProductVendor relationship (with session)
4. Initialize VendorInventory with all sizes (with session)
5. Commit transaction (both succeed together)
6. OR abort transaction (both fail together)
7. End session
```

## Features Implemented

### ✅ Inventory Record Creation
- Automatically creates `VendorInventory` record when product is linked to vendor
- One record per vendor-product combination (not per size)
- Record contains Map of all sizes with initial values

### ✅ Size-Level Initialization
- All sizes from `product.sizes` are initialized
- Each size gets:
  - `sizeInventory[size] = 0`
  - `lowInventoryThreshold[size] = 0`
- Handles products with no sizes (creates empty Maps with warning)

### ✅ Default Values
- Stock per size: `0`
- Threshold per size: `0`
- Total stock: `0` (calculated by pre-save hook)

### ✅ Idempotency
- Checks for existing inventory before creating
- Safe to link the same product multiple times
- Returns early if inventory already exists

### ✅ Transactional Safety
- ProductVendor link and inventory creation are atomic
- Both succeed together or both fail together
- No partial state possible

### ✅ Error Handling & Logging
- Explicit error messages with vendorId, productId, sizes
- Non-PII logging (uses IDs, not names)
- Debug-friendly log format with prefixes

## Sample Log Output

### Successful Creation:
```
[createProductVendor] ✅ Successfully created ProductVendor relationship
[ensureVendorInventoryExists] ✅ Created VendorInventory for vendor 6929b9d9a2fdaf5e8d099e3d / product 6929b9d9a2fdaf5e8d099e4f
[ensureVendorInventoryExists] 📊 Initialized 5 sizes: S, M, L, XL, XXL
[createProductVendor] ✅ Transaction committed: Product-Vendor link and inventory initialized
```

### Idempotent Call (Already Exists):
```
[ensureVendorInventoryExists] ✅ Inventory already exists for vendor 6929b9d9a2fdaf5e8d099e3d / product SHIRT-M-001
```

### Product with No Sizes:
```
[ensureVendorInventoryExists] ⚠️  Product SHIRT-M-001 has no sizes defined. Creating inventory with empty size map.
[ensureVendorInventoryExists] ✅ Created VendorInventory for vendor 6929b9d9a2fdaf5e8d099e3d / product SHIRT-M-001
[ensureVendorInventoryExists] 📊 Initialized 0 sizes:
```

### Transaction Failure:
```
[createProductVendor] ❌ Transaction aborted: {
  vendorId: 'VEND-001',
  productId: 'SHIRT-M-001',
  error: 'Product not found: 6929b9d9a2fdaf5e8d099e4f'
}
```

## Data Structure

### VendorInventory Record Created:
```javascript
{
  id: "VEND-INV-1765954255979-SVVFM",
  vendorId: ObjectId("6929b9d9a2fdaf5e8d099e3d"),
  productId: ObjectId("6929b9d9a2fdaf5e8d099e4f"),
  sizeInventory: {
    "S": 0,
    "M": 0,
    "L": 0,
    "XL": 0,
    "XXL": 0
  },
  totalStock: 0,
  lowInventoryThreshold: {
    "S": 0,
    "M": 0,
    "L": 0,
    "XL": 0,
    "XXL": 0
  },
  createdAt: ISODate("2025-12-17T12:20:56.000Z"),
  updatedAt: ISODate("2025-12-17T12:20:56.000Z")
}
```

## Constraints Met

- ✅ No database schema changes
- ✅ No changes to product creation flow
- ✅ No impact on existing inventory update logic
- ✅ Minimal and targeted changes
- ✅ Backend service layer only (no UI changes)

## Testing

1. **Link Product to Vendor:**
   - Navigate to Super Admin → Relationship Management
   - Link a product to a vendor
   - Check server logs for initialization messages

2. **Verify Inventory Created:**
   - Query `vendorinventories` collection
   - Verify record exists with all sizes initialized to 0

3. **Test Idempotency:**
   - Link the same product again
   - Verify no duplicate inventory records created

4. **Test Transaction Rollback:**
   - Simulate error (e.g., invalid productId)
   - Verify both ProductVendor and VendorInventory are not created

