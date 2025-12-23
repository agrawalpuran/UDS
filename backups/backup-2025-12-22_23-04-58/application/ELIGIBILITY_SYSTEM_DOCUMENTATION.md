# Employee Eligibility System Documentation

## Overview

The Uniform Distribution System uses a **cycle-based eligibility system** where employees can order uniforms based on:
1. **Eligibility limits** (how many items they can order per cycle)
2. **Cycle durations** (how long each cycle lasts)
3. **Consumed eligibility** (how much they've already ordered in the current cycle)

---

## 📍 Where Eligibility is Stored

### 1. **Employee Collection** (`employees`)

**Location:** `lib/models/Employee.ts`

**Fields:**
```typescript
{
  eligibility: {
    shirt: number,    // Default: 0
    pant: number,     // Default: 0
    shoe: number,     // Default: 0
    jacket: number    // Default: 0
  },
  cycleDuration: {
    shirt: number,    // Default: 6 months
    pant: number,     // Default: 6 months
    shoe: number,     // Default: 6 months
    jacket: number    // Default: 12 months
  },
  dateOfJoining: Date  // Used to calculate cycle start dates
}
```

**Purpose:** Employee-level eligibility (fallback if no designation rules exist)

---

### 2. **DesignationProductEligibility Collection** (`designationproducteligibilities`)

**Location:** `lib/models/DesignationProductEligibility.ts`

**Fields:**
```typescript
{
  companyId: ObjectId,
  companyName: string,
  designation: string,        // e.g., "General Manager", "Office Admin"
  gender: 'male' | 'female' | 'unisex',
  itemEligibility: {
    shirt?: {
      quantity: number,              // Number of items allowed per cycle
      renewalFrequency: number,      // Renewal frequency value
      renewalUnit: 'months' | 'years' // Renewal unit
    },
    trouser?: { ... },  // Alias: pant
    pant?: { ... },      // Alias for trouser
    shoe?: { ... },
    blazer?: { ... },    // Alias: jacket
    jacket?: { ... }     // Alias for blazer
  },
  status: 'active' | 'inactive'
}
```

**Purpose:** Company-level eligibility rules by designation and gender (takes priority over employee-level)

---

### 3. **Orders Collection** (`orders`)

**Location:** Used to calculate consumed eligibility

**Key Fields:**
```typescript
{
  employeeId: ObjectId,
  orderDate: Date,
  status: string,  // 'Awaiting approval', 'Awaiting fulfilment', 'Dispatched', 'Delivered', 'Cancelled'
  items: [{
    uniformId: ObjectId,
    category: string,  // 'shirt', 'pant', 'shoe', 'jacket'
    quantity: number
  }]
}
```

**Purpose:** Tracks consumed eligibility (orders that count towards limits)

---

## 🔄 How Expiry is Determined

### Cycle Calculation Logic

**Location:** `lib/utils/eligibility-cycles.ts`

The system calculates eligibility cycles based on:

1. **Employee's Date of Joining** (`dateOfJoining`)
   - Default: `2025-10-01` if not set
   - Normalized to the 1st of the month

2. **Cycle Duration** (per item type)
   - Shirt: 6 months (default)
   - Pant: 6 months (default)
   - Shoe: 6 months (default)
   - Jacket: 12 months (default)
   - Can be customized per employee or designation

3. **Current Cycle Calculation:**
   ```typescript
   // Example: Employee joined Oct 1, 2025, Shirt cycle = 6 months
   // Cycle 1: Oct 1, 2025 - Mar 31, 2026
   // Cycle 2: Apr 1, 2026 - Sep 30, 2026
   // Cycle 3: Oct 1, 2026 - Mar 31, 2027
   ```

**Key Function:** `getCurrentCycleDates(itemType, dateOfJoining, cycleDurationMonths)`

---

### Expiry Logic

**Eligibility does NOT expire** - it **resets** at the start of each new cycle.

1. **Within Current Cycle:**
   - Employee can order up to their eligibility limit
   - Consumed eligibility is tracked from orders in the current cycle only
   - Orders from previous cycles don't count

2. **Cycle Reset:**
   - When a new cycle starts, consumed eligibility resets to 0
   - Employee gets a fresh eligibility quota for the new cycle

3. **Cycle End Date:**
   - Calculated as: `cycleStart + cycleDurationMonths`
   - Last day of the cycle month (e.g., Mar 31 for a 6-month cycle starting Oct 1)

---

## 📊 Eligibility Priority System

**Priority Order (highest to lowest):**

1. **Designation-Level Eligibility** (from `DesignationProductEligibility`)
   - Matched by: `companyId` + `designation` + `gender`
   - If found, uses `itemEligibility` from designation rules
   - Cycle duration derived from `renewalFrequency` and `renewalUnit`

2. **Employee-Level Eligibility** (from `Employee`)
   - Fallback if no designation rules exist
   - Uses `eligibility` and `cycleDuration` fields directly

**Function:** `getEmployeeEligibilityFromDesignation(employeeId)`
**Location:** `lib/db/data-access.ts` (line 4929)

---

## 🔢 Consumed Eligibility Calculation

**Function:** `getConsumedEligibility(employeeId)`
**Location:** `lib/db/data-access.ts` (line 5018)

**Logic:**
1. Find all orders for the employee with status:
   - `'Awaiting approval'`
   - `'Awaiting fulfilment'`
   - `'Dispatched'`
   - `'Delivered'`
   - **Excludes:** `'Cancelled'` orders

2. For each order item:
   - Check if `orderDate` falls within the **current cycle** for that item type
   - If yes, add `quantity` to consumed eligibility for that category
   - If no (order from previous cycle), ignore it

3. Return consumed counts per category:
   ```typescript
   {
     shirt: number,
     pant: number,
     shoe: number,
     jacket: number
   }
   ```

**Key Point:** Only orders within the current cycle count towards consumed eligibility.

---

## ✅ Eligibility Validation

**Function:** `validateEmployeeEligibility(employeeId, orderItems)`
**Location:** `lib/db/data-access.ts` (line 5107)

**Process:**
1. Get total eligibility (from designation or employee)
2. Get consumed eligibility (from current cycle orders)
3. Calculate remaining eligibility: `total - consumed`
4. Validate each order item:
   - Check if `quantity` exceeds remaining eligibility
   - Return errors for any violations

**Used in:**
- Single order creation (`createOrder`)
- Bulk order upload (`/api/orders/bulk`)

---

## 📝 Example Scenarios

### Scenario 1: New Employee
- **Date of Joining:** Oct 1, 2025
- **Designation:** "Manager"
- **Designation Eligibility:** Shirt: 2 per 6 months
- **Current Date:** Dec 15, 2025
- **Current Cycle:** Oct 1, 2025 - Mar 31, 2026
- **Orders Placed:** 1 shirt (Nov 1, 2025)
- **Remaining Eligibility:** 1 shirt (2 - 1 = 1)

### Scenario 2: Cycle Reset
- **Same employee, later date:** Apr 5, 2026
- **New Cycle:** Apr 1, 2026 - Sep 30, 2026
- **Previous cycle orders:** Don't count anymore
- **Remaining Eligibility:** 2 shirts (fresh quota)

### Scenario 3: Different Cycle Durations
- **Employee:** Joined Oct 1, 2025
- **Shirt Cycle:** 6 months (Oct 1 - Mar 31)
- **Jacket Cycle:** 12 months (Oct 1 - Sep 30)
- **On Apr 5, 2026:**
  - Shirt cycle has reset (new cycle started)
  - Jacket cycle still active (same cycle)

---

## 🔍 Key Functions Reference

| Function | Location | Purpose |
|----------|----------|---------|
| `getCurrentCycleDates()` | `lib/utils/eligibility-cycles.ts` | Calculate current cycle start/end dates |
| `isDateInCurrentCycle()` | `lib/utils/eligibility-cycles.ts` | Check if date is in current cycle |
| `getEmployeeEligibilityFromDesignation()` | `lib/db/data-access.ts:4929` | Get eligibility from designation or employee |
| `getConsumedEligibility()` | `lib/db/data-access.ts:5018` | Calculate consumed eligibility in current cycle |
| `validateEmployeeEligibility()` | `lib/db/data-access.ts:5107` | Validate order against eligibility limits |

---

## 🗄️ Database Collections Summary

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `employees` | Employee master data | `eligibility`, `cycleDuration`, `dateOfJoining` |
| `designationproducteligibilities` | Company-level eligibility rules | `itemEligibility`, `designation`, `gender` |
| `orders` | Order history (for consumed eligibility) | `employeeId`, `orderDate`, `status`, `items` |

---

## ⚠️ Important Notes

1. **No Explicit Expiry Date:** Eligibility doesn't expire - it resets at cycle boundaries
2. **Cycle-Based:** Each item type (shirt, pant, shoe, jacket) has its own independent cycle
3. **Order Status Matters:** Only non-cancelled orders count towards consumed eligibility
4. **Current Cycle Only:** Orders from previous cycles don't affect current eligibility
5. **Designation Priority:** Designation-level rules override employee-level eligibility
6. **Gender Filtering:** Designation eligibility can be gender-specific

---

## 🔧 Configuration Points

1. **Default Cycle Durations:**
   - Shirt: 6 months
   - Pant: 6 months
   - Shoe: 6 months
   - Jacket: 12 months

2. **Default Start Date:**
   - `2025-10-01` (if employee `dateOfJoining` is not set)

3. **Order Statuses That Count:**
   - `'Awaiting approval'`
   - `'Awaiting fulfilment'`
   - `'Dispatched'`
   - `'Delivered'`

4. **Order Statuses That Don't Count:**
   - `'Cancelled'`

---

## 📚 Related Files

- `lib/models/Employee.ts` - Employee schema with eligibility fields
- `lib/models/DesignationProductEligibility.ts` - Designation eligibility rules
- `lib/utils/eligibility-cycles.ts` - Cycle calculation utilities
- `lib/db/data-access.ts` - Eligibility retrieval and validation functions

