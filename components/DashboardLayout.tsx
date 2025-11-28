'use client'

import { ReactNode, useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, Package, Users, FileText, BarChart3, 
  Settings, LogOut, MapPin, ShoppingCart, Upload
} from 'lucide-react'
import { mockEmployees, mockCompanies, getVendorById, getCompanyById, getEmployeeByEmail } from '@/lib/data'
import Image from 'next/image'

interface DashboardLayoutProps {
  children: ReactNode
  actorType: 'vendor' | 'company' | 'consumer' | 'superadmin'
}

export default function DashboardLayout({ children, actorType }: DashboardLayoutProps) {
  const pathname = usePathname()
  const [currentCompany, setCurrentCompany] = useState<any>(null)
  const [currentVendor, setCurrentVendor] = useState<any>(null)

  useEffect(() => {
    if (actorType === 'consumer') {
      // Get current employee from localStorage
      const userEmail = typeof window !== 'undefined' ? localStorage.getItem('userEmail') : null
      const currentEmployee = userEmail ? getEmployeeByEmail(userEmail) : (mockEmployees[0] || null)
      if (currentEmployee?.companyId) {
        const company = getCompanyById(currentEmployee.companyId)
        setCurrentCompany(company || null)
      }
    } else if (actorType === 'company') {
      // Get company from localStorage
      const companyId = typeof window !== 'undefined' ? localStorage.getItem('companyId') : null
      if (companyId) {
        const company = getCompanyById(companyId)
        setCurrentCompany(company || null)
      } else {
        setCurrentCompany(mockCompanies[0] || null)
      }
    } else if (actorType === 'vendor') {
      // Get vendor from localStorage
      const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendorId') : null
      if (vendorId) {
        const vendor = getVendorById(vendorId)
        setCurrentVendor(vendor || null)
      } else {
        const vendor = getVendorById('VEND-001')
        setCurrentVendor(vendor || null)
      }
    }
  }, [actorType])

  const vendorMenu = [
    { name: 'Dashboard', href: '/dashboard/vendor', icon: LayoutDashboard },
    { name: 'Inventory', href: '/dashboard/vendor/inventory', icon: Package },
    { name: 'Orders', href: '/dashboard/vendor/orders', icon: ShoppingCart },
    { name: 'Reports', href: '/dashboard/vendor/reports', icon: BarChart3 },
  ]

  const companyMenu = [
    { name: 'Dashboard', href: '/dashboard/company', icon: LayoutDashboard },
    { name: 'Employees', href: '/dashboard/company/employees', icon: Users },
    { name: 'Catalog', href: '/dashboard/company/catalog', icon: Package },
    { name: 'Orders', href: '/dashboard/company/orders', icon: ShoppingCart },
    { name: 'Approvals', href: '/dashboard/company/approvals', icon: FileText },
    { name: 'Locations', href: '/dashboard/company/locations', icon: MapPin },
    { name: 'Batch Upload', href: '/dashboard/company/batch-upload', icon: Upload },
    { name: 'Reports', href: '/dashboard/company/reports', icon: BarChart3 },
  ]

  const consumerMenu = [
    { name: 'Dashboard', href: '/dashboard/consumer', icon: LayoutDashboard },
    { name: 'Catalog', href: '/dashboard/consumer/catalog', icon: Package },
    { name: 'My Orders', href: '/dashboard/consumer/orders', icon: ShoppingCart },
    { name: 'Profile', href: '/dashboard/consumer/profile', icon: Settings },
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
    if (actorType === 'company') return 'purple'
    return 'green'
  }

  const getHeaderColor = () => {
    if (actorType === 'vendor') {
      return currentVendor?.primaryColor || '#2563eb'
    }
    if (actorType === 'company') return 'bg-purple-600'
    if (actorType === 'superadmin') return 'bg-red-600'
    return 'bg-green-600'
  }
  
  const getHeaderStyle = () => {
    if (actorType === 'vendor' && currentVendor) {
      return {
        backgroundColor: currentVendor.primaryColor,
        color: 'white'
      }
    }
    if (actorType === 'superadmin') {
      return {
        backgroundColor: '#dc2626',
        color: 'white'
      }
    }
    return {}
  }

  const getActiveLinkClasses = () => {
    if (actorType === 'vendor') {
      const primaryColor = currentVendor?.primaryColor || '#2563eb'
      return `font-semibold`
    }
    if (actorType === 'company') return 'bg-purple-50 text-purple-700 font-semibold'
    if (actorType === 'superadmin') return 'bg-red-50 text-red-700 font-semibold'
    return 'bg-green-50 text-green-700 font-semibold'
  }
  
  const getActiveLinkStyle = (isActive: boolean) => {
    if (actorType === 'vendor' && currentVendor && isActive) {
      return {
        backgroundColor: `${currentVendor.accentColor}20`,
        color: currentVendor.primaryColor
      }
    }
    return {}
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 glass border-r border-slate-200/50 shadow-modern-lg z-10">
        <div className="h-20 flex items-center justify-between px-6 gradient-primary" style={getHeaderStyle()}>
          {actorType === 'vendor' && currentVendor ? (
            <div className="flex items-center space-x-3">
              <div className="relative w-10 h-10 bg-white rounded flex items-center justify-center overflow-hidden">
                <Image
                  src={currentVendor.logo}
                  alt={currentVendor.name}
                  width={40}
                  height={40}
                  className="object-contain"
                />
              </div>
              <div>
                <h2 className="text-white font-bold text-sm">{currentVendor.name}</h2>
                <p className="text-white text-xs opacity-90">{getActorName()}</p>
              </div>
            </div>
          ) : currentCompany && (actorType === 'consumer' || actorType === 'company') ? (
            <div className="flex items-center space-x-3">
              <div className="relative w-10 h-10 bg-white rounded-lg flex items-center justify-center overflow-hidden shadow-modern">
                {currentCompany.name === 'Indigo' ? (
                  // Custom Indigo logo
                  <svg width="32" height="32" viewBox="0 0 32 32" className="rounded">
                    <circle cx="16" cy="16" r="14" fill="#004080"/>
                    <text x="16" y="21" fontSize="16" fontWeight="bold" fill="white" textAnchor="middle" fontFamily="Arial, sans-serif">6E</text>
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
                  <span className="text-xs font-bold" style={{ color: currentCompany.primaryColor || '#004080' }}>
                    {currentCompany.name.charAt(0)}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-white font-bold text-sm">{currentCompany.name}</h2>
                <p className="text-white text-xs opacity-90">{getActorName()}</p>
              </div>
            </div>
          ) : (
            <h2 className="text-white font-bold text-lg">{getActorName()}</h2>
          )}
        </div>
        <nav className="mt-8 px-4">
          {menu.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href
            const linkStyle = getActiveLinkStyle(isActive)
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl mb-2 transition-smooth hover-lift ${
                  isActive
                    ? `${getActiveLinkClasses()} shadow-modern`
                    : 'text-slate-600 hover:bg-slate-50/80 hover:text-slate-900'
                }`}
                style={linkStyle}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'text-primary-600' : ''}`} />
                <span className="font-medium">{item.name}</span>
              </Link>
            )
          })}
        </nav>
        <div className="absolute bottom-4 left-4 right-4">
          <Link
            href="/"
            className="flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-slate-50/80 hover:text-slate-900 transition-smooth hover-lift"
          >
            <LogOut className="h-5 w-5" />
            <span className="font-medium">Logout</span>
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        <div className="p-8 min-h-screen">
          {children}
        </div>
      </div>
    </div>
  )
}

