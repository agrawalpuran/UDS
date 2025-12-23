/**
 * Image Mapping Utility
 * Centralized function for mapping product categories and genders to image paths
 * 
 * This function determines which image to display based on:
 * - Product category (shirt, pant, shoe, jacket)
 * - Product gender (male, female, unisex)
 * - Optional: Product name (for product-specific images)
 * 
 * Images are stored in: public/images/uniforms/
 * Base URL path: /images/uniforms/
 */

export function getIndigoUniformImage(
  category: string, 
  gender: string = 'male',
  productName?: string
): string {
  // Normalize category name (handle both 'pant' and 'trouser')
  const normalizedCategory = category.toLowerCase() === 'trouser' ? 'pant' : category.toLowerCase()
  const normalizedGender = gender.toLowerCase()
  
  // Product-specific images based on name (highest priority)
  if (productName) {
    const normalizedProductName = productName.toLowerCase().trim()
    
    // Oxford Shirt - Male (check for "oxford" and "shirt" in name)
    if ((normalizedProductName.includes('oxford') && normalizedProductName.includes('shirt')) && 
        (normalizedGender === 'male' || normalizedGender === 'unisex')) {
      return '/images/uniforms/shirt-male-oxford.jpg'
    }
    
    // Denim Shirt - Male (check for "denim" and "shirt" in name)
    if ((normalizedProductName.includes('denim') && normalizedProductName.includes('shirt')) && 
        (normalizedGender === 'male' || normalizedGender === 'unisex')) {
      return '/images/uniforms/denim-shirt-male.jpg'
    }
  }
  
  // Special case: female shirt uses female-shirt.png
  if (normalizedCategory === 'shirt' && normalizedGender === 'female') {
    return '/images/uniforms/female-shirt.png'
  }
  
  // Special case: male jacket uses male-blazer.webp
  if (normalizedCategory === 'jacket' && normalizedGender === 'male') {
    return '/images/uniforms/male-blazer.webp'
  }
  
  // Special case: male pant uses pant-male.png
  if (normalizedCategory === 'pant' && normalizedGender === 'male') {
    return '/images/uniforms/pant-male.png'
  }
  
  // Special case: female pant uses pant-female
  if (normalizedCategory === 'pant' && normalizedGender === 'female') {
    return '/images/uniforms/pant-female.jpg'
  }
  
  // Special case: female jacket uses jacket-female
  if (normalizedCategory === 'jacket' && normalizedGender === 'female') {
    return '/images/uniforms/jacket-female.jpg'
  }
  
  // Special case: male shoes use shoe-male.jpg
  if (normalizedCategory === 'shoe' && normalizedGender === 'male') {
    return '/images/uniforms/shoe-male.jpg'
  }
  
  // Special case: female shoes use shoe-female.jpg
  if (normalizedCategory === 'shoe' && normalizedGender === 'female') {
    return '/images/uniforms/shoe-female.jpg'
  }
  
  // Special case: shoes use shoe-male.jpg (for unisex)
  if (normalizedCategory === 'shoe') {
    return '/images/uniforms/shoe-male.jpg'
  }
  
  // Default pattern: {category}-{gender}.jpg
  // Images should be stored in public/images/uniforms/
  // Naming convention: {category}-{gender}.jpg (e.g., shirt-male.jpg, pant-female.jpg)
  const imagePath = `/images/uniforms/${normalizedCategory}-${normalizedGender}.jpg`
  
  return imagePath
}

/**
 * Configuration for image paths
 * Modify these constants to change the base path or folder structure
 */
export const IMAGE_CONFIG = {
  // Base path for all uniform images
  BASE_PATH: '/images/uniforms/',
  
  // Physical directory (for reference)
  PHYSICAL_DIR: 'public/images/uniforms/',
  
  // Default fallback image
  DEFAULT_IMAGE: '/images/uniforms/default.jpg',
  
  // Image file extensions to try (in order)
  EXTENSIONS: ['.jpg', '.png', '.webp', '.jpeg'],
}

