import mongoose, { Schema, Document } from 'mongoose'

export interface IVendorInventory extends Document {
  id: string
  vendorId: mongoose.Types.ObjectId
  productId: mongoose.Types.ObjectId
  sizeInventory: {
    [size: string]: number // e.g., { "S": 10, "M": 25, "L": 15 }
  }
  totalStock: number // Calculated sum of all sizes
  createdAt?: Date
  updatedAt?: Date
}

const VendorInventorySchema = new Schema<IVendorInventory>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Uniform',
      required: true,
      index: true,
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
  if (this.sizeInventory && typeof this.sizeInventory === 'object') {
    const sizeMap = this.sizeInventory instanceof Map 
      ? this.sizeInventory 
      : new Map(Object.entries(this.sizeInventory))
    
    let total = 0
    for (const quantity of sizeMap.values()) {
      total += typeof quantity === 'number' ? quantity : 0
    }
    this.totalStock = total
  } else {
    this.totalStock = 0
  }
  next()
})

const VendorInventory = mongoose.models.VendorInventory || mongoose.model<IVendorInventory>('VendorInventory', VendorInventorySchema)

export default VendorInventory


