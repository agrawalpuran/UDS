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
      // Note: unique: true automatically creates an index, so index: true is redundant
      validate: {
        validator: function(v: string) {
          // Must be exactly 6 digits
          return /^\d{6}$/.test(v)
        },
        message: 'Vendor ID must be a 6-digit numeric string (e.g., "100001")'
      }
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

// Note: id field already has index: true in schema definition, so no need for explicit index here
// VendorSchema.index({ id: 1 }) // REMOVED: Duplicate of id: { index: true }
// Note: email has unique: true which automatically creates a unique index, so explicit index is duplicate
// VendorSchema.index({ email: 1 }) // REMOVED: Duplicate of email: { unique: true }

const Vendor = mongoose.models.Vendor || mongoose.model<IVendor>('Vendor', VendorSchema)

export default Vendor






