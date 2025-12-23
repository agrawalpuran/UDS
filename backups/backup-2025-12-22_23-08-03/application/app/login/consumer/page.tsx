'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import OTPVerification from '@/components/OTPVerification'
import { useRouter } from 'next/navigation'

export default function ConsumerLogin() {
  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [showOTP, setShowOTP] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (emailOrPhone) {
      setShowOTP(true)
    }
  }

  const handleOTPVerify = async (otp: string) => {
    try {
      // Check if employee order is enabled for this employee's company
      const { getEmployeeByEmail, getCompanyById, isCompanyAdmin, getLocationByAdminEmail, getBranchByAdminEmail } = await import('@/lib/data-mongodb')
      
      // Get employee to find their company
      const employee = await getEmployeeByEmail(emailOrPhone)
      if (!employee) {
        alert('Employee not found. Please contact your administrator.')
        setShowOTP(false)
        return
      }
      
      // Get company ID
      const companyId = typeof employee.companyId === 'object' && employee.companyId?.id
        ? employee.companyId.id
        : employee.companyId
      
      if (!companyId) {
        alert('Company information not found. Please contact your administrator.')
        setShowOTP(false)
        return
      }
      
      // Check if user is Company Admin, Location Admin, or Branch Admin (these are always allowed)
      const isAdmin = await isCompanyAdmin(emailOrPhone, companyId)
      const location = await getLocationByAdminEmail(emailOrPhone)
      const branch = await getBranchByAdminEmail(emailOrPhone)
      
      // If not an admin, check if employee order is enabled
      if (!isAdmin && !location && !branch) {
        const company = await getCompanyById(companyId)
        // Check if enableEmployeeOrder is explicitly false (undefined/null means not set, which should default to false)
        if (company && (company.enableEmployeeOrder === false || company.enableEmployeeOrder === undefined)) {
          alert('Employee orders are currently disabled for your company. Please contact your administrator.')
          setShowOTP(false)
          return
        }
      }
      
      // Use tab-specific authentication storage
      const { setAuthData } = await import('@/lib/utils/auth-storage')
      setAuthData('consumer', {
        userEmail: emailOrPhone
      })
      
      // Also set in localStorage for backward compatibility (but don't overwrite other tabs)
      const currentActorType = sessionStorage.getItem('currentActorType')
      if (!currentActorType || currentActorType === 'consumer') {
        localStorage.setItem('actorType', 'consumer')
        localStorage.setItem('userEmail', emailOrPhone)
        sessionStorage.setItem('currentActorType', 'consumer')
      }
      
      setTimeout(() => {
        router.push('/dashboard/consumer')
      }, 1000)
    } catch (error: any) {
      console.error('Error during login verification:', error)
      alert(`Login failed: ${error.message || 'Please try again.'}`)
      setShowOTP(false)
    }
  }

  const handleResendOTP = () => {
    alert('OTP resent! Use 123456 for demo')
  }

  if (showOTP) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Link href="/login/consumer" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to login
          </Link>
          <OTPVerification
            emailOrPhone={emailOrPhone}
            onVerify={handleOTPVerify}
            onResend={handleResendOTP}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to home
        </Link>
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Employee Login</h1>
            <p className="text-gray-600">Access your employee portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="emailOrPhone" className="block text-sm font-medium text-gray-700 mb-2">
                Email or Phone Number
              </label>
              <input
                type="text"
                id="emailOrPhone"
                value={emailOrPhone}
                onChange={(e) => setEmailOrPhone(e.target.value)}
                placeholder="Enter email or phone number"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
            >
              Send OTP
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link href="/" className="text-gray-600 hover:text-gray-900 text-sm">
              ← Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}








