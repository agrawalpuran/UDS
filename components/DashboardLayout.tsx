'use client'

import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, Package, Users, FileText, BarChart3, 
  Settings, LogOut, MapPin, ShoppingCart, Upload, Shield, Warehouse, MessageSquare, Menu, X, RefreshCw
} from 'lucide-react'
import { mockEmployees, mockCompanies, getVendorById, getCompanyById, getEmployeeByEmail } from '@/lib/data'
import { getCompanyById as getCompanyByIdAPI, getBranchByAdminEmail, getCompanyByAdminEmail, getLocationByAdminEmail, getEmployeeByEmail as getEmployeeByEmailAPI, getVendorById as getVendorByIdAPI } from '@/lib/data-mongodb'
import Image from 'next/image'

interface DashboardLayoutProps {
  children: ReactNode
  actorType: 'vendor' | 'company' | 'consumer' | 'superadmin'
}

export default function DashboardLayout({ children, actorType }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [currentCompany, setCurrentCompany] = useState<any>(null)
  const [currentVendor, setCurrentVendor] = useState<any>(null)
  const [currentEmployee, setCurrentEmployee] = useState<any>(null)
  const [isBranchAdmin, setIsBranchAdmin] = useState<boolean>(false)
  const [isLocationAdmin, setIsLocationAdmin] = useState<boolean>(false)
  const [isCompanyAdmin, setIsCompanyAdmin] = useState<boolean>(false)
  const [canLocationAdminViewFeedback, setCanLocationAdminViewFeedback] = useState<boolean>(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false)
  const [approvalCounts, setApprovalCounts] = useState<{
    pendingOrderApprovals?: number
    pendingReturnRequests?: number
    pendingOrders?: number
    pendingReplacementOrders?: number
  }>({})
  const [currentLocation, setCurrentLocation] = useState<any>(null)

  useEffect(() => {
    // Use tab-specific authentication storage
    const loadAuthData = async () => {
      const { getUserEmail, getCompanyId, getVendorId } = await import('@/lib/utils/auth-storage')
      
      if (actorType === 'consumer') {
        // Get current employee from tab-specific storage
        const userEmail = getUserEmail('consumer') || (typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null)
        if (userEmail) {
          // Check if user is Location Admin and get employee
          Promise.all([
            getLocationByAdminEmail(userEmail),
            getEmployeeByEmailAPI(userEmail)
          ]).then(([location, employee]) => {
            setIsLocationAdmin(!!location)
            
            if (employee) {
              setCurrentEmployee(employee)
              // Get company for employee
              const companyId = typeof employee.companyId === 'object' && employee.companyId?.id 
                ? employee.companyId.id 
                : employee.companyId
              if (companyId) {
                getCompanyByIdAPI(companyId)
                  .then(company => {
                    if (company) {
                      setCurrentCompany(company)
                      // Check if Location Admin can view feedback
                      if (location && company.allowLocationAdminViewFeedback) {
                        setCanLocationAdminViewFeedback(true)
                        console.log('[DashboardLayout] Consumer: Location Admin can view feedback - setting enabled')
                      } else {
                        setCanLocationAdminViewFeedback(false)
                      }
                    } else {
                      const mockCompany = getCompanyById(companyId)
                      setCurrentCompany(mockCompany || null)
                      setCanLocationAdminViewFeedback(false)
                    }
                  })
                  .catch(() => {
                    const mockCompany = getCompanyById(companyId)
                    setCurrentCompany(mockCompany || null)
                    setCanLocationAdminViewFeedback(false)
                  })
              }
            } else {
              // Fallback to mock data
              const mockEmployee = getEmployeeByEmail(userEmail) || mockEmployees[0] || null
              setCurrentEmployee(mockEmployee)
              if (mockEmployee?.companyId) {
                const company = getCompanyById(mockEmployee.companyId)
                setCurrentCompany(company || null)
              }
              setCanLocationAdminViewFeedback(false)
            }
          })
          .catch(() => {
            // Fallback to mock data on error
            const mockEmployee = getEmployeeByEmail(userEmail) || mockEmployees[0] || null
            setCurrentEmployee(mockEmployee)
            if (mockEmployee?.companyId) {
              const company = getCompanyById(mockEmployee.companyId)
              setCurrentCompany(company || null)
            }
            setCanLocationAdminViewFeedback(false)
          })
        } else {
          // No email, use mock data
          const mockEmployee = mockEmployees[0] || null
          setCurrentEmployee(mockEmployee)
          if (mockEmployee?.companyId) {
            const company = getCompanyById(mockEmployee.companyId)
            setCurrentCompany(company || null)
          }
          setCanLocationAdminViewFeedback(false)
        }
      } else if (actorType === 'company') {
        // Get company from tab-specific storage
        const companyId = getCompanyId() || (typeof window !== 'undefined' ? localStorage.getItem('companyId') : null)
        const userEmail = getUserEmail('company') || (typeof window !== 'undefined' ? localStorage.getItem('email') : null)
        
        // Check if user is Branch Admin, Location Admin, or Company Admin
        if (userEmail) {
          Promise.all([
            getBranchByAdminEmail(userEmail),
            getLocationByAdminEmail(userEmail),
            getCompanyByAdminEmail(userEmail)
          ]).then(([branch, location, company]) => {
            setIsBranchAdmin(!!branch)
            setIsLocationAdmin(!!location)
            setIsCompanyAdmin(!!company)
            setCurrentLocation(location) // Store location for approval counts
            
            // If Branch Admin, use branch's company; if Location Admin, use location's company; otherwise use companyId
            const targetCompanyId = branch?.companyId?.id || branch?.companyId || location?.companyId?.id || location?.companyId || companyId || company?.id
            
            if (targetCompanyId) {
              // Fetch company from API to get latest branding
              getCompanyByIdAPI(targetCompanyId)
                .then(companyData => {
                  if (companyData) {
                    setCurrentCompany(companyData)
                  } else {
                    // Fallback to mock data
                    const mockCompany = getCompanyById(targetCompanyId)
                    setCurrentCompany(mockCompany || mockCompanies[0] || null)
                  }
                })
                .catch(() => {
                  // Fallback to mock data on error
                  const mockCompany = getCompanyById(targetCompanyId)
                  setCurrentCompany(mockCompany || mockCompanies[0] || null)
                })
            } else {
              setCurrentCompany(mockCompanies[0] || null)
            }
          }).catch(() => {
            // On error, fall back to companyId-based lookup
            if (companyId) {
              getCompanyByIdAPI(companyId)
                .then(company => {
                  if (company) {
                    setCurrentCompany(company)
                  } else {
                    const mockCompany = getCompanyById(companyId)
                    setCurrentCompany(mockCompany || mockCompanies[0] || null)
                  }
                })
                .catch(() => {
                  const mockCompany = getCompanyById(companyId)
                  setCurrentCompany(mockCompany || mockCompanies[0] || null)
                })
            } else {
              setCurrentCompany(mockCompanies[0] || null)
            }
          })
        } else if (companyId) {
          // Fetch company from API to get latest branding
          getCompanyByIdAPI(companyId)
            .then(company => {
              if (company) {
                setCurrentCompany(company)
              } else {
                // Fallback to mock data
                const mockCompany = getCompanyById(companyId)
                setCurrentCompany(mockCompany || mockCompanies[0] || null)
              }
            })
            .catch(() => {
              // Fallback to mock data on error
              const mockCompany = getCompanyById(companyId)
              setCurrentCompany(mockCompany || mockCompanies[0] || null)
            })
        } else {
          setCurrentCompany(mockCompanies[0] || null)
        }
      } else if (actorType === 'vendor') {
        // Get vendor from tab-specific storage
        const vendorId = getVendorId() || (typeof window !== 'undefined' ? localStorage.getItem('vendorId') : null)
        if (vendorId) {
          // Try to fetch vendor from API first
          getVendorByIdAPI(vendorId)
            .then(vendor => {
              if (vendor) {
                setCurrentVendor(vendor)
              } else {
                // Fallback to mock data
                const mockVendor = getVendorById(vendorId)
                setCurrentVendor(mockVendor || null)
              }
            })
            .catch(() => {
              // Fallback to mock data on error
              const mockVendor = getVendorById(vendorId)
              setCurrentVendor(mockVendor || null)
            })
        } else {
          // Fallback: try default vendor ID
          getVendorByIdAPI('VEND-001')
            .then(vendor => {
              if (vendor) {
                setCurrentVendor(vendor)
              } else {
                const mockVendor = getVendorById('VEND-001')
                setCurrentVendor(mockVendor || null)
              }
            })
            .catch(() => {
              const mockVendor = getVendorById('VEND-001')
              setCurrentVendor(mockVendor || null)
            })
        }
      }
    }
    
    loadAuthData()
  }, [actorType])

  // Fetch approval counts when company/vendor/location is loaded
  useEffect(() => {
    const fetchApprovalCounts = async () => {
      try {
        if (actorType === 'company' && currentCompany?.id) {
          if (isLocationAdmin && currentLocation?.id) {
            // For location admin, get order approvals for their location
            const response = await fetch(`/api/approvals/counts?locationId=${encodeURIComponent(currentLocation.id)}&role=location`)
            if (response.ok) {
              const counts = await response.json()
              setApprovalCounts(counts)
            }
          } else if (isCompanyAdmin) {
            // For company admin, get both order approvals and return requests
            const response = await fetch(`/api/approvals/counts?companyId=${encodeURIComponent(currentCompany.id)}&role=company`)
            if (response.ok) {
              const counts = await response.json()
              setApprovalCounts(counts)
            }
          }
        } else if (actorType === 'vendor' && currentVendor?.id) {
          // For vendor, get pending orders and replacement orders
          const response = await fetch(`/api/approvals/counts?vendorId=${encodeURIComponent(currentVendor.id)}&role=vendor`)
          if (response.ok) {
            const counts = await response.json()
            setApprovalCounts(counts)
          }
        }
      } catch (error) {
        console.error('Error fetching approval counts:', error)
      }
    }

    fetchApprovalCounts()
    
    // Refresh counts when pathname changes (user navigates) or every 30 seconds
    const interval = setInterval(fetchApprovalCounts, 30000) // Refresh every 30 seconds
    
    return () => clearInterval(interval)
  }, [actorType, currentCompany?.id, currentVendor?.id, currentLocation?.id, isLocationAdmin, isCompanyAdmin, pathname])

  const vendorMenu = [
    { name: 'Dashboard', href: '/dashboard/vendor', icon: LayoutDashboard },
    { name: 'Catalog', href: '/dashboard/vendor/catalog', icon: Package },
    { name: 'Inventory', href: '/dashboard/vendor/inventory', icon: Package },
    { name: 'Orders', href: '/dashboard/vendor/orders', icon: ShoppingCart },
    { name: 'Replacement Orders', href: '/dashboard/vendor/replacement-orders', icon: RefreshCw },
    { name: 'Feedback', href: '/dashboard/vendor/feedback', icon: MessageSquare },
    { name: 'Reports', href: '/dashboard/vendor/reports', icon: BarChart3 },
  ]

  // Base company menu items (available to all company users)
  const baseCompanyMenu = [
    { name: 'Dashboard', href: '/dashboard/company', icon: LayoutDashboard },
    { name: 'Employees', href: '/dashboard/company/employees', icon: Users },
    { name: 'Catalog', href: '/dashboard/company/catalog', icon: Package },
    { name: 'Orders', href: '/dashboard/company/orders', icon: ShoppingCart },
    { name: 'Feedback', href: '/dashboard/company/feedback', icon: MessageSquare },
    { name: 'Return Requests', href: '/dashboard/company/returns', icon: RefreshCw },
  ]

  // Company Admin only menu items
  const companyAdminMenu = [
    { name: 'Approvals', href: '/dashboard/company/approvals', icon: FileText },
    { name: 'Designation Eligibility', href: '/dashboard/company/designation-eligibility', icon: Shield },
    { name: 'Locations', href: '/dashboard/company/locations', icon: MapPin },
    { name: 'Vendor Stock', href: '/dashboard/company/vendor-stock', icon: Warehouse },
    { name: 'Reports', href: '/dashboard/company/reports', icon: BarChart3 },
    { name: 'Settings', href: '/dashboard/company/settings', icon: Settings },
  ]

  // Bulk Upload menu (available to Company Admin, Location Admin, and Branch Admin)
  const bulkUploadMenu = [
    { name: 'Batch Upload', href: '/dashboard/company/batch-upload', icon: Upload },
  ]

  // Build company menu based on role
  const companyMenu = [
    ...baseCompanyMenu,
    ...(isCompanyAdmin ? companyAdminMenu : []),
    ...((isCompanyAdmin || isLocationAdmin || isBranchAdmin) ? bulkUploadMenu : []),
  ]

  // Base consumer menu items
  const baseConsumerMenu = [
    { name: 'Dashboard', href: '/dashboard/consumer', icon: LayoutDashboard },
    { name: 'Catalog', href: '/dashboard/consumer/catalog', icon: Package },
    { name: 'My Orders', href: '/dashboard/consumer/orders', icon: ShoppingCart },
    { name: 'Profile', href: '/dashboard/consumer/profile', icon: Settings },
  ]
  
  // Consumer menu with optional Feedback for Location Admins
  const consumerMenu = [
    ...baseConsumerMenu,
    // Add Feedback for Location Admins when setting is enabled
    ...(isLocationAdmin && canLocationAdminViewFeedback ? [
      { name: 'Feedback', href: '/dashboard/consumer/feedback', icon: MessageSquare }
    ] : [])
  ]

  const superAdminMenu = [
    { name: 'Super Admin', href: '/dashboard/superadmin', icon: LayoutDashboard },
  ]

  const menu = actorType === 'vendor' ? vendorMenu 
    : actorType === 'company' ? companyMenu 
    : actorType === 'superadmin' ? superAdminMenu
    : consumerMenu

  const getActorName = () => {
    if (actorType === 'vendor') return 'Vendor Portal'
    if (actorType === 'company') return 'Company Portal'
    if (actorType === 'superadmin') return 'Super Admin Portal'
    return 'Employee Portal'
  }

  const getActorColor = () => {
    if (actorType === 'vendor') {
      return currentVendor?.primaryColor || '#2563eb'
    }
    if (actorType === 'company') {
      return currentCompany?.primaryColor || '#f76b1c'
    }
    return 'green'
  }

  const getHeaderColor = () => {
    if (actorType === 'vendor') {
      return currentVendor?.primaryColor || '#2563eb'
    }
    if (actorType === 'company') {
      return currentCompany?.primaryColor || '#f76b1c'
    }
    if (actorType === 'superadmin') return 'bg-red-600'
    return 'bg-[#f76b1c]'
  }
  
  const getHeaderStyle = () => {
    // Use ServiceNow Infinite Blue as default
    const servicenowBlue = '#032D42'
    
    if (actorType === 'vendor' && currentVendor) {
      return {
        backgroundColor: currentVendor.primaryColor || servicenowBlue,
        color: 'white'
      }
    }
    if (actorType === 'company' && currentCompany) {
      return {
        backgroundColor: currentCompany.primaryColor || servicenowBlue,
        color: 'white'
      }
    }
    if (actorType === 'superadmin') {
      return {
        backgroundColor: servicenowBlue,
        color: 'white'
      }
    }
    return {
      backgroundColor: servicenowBlue,
      color: 'white'
    }
  }

  const getActiveLinkClasses = () => {
    if (actorType === 'vendor') {
      const primaryColor = currentVendor?.primaryColor || '#2563eb'
      return `font-semibold`
    }
    if (actorType === 'company') {
      // Use dynamic color classes based on company's secondary color
      return 'font-semibold'
    }
    if (actorType === 'superadmin') return 'bg-red-50 text-red-700 font-semibold'
    return 'bg-orange-50 text-orange-700 font-semibold'
  }
  
  const getActiveLinkStyle = (isActive: boolean) => {
    if (actorType === 'vendor' && currentVendor && isActive) {
      return {
        backgroundColor: `${currentVendor.accentColor}20`,
        color: currentVendor.primaryColor
      }
    }
    if (actorType === 'company' && currentCompany && isActive) {
      const secondaryColor = currentCompany.secondaryColor || currentCompany.primaryColor || '#f76b1c'
      return {
        backgroundColor: `${secondaryColor}20`,
        color: currentCompany.primaryColor || '#f76b1c'
      }
    }
    return {}
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg border border-neutral-200"
        aria-label="Toggle menu"
      >
        {mobileMenuOpen ? (
          <X className="h-6 w-6 text-gray-700" />
        ) : (
          <Menu className="h-6 w-6 text-gray-700" />
        )}
      </button>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 w-64 bg-white border-r border-neutral-200 z-40 shadow-sm transform transition-transform duration-300 ease-in-out ${
        mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        <div className={`${(actorType === 'consumer' && currentEmployee) || (actorType === 'vendor' && currentVendor) ? 'h-20' : 'h-16'} flex items-center justify-between px-6 border-b border-neutral-200 relative`} style={getHeaderStyle()}>
          {/* Close button for mobile */}
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden absolute right-4 p-1 text-white hover:bg-white/20 rounded"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
          {actorType === 'vendor' && currentVendor ? (
            <div className="flex flex-col justify-center w-full">
              <h2 className="text-white font-semibold text-base">{getActorName()}</h2>
              <p className="text-white text-xs opacity-90 mt-0.5 font-medium">
                {currentVendor.name || currentVendor.id || 'Vendor'}
              </p>
            </div>
          ) : actorType === 'vendor' ? (
            <div className="flex flex-col justify-center w-full">
              <h2 className="text-white font-semibold text-base">{getActorName()}</h2>
              <p className="text-white text-xs opacity-90 mt-0.5 font-medium">Loading...</p>
            </div>
          ) : currentCompany && (actorType === 'consumer' || actorType === 'company') ? (
            <div className="flex items-center space-x-3">
              <div className="relative w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden shadow-modern">
                {currentCompany.name === 'ICICI Bank' ? (
                  // Custom ICICI Bank logo - Orange theme
                  <svg width="32" height="32" viewBox="0 0 32 32" className="rounded">
                    <rect width="32" height="32" rx="4" fill="#f76b1c"/>
                    <text x="16" y="22" fontSize="10" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="Arial, sans-serif">ICICI</text>
                  </svg>
                ) : currentCompany.logo ? (
                  <Image
                    src={currentCompany.logo}
                    alt={currentCompany.name}
                    width={40}
                    height={40}
                    className="object-contain p-1"
                  />
                ) : (
                  <span className="text-xs font-bold" style={{ color: currentCompany.primaryColor || '#f76b1c' }}>
                    {currentCompany.name.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-white font-semibold text-sm leading-tight">{currentCompany.name}</h2>
                <p className="text-white text-xs opacity-80 mt-0.5">{getActorName()}</p>
                {actorType === 'consumer' && currentEmployee && (
                  <p className="text-white text-xs opacity-90 mt-1 font-medium">
                    {currentEmployee.firstName && currentEmployee.lastName
                      ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
                      : currentEmployee.name || currentEmployee.employeeId || 'Employee'}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div>
              <h2 className="text-white font-semibold text-base">{getActorName()}</h2>
              {actorType === 'consumer' && currentEmployee && (
                <p className="text-white text-xs opacity-90 mt-1 font-medium">
                  {currentEmployee.firstName && currentEmployee.lastName
                    ? `${currentEmployee.firstName} ${currentEmployee.lastName}`
                    : currentEmployee.name || currentEmployee.employeeId || 'Employee'}
                </p>
              )}
            </div>
          )}
        </div>
        <nav className="mt-6 px-3">
          {menu.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const linkStyle = getActiveLinkStyle(isActive)
            const primaryColor = actorType === 'company' && currentCompany 
              ? currentCompany.primaryColor || '#032D42'
              : actorType === 'vendor' && currentVendor
              ? currentVendor.primaryColor || '#032D42'
              : '#032D42' /* ServiceNow Infinite Blue */
            
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-md mb-1 transition-all duration-200 ${
                  isActive
                    ? 'bg-neutral-100 text-neutral-900 font-medium'
                    : 'text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                }`}
                style={isActive ? {
                  backgroundColor: `${primaryColor}15`,
                  color: primaryColor,
                  borderLeft: `3px solid ${primaryColor}`
                } : linkStyle}
              >
                <Icon 
                  className="h-5 w-5 flex-shrink-0" 
                  style={isActive ? { color: primaryColor } : {}}
                />
                <span className="text-sm font-medium flex-1">{item.name}</span>
                {/* Approval Badge */}
                {(() => {
                  let badgeCount = 0
                  if (item.name === 'Approvals' || item.href === '/dashboard/company/approvals') {
                    badgeCount = approvalCounts.pendingOrderApprovals || 0
                  } else if (item.name === 'Return Requests' || item.href === '/dashboard/company/returns') {
                    badgeCount = approvalCounts.pendingReturnRequests || 0
                  } else if (item.name === 'Orders' && actorType === 'vendor' && item.href === '/dashboard/vendor/orders') {
                    badgeCount = approvalCounts.pendingOrders || 0
                  } else if (item.name === 'Replacement Orders' && actorType === 'vendor' && item.href === '/dashboard/vendor/replacement-orders') {
                    badgeCount = approvalCounts.pendingReplacementOrders || 0
                  } else if (item.name === 'Orders' && actorType === 'company' && item.href === '/dashboard/company/orders' && isLocationAdmin) {
                    badgeCount = approvalCounts.pendingOrderApprovals || 0
                  }
                  
                  return badgeCount > 0 ? (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-2 flex items-center justify-center">
                      {badgeCount > 99 ? '99+' : badgeCount}
                    </span>
                  ) : null
                })()}
              </Link>
            )
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-neutral-200 p-3">
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center space-x-3 px-3 py-2.5 rounded-md text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 transition-all duration-200"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm font-medium">Logout</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="lg:ml-64">
        <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-[#f8f9fa]">
          {children}
        </div>
      </div>
    </div>
  )
}

