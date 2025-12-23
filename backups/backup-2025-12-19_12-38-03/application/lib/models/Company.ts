import mongoose, { Schema, Document } from 'mongoose'

export interface ICompany extends Document {
  id: string
  name: string
  logo: string
  website: string
  primaryColor: string
  secondaryColor?: string
  showPrices: boolean
  allowPersonalPayments: boolean
  allowPersonalAddressDelivery: boolean // Company-level config: allow employees to use personal address for delivery
  enableEmployeeOrder: boolean // Company-level config: control whether employees can log in and place orders
  allowLocationAdminViewFeedback: boolean // Company-level config: control whether Location Admins can view product feedback
  adminId?: mongoose.Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
}

const CompanySchema = new Schema<ICompany>(
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
        message: 'Company ID must be a 6-digit numeric string (e.g., "100001")'
      }
    },
    name: {
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
      default: '#f76b1c', // Default orange color
    },
    showPrices: {
      type: Boolean,
      default: false,
      required: true,
    },
    allowPersonalPayments: {
      type: Boolean,
      default: false,
      required: true,
    },
    allowPersonalAddressDelivery: {
      type: Boolean,
      default: false, // Default: false for backward compatibility (only official location delivery)
      required: true,
    },
    enableEmployeeOrder: {
      type: Boolean,
      default: false, // Default: false - employees cannot log in/place orders unless enabled
      required: true,
    },
    allowLocationAdminViewFeedback: {
      type: Boolean,
      default: false, // Default: false - Location Admins cannot view feedback unless enabled
      required: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Note: id field already has index: true in schema definition, so no need for explicit index here
// CompanySchema.index({ id: 1 }) // REMOVED: Duplicate of id: { index: true }

const Company = mongoose.models.Company || mongoose.model<ICompany>('Company', CompanySchema)

export default Company

