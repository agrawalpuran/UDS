# Uniform Distribution System - Project Context

**Last Updated:** November 15, 2025  
**Project Status:** Active Development  
**Database:** MongoDB (local instance)

---

## 📋 Project Overview

A multi-tenant uniform distribution system with four main user roles:
- **Super Admin**: Manages all entities and relationships
- **Company Admin**: Manages company employees and orders
- **Vendor**: Manages products and inventory
- **Consumer/Employee**: Places orders for uniforms

---

## 🗄️ Database Structure

### MongoDB Collections

1. **uniforms** (8 products)
   - Product catalog with details (name, category, price, sizes, images)
   - Categories: Shoes, Shirts, Trousers, etc.

2. **companies** (3 companies)
   - Indigo, Akasa Air, SpiceJet
   - Fields: `id`, `name`, `logo`, `website`, `primaryColor`, `showPrices`, `adminId`

3. **vendors** (3 vendors)
   - VEND-001, VEND-002, VEND-003
   - Vendor information and contact details

4. **employees** (10 employees)
   - Employee details with company linkage
   - Fields: `employeeId` (unique), `firstName`, `lastName`, `email`, `companyId`, `eligibility`

5. **orders** (0 orders - recently cleared)
   - Order history with items, quantities, totals
   - Links to employee and company

6. **productcompanies** (5 relationships)
   - Links products directly to companies
   - Determines which products consumers can see

7. **productvendors** (5 relationships)
   - Links products to vendors
   - Vendor inventory management

8. **vendorcompanies** (5 relationships)
   - Links vendors to companies
   - Currently not used for product visibility (only direct product-company links are used)

---

## 🔑 Key Features Implemented

### 1. Multi-Tenant Architecture
- Company-based data isolation
- Role-based access control
- Admin assignment per company

### 2. Product Management
- Product catalog with images
- Size and category management
- Product-Company linking (Super Admin)
- Product-Vendor linking (Super Admin)

### 3. Order Management
- Consumer order placement with eligibility checks
- Order review page before confirmation
- Order confirmation with estimated delivery
- Order history tracking
- Bulk order upload (CSV) for company admins

### 4. Eligibility System
- Per-employee eligibility by category
- Cross-order eligibility tracking
- Real-time eligibility validation
- Prevents exceeding total eligibility across multiple orders

### 5. Company Admin Features
- Admin assignment (Super Admin)
- Employee management
- Order tracking
- Bulk order processing
- Reports and analytics

### 6. Consumer Features
- Product catalog (company-linked products only)
- Quick order from dashboard
- Order review and confirmation
- Order history
- Profile management

### 7. Configuration Options
- **Show Prices**: Company-level setting to show/hide prices on order pages
- **Currency**: Indian Rupee (₹) throughout the application

---

## 🔐 Authentication & Access

### Login Methods
- **Super Admin**: Direct login (no OTP)
- **Company Admin**: Email + OTP (admin email must be assigned to company)
- **Vendor**: Email + OTP
- **Consumer**: Email + OTP

### Access Control
- Company admins can only access their assigned company
- Consumers only see products linked to their company
- Super admin has full system access

---

## 📁 Project Structure

```
uniform-distribution-system/
├── app/
│   ├── api/                    # API routes
│   │   ├── companies/
│   │   ├── employees/
│   │   ├── orders/
│   │   │   └── bulk/          # Bulk order processing
│   │   ├── products/
│   │   ├── relationships/
│   │   └── vendors/
│   ├── dashboard/
│   │   ├── company/           # Company admin portal
│   │   ├── consumer/          # Employee/Consumer portal
│   │   ├── superadmin/        # Super admin portal
│   │   └── vendor/            # Vendor portal
│   ├── login/                 # Login pages
│   └── page.tsx               # Landing page
├── components/
│   ├── DashboardLayout.tsx
│   └── OTPVerification.tsx    # OTP component with auto-focus/auto-submit
├── lib/
│   ├── data.ts                # Legacy mock data (deprecated)
│   ├── data-mongodb.ts        # Client-side MongoDB data access
│   ├── db/
│   │   ├── data-access.ts     # Server-side MongoDB operations
│   │   └── mongodb.ts         # MongoDB connection
│   └── models/                # Mongoose schemas
│       ├── Company.ts
│       ├── Employee.ts
│       ├── Order.ts
│       ├── Relationship.ts
│       ├── Uniform.ts
│       └── Vendor.ts
└── scripts/                   # Utility scripts
    ├── backup-database.js
    ├── restore-database.js
    ├── create-backup.ps1
    ├── create-backup-zip.ps1
    ├── create-full-backup.ps1
    └── ... (other utility scripts)
```

---

## 🛠️ Technology Stack

- **Framework**: Next.js 16.0.3 (App Router)
- **Language**: TypeScript
- **Database**: MongoDB with Mongoose ODM
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Runtime**: Node.js

---

## 📦 NPM Scripts

### Development
- `npm run dev` - Start development server (port 3001)
- `npm run build` - Build for production
- `npm run start` - Start production server

### Database
- `npm run migrate` - Run MongoDB migration
- `npm run backup-db` - Backup MongoDB database
- `npm run restore-db <path>` - Restore database from backup

### Utilities
- `npm run add-employees` - Add sample employees
- `npm run list-employees` - List all employees
- `npm run delete-all-orders` - Clear all orders

### Backup
- `npm run backup` - Backup code (folder)
- `npm run backup-zip` - Backup code (ZIP)
- `npm run backup-full` - Backup code + database

---

## 🔄 Recent Changes

