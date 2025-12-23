# Vendor Inventory Storage Documentation

## Overview

Vendor inventory is stored in MongoDB using the **`vendorinventories`** collection. Each record tracks stock levels for a specific vendor-product combination, with size-wise inventory tracking.

---

## Database Collection

**Collection Name:** `vendorinventories`  
**Mongoose Model:** `VendorInventory`  
**File:** `lib/models/VendorInventory.ts`

---

## Schema Structure

### Fields

| Field | Type | Description | Required | Unique |
|-------|------|-------------|----------|--------|
| `_id` | ObjectId | MongoDB auto-generated primary key | Yes | Yes |
| `id` | String | Human-readable unique identifier (e.g., "VEND-INV-1765943808435-E5QAY") | Yes | Yes |
| `vendorId` | ObjectId | Reference to `vendors` collection (`_id` field) | Yes | No |
| `productId` | ObjectId | Reference to `uniforms` collection (`_id` field) | Yes | No |
| `sizeInventory` | Map<String, Number> | Stock quantity per size (e.g., `{"28": 100, "30": 0, "32": 0}`) | No | No |
| `totalStock` | Number | **Auto-calculated** sum of all sizes in `sizeInventory` | Yes | No |
| `lowInventoryThreshold` | Map<String, Number> | Alert threshold per size (e.g., `{"28": 10, "30": 5}`) | No | No |
| `createdAt` | Date | Auto-generated timestamp | No | No |
| `updatedAt` | Date | Auto-updated timestamp | No | No |

---

## Stock Information Storage

### 1. Size-Wise Inventory (`sizeInventory`)

**Type:** MongoDB `Map<String, Number>`

**Purpose:** Stores stock quantity for each product size.

**Example:**
```javascript
{
  "28": 100,   // 100 units in size 28
  "30": 0,     // 0 units in size 30
  "32": 0,     // 0 units in size 32
  "34": 0,     // 0 units in size 34
  "36": 0,     // 0 units in size 36
  "38": 0      // 0 units in size 38
}
```

**Storage Format:**
- In MongoDB, Maps are stored as plain objects: `{"28": 100, "30": 0, ...}`
- Mongoose converts between Map and Object automatically

### 2. Total Stock (`totalStock`)

**Type:** Number

**Purpose:** Sum of all quantities in `sizeInventory`.

**Calculation:**
- **Auto-calculated** by a pre-save hook before every save operation
- Formula: `totalStock = sum of all values in sizeInventory`
- Example: If `sizeInventory = {"28": 100, "30": 50}`, then `totalStock = 150`

**Pre-Save Hook Logic:**
```javascript
// Automatically runs before saving
totalStock = 0
for each size in sizeInventory:
  totalStock += sizeInventory[size]
```

### 3. Low Inventory Threshold (`lowInventoryThreshold`)

**Type:** MongoDB `Map<String, Number>`

**Purpose:** Vendor-configurable alert threshold per size.

**Example:**
```javascript
{
  "28": 10,   // Alert when size 28 stock <= 10
  "30": 5,    // Alert when size 30 stock <= 5
  "32": 0     // No alert for size 32 (threshold = 0)
}
```

**Usage:**
- When `sizeInventory[size] <= lowInventoryThreshold[size]`, the item is marked as "low stock"
- Default: `0` (no alert) if not set

---

## Database Indexes

### 1. Primary Index
- **Field:** `_id`
- **Type:** Unique
- **Purpose:** MongoDB default primary key

### 2. Unique Identifier Index
- **Field:** `id` (string)
- **Type:** Unique
- **Purpose:** Fast lookup by human-readable ID

### 3. Vendor Index
- **Field:** `vendorId`
- **Type:** Non-unique
- **Purpose:** Fast queries for all inventory of a vendor

### 4. Product Index
- **Field:** `productId`
- **Type:** Non-unique
- **Purpose:** Fast queries for all inventory of a product

### 5. Compound Unique Index
- **Fields:** `{ vendorId: 1, productId: 1 }`
- **Type:** Unique
- **Purpose:** Ensures **one inventory record per vendor-product combination**

---

## Example Document

```json
{
  "_id": ObjectId("69422a00a060f4176e0f0454"),
  "id": "VEND-INV-1765943808435-E5QAY",
  "vendorId": ObjectId("6929b9d9a2fdaf5e8d099e3d"),
  "productId": ObjectId("6929b9d9a2fdaf5e8d099e51"),
  "sizeInventory": {
    "28": 100,
    "30": 0,
    "32": 0,
    "34": 0,
    "36": 0,
    "38": 0
  },
  "totalStock": 100,
  "lowInventoryThreshold": {
    "28": 0,
    "30": 0,
    "32": 0,
    "34": 0,
    "36": 0,
    "38": 0
  },
  "createdAt": ISODate("2025-12-17T09:26:48.000Z"),
  "updatedAt": ISODate("2025-12-17T09:27:07.000Z")
}
```

---

## Key Relationships

