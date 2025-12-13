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
  stock: number
  companyIds: mongoose.Types.ObjectId[]
  createdAt?: Date
  updatedAt?: Date
}

const UniformSchema = new Schema<IUniform>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
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
    stock: {
      type: Number,
      required: true,
      default: 0,
    },
    companyIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Company',
      default: [],
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
UniformSchema.index({ sku: 1 })

const Uniform = mongoose.models.Uniform || mongoose.model<IUniform>('Uniform', UniformSchema)

export default Uniform





