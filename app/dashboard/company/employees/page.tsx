'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Plus, Upload, Search, Edit, Trash2, Download, FileText } from 'lucide-react'
import { getEmployeesByCompany, getCompanyById } from '@/lib/data-mongodb'

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [companyId, setCompanyId] = useState<string>('')
  const [companyEmployees, setCompanyEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<any>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  // Get company ID from localStorage (set during login) - company admin is linked to only one company
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadData = async () => {
        try {
          setLoading(true)
          const storedCompanyId = localStorage.getItem('companyId')
          if (storedCompanyId) {
            setCompanyId(storedCompanyId)
            // Filter employees by company - only show employees linked to this company
            const filtered = await getEmployeesByCompany(storedCompanyId)
            setCompanyEmployees(filtered)
          }
        } catch (error) {
          console.error('Error loading employees:', error)
        } finally {
          setLoading(false)
        }
      }
      
      loadData()
    }
  }, [])

  const filteredEmployees = companyEmployees.filter(emp => 
    `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.employeeId && emp.employeeId.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleBulkOrderUpload = async () => {
    if (!selectedFile || !companyId) {
      alert('Please select a file and ensure company ID is set')
      return
    }

    try {
      setUploading(true)
      
      // Read CSV file
      const text = await selectedFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        alert('CSV file must have at least a header row and one data row')
        setUploading(false)
        return
      }

      // Parse CSV (simple parser - assumes no commas in values)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const employeeIdIndex = headers.findIndex(h => h === 'employee id' || h === 'employeeno' || h === 'employee no')
      const skuIndex = headers.findIndex(h => h === 'sku')
      const sizeIndex = headers.findIndex(h => h === 'size')
      const quantityIndex = headers.findIndex(h => h === 'quantity')

      if (employeeIdIndex === -1 || skuIndex === -1 || sizeIndex === -1 || quantityIndex === -1) {
        alert('CSV must contain columns: Employee ID, SKU, Size, Quantity')
        setUploading(false)
        return
      }

      const orders = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        if (values.length >= 4) {
          orders.push({
            employeeId: values[employeeIdIndex],
            sku: values[skuIndex],
            size: values[sizeIndex],
            quantity: values[quantityIndex],
            rowNumber: i + 1 // +1 because we start from line 2 (after header)
          })
        }
      }

      if (orders.length === 0) {
        alert('No valid orders found in CSV file')
        setUploading(false)
        return
      }

      // Send to API
      const response = await fetch('/api/orders/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orders,
          companyId
        })
      })

      const data = await response.json()

      if (!response.ok) {
        alert(`Error: ${data.error}`)
        setUploading(false)
        return
      }

      setUploadResults(data)
    } catch (error: any) {
      console.error('Error uploading bulk orders:', error)
      alert(`Error processing file: ${error.message}`)
    } finally {
      setUploading(false)
    }
  }

  const downloadReport = (results: any) => {
    // Create CSV content
    const headers = ['Row Number', 'Employee ID', 'SKU', 'Size', 'Quantity', 'Status', 'Order ID / Error']
    const rows = results.results.map((r: any) => [
      r.rowNumber,
      r.employeeId,
      r.sku,
      r.size,
      r.quantity,
      r.status,
      r.status === 'success' ? r.orderId : r.error || ''
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map((row: any[]) => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `bulk_order_report_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <DashboardLayout actorType="company">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Employee Management</h1>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowUploadModal(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center space-x-2"
            >
              <Upload className="h-5 w-5" />
              <span>Bulk Order Upload</span>
            </button>
            <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center space-x-2">
              <Plus className="h-5 w-5" />
              <span>Add Employee</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white rounded-xl shadow-lg p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search employees by ID, name, email, or designation..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Employee Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Employee ID</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Name</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Designation</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Gender</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Location</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Email</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Sizes</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Status</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((employee) => (
                  <tr key={employee.id} className="border-b hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <span className="font-mono text-sm font-semibold text-blue-600">
                        {employee.employeeId || 'N/A'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-gray-900 font-medium">
                      {employee.firstName} {employee.lastName}
                    </td>
                    <td className="py-4 px-6 text-gray-600">{employee.designation}</td>
                    <td className="py-4 px-6 text-gray-600 capitalize">{employee.gender}</td>
                    <td className="py-4 px-6 text-gray-600">{employee.location}</td>
                    <td className="py-4 px-6 text-gray-600">{employee.email}</td>
                    <td className="py-4 px-6 text-gray-600 text-sm">
                      Shirt: {employee.shirtSize}, Pant: {employee.pantSize}, Shoe: {employee.shoeSize}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        employee.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {employee.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex space-x-2">
                        <button className="text-blue-600 hover:text-blue-700">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bulk Order Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 my-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">Bulk Order Upload</h2>
              <p className="text-gray-600 mb-6">
                Upload a CSV file with the following columns:
                <br />
                <span className="font-semibold">Employee ID, SKU, Size, Quantity</span>
                <br />
                <span className="text-sm text-gray-500 mt-2 block">
                  Note: Only employees from your company can be ordered for. Orders will be validated for eligibility.
                </span>
              </p>

              {!uploadResults && (
                <>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center mb-4">
                    <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-2">Drag and drop your CSV file here</p>
                    <p className="text-gray-500 text-sm mb-4">or</p>
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) {
                          setSelectedFile(file)
                        }
                      }}
                      className="mt-4"
                    />
                    {selectedFile && (
                      <p className="mt-4 text-sm text-gray-600">
                        Selected: <span className="font-semibold">{selectedFile.name}</span>
                      </p>
                    )}
                  </div>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        setShowUploadModal(false)
                        setSelectedFile(null)
                        setUploadResults(null)
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBulkOrderUpload}
                      disabled={!selectedFile || uploading}
                      className="flex-1 bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {uploading ? 'Processing...' : 'Upload & Process Orders'}
                    </button>
                  </div>
                </>
              )}

              {uploadResults && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Summary</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Total Rows</p>
                        <p className="text-2xl font-bold text-gray-900">{uploadResults.summary.total}</p>
                      </div>
                      <div>
                        <p className="text-sm text-green-600">Successful</p>
                        <p className="text-2xl font-bold text-green-600">{uploadResults.summary.successful}</p>
                      </div>
                      <div>
                        <p className="text-sm text-red-600">Failed</p>
                        <p className="text-2xl font-bold text-red-600">{uploadResults.summary.failed}</p>
                      </div>
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left py-2 px-4 font-semibold text-gray-700">Row</th>
                          <th className="text-left py-2 px-4 font-semibold text-gray-700">Employee ID</th>
                          <th className="text-left py-2 px-4 font-semibold text-gray-700">SKU</th>
                          <th className="text-left py-2 px-4 font-semibold text-gray-700">Size</th>
                          <th className="text-left py-2 px-4 font-semibold text-gray-700">Qty</th>
                          <th className="text-left py-2 px-4 font-semibold text-gray-700">Status</th>
                          <th className="text-left py-2 px-4 font-semibold text-gray-700">Order ID / Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadResults.results.map((result: any, index: number) => (
                          <tr key={index} className={`border-b ${result.status === 'success' ? 'bg-green-50' : 'bg-red-50'}`}>
                            <td className="py-2 px-4">{result.rowNumber}</td>
                            <td className="py-2 px-4 font-mono text-xs">{result.employeeId}</td>
                            <td className="py-2 px-4">{result.sku}</td>
                            <td className="py-2 px-4">{result.size}</td>
                            <td className="py-2 px-4">{result.quantity}</td>
                            <td className="py-2 px-4">
                              <span className={`px-2 py-1 rounded text-xs font-semibold ${
                                result.status === 'success' 
                                  ? 'bg-green-100 text-green-700' 
                                  : 'bg-red-100 text-red-700'
                              }`}>
                                {result.status}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-xs">
                              {result.status === 'success' ? (
                                <span className="font-mono text-green-700">{result.orderId}</span>
                              ) : (
                                <span className="text-red-700">{result.error}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={() => {
                        downloadReport(uploadResults)
                      }}
                      className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
                    >
                      <Download className="h-5 w-5" />
                      <span>Download Report</span>
                    </button>
                    <button
                      onClick={() => {
                        setShowUploadModal(false)
                        setSelectedFile(null)
                        setUploadResults(null)
                        // Reload employees to show updated data
                        window.location.reload()
                      }}
                      className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}








