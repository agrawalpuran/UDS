'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { CheckCircle, XCircle, Clock, Package, User, Calendar } from 'lucide-react'
import { 
  getCompanyByAdminEmail, 
  isCompanyAdmin, 
  getPendingApprovals, 
  approveOrder,
  canApproveOrders
} from '@/lib/data-mongodb'

export default function CompanyApprovalsPage() {
  const [companyId, setCompanyId] = useState<string>('')
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [canApprove, setCanApprove] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadData = async () => {
        try {
          setLoading(true)
          const userEmail = localStorage.getItem('userEmail')
          if (!userEmail) {
            setAccessDenied(true)
            setLoading(false)
            return
          }

          const company = await getCompanyByAdminEmail(userEmail)
          if (!company) {
            setAccessDenied(true)
            setLoading(false)
            router.push('/login/company')
            return
          }

          const adminStatus = await isCompanyAdmin(userEmail, company.id)
          if (!adminStatus) {
            setAccessDenied(true)
            setLoading(false)
            router.push('/login/company')
            return
          }

          // Check if admin can approve orders
          const approvalPermission = await canApproveOrders(userEmail, company.id)
          setCanApprove(approvalPermission)

          setCompanyId(company.id)
          const orders = await getPendingApprovals(company.id)
          setPendingOrders(orders)
        } catch (error) {
          console.error('Error loading approvals:', error)
          setAccessDenied(true)
        } finally {
          setLoading(false)
        }
      }

      loadData()
    }
  }, [router])

  const handleApprove = async (orderId: string) => {
    if (!confirm('Are you sure you want to approve this order?')) {
      return
    }

    try {
      const userEmail = localStorage.getItem('userEmail')
      if (!userEmail) {
        alert('Error: User email not found')
        return
      }

      await approveOrder(orderId, userEmail)
      
      // Reload pending orders
      const orders = await getPendingApprovals(companyId)
      setPendingOrders(orders)
      
      alert('Order approved successfully!')
    } catch (error: any) {
      alert(`Error approving order: ${error.message}`)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Awaiting approval':
        return 'bg-yellow-100 text-yellow-800'
      case 'Awaiting fulfilment':
        return 'bg-blue-100 text-blue-800'
      case 'Dispatched':
        return 'bg-purple-100 text-purple-800'
      case 'Delivered':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <DashboardLayout actorType="company">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-600">Loading approvals...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (accessDenied) {
    return (
      <DashboardLayout actorType="company">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-red-600 font-semibold">Access Denied</p>
            <p className="text-gray-600 mt-2">You are not authorized to view this page.</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout actorType="company">
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Pending Approvals</h1>
          <p className="text-gray-600">
            {pendingOrders.length} order{pendingOrders.length !== 1 ? 's' : ''} awaiting approval
          </p>
          {!canApprove && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ⚠️ You do not have permission to approve orders. Contact your super admin to grant this privilege.
              </p>
            </div>
          )}
        </div>

        {pendingOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No pending approvals</p>
            <p className="text-gray-500 text-sm mt-2">All orders have been processed.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {pendingOrders.map((order) => (
              <div key={order.id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">Order #{order.id}</h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4" />
                        <span>{order.employeeName}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(order.orderDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  {canApprove && (
                    <button
                      onClick={() => handleApprove(order.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center space-x-2"
                    >
                      <CheckCircle className="h-5 w-5" />
                      <span>Approve Order</span>
                    </button>
                  )}
                </div>

                <div className="border-t pt-4 mt-4">
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center space-x-2">
                    <Package className="h-5 w-5" />
                    <span>Order Items</span>
                  </h4>
                  <div className="space-y-2">
                    {order.items?.map((item: any, index: number) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium text-gray-900">{item.uniformName}</p>
                          <p className="text-sm text-gray-600">
                            Size: {item.size} × Quantity: {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold text-gray-900">
                          ₹{(item.price * item.quantity).toFixed(2)}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t flex justify-between items-center">
                    <div>
                      <p className="text-sm text-gray-600">Delivery Address:</p>
                      <p className="text-gray-900 font-medium">{order.deliveryAddress}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Total Amount</p>
                      <p className="text-2xl font-bold text-gray-900">₹{order.total.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}




