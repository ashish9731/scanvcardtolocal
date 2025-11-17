import { createWorker, PSM } from 'tesseract.js';

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

// Helper function to convert data URL to ImageData (Canvas ImageData)
const dataURLToImageData = (dataURL: string): Promise<ImageData> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      resolve(imageData);
    };
    img.onerror = (error) => {
      reject(new Error(`Failed to load image: ${error}`));
    };
    img.src = dataURL;
  });
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
  
  // First, resize the image for better OCR performance
  let resizedImageData: string = imageData;
  try {
    resizedImageData = await resizeImageForOCR(imageData);
  } catch (resizeError) {
    console.warn('Image resize failed, using original image', resizeError);
    resizedImageData = imageData;
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
  
  // Enhanced phone regex - supports Indian format
  const phoneRegex = /(\+?\d{1,4}[\s-]?)?\(?\d{2,5}\)?[\s-]?\d{3,5}[\s-]?\d{4,5}/g;
  const phoneMatches = normalizedText.match(phoneRegex);
  const phones: string[] = phoneMatches ? Array.from(new Set(phoneMatches.map(p => p.trim()))) : [];
  
  // Website regex - find www. patterns
  const websiteRegex = /(www\.[\w-]+\.[\w.-]+)/gi;
  const websiteMatches = normalizedText.match(websiteRegex);
  const websiteFromText = websiteMatches ? websiteMatches[0].toLowerCase() : '';
  
  // Extract company name from website domain
  const companyFromWebsite = (() => {
    if (websiteFromText) {
      try {
        // Extract domain name from website (e.g., www.abc.com -> abc)
        const domainMatch = websiteFromText.match(/www\.([\w-]+)\./i);
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
  
  // Find designation
  for (const line of lines) {
    for (const keyword of designationKeywords) {
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        designation = line.trim();
        break;
      }
    }
    if (designation) break;
  }
  
  // Enhanced name detection - more flexible approach
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i].trim();
    const words = line.split(' ');
    
    // Skip if line is empty
    if (!line) continue;
    
    // Skip if it's clearly not a name
    const isTooLong = line.length > 50;
    const hasNumbers = /\d/.test(line);
    const hasEmail = emails.some(e => line.toLowerCase().includes(e));
    const hasPhone = phones.some(p => line.includes(p.replace(/[\s-]/g, '')));
    const isWebsite = line.toLowerCase().includes('www.') || line.toLowerCase().includes('.com') || line.toLowerCase().includes('.org');
    
    if (isTooLong || hasNumbers || hasEmail || hasPhone || isWebsite) continue;
    
    // Check if it's a designation
    const isDesignation = designationKeywords.some(kw => 
      line.toLowerCase().includes(kw.toLowerCase())
    );
    
    if (isDesignation) continue;
    
    // Look for potential names:
    // 1. All caps (common for names on business cards)
    // 2. Properly capitalized (First Last)
    // 3. Reasonable length (2-4 words)
    
    const isAllCaps = line === line.toUpperCase() && line.length > 2;
    const isProperlyCapitalized = /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(line);
    const isReasonableLength = words.length >= 1 && words.length <= 4;
    
    if (isReasonableLength && (isAllCaps || isProperlyCapitalized)) {
      // Additional validation: check if it looks like a real name
      // Names typically don't have too many consecutive capital letters
      const consecutiveCaps = (line.match(/[A-Z]{3,}/g) || []).length;
      
      if (consecutiveCaps === 0 || (consecutiveCaps === 1 && isAllCaps)) {
        name = line;
        break;
      }
    }
    
    // Fallback: if we haven't found a name yet and this line looks plausible
    if (!name && words.length >= 2 && words.length <= 3 && /^[A-Z]/.test(line)) {
      // Check that it doesn't contain obvious non-name words
      const nonNameIndicators = ['inc', 'llc', 'ltd', 'corp', 'company', 'group', 'solutions'];
      const containsNonName = nonNameIndicators.some(indicator => 
        line.toLowerCase().includes(indicator)
      );
      
      if (!containsNonName) {
        name = line;
      }
    }
  }
  
  // Final fallback: if no name found, try to extract from email address
  if (!name && emails.length > 0) {
    // Extract username from email (part before @)
    const emailParts = emails[0].split('@');
    if (emailParts.length === 2) {
      const username = emailParts[0];
      // Convert username to proper name format (replace dots with spaces and capitalize)
      let extractedName = username.replace(/\./g, ' ') // Replace dots with spaces
        .replace(/\b\w/g, char => char.toUpperCase()) // Capitalize first letter of each word
        .trim();
      
      // Only use if it looks like a reasonable name (2-3 words, no numbers)
      const words = extractedName.split(' ');
      if (words.length >= 1 && words.length <= 3 && !/\d/.test(extractedName)) {
        name = extractedName;
      }
    }
  }
  
  // Last resort: try to find any capitalized line that might be a name
  if (!name) {
    for (let i = 0; i < Math.min(6, lines.length); i++) {
      const line = lines[i].trim();
      if (line && /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(line) && line.length <= 30) {
        // Check it's not a company by looking for company indicators
        const companyIndicators = ['inc', 'llc', 'ltd', 'corp', 'company', 'group'];
        const isLikelyCompany = companyIndicators.some(indicator => 
          line.toLowerCase().includes(indicator)
        );
        
        if (!isLikelyCompany) {
          name = line;
          break;
        }
      }
    }
  }
  
  // Find company name - prioritize logo area (first few lines) or email domain
  // But if we have a clear website domain, prioritize that over logo text unless it's clearly a company name
  let companyFromText = '';
  
  // Enhanced company name detection with better logic for logos and company names
  // Look at the first few lines which often contain logos/company names
  const logoAreaLines = lines.slice(0, Math.min(10, lines.length));
  
  // Common company suffixes that help identify company names
  const companySuffixes = ['Inc', 'LLC', 'Ltd', 'Corp', 'Corporation', 'Company', 'Co', 'Group', 'Associates', 'Partners', 'Enterprises', 'Solutions', 'Technologies', 'Tech', 'Industries', 'Holdings', 'Ventures', 'Capital'];
  
  // Common words that indicate it's NOT a company name (likely a person's name)
  const nameIndicators = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'];
  
  for (let i = 0; i < logoAreaLines.length; i++) {
    const line = logoAreaLines[i].trim();
    const words = line.split(' ');
    
    // Skip if line is empty
    if (!line) continue;
    
    const isAllCaps = line === line.toUpperCase() && line.length > 1;
    const hasNumbers = /\d/.test(line);
    const isPhone = phones.some(p => line.includes(p.replace(/[\s-]/g, '')));
    const isEmail = emails.some(e => line.toLowerCase().includes(e));
    const isDesignation = designationKeywords.some(kw => line.toLowerCase().includes(kw.toLowerCase()));
    const isName = line === name;
    const hasCompanySuffix = companySuffixes.some(suffix => line.toLowerCase().includes(suffix.toLowerCase()));
    const hasNameIndicator = nameIndicators.some(indicator => line.toLowerCase().includes(indicator.toLowerCase()));
    
    // Skip if it's clearly not a company
    if (isName || isEmail || isPhone || isDesignation || hasNameIndicator || hasNumbers) continue;
    
    // Enhanced company detection logic:
    // - All caps text in logo area (often company names/logos)
    // - Multiple words (2-6) that don't contain numbers
    // - Contains company suffixes
    if (line.length > 1 && (isAllCaps || (words.length >= 2 && words.length <= 6) || hasCompanySuffix)) {
      // Additional check: if it's all caps and short, it's likely a company/logo
      if (isAllCaps && line.length <= 30) {
        companyFromText = line;
        break;
      }
      // If it contains company suffixes, it's likely a company
      else if (hasCompanySuffix) {
        companyFromText = line;
        break;
      }
      // If it's multiple words and not too long, it's likely a company
      else if (words.length >= 2 && line.length <= 50) {
        companyFromText = line;
        break;
      }
    }
  }
  
  // If we still don't have a company name, try to find capitalized multi-word phrases
  if (!companyFromText) {
    for (let i = 0; i < Math.min(12, lines.length); i++) {
      const line = lines[i].trim();
      const words = line.split(' ');
      
      // Look for multi-word capitalized phrases that might be company names
      if (words.length >= 2 && words.length <= 6 && /^[A-Z][a-z]/.test(words[0]) && !/\d/.test(line)) {
        const isDesignation = designationKeywords.some(kw => line.toLowerCase().includes(kw.toLowerCase()));
        if (!isDesignation) {
          companyFromText = line;
          break;
        }
      }
    }
  }
  
  // Prioritize: email domain > website domain > text from logo area
  // Email domain should be the primary source for company name
  company = companyFromEmail || companyFromWebsite || companyFromText;
  
  // Address: longer lines at the end, or lines with keywords
  // But exclude lines that contain email addresses or phone numbers
  const addressKeywords: string[] = ['street', 'road', 'avenue', 'ave', 'blvd', 'suite', 'floor', 'building', 'block', 'sector', 'area'];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    
    // Skip if line contains email or phone
    const hasEmail = emails.some(e => line.toLowerCase().includes(e.toLowerCase()));
    const hasPhone = phones.some(p => line.includes(p.replace(/[\s-]/g, '')));
    
    if (hasEmail || hasPhone) continue;
    
    // Look for address-like content
    if ((line.length > 20 && line.length < 100) || addressKeywords.some((kw: string) => line.toLowerCase().includes(kw))) {
      // Additional validation: address should contain numbers and/or address keywords
      const hasNumbers = /\d/.test(line);
      const hasAddressKeyword = addressKeywords.some((kw: string) => line.toLowerCase().includes(kw));
      
      // Only set as address if it has numbers or address keywords
      if (hasNumbers || hasAddressKeyword) {
        address = line;
        break;
      }
    }
  }
  
  // Ensure name is always extracted from email if not found in text
  let finalName = name || '';
  if (!finalName && emails.length > 0) {
    // Extract username from email (part before @)
    const emailParts = emails[0].split('@');
    if (emailParts.length === 2) {
      const username = emailParts[0];
      // Convert username to proper name format (replace dots with spaces and capitalize)
      finalName = username.replace(/\./g, ' ') // Replace dots with spaces
        .replace(/\b\w/g, char => char.toUpperCase()) // Capitalize first letter of each word
        .trim();
    }
  }
  
  // Ensure company name is always extracted from email domain if not found in text
  let finalCompany = company || '';
  if (!finalCompany && emails.length > 0) {
    // Extract domain from email (part after @)
    const emailParts = emails[0].split('@');
    if (emailParts.length === 2) {
      const domain = emailParts[1];
      // Extract company name from domain (remove .com, .org, etc.)
      const domainParts = domain.split('.');
      if (domainParts.length >= 2) {
        finalCompany = domainParts[0].charAt(0).toUpperCase() + domainParts[0].slice(1);
      }
    }
  }
  
  // Ensure email is always populated if we have one
  const finalEmail = emails[0] || '';
  
  return {
    name: finalName,
    company: finalCompany,
    designation: designation || '',
    email: finalEmail,
    phone: phones[0] || '',
    website: websiteFromEmail || '',
    address: address || '',
    imageData: imageData, // Base64 encoded image data
  };
};