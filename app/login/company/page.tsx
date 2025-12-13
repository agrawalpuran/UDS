'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import OTPVerification from '@/components/OTPVerification'
import { useRouter } from 'next/navigation'
import { getCompanyByAdminEmail } from '@/lib/data-mongodb'

export default function CompanyLogin() {
  const [emailOrPhone, setEmailOrPhone] = useState('')
  const [showOTP, setShowOTP] = useState(false)
  const [error, setError] = useState<string>('')
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (emailOrPhone) {
      setError('')
      // Check if this email is a company admin before showing OTP
      try {
        const company = await getCompanyByAdminEmail(emailOrPhone)
        if (!company) {
          setError('Access denied: This email is not authorized as a company admin. Please contact your super admin to be assigned as a company administrator.')
          return
        }
        setShowOTP(true)
      } catch (error) {
        console.error('Error checking admin status:', error)
        setError('Error verifying admin status. Please try again.')
      }
    }
  }

  const handleOTPVerify = async (otp: string) => {
    // Double-check admin status before allowing login
    try {
      const company = await getCompanyByAdminEmail(emailOrPhone)
      if (!company) {
        setError('Access denied: This email is not authorized as a company admin.')
        setShowOTP(false)
        return
      }
      
      // Use tab-specific authentication storage
      const { setAuthData } = await import('@/lib/utils/auth-storage')
      setAuthData('company', {
        userEmail: emailOrPhone,
        companyId: company.id
      })
      
      // Also set in localStorage for backward compatibility (but don't overwrite other tabs)
      // Only update if this tab's current actor type matches
      const currentActorType = sessionStorage.getItem('currentActorType')
      if (!currentActorType || currentActorType === 'company') {
        localStorage.setItem('actorType', 'company')
        localStorage.setItem('userEmail', emailOrPhone)
        localStorage.setItem('companyId', company.id)
        sessionStorage.setItem('currentActorType', 'company')
      }
      
      setTimeout(() => {
        router.push('/dashboard/company')
      }, 1000)
    } catch (error) {
      console.error('Error verifying admin:', error)
      setError('Error verifying admin status. Please try again.')
      setShowOTP(false)
    }
  }

  const handleResendOTP = () => {
    alert('OTP resent! Use 123456 for demo')
  }

  if (showOTP) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Link href="/login/company" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to home
        </Link>
        <div className="bg-white rounded-xl shadow-lg p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Company Login</h1>
            <p className="text-gray-600">Access your company portal</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="emailOrPhone" className="block text-sm font-medium text-gray-700 mb-2">
                Admin Email
              </label>
              <input
                type="email"
                id="emailOrPhone"
                value={emailOrPhone}
                onChange={(e) => {
                  setEmailOrPhone(e.target.value)
                  setError('')
                }}
                placeholder="Enter your admin email"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
              {error && (
                <p className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-200">
                  {error}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Only users assigned as company administrators can access this portal.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
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








