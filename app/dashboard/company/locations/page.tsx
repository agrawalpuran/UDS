'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Plus, MapPin, Edit, Trash2 } from 'lucide-react'
import { getCompanyById } from '@/lib/data-mongodb'

export default function LocationsPage() {
  const [companyPrimaryColor, setCompanyPrimaryColor] = useState<string>('#f76b1c')
  const [companySecondaryColor, setCompanySecondaryColor] = useState<string>('#f76b1c')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadCompanyColors = async () => {
        const storedCompanyId = localStorage.getItem('companyId')
        if (storedCompanyId) {
          const companyDetails = await getCompanyById(storedCompanyId)
          if (companyDetails) {
            setCompanyPrimaryColor(companyDetails.primaryColor || '#f76b1c')
            setCompanySecondaryColor(companyDetails.secondaryColor || companyDetails.primaryColor || '#f76b1c')
          }
        }
      }
      loadCompanyColors()
    }
  }, [])
  // Locations feature - using local state for now (can be migrated to MongoDB later if needed)
  const [locations, setLocations] = useState<any[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    type: 'regional' as 'central' | 'regional'
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newLocation = {
      id: `LOC-${Date.now()}`,
      ...formData,
      companyId: 1 // Placeholder - should use actual company ID from context
    }
    setLocations([...locations, newLocation])
    setShowAddModal(false)
    setFormData({ name: '', address: '', type: 'regional' })
  }

  return (
    <DashboardLayout actorType="company">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Location Management</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center space-x-2"
            style={{ backgroundColor: companyPrimaryColor || '#f76b1c' }}
            onMouseEnter={(e) => {
              const color = companyPrimaryColor || '#f76b1c'
              const r = parseInt(color.slice(1, 3), 16)
              const g = parseInt(color.slice(3, 5), 16)
              const b = parseInt(color.slice(5, 7), 16)
              const darker = '#' + Math.max(0, r - 25).toString(16).padStart(2, '0') + Math.max(0, g - 25).toString(16).padStart(2, '0') + Math.max(0, b - 25).toString(16).padStart(2, '0')
              e.currentTarget.style.backgroundColor = darker
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = companyPrimaryColor || '#f76b1c'
            }}
          >
            <Plus className="h-5 w-5" />
            <span>Add Location</span>
          </button>
        </div>

        {/* Locations Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {locations.map((location) => (
            <div key={location.id} className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div 
                    className="p-2 rounded-lg"
                    style={{ 
                      backgroundColor: location.type === 'central' 
                        ? `${companyPrimaryColor || '#f76b1c'}20` 
                        : `${companySecondaryColor || '#f76b1c'}20`
                    }}
                  >
                    <MapPin 
                      className="h-5 w-5"
                      style={{ 
                        color: location.type === 'central' 
                          ? companyPrimaryColor || '#f76b1c'
                          : companySecondaryColor || '#f76b1c'
                      }}
                    />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900">{location.name}</h3>
                    <span 
                      className={`text-xs px-2 py-1 rounded-full ${
                        location.type === 'central' 
                          ? `${companyPrimaryColor || '#f76b1c'}20` 
                          : `${companySecondaryColor || '#f76b1c'}20`
                      }`}
                      style={{ 
                        color: location.type === 'central' 
                          ? companyPrimaryColor || '#f76b1c'
                          : companySecondaryColor || '#f76b1c'
                      }}
                    >
                      {location.type}
                    </span>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button className="text-blue-600 hover:text-blue-700">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <p className="text-gray-600 text-sm">{location.address}</p>
            </div>
          ))}
        </div>

        {/* Add Location Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">Add New Location</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                    style={{ 
                      '--tw-ring-color': companyPrimaryColor || '#f76b1c',
                      '--tw-border-color': companyPrimaryColor || '#f76b1c'
                    } as React.CSSProperties & { '--tw-ring-color'?: string; '--tw-border-color'?: string }}
                    onFocus={(e) => {
                      const color = companyPrimaryColor || '#f76b1c'
                      e.target.style.borderColor = color
                      e.target.style.boxShadow = '0 0 0 2px ' + color + '40'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db'
                      e.target.style.boxShadow = 'none'
                    }}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                    style={{ 
                      '--tw-ring-color': companyPrimaryColor || '#f76b1c',
                      '--tw-border-color': companyPrimaryColor || '#f76b1c'
                    } as React.CSSProperties & { '--tw-ring-color'?: string; '--tw-border-color'?: string }}
                    onFocus={(e) => {
                      const color = companyPrimaryColor || '#f76b1c'
                      e.target.style.borderColor = color
                      e.target.style.boxShadow = '0 0 0 2px ' + color + '40'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db'
                      e.target.style.boxShadow = 'none'
                    }}
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as 'central' | 'regional' })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 outline-none"
                    style={{ 
                      '--tw-ring-color': companyPrimaryColor || '#f76b1c',
                      '--tw-border-color': companyPrimaryColor || '#f76b1c'
                    } as React.CSSProperties & { '--tw-ring-color'?: string; '--tw-border-color'?: string }}
                    onFocus={(e) => {
                      const color = companyPrimaryColor || '#f76b1c'
                      e.target.style.borderColor = color
                      e.target.style.boxShadow = '0 0 0 2px ' + color + '40'
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = '#d1d5db'
                      e.target.style.boxShadow = 'none'
                    }}
                  >
                    <option value="regional">Regional Office</option>
                    <option value="central">Central Office</option>
                  </select>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 text-white py-3 rounded-lg font-semibold transition-colors"
                    style={{ backgroundColor: companyPrimaryColor || '#f76b1c' }}
                    onMouseEnter={(e) => {
                      const color = companyPrimaryColor || '#f76b1c'
                      const r = parseInt(color.slice(1, 3), 16)
                      const g = parseInt(color.slice(3, 5), 16)
                      const b = parseInt(color.slice(5, 7), 16)
                      const darker = '#' + Math.max(0, r - 25).toString(16).padStart(2, '0') + Math.max(0, g - 25).toString(16).padStart(2, '0') + Math.max(0, b - 25).toString(16).padStart(2, '0')
                      e.currentTarget.style.backgroundColor = darker
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = companyPrimaryColor || '#f76b1c'
                    }}
                  >
                    Add Location
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}