### 1. Vendor Relationship
- **Field:** `vendorId`
- **References:** `vendors` collection (`_id`)
- **Type:** ObjectId
- **Example:** `vendorId: ObjectId("6929b9d9a2fdaf5e8d099e3d")` → Vendor with `id: "100001"`

### 2. Product Relationship
- **Field:** `productId`
- **References:** `uniforms` collection (`_id`)
- **Type:** ObjectId
- **Example:** `productId: ObjectId("6929b9d9a2fdaf5e8d099e51")` → Product with `id: "200001"`

---

## Inventory Update Flow

### 1. When Inventory is Created

**Trigger:** When a product is linked to a vendor (via `ProductVendor` relationship)

**Function:** `ensureVendorInventoryExists(vendorId, productId)`

**Initial State:**
- `sizeInventory`: Empty map `{}`
- `totalStock`: `0`
- `lowInventoryThreshold`: Empty map `{}`

### 2. When Inventory is Updated

**Trigger:** Vendor updates stock via Inventory Management UI

**Function:** `updateVendorInventory(vendorId, productId, sizeInventory, lowInventoryThreshold)`

**Process:**
1. Find existing inventory record by `vendorId` + `productId`
2. Update `sizeInventory` Map with new quantities
3. Update `lowInventoryThreshold` Map (optional)
4. Pre-save hook automatically calculates `totalStock`
5. Save to database

### 3. When Inventory is Reduced

**Trigger:** Order is shipped/fulfilled

**Function:** `updateOrderStatus()` → Reduces inventory on shipment

**Process:**
1. For each order item:
   - Find inventory record: `vendorId` + `productId`
   - Reduce `sizeInventory[size]` by order quantity
   - Pre-save hook recalculates `totalStock`
   - Save to database

---

## Query Patterns

### 1. Get All Inventory for a Vendor
```javascript
VendorInventory.find({ vendorId: vendorObjectId })
```

### 2. Get Inventory for a Specific Product
```javascript
VendorInventory.find({ 
  vendorId: vendorObjectId,
  productId: productObjectId 
})
```

### 3. Get Low Stock Items
```javascript
// Filter where sizeInventory[size] <= lowInventoryThreshold[size]
// Logic implemented in getLowStockItems()
```

---

## Important Notes

### 1. One Record Per Vendor-Product
- **Constraint:** Unique compound index on `{ vendorId, productId }`
- **Result:** Each vendor can have only **one inventory record per product**
- **Benefit:** Prevents duplicate records, simplifies queries

### 2. Auto-Calculated Total Stock
- `totalStock` is **never manually set**
- Always calculated from `sizeInventory` by pre-save hook
- Ensures data consistency

### 3. Size Inventory Format
- Stored as MongoDB Map (serialized as plain object)
- Keys are size strings (e.g., "28", "30", "S", "M", "L")
- Values are quantities (numbers)

### 4. Low Stock Detection
- Calculated at query time (not stored)
- Logic: `sizeInventory[size] <= lowInventoryThreshold[size]` AND `lowInventoryThreshold[size] > 0`
- Returns items where at least one size is below threshold

---

## Data Access Functions

### Backend Functions (`lib/db/data-access.ts`)

1. **`getVendorInventory(vendorId, productId?)`**
   - Returns all inventory records for a vendor
   - Optionally filters by productId
   - Populates vendor and product details

2. **`updateVendorInventory(vendorId, productId, sizeInventory, lowInventoryThreshold?)`**
   - Updates or creates inventory record
   - Validates vendor and product exist
   - Auto-calculates totalStock

3. **`getLowStockItems(vendorId)`**
   - Returns inventory items where stock <= threshold
   - Filters by vendor

4. **`getVendorInventorySummary(vendorId)`**
   - Returns aggregated stats:
     - `totalProducts`: Count of inventory records
     - `totalStock`: Sum of all totalStock values
     - `lowStockCount`: Count of low stock items

5. **`ensureVendorInventoryExists(vendorId, productId)`**
   - Creates inventory record if it doesn't exist
   - Called automatically when products are linked to vendors
   - Idempotent (safe to call multiple times)

---

## API Endpoints

### GET `/api/vendor-inventory?vendorId=100001`
- Returns all inventory for vendor
- Optional: `?productId=200001` to filter by product
- Optional: `?lowStock=true` to get only low stock items
- Optional: `?summary=true` to get aggregated summary

### PUT `/api/vendor-inventory`
- Updates inventory for a vendor-product combination
- Body: `{ vendorId, productId, sizeInventory, lowInventoryThreshold }`

---

## Summary

**Table/Collection:** `vendorinventories`

**Stock Information Stored In:**
1. **`sizeInventory`** - Size-wise quantities (Map)
2. **`totalStock`** - Auto-calculated total (Number)
3. **`lowInventoryThreshold`** - Alert thresholds per size (Map)

**Key Characteristics:**
- One record per vendor-product combination
- Size-wise tracking
- Auto-calculated totals
- Configurable low stock alerts
- Automatic updates on order fulfillment

