/**
 * Production-safe script to purge old completed orders
 * 
 * BUSINESS RULES:
 * - Only purges orders with status 'Delivered' (fully completed)
 * - Only purges orders older than cutoff date (default: 365 days)
 * - Never purges: 'Awaiting approval', 'Awaiting fulfilment', 'Dispatched'
 * - Handles parent-child order relationships (split orders)
 * - Batch processing with error handling
 * - Comprehensive logging
 * 
 * USAGE:
 *   node scripts/purge-old-orders.js [daysOld]
 *   Default: 365 days (1 year)
 * 
 * SAFETY FEATURES:
 * - Dry-run mode (set DRY_RUN=true)
 * - Minimum cutoff date validation
 * - Per-order error handling (failures don't stop purge)
 * - Detailed logging
 */

const mongoose = require('mongoose')
const fs = require('fs')
const path = require('path')

let MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uniform-distribution'
const DRY_RUN = process.env.DRY_RUN === 'true'
const DAYS_OLD = parseInt(process.argv[2]) || 365
const BATCH_SIZE = 100 // Process orders in batches
const MIN_DAYS_OLD = 90 // Safety: Never purge orders newer than 90 days

try {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8')
    const mongoMatch = envContent.match(/MONGODB_URI=(.+)/)
    if (mongoMatch) {
      MONGODB_URI = mongoMatch[1].trim().replace(/^["']|["']$/g, '')
    }
  }
} catch (error) {
  console.warn('Could not read .env.local')
}

async function purgeOldOrders() {
  const startTime = Date.now()
  
  try {
    console.log('='.repeat(80))
    console.log('ORDER PURGE SCRIPT')
    console.log('='.repeat(80))
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no deletions)' : 'LIVE (will delete)'}`)
    console.log(`Cutoff: Orders older than ${DAYS_OLD} days`)
    console.log(`Minimum safety: ${MIN_DAYS_OLD} days (orders newer than this will never be purged)`)
    console.log(`Batch size: ${BATCH_SIZE}`)
    console.log('')

    // Validate cutoff date
    if (DAYS_OLD < MIN_DAYS_OLD) {
      console.error(`❌ ERROR: Cutoff date must be at least ${MIN_DAYS_OLD} days`)
      console.error(`   Provided: ${DAYS_OLD} days`)
      console.error(`   This safety check prevents accidental mass deletion of recent orders`)
      process.exit(1)
    }

    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB\n')

    const db = mongoose.connection.db
    if (!db) {
      throw new Error('Database connection not available')
    }

    const ordersCollection = db.collection('orders')
    
    // Calculate cutoff date
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - DAYS_OLD)
    console.log(`Cutoff date: ${cutoffDate.toISOString()}`)
    console.log(`   (Orders with orderDate before this date are eligible for purge)\n`)

    // Find eligible orders
    // Only 'Delivered' status, older than cutoff date
    const eligibleQuery = {
      status: 'Delivered',
      orderDate: { $lt: cutoffDate }
    }

    console.log('Finding eligible orders...')
    const eligibleOrders = await ordersCollection.find(eligibleQuery).toArray()
    console.log(`Found ${eligibleOrders.length} eligible orders\n`)

    if (eligibleOrders.length === 0) {
      console.log('✅ No orders to purge')
      await mongoose.disconnect()
      process.exit(0)
    }

    // Group orders by parentOrderId to handle split orders
    const parentOrderMap = new Map()
    const standaloneOrders = []

    for (const order of eligibleOrders) {
      if (order.parentOrderId) {
        if (!parentOrderMap.has(order.parentOrderId)) {
          parentOrderMap.set(order.parentOrderId, [])
        }
        parentOrderMap.get(order.parentOrderId).push(order)
      } else {
        standaloneOrders.push(order)
      }
    }

    console.log(`Split orders (with parentOrderId): ${parentOrderMap.size} parent orders`)
    console.log(`Standalone orders: ${standaloneOrders.length} orders\n`)

    // For split orders, verify ALL child orders are 'Delivered' before purging
    const eligibleParentOrders = []
    const skippedParentOrders = []

    for (const [parentOrderId, childOrders] of parentOrderMap.entries()) {
      // Check if ALL child orders are 'Delivered'
      const allDelivered = childOrders.every(o => o.status === 'Delivered')
      const allOldEnough = childOrders.every(o => {
        const orderDate = o.orderDate instanceof Date ? o.orderDate : new Date(o.orderDate)
        return orderDate < cutoffDate
      })

      if (allDelivered && allOldEnough) {
        eligibleParentOrders.push({ parentOrderId, childOrders })
      } else {
        skippedParentOrders.push({ parentOrderId, childOrders, reason: !allDelivered ? 'Not all delivered' : 'Not all old enough' })
      }
    }

    console.log(`Eligible parent orders (all children delivered & old): ${eligibleParentOrders.length}`)
    console.log(`Skipped parent orders: ${skippedParentOrders.length}\n`)

    // Collect all order IDs to delete
    const ordersToDelete = []
    
    // Add standalone orders
    for (const order of standaloneOrders) {
      ordersToDelete.push({ orderId: order.id, _id: order._id, type: 'standalone' })
    }

    // Add child orders from eligible parent orders
    for (const { childOrders } of eligibleParentOrders) {
      for (const order of childOrders) {
        ordersToDelete.push({ orderId: order.id, _id: order._id, type: 'split', parentOrderId: order.parentOrderId })
      }
    }

    console.log(`Total orders to purge: ${ordersToDelete.length}`)
    console.log(`  - Standalone: ${ordersToDelete.filter(o => o.type === 'standalone').length}`)
    console.log(`  - Split orders: ${ordersToDelete.filter(o => o.type === 'split').length}`)
    console.log('')

    if (DRY_RUN) {
      console.log('🔍 DRY RUN MODE - No orders will be deleted')
      console.log('Sample orders that would be purged:')
      ordersToDelete.slice(0, 10).forEach((o, idx) => {
        console.log(`  ${idx + 1}. Order ID: ${o.orderId} (${o.type})`)
      })
      if (ordersToDelete.length > 10) {
        console.log(`  ... and ${ordersToDelete.length - 10} more`)
      }
      await mongoose.disconnect()
      process.exit(0)
    }

    // Confirm before proceeding
    console.log('⚠️  WARNING: This will permanently delete orders!')
    console.log(`   ${ordersToDelete.length} orders will be deleted`)
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n')
    
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Process deletions in batches
    let deletedCount = 0
    let failedCount = 0
    const failures = []

    console.log('Starting purge...\n')

    for (let i = 0; i < ordersToDelete.length; i += BATCH_SIZE) {
      const batch = ordersToDelete.slice(i, i + BATCH_SIZE)
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(ordersToDelete.length / BATCH_SIZE)} (${batch.length} orders)...`)

      for (const orderInfo of batch) {
        try {
          const result = await ordersCollection.deleteOne({ _id: orderInfo._id })
          
          if (result.deletedCount === 1) {
            deletedCount++
            if (deletedCount % 50 === 0) {
              console.log(`  Progress: ${deletedCount}/${ordersToDelete.length} deleted...`)
            }
          } else {
            failedCount++
            failures.push({ orderId: orderInfo.orderId, error: 'Order not found or already deleted' })
          }
        } catch (error) {
          failedCount++
          failures.push({ orderId: orderInfo.orderId, error: error.message || 'Unknown error' })
          // Continue with next order (failures don't stop the purge)
        }
      }
    }

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(2)

    console.log('\n' + '='.repeat(80))
    console.log('PURGE SUMMARY')
    console.log('='.repeat(80))
    console.log(`Total eligible orders: ${ordersToDelete.length}`)
    console.log(`✅ Successfully deleted: ${deletedCount}`)
    console.log(`❌ Failed: ${failedCount}`)
    console.log(`⏱️  Execution time: ${duration} seconds`)
    console.log('')

    if (failures.length > 0) {
      console.log('FAILURES:')
      failures.slice(0, 20).forEach((f, idx) => {
        console.log(`  ${idx + 1}. Order ${f.orderId}: ${f.error}`)
      })
      if (failures.length > 20) {
        console.log(`  ... and ${failures.length - 20} more failures`)
      }
      console.log('')
    }

    // Verify deletion
    const remainingEligible = await ordersCollection.countDocuments(eligibleQuery)
    console.log(`Remaining eligible orders: ${remainingEligible}`)
    
    if (remainingEligible === 0) {
      console.log('✅ All eligible orders have been purged')
    } else {
      console.log(`⚠️  ${remainingEligible} eligible orders still remain (may be due to failures or new orders)`)
    }

    await mongoose.disconnect()
    console.log('\n✅ Disconnected from MongoDB')
    process.exit(failures.length > 0 ? 1 : 0)
  } catch (error) {
    console.error('\n❌ Purge failed:', error)
    await mongoose.disconnect()
    process.exit(1)
  }
}

purgeOldOrders()

