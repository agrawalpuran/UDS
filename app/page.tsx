'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Building2, Package, Users, ArrowRight, Shield, Truck, RefreshCw, Phone, Mail, CheckCircle, Settings } from 'lucide-react'

export default function Home() {
  const router = useRouter()

  const handlePortalClick = (path: string) => {
    console.log('Navigating to:', path)
    try {
      router.push(path)
    } catch (error) {
      console.error('Navigation error:', error)
      // Fallback to window.location if router fails
      window.location.href = path
    }
  }
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <Package className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-2xl font-semibold text-gray-900">UniformHub</h1>
            </div>
            <nav className="flex items-center space-x-6">
              <Link href="/login" className="text-gray-700 hover:text-blue-600 px-4 py-2 text-sm font-medium transition-colors">
                Login
              </Link>
              <Link href="/login/company" className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                Get Started
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-b from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Professional Uniform Distribution
              <br />
              <span className="text-blue-600">Management System</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Streamline your uniform distribution with our comprehensive B2B2C platform.
              Manage inventory, orders, and employees all in one place.
            </p>
            <div className="flex justify-center space-x-4">
              <Link href="/login/company" className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg">
                Get Started
              </Link>
              <Link href="/login" className="bg-white text-blue-600 border-2 border-blue-600 px-8 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors">
                Learn More
              </Link>
            </div>
          </div>

          {/* Key Features Grid */}
          <div className="grid md:grid-cols-4 gap-6 mt-16">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Built for Scale</h3>
              <p className="text-sm text-gray-600">Enterprise-grade solution for large organizations</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Keeps Track & Order</h3>
              <p className="text-sm text-gray-600">Real-time inventory and order management</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Engineered for Efficiency</h3>
              <p className="text-sm text-gray-600">Streamlined workflows for better productivity</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100 text-center">
              <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-orange-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">Proven Quality</h3>
              <p className="text-sm text-gray-600">Trusted by leading organizations worldwide</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Indicators */}
      <section className="bg-gray-50 py-8 border-y border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            <div className="flex flex-col items-center">
              <Truck className="h-6 w-6 text-blue-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">Shipping Within 2-3 Days</p>
            </div>
            <div className="flex flex-col items-center">
              <RefreshCw className="h-6 w-6 text-blue-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">15 Days Return Policy</p>
            </div>
            <div className="flex flex-col items-center">
              <Phone className="h-6 w-6 text-blue-600 mb-2" />
              <p className="text-sm font-medium text-gray-900">24/7 Customer Support</p>
            </div>
          </div>
        </div>
      </section>

      {/* Portal Selection Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Choose Your Portal</h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Access the right tools for your role in the uniform distribution ecosystem
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Vendor Card */}
            <div 
              onClick={() => handlePortalClick('/login/vendor')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handlePortalClick('/login/vendor')
                }
              }}
              role="button"
              tabIndex={0}
              className="group bg-white rounded-lg border-2 border-gray-200 p-8 hover:border-blue-500 transition-all duration-300 hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <div className="flex items-center justify-center w-16 h-16 bg-blue-50 rounded-lg mb-6 group-hover:bg-blue-100 transition-colors">
                <Package className="h-8 w-8 text-blue-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Vendor Portal</h4>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Manage inventory, fulfill orders, and track shipments. Perfect for manufacturers and suppliers.
              </p>
              <div className="flex items-center text-blue-600 font-medium">
                Access Portal <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Company Card */}
            <div 
              onClick={() => handlePortalClick('/login/company')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handlePortalClick('/login/company')
                }
              }}
              role="button"
              tabIndex={0}
              className="group bg-white rounded-lg border-2 border-gray-200 p-8 hover:border-purple-500 transition-all duration-300 hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <div className="flex items-center justify-center w-16 h-16 bg-purple-50 rounded-lg mb-6 group-hover:bg-purple-100 transition-colors">
                <Building2 className="h-8 w-8 text-purple-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Company Portal</h4>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Manage employees, place bulk orders, track budgets, and generate comprehensive reports.
              </p>
              <div className="flex items-center text-purple-600 font-medium">
                Access Portal <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Consumer Card */}
            <div 
              onClick={() => handlePortalClick('/login/consumer')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handlePortalClick('/login/consumer')
                }
              }}
              role="button"
              tabIndex={0}
              className="group bg-white rounded-lg border-2 border-gray-200 p-8 hover:border-green-500 transition-all duration-300 hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <div className="flex items-center justify-center w-16 h-16 bg-green-50 rounded-lg mb-6 group-hover:bg-green-100 transition-colors">
                <Users className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Employee Portal</h4>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Browse catalog, place orders, track your uniform requests, and manage your preferences.
              </p>
              <div className="flex items-center text-green-600 font-medium">
                Access Portal <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>

            {/* Super Admin Card */}
            <div 
              onClick={() => handlePortalClick('/login/superadmin')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handlePortalClick('/login/superadmin')
                }
              }}
              role="button"
              tabIndex={0}
              className="group bg-white rounded-lg border-2 border-gray-200 p-8 hover:border-red-500 transition-all duration-300 hover:shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <div className="flex items-center justify-center w-16 h-16 bg-red-50 rounded-lg mb-6 group-hover:bg-red-100 transition-colors">
                <Shield className="h-8 w-8 text-red-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Super Admin Portal</h4>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Manage products, vendors, companies, and employee relationships. Full system administration.
              </p>
              <div className="flex items-center text-red-600 font-medium">
                Access Portal <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Key Features</h3>
            <p className="text-lg text-gray-600">Everything you need for efficient uniform management</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <div className="text-3xl mb-4">📦</div>
              <h4 className="font-semibold text-gray-900 mb-2">Multi-Vendor Support</h4>
              <p className="text-sm text-gray-600 leading-relaxed">Manage multiple vendors and suppliers seamlessly</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <div className="text-3xl mb-4">👥</div>
              <h4 className="font-semibold text-gray-900 mb-2">Employee Management</h4>
              <p className="text-sm text-gray-600 leading-relaxed">Bulk upload and manage employee data efficiently</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <div className="text-3xl mb-4">📊</div>
              <h4 className="font-semibold text-gray-900 mb-2">Advanced Reporting</h4>
              <p className="text-sm text-gray-600 leading-relaxed">Track usage, budgets, and ordering activity</p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-100">
              <div className="text-3xl mb-4">🔐</div>
              <h4 className="font-semibold text-gray-900 mb-2">Secure OTP Login</h4>
              <p className="text-sm text-gray-600 leading-relaxed">Email or phone-based authentication</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Package className="h-6 w-6 text-white" />
                </div>
                <h5 className="text-xl font-semibold text-white">UniformHub</h5>
              </div>
              <p className="text-sm text-gray-400 leading-relaxed">
                Professional uniform distribution management system for modern organizations.
              </p>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Company</h5>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white transition-colors">About Us</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Contact</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Blog</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Support</h5>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white transition-colors">Shipping Policy</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Returns & Exchanges</Link></li>
                <li><Link href="#" className="hover:text-white transition-colors">Terms & Conditions</Link></li>
              </ul>
            </div>
            <div>
              <h5 className="text-white font-semibold mb-4">Contact</h5>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center space-x-2">
                  <Phone className="h-4 w-4" />
                  <span>+1 (555) 123-4567</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Mail className="h-4 w-4" />
                  <span>support@uniformhub.com</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 UniformHub. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
