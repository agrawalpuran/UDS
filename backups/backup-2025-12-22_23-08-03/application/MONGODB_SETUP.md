# MongoDB Setup Guide

This guide will help you set up MongoDB for the Uniform Distribution System.

## Prerequisites

- MongoDB 8.2+ installed and running
- Node.js and npm installed
- All npm dependencies installed (`npm install`)

## Step 1: Verify MongoDB is Running

Make sure MongoDB service is running on your system:

```powershell
Get-Service -Name *mongo*
```

The MongoDB service should show as "Running".

## Step 2: Run Migration Script

The migration script will populate MongoDB with all the initial data from the mock data files.

```bash
npm run migrate
```

This will:
- Connect to MongoDB (default: `mongodb://localhost:27017/uniform-distribution`)
- Clear existing data (if any)
- Migrate all vendors, companies, products, employees, orders, and relationships
- Create proper indexes for better performance

## Step 3: Verify Data

You can verify the data was migrated successfully by:

1. Using MongoDB Compass (GUI tool)
2. Connecting to: `mongodb://localhost:27017/uniform-distribution`
3. Checking collections: `uniforms`, `vendors`, `companies`, `employees`, `orders`, `productcompanies`, `productvendors`, `vendorcompanies`

## Step 4: Update Environment Variables (Optional)

If you want to use a different MongoDB connection string, create a `.env.local` file:

```
MONGODB_URI=mongodb://localhost:27017/uniform-distribution
```

## Database Structure

### Collections

1. **uniforms** - Product/Uniform catalog
2. **vendors** - Vendor information
3. **companies** - Company information
4. **employees** - Employee records
5. **orders** - Order records
6. **productcompanies** - Product-Company relationships
7. **productvendors** - Product-Vendor relationships
8. **vendorcompanies** - Vendor-Company relationships

### Indexes

All collections have indexes on:
- `id` field (unique string identifier)
- Foreign key relationships
- Frequently queried fields (email, companyId, etc.)

## API Endpoints

The application now uses API routes for data access:

- `GET /api/products?companyId=COMP-INDIGO` - Get products by company
- `GET /api/employees?email=user@example.com` - Get employee by email
- `GET /api/orders?companyId=COMP-INDIGO` - Get orders by company
- `GET /api/relationships?type=productCompany` - Get relationships

## Troubleshooting

### Connection Issues

If you get connection errors:
1. Verify MongoDB is running: `Get-Service -Name *mongo*`
2. Check MongoDB is listening on port 27017: `netstat -an | findstr :27017`
3. Verify connection string in `lib/db/mongodb.ts`

### Migration Errors

If migration fails:
1. Check MongoDB logs
2. Ensure all mock data is valid
3. Try clearing the database manually and re-running migration

### Performance

For better performance:
- Indexes are automatically created
- Use MongoDB Compass to monitor query performance
- Consider adding additional indexes based on your query patterns

## Next Steps

After migration:
1. The application will automatically use MongoDB instead of localStorage
2. All data operations will be persisted in MongoDB
3. You can manage relationships through the Super Admin portal
4. All changes will be saved to MongoDB






