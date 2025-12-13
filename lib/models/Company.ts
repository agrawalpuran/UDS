import mongoose, { Schema, Document } from 'mongoose'

export interface ICompany extends Document {
  id: number
  name: string
  logo: string
  website: string
  primaryColor: string
  secondaryColor?: string
  showPrices: boolean
  allowPersonalPayments: boolean
  adminId?: mongoose.Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
}

const CompanySchema = new Schema<ICompany>(
  {
    id: {
      type: Number,
      required: true,
      unique: true,
      index: true,
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

CompanySchema.index({ id: 1 })

const Company = mongoose.models.Company || mongoose.model<ICompany>('Company', CompanySchema)

export default Company

