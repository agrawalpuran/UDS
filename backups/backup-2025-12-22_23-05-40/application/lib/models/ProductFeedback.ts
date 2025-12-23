import mongoose, { Schema, Document } from 'mongoose'

export interface IProductFeedback extends Document {
  orderId: string // Order ID reference
  productId: string // Product/Uniform ID
  uniformId?: mongoose.Types.ObjectId // Reference to Uniform model
  employeeId: mongoose.Types.ObjectId // Employee who submitted feedback
  employeeIdNum: string // Numeric employee ID for correlation
  companyId: mongoose.Types.ObjectId // Company ID
  companyIdNum: number // Numeric company ID for correlation
  vendorId?: mongoose.Types.ObjectId // Vendor ID (from order)
  rating: number // Rating from 1 to 5
  comment?: string // Optional feedback comment
  createdAt?: Date
  updatedAt?: Date
}

const ProductFeedbackSchema = new Schema<IProductFeedback>(
  {
    orderId: {
      type: String,
      required: true,
      index: true,
    },
    productId: {
      type: String,
      required: true,
      index: true,
    },
    uniformId: {
      type: Schema.Types.ObjectId,
      ref: 'Uniform',
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
      index: true,
    },
    employeeIdNum: {
      type: String,
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    companyIdNum: {
      type: Number,
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      index: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
      validate: {
        validator: Number.isInteger,
        message: 'Rating must be an integer between 1 and 5',
      },
    },
    comment: {
      type: String,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
  }
)

// Compound indexes for efficient queries
ProductFeedbackSchema.index({ employeeId: 1, companyId: 1 })
// Unique constraint: one feedback per product per order per employee
ProductFeedbackSchema.index({ orderId: 1, productId: 1, employeeId: 1 }, { unique: true })
ProductFeedbackSchema.index({ productId: 1, vendorId: 1 })
ProductFeedbackSchema.index({ companyId: 1, createdAt: -1 })

const ProductFeedback = mongoose.models.ProductFeedback || mongoose.model<IProductFeedback>('ProductFeedback', ProductFeedbackSchema)

export default ProductFeedback

