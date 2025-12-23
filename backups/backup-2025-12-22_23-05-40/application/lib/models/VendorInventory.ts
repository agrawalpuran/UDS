import mongoose, { Schema, Document } from 'mongoose'

export interface IVendorInventory extends Document {
  id: string
  vendorId: mongoose.Types.ObjectId
  productId: mongoose.Types.ObjectId
  sizeInventory: {
    [size: string]: number // e.g., { "S": 10, "M": 25, "L": 15 }
  }
  totalStock: number // Calculated sum of all sizes
  lowInventoryThreshold: {
    [size: string]: number // e.g., { "S": 5, "M": 10, "L": 5 } - vendor configurable threshold per size
  }
  createdAt?: Date
  updatedAt?: Date
}

const VendorInventorySchema = new Schema<IVendorInventory>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      // Note: unique: true automatically creates an index, so index: true is redundant
    },
    // Note: vendorId and productId don't need index: true because they're the first fields in compound indexes below
    // MongoDB can use compound indexes for queries on just vendorId or productId
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Uniform',
      required: true,
    },
    sizeInventory: {
      type: Map,
      of: Number,
      default: {},
    },
    totalStock: {
      type: Number,
      required: true,
      default: 0,
    },
    lowInventoryThreshold: {
      type: Map,
      of: Number,
      default: {}, // Default threshold is 0 (no alert) - vendor can set per size
    },
  },
  {
    timestamps: true,
    strictPopulate: false,
  }
)

// Compound index to ensure one inventory record per vendor-product combination
VendorInventorySchema.index({ vendorId: 1, productId: 1 }, { unique: true })

// Pre-save hook to calculate totalStock from sizeInventory
VendorInventorySchema.pre('save', function (next) {
  console.log(`[VendorInventory Pre-Save Hook] 🔄 Pre-save hook triggered for inventory:`, {
    inventoryId: this.id,
    sizeInventoryType: typeof this.sizeInventory,
    sizeInventoryIsMap: this.sizeInventory instanceof Map,
    sizeInventoryValue: this.sizeInventory instanceof Map
      ? Object.fromEntries(this.sizeInventory)
      : this.sizeInventory,
    currentTotalStock: this.totalStock
  })
  
  if (this.sizeInventory && typeof this.sizeInventory === 'object') {
    const sizeMap = this.sizeInventory instanceof Map 
      ? this.sizeInventory 
      : new Map(Object.entries(this.sizeInventory))
    
    let total = 0
    for (const quantity of sizeMap.values()) {
      total += typeof quantity === 'number' ? quantity : 0
    }
    this.totalStock = total
    console.log(`[VendorInventory Pre-Save Hook] ✅ Calculated totalStock: ${total} from sizeInventory`)
  } else {
    this.totalStock = 0
    console.log(`[VendorInventory Pre-Save Hook] ⚠️ sizeInventory is empty or invalid, setting totalStock to 0`)
  }
  next()
})

const VendorInventory = mongoose.models.VendorInventory || mongoose.model<IVendorInventory>('VendorInventory', VendorInventorySchema)

export default VendorInventory


