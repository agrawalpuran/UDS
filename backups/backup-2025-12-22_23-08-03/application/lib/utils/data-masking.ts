/**
 * Data masking utility for displaying sensitive information
 * Masks PII (Personally Identifiable Information) in the UI
 */

/**
 * Masks an email address
 * Example: john.doe@example.com -> j***@e***.com
 */
export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || 'N/A'
  
  const [localPart, domain] = email.split('@')
  if (!localPart || !domain) return email
  
  // Show first character, mask the rest of local part
  const maskedLocal = localPart.length > 1 
    ? `${localPart[0]}${'*'.repeat(Math.min(localPart.length - 1, 3))}`
    : localPart[0] || '*'
  
  // Show first character of domain, mask the rest
  const domainParts = domain.split('.')
  if (domainParts.length >= 2) {
    const mainDomain = domainParts[0]
    const tld = domainParts.slice(1).join('.')
    const maskedDomain = mainDomain.length > 1
      ? `${mainDomain[0]}${'*'.repeat(Math.min(mainDomain.length - 1, 3))}.${tld}`
      : `${mainDomain}.${tld}`
    return `${maskedLocal}@${maskedDomain}`
  }
  
  return `${maskedLocal}@${domain[0]}${'*'.repeat(Math.min(domain.length - 1, 3))}`
}

/**
 * Masks a phone number
 * Example: +91-9876543210 -> +91-******3210
 */
export function maskPhone(phone: string): string {
  if (!phone) return 'N/A'
  
  // Keep country code and last 4 digits visible
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.length <= 4) return '****'
  
  const last4 = cleaned.slice(-4)
  const prefix = cleaned.slice(0, cleaned.length - 4)
  
  return `${prefix.replace(/\d/g, '*')}${last4}`
}

/**
 * Masks an address
 * Example: 123 Main Street, City -> 1** M*** S*****, C***
 */
export function maskAddress(address: string): string {
  if (!address) return 'N/A'
  
  // Show first character of each word, mask the rest
  return address
    .split(/[\s,]+/)
    .map(word => {
      if (word.length <= 1) return word
      return `${word[0]}${'*'.repeat(Math.min(word.length - 1, 4))}`
    })
    .join(' ')
}

/**
 * Masks a name (first or last name)
 * Example: John -> J***, Smith -> S****
 */
export function maskName(name: string): string {
  if (!name) return 'N/A'
  
  if (name.length <= 2) return `${name[0]}*`
  
  // Show first character, mask the rest
  return `${name[0]}${'*'.repeat(Math.min(name.length - 1, 4))}`
}

/**
 * Masks full name (first + last)
 * Example: John Smith -> J*** S****
 */
export function maskFullName(firstName: string, lastName: string): string {
  const maskedFirst = maskName(firstName)
  const maskedLast = maskName(lastName)
  return `${maskedFirst} ${maskedLast}`.trim()
}

/**
 * Masks an employee name (can be full name string or separate first/last)
 * Example: "John Smith" -> "J*** S****"
 * Example: "John" -> "J***"
 */
export function maskEmployeeName(employeeName: string): string {
  if (!employeeName) return 'N/A'
  
  // If it's a full name with space, mask both parts
  const parts = employeeName.trim().split(/\s+/)
  if (parts.length >= 2) {
    return parts.map(part => maskName(part)).join(' ')
  }
  
  // Single name
  return maskName(employeeName)
}

/**
 * Masks employee data for display
 */
export function maskEmployeeData(employee: any): any {
  if (!employee) return employee
  
  return {
    ...employee,
    email: maskEmail(employee.email),
    mobile: maskPhone(employee.mobile),
    address: maskAddress(employee.address),
    firstName: maskName(employee.firstName),
    lastName: maskName(employee.lastName),
  }
}

/**
 * Masks branch data for display
 */
export function maskBranchData(branch: any): any {
  if (!branch) return branch
  
  return {
    ...branch,
    address: maskAddress(branch.address),
    phone: branch.phone ? maskPhone(branch.phone) : branch.phone,
    email: branch.email ? maskEmail(branch.email) : branch.email,
  }
}

