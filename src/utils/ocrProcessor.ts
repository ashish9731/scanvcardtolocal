import { createWorker, PSM } from 'tesseract.js';

// Helper function to convert HEIC to JPEG
const convertHeicToJpeg = (imageData: string): Promise<string> => {
  return new Promise((resolve) => {
    // If it's not HEIC, return as is
    if (!imageData.startsWith('data:image/heic')) {
      resolve(imageData);
      return;
    }

    // For HEIC images, we need to convert them to JPEG
    // Since HEIC conversion is complex, we'll use a canvas-based approach
    // This will work for most cases where the browser can decode HEIC
    const img = new Image();
    img.onload = () => {
      // Create canvas for conversion
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(imageData); // Return original if context not available
        return;
      }
      
      // Set canvas dimensions to match image
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Draw image on canvas
      ctx.drawImage(img, 0, 0);
      
      // Convert to JPEG
      const jpegData = canvas.toDataURL('image/jpeg', 0.85);
      resolve(jpegData);
    };
    img.onerror = () => {
      // If HEIC conversion fails, return original
      console.warn('Failed to convert HEIC to JPEG, using original data');
      resolve(imageData);
    };
    img.src = imageData;
  });
};

// Helper function to convert data URL to Blob
const dataURLToBlob = (dataURL: string): Blob => {
  const parts = dataURL.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
};

// Helper function to resize image for better OCR performance
const resizeImageForOCR = async (imageData: string): Promise<string> => {
  // Validate input
  if (!imageData || !imageData.startsWith('data:image/')) {
    console.warn('Invalid image data provided to resize function');
    return imageData; // Return original if invalid
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      // Create canvas for resizing
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(imageData); // Return original if context not available
        return;
      }
      
      // Calculate new dimensions (max 1280px width for performance)
      const maxWidth = 1280;
      const scale = Math.min(1, maxWidth / img.width);
      const newWidth = Math.floor(img.width * scale);
      const newHeight = Math.floor(img.height * scale);
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      // Draw resized image
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      // Return resized image data
      resolve(canvas.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => {
      // If image fails to load, return original
      console.warn('Failed to load image for resizing');
      resolve(imageData);
    };
    img.src = imageData;
  });
};

// Helper function to validate and prepare image for OCR
const prepareImageForOCR = async (imageData: string): Promise<Blob | string> => {
  // Validate input
  if (!imageData) {
    throw new Error('No image data provided');
  }
  
  // Check if it's a data URL
  if (imageData.startsWith('data:image/')) {
    try {
      // Try to convert to blob for better Tesseract compatibility
      const blob = dataURLToBlob(imageData);
      return blob;
    } catch (error) {
      console.warn('Failed to convert data URL to blob, using original data', error);
      return imageData;
    }
  }
  
  // If it's already a blob or file path, return as is
  return imageData;
};

export interface CardData {
  id: string;
  name: string;
  company: string;
  designation: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  imageData: string; // Base64 encoded image data
}

export const processImage = async (imageData: string): Promise<CardData> => {
  // Validate input
  if (!imageData) {
    throw new Error('No image data provided');
  }
  
  // Log cross-origin status
  const isCrossOriginIsolated = window.crossOriginIsolated;
  console.log('Cross-origin isolation status:', isCrossOriginIsolated);
  
  // First, convert HEIC to JPEG if needed
  let jpegImageData: string = imageData;
  try {
    jpegImageData = await convertHeicToJpeg(imageData);
  } catch (heicError) {
    console.warn('HEIC conversion failed, using original image', heicError);
    jpegImageData = imageData;
  }
  
  // Then, resize the image for better OCR performance
  let resizedImageData: string = jpegImageData;
  try {
    resizedImageData = await resizeImageForOCR(jpegImageData);
  } catch (resizeError) {
    console.warn('Image resize failed, using original image', resizeError);
    resizedImageData = jpegImageData;
  }
  
  // Prepare image for OCR using the most compatible format
  let preparedImage: Blob | string;
  try {
    preparedImage = await prepareImageForOCR(resizedImageData);
  } catch (prepareError) {
    console.error('Image preparation error:', prepareError);
    throw new Error(`Failed to prepare image: ${prepareError.message || 'Unknown preparation error'}`);
  }
  
  const worker = await createWorker('eng');
  
  try {
    // Configure worker for better performance with business cards
    await worker.setParameters({
      tessedit_do_invert: '0', // Skip inversion for better performance
      preserve_interword_spaces: '1', // Preserve spaces between words
      classify_bln_numeric_mode: '0', // Don't assume numeric mode
      tessedit_pageseg_mode: PSM.SINGLE_BLOCK, // Assume a single uniform block of text
    });
    
    // Perform OCR with error handling
    try {
      console.log('Starting OCR recognition with prepared image type:', typeof preparedImage);
      const { data: { text } } = await worker.recognize(preparedImage);
      console.log('OCR recognition completed successfully');
      
      // Parse extracted text
      const parsedData = parseCardData(text, resizedImageData);
      
      return {
        id: Date.now().toString(),
        ...parsedData,
      };
    } catch (ocrError: any) {
      console.error('OCR processing error:', ocrError);
      // Try to provide more specific error information
      let errorMessage = 'Unknown OCR error';
      if (ocrError.message) {
        errorMessage = ocrError.message;
      } else if (ocrError.toString) {
        errorMessage = ocrError.toString();
      }
      throw new Error(`Failed to process image: ${errorMessage}`);
    }
  } finally {
    await worker.terminate();
  }
};

