import mongoose, { Schema, Document } from 'mongoose'

export interface IOrderItem {
  uniformId: mongoose.Types.ObjectId
  uniformName: string
  size: string
  quantity: number
  price: number
}

export interface IOrder extends Document {
  id: string
  employeeId: mongoose.Types.ObjectId
  employeeName: string
  items: IOrderItem[]
  total: number
  status: 'Awaiting approval' | 'Awaiting fulfilment' | 'Dispatched' | 'Delivered'
  orderDate: Date
  dispatchLocation: string
  companyId: mongoose.Types.ObjectId
  deliveryAddress: string
  estimatedDeliveryTime: string
  createdAt?: Date
  updatedAt?: Date
}

const OrderItemSchema = new Schema<IOrderItem>({
  uniformId: {
    type: Schema.Types.ObjectId,
    ref: 'Uniform',
    required: true,
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
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
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
    deliveryAddress: {
      type: String,
      required: true,
    },
    estimatedDeliveryTime: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
)

OrderSchema.index({ employeeId: 1, companyId: 1 })
OrderSchema.index({ companyId: 1, status: 1 })
OrderSchema.index({ orderDate: -1 })
OrderSchema.index({ id: 1 })

const Order = mongoose.models.Order || mongoose.model<IOrder>('Order', OrderSchema)

export default Order

