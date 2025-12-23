import mongoose, { Schema, Document } from 'mongoose'
// Encryption removed: Branch data is NOT employee PII, should not be encrypted

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
      // Note: unique: true automatically creates an index, so index: true is redundant
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

// Note: id, companyId, and adminId already have index: true in schema definitions
// BranchSchema.index({ id: 1 }) // REMOVED: Duplicate of id: { index: true }
// BranchSchema.index({ companyId: 1 }) // REMOVED: Duplicate of companyId: { index: true }
// BranchSchema.index({ adminId: 1 }) // REMOVED: Duplicate of adminId: { index: true }

// Encryption removed: Branch data is NOT employee PII
// Branch fields (address, phone, email) are stored and queried as plaintext

const Branch = mongoose.models.Branch || mongoose.model<IBranch>('Branch', BranchSchema)

export default Branch

