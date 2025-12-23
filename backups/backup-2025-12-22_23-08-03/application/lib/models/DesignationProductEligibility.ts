import mongoose, { Schema, Document } from 'mongoose'
// Encryption removed: DesignationProductEligibility.designation is master data, not employee PII

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
    // Note: unique: true automatically creates an index, so index: true is redundant
    id: { type: String, required: true, unique: true },
    // Note: companyId doesn't need index: true because it's the first field in compound indexes below
    // MongoDB can use compound indexes for queries on just companyId
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
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
// Note: id field already has index: true in schema definition, so no need for explicit index here
// DesignationProductEligibilitySchema.index({ id: 1 }) // REMOVED: Duplicate of id: { index: true }

// Encryption removed: DesignationProductEligibility.designation is master/configuration data
// This field is stored and queried as plaintext for efficient matching with Employee.designation
// Note: Employee.designation remains encrypted (it's employee-specific PII)

const DesignationProductEligibility = mongoose.models.DesignationProductEligibility || 
  mongoose.model<IDesignationProductEligibility>('DesignationProductEligibility', DesignationProductEligibilitySchema)

export default DesignationProductEligibility

