'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import DashboardLayout from '@/components/DashboardLayout'
import { CheckCircle, XCircle, Clock, Package, User, Calendar, ShoppingBag } from 'lucide-react'
import { 
  getCompanyByAdminEmail, 
  isCompanyAdmin, 
  getPendingApprovals, 
  approveOrder,
  bulkApproveOrders,
  canApproveOrders,
  getCompanyById
} from '@/lib/data-mongodb'
import { maskEmployeeName, maskAddress } from '@/lib/utils/data-masking'

export default function CompanyApprovalsPage() {
  const [companyId, setCompanyId] = useState<string>('')
  const [pendingOrders, setPendingOrders] = useState<any[]>([])
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const [canApprove, setCanApprove] = useState(false)
  const [bulkApproving, setBulkApproving] = useState(false)
  const [companyPrimaryColor, setCompanyPrimaryColor] = useState<string>('#f76b1c')
  const [companySecondaryColor, setCompanySecondaryColor] = useState<string>('#f76b1c')
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
          
          // Fetch company colors
          const companyDetails = await getCompanyById(company.id)
          if (companyDetails) {
            setCompanyPrimaryColor(companyDetails.primaryColor || '#f76b1c')
            setCompanySecondaryColor(companyDetails.secondaryColor || companyDetails.primaryColor || '#f76b1c')
          }
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

      // If it's a split order, approve all split orders
      const order = pendingOrders.find(o => o.id === orderId)
      const orderIdsToApprove = order?.isSplitOrder && order?.splitOrderIds 
        ? order.splitOrderIds 
        : [orderId]

      if (orderIdsToApprove.length > 1) {
        // Bulk approve split orders
        const result = await bulkApproveOrders(orderIdsToApprove, userEmail)
        if (result.failed.length > 0) {
          alert(`Some orders failed to approve:\n${result.failed.map(f => `${f.orderId}: ${f.error}`).join('\n')}`)
        } else {
          alert(`Order approved successfully! (${result.success.length} sub-orders)`)
        }
      } else {
        // Single order approval
        await approveOrder(orderId, userEmail)
        alert('Order approved successfully!')
      }
      
      // Reload pending orders
      const orders = await getPendingApprovals(companyId)
      setPendingOrders(orders)
      setSelectedOrders(new Set())
    } catch (error: any) {
      alert(`Error approving order: ${error.message}`)
    }
  }

  const handleToggleSelect = (orderId: string) => {
    const newSelected = new Set(selectedOrders)
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId)
    } else {
      newSelected.add(orderId)
    }
    setSelectedOrders(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedOrders.size === pendingOrders.length) {
      setSelectedOrders(new Set())
    } else {
      setSelectedOrders(new Set(pendingOrders.map(o => o.id)))
    }
  }

  const handleBulkApprove = async () => {
    if (selectedOrders.size === 0) {
      alert('Please select at least one order to approve')
      return
    }

    if (!confirm(`Are you sure you want to approve ${selectedOrders.size} order(s)?`)) {
      return
    }

    try {
      setBulkApproving(true)
      const userEmail = localStorage.getItem('userEmail')
      if (!userEmail) {
        alert('Error: User email not found')
        return
      }

      // Collect all order IDs to approve (including split orders)
      const orderIdsToApprove: string[] = []
      for (const orderId of Array.from(selectedOrders)) {
        const order = pendingOrders.find(o => o.id === orderId)
        if (order?.isSplitOrder && order?.splitOrderIds) {
          orderIdsToApprove.push(...order.splitOrderIds)
        } else {
          orderIdsToApprove.push(orderId)
        }
      }

      const result = await bulkApproveOrders(orderIdsToApprove, userEmail)
      
      if (result.failed.length > 0) {
        alert(`Approved ${result.success.length} order(s). Some failed:\n${result.failed.map(f => `${f.orderId}: ${f.error}`).join('\n')}`)
      } else {
        alert(`Successfully approved ${result.success.length} order(s)!`)
      }
      
      // Reload pending orders
      const orders = await getPendingApprovals(companyId)
      setPendingOrders(orders)
      setSelectedOrders(new Set())
    } catch (error: any) {
      alert(`Error bulk approving orders: ${error.message}`)
    } finally {
      setBulkApproving(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Awaiting approval':
        return { bg: 'bg-yellow-100', text: 'text-yellow-800' }
      case 'Awaiting fulfilment':
        return { bg: `${companyPrimaryColor || '#f76b1c'}20`, text: companyPrimaryColor || '#f76b1c' }
      case 'Dispatched':
        return { bg: `${companySecondaryColor || '#f76b1c'}20`, text: companySecondaryColor || '#f76b1c' }
      case 'Delivered':
        return { bg: 'bg-green-100', text: 'text-green-800' }
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-800' }
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
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Pending Approvals</h1>
              <p className="text-gray-600">
                {pendingOrders.length} order{pendingOrders.length !== 1 ? 's' : ''} awaiting approval
              </p>
            </div>
            {canApprove && pendingOrders.length > 0 && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selectedOrders.size === pendingOrders.length ? 'Deselect All' : 'Select All'}
                </button>
                <button
                  onClick={handleBulkApprove}
                  disabled={selectedOrders.size === 0 || bulkApproving}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <CheckCircle className="h-5 w-5" />
                  <span>{bulkApproving ? 'Approving...' : `Approve Selected (${selectedOrders.size})`}</span>
                </button>
              </div>
            )}
          </div>
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
                  <div className="flex items-start space-x-3 flex-1">
                    {canApprove && (
                      <input
                        type="checkbox"
                        checked={selectedOrders.has(order.id)}
                        onChange={() => handleToggleSelect(order.id)}
                        className="mt-1 h-5 w-5 text-green-600 rounded border-gray-300 focus:ring-green-500"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">Order #{order.id}</h3>
                        <span 
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status).bg.includes('bg-') ? getStatusColor(order.status).bg : ''} ${getStatusColor(order.status).text.includes('text-') ? getStatusColor(order.status).text : ''}`}
                          style={{ 
                            backgroundColor: !getStatusColor(order.status).bg.includes('bg-') 
                              ? getStatusColor(order.status).bg 
                              : undefined,
                            color: !getStatusColor(order.status).text.includes('text-')
                              ? getStatusColor(order.status).text
                              : undefined
                          }}
                        >
                          {order.status}
                        </span>
                        {order.isSplitOrder && (
                          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 flex items-center space-x-1">
                            <ShoppingBag className="h-3 w-3" />
                            <span>{order.vendorCount} Vendor{order.vendorCount !== 1 ? 's' : ''}</span>
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-4 text-sm text-gray-600">
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4" />
                          <span>{maskEmployeeName(order.employeeName || 'N/A')}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(order.orderDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {order.isSplitOrder && order.vendors && order.vendors.length > 0 && (
                        <div className="mt-2 text-sm text-gray-600">
                          <span className="font-medium">Vendors: </span>
                          <span>{order.vendors.join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {canApprove && (
                    <button
                      onClick={() => handleApprove(order.id)}
                      className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center space-x-2 ml-3"
                    >
                      <CheckCircle className="h-5 w-5" />
                      <span>Approve</span>
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
                      <p className="text-gray-900 font-medium">{maskAddress(order.deliveryAddress || 'N/A')}</p>
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





