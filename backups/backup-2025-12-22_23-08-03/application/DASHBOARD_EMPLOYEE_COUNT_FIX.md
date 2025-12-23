# Dashboard Employee Count Fix - Root Cause Analysis

## Problem Statement
- **Company:** ICICI
- **Issue:** Dashboard shows only 10 employees when actual count is 30
- **Employee Management:** Correctly shows all 30 employees
- **Impact:** Dashboard metrics are incorrect

## Root Cause Analysis

### Step 1: Dashboard Data Source
- **File:** `app/dashboard/company/page.tsx`
- **Line 104:** `const filtered = await getEmployeesByCompany(company.id)`
- **Line 105:** `setCompanyEmployees(filtered)`
- **Line 135:** `const activeEmployees = companyEmployees.filter(e => e.status === 'active').length`
- **Line 163:** `{ name: 'Active Employees', value: activeEmployees, ... }`

### Step 2: Backend Query Verification
- **File:** `lib/db/data-access.ts`
- **Function:** `getEmployeesByCompany(companyId: string)`
- **Line 4134:** `const query = Employee.find({ companyId: company._id })`
- **Line 4138:** `const employees = await query.lean()`
- **Result:** ✅ NO LIMIT in backend query - should return all employees

### Step 3: API Endpoint Verification
- **File:** `app/api/employees/route.ts`
- **Line 45:** `const employees = await getEmployeesByCompany(companyId)`
- **Line 56:** `return NextResponse.json(employees)`
- **Result:** ✅ NO LIMIT in API - returns all employees

### Step 4: Client-Side Data Fetching
- **File:** `lib/data-mongodb.ts`
- **Line 617:** `const employees = await fetchAPI<any[]>(`/employees?companyId=${companyId}`)`
- **Result:** ✅ NO LIMIT in client-side fetch

## Root Cause Identified

**The issue is NOT in data fetching - all queries return all employees.**

**The problem is in the DASHBOARD DISPLAY LOGIC:**

1. **Line 563:** `companyEmployees.slice(0, 10).map((employee) => {`
   - This limits the **table display** to 10 employees (UI-only)
   - This is CORRECT behavior for display

2. **Line 135:** `const activeEmployees = companyEmployees.filter(e => e.status === 'active').length`
   - This calculates count from **full** `companyEmployees` array
   - This should be CORRECT

**BUT:** If `companyEmployees` state only contains 10 items, then the count will be wrong.

## Hypothesis

The issue might be:
1. **State not updating correctly** - `companyEmployees` state might be getting overwritten
2. **Race condition** - Data might be loaded before all employees are fetched
3. **Filtering issue** - Some employees might be filtered out before state is set

## Solution

Since the backend returns all employees correctly, and Employee Management shows all 30, the issue must be in how the dashboard processes the data.

**Fix:** Ensure dashboard uses the FULL employee array for count calculation, and add defensive logging to verify data is loaded correctly.

