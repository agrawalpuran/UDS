const mongoose = require('mongoose')

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/uniform-distribution'

// Define Order Schema
const OrderSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: { type: String, required: true },
  items: [{
    uniformId: { type: mongoose.Schema.Types.ObjectId, ref: 'Uniform' },
    uniformName: { type: String, required: true },
    size: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
  }],
  total: { type: Number, required: true },
  status: { type: String, required: true },
  orderDate: { type: Date, required: true },
  dispatchLocation: { type: String },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' },
  deliveryAddress: { type: String },
  estimatedDeliveryTime: { type: String },
}, { timestamps: true })

const Order = mongoose.model('Order', OrderSchema)

async function deleteAllOrders() {
  try {
    console.log('Connecting to MongoDB...')
    await mongoose.connect(MONGODB_URI)
    console.log('✅ Connected to MongoDB')

    // Count orders before deletion
    const orderCount = await Order.countDocuments({})
    console.log(`Found ${orderCount} orders in the database`)

    if (orderCount === 0) {
      console.log('⚠️ No orders found in database. Nothing to delete.')
      return
    }

    // Delete all orders
    const result = await Order.deleteMany({})
    
    console.log(`\n✅ Successfully deleted ${result.deletedCount} orders from the database`)
    console.log('🗑️ All order history has been cleared')
  } catch (error) {
    console.error('❌ Error deleting orders:', error)
  } finally {
    await mongoose.disconnect()
    console.log('✅ Disconnected from MongoDB')
  }
}

deleteAllOrders()






