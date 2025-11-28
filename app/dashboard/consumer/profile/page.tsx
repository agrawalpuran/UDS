'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { User, Mail, Phone, MapPin, Edit } from 'lucide-react'
import { getEmployeeByEmail, Employee } from '@/lib/data-mongodb'

export default function ConsumerProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadData = async () => {
        try {
          setLoading(true)
          const userEmail = localStorage.getItem('userEmail')
          if (!userEmail) {
            setLoading(false)
            return
          }
          
          const currentEmployee = await getEmployeeByEmail(userEmail)
          if (currentEmployee) {
            setEmployee(currentEmployee)
          }
        } catch (error) {
          console.error('Error loading employee:', error)
        } finally {
          setLoading(false)
        }
      }
      
      loadData()
    }
  }, [])
  
  if (loading || !employee) {
    return (
      <DashboardLayout actorType="consumer">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout actorType="consumer">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center space-x-2">
            <Edit className="h-5 w-5" />
            <span>Edit Profile</span>
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Personal Information */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Personal Information</h2>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Full Name</p>
                  <p className="font-semibold text-gray-900">{employee.firstName} {employee.lastName}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Employee ID</p>
                  <p className="font-mono font-semibold text-blue-600">{employee.employeeId || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Mail className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-semibold text-gray-900">{employee.email}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Mobile</p>
                  <p className="font-semibold text-gray-900">{employee.mobile}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-semibold text-gray-900">{employee.address}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Work Information */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Work Information</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Company</p>
                <p className="font-semibold text-gray-900">{employee.companyName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Designation</p>
                <p className="font-semibold text-gray-900">{employee.designation}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Location</p>
                <p className="font-semibold text-gray-900">{employee.location}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  employee.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {employee.status}
                </span>
              </div>
            </div>
          </div>

          {/* Size Information */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Size Information</h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600 mb-1">Shirt Size</p>
                <p className="text-2xl font-bold text-gray-900">{employee.shirtSize}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Pant Size</p>
                <p className="text-2xl font-bold text-gray-900">{employee.pantSize}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Shoe Size</p>
                <p className="text-2xl font-bold text-gray-900">{employee.shoeSize}</p>
              </div>
            </div>
          </div>

          {/* Eligibility & Preferences */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Eligibility & Preferences</h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-2">Eligibility ({employee.period})</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600">Shirts</p>
                    <p className="font-bold text-gray-900">{employee.eligibility.shirt}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600">Pants</p>
                    <p className="font-bold text-gray-900">{employee.eligibility.pant}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600">Shoes</p>
                    <p className="font-bold text-gray-900">{employee.eligibility.shoe}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-xs text-gray-600">Jackets</p>
                    <p className="font-bold text-gray-900">{employee.eligibility.jacket}</p>
                  </div>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Dispatch Preference</p>
                <p className="font-semibold text-gray-900 capitalize">{employee.dispatchPreference}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}




