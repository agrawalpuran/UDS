import mongoose, { Schema, Document } from 'mongoose'
import { encrypt, decrypt } from '../utils/encryption'

export interface IBranch extends Document {
  id: string
  name: string
  address: string
  city: string
  state: string
  pincode: string
  phone?: string
  email?: string
  companyId: mongoose.Types.ObjectId
  adminId?: mongoose.Types.ObjectId // Branch admin (employee)
  status: 'active' | 'inactive'
  createdAt?: Date
  updatedAt?: Date
}

const BranchSchema = new Schema<IBranch>(
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
    address: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    pincode: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
    },
    email: {
      type: String,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      index: true,
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

BranchSchema.index({ id: 1 })
BranchSchema.index({ companyId: 1 })
BranchSchema.index({ adminId: 1 })

// Encrypt sensitive fields before saving
BranchSchema.pre('save', function (next) {
  // Encrypt sensitive fields
  const sensitiveFields: (keyof IBranch)[] = ['address', 'phone', 'email']
  
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
BranchSchema.post(['find', 'findOne', 'findOneAndUpdate'], function (docs) {
  if (!docs) return
  
  const documents = Array.isArray(docs) ? docs : [docs]
  const sensitiveFields: (keyof IBranch)[] = ['address', 'phone', 'email']
  
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

const Branch = mongoose.models.Branch || mongoose.model<IBranch>('Branch', BranchSchema)

export default Branch

