# Encryption Usage Audit

## Summary of Incorrect Encryption Usage

### ❌ INCORRECTLY ENCRYPTED (Must Remove)

1. **Branch Model** (`lib/models/Branch.ts`)
   - Fields encrypted: `address`, `phone`, `email`
   - Reason: Branch is NOT employee data - it's location/master data
   - Impact: Causes query mismatches when comparing branch data

2. **DesignationProductEligibility Model** (`lib/models/DesignationProductEligibility.ts`)
   - Fields encrypted: `designation`
   - Reason: This is master/configuration data, not employee PII
   - Impact: Creates mismatch when matching employee.designation (encrypted) with eligibility.designation (should be plaintext)
   - Note: Employee.designation should REMAIN encrypted (it's employee-specific PII)

### ✅ CORRECTLY ENCRYPTED (Must Keep)

1. **Employee Model** (`lib/models/Employee.ts`)
   - Fields encrypted: `email`, `mobile`, `address`, `firstName`, `lastName`, `designation`
   - Reason: All are employee PII fields
   - Note: `designation` in Employee is employee-specific (e.g., "John's designation is Manager"), so encryption is correct

## Classification

### Employee Data (KEEP Encryption)
- Employee.email
- Employee.mobile
- Employee.address
- Employee.firstName
- Employee.lastName
- Employee.designation (employee-specific value)

### Non-Employee Data (REMOVE Encryption)
- Branch.address
- Branch.phone
- Branch.email
- DesignationProductEligibility.designation (master data value)
- Location data (if any)
- Company data (if any)
- Vendor data (if any)
- Product data (if any)

## Impact Areas

### Critical Flows Affected by Incorrect Encryption

1. **Designation Eligibility Matching**
   - Current: Both Employee.designation and DesignationProductEligibility.designation are encrypted
   - Problem: When querying eligibility, encrypted values may not match
   - Fix: Remove encryption from DesignationProductEligibility.designation, keep Employee.designation encrypted
   - Matching Strategy: Decrypt Employee.designation when comparing with plaintext eligibility.designation

2. **Branch/Location Queries**
   - Current: Branch fields are encrypted
   - Problem: Location matching and filtering may fail
   - Fix: Remove encryption from Branch model entirely

3. **Employee Location Field**
   - Current: Employee.location is NOT in encryption list, but some code tries to decrypt it
   - Status: This is correct - location should NOT be encrypted
   - Action: Remove any decryption attempts for Employee.location

## Implementation Plan

1. Remove encryption hooks from Branch model
2. Remove encryption hooks from DesignationProductEligibility model
3. Update data-access.ts to:
   - Remove designation decryption for eligibility queries
   - Remove location decryption attempts
   - Ensure employee designation is decrypted only when needed for matching
4. Verify all queries work with mixed encrypted/plaintext data

