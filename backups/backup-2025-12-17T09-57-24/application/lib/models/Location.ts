import mongoose, { Schema, Document } from 'mongoose'

/**
 * Location Model
 * 
 * Represents a delivery/operational location under a Company.
 * Each Location belongs to exactly ONE Company.
 * Each Location must have exactly ONE assigned Location Admin (employee).
 * 
 * Relationships:
 * - Location belongs to Company (companyId)
 * - Location has Location Admin (adminId - employee reference)
 * - Employees reference Location (via location_id in Employee model)
 */
export interface ILocation extends Document {
  id: string // 6-digit numeric ID (e.g., "400001")
  name: string // Location name (e.g., "Mumbai Office", "Delhi Warehouse")
  companyId: mongoose.Types.ObjectId // Reference to Company
  adminId: mongoose.Types.ObjectId // Location Admin (employee) - REQUIRED
  address?: string // Optional physical address
  city?: string // Optional city
  state?: string // Optional state
  pincode?: string // Optional pincode
  phone?: string // Optional contact phone
  email?: string // Optional contact email
  status: 'active' | 'inactive' // Location status
  createdAt?: Date
  updatedAt?: Date
}

const LocationSchema = new Schema<ILocation>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      // Note: unique: true automatically creates an index, so index: true is redundant
      validate: {
        validator: function(v: string) {
          // Must be exactly 6 digits, starting from 400001
          return /^\d{6}$/.test(v) && parseInt(v) >= 400001 && parseInt(v) < 500000
        },
        message: 'Location ID must be a 6-digit numeric string between 400001-499999 (e.g., "400001")'
      }
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      // Optional: can be set later via updateLocation
      // Required for proper location management, but optional for initial creation
    },
    address: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    state: {
      type: String,
      trim: true,
    },
    pincode: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Indexes for efficient queries
LocationSchema.index({ companyId: 1, status: 1 })
LocationSchema.index({ adminId: 1 })
LocationSchema.index({ companyId: 1, name: 1 }, { unique: true }) // Unique location name per company

const Location = mongoose.models.Location || mongoose.model<ILocation>('Location', LocationSchema)

export default Location