### Latest Updates (November 2025)
1. ✅ Deleted all order history from database
2. ✅ Added comprehensive backup system (code + database)
3. ✅ Implemented OTP auto-focus and auto-submit
4. ✅ Changed currency to Indian Rupee (₹)
5. ✅ Fixed vendor dashboard `mockOrders` error
6. ✅ Added bulk order upload feature for company admins
7. ✅ Implemented employee ID system (unique IDs)
8. ✅ Added company admin assignment feature
9. ✅ Implemented eligibility tracking across orders
10. ✅ Added order review page before confirmation
11. ✅ Implemented configurable price display (company level)
12. ✅ Migrated from localStorage to MongoDB

---

## 🐛 Known Issues / Limitations

1. **Product Visibility**: Only products directly linked to companies are shown to consumers (vendor-company relationships are not used for product visibility)
2. **Image Loading**: Some product images may fail to load (404 errors) - fallback placeholders are in place
3. **MongoDB Tools**: `mongodump` not installed - using code-based backup method

---

## 📝 Important Notes

### Database Connection
- **URI**: `mongodb://localhost:27017/uniform-distribution`
- **Environment Variable**: `MONGODB_URI` (optional, defaults to above)

### Port Configuration
- Development server runs on **port 3001** (not 3000)
- Configured in `package.json`: `"dev": "next dev -p 3001"`

### Employee IDs
- Format: `EMP-XXXXXX` or `IND-XXX`, `AKA-XXX`, etc.
- Unique per employee
- Displayed in UI across all dashboards

### Eligibility System
- Stored per employee in `eligibility` field (object with category keys)
- Consumed eligibility calculated from existing orders
- Remaining eligibility = Total - Consumed
- Enforced at catalog and dashboard levels

---

## 🚀 Getting Started (After Restore)

1. **Restore Code**:
   ```bash
   # Copy backup folder back to project location
   cd "C:\Users\pagrawal\OneDrive - CSG Systems Inc\Personal\Cursor AI"
   # Restore from backup folder
   ```

2. **Install Dependencies**:
   ```bash
   cd uniform-distribution-system
   npm install
   ```

3. **Start MongoDB**:
   ```bash
   # Ensure MongoDB is running on localhost:27017
   ```

4. **Restore Database** (if needed):
   ```bash
   npm run restore-db "../mongodb-backup-YYYY-MM-DDTHH-MM-SS/database-backup.json"
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```

6. **Access Application**:
   - Landing Page: http://localhost:3001
   - Super Admin: http://localhost:3001/login/superadmin
   - Company Admin: http://localhost:3001/login/company
   - Consumer: http://localhost:3001/login/consumer
   - Vendor: http://localhost:3001/login/vendor

---

## 👥 Test Accounts

### Super Admin
- Email: `admin@uniformsystem.com`
- No OTP required

### Company Admin (Indigo)
- Email: `amit.patel@goindigo.in`
- OTP: 123456

### Consumer (Indigo Employee)
- Email: `vikram.singh@goindigo.in`
- OTP: 123456
- Employee ID: `IND-011`

### Vendor
- Email: `vendor@uniformsupplier.com`
- OTP: 123456

---

## 📊 Current Data State

### Companies
- **Indigo** (COMP-INDIGO) - Admin: amit.patel@goindigo.in
- **Akasa Air** (COMP-AKASA)
- **SpiceJet** (COMP-SPICEJET)

### Products Linked to Indigo
- 5 products currently linked via `productcompanies` relationship

### Employees
- 10 total employees
- 3 for Indigo
- 2 for Akasa Air
- 5 for SpiceJet

### Orders
- **0 orders** (recently deleted)

---

## 🔮 Next Steps / TODO

1. Consider implementing vendor-company product visibility (if needed)
2. Add more robust error handling for API failures
3. Implement order status tracking (pending, processing, shipped, delivered)
4. Add email notifications for order confirmations
5. Implement inventory management for vendors
6. Add reporting and analytics dashboards
7. Consider implementing user roles/permissions more granularly

---

## 📞 Support / Troubleshooting

### Common Issues

1. **Port 3001 already in use**:
   ```powershell
   # Find process using port 3001
   netstat -ano | findstr :3001
   # Kill process (replace PID)
   Stop-Process -Id <PID>
   ```

2. **MongoDB connection failed**:
   - Ensure MongoDB service is running
   - Check connection string in `.env` or `lib/db/mongodb.ts`

3. **Products not showing for consumer**:
   - Verify product-company relationship exists in Super Admin
   - Check employee's `companyId` matches the company
   - Verify `getProductsByCompany` is using correct filtering

4. **Eligibility not working**:
   - Check employee's `eligibility` field in database
   - Verify `consumedEligibility` calculation from orders
   - Check console logs for eligibility calculations

---

## 📚 Documentation Files

- `README.md` - Project overview
- `MONGODB_SETUP.md` - MongoDB setup instructions
- `PROJECT_CONTEXT.md` - This file (project state and context)

---

## 💾 Backup Locations

### Code Backups
- Location: `C:\Users\pagrawal\OneDrive - CSG Systems Inc\Personal\Cursor AI\`
- Pattern: `uniform-distribution-system-backup-YYYY-MM-DD_HH-mm-ss`

### Database Backups
- Location: `C:\Users\pagrawal\OneDrive - CSG Systems Inc\Personal\Cursor AI\`
- Pattern: `mongodb-backup-YYYY-MM-DDTHH-MM-SS`
- File: `database-backup.json`

### Full Backups
- Location: `C:\Users\pagrawal\OneDrive - CSG Systems Inc\Personal\Cursor AI\`
- Pattern: `uniform-distribution-system-full-backup-YYYY-MM-DD_HH-mm-ss`
- Contains: `code/` folder + `database/` folder

---

**End of Context Document**

*This document should be updated after significant changes to maintain accurate project state.*




