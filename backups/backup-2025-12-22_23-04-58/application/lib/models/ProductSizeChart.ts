import mongoose, { Schema, Document } from 'mongoose'

/**
 * Product Size Chart Model
 * 
 * Stores size chart images for products/SKUs.
 * Size charts are optional and displayed as "View Size Chart" links on catalog cards.
 */

export interface IProductSizeChart extends Document {
  id: string // Unique ID for the size chart
  productId: string // Reference to Uniform.id (6-digit product ID)
  imageUrl: string // URL/path to the size chart image (stored in public/uploads/size-charts/)
  imageType: 'jpg' | 'jpeg' | 'png' | 'webp' // Image format
  fileName: string // Original file name
  fileSize: number // File size in bytes
  createdAt?: Date
  updatedAt?: Date
}

const ProductSizeChartSchema = new Schema<IProductSizeChart>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      // Generate unique ID: SC-{productId}-{timestamp}
      default: function() {
        const productId = (this as any).productId || '000000'
        const timestamp = Date.now().toString().slice(-6)
        return `SC-${productId}-${timestamp}`
      }
    },
    productId: {
      type: String,
      required: true,
      index: true,
      validate: {
        validator: function(v: string) {
          // Must be exactly 6 digits (matching Uniform.id format)
          return /^\d{6}$/.test(v)
        },
        message: 'Product ID must be a 6-digit numeric string (e.g., "200001")'
      }
    },
    imageUrl: {
      type: String,
      required: true,
      // URL should be relative path from public folder, e.g., /uploads/size-charts/product-200001.jpg
    },
    imageType: {
      type: String,
      enum: ['jpg', 'jpeg', 'png', 'webp'],
      required: true,
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
)

// Indexes for efficient queries
ProductSizeChartSchema.index({ productId: 1 }, { unique: true }) // One size chart per product
ProductSizeChartSchema.index({ id: 1 })

const ProductSizeChart =
  mongoose.models.ProductSizeChart ||
  mongoose.model<IProductSizeChart>('ProductSizeChart', ProductSizeChartSchema)

export default ProductSizeChart

