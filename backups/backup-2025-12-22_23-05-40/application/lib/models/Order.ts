import mongoose, { Schema, Document } from 'mongoose'

export interface IOrderItem {
  uniformId: mongoose.Types.ObjectId
  productId: string // Numeric/string product ID for correlation
  uniformName: string
  size: string
  quantity: number
  price: number
}

export interface IOrder extends Document {
  id: string
  employeeId: mongoose.Types.ObjectId
  employeeIdNum: string // Numeric/string employee ID for correlation
  employeeName: string
  items: IOrderItem[]
  total: number
  status: 'Awaiting approval' | 'Awaiting fulfilment' | 'Dispatched' | 'Delivered'
  orderDate: Date
  dispatchLocation: string
  companyId: mongoose.Types.ObjectId
  companyIdNum: number // Numeric company ID for correlation
  deliveryAddress: string
  estimatedDeliveryTime: string
  parentOrderId?: string // ID of the parent order if this is a split order
  vendorId?: mongoose.Types.ObjectId // Vendor ID if this order is for a specific vendor
  vendorName?: string // Vendor name for display
  isPersonalPayment?: boolean // Whether this is a personal payment order (beyond eligibility)
  personalPaymentAmount?: number // Amount paid personally (if isPersonalPayment is true)
  orderType?: 'NORMAL' | 'REPLACEMENT' // Order type: NORMAL (default) or REPLACEMENT (for returns)
  returnRequestId?: string // Reference to return request if this is a replacement order
  createdAt?: Date
  updatedAt?: Date
}

const OrderItemSchema = new Schema<IOrderItem>({
  uniformId: {
    type: Schema.Types.ObjectId,
    ref: 'Uniform',
    required: true,
  },
  productId: {
    type: String,
    required: true,
    index: true,
  },
  uniformName: {
    type: String,
    required: true,
  },
  size: {
    type: String,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
})

const OrderSchema = new Schema<IOrder>(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      // Note: unique: true automatically creates an index, so index: true is redundant
    },
    // Note: employeeId doesn't need index: true because it's the first field in compound indexes below
    // MongoDB can use compound indexes for queries on just employeeId
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    employeeIdNum: {
      type: String,
      required: true,
      index: true,
    },
    employeeName: {
      type: String,
      required: true,
    },
    items: {
      type: [OrderItemSchema],
      required: true,
    },
    total: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['Awaiting approval', 'Awaiting fulfilment', 'Dispatched', 'Delivered'],
      default: 'Awaiting approval',
      index: true,
    },
    orderDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    dispatchLocation: {
      type: String,
      required: true,
    },
    companyId: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
      index: true,
    },
    companyIdNum: {
      type: Number,
      required: true,
      index: true,
    },
    deliveryAddress: {
      type: String,
      required: true,
    },
    estimatedDeliveryTime: {
      type: String,
      required: true,
    },
    parentOrderId: {
      type: String,
      index: true,
    },
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true, // vendorId is required for all orders
      index: true,
    },
    vendorName: {
      type: String,
    },
    isPersonalPayment: {
      type: Boolean,
      default: false,
    },
    personalPaymentAmount: {
      type: Number,
      default: 0,
    },
    orderType: {
      type: String,
      enum: ['NORMAL', 'REPLACEMENT'],
      default: 'NORMAL',
      index: true,
    },
    returnRequestId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
    strictPopulate: false, // Allow populating optional fields
  }
)

OrderSchema.index({ employeeId: 1, companyId: 1 })
OrderSchema.index({ employeeIdNum: 1, companyIdNum: 1 })
OrderSchema.index({ companyId: 1, status: 1 })
OrderSchema.index({ companyIdNum: 1, status: 1 })
OrderSchema.index({ orderDate: -1 })
// Note: id and vendorId already have index: true in schema definitions
// OrderSchema.index({ id: 1 }) // REMOVED: Duplicate of id: { index: true }
// OrderSchema.index({ vendorId: 1 }) // REMOVED: Duplicate of vendorId: { index: true }
OrderSchema.index({ parentOrderId: 1, vendorId: 1 }) // Compound index for split order queries

const Order = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema)

export default Order

