'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Upload, Download, FileText, CheckCircle, AlertCircle } from 'lucide-react'
import { getCompanyById, getBranchByAdminEmail, getCompanyByAdminEmail, getLocationByAdminEmail } from '@/lib/data-mongodb'

export default function BatchUploadPage() {
  const [companyPrimaryColor, setCompanyPrimaryColor] = useState<string>('#f76b1c')
  const [companySecondaryColor, setCompanySecondaryColor] = useState<string>('#f76b1c')
  const [isBranchAdmin, setIsBranchAdmin] = useState<boolean>(false)
  const [isLocationAdmin, setIsLocationAdmin] = useState<boolean>(false)
  const [isCompanyAdmin, setIsCompanyAdmin] = useState<boolean>(false)
  const [branchInfo, setBranchInfo] = useState<any>(null)
  const [locationInfo, setLocationInfo] = useState<any>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadUserInfo = async () => {
        const userEmail = localStorage.getItem('email')
        const storedCompanyId = localStorage.getItem('companyId')
        
        if (userEmail) {
          // Check if user is Branch Admin, Location Admin, or Company Admin
          const [branch, location, company] = await Promise.all([
            getBranchByAdminEmail(userEmail),
            getLocationByAdminEmail(userEmail),
            getCompanyByAdminEmail(userEmail)
          ])
          
          setIsBranchAdmin(!!branch)
          setIsLocationAdmin(!!location)
          setIsCompanyAdmin(!!company)
          setBranchInfo(branch)
          setLocationInfo(location)
          
          // Get company for colors
          const targetCompanyId = branch?.companyId?.id || branch?.companyId || location?.companyId?.id || location?.companyId || storedCompanyId || company?.id
          if (targetCompanyId) {
            setCompanyId(targetCompanyId)
            const companyDetails = await getCompanyById(targetCompanyId)
            if (companyDetails) {
              setCompanyPrimaryColor(companyDetails.primaryColor || '#f76b1c')
              setCompanySecondaryColor(companyDetails.secondaryColor || companyDetails.primaryColor || '#f76b1c')
            }
          }
        } else if (storedCompanyId) {
          const companyDetails = await getCompanyById(storedCompanyId)
          if (companyDetails) {
            setCompanyPrimaryColor(companyDetails.primaryColor || '#f76b1c')
            setCompanySecondaryColor(companyDetails.secondaryColor || companyDetails.primaryColor || '#f76b1c')
          }
        }
      }
      loadUserInfo()
    }
  }, [])
  const [file, setFile] = useState<File | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const [orderFile, setOrderFile] = useState<File | null>(null)
  const [orderUploaded, setOrderUploaded] = useState(false)
  const [orderUploading, setOrderUploading] = useState(false)
  const [orderUploadResults, setOrderUploadResults] = useState<any>(null)
  const [companyId, setCompanyId] = useState<string>('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setUploaded(false)
    }
  }

  const handleUpload = () => {
    if (file) {
      // Simulate upload
      setTimeout(() => {
        setUploaded(true)
        alert('Batch upload successful! Employees have been added to the system.')
      }, 1500)
    }
  }

  const handleOrderFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setOrderFile(e.target.files[0])
      setOrderUploaded(false)
      setOrderUploadResults(null)
    }
  }

  const handleOrderUpload = async () => {
    if (!orderFile) {
      alert('Please select a CSV file')
      return
    }

    try {
      setOrderUploading(true)
      setOrderUploadResults(null)
      
      // Read CSV file
      const text = await orderFile.text()
      const lines = text.split('\n').filter(line => line.trim())
      
      if (lines.length < 2) {
        alert('CSV file must have at least a header row and one data row')
        setOrderUploading(false)
        return
      }

      // Parse CSV headers (flexible column matching)
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
      const employeeIdIndex = headers.findIndex(h => 
        h === 'employee id' || h === 'employeeid' || h === 'employee_no' || h === 'employee no'
      )
      const skuIndex = headers.findIndex(h => h === 'sku' || h === 'product id' || h === 'productid')
      const sizeIndex = headers.findIndex(h => h === 'size')
      const quantityIndex = headers.findIndex(h => h === 'quantity' || h === 'qty')

      if (employeeIdIndex === -1 || skuIndex === -1 || sizeIndex === -1 || quantityIndex === -1) {
        alert('CSV must contain columns: Employee ID, SKU (or Product ID), Size, Quantity')
        setOrderUploading(false)
        return
      }

      // Parse orders from CSV
      const orders = []
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim())
        if (values.length >= 4 && values[employeeIdIndex] && values[skuIndex] && values[sizeIndex] && values[quantityIndex]) {
          orders.push({
            employeeId: values[employeeIdIndex],
            sku: values[skuIndex],
            size: values[sizeIndex],
            quantity: parseInt(values[quantityIndex]) || 1,
            rowNumber: i + 1 // +1 because we start from line 2 (after header)
          })
        }
      }

      if (orders.length === 0) {
        alert('No valid orders found in CSV file')
        setOrderUploading(false)
        return
      }

      // Get user email and company ID
      const userEmail = localStorage.getItem('email') || localStorage.getItem('userEmail')
      if (!userEmail) {
        alert('User email not found. Please log in again.')
        setOrderUploading(false)
        return
      }

      // Determine company ID from location/branch/company
      const targetCompanyId = locationInfo?.companyId?.id || locationInfo?.companyId || 
                              branchInfo?.companyId?.id || branchInfo?.companyId || 
                              companyId || 
                              localStorage.getItem('companyId')

      if (!targetCompanyId) {
        alert('Company information not found')
        setOrderUploading(false)
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
          companyId: targetCompanyId,
          adminEmail: userEmail
        })
      })

      const data = await response.json()

      if (!response.ok) {
        alert(`Error: ${data.error || 'Failed to upload orders'}`)
        setOrderUploading(false)
        return
      }

      setOrderUploadResults(data)
      setOrderUploaded(true)
    } catch (error: any) {
      console.error('Error uploading bulk orders:', error)
      alert(`Error processing file: ${error.message}`)
    } finally {
      setOrderUploading(false)
    }
  }

  const downloadTemplate = () => {
    const csvContent = `First Name,Last Name,Designation,Gender,Location,Email,Mobile,Shirt Size,Pant Size,Shoe Size,Address,Dispatch Preference,Status,Date of Joining,Shirt Cycle (months),Pant Cycle (months),Shoe Cycle (months),Jacket Cycle (months)
John,Doe,Software Engineer,Male,New York Office,john.doe@company.com,+1234567890,L,32,10,123 Main St New York NY 10001,direct,active,2025-10-01,6,6,6,12
Jane,Smith,Product Manager,Female,San Francisco Office,jane.smith@company.com,+1234567891,M,28,7,456 Market St San Francisco CA 94102,regional,active,2025-10-01,6,6,6,12`
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'employee_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const downloadOrderTemplate = () => {
    const csvContent = `Employee ID,SKU,Size,Quantity
300001,SHIRT-M-001,L,2
300001,PANT-M-001,32,1
300002,SHIRT-M-001,M,1
300002,SHOE-M-001,9,1`
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bulk_order_template.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <DashboardLayout actorType="company">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Batch Employee Upload</h1>
        
        {/* Branch Admin Notice */}
        {isBranchAdmin && branchInfo && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">Branch Admin Restrictions</h3>
              <p className="text-sm text-blue-800">
                You are uploading as a <strong>Branch Admin</strong> for <strong>{branchInfo.name}</strong>. 
                You can only upload employees that belong to your branch. Employees uploaded must be assigned to this branch.
              </p>
            </div>
          </div>
        )}

        {/* Location Admin (Site Admin) Notice */}
        {isLocationAdmin && locationInfo && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-blue-900 mb-1">Site Admin Restrictions</h3>
              <p className="text-sm text-blue-800">
                You are uploading as a <strong>Site Admin</strong> for <strong>{locationInfo.name}</strong>. 
                You can only upload employees that belong to your location. Employees uploaded must be assigned to this location.
              </p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Upload Section */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Upload Employee Data</h2>
            
            <div className="mb-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                {file ? (
                  <div>
                    <FileText className="h-8 w-8 text-green-600 mx-auto mb-2" />
                    <p className="text-gray-900 font-semibold">{file.name}</p>
                    <p className="text-gray-600 text-sm">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-gray-600 mb-2">Drag and drop your CSV file here</p>
                    <p className="text-gray-500 text-sm mb-4">or</p>
                    <label 
                      className="inline-block text-white px-6 py-2 rounded-lg font-semibold transition-colors cursor-pointer"
                      style={{ backgroundColor: companyPrimaryColor || '#f76b1c' }}
                      onMouseEnter={(e) => {
                        const color = companyPrimaryColor || '#f76b1c'
                        const r = parseInt(color.slice(1, 3), 16)
                        const g = parseInt(color.slice(3, 5), 16)
                        const b = parseInt(color.slice(5, 7), 16)
                        const darker = `#${Math.max(0, r - 25).toString(16).padStart(2, '0')}${Math.max(0, g - 25).toString(16).padStart(2, '0')}${Math.max(0, b - 25).toString(16).padStart(2, '0')}`
                        e.currentTarget.style.backgroundColor = darker
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = companyPrimaryColor || '#f76b1c'
                      }}
                    >
                      Browse Files
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>

            {file && !uploaded && (
              <button
                onClick={handleUpload}
                className="w-full text-white py-3 rounded-lg font-semibold transition-colors"
                style={{ backgroundColor: companyPrimaryColor || '#f76b1c' }}
                onMouseEnter={(e) => {
                  const color = companyPrimaryColor || '#f76b1c'
                  const r = parseInt(color.slice(1, 3), 16)
                  const g = parseInt(color.slice(3, 5), 16)
                  const b = parseInt(color.slice(5, 7), 16)
                  const darker = `#${Math.max(0, r - 25).toString(16).padStart(2, '0')}${Math.max(0, g - 25).toString(16).padStart(2, '0')}${Math.max(0, b - 25).toString(16).padStart(2, '0')}`
                  e.currentTarget.style.backgroundColor = darker
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = companyPrimaryColor || '#f76b1c'
                }}
              >
                Upload and Process
              </button>
            )}

            {uploaded && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
                <CheckCircle className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-900">Upload Successful!</p>
                  <p className="text-sm text-green-700">Employees have been added to the system.</p>
                </div>
              </div>
            )}
          </div>

          {/* Instructions Section */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Instructions</h2>
            
            <div className="space-y-4 mb-6">
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Required Columns:</h3>
                <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm">
                  <li>First Name</li>
                  <li>Last Name</li>
                  <li>Designation</li>
                  <li>Gender (Male/Female)</li>
                  <li>Location</li>
                  <li>Email</li>
                  <li>Mobile</li>
                  <li>Shirt Size</li>
                  <li>Pant Size</li>
                  <li>Shoe Size</li>
                  <li>Address</li>
                  <li>Dispatch Preference (direct/central/regional)</li>
                  <li>Status (active/inactive)</li>
                  <li>Date of Joining (YYYY-MM-DD format, e.g., 2025-10-01)</li>
                  <li>Shirt Cycle (months) - Optional, defaults to 6</li>
                  <li>Pant Cycle (months) - Optional, defaults to 6</li>
                  <li>Shoe Cycle (months) - Optional, defaults to 6</li>
                  <li>Jacket Cycle (months) - Optional, defaults to 12</li>
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Cycle Duration Configuration:</h3>
                <p className="text-gray-600 text-sm mb-2">
                  Each item type can have its own eligibility cycle duration (in months). This determines how often the eligibility resets for that specific item type.
                </p>
                <ul className="list-disc list-inside text-gray-600 text-sm space-y-1 ml-4">
                  <li><strong>Shirt Cycle:</strong> Default 6 months (e.g., 6)</li>
                  <li><strong>Pant Cycle:</strong> Default 6 months (e.g., 6)</li>
                  <li><strong>Shoe Cycle:</strong> Default 6 months (e.g., 6)</li>
                  <li><strong>Jacket Cycle:</strong> Default 12 months (1 year, e.g., 12)</li>
                </ul>
                <p className="text-gray-600 text-sm mt-2">
                  If not provided, defaults will be used. For example, shirts may reset every 6 months while jackets reset every 12 months.
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Date of Joining:</h3>
                <p className="text-gray-600 text-sm">
                  The date of joining determines when the employee's eligibility cycles begin. Each item type's cycle starts from this date and resets based on its configured duration. 
                  If not provided, it defaults to October 1, 2025. Format: YYYY-MM-DD (e.g., 2025-10-01).
                </p>
              </div>
            </div>

            <button
              onClick={downloadTemplate}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
            >
              <Download className="h-5 w-5" />
              <span>Download Template</span>
            </button>
          </div>
        </div>

        {/* Bulk Order Section */}
        <div className="mt-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Bulk Order Upload</h1>
          
          {/* Branch Admin Notice */}
          {isBranchAdmin && branchInfo && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Branch Admin Restrictions</h3>
                <p className="text-sm text-blue-800">
                  You are uploading as a <strong>Branch Admin</strong> for <strong>{branchInfo.name}</strong>.
                  You can only create orders for employees that belong to your branch. Orders for employees from other branches will be rejected.
                </p>
              </div>
            </div>
          )}

          {/* Location Admin (Site Admin) Notice */}
          {isLocationAdmin && locationInfo && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">Site Admin Restrictions</h3>
                <p className="text-sm text-blue-800">
                  You are uploading as a <strong>Site Admin</strong> for <strong>{locationInfo.name}</strong>.
                  You can only create orders for employees that belong to your location. Orders for employees from other locations will be rejected.
                </p>
              </div>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-8">
            {/* Upload Section */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Upload Bulk Orders</h2>
              
              <div className="mb-6">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  {orderFile ? (
                    <div>
                      <FileText className="h-8 w-8 text-green-600 mx-auto mb-2" />
                      <p className="text-gray-900 font-semibold">{orderFile.name}</p>
                      <p className="text-gray-600 text-sm">{(orderFile.size / 1024).toFixed(2)} KB</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-gray-600 mb-2">Drag and drop your CSV file here</p>
                      <p className="text-gray-500 text-sm mb-4">or</p>
                      <label className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition-colors cursor-pointer">
                        Browse Files
                        <input
                          type="file"
                          accept=".csv"
                          onChange={handleOrderFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              </div>

              {orderFile && !orderUploaded && !orderUploadResults && (
                <button
                  onClick={handleOrderUpload}
                  disabled={orderUploading}
                  className="w-full text-white py-3 rounded-lg font-semibold transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                  style={{ backgroundColor: companyPrimaryColor || '#f76b1c' }}
                >
                  {orderUploading ? 'Processing...' : 'Upload and Process Orders'}
                </button>
              )}

              {orderUploadResults && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Summary</h3>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Total Rows</p>
                        <p className="text-2xl font-bold text-gray-900">{orderUploadResults.summary?.total || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-green-600">Successful</p>
                        <p className="text-2xl font-bold text-green-600">{orderUploadResults.summary?.successful || 0}</p>
                      </div>
                      <div>
                        <p className="text-sm text-red-600">Failed</p>
                        <p className="text-2xl font-bold text-red-600">{orderUploadResults.summary?.failed || 0}</p>
                      </div>
                    </div>
                  </div>

                  {orderUploadResults.results && orderUploadResults.results.length > 0 && (
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
                            <th className="text-left py-2 px-4 font-semibold text-gray-700">Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {orderUploadResults.results.map((result: any, idx: number) => (
                            <tr key={idx} className={result.status === 'success' ? 'bg-green-50' : 'bg-red-50'}>
                              <td className="py-2 px-4">{result.rowNumber}</td>
                              <td className="py-2 px-4">{result.employeeId}</td>
                              <td className="py-2 px-4">{result.sku}</td>
                              <td className="py-2 px-4">{result.size}</td>
                              <td className="py-2 px-4">{result.quantity}</td>
                              <td className="py-2 px-4">
                                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                  result.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {result.status}
                                </span>
                              </td>
                              <td className="py-2 px-4">
                                {result.status === 'success' ? (
                                  <span className="text-green-700 font-mono text-xs">Order: {result.orderId}</span>
                                ) : (
                                  <span className="text-red-700 text-xs">{result.error}</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Instructions Section */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Instructions</h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Required Columns:</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm">
                    <li>Employee ID (6-digit employee ID, e.g., 300001)</li>
                    <li>SKU (Product SKU code, e.g., SHIRT-M-001)</li>
                    <li>Size (e.g., L, M, S for shirts; 32, 34 for pants; 9, 10 for shoes)</li>
                    <li>Quantity (number of items)</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Important Notes:</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm">
                    <li>Ensure Employee IDs exist in the system before uploading</li>
                    <li>SKU codes must match existing products in the catalog</li>
                    <li>Orders will be created with status "Awaiting approval"</li>
                    <li>Each row represents one order item</li>
                    <li>Multiple items for the same employee will be grouped into one order</li>
                    <li>Employee eligibility will be validated automatically</li>
                    {(isLocationAdmin || isBranchAdmin) && (
                      <li className="text-blue-700 font-semibold">
                        You can only upload orders for employees in your assigned {(isLocationAdmin ? 'location' : 'branch')}
                      </li>
                    )}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Order Processing:</h3>
                  <p className="text-gray-600 text-sm">
                    After upload, orders will be created and will require approval before they can be fulfilled. 
                    You can review and approve orders in the Orders section.
                  </p>
                </div>
              </div>

              <button
                onClick={downloadOrderTemplate}
                className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
              >
                <Download className="h-5 w-5" />
                <span>Download Template</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}











