'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import DashboardLayout from '@/components/DashboardLayout'
import { Users, ShoppingCart, DollarSign, TrendingUp, FileText, CheckCircle, IndianRupee } from 'lucide-react'
import { getEmployeesByCompany, getOrdersByCompany, getProductsByCompany, getCompanyByAdminEmail, isCompanyAdmin, getPendingApprovalCount, getPendingApprovals } from '@/lib/data-mongodb'

export default function CompanyDashboard() {
  const [companyId, setCompanyId] = useState<string>('')
  const [companyEmployees, setCompanyEmployees] = useState<any[]>([])
  const [companyOrders, setCompanyOrders] = useState<any[]>([])
  const [pendingApprovalCount, setPendingApprovalCount] = useState<number>(0)
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([])
  const [showTooltip, setShowTooltip] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [accessDenied, setAccessDenied] = useState(false)
  const router = useRouter()
  
  // Verify admin access and get company ID
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const verifyAccess = async () => {
        try {
          setLoading(true)
          const userEmail = localStorage.getItem('userEmail')
          if (!userEmail) {
            setAccessDenied(true)
            setLoading(false)
            return
          }

          // Get company by admin email
          const company = await getCompanyByAdminEmail(userEmail)
          if (!company) {
            setAccessDenied(true)
            setLoading(false)
            alert('Access denied: You are not authorized as a company admin. Please contact your super admin.')
            router.push('/login/company')
            return
          }

          // Verify admin status
          const adminStatus = await isCompanyAdmin(userEmail, company.id)
          if (!adminStatus) {
            setAccessDenied(true)
            setLoading(false)
            alert('Access denied: You are not authorized as a company admin.')
            router.push('/login/company')
            return
          }

          // Set company ID and load data
          setCompanyId(company.id)
          localStorage.setItem('companyId', company.id)
          
          // Filter employees by company - only show employees linked to this company
          const filtered = await getEmployeesByCompany(company.id)
          setCompanyEmployees(filtered)
          // Filter orders by company
          const orders = await getOrdersByCompany(company.id)
          console.log('Company Dashboard - Orders loaded:', orders.length, orders)
          if (orders.length > 0) {
            console.log('First order sample:', orders[0])
            console.log('First order total:', orders[0].total)
            console.log('First order items:', orders[0].items)
          }
          setCompanyOrders(orders)
          // Get pending approval count
          const pendingCount = await getPendingApprovalCount(company.id)
          setPendingApprovalCount(pendingCount)
          // Get pending approvals for tooltip
          const pending = await getPendingApprovals(company.id)
          setPendingApprovals(pending)
        } catch (error) {
          console.error('Error loading company data:', error)
          setAccessDenied(true)
          alert('Error verifying access. Please try logging in again.')
          router.push('/login/company')
        } finally {
          setLoading(false)
        }
      }
      
      verifyAccess()
    }
  }, [router])
  
  const activeEmployees = companyEmployees.filter(e => e.status === 'active').length
  const totalOrders = companyOrders.length
  // Calculate total spent - always calculate from items to ensure accuracy
  const totalSpent = companyOrders.reduce((sum, order) => {
    // Always calculate from items if available (more reliable)
    if (order.items && Array.isArray(order.items) && order.items.length > 0) {
      const calculatedTotal = order.items.reduce((itemSum: number, item: any) => {
        const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0
        const quantity = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0
        const itemTotal = price * quantity
        return itemSum + itemTotal
      }, 0)
      if (calculatedTotal > 0) {
        return sum + calculatedTotal
      }
    }
    // Fallback to order.total if items calculation fails
    if (order.total !== undefined && order.total !== null && typeof order.total === 'number' && !isNaN(order.total) && order.total > 0) {
      return sum + order.total
    }
    console.warn(`Order ${order.id}: Could not calculate total - total=${order.total}, items=${order.items?.length || 0}`)
    return sum
  }, 0)
  
  console.log('Total spent calculated:', totalSpent, 'from', companyOrders.length, 'orders')
  const pendingOrders = companyOrders.filter(o => o.status === 'pending' || o.status === 'confirmed').length

  const stats = [
    { name: 'Active Employees', value: activeEmployees, icon: Users, color: 'blue' },
    { name: 'Total Orders', value: totalOrders, icon: ShoppingCart, color: 'purple' },
    { name: 'Total Spent', value: `₹${totalSpent.toFixed(2)}`, icon: IndianRupee, color: 'green' },
    { name: 'Pending Approvals', value: pendingApprovalCount, icon: CheckCircle, color: 'orange' },
  ]

  if (loading) {
    return (
      <DashboardLayout actorType="company">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-gray-600">Verifying access...</p>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (accessDenied) {
    return (
      <DashboardLayout actorType="company">
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
            <h2 className="text-2xl font-bold text-red-900 mb-4">Access Denied</h2>
            <p className="text-red-700 mb-4">
              You are not authorized to access the company portal. Only assigned company administrators can log in.
            </p>
            <button
              onClick={() => router.push('/login/company')}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
            >
              Back to Login
            </button>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout actorType="company">
      <div>
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 via-purple-900 to-slate-900 bg-clip-text text-transparent mb-2">
            Company Dashboard
          </h1>
          <p className="text-slate-600">Welcome back! Here's what's happening with your company.</p>
        </div>
        
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon
            const getColorClasses = (color: string) => {
              const colors: Record<string, { bg: string; text: string }> = {
                blue: { bg: 'bg-blue-100', text: 'text-blue-600' },
                purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
                green: { bg: 'bg-green-100', text: 'text-green-600' },
                orange: { bg: 'bg-orange-100', text: 'text-orange-600' },
              }
              return colors[color] || colors.blue
            }
            const colorClasses = getColorClasses(stat.color)
            
            // Determine if card is clickable and get link
            let isClickable = false
            let linkHref = ''
            if (stat.name === 'Active Employees' && activeEmployees > 0) {
              isClickable = true
              linkHref = '/dashboard/company/employees'
            } else if (stat.name === 'Total Orders' && totalOrders > 0) {
              isClickable = true
              linkHref = '/dashboard/company/orders'
            } else if (stat.name === 'Total Spent' && totalSpent > 0) {
              isClickable = true
              linkHref = '/dashboard/company/reports'
            } else if (stat.name === 'Pending Approvals' && pendingApprovalCount > 0) {
              isClickable = true
              linkHref = '/dashboard/company/approvals'
            }
            
            // Get unique employees from pending approvals
            const getUniqueEmployees = () => {
              const employeeMap = new Map()
              pendingApprovals.forEach((order: any) => {
                if (order.employeeId) {
                  const empId = order.employeeId.id || order.employeeId
                  if (!employeeMap.has(empId)) {
                    employeeMap.set(empId, {
                      name: order.employeeName || 
                            (order.employeeId?.firstName && order.employeeId?.lastName 
                              ? `${order.employeeId.firstName} ${order.employeeId.lastName}` 
                              : 'Unknown'),
                      email: order.employeeId?.email || 'N/A',
                      employeeId: order.employeeId?.employeeId || 'N/A',
                      orderCount: 0
                    })
                  }
                  employeeMap.get(empId).orderCount++
                }
              })
              return Array.from(employeeMap.values())
            }
            
            // Get active employees list
            const getActiveEmployeesList = () => {
              return companyEmployees
                .filter(e => e.status === 'active')
                .slice(0, 10)
                .map(emp => ({
                  name: `${emp.firstName} ${emp.lastName}`,
                  employeeId: emp.employeeId || 'N/A',
                  email: emp.email || 'N/A',
                  designation: emp.designation || 'N/A'
                }))
            }
            
            // Get recent orders
            const getRecentOrders = () => {
              return companyOrders
                .slice(0, 10)
                .map(order => ({
                  id: order.id,
                  employeeName: order.employeeName || 'Unknown',
                  total: order.items && Array.isArray(order.items) && order.items.length > 0
                    ? order.items.reduce((sum: number, item: any) => {
                        const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0
                        const quantity = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0
                        return sum + (price * quantity)
                      }, 0)
                    : (order.total || 0),
                  status: order.status || 'Unknown',
                  date: order.orderDate ? new Date(order.orderDate).toLocaleDateString() : 'N/A'
                }))
            }
            
            // Get spending breakdown
            const getSpendingBreakdown = () => {
              const statusBreakdown = companyOrders.reduce((acc: any, order: any) => {
                const orderTotal = order.items && Array.isArray(order.items) && order.items.length > 0
                  ? order.items.reduce((sum: number, item: any) => {
                      const price = typeof item.price === 'number' ? item.price : parseFloat(item.price) || 0
                      const quantity = typeof item.quantity === 'number' ? item.quantity : parseInt(item.quantity) || 0
                      return sum + (price * quantity)
                    }, 0)
                  : (order.total || 0)
                
                const status = order.status || 'Unknown'
                if (!acc[status]) {
                  acc[status] = { count: 0, total: 0 }
                }
                acc[status].count++
                acc[status].total += orderTotal
                return acc
              }, {})
              
              return Object.entries(statusBreakdown).map(([status, data]: [string, any]) => ({
                status,
                count: data.count,
                total: data.total
              }))
            }
            
            const StatCard = (
              <div 
                className={`glass rounded-2xl shadow-modern-lg p-6 border border-slate-200/50 ${isClickable ? 'cursor-pointer hover-lift' : ''} transition-smooth`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-500 text-sm font-medium mb-2">{stat.name}</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">{stat.value}</p>
                  </div>
                  <div className={`${colorClasses.bg} p-4 rounded-xl shadow-modern`}>
                    <Icon className={`h-6 w-6 ${colorClasses.text}`} />
                  </div>
                </div>
              </div>
            )
            
            // Render tooltip based on stat type
            const renderTooltip = () => {
              if (showTooltip !== stat.name) return null
              
              if (stat.name === 'Pending Approvals' && pendingApprovals.length > 0) {
                return (
                  <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none">
                    <div className="text-sm font-semibold mb-3 pb-2 border-b border-gray-700">
                      Pending Approvals - Employee Details
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {getUniqueEmployees().map((emp: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="font-semibold text-white mb-1">{emp.name}</div>
                          <div className="text-gray-300">ID: {emp.employeeId}</div>
                          <div className="text-gray-300">Email: {emp.email}</div>
                          <div className="text-gray-400 mt-1">
                            {emp.orderCount} order{emp.orderCount > 1 ? 's' : ''} pending
                          </div>
                          {idx < getUniqueEmployees().length - 1 && (
                            <div className="border-t border-gray-700 mt-2 pt-2"></div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )
              }
              
              if (stat.name === 'Active Employees' && activeEmployees > 0) {
                const employees = getActiveEmployeesList()
                return (
                  <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none">
                    <div className="text-sm font-semibold mb-3 pb-2 border-b border-gray-700">
                      Active Employees ({activeEmployees} total)
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {employees.map((emp: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="font-semibold text-white mb-1">{emp.name}</div>
                          <div className="text-gray-300">ID: {emp.employeeId}</div>
                          <div className="text-gray-300">Email: {emp.email}</div>
                          <div className="text-gray-300">Designation: {emp.designation}</div>
                          {idx < employees.length - 1 && (
                            <div className="border-t border-gray-700 mt-2 pt-2"></div>
                          )}
                        </div>
                      ))}
                      {activeEmployees > 10 && (
                        <div className="text-gray-400 text-xs mt-2 pt-2 border-t border-gray-700">
                          +{activeEmployees - 10} more employees
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              
              if (stat.name === 'Total Orders' && totalOrders > 0) {
                const orders = getRecentOrders()
                return (
                  <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none">
                    <div className="text-sm font-semibold mb-3 pb-2 border-b border-gray-700">
                      Recent Orders ({totalOrders} total)
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {orders.map((order: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="font-semibold text-white mb-1">Order #{order.id}</div>
                          <div className="text-gray-300">Employee: {order.employeeName}</div>
                          <div className="text-gray-300">Amount: ₹{order.total.toFixed(2)}</div>
                          <div className="text-gray-300">Status: {order.status}</div>
                          <div className="text-gray-400">Date: {order.date}</div>
                          {idx < orders.length - 1 && (
                            <div className="border-t border-gray-700 mt-2 pt-2"></div>
                          )}
                        </div>
                      ))}
                      {totalOrders > 10 && (
                        <div className="text-gray-400 text-xs mt-2 pt-2 border-t border-gray-700">
                          +{totalOrders - 10} more orders
                        </div>
                      )}
                    </div>
                  </div>
                )
              }
              
              if (stat.name === 'Total Spent' && totalSpent > 0) {
                const breakdown = getSpendingBreakdown()
                return (
                  <div className="absolute z-50 left-0 top-full mt-2 w-80 bg-gray-900 text-white rounded-lg shadow-2xl p-4 pointer-events-none">
                    <div className="text-sm font-semibold mb-3 pb-2 border-b border-gray-700">
                      Spending Breakdown
                    </div>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {breakdown.map((item: any, idx: number) => (
                        <div key={idx} className="text-xs">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-semibold text-white">{item.status}</span>
                            <span className="text-gray-300">₹{item.total.toFixed(2)}</span>
                          </div>
                          <div className="text-gray-400">{item.count} order{item.count > 1 ? 's' : ''}</div>
                          {idx < breakdown.length - 1 && (
                            <div className="border-t border-gray-700 mt-2 pt-2"></div>
                          )}
                        </div>
                      ))}
                      <div className="border-t border-gray-700 mt-3 pt-3">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-white">Total</span>
                          <span className="font-bold text-white text-sm">₹{totalSpent.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
              
              return null
            }
            
            if (isClickable) {
              return (
                <div 
                  key={stat.name} 
                  className="relative"
                  onMouseEnter={() => setShowTooltip(stat.name)}
                  onMouseLeave={() => setShowTooltip(null)}
                >
                  <Link href={linkHref} className="block">
                    {StatCard}
                  </Link>
                  {renderTooltip()}
                </div>
              )
            }
            
            return (
              <div key={stat.name}>
                {StatCard}
              </div>
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="glass rounded-2xl shadow-modern-lg p-6 border border-slate-200/50">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <button className="w-full gradient-purple text-white py-3 rounded-xl font-semibold hover:shadow-glow-purple transition-smooth hover-lift">
                Upload Employee Data
              </button>
              <Link
                href="/dashboard/company/employees"
                className="w-full gradient-primary text-white py-3 rounded-xl font-semibold hover:shadow-glow transition-smooth hover-lift text-center block"
              >
                Place Bulk Order
              </Link>
              <button className="w-full gradient-green text-white py-3 rounded-xl font-semibold hover:shadow-modern-lg transition-smooth hover-lift">
                Generate Report
              </button>
            </div>
          </div>

          <div className="glass rounded-2xl shadow-modern-lg p-6 border border-slate-200/50">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {companyOrders.slice(0, 3).map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-slate-100/50 transition-smooth">
                  <div>
                    <p className="font-semibold text-slate-900">{order.employeeName}</p>
                    <p className="text-sm text-slate-600">Order #{order.id}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    order.status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {order.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Employee Overview */}
        <div className="glass rounded-2xl shadow-modern-lg p-6 border border-slate-200/50">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Employee Overview</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Employee ID</th>
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Name</th>
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Designation</th>
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Location</th>
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Email</th>
                  <th className="text-left py-3 px-4 text-gray-700 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {companyEmployees.slice(0, 10).map((employee) => (
                  <tr key={employee.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <span className="font-mono text-sm font-semibold text-blue-600">
                        {employee.employeeId || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-gray-900 font-medium">{employee.firstName} {employee.lastName}</td>
                    <td className="py-3 px-4 text-gray-600">{employee.designation}</td>
                    <td className="py-3 px-4 text-gray-600">{employee.location}</td>
                    <td className="py-3 px-4 text-gray-600">{employee.email}</td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        employee.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {employee.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}

