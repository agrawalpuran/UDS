import mongoose, { Schema, Document } from 'mongoose'

// Product-Company relationship (many-to-many)
export interface IProductCompany extends Document {
  productId: mongoose.Types.ObjectId
  companyId: mongoose.Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
}

const ProductCompanySchema = new Schema<IProductCompany>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Uniform',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Compound index to ensure uniqueness
ProductCompanySchema.index({ productId: 1, companyId: 1 }, { unique: true })

// Product-Vendor relationship (many-to-many)
export interface IProductVendor extends Document {
  productId: mongoose.Types.ObjectId
  vendorId: mongoose.Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
}

const ProductVendorSchema = new Schema<IProductVendor>(
  {
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Uniform',
      required: true,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

ProductVendorSchema.index({ productId: 1, vendorId: 1 }, { unique: true })

// Vendor-Company relationship (many-to-many)
export interface IVendorCompany extends Document {
  vendorId: mongoose.Types.ObjectId
  companyId: mongoose.Types.ObjectId
  createdAt?: Date
  updatedAt?: Date
}

const VendorCompanySchema = new Schema<IVendorCompany>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
      index: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

VendorCompanySchema.index({ vendorId: 1, companyId: 1 }, { unique: true })

export const ProductCompany = mongoose.models.ProductCompany || mongoose.model<IProductCompany>('ProductCompany', ProductCompanySchema)
export const ProductVendor = mongoose.models.ProductVendor || mongoose.model<IProductVendor>('ProductVendor', ProductVendorSchema)
export const VendorCompany = mongoose.models.VendorCompany || mongoose.model<IVendorCompany>('VendorCompany', VendorCompanySchema)