export const parseCardData = (text: string, imageData: string = ''): Omit<CardData, 'id'> => {
  // Clean and normalize text
  const normalizedText = text
    .replace(/\s+/g, ' ') // normalize whitespace
    .replace(/['']/g, "'") // normalize quotes
    .trim();
  
  const lines = text.split('\n').filter(line => line.trim());
  
  // Enhanced email regex - case insensitive
  const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
  const emailMatches = normalizedText.match(emailRegex);
  const emails: string[] = emailMatches ? Array.from(emailMatches).map(e => e.toLowerCase()) : [];
  
  // Enhanced phone regex - supports various formats
  const phoneRegex = /(\+?\d{1,4}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,5}[\s-]?\d{4,5}/g;
  const phoneMatches = normalizedText.match(phoneRegex);
  const phones: string[] = phoneMatches ? Array.from(new Set(phoneMatches.map(p => p.trim()))) : [];
  
  // Website regex - find www. patterns or domains with suffixes
  const websiteRegex = /((https?:\/\/)?(www\.)?[\w-]+\.[\w.-]+)/gi;
  const websiteMatches = normalizedText.match(websiteRegex);
  const websiteFromText = websiteMatches ? websiteMatches[0].toLowerCase() : '';
  
  // Extract company name from website domain
  const companyFromWebsite = (() => {
    if (websiteFromText) {
      try {
        // Extract domain name from website (e.g., www.abc.com -> abc)
        const domainMatch = websiteFromText.match(/(?:www\.)?([\w-]+)\./i);
        if (domainMatch && domainMatch[1]) {
          return domainMatch[1].charAt(0).toUpperCase() + domainMatch[1].slice(1);
        }
      } catch (e) {
        console.warn('Error extracting company name from website:', e);
      }
    }
    return '';
  })();
  
  // Extract company name and website from email domain
  const { companyFromEmail, websiteFromEmail } = (() => {
    if (emails.length > 0) {
      const emailParts = emails[0].split('@');
      if (emailParts.length === 2) {
        const domain = emailParts[1];
        // Extract company name from email domain (part after @ and before .com)
        const domainParts = domain.split('.');
        const companyFromEmail = domainParts.length >= 2 
          ? domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1)
          : '';
        // Generate website with www prefix if not found in text
        const websiteFromEmail = websiteFromText || `www.${domain}`;
        return { companyFromEmail, websiteFromEmail };
      }
    }
    return { companyFromEmail: '', websiteFromEmail: '' };
  })();
  
  // Common designation keywords
  const designationKeywords: string[] = [
    'CEO', 'CTO', 'CFO', 'COO', 'Manager', 'Director', 'President', 
    'Vice President', 'VP', 'Engineer', 'Developer', 'Designer', 
    'Consultant', 'Analyst', 'Specialist', 'Coordinator', 'Executive',
    'Founder', 'Partner', 'Head', 'Lead', 'Senior', 'Junior'
  ];
  
  let designation = '';
  let name = '';
  let company = '';
  let address = '';
  
  // FIXED RULES IMPLEMENTATION:
  
  // NAME EXTRACTION:
  // 1. Largest capitalized 2-3 word line
  // 2. From email if name not clearly mentioned
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    const words = line.split(' ');
    
    // Skip if line is empty
    if (!line) continue;
    
    // Skip if it's clearly not a name (contains numbers, emails, phones, websites)
    const hasNumbers = /\d/.test(line);
    const hasEmail = emails.some(e => line.toLowerCase().includes(e));
    const hasPhone = phones.some(p => line.includes(p.replace(/[\s-]/g, '')));
    const isWebsite = line.toLowerCase().includes('www.') || line.toLowerCase().includes('.com') || line.toLowerCase().includes('.org');
    
    if (hasNumbers || hasEmail || hasPhone || isWebsite) continue;
    
    // Check if it's a designation
    const isDesignation = designationKeywords.some(kw => 
      line.toLowerCase().includes(kw.toLowerCase())
    );
    
    if (isDesignation) {
      // Store designation but continue looking for name
      if (!designation) designation = line.trim();
      continue;
    }
    
    // Look for potential names:
    // - All caps (common for names on business cards)
    // - Properly capitalized (First Last)
    // - Reasonable length (2-3 words)
    const isAllCaps = line === line.toUpperCase() && line.length > 2;
    const isProperlyCapitalized = /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(line);
    const isReasonableLength = words.length >= 1 && words.length <= 3;
    
    if (isReasonableLength && (isAllCaps || isProperlyCapitalized)) {
      // Additional validation: check if it looks like a real name
      // Names typically don't have too many consecutive capital letters
      const consecutiveCaps = (line.match(/[A-Z]{3,}/g) || []).length;
      
      if (consecutiveCaps === 0 || (consecutiveCaps === 1 && isAllCaps)) {
        name = line;
        break;
      }
    }
  }
  
  // FALLBACK: Extract name from email if not found in text
  if (!name && emails.length > 0) {
    const emailParts = emails[0].split('@');
    if (emailParts.length === 2) {
      const username = emailParts[0];
      // Convert username to proper name format (replace dots with spaces and capitalize)
      name = username.replace(/\./g, ' ') // Replace dots with spaces
        .replace(/\b\w/g, char => char.toUpperCase()) // Capitalize first letter of each word
        .trim();
    }
  }
  
  // DESIGNATION EXTRACTION:
  // Line containing title keywords, adjacent to name
  for (const line of lines) {
    for (const keyword of designationKeywords) {
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        designation = line.trim();
        break;
      }
    }
    if (designation) break;
  }
  
  // PHONE EXTRACTION:
  // Regex-based extraction of clean phone numbers
  // Exclude numbers that are part of addresses
  let cleanPhones: string[] = [];
  if (phones.length > 0) {
    // Filter out phone-like numbers that might be part of addresses
    cleanPhones = phones.filter(phone => {
      // Remove spaces and dashes for length checking
      const cleanPhone = phone.replace(/[\s-]/g, '');
      // Phone numbers typically 7-15 digits
      return cleanPhone.length >= 7 && cleanPhone.length <= 15 && /\d/.test(cleanPhone);
    });
  }
  
  // COMPANY EXTRACTION:
  // Contains business suffix OR bold/large text near top
  // From email after @ and before .com/.co/.in
  company = companyFromEmail || companyFromWebsite;
  
  // If still no company, look for company indicators in text
  if (!company) {
    const logoAreaLines = lines.slice(0, Math.min(8, lines.length));
    const companySuffixes = ['Inc', 'LLC', 'Ltd', 'Corp', 'Corporation', 'Company', 'Co', 'Group', 'Associates', 'Partners', 'Enterprises', 'Solutions', 'Technologies', 'Tech', 'Industries', 'Holdings', 'Ventures', 'Capital'];
    
    for (let i = 0; i < logoAreaLines.length; i++) {
      const line = logoAreaLines[i].trim();
      const words = line.split(' ');
      
      // Skip if line is empty
      if (!line) continue;
      
      const isAllCaps = line === line.toUpperCase() && line.length > 1;
      const hasNumbers = /\d/.test(line);
      const isPhone = cleanPhones.some(p => line.includes(p.replace(/[\s-]/g, '')));
      const isEmail = emails.some(e => line.toLowerCase().includes(e));
      const hasCompanySuffix = companySuffixes.some(suffix => line.toLowerCase().includes(suffix.toLowerCase()));
      
      // Skip if it's clearly not a company
      if (isPhone || isEmail || hasNumbers) continue;
      
      // Enhanced company detection logic:
      if (line.length > 1 && (isAllCaps || (words.length >= 2 && words.length <= 6) || hasCompanySuffix)) {
        company = line;
        break;
      }
    }
  }
  
  // WEBSITE EXTRACTION:
  // Must contain domain suffix (.com, .in, .net, .ai etc.)
  const finalWebsite = websiteFromEmail || websiteFromText;
  
  // ADDRESS EXTRACTION:
  // Longest multi-line block containing words + digits + commas
  // Must contain address indicators (Road, Street, Lane, Floor, City, ZIP)
  const addressKeywords: string[] = ['street', 'st', 'road', 'rd', 'avenue', 'ave', 'blvd', 'boulevard', 'suite', 'floor', 'building', 'block', 'sector', 'area', 'city', 'zip', 'pin', 'code', 'lane', 'ln', 'drive', 'dr', 'court', 'ct', 'place', 'pl', 'apartment', 'apt'];
  
  // Look for address-like content from bottom up (addresses often at bottom)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    
    // Skip if line contains email or phone
    const hasEmail = emails.some(e => line.toLowerCase().includes(e.toLowerCase()));
    const hasPhone = cleanPhones.some(p => line.includes(p.replace(/[\s-]/g, '')));
    
    if (hasEmail || hasPhone) continue;
    
    // Look for address-like content
    if (line.length > 15) { // Addresses are typically longer
      const hasAddressKeyword = addressKeywords.some((kw: string) => line.toLowerCase().includes(kw));
      const hasNumbers = /\d/.test(line);
      const hasCommas = line.includes(',');
      
      // Must have numbers and either address keywords or commas
      if (hasNumbers && (hasAddressKeyword || hasCommas)) {
        // Additional validation: should not contain email patterns
        if (!line.includes('@') && !line.includes('www')) {
          address = line;
          break;
        }
      }
    }
  }
  
  // Ensure email is always populated if we have one
  const finalEmail = emails[0] || '';
  
  // Ensure phone is clean
  const finalPhone = cleanPhones[0] || '';
  
  return {
    name: name || '',
    company: company || '',
    designation: designation || '',
    email: finalEmail,
    phone: finalPhone,
    website: finalWebsite || '',
    address: address || '',
    imageData: imageData, // Base64 encoded image data
  };
};
