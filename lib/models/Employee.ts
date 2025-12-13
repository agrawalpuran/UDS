import mongoose, { Schema, Document } from 'mongoose'
import { encrypt, decrypt } from '../utils/encryption'

export interface IEmployee extends Document {
  id: string
  employeeId: string
  firstName: string
  lastName: string
  designation: string
  gender: 'male' | 'female'
  location: string
  email: string
  mobile: string
  shirtSize: string
  pantSize: string
  shoeSize: string
  address: string
  companyId: mongoose.Types.ObjectId
  companyName?: string // Optional - derived from companyId, stored for display only
  branchId?: mongoose.Types.ObjectId
  branchName?: string
  eligibility: {
    shirt: number
    pant: number
    shoe: number
    jacket: number
  }
  cycleDuration: {
    shirt: number // Duration in months
    pant: number
    shoe: number
    jacket: number
  }
  dispatchPreference: 'direct' | 'central' | 'regional'
  status: 'active' | 'inactive'
  period: string
  dateOfJoining: Date
  createdAt?: Date
  updatedAt?: Date
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    employeeId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },
    designation: {
      type: String,
      required: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female'],
      required: true,
    },
    location: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    mobile: {
      type: String,
      required: true,
    },
    shirtSize: {
      type: String,
      required: true,
    },
    pantSize: {
      type: String,
      required: true,
    },
    shoeSize: {
      type: String,
      required: true,
    },
    address: {
      type: String,
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    companyName: {
      type: String,
      required: false, // Optional - derived from companyId lookup, stored for display only
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      index: true,
    },
    branchName: {
      type: String,
    },
    eligibility: {
      shirt: { type: Number, required: true, default: 0 },
      pant: { type: Number, required: true, default: 0 },
      shoe: { type: Number, required: true, default: 0 },
      jacket: { type: Number, required: true, default: 0 },
    },
    cycleDuration: {
      shirt: { type: Number, required: true, default: 6 }, // Default 6 months
      pant: { type: Number, required: true, default: 6 },
      shoe: { type: Number, required: true, default: 6 },
      jacket: { type: Number, required: true, default: 12 }, // Default 12 months (1 year)
    },
    dispatchPreference: {
      type: String,
      enum: ['direct', 'central', 'regional'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
    period: {
      type: String,
      required: true,
    },
    dateOfJoining: {
      type: Date,
      required: true,
      default: () => new Date('2025-10-01T00:00:00.000Z'),
    },
  },
  {
    timestamps: true,
    strictPopulate: false, // Allow populating fields that may not be strictly defined
  }
)

EmployeeSchema.index({ companyId: 1, status: 1 })
EmployeeSchema.index({ email: 1 })
EmployeeSchema.index({ id: 1 })
EmployeeSchema.index({ employeeId: 1 })

// Encrypt sensitive fields before saving
EmployeeSchema.pre('save', function (next) {
  // Encrypt sensitive PII fields
  const sensitiveFields: (keyof IEmployee)[] = ['email', 'mobile', 'address', 'firstName', 'lastName', 'designation']
  
  for (const field of sensitiveFields) {
    if (this[field] && typeof this[field] === 'string') {
      // Only encrypt if not already encrypted (doesn't contain ':')
      const value = this[field] as string
      if (value && !value.includes(':')) {
        this[field] = encrypt(value) as any
      }
    }
  }
  
  next()
})

// Decrypt sensitive fields after retrieving
EmployeeSchema.post(['find', 'findOne', 'findOneAndUpdate'], function (docs) {
  if (!docs) return
  
  const documents = Array.isArray(docs) ? docs : [docs]
  const sensitiveFields: (keyof IEmployee)[] = ['email', 'mobile', 'address', 'firstName', 'lastName', 'designation']
  
  documents.forEach((doc: any) => {
    if (doc && typeof doc === 'object') {
      for (const field of sensitiveFields) {
        if (doc[field] && typeof doc[field] === 'string') {
          try {
            doc[field] = decrypt(doc[field])
          } catch (error) {
            // If decryption fails, keep original value
            console.warn(`Failed to decrypt field ${field}:`, error)
          }
        }
      }
    }
  })
})

const Employee = mongoose.models.Employee || mongoose.model<IEmployee>('Employee', EmployeeSchema)

export default Employee

