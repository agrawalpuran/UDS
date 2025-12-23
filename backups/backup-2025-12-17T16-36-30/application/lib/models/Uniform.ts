import mongoose, { Schema, Document } from 'mongoose'

export interface IUniform extends Document {
  id: string
  name: string
  category: 'shirt' | 'pant' | 'shoe' | 'jacket' | 'accessory'
  gender: 'male' | 'female' | 'unisex'
  sizes: string[]
  price: number
  image: string
  sku: string
  companyIds: mongoose.Types.ObjectId[]
  // Optional SKU attributes (exactly 3)
  attribute1_name?: string
  attribute1_value?: string | number
  attribute2_name?: string
  attribute2_value?: string | number
  attribute3_name?: string
  attribute3_value?: string | number
  createdAt?: Date
  updatedAt?: Date
}

const UniformSchema = new Schema<IUniform>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      // Note: unique: true automatically creates an index, so index: true is redundant
      validate: {
        validator: function(v: string) {
          // Must be exactly 6 digits
          return /^\d{6}$/.test(v)
        },
        message: 'Uniform/Product ID must be a 6-digit numeric string (e.g., "200001")'
      }
    },
    name: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['shirt', 'pant', 'shoe', 'jacket', 'accessory'],
      required: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'unisex'],
      required: true,
    },
    sizes: {
      type: [String],
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    sku: {
      type: String,
      required: true,
      unique: true,
    },
    companyIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Company',
      default: [],
    },
    // Optional SKU attributes (exactly 3)
    attribute1_name: {
      type: String,
      required: false,
    },
    attribute1_value: {
      type: Schema.Types.Mixed, // Can be string or number
      required: false,
    },
    attribute2_name: {
      type: String,
      required: false,
    },
    attribute2_value: {
      type: Schema.Types.Mixed, // Can be string or number
      required: false,
    },
    attribute3_name: {
      type: String,
      required: false,
    },
    attribute3_value: {
      type: Schema.Types.Mixed, // Can be string or number
      required: false,
    },
  },
  {
    timestamps: true,
    strictPopulate: false, // Allow populating optional fields
  }
)

// Create indexes for better query performance
UniformSchema.index({ companyIds: 1 })
UniformSchema.index({ category: 1, gender: 1 })
// sku already has unique: true which creates an index, no need for explicit index

const Uniform = mongoose.models.Uniform || mongoose.model<IUniform>('Uniform', UniformSchema)

export default Uniform





