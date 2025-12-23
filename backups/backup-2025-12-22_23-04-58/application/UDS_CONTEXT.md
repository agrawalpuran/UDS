# 🎯 Uniform Distribution System (UDS) - Complete Context

**Last Updated:** Current Session  
**Status:** Production-ready, deployed on Vercel

---

## 📋 System Overview

**Uniform Distribution System (UDS)** is a comprehensive B2B2C cloud-based platform that automates uniform distribution, tracking, and management for companies with distributed workforces.

### Core Purpose
- Streamline uniform ordering and distribution
- Track employee eligibility based on tenure and cycles
- Manage multi-vendor inventory and fulfillment
- Provide role-based dashboards for different stakeholders
- Automate approval workflows and order processing

---

## 🏗️ Architecture & Technology Stack

### Framework & Language
- **Next.js 16.0.3** - React framework with App Router
- **TypeScript** - Type-safe development
- **React 19.2.0** - UI library
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide React** - Icon library

### Database
- **MongoDB Atlas** (Production) - Cloud database
- **Local MongoDB** (Development) - For local testing
- **Mongoose 8.19.3** - ODM for MongoDB

### Deployment
- **Vercel** - Production hosting with auto-deploy
- **GitHub** - Source control (https://github.com/agrawalpuran/UDS.git)
- **Port:** 3001 (development), auto-assigned (production)

---

## 👥 User Roles & Portals

### 1. **Company Admin Portal** (`/dashboard/company`)
**Features:**
- Dashboard with analytics (pending approvals, orders, inventory)
- Employee management (add, edit, bulk upload via CSV)
- Catalog/SKU management
- Order management (individual and bulk orders)
- Location management (central and regional offices)
- Approval workflow for employee orders
- Comprehensive reporting (weekly, monthly, quarterly)
- Budget tracking and usage monitoring
- Designation eligibility management

**Key Pages:**
- `/dashboard/company` - Main dashboard
- `/dashboard/company/employees` - Employee management
- `/dashboard/company/orders` - Order management
- `/dashboard/company/approvals` - Approval workflow
- `/dashboard/company/catalog` - Product catalog
- `/dashboard/company/designation-eligibility` - Eligibility rules
- `/dashboard/company/batch-upload` - Bulk employee upload
- `/dashboard/company/reports` - Analytics and reports
- `/dashboard/company/settings` - Company settings

### 2. **Employee/Consumer Portal** (`/dashboard/consumer`)
**Features:**
- Self-service uniform ordering
- Catalog browsing with filtering (by category, gender, size)
- Order tracking and history
- Profile management
- Eligibility visibility (cycle information, available items)
- Mobile-friendly interface

**Key Pages:**
- `/dashboard/consumer` - Dashboard with order overview
- `/dashboard/consumer/catalog` - Browse and order uniforms
- `/dashboard/consumer/orders` - Order history
- `/dashboard/consumer/orders/review` - Review order
- `/dashboard/consumer/orders/confirm` - Order confirmation
- `/dashboard/consumer/profile` - Profile management

### 3. **Vendor Portal** (`/dashboard/vendor`)
**Features:**
- Inventory management with SKU tracking
- Order fulfillment and tracking
- Sales reports and analytics
- Low stock alerts
- View orders from all companies

**Key Pages:**
- `/dashboard/vendor` - Main dashboard
- `/dashboard/vendor/inventory` - Inventory management
- `/dashboard/vendor/orders` - Order fulfillment
- `/dashboard/vendor/reports` - Sales analytics

### 4. **Super Admin Portal** (`/dashboard/superadmin`)
**Features:**
- System-wide administration
- Manage products, vendors, companies
- Employee relationship management
- Full system oversight

---

## 🔐 Authentication System

### Login Methods
- **OTP-based authentication** via email or phone number
- **Separate login interfaces** for each role:
  - `/login/company` - Company admin login
  - `/login/consumer` - Employee login
  - `/login/vendor` - Vendor login
  - `/login/superadmin` - Super admin login
  - `/login` - General login page

### Security Features
- **Data Encryption:** Sensitive PII fields (email, mobile, address, name, designation) are encrypted at rest
- **Case-insensitive email lookup** for login
- **OTP verification** (demo: use `123456`)

---

## 📊 Data Models

### Employee Model (`lib/models/Employee.ts`)
**Key Fields:**
- `id` - Unique identifier (string)
- `employeeId` - Employee ID (string, unique)
- `firstName`, `lastName` - Name (encrypted)
- `email`, `mobile`, `address` - Contact info (encrypted)
- `designation` - Job title (encrypted)
- `gender` - 'male' | 'female'
- `companyId` - Reference to Company
- `branchId` - Reference to Branch (optional)
- `eligibility` - Object with shirt, pant, shoe, jacket quantities
- `cycleDuration` - Object with cycle durations in months
- `dateOfJoining` - Start date for cycle calculations
- `dispatchPreference` - 'direct' | 'central' | 'regional'
- `status` - 'active' | 'inactive'

### Company Model (`lib/models/Company.ts`)
**Key Fields:**
- `id` - Numeric company ID
- `name` - Company name
- `logo`, `website` - Branding
- `primaryColor`, `secondaryColor` - Theme colors
- `showPrices` - Whether to show prices to employees
- `allowPersonalPayments` - Allow orders beyond eligibility

### Order Model (`lib/models/Order.ts`)
**Key Fields:**
- `id` - Unique order ID
- `employeeId` - Reference to Employee
- `items` - Array of order items (uniformId, size, quantity, price)
- `total` - Order total amount
- `status` - 'Awaiting approval' | 'Awaiting fulfilment' | 'Dispatched' | 'Delivered'
- `companyId` - Reference to Company
- `vendorId` - Reference to Vendor (optional)
- `isPersonalPayment` - Whether employee paid personally
- `parentOrderId` - For split orders

### Other Models
- **Uniform** - Product/uniform catalog
- **Vendor** - Vendor information
- **VendorInventory** - Vendor stock levels
- **Branch** - Company branch locations
- **Relationship** - Company-Vendor-Product relationships
- **DesignationProductEligibility** - Eligibility rules by designation

---

## 🔄 Eligibility & Cycle System

### How It Works
1. **Eligibility Calculation:**
   - Based on employee's `dateOfJoining`
   - Configurable per item type (shirt, pant, shoe, jacket)
   - Can be set at employee level or designation level
   - Default cycles: Shirt (6 months), Pant (6 months), Shoe (6 months), Jacket (12 months)

2. **Cycle Management:**
   - Cycles start from employee's joining date (normalized to 1st of month)
   - Each item type has its own cycle duration
   - Eligibility resets at the start of each new cycle
   - System tracks consumed eligibility within current cycle

3. **Eligibility Sources (Priority Order):**
   1. Designation-level eligibility rules (with gender filter)
   2. Employee-level eligibility (fallback)

4. **Key Functions:**
   - `getCurrentCycleDates()` - Calculate current cycle start/end dates
   - `getEmployeeEligibilityFromDesignation()` - Get eligibility from designation rules
   - `getConsumedEligibility()` - Calculate how much eligibility has been used

### Example
- Employee joins on Oct 1, 2025
- Shirt cycle: 6 months
- Current cycle: Oct 1, 2025 - Mar 31, 2026
- Next cycle: Apr 1, 2026 - Sep 30, 2026
- If eligible for 2 shirts per cycle, can order 2 shirts in current cycle

---

## 📁 Project Structure

```
uniform-distribution-system/
├── app/
│   ├── api/                    # API routes
│   │   ├── employees/
│   │   ├── companies/
│   │   ├── products/
│   │   ├── orders/
│   │   ├── vendors/
│   │   └── ...
│   ├── dashboard/              # Role-based dashboards
│   │   ├── company/           # Company admin portal
│   │   ├── consumer/          # Employee portal
│   │   ├── vendor/            # Vendor portal
│   │   └── superadmin/        # Super admin portal
│   ├── login/                 # Authentication pages
│   ├── page.tsx               # Home page
│   └── layout.tsx             # Root layout
├── components/                # Reusable components
│   ├── DashboardLayout.tsx
│   └── OTPVerification.tsx
├── lib/
│   ├── db/                    # Database access
│   │   ├── mongodb.ts        # Connection setup
│   │   └── data-access.ts    # All database queries
│   ├── models/               # Mongoose models
│   │   ├── Employee.ts
│   │   ├── Company.ts
│   │   ├── Order.ts
│   │   └── ...
│   ├── utils/                # Utility functions
│   │   ├── eligibility-cycles.ts
│   │   ├── encryption.ts
│   │   └── auth-storage.ts
│   └── data-mongodb.ts       # Client-side data access
├── public/                   # Static assets
│   └── images/
│       └── uniforms/         # Product images
└── scripts/                  # Utility scripts
```

---

## 🔌 API Endpoints

### Employee APIs
- `GET /api/employees` - List employees
- `POST /api/employees` - Create employee
- `GET /api/employees/[id]` - Get employee details

### Product APIs
- `GET /api/products` - List products (filtered by company)
- `POST /api/products` - Create product

### Order APIs
- `GET /api/orders` - List orders
- `POST /api/orders` - Create order
- `POST /api/orders/bulk` - Create bulk orders

### Company APIs
- `GET /api/companies` - List companies
- `GET /api/companies/[id]` - Get company details

### Vendor APIs
- `GET /api/vendors` - List vendors
- `GET /api/vendor-inventory` - Get vendor inventory

---

## 🗄️ Database Configuration

### MongoDB Atlas (Production)
- **Connection String:** `mongodb+srv://admin:Welcome%24123@cluster0.owr3ooi.mongodb.net/uniform-distribution?retryWrites=true&w=majority`
- **Database:** `uniform-distribution`
- **Note:** Password is URL-encoded (`$` → `%24`)

### Local MongoDB (Development)
- **Connection String:** `mongodb://localhost:27017/uniform-distribution`
- **Database:** `uniform-distribution`

### Environment Variables
- `MONGODB_URI` - MongoDB connection string (required)
- Set in `.env.local` for development
- Set in Vercel dashboard for production

### Collections
- `companies` - Company records
- `companyadmins` - Company admin accounts
- `employees` - Employee records
- `vendorcompanies` - Vendor-Company relationships
- `productvendors` - Product-Vendor relationships
- `uniforms` - Product catalog
- `productcompanies` - Product-Company relationships
- `vendors` - Vendor records
- `orders` - Order records
- `branches` - Branch locations
- `designationproducteligibilities` - Eligibility rules

---

## 🚀 Deployment Status

### Vercel Deployment
- ✅ **Status:** Deployed and active
- ✅ **Auto-deploy:** Enabled (pushes to `master` branch)
- ✅ **Environment Variables:** Configured
- ✅ **Latest Fixes:** All deployed

### GitHub Repository
- **URL:** https://github.com/agrawalpuran/UDS.git
- **Branch:** `master`
- **Auto-sync:** Enabled with Vercel

---

## 🔧 Recent Fixes & Improvements

### 1. Email Login Fix
- **Issue:** Case-sensitive email lookup
- **Fix:** Made email lookup case-insensitive with whitespace trimming
- **File:** `lib/db/data-access.ts` - `getEmployeeByEmail` function

### 2. CompanyId Extraction Fix
- **Issue:** Products not loading, Company ID showing as empty
- **Fix:** Improved companyId extraction to handle ObjectId, populated objects, and strings
- **Files:** 
  - `app/dashboard/consumer/page.tsx`
  - `app/dashboard/consumer/catalog/page.tsx`
  - `lib/db/data-access.ts`

### 3. TypeScript Build Error Fix
- **Issue:** `mongoose.connection.db` possibly undefined
- **Fix:** Added null check before accessing database name
- **File:** `lib/db/mongodb.ts`

### 4. MongoDB Connection Improvements
- Enhanced connection logging
- Better error messages with troubleshooting hints
- Connection timeout configuration

### 5. API Error Handling
- Improved error logging in API routes
- Better error messages for debugging

---

## 📝 Key Features

### For Company Administrators
- ✅ Dashboard analytics with real-time insights
- ✅ Bulk employee upload via CSV
- ✅ Employee eligibility tracking
- ✅ Order approval workflow
- ✅ Catalog management
- ✅ Location management
- ✅ Comprehensive reporting
- ✅ Designation-based eligibility rules

### For Employees
- ✅ Self-service ordering portal
- ✅ Catalog browsing with filtering
- ✅ Order tracking and history
- ✅ Eligibility visibility (cycles, available items)
- ✅ Mobile-friendly interface
- ✅ Profile management

### For Vendors
- ✅ Inventory management
- ✅ Order fulfillment
- ✅ Sales reports
- ✅ Low stock alerts

### System-Wide
- ✅ Multi-vendor and multi-company support
- ✅ OTP-based authentication
- ✅ Data encryption for PII
- ✅ Bulk operations
- ✅ Advanced reporting
- ✅ Budget tracking
- ✅ Audit trails

---

## 🛠️ Development Commands

### Basic Commands
```bash
npm run dev              # Start development server (port 3001)
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run linter
```

### Database Commands
```bash
npm run backup-db        # Backup database
npm run migrate          # Run migrations
npm run migrate-data-to-atlas  # Migrate to Atlas
```

### Utility Scripts
```bash
npm run add-employees    # Add sample employees
npm run list-employees   # List all employees
npm run set-prices       # Set product prices
npm run update-joining-dates  # Update employee joining dates
```

### Deployment Commands
```bash
npm run auto-fix-deployment    # Run deployment diagnostics
npm run check-vercel-env       # Check Vercel env var format
npm run verify-deployment      # Verify Vercel deployment
```

---

## 🐛 Known Issues & Solutions

### Products Not Loading
- **Symptom:** "Total Products Loaded: 0"
- **Solution:** Check companyId extraction in browser console
- **Status:** ✅ Fixed - Improved companyId extraction logic

### Email Login Failing
- **Symptom:** "No employee found for email"
- **Solution:** Email lookup is now case-insensitive
- **Status:** ✅ Fixed

### TypeScript Build Errors
- **Symptom:** `mongoose.connection.db` possibly undefined
- **Solution:** Added null checks
- **Status:** ✅ Fixed

---

## 📚 Important Documentation Files

- `PROJECT_CONTEXT.md` - Detailed project state and recent changes
- `README.md` - Project overview and setup
- `VERCEL_DEPLOYMENT_GUIDE.md` - Deployment instructions
- `MONGODB_SETUP.md` - Database setup guide
- `PRESENTATION.md` - System presentation materials

---

## 🔍 Key Code Locations

### Data Access
- `lib/db/data-access.ts` - All database queries and operations
- `lib/db/mongodb.ts` - MongoDB connection setup
- `lib/data-mongodb.ts` - Client-side data access (API calls)

### Pages
- `app/dashboard/consumer/page.tsx` - Employee dashboard
- `app/dashboard/consumer/catalog/page.tsx` - Product catalog
- `app/dashboard/company/page.tsx` - Company dashboard
- `app/api/` - All API routes

### Models
- `lib/models/Employee.ts` - Employee schema
- `lib/models/Company.ts` - Company schema
- `lib/models/Order.ts` - Order schema
- `lib/models/Uniform.ts` - Product schema

### Utilities
- `lib/utils/eligibility-cycles.ts` - Cycle calculation logic
- `lib/utils/encryption.ts` - Data encryption/decryption
- `lib/utils/auth-storage.ts` - Authentication storage

---

## 💡 Quick Tips

1. **Testing Login:** Use OTP `123456` for demo
2. **Test Employee:** `rajesh.kumar@goindigo.in` (IND-001)
3. **Test Company:** Indigo (COMP-INDIGO)
4. **Development Port:** 3001 (not 3000)
5. **Check Logs:** Browser console and Vercel deployment logs
6. **Database:** Check MongoDB Atlas dashboard for data

---

## 🎯 Current Focus Areas

### Immediate
- ✅ Email login (case-insensitive) - Fixed
- ✅ CompanyId extraction - Fixed
- ✅ Product loading - Fixed
- ✅ TypeScript build errors - Fixed

### Future Enhancements
- [ ] Fix duplicate schema index warnings (non-critical)
- [ ] Update baseline-browser-mapping package
- [ ] Add more comprehensive error handling
- [ ] Improve loading states and user feedback
- [ ] Real email/SMS OTP service integration
- [ ] Payment gateway integration
- [ ] Advanced chart visualizations
- [ ] Real-time notifications

---

## 📞 Support & Resources

- **GitHub:** https://github.com/agrawalpuran/UDS.git
- **Vercel Dashboard:** Check deployment status
- **MongoDB Atlas:** Database management
- **Documentation:** See `PROJECT_CONTEXT.md` for latest state

---

**This document provides comprehensive context about the Uniform Distribution System. For the most up-to-date project state, refer to `PROJECT_CONTEXT.md`.**



