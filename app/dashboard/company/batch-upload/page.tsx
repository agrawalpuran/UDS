'use client'

import { useState } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Upload, Download, FileText, CheckCircle } from 'lucide-react'

export default function BatchUploadPage() {
  const [file, setFile] = useState<File | null>(null)
  const [uploaded, setUploaded] = useState(false)
  const [orderFile, setOrderFile] = useState<File | null>(null)
  const [orderUploaded, setOrderUploaded] = useState(false)

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
    }
  }

  const handleOrderUpload = () => {
    if (orderFile) {
      // Simulate upload
      setTimeout(() => {
        setOrderUploaded(true)
        alert('Bulk order upload successful! Orders have been created in the system.')
      }, 1500)
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
    const csvContent = `Employee ID,Product ID,Product Name,Size,Quantity,Delivery Address
IND-001,PROD-001,Formal Shirt,L,2,123 Main St New York NY 10001
IND-002,PROD-002,Formal Pant,32,2,456 Market St San Francisco CA 94102
IND-001,PROD-003,Formal Shoes,9,1,123 Main St New York NY 10001`
    
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
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Batch Employee Upload</h1>

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
                    <label className="inline-block bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors cursor-pointer">
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
                className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 transition-colors"
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
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Bulk Order Upload</h1>

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

              {orderFile && !orderUploaded && (
                <button
                  onClick={handleOrderUpload}
                  className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Upload and Process Orders
                </button>
              )}

              {orderUploaded && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center space-x-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">Upload Successful!</p>
                    <p className="text-sm text-green-700">Bulk orders have been created in the system.</p>
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
                    <li>Employee ID (e.g., IND-001)</li>
                    <li>Product ID (e.g., PROD-001)</li>
                    <li>Product Name</li>
                    <li>Size (e.g., L, M, S for shirts; 32, 34 for pants; 9, 10 for shoes)</li>
                    <li>Quantity</li>
                    <li>Delivery Address</li>
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Important Notes:</h3>
                  <ul className="list-disc list-inside text-gray-600 space-y-1 text-sm">
                    <li>Ensure Employee IDs exist in the system before uploading</li>
                    <li>Product IDs must match existing products in the catalog</li>
                    <li>Orders will be created with status "Awaiting approval"</li>
                    <li>Each row represents one order item</li>
                    <li>Multiple items for the same employee will be grouped into one order</li>
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











