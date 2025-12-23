# How to Populate Vendor Inventory

## Overview

Vendors can populate and manage inventory through a dedicated **Inventory Management** interface in the Vendor Portal.

---

## Accessing the Inventory Interface

### Step 1: Login as Vendor
1. Navigate to the application login page
2. Login with vendor credentials (e.g., `contact@uniformpro.com`)
3. You'll be redirected to the Vendor Dashboard

### Step 2: Navigate to Inventory Management
1. In the left-hand menu, click on **"Inventory Management"**
2. Or navigate directly to: `/dashboard/vendor/inventory`

---

## Interface Features

### 1. **Product List View**
- Displays all products linked to your vendor
- Shows product name, SKU, category, and image
- Displays current stock levels per size
- Highlights low stock items with red border

### 2. **Stock Information Display**
For each product, you can see:
- **Size-wise Stock**: Current quantity for each size (e.g., "28: 100", "30: 0")
- **Total Stock**: Auto-calculated sum of all sizes
- **Low Stock Alerts**: Items highlighted in red when stock ≤ threshold

### 3. **Low Stock Alert Banner**
- Red banner at the top shows count of low stock products
- Appears when any product has stock below its threshold

---

## How to Populate/Update Inventory

### Method 1: Edit Individual Product Inventory

#### Step 1: Find the Product
- Use the search bar to filter products by name or SKU
- Or scroll through the product list

#### Step 2: Click Edit Button
- Click the **Edit** (pencil icon) button in the "Actions" column for the product you want to update

#### Step 3: Enter Stock Quantities
- For each size, you'll see two input fields:
  - **Stock**: Enter the current quantity available
  - **Threshold**: Enter the minimum stock level before alert (optional)

**Example:**
```
Size: 28
  Stock: 100        ← Enter current quantity
  Threshold: 10    ← Alert when stock ≤ 10

Size: 30
  Stock: 50
  Threshold: 5

Size: 32
  Stock: 0
  Threshold: 0     ← No alert (threshold = 0)
```

#### Step 4: Save Changes
- Click the **Save** (checkmark) button to save
- Or click **Cancel** (X) to discard changes
- The page will automatically refresh to show updated stock

### Method 2: Bulk Update (Multiple Products)
- Currently, you need to edit each product individually
- Future enhancement: Bulk upload via CSV/Excel

---

## Visual Indicators

### Stock Level Colors

| Color | Meaning | Stock Range |
|-------|---------|-------------|
| 🟢 **Green** | High Stock | > 10 units |
| 🟡 **Yellow** | Medium Stock | 1-10 units |
| 🔴 **Red** | Low Stock | ≤ Threshold (if threshold > 0) |
| ⚪ **Gray** | Out of Stock | 0 units |

### Row Highlighting
- Products with **any** size below threshold are highlighted with:
  - Red left border
  - Light red background

---

## Example Workflow

### Scenario: Adding Stock for "Formal Shirt - Male"

1. **Navigate to Inventory Management**
   - Login as vendor
   - Click "Inventory Management" in menu

2. **Find the Product**
   - Search for "Formal Shirt" or scroll to find it
   - Product shows current stock: `28: 0, 30: 0, 32: 0, 34: 0, 36: 0, 38: 0`

3. **Edit Inventory**
   - Click **Edit** button
   - Enter stock quantities:
     ```
     Size 28: Stock = 100, Threshold = 10
     Size 30: Stock = 50, Threshold = 5
     Size 32: Stock = 25, Threshold = 5
     Size 34: Stock = 0, Threshold = 0
     Size 36: Stock = 0, Threshold = 0
     Size 38: Stock = 0, Threshold = 0
     ```

4. **Save**
   - Click **Save** button
   - Total Stock automatically updates to: **175** (100 + 50 + 25)

5. **Verify**
   - Product now shows:
     - Size 28: 100 (green badge)
     - Size 30: 50 (green badge)
     - Size 32: 25 (yellow badge)
     - Total Stock: 175

---

## Important Notes

### 1. **Automatic Total Calculation**
- `totalStock` is **automatically calculated** from size quantities
- You don't need to enter it manually
- Formula: `totalStock = sum of all sizeInventory values`

### 2. **Low Stock Thresholds**
- Threshold is **optional** (default: 0 = no alert)
- Set threshold > 0 to enable low stock alerts
- Alert triggers when: `stock ≤ threshold` AND `threshold > 0`

### 3. **Size Requirements**
- Only sizes defined in the product's `sizes` array can be updated
- If a product has sizes `["28", "30", "32"]`, you can only set stock for these sizes

### 4. **Initial Inventory Creation**
- Inventory records are **automatically created** when:
  - A product is linked to your vendor (via Super Admin or Vendor Portal)
- Initial state:
  - All sizes: 0 stock
  - All thresholds: 0 (no alerts)
  - Total stock: 0

### 5. **Inventory Reduction**
- Inventory is **automatically reduced** when:
  - Orders are shipped/fulfilled
  - The system deducts quantities from `sizeInventory` based on order items

---

## Troubleshooting

### Issue: "No products linked to this vendor"
**Solution:**
- Contact Super Admin to link products to your vendor
- Products must be linked via Product-Vendor relationship before inventory can be managed

### Issue: "Failed to save inventory"
**Possible Causes:**
- Network error
- Product or vendor not found
- Invalid data format

**Solution:**
- Check browser console for error messages
- Verify product ID and vendor ID are correct
- Try refreshing the page and editing again

### Issue: "Inventory not showing after save"
**Solution:**
- The page automatically refreshes after save
- If not visible, manually refresh the browser
- Check that you're viewing the correct vendor's inventory

---

## API Endpoints (For Reference)

### Update Inventory
```
PUT /api/vendor-inventory
Body: {
  vendorId: "100001",
  productId: "200001",
  sizeInventory: {
    "28": 100,
    "30": 50,
    "32": 25
  },
  lowInventoryThreshold: {
    "28": 10,
    "30": 5,
    "32": 5
  }
}
```

### Get Inventory
```
GET /api/vendor-inventory?vendorId=100001
GET /api/vendor-inventory?vendorId=100001&productId=200001
GET /api/vendor-inventory?vendorId=100001&lowStock=true
GET /api/vendor-inventory?vendorId=100001&summary=true
```

---

## Summary

**Interface Location:** Vendor Portal → Inventory Management (`/dashboard/vendor/inventory`)

**How to Populate:**
1. Login as vendor
2. Navigate to Inventory Management
3. Click **Edit** on a product
4. Enter stock quantities per size
5. Optionally set low stock thresholds
6. Click **Save**

**Key Features:**
- ✅ Size-wise stock tracking
- ✅ Low stock alerts
- ✅ Visual indicators (colors)
- ✅ Auto-calculated totals
- ✅ Search and filter

**Automatic Features:**
- ✅ Inventory records created when products are linked
- ✅ Total stock auto-calculated
- ✅ Inventory reduced on order shipment

