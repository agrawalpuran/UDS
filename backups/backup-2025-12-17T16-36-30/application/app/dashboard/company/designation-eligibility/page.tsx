'use client'

import { useState, useEffect } from 'react'
import DashboardLayout from '@/components/DashboardLayout'
import { Plus, Edit, Trash2, Save, X, CheckCircle } from 'lucide-react'
import {
  getDesignationEligibilitiesByCompany,
  createDesignationEligibility,
  updateDesignationEligibility,
  deleteDesignationEligibility,
  getProductsByCompany,
  getAllProductsByCompany,
  getUniqueDesignationsByCompany,
} from '@/lib/data-mongodb'

// Category mapping for display
const CATEGORY_LABELS: Record<string, string> = {
  'shirt': 'Shirts',
  'trouser': 'Trousers/Pants',
  'pant': 'Trousers/Pants',
  'shoe': 'Shoes',
  'blazer': 'Blazers/Jackets',
  'jacket': 'Blazers/Jackets',
  'accessory': 'Accessories',
}

interface ItemEligibilityForm {
  quantity: number
  renewalFrequency: number
  renewalUnit: 'months' | 'years'
}

export default function DesignationEligibilityPage() {
  const [companyId, setCompanyId] = useState<string>('')
  const [eligibilities, setEligibilities] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([]) // Products with vendor fulfillment (for catalog)
  const [allProducts, setAllProducts] = useState<any[]>([]) // All products linked to company (for category extraction)
  const [availableDesignations, setAvailableDesignations] = useState<string[]>([])
  const [availableCategories, setAvailableCategories] = useState<Array<{ id: string; label: string; count: number }>>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState({
    designation: '',
    gender: 'male' as 'male' | 'female', // Removed 'unisex' - unisex products appear under both Male and Female
    allowedProductCategories: [] as string[],
    itemEligibility: {} as Record<string, ItemEligibilityForm>,
  })
  const [refreshEligibility, setRefreshEligibility] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const loadData = async () => {
        try {
          setLoading(true)
          const storedCompanyId = localStorage.getItem('companyId')
          if (storedCompanyId) {
            setCompanyId(storedCompanyId)
            const [eligibilitiesData, productsData, allProductsData, designationsData] = await Promise.all([
              getDesignationEligibilitiesByCompany(storedCompanyId),
              getProductsByCompany(storedCompanyId), // For filtering by vendor fulfillment (catalog)
              getAllProductsByCompany(storedCompanyId), // For category extraction (all linked products)
              getUniqueDesignationsByCompany(storedCompanyId),
            ])
            setEligibilities(eligibilitiesData)
            setProducts(productsData)
            setAllProducts(allProductsData) // Store all products for category filtering
            setAvailableDesignations(designationsData)
            
            // Extract unique categories from ALL company products (not just those with vendor fulfillment)
            // IMPORTANT: Always show standard categories even if no products exist
            // This allows admins to configure eligibility for all categories upfront
            const categoryMap = new Map<string, number>()
            
            // First, initialize standard categories with 0 count (ensures they always appear)
            const standardCategories = ['shirt', 'trouser', 'shoe', 'blazer', 'accessory']
            standardCategories.forEach(cat => {
              categoryMap.set(cat, 0)
            })
            
            // Then, extract categories from products and update counts
            allProductsData.forEach((product: any) => {
              if (product.category) {
                const normalizedCategory = normalizeCategoryName(product.category)
                const currentCount = categoryMap.get(normalizedCategory) || 0
                categoryMap.set(normalizedCategory, currentCount + 1)
              }
            })
            
            // Also check for any additional categories that might not be standard
            // (e.g., custom categories added by vendors)
            allProductsData.forEach((product: any) => {
              if (product.category) {
                const normalizedCategory = normalizeCategoryName(product.category)
                // If it's not a standard category and not already in map, add it
                if (!standardCategories.includes(normalizedCategory) && !categoryMap.has(normalizedCategory)) {
                  categoryMap.set(normalizedCategory, 1)
                }
              }
            })
            
            const categories = Array.from(categoryMap.entries()).map(([id, count]) => ({
              id,
              label: CATEGORY_LABELS[id] || id.charAt(0).toUpperCase() + id.slice(1),
              count,
            })).sort((a, b) => a.label.localeCompare(b.label))
            
            // Debug logging
            console.log('📋 Extracted categories from allProductsData:', {
              totalProducts: allProductsData.length,
              categories: categories.map(c => ({ id: c.id, label: c.label, count: c.count })),
              productsByCategory: Array.from(categoryMap.entries()).map(([id, count]) => ({
                category: id,
                count,
                products: allProductsData
                  .filter((p: any) => normalizeCategoryName(p.category || '') === id)
                  .map((p: any) => ({ name: p.name, category: p.category, gender: p.gender }))
              }))
            })
            
            setAvailableCategories(categories)
          }
        } catch (error) {
          console.error('Error loading data:', error)
        } finally {
          setLoading(false)
        }
      }
      loadData()
    }
  }, [])

  // Debug: Log formData changes to track state updates
  useEffect(() => {
    if (formData.allowedProductCategories.length > 0) {
      console.log('📊 formData.itemEligibility changed:', JSON.stringify(formData.itemEligibility, null, 2))
    }
  }, [formData.itemEligibility])

  // Normalize category names (handle variations)
  const normalizeCategoryName = (category: string): string => {
    if (!category) return ''
    const lower = category.toLowerCase().trim()
    if (lower.includes('shirt')) return 'shirt'
    if (lower.includes('trouser') || lower.includes('pant')) return 'trouser'
    if (lower.includes('shoe')) return 'shoe'
    if (lower.includes('blazer') || lower.includes('jacket')) return 'blazer'
    if (lower.includes('accessory')) return 'accessory'
    return lower
  }

  // Get available categories filtered by a specific gender
  // IMPORTANT: When gender is Male, show categories with Male OR Unisex products
  // When gender is Female, show categories with Female OR Unisex products
  // Unisex products appear under both Male and Female views
  const getFilteredCategoriesForGender = (gender: 'male' | 'female') => {
    // For specific genders, show categories that have products matching that gender OR unisex
    // This ensures unisex products are available for configuration under both Male and Female
    // Use allProducts (not products) to include all linked products, not just those with vendor fulfillment
    const filtered = availableCategories.filter(category => {
      const matchingProducts = allProducts.filter((product: any) => {
        const productCategory = normalizeCategoryName(product.category || '')
        const categoryMatches = productCategory === category.id
        
        // Show products that match the selected gender OR are unisex
        // This ensures unisex products appear under both Male and Female
        if (categoryMatches) {
          const productGender = (product.gender || 'unisex').toLowerCase()
          return productGender === gender || productGender === 'unisex'
        }
        return false
      })
      
      // Show category if it has products matching the gender OR unisex
      return matchingProducts.length > 0
    })
    
    // Debug logging
    console.log(`🎯 Filtered categories for gender "${gender}":`, {
      totalCategories: availableCategories.length,
      filteredCategories: filtered.length,
      categories: filtered.map(c => c.id),
      allCategories: availableCategories.map(c => c.id)
    })
    
    return filtered
  }

  // Get available categories filtered by selected gender
  const getFilteredCategories = () => {
    return getFilteredCategoriesForGender(formData.gender)
  }

  const handleToggleCategory = (categoryId: string) => {
    setFormData((prev) => {
      const newCategories = prev.allowedProductCategories.includes(categoryId)
        ? prev.allowedProductCategories.filter((id) => id !== categoryId)
        : [...prev.allowedProductCategories, categoryId]
      
      // Initialize item eligibility for newly added categories
      const newItemEligibility = { ...prev.itemEligibility }
      if (!prev.allowedProductCategories.includes(categoryId) && newCategories.includes(categoryId)) {
        // Initialize with valid defaults (not 0, so validation passes)
        newItemEligibility[categoryId] = {
          quantity: 1,
          renewalFrequency: 6,
          renewalUnit: 'months',
        }
      } else if (!newCategories.includes(categoryId)) {
        // Remove item eligibility for removed category
        delete newItemEligibility[categoryId]
      }
      
      return {
        ...prev,
        allowedProductCategories: newCategories,
        itemEligibility: newItemEligibility,
      }
    })
  }

  const handleItemEligibilityChange = (categoryId: string, field: keyof ItemEligibilityForm, value: number | string) => {
    setFormData((prev) => {
      const currentItemElig = prev.itemEligibility[categoryId] || {
        quantity: 1,
        renewalFrequency: 6,
        renewalUnit: 'months' as 'months' | 'years',
      }
      
      // Ensure numeric fields are properly handled
      let newValue = value
      if (field === 'quantity' || field === 'renewalFrequency') {
        const numValue = typeof value === 'number' ? value : parseInt(String(value), 10)
        // Accept 0 as a valid temporary value (user might be clearing the field to type)
        // Only default if it's NaN or negative
        if (isNaN(numValue) || numValue < 0) {
          // Don't default here - let the onBlur handler set defaults
          // This allows user to clear field and type new value
          newValue = numValue < 0 ? 0 : (field === 'quantity' ? 1 : 6)
        } else {
          // Preserve the actual value entered, including 0 (which will be validated on blur)
          newValue = numValue
        }
      }
      
      const updatedItemEligibility = {
        ...prev.itemEligibility,
        [categoryId]: {
          ...currentItemElig,
          [field]: newValue,
        },
      }
      
      console.log(`handleItemEligibilityChange - ${categoryId}.${field}:`, {
        oldValue: currentItemElig[field],
        newValue,
        updatedItemEligibility: updatedItemEligibility[categoryId],
      })
      
      return {
        ...prev,
        itemEligibility: updatedItemEligibility,
      }
    })
  }

  const handleAdd = async () => {
    if (!formData.designation || formData.allowedProductCategories.length === 0) {
      alert('Please fill in designation and select at least one product category')
      return
    }

    // Validate item eligibility for selected categories
    for (const categoryId of formData.allowedProductCategories) {
      const itemElig = formData.itemEligibility[categoryId]
      const categoryLabel = availableCategories.find(c => c.id === categoryId)?.label || categoryId
      if (!itemElig || itemElig.quantity <= 0) {
        alert(`Please set a valid quantity (greater than 0) for ${categoryLabel}`)
        return
      }
      if (!itemElig.renewalFrequency || itemElig.renewalFrequency <= 0) {
        alert(`Please set a valid renewal frequency for ${categoryLabel}`)
        return
      }
    }

    try {
      // Build itemEligibility object with proper category mapping
      const itemEligibility: any = {}
      for (const categoryId of formData.allowedProductCategories) {
        const itemElig = formData.itemEligibility[categoryId]
        console.log(`Building itemEligibility for ${categoryId}:`, {
          raw: itemElig,
          quantity: itemElig?.quantity,
          renewalFrequency: itemElig?.renewalFrequency,
          renewalUnit: itemElig?.renewalUnit,
        })
        
        if (itemElig && itemElig.quantity > 0 && itemElig.renewalFrequency > 0) {
          // Create a clean copy to ensure values are preserved
          const cleanItemElig = {
            quantity: Number(itemElig.quantity),
            renewalFrequency: Number(itemElig.renewalFrequency),
            renewalUnit: itemElig.renewalUnit || 'months',
          }
          
          console.log(`  ✅ Clean itemElig for ${categoryId}:`, cleanItemElig)
          
          // Map category IDs to model field names
          if (categoryId === 'trouser') {
            itemEligibility.trouser = cleanItemElig
            itemEligibility.pant = cleanItemElig // Also set pant alias
          } else if (categoryId === 'blazer') {
            itemEligibility.blazer = cleanItemElig
            itemEligibility.jacket = cleanItemElig // Also set jacket alias
          } else {
            itemEligibility[categoryId] = cleanItemElig
          }
        } else {
          console.warn(`  ⚠️ Skipping ${categoryId} - invalid itemElig:`, itemElig)
        }
      }

      console.log('📤 Creating eligibility - FINAL DATA BEING SENT:', {
        companyId,
        designation: formData.designation,
        allowedProductCategories: formData.allowedProductCategories,
        formDataItemEligibility: JSON.stringify(formData.itemEligibility, null, 2),
        builtItemEligibility: JSON.stringify(itemEligibility, null, 2),
        gender: formData.gender,
      })

      const newEligibility = await createDesignationEligibility(
        companyId,
        formData.designation,
        formData.allowedProductCategories,
        itemEligibility,
        formData.gender
      )
      
      console.log('Create response:', newEligibility)
      
      if (!newEligibility) {
        throw new Error('Failed to create eligibility - no response from server')
      }
      
      // Reload the entire list to ensure we have fresh data with proper decryption
      if (companyId) {
        const refreshedEligibilities = await getDesignationEligibilitiesByCompany(companyId)
        setEligibilities(refreshedEligibilities)
      } else {
        setEligibilities([...eligibilities, newEligibility])
      }
      
      setFormData({ designation: '', gender: 'male', allowedProductCategories: [], itemEligibility: {} })
      setShowAddForm(false)
    } catch (error: any) {
      console.error('Error creating eligibility:', error)
      alert(`Error creating eligibility: ${error.message || 'Unknown error occurred'}`)
    }
  }

  const handleEdit = (eligibility: any) => {
    setRefreshEligibility(false) // Reset checkbox when editing
    console.log('🔍 handleEdit - Loading eligibility:', {
      id: eligibility.id,
      designation: eligibility.designation,
      itemEligibility: eligibility.itemEligibility ? JSON.stringify(eligibility.itemEligibility, null, 2) : 'none',
      allowedProductCategories: eligibility.allowedProductCategories,
    })
    
    setEditingId(eligibility.id)
    
    // Initialize item eligibility from existing data
    // IMPORTANT: Load ALL existing itemEligibility data, not just for selected categories
    // This preserves data for categories that exist in DB but aren't in allowedProductCategories
    const itemElig: Record<string, ItemEligibilityForm> = {}
    const categories = eligibility.allowedProductCategories || []
    
    // First, load ALL existing itemEligibility from DB (preserve everything)
    if (eligibility.itemEligibility && typeof eligibility.itemEligibility === 'object') {
      for (const [key, value] of Object.entries(eligibility.itemEligibility)) {
        if (value && typeof value === 'object' && 'quantity' in value && 'renewalFrequency' in value) {
          // Map DB field names to form category IDs (handle aliases)
          let categoryId = key
          if (key === 'pant') categoryId = 'trouser' // Normalize pant -> trouser
          if (key === 'trouser') categoryId = 'trouser'
          if (key === 'jacket') categoryId = 'blazer' // Normalize jacket -> blazer
          if (key === 'blazer') categoryId = 'blazer'
          
          const qty = typeof (value as any).quantity === 'number' ? (value as any).quantity : ((value as any).quantity ? Number((value as any).quantity) : 0)
          const freq = typeof (value as any).renewalFrequency === 'number' ? (value as any).renewalFrequency : ((value as any).renewalFrequency ? Number((value as any).renewalFrequency) : 0)
          const unit = ((value as any).renewalUnit === 'months' || (value as any).renewalUnit === 'years') ? (value as any).renewalUnit : 'months'
          
          itemElig[categoryId] = {
            quantity: qty > 0 ? qty : 1,
            renewalFrequency: freq > 0 ? freq : 6,
            renewalUnit: unit,
          }
          
          console.log(`  ✅ Loaded ${key} (mapped to ${categoryId}) from DB:`, itemElig[categoryId])
        }
      }
    }
    
    // Then, ensure all selected categories have itemEligibility data (initialize missing ones)
    for (const categoryId of categories) {
      if (!itemElig[categoryId]) {
        // Check for aliases in existing data
        let elig = null
        if (eligibility.itemEligibility) {
          elig = eligibility.itemEligibility[categoryId] || 
                  eligibility.itemEligibility[categoryId === 'trouser' ? 'pant' : categoryId] ||
                  eligibility.itemEligibility[categoryId === 'blazer' ? 'jacket' : categoryId] ||
                  (categoryId === 'pant' ? eligibility.itemEligibility['trouser'] : undefined) ||
                  (categoryId === 'jacket' ? eligibility.itemEligibility['blazer'] : undefined)
        }
        
        if (elig && typeof elig === 'object') {
          const qty = typeof elig.quantity === 'number' ? elig.quantity : (elig.quantity ? Number(elig.quantity) : 0)
          const freq = typeof elig.renewalFrequency === 'number' ? elig.renewalFrequency : (elig.renewalFrequency ? Number(elig.renewalFrequency) : 0)
          const unit = (elig.renewalUnit === 'months' || elig.renewalUnit === 'years') ? elig.renewalUnit : 'months'
          
          itemElig[categoryId] = {
            quantity: qty > 0 ? qty : 1,
            renewalFrequency: freq > 0 ? freq : 6,
            renewalUnit: unit,
          }
          
          console.log(`  ✅ Loaded ${categoryId} from DB (via alias):`, itemElig[categoryId])
        } else {
          // Initialize with valid defaults only if no data exists
          console.warn(`  ⚠️ No eligibility data found for ${categoryId}, using defaults`)
          itemElig[categoryId] = {
            quantity: 1,
            renewalFrequency: 6,
            renewalUnit: 'months',
          }
        }
      }
    }
    
    console.log('🔍 Final itemEligibility for form (preserving ALL existing data):', JSON.stringify(itemElig, null, 2))
    
    setFormData({
      designation: eligibility.designation,
      gender: eligibility.gender === 'unisex' ? 'male' : (eligibility.gender || 'male'), // Convert 'unisex' to 'male' for UI (unisex products appear under both)
      allowedProductCategories: categories,
      itemEligibility: itemElig, // Contains ALL existing data, not just selected categories
    })
    setShowAddForm(false)
  }

  const handleUpdate = async () => {
    if (!editingId || !formData.designation || formData.allowedProductCategories.length === 0) {
      alert('Please fill in designation and select at least one product category')
      return
    }

    // Ensure all selected categories have valid itemEligibility data
    const updatedItemEligibility: Record<string, ItemEligibilityForm> = { ...formData.itemEligibility }
    for (const categoryId of formData.allowedProductCategories) {
      let itemElig = formData.itemEligibility[categoryId]
      if (!itemElig || itemElig.quantity <= 0 || itemElig.renewalFrequency <= 0) {
        // Initialize with valid defaults if missing or invalid
        updatedItemEligibility[categoryId] = {
          quantity: itemElig?.quantity > 0 ? itemElig.quantity : 1,
          renewalFrequency: itemElig?.renewalFrequency > 0 ? itemElig.renewalFrequency : 6,
          renewalUnit: (itemElig?.renewalUnit === 'months' || itemElig?.renewalUnit === 'years') 
            ? itemElig.renewalUnit 
            : 'months',
        }
        itemElig = updatedItemEligibility[categoryId]
      }
      
      // Final validation
      const categoryLabel = availableCategories.find(c => c.id === categoryId)?.label || categoryId
      if (!itemElig || itemElig.quantity <= 0) {
        alert(`Please set a valid quantity (greater than 0) for ${categoryLabel}`)
        return
      }
      if (!itemElig.renewalFrequency || itemElig.renewalFrequency <= 0) {
        alert(`Please set a valid renewal frequency for ${categoryLabel}`)
        return
      }
    }
    
    // Use updatedItemEligibility (which has corrected values) for building the request
    const finalItemEligibility = updatedItemEligibility

    try {
      // Build itemEligibility object with proper category mapping
      // IMPORTANT: Include ALL existing itemEligibility data, not just selected categories
      // This ensures categories that exist in DB but aren't in the form are preserved
      const itemEligibility: any = {}
      
      // First, include ALL existing itemEligibility from formData (preserves unselected categories)
      for (const [categoryId, itemElig] of Object.entries(finalItemEligibility)) {
        if (itemElig && typeof itemElig === 'object' && 'quantity' in itemElig && 'renewalFrequency' in itemElig) {
          const qty = Number((itemElig as any).quantity)
          const freq = Number((itemElig as any).renewalFrequency)
          
          // Only include if valid (quantity > 0 and frequency > 0)
          // This filters out invalid entries while preserving valid ones
          if (qty > 0 && freq > 0) {
            const cleanItemElig = {
              quantity: qty,
              renewalFrequency: freq,
              renewalUnit: (itemElig as any).renewalUnit || 'months',
            }
            
            // Map category IDs to model field names
            if (categoryId === 'trouser') {
              itemEligibility.trouser = cleanItemElig
              itemEligibility.pant = cleanItemElig // Also set pant alias
            } else if (categoryId === 'blazer') {
              itemEligibility.blazer = cleanItemElig
              itemEligibility.jacket = cleanItemElig // Also set jacket alias
            } else {
              itemEligibility[categoryId] = cleanItemElig
            }
            
            console.log(`  ✅ Included ${categoryId} in update:`, cleanItemElig)
          }
        }
      }
      
      // Then, ensure selected categories are included (override with form values)
      for (const categoryId of formData.allowedProductCategories) {
        const itemElig = finalItemEligibility[categoryId]
        if (itemElig && itemElig.quantity > 0 && itemElig.renewalFrequency > 0) {
          const cleanItemElig = {
            quantity: Number(itemElig.quantity),
            renewalFrequency: Number(itemElig.renewalFrequency),
            renewalUnit: itemElig.renewalUnit || 'months',
          }
          
          // Map category IDs to model field names (override any existing entries)
          if (categoryId === 'trouser') {
            itemEligibility.trouser = cleanItemElig
            itemEligibility.pant = cleanItemElig // Also set pant alias
          } else if (categoryId === 'blazer') {
            itemEligibility.blazer = cleanItemElig
            itemEligibility.jacket = cleanItemElig // Also set jacket alias
          } else {
            itemEligibility[categoryId] = cleanItemElig
          }
          
          console.log(`  ✅ Updated ${categoryId} from form:`, cleanItemElig)
        } else {
          console.warn(`  ⚠️ Skipping ${categoryId} - invalid itemElig:`, itemElig)
        }
      }

      // Only pass itemEligibility if it has values
      const itemEligibilityToUpdate = Object.keys(itemEligibility).length > 0 ? itemEligibility : undefined

      console.log('📤 Updating eligibility - FINAL DATA BEING SENT:', {
        editingId,
        designation: formData.designation,
        allowedProductCategories: formData.allowedProductCategories,
        formDataItemEligibility: JSON.stringify(formData.itemEligibility, null, 2),
        finalItemEligibility: JSON.stringify(finalItemEligibility, null, 2),
        builtItemEligibility: JSON.stringify(itemEligibilityToUpdate, null, 2),
        gender: formData.gender,
      })

      const updated = await updateDesignationEligibility(
        editingId,
        formData.designation,
        formData.allowedProductCategories,
        itemEligibilityToUpdate,
        formData.gender,
        undefined,
        refreshEligibility
      )
      
      console.log('Update response:', updated)
      
      if (!updated) {
        throw new Error('Failed to update eligibility - no response from server')
      }
      
      // Reload the entire list to ensure we have fresh data with proper decryption
      if (companyId) {
        const refreshedEligibilities = await getDesignationEligibilitiesByCompany(companyId)
        setEligibilities(refreshedEligibilities)
      } else {
        // Fallback: update just the edited item
        setEligibilities(eligibilities.map((e) => (e.id === editingId ? updated : e)))
      }
      
      setEditingId(null)
      setRefreshEligibility(false)
      setFormData({ designation: '', gender: 'male', allowedProductCategories: [], itemEligibility: {} })
    } catch (error: any) {
      console.error('Error updating eligibility:', error)
      const errorMessage = error.message || error.toString() || 'Unknown error occurred'
      alert(`Error updating eligibility: ${errorMessage}`)
    }
  }

  const handleDelete = async (eligibilityId: string) => {
    if (!confirm('Are you sure you want to delete this designation eligibility?')) {
      return
    }

    try {
      await deleteDesignationEligibility(eligibilityId)
      setEligibilities(eligibilities.filter((e) => e.id !== eligibilityId))
    } catch (error: any) {
      alert(`Error deleting eligibility: ${error.message}`)
    }
  }

  const handleCancel = () => {
    setEditingId(null)
    setShowAddForm(false)
    setFormData({ designation: '', gender: 'unisex', allowedProductCategories: [], itemEligibility: {} })
  }

  const getItemEligibilityDisplay = (eligibility: any, categoryId: string) => {
    // Try multiple ways to find the item eligibility (handle aliases)
    const itemElig = eligibility.itemEligibility?.[categoryId] || 
                    eligibility.itemEligibility?.[categoryId === 'trouser' ? 'pant' : categoryId] ||
                    eligibility.itemEligibility?.[categoryId === 'blazer' ? 'jacket' : categoryId] ||
                    (categoryId === 'pant' ? eligibility.itemEligibility?.['trouser'] : undefined) ||
                    (categoryId === 'jacket' ? eligibility.itemEligibility?.['blazer'] : undefined)
    
    if (!itemElig || typeof itemElig !== 'object') {
      console.log(`⚠️ No itemEligibility found for ${categoryId} in eligibility ${eligibility.id}:`, {
        itemEligibilityKeys: eligibility.itemEligibility ? Object.keys(eligibility.itemEligibility) : 'none',
        categoryId,
      })
      return 'Not configured'
    }
    
    // Extract values, ensuring they're numbers
    const qty = typeof itemElig.quantity === 'number' ? itemElig.quantity : (itemElig.quantity ? Number(itemElig.quantity) : 0)
    const freq = typeof itemElig.renewalFrequency === 'number' ? itemElig.renewalFrequency : (itemElig.renewalFrequency ? Number(itemElig.renewalFrequency) : 0)
    const unit = itemElig.renewalUnit || 'months'
    
    console.log(`📊 Display for ${categoryId} (eligibility ${eligibility.id}):`, { 
      qty, 
      freq, 
      unit, 
      rawQuantity: itemElig.quantity,
      rawFrequency: itemElig.renewalFrequency,
      rawUnit: itemElig.renewalUnit,
    })
    
    if (qty <= 0 || freq <= 0) {
      console.warn(`⚠️ Invalid values for ${categoryId}: qty=${qty}, freq=${freq}`)
      return 'Not configured'
    }
    
    const renewalText = unit === 'years' 
      ? `${freq} year${freq !== 1 ? 's' : ''}`
      : `${freq} month${freq !== 1 ? 's' : ''}`
    
    return `${qty} item${qty !== 1 ? 's' : ''} / ${renewalText}`
  }

  if (loading) {
    return (
      <DashboardLayout actorType="company">
        <div className="flex items-center justify-center min-h-[400px]">
          <p className="text-gray-600">Loading...</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout actorType="company">
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Designation Product Eligibility</h1>
            <p className="text-gray-600 mt-2">
              Manage uniform item eligibility, quantities, and renewal frequencies for each designation
            </p>
          </div>
          {!showAddForm && !editingId && (
            <button
              onClick={() => setShowAddForm(true)}
              className="bg-primary-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-primary-600 transition-colors flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>Add Designation Mapping</span>
            </button>
          )}
        </div>

        {/* Add/Edit Form */}
        {(showAddForm || editingId) && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border-2 border-primary-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? 'Edit Designation Eligibility' : 'Add New Designation Eligibility'}
            </h2>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Designation Name
                </label>
                {availableDesignations.length > 0 ? (
                  <select
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                  >
                    <option value="">Select a designation...</option>
                    {availableDesignations.map((designation) => (
                      <option key={designation} value={designation}>
                        {designation}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                      placeholder="e.g., General Manager, Office Admin"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500">
                      No designations found in database. You can enter a new designation manually.
                    </p>
                  </div>
                )}
                {availableDesignations.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    {availableDesignations.length} designation{availableDesignations.length !== 1 ? 's' : ''} found in your company
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Gender Filter
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => {
                const newGender = e.target.value as 'male' | 'female'
                // Clear selected categories that don't match the new gender
                const filteredCategories = getFilteredCategoriesForGender(newGender)
                const validCategories = formData.allowedProductCategories.filter(catId => 
                  filteredCategories.some(c => c.id === catId)
                )
                setFormData({ 
                  ...formData, 
                  gender: newGender,
                  allowedProductCategories: validCategories,
                  // Remove item eligibility for removed categories
                  itemEligibility: Object.fromEntries(
                    Object.entries(formData.itemEligibility).filter(([catId]) => 
                      validCategories.includes(catId)
                    )
                  )
                })
              }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Select which gender this eligibility rule applies to. Products marked as "Unisex" will automatically appear under both Male and Female views. Available categories will update based on your selection.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">
                  Product Categories & Eligibility Settings
                </label>
                {getFilteredCategories().length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800 mb-2">
                      No product categories found. This usually means:
                    </p>
                    <ul className="text-sm text-yellow-800 list-disc list-inside space-y-1">
                      <li>No products are linked to your company yet</li>
                      <li>Products need to be linked via ProductCompany relationships</li>
                      <li>Check the "Company Products" section below to see how many products are linked</li>
                    </ul>
                    <p className="text-xs text-yellow-700 mt-2">
                      Note: The gender filter you select will be applied when employees view products. All categories with products will be shown here for configuration.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {getFilteredCategories().map((category) => {
                    const isSelected = formData.allowedProductCategories.includes(category.id)
                    // Get the actual itemEligibility from formData
                    // Use actual values from formData - don't compute defaults here
                    // This ensures user-entered values are preserved and displayed
                    const itemElig = formData.itemEligibility[category.id]
                    
                    // For display, use the actual value or empty string (let user enter their own)
                    // Don't force defaults here - only use defaults when category is first selected
                    const displayItemElig: ItemEligibilityForm = itemElig || {
                      quantity: 0, // Use 0 so input appears empty, not 1
                      renewalFrequency: 0, // Use 0 so input appears empty, not 6
                      renewalUnit: 'months',
                    }
                    
                    return (
                      <div
                        key={category.id}
                        className={`p-4 border-2 rounded-lg transition-colors ${
                          isSelected
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center space-x-3 mb-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleCategory(category.id)}
                            className="w-5 h-5 text-primary-500 rounded focus:ring-primary-500"
                          />
                          <span className="text-sm font-semibold text-gray-900">
                            {category.label}
                            <span className="ml-2 text-xs text-gray-500 font-normal">
                              ({category.count} product{category.count !== 1 ? 's' : ''})
                            </span>
                          </span>
                        </div>
                        
                        {isSelected && (
                          <div className="ml-8 grid grid-cols-1 md:grid-cols-3 gap-4 mt-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Quantity per Cycle
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={displayItemElig.quantity > 0 ? displayItemElig.quantity : ''}
                                onChange={(e) => {
                                  const inputValue = e.target.value.trim()
                                  if (inputValue === '') {
                                    // Allow clearing - set to 0 temporarily so user can type
                                    handleItemEligibilityChange(category.id, 'quantity', 0)
                                    return
                                  }
                                  const numValue = parseInt(inputValue, 10)
                                  if (!isNaN(numValue)) {
                                    console.log(`📝 User typed quantity for ${category.id}:`, numValue)
                                    handleItemEligibilityChange(category.id, 'quantity', numValue)
                                  }
                                }}
                                onBlur={(e) => {
                                  // Validate and set minimum when user leaves field
                                  const inputValue = e.target.value.trim()
                                  const numValue = parseInt(inputValue, 10)
                                  if (inputValue === '' || isNaN(numValue) || numValue <= 0) {
                                    // Set to 1 if empty or invalid
                                    handleItemEligibilityChange(category.id, 'quantity', 1)
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                placeholder="e.g., 6"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Renewal Frequency
                              </label>
                              <input
                                type="number"
                                min="1"
                                value={displayItemElig.renewalFrequency > 0 ? displayItemElig.renewalFrequency : ''}
                                onChange={(e) => {
                                  const inputValue = e.target.value.trim()
                                  if (inputValue === '') {
                                    // Allow clearing - set to 0 temporarily so user can type
                                    handleItemEligibilityChange(category.id, 'renewalFrequency', 0)
                                    return
                                  }
                                  const numValue = parseInt(inputValue, 10)
                                  if (!isNaN(numValue)) {
                                    console.log(`📝 User typed renewalFrequency for ${category.id}:`, numValue)
                                    handleItemEligibilityChange(category.id, 'renewalFrequency', numValue)
                                  }
                                }}
                                onBlur={(e) => {
                                  // Validate and set minimum when user leaves field
                                  const inputValue = e.target.value.trim()
                                  const numValue = parseInt(inputValue, 10)
                                  if (inputValue === '' || isNaN(numValue) || numValue <= 0) {
                                    // Set to 6 if empty or invalid
                                    handleItemEligibilityChange(category.id, 'renewalFrequency', 6)
                                  }
                                }}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                                placeholder="e.g., 6"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                Renewal Unit
                              </label>
                              <select
                                value={displayItemElig.renewalUnit}
                                onChange={(e) => handleItemEligibilityChange(category.id, 'renewalUnit', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                              >
                                <option value="months">Months</option>
                                <option value="years">Years</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  </div>
                )}
              </div>

              {/* Refresh Eligibility Option - Only show when editing */}
              {editingId && (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={refreshEligibility}
                      onChange={(e) => setRefreshEligibility(e.target.checked)}
                      className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
                    />
                    <div>
                      <span className="text-sm font-semibold text-gray-900">
                        Refresh eligibility for the Designation
                      </span>
                      <p className="text-xs text-gray-500 mt-1">
                        When checked, all employees with this designation will have their entitlements updated based on the new eligibility settings.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              <div className="flex space-x-3">
                <button
                  onClick={editingId ? handleUpdate : handleAdd}
                  className="bg-primary-500 text-white px-6 py-2 rounded-lg font-semibold hover:bg-primary-600 transition-colors flex items-center space-x-2"
                >
                  <Save className="h-5 w-5" />
                  <span>{editingId ? 'Update' : 'Create'}</span>
                </button>
                <button
                  onClick={handleCancel}
                  className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors flex items-center space-x-2"
                >
                  <X className="h-5 w-5" />
                  <span>Cancel</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900">How it works:</p>
              <ul className="text-sm text-blue-800 mt-1 space-y-1 list-disc list-inside">
                <li>Only products linked to your company will be visible to employees</li>
                <li>Employees can only see and order products in categories allowed for their designation and gender</li>
                <li>Set gender filter to apply rules to specific genders (Male, Female, or All)</li>
                <li>Set the quantity of items allowed per renewal cycle for each category</li>
                <li>Set renewal frequency in months or years - eligibility resets after each cycle</li>
                <li>If no eligibility rule exists for a designation, all company products are visible (backward compatibility)</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Eligibilities List */}
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {eligibilities.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-600 mb-4">No designation eligibility rules configured yet.</p>
              <p className="text-sm text-gray-500">
                Click "Add Designation Mapping" to create your first rule.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-4 px-6 text-gray-700 font-semibold">Designation</th>
                    <th className="text-left py-4 px-6 text-gray-700 font-semibold">Gender</th>
                    <th className="text-left py-4 px-6 text-gray-700 font-semibold">Allowed Categories</th>
                    <th className="text-left py-4 px-6 text-gray-700 font-semibold">Eligibility Details</th>
                    <th className="text-left py-4 px-6 text-gray-700 font-semibold">Status</th>
                    <th className="text-left py-4 px-6 text-gray-700 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {eligibilities.map((eligibility) => (
                    <tr key={eligibility.id} className="border-b hover:bg-gray-50">
                      <td className="py-4 px-6">
                        <span className="font-semibold text-gray-900">{eligibility.designation}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                            eligibility.gender === 'unisex' || !eligibility.gender
                              ? 'bg-blue-100 text-blue-700'
                              : eligibility.gender === 'male'
                              ? 'bg-blue-50 text-blue-600'
                              : 'bg-pink-50 text-pink-600'
                          }`}
                        >
                          {(() => {
                            // Display logic: Show 'Unisex' for legacy unisex entries, otherwise show the gender
                            // Note: New entries should only be Male or Female (unisex products appear under both)
                            const displayGender = eligibility.gender === 'unisex' || !eligibility.gender ? 'Unisex (Legacy)' : eligibility.gender.charAt(0).toUpperCase() + eligibility.gender.slice(1)
                            return displayGender
                          })()}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex flex-wrap gap-2">
                          {(() => {
                            // Deduplicate categories by normalized category name to avoid showing "Trousers/Pants" twice
                            const seenLabels = new Set<string>()
                            return eligibility.allowedProductCategories
                              ?.map((cat: string) => {
                                const normalizedCat = normalizeCategoryName(cat)
                                const categoryLabel = CATEGORY_LABELS[normalizedCat] || normalizedCat.charAt(0).toUpperCase() + normalizedCat.slice(1)
                                return { cat: normalizedCat, label: categoryLabel, originalCat: cat }
                              })
                              .filter((item: any) => {
                                if (seenLabels.has(item.label)) {
                                  return false // Skip duplicates
                                }
                                seenLabels.add(item.label)
                                return true
                              })
                              .map((item: any) => (
                                <span
                                  key={item.cat}
                                  className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-xs font-semibold"
                                >
                                  {item.label}
                                </span>
                              ))
                          })()}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="space-y-1">
                          {(() => {
                            // Deduplicate categories by normalized category name to avoid showing "Trousers/Pants" twice
                            const seenLabels = new Set<string>()
                            return eligibility.allowedProductCategories
                              ?.map((cat: string) => {
                                const normalizedCat = normalizeCategoryName(cat)
                                const categoryLabel = CATEGORY_LABELS[normalizedCat] || normalizedCat.charAt(0).toUpperCase() + normalizedCat.slice(1)
                                return { cat: normalizedCat, label: categoryLabel, originalCat: cat }
                              })
                              .filter((item: any) => {
                                if (seenLabels.has(item.label)) {
                                  return false // Skip duplicates
                                }
                                seenLabels.add(item.label)
                                return true
                              })
                              .map((item: any) => {
                                const display = getItemEligibilityDisplay(eligibility, item.cat)
                                return (
                                  <div key={item.cat} className="text-xs text-gray-600">
                                    <span className="font-medium">{item.label}:</span> {display}
                                  </div>
                                )
                              })
                          })()}
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${
                            eligibility.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {eligibility.status}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEdit(eligibility)}
                            className="text-blue-600 hover:text-blue-700"
                            title="Edit"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(eligibility.id)}
                            className="text-red-600 hover:text-red-700"
                            title="Delete"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Products Info */}
        <div className="mt-6 bg-gray-50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Company Products</h3>
          <p className="text-sm text-gray-600 mb-2">
            Total products linked to your company: <strong>{products.length}</strong>
          </p>
          <p className="text-xs text-gray-500">
            Only these products will be visible to employees. Products must be linked to your company by a vendor first.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}
