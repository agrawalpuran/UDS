'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Plus, Upload, Search, Edit, Trash2, Download, FileText, X, Save } from 'lucide-react'
import { 
  getEmployeesByCompany, 
  getCompanyById, 
  createEmployee, 
  updateEmployee, 
  deleteEmployee,
  getBranchesByCompany
} from '@/lib/data-mongodb'
import { maskEmployeeData } from '@/lib/utils/data-masking'

export default function EmployeesPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState<any>(null)
  const [companyId, setCompanyId] = useState<string>('')
  const [companyName, setCompanyName] = useState<string>('')
  const [companyPrimaryColor, setCompanyPrimaryColor] = useState<string>('#f76b1c')
  const [companyEmployees, setCompanyEmployees] = useState<any[]>([])
  const [branches, setBranches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [uploadResults, setUploadResults] = useState<any>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  
  // Form state for add/edit employee
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    designation: '',
    gender: 'male' as 'male' | 'female',
    location: '',
    email: '',
    mobile: '',
    shirtSize: '',
    pantSize: '',
    shoeSize: '',
    address: '',
    branchId: '',
    branchName: '',
    dispatchPreference: 'direct' as 'direct' | 'central' | 'regional',
    status: 'active' as 'active' | 'inactive',
    period: '2024-2025',
    dateOfJoining: new Date('2025-10-01').toISOString().split('T')[0],
  })

  // Get company ID from localStorage (set during login) - company admin is linked to only one company
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadData = async () => {
        try {
          setLoading(true)
          let targetCompanyId = localStorage.getItem('companyId')
          
          // If companyId not in localStorage, try to get it from admin email
          if (!targetCompanyId) {
            const { getUserEmail } = await import('@/lib/utils/auth-storage')
            const userEmail = getUserEmail('company') || localStorage.getItem('userEmail')
            if (userEmail) {
              const { getCompanyByAdminEmail } = await import('@/lib/data-mongodb')
              const company = await getCompanyByAdminEmail(userEmail)
              if (company && company.id) {
                targetCompanyId = String(company.id)
                localStorage.setItem('companyId', targetCompanyId)
              }
            }
          }
          
          if (targetCompanyId) {
            setCompanyId(targetCompanyId)
            // Load company details
            const company = await getCompanyById(targetCompanyId)
            if (company) {
              setCompanyName(company.name || '')
              setCompanyPrimaryColor(company.primaryColor || '#f76b1c')
            }
            // Filter employees by company - only show employees linked to this company
            const filtered = await getEmployeesByCompany(targetCompanyId)
            console.log(`[EmployeesPage] Loaded ${filtered.length} employees for company ${targetCompanyId}`)
            console.log(`[EmployeesPage] Employee data:`, filtered)
            if (filtered && Array.isArray(filtered) && filtered.length > 0) {
              console.log(`[EmployeesPage] First employee sample:`, filtered[0])
            }
            setCompanyEmployees(filtered || [])
            // Load branches for the company
            const companyBranches = await getBranchesByCompany(targetCompanyId)
            setBranches(companyBranches)
          } else {
            console.error('[EmployeesPage] No companyId found in localStorage or from admin email')
            alert('Company information not found. Please log in again.')
          }
        } catch (error) {
          console.error('Error loading employees:', error)
          alert(`Error loading employees: ${error instanceof Error ? error.message : 'Unknown error'}`)
        } finally {
          setLoading(false)
        }
      }
      
      loadData()
    }
  }, [])

  // Helper function to remove "ICICI Bank - " prefix from branch names
  const getBranchName = (employee: any): string => {
    const branchName = employee.branchName || (employee.branchId && typeof employee.branchId === 'object' && employee.branchId.name) || 'N/A'
    if (branchName === 'N/A') return 'N/A'
    return branchName.replace(/^ICICI Bank\s*-\s*/i, '')
  }

  const filteredEmployees = companyEmployees.filter(emp => {
    if (!emp) return false
    const firstName = emp.firstName || ''
    const lastName = emp.lastName || ''
    const email = emp.email || ''
    const designation = emp.designation || ''
    const employeeId = emp.employeeId || ''
    const branchName = emp.branchName || (emp.branchId && typeof emp.branchId === 'object' && emp.branchId.name) || ''
    
    if (searchTerm === '') return true
    
    return `${firstName} ${lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      designation.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      branchName.toLowerCase().includes(searchTerm.toLowerCase())
  })

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

  const resetForm = () => {
    setFormData({
      firstName: '',
      lastName: '',
      designation: '',
      gender: 'male',
      location: '',
      email: '',
      mobile: '',
      shirtSize: '',
      pantSize: '',
      shoeSize: '',
      address: '',
      branchId: '',
      branchName: '',
      dispatchPreference: 'direct',
      status: 'active',
      period: '2024-2025',
      dateOfJoining: new Date('2025-10-01').toISOString().split('T')[0],
    })
  }

  const handleAddEmployee = () => {
    resetForm()
    setShowAddModal(true)
  }

  const handleEditEmployee = (employee: any) => {
    setEditingEmployee(employee)
    setFormData({
      firstName: employee.firstName || '',
      lastName: employee.lastName || '',
      designation: employee.designation || '',
      gender: employee.gender || 'male',
      location: employee.location || '',
      email: employee.email || '',
      mobile: employee.mobile || '',
      shirtSize: employee.shirtSize || '',
      pantSize: employee.pantSize || '',
      shoeSize: employee.shoeSize || '',
      address: employee.address || '',
      branchId: employee.branchId?.id || employee.branchId || '',
      branchName: employee.branchName || (employee.branchId && typeof employee.branchId === 'object' ? employee.branchId.name : '') || '',
      dispatchPreference: employee.dispatchPreference || 'direct',
      status: employee.status || 'active',
      period: employee.period || '2024-2025',
      dateOfJoining: employee.dateOfJoining ? new Date(employee.dateOfJoining).toISOString().split('T')[0] : new Date('2025-10-01').toISOString().split('T')[0],
    })
    setShowEditModal(true)
  }

  const handleDeleteEmployee = async (employee: any) => {
    if (!confirm(`Are you sure you want to delete employee ${employee.firstName} ${employee.lastName} (${employee.employeeId})?`)) {
      return
    }

    try {
      await deleteEmployee(employee.id)
      // Reload employees
      const filtered = await getEmployeesByCompany(companyId)
      setCompanyEmployees(filtered)
      alert('Employee deleted successfully')
    } catch (error: any) {
      console.error('Error deleting employee:', error)
      alert(`Error deleting employee: ${error.message}`)
    }
  }

  const handleSaveEmployee = async () => {
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.designation) {
      alert('Please fill in all required fields (First Name, Last Name, Email, Designation)')
      return
    }

    try {
      setSaving(true)
      
      if (showEditModal && editingEmployee) {
        // Update existing employee
        const selectedBranch = branches.find(b => b.id === formData.branchId)
        await updateEmployee(editingEmployee.id, {
          ...formData,
          branchName: selectedBranch ? selectedBranch.name : formData.branchName,
          dateOfJoining: formData.dateOfJoining ? new Date(formData.dateOfJoining) : undefined,
        })
        alert('Employee updated successfully')
        setShowEditModal(false)
      } else {
        // Create new employee
        if (!companyId || !companyName) {
          alert('Company information not found')
          return
        }
        
        const selectedBranch = branches.find(b => b.id === formData.branchId)
        await createEmployee({
          ...formData,
          companyId,
          companyName,
          branchName: selectedBranch ? selectedBranch.name : formData.branchName,
          dateOfJoining: formData.dateOfJoining ? new Date(formData.dateOfJoining) : undefined,
        })
        alert('Employee created successfully')
        setShowAddModal(false)
      }
      
      // Reload employees
      const filtered = await getEmployeesByCompany(companyId)
      setCompanyEmployees(filtered)
      resetForm()
      setEditingEmployee(null)
    } catch (error: any) {
      console.error('Error saving employee:', error)
      alert(`Error saving employee: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout actorType="company">
      <div>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            {companyName ? `${companyName} - Employee Management` : 'Employee Management'}
          </h1>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowUploadModal(true)}
              style={{ backgroundColor: companyPrimaryColor || '#f76b1c' }}
              className="text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center space-x-2"
            >
              <Upload className="h-5 w-5" />
              <span>Bulk Order Upload</span>
            </button>
            <button 
              onClick={handleAddEmployee}
              style={{ backgroundColor: companyPrimaryColor || '#f76b1c' }}
              className="text-white px-4 py-2 rounded-lg font-semibold hover:opacity-90 transition-opacity flex items-center space-x-2"
            >
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
              placeholder="Search employees by ID, name, email, designation, or branch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ 
                '--tw-ring-color': companyPrimaryColor || '#f76b1c'
              } as React.CSSProperties}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:border-transparent"
              onFocus={(e) => {
                e.target.style.borderColor = companyPrimaryColor || '#f76b1c'
                e.target.style.boxShadow = `0 0 0 2px ${companyPrimaryColor || '#f76b1c'}40`
              }}
              onBlur={(e) => {
                e.target.style.borderColor = ''
                e.target.style.boxShadow = ''
              }}
            />
          </div>
        </div>

        {/* Employee Table */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[calc(100vh-300px)] overflow-y-auto">
            <table className="w-full min-w-[1200px]">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold bg-gray-50 whitespace-nowrap">Employee ID</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold bg-gray-50 whitespace-nowrap">Name</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold bg-gray-50 whitespace-nowrap">Designation</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold bg-gray-50 whitespace-nowrap min-w-[200px]">Branch</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold bg-gray-50 whitespace-nowrap">Gender</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold bg-gray-50 whitespace-nowrap">Location</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold bg-gray-50 whitespace-nowrap">Email</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold bg-gray-50 whitespace-nowrap">Sizes</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold bg-gray-50 whitespace-nowrap">Status</th>
                  <th className="text-left py-4 px-6 text-gray-700 font-semibold bg-gray-50 whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-500">
                      Loading employees...
                    </td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="py-8 text-center text-gray-500">
                      {companyEmployees.length === 0 
                        ? 'No employees found' 
                        : `No employees match search "${searchTerm}" (${companyEmployees.length} total employees)`}
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((employee) => {
                    const masked = maskEmployeeData(employee)
                    return (
                      <tr key={employee.id} className="border-b hover:bg-gray-50">
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className="font-mono text-sm font-semibold" style={{ color: companyPrimaryColor || '#f76b1c' }}>
                            {employee.employeeId || 'N/A'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-900 font-medium whitespace-nowrap">
                          {masked.firstName} {masked.lastName}
                        </td>
                        <td className="py-4 px-6 text-gray-600 whitespace-nowrap">{employee.designation}</td>
                        <td className="py-4 px-6 text-gray-600 whitespace-nowrap min-w-[200px]">
                          <span className="block truncate max-w-[250px]" title={getBranchName(employee)}>
                            {getBranchName(employee)}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-gray-600 capitalize whitespace-nowrap">{employee.gender}</td>
                        <td className="py-4 px-6 text-gray-600 whitespace-nowrap">{employee.location}</td>
                        <td className="py-4 px-6 text-gray-600 whitespace-nowrap">{masked.email}</td>
                        <td className="py-4 px-6 text-gray-600 text-sm whitespace-nowrap">
                          Shirt: {employee.shirtSize}, Pant: {employee.pantSize}, Shoe: {employee.shoeSize}
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            employee.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {employee.status}
                          </span>
                        </td>
                        <td className="py-4 px-6 whitespace-nowrap">
                          <div className="flex space-x-2">
                            <button 
                              onClick={() => handleEditEmployee(employee)}
                              className="text-blue-600 hover:text-blue-700"
                              title="Edit Employee"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteEmployee(employee)}
                              className="text-red-600 hover:text-red-700"
                              title="Delete Employee"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
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
                      style={{ backgroundColor: companyPrimaryColor || '#f76b1c' }}
                      className="flex-1 text-white py-3 rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:bg-gray-400 disabled:cursor-not-allowed"
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

        {/* Add Employee Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Add New Employee</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile *</label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => {
                      const selectedBranch = branches.find(b => b.id === e.target.value)
                      setFormData({ 
                        ...formData, 
                        branchId: e.target.value,
                        branchName: selectedBranch ? selectedBranch.name : ''
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                  >
                    <option value="">No Branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shirt Size *</label>
                  <input
                    type="text"
                    value={formData.shirtSize}
                    onChange={(e) => setFormData({ ...formData, shirtSize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pant Size *</label>
                  <input
                    type="text"
                    value={formData.pantSize}
                    onChange={(e) => setFormData({ ...formData, pantSize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shoe Size *</label>
                  <input
                    type="text"
                    value={formData.shoeSize}
                    onChange={(e) => setFormData({ ...formData, shoeSize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dispatch Preference *</label>
                  <select
                    value={formData.dispatchPreference}
                    onChange={(e) => setFormData({ ...formData, dispatchPreference: e.target.value as 'direct' | 'central' | 'regional' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  >
                    <option value="direct">Direct</option>
                    <option value="central">Central</option>
                    <option value="regional">Regional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining *</label>
                  <input
                    type="date"
                    value={formData.dateOfJoining}
                    onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEmployee}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Save className="h-5 w-5" />
                  <span>{saving ? 'Saving...' : 'Save Employee'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Employee Modal */}
        {showEditModal && editingEmployee && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-xl p-8 max-w-4xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Edit Employee</h2>
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingEmployee(null)
                    resetForm()
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mobile *</label>
                  <input
                    type="tel"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Designation *</label>
                  <input
                    type="text"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender *</label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'male' | 'female' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location *</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  <select
                    value={formData.branchId}
                    onChange={(e) => {
                      const selectedBranch = branches.find(b => b.id === e.target.value)
                      setFormData({ 
                        ...formData, 
                        branchId: e.target.value,
                        branchName: selectedBranch ? selectedBranch.name : ''
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                  >
                    <option value="">No Branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shirt Size *</label>
                  <input
                    type="text"
                    value={formData.shirtSize}
                    onChange={(e) => setFormData({ ...formData, shirtSize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pant Size *</label>
                  <input
                    type="text"
                    value={formData.pantSize}
                    onChange={(e) => setFormData({ ...formData, pantSize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Shoe Size *</label>
                  <input
                    type="text"
                    value={formData.shoeSize}
                    onChange={(e) => setFormData({ ...formData, shoeSize: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dispatch Preference *</label>
                  <select
                    value={formData.dispatchPreference}
                    onChange={(e) => setFormData({ ...formData, dispatchPreference: e.target.value as 'direct' | 'central' | 'regional' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  >
                    <option value="direct">Direct</option>
                    <option value="central">Central</option>
                    <option value="regional">Regional</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'active' | 'inactive' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Joining *</label>
                  <input
                    type="date"
                    value={formData.dateOfJoining}
                    onChange={(e) => setFormData({ ...formData, dateOfJoining: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#f76b1c] focus:border-transparent"
                    required
                  />
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false)
                    setEditingEmployee(null)
                    resetForm()
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEmployee}
                  disabled={saving}
                  className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  <Save className="h-5 w-5" />
                  <span>{saving ? 'Saving...' : 'Update Employee'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}








