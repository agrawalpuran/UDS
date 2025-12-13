import mongoose, { Schema, Document } from 'mongoose'
import { encrypt, decrypt } from '../utils/encryption'

export interface ItemEligibility {
  quantity: number // Number of items allowed per cycle
  renewalFrequency: number // Renewal frequency value
  renewalUnit: 'months' | 'years' // Renewal unit (months or years)
}

export interface IDesignationProductEligibility extends Document {
  id: string
  companyId: mongoose.Types.ObjectId
  companyName: string
  designation: string // e.g., "General Manager", "Office Admin"
  gender?: 'male' | 'female' | 'unisex' // Gender filter: 'male', 'female', or 'unisex' (defaults to 'unisex' for backward compatibility)
  allowedProductCategories: string[] // e.g., ["blazer", "shoes", "shirt", "trouser"] - kept for backward compatibility
  itemEligibility?: {
    // Per-category eligibility with quantity and renewal settings
    shirt?: ItemEligibility
    trouser?: ItemEligibility
    pant?: ItemEligibility // Alias for trouser
    shoe?: ItemEligibility
    blazer?: ItemEligibility
    jacket?: ItemEligibility // Alias for blazer
  }
  status: 'active' | 'inactive'
  createdAt?: Date
  updatedAt?: Date
}

const ItemEligibilitySchema = new Schema({
  quantity: { type: Number, required: true },
  renewalFrequency: { type: Number, required: true },
  renewalUnit: { type: String, enum: ['months', 'years'], required: true, default: 'months' },
}, { _id: false, _v: false })

const DesignationProductEligibilitySchema = new Schema<IDesignationProductEligibility>(
  {
    id: { type: String, required: true, unique: true, index: true },
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, index: true },
    companyName: { type: String, required: true },
    designation: { type: String, required: true },
    gender: { type: String, enum: ['male', 'female', 'unisex'], default: 'unisex' }, // Gender filter
    allowedProductCategories: [{ type: String, required: true }], // Array of category names - kept for backward compatibility
    itemEligibility: {
      type: {
        shirt: ItemEligibilitySchema,
        trouser: ItemEligibilitySchema,
        pant: ItemEligibilitySchema, // Alias for trouser
        shoe: ItemEligibilitySchema,
        blazer: ItemEligibilitySchema,
        jacket: ItemEligibilitySchema, // Alias for blazer
      },
      required: false,
    },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
)

// Indexes for efficient queries
DesignationProductEligibilitySchema.index({ companyId: 1, designation: 1, gender: 1, status: 1 })
DesignationProductEligibilitySchema.index({ companyId: 1, designation: 1, status: 1 })
DesignationProductEligibilitySchema.index({ companyId: 1, status: 1 })
DesignationProductEligibilitySchema.index({ id: 1 })

// Encrypt sensitive fields before saving
DesignationProductEligibilitySchema.pre('save', function (next) {
  // Designation name might be considered sensitive
  const sensitiveFields: (keyof IDesignationProductEligibility)[] = ['designation']
  
  for (const field of sensitiveFields) {
    if (this[field] && typeof this[field] === 'string') {
      const value = this[field] as string
      if (value && !value.includes(':')) { // Only encrypt if not already encrypted
        this[field] = encrypt(value) as any
      }
    }
  }
  next()
})

// Decrypt sensitive fields after retrieving
// Note: This hook doesn't run with .lean(), so manual decryption is needed in data-access.ts
DesignationProductEligibilitySchema.post(['find', 'findOne', 'findOneAndUpdate'], function (docs) {
  if (!docs) return
  
  const documents = Array.isArray(docs) ? docs : [docs]
  const sensitiveFields: (keyof IDesignationProductEligibility)[] = ['designation']
  
  documents.forEach((doc: any) => {
    if (doc && typeof doc === 'object' && !doc.constructor || doc.constructor.name === 'model') {
      // Only decrypt if it's a Mongoose document (not a plain object from .lean())
      for (const field of sensitiveFields) {
        if (doc[field] && typeof doc[field] === 'string') {
          // Check if encrypted (contains ':')
          if (doc[field].includes(':')) {
            try {
              doc[field] = decrypt(doc[field])
            } catch (error) {
              console.warn(`Failed to decrypt field ${field}:`, error)
            }
          }
        }
      }
    }
  })
})

const DesignationProductEligibility = mongoose.models.DesignationProductEligibility || 
  mongoose.model<IDesignationProductEligibility>('DesignationProductEligibility', DesignationProductEligibilitySchema)

export default DesignationProductEligibility

