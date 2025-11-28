import mongoose, { Schema, Document } from 'mongoose'

export interface IVendor extends Document {
  id: string
  name: string
  email: string
  phone: string
  logo: string
  website: string
  primaryColor: string
  secondaryColor: string
  accentColor: string
  theme: 'light' | 'dark' | 'custom'
  createdAt?: Date
  updatedAt?: Date
}

const VendorSchema = new Schema<IVendor>(
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
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phone: {
      type: String,
      required: true,
    },
    logo: {
      type: String,
      required: true,
    },
    website: {
      type: String,
      required: true,
    },
    primaryColor: {
      type: String,
      required: true,
    },
    secondaryColor: {
      type: String,
      required: true,
    },
    accentColor: {
      type: String,
      required: true,
    },
    theme: {
      type: String,
      enum: ['light', 'dark', 'custom'],
      default: 'light',
    },
  },
  {
    timestamps: true,
  }
)

VendorSchema.index({ id: 1 })
VendorSchema.index({ email: 1 })

const Vendor = mongoose.models.Vendor || mongoose.model<IVendor>('Vendor', VendorSchema)

export default Vendor




