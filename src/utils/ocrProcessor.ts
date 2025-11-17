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
  
  // Enhanced phone regex - supports various formats including country codes
  // More comprehensive regex to capture different phone number formats
  const phoneRegex = /(\+?\d{1,4}[-.\s]?)?\(?\d{1,4}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g;
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
  
  // Comprehensive designation keywords
  const designationKeywords: string[] = [
    'Chairman', 'Chairperson', 'CEO', 'Chief Executive Officer', 'President', 
    'COO', 'Chief Operating Officer', 'CFO', 'Chief Financial Officer',
    'CIO', 'Chief Information Officer', 'CTO', 'Chief Technology Officer',
    'CMO', 'Chief Marketing Officer', 'CHRO', 'Chief Human Resources Officer',
    'CSO', 'Chief Strategy Officer', 'CPO', 'Chief Product Officer',
    'CLO', 'Chief Legal Officer', 'CAO', 'Chief Administrative Officer',
    'Vice President', 'VP', 'Director', 'Senior Manager', 'Manager',
    'Assistant Manager', 'Team Lead', 'Supervisor', 'Executive', 'Associate',
    'Coordinator', 'Assistant', 'Intern', 'Trainee', 'Software Engineer',
    'Senior Software Engineer', 'Lead Developer', 'Principal Engineer',
    'Solutions Architect', 'Cloud Architect', 'DevOps Engineer',
    'Data Engineer', 'ML Engineer', 'AI Engineer', 'Data Analyst',
    'Business Analyst', 'Data Scientist', 'AI Researcher', 'BI Developer',
    'Product Manager', 'Product Owner', 'Program Manager', 'Scrum Master',
    'Project Manager', 'IT Support Engineer', 'Systems Administrator',
    'Network Engineer', 'Cybersecurity Analyst', 'Security Architect',
    'Plant Manager', 'Production Manager', 'Quality Control Officer',
    'QA/QC Engineer', 'Maintenance Engineer', 'Manufacturing Engineer',
    'Machine Operator', 'Line Supervisor', 'Process Engineer',
    'Investment Banker', 'Financial Analyst', 'Portfolio Manager',
    'Loan Officer', 'Branch Manager', 'Relationship Manager',
    'Actuary', 'Underwriter', 'Claims Officer', 'Auditor', 'Tax Consultant',
    'Sales Executive', 'Sales Manager', 'Business Development Manager',
    'Key Account Manager', 'Area Sales Manager', 'Regional Sales Manager',
    'Marketing Executive', 'Digital Marketing Specialist', 'SEO Specialist',
    'Brand Manager', 'Content Strategist', 'HR Manager', 'HR Business Partner',
    'Talent Acquisition Specialist', 'Recruitment Manager', 'HR Generalist',
    'Employee Relations Manager', 'Training & Development Manager',
    'Compensation & Benefits Analyst', 'Teacher', 'Lecturer', 'Professor',
    'Academic Coordinator', 'Principal', 'Dean', 'Trainer',
    'Instructional Designer', 'Research Scholar', 'Store Manager',
    'Retail Associate', 'Cashier', 'Sales Advisor', 'Hotel Manager',
    'Front Desk Executive', 'Chef', 'Housekeeping Supervisor',
    'Travel Consultant', 'Tour Guide', 'Supply Chain Manager',
    'Logistics Coordinator', 'Warehouse Manager', 'Inventory Analyst',
    'Procurement Manager', 'Fleet Manager', 'Transport Supervisor',
    'Dispatcher', 'Civil Engineer', 'Site Engineer', 'Project Engineer',
    'Architect', 'Interior Designer', 'Safety Officer',
    'Construction Supervisor', 'Structural Engineer', 'Graphic Designer',
    'UI/UX Designer', 'Video Editor', 'Animator', 'Creative Director',
    'Copywriter', 'Journalist', 'Photographer', 'Social Media Manager',
    'Petroleum Engineer', 'Drilling Engineer', 'Geologist',
    'Refinery Operator', 'HSE Officer', 'Pipeline Engineer',
    'Field Technician', 'Officer', 'Inspector', 'Superintendent',
    'Director-General', 'Commissioner', 'Specialist', 'Analyst',
    'Clerk', 'Assistant', 'Lawyer', 'Attorney', 'Legal Advisor',
    'Corporate Counsel', 'Paralegal', 'Legal Associate', 'Compliance Officer'
  ];
  
  let designation = '';
  let name = '';
  let company = '';
  let address = '';
  
  // Extract email username for validation (part before @)
  let emailUsername = '';
  if (emails.length > 0 && emails[0].includes('@')) {
    emailUsername = emails[0].split('@')[0].toLowerCase();
  }
  
  // NEW RULE: If email name from name@company.com matches any name on the card, take that name
  // Otherwise, take name from email as currently implemented
  
  // First, collect all potential names from the card
  const potentialNames: {name: string, lineIndex: number}[] = [];
  const topLines = lines.slice(0, Math.min(10, lines.length)); // Focus on top 10 lines
  
  // Collect all potential names from the card
  for (let i = 0; i < topLines.length; i++) {
    const line = topLines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Skip lines with numbers, emails, phones, websites
    const hasNumbers = /\d/.test(line);
    const hasEmail = emails.some(e => line.toLowerCase().includes(e));
    const hasPhone = phones.some(p => line.includes(p.replace(/[\s-]/g, '')));
    const isWebsite = line.toLowerCase().includes('www.') || line.toLowerCase().includes('.com') || line.toLowerCase().includes('.org');
    
    if (hasNumbers || hasEmail || hasPhone || isWebsite) continue;
    
    // Skip if it's a designation
    const isDesignation = designationKeywords.some(kw => 
      line.toLowerCase().includes(kw.toLowerCase())
    );
    
    if (isDesignation) continue;
    
    // Check if it looks like a name (proper capitalization or all caps)
    const isAllCaps = line === line.toUpperCase() && line.length > 1;
    const isProperlyCapitalized = /^[A-Z][a-z]+(\s[A-Z][a-z]+)*$/.test(line);
    const words = line.split(' ');
    const isReasonableLength = words.length >= 1 && words.length <= 4;
    
    if (isReasonableLength && (isAllCaps || isProperlyCapitalized)) {
      // Additional validation: names don't have special characters
      const hasSpecialChars = /[!@#$%^&*(),.?":{}|<>]/.test(line);
      if (!hasSpecialChars) {
        potentialNames.push({name: line, lineIndex: i});
      }
    }
  }
  
  // NEW RULE IMPLEMENTATION:
  // If email name from name@company.com matches any name on the card, take that name
  // Otherwise, take name from email as currently implemented
  if (emailUsername) {
    // Look for exact or close matches to the email username
    for (const potentialName of potentialNames) {
      // Convert name to lowercase for comparison and remove spaces
      const nameForComparison = potentialName.name.toLowerCase().replace(/\s+/g, '');
      
      // Check if name matches or is similar to email username
      if (emailUsername === nameForComparison || 
          emailUsername.includes(nameForComparison) || 
          nameForComparison.includes(emailUsername)) {
        name = potentialName.name;
        break;
      }
    }
  }
  
  // If no matching name found on card, fallback to email-based extraction
  if (!name && emailUsername) {
    // Convert email username to proper name format (replace dots with spaces and capitalize)
    let extractedName = emailUsername.replace(/\./g, ' ') // Replace dots with spaces
      .replace(/\b\w/g, char => char.toUpperCase()) // Capitalize first letter of each word
      .trim();
    
    // Validate the extracted name (1-4 words, no numbers)
    const words = extractedName.split(' ');
    const hasNumbers = /\d/.test(extractedName);
    const isReasonableLength = words.length >= 1 && words.length <= 4;
    
    if (isReasonableLength && !hasNumbers) {
      name = extractedName;
    }
  }
  
  // DESIGNATION EXTRACTION:
  // Extract designation separately to avoid contamination with other fields
  for (const line of lines) {
    for (const keyword of designationKeywords) {
      // Check for exact matches or partial matches
      if (line.toLowerCase().includes(keyword.toLowerCase())) {
        // Ensure this line is not already captured as name, company, email, phone, website, or address
        const isAlreadyCaptured = 
          (name && line.toLowerCase().includes(name.toLowerCase())) ||
          (company && line.toLowerCase().includes(company.toLowerCase())) ||
          emails.some(e => line.toLowerCase().includes(e)) ||
          phones.some(p => line.includes(p.replace(/[\s-]/g, ''))) ||
          (websiteFromEmail && line.toLowerCase().includes(websiteFromEmail.toLowerCase())) ||
          (websiteFromText && line.toLowerCase().includes(websiteFromText.toLowerCase())) ||
          (address && line.toLowerCase().includes(address.toLowerCase()));
        
        if (!isAlreadyCaptured) {
          designation = line.trim();
          break;
        }
      }
    }
    if (designation) break;
  }
  
  // PHONE EXTRACTION:
  // Completely rewrite phone extraction with simpler, more effective approach
  let cleanPhones: string[] = [];
  
  // Simple but effective phone regex that captures + format numbers
  const simplePhoneRegex = /[\+]?[\d\s\-\(\)]{7,20}/g;
  const simplePhoneMatches = normalizedText.match(simplePhoneRegex);
  if (simplePhoneMatches) {
    for (const phone of simplePhoneMatches) {
      // Clean the phone number - keep only digits and + at the beginning
      let cleanPhone = phone.replace(/[^+\d]/g, '');
      // Ensure + is only at the beginning if present
      if (cleanPhone.startsWith('+')) {
        cleanPhone = '+' + cleanPhone.substring(1);
      }
      // Validate the cleaned phone - 7-15 digits
      const digitsOnly = cleanPhone.replace(/\+/g, '');
      if (digitsOnly.length >= 7 && digitsOnly.length <= 15 && /\d/.test(digitsOnly)) {
        // Avoid duplicates
        if (!cleanPhones.includes(cleanPhone)) {
          cleanPhones.push(cleanPhone);
        }
      }
    }
  }
  
  // COMPANY EXTRACTION:
  // Contains business suffix OR bold/large text near top
  // From email after @ and before .com/.co/.in
  company = companyFromEmail || companyFromWebsite;
  
  // WEBSITE EXTRACTION:
  // Must contain domain suffix (.com, .in, .net, .ai etc.)
  // Always ensure website starts with www. and has proper domain format
  let finalWebsite = websiteFromEmail || websiteFromText;
  
  // Ensure website always starts with www. and has proper format
  if (finalWebsite) {
    // Remove any cleaning that might have removed dots
    // Extract domain part and ensure proper www. format
    const domainMatch = finalWebsite.match(/(?:https?:\/\/)?(?:www\.)?([^\s]+)/i);
    if (domainMatch && domainMatch[1]) {
      // Check if it already has www.
      if (finalWebsite.includes('www.')) {
        finalWebsite = finalWebsite; // Keep as is
      } else {
        // Add www. prefix
        finalWebsite = `www.${domainMatch[1]}`;
      }
    }
  }
  
  // ADDRESS EXTRACTION:
  // Implement the specific rules you provided
  // Characteristics: Longest multi-line block containing words + digits + commas
  // Must contain address indicators (Road, Street, Lane, Floor, City, ZIP)
  address = '';
  
  // Address indicators as specified
  const addressKeywords = [
    'road', 'street', 'st', 'ave', 'avenue', 'lane', 'block', 'tower', 'floor', 
    'city', 'zip', 'postal', 'po box', 'building', 'bldg', 'suite', 'apartment', 'apt',
    'drive', 'dr', 'court', 'ct', 'place', 'pl', 'boulevard', 'blvd', 'circle', 'cr',
    'india', 'us', 'usa', 'united states', 'uk', 'united kingdom', 'canada', 'australia'
  ];
  
  // Find the longest continuous text block that matches address criteria
  let bestAddressCandidate = '';
  
  // Process lines from bottom up since addresses are often at the bottom
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    
    // Skip empty lines
    if (!line) continue;
    
    // Skip if it's clearly not an address (phone numbers, emails, websites)
    const hasEmail = emails.some(e => line.toLowerCase().includes(e.toLowerCase()));
    const hasPhone = cleanPhones.some(p => line.includes(p.replace(/[\s-]/g, '')));
    const hasWebsite = (finalWebsite && line.toLowerCase().includes(finalWebsite.toLowerCase()));
    
    if (hasEmail || hasPhone || hasWebsite) continue;
    
    // Check if line has address characteristics
    const hasNumbers = /\d/.test(line);
    const hasCommas = line.includes(',');
    const hasAddressKeyword = addressKeywords.some(keyword => 
      line.toLowerCase().includes(keyword.toLowerCase())
    );
    
    // Must have numbers and either commas or address keywords
    if (hasNumbers && (hasCommas || hasAddressKeyword)) {
      // Additional validation - should not contain designation keywords
      const isDesignation = designationKeywords.some(kw => 
        line.toLowerCase().includes(kw.toLowerCase())
      );
      
      if (!isDesignation) {
        // This looks like a good address candidate
        // Check if it's longer than our current best
        if (line.length > bestAddressCandidate.length) {
          bestAddressCandidate = line;
        }
      }
    }
  }
  
  // If we didn't find a good candidate, try a different approach
  // Look for multi-line blocks that might contain addresses
  if (!bestAddressCandidate) {
    // Join consecutive lines and look for address patterns
    for (let i = Math.max(0, lines.length - 10); i < lines.length; i++) {
      // Try combining current line with next few lines
      for (let j = 1; j <= 3 && i + j < lines.length; j++) {
        const combinedLines = lines.slice(i, i + j + 1).join(', ').trim();
        
        // Skip if empty
        if (!combinedLines) continue;
        
        // Skip if it's clearly not an address
        const hasEmail = emails.some(e => combinedLines.toLowerCase().includes(e.toLowerCase()));
        const hasPhone = cleanPhones.some(p => combinedLines.includes(p.replace(/[\s-]/g, '')));
        const hasWebsite = (finalWebsite && combinedLines.toLowerCase().includes(finalWebsite.toLowerCase()));
        
        if (hasEmail || hasPhone || hasWebsite) continue;
        
        // Check address characteristics
        const hasNumbers = /\d/.test(combinedLines);
        const hasCommas = combinedLines.includes(',');
        const hasAddressKeyword = addressKeywords.some(keyword => 
          combinedLines.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // Must have numbers and either commas or address keywords
        if (hasNumbers && (hasCommas || hasAddressKeyword)) {
          // Additional validation
          const isDesignation = designationKeywords.some(kw => 
            combinedLines.toLowerCase().includes(kw.toLowerCase())
          );
          
          if (!isDesignation) {
            // This looks like a good address candidate
            if (combinedLines.length > bestAddressCandidate.length) {
              bestAddressCandidate = combinedLines;
            }
          }
        }
      }
    }
  }
  
  // Set the address if we found a good candidate
  if (bestAddressCandidate) {
    address = bestAddressCandidate;
  }
  
  // Remove ALL junk characters from all fields EXCEPT email and website
  const cleanText = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/[!*~"'/\-\\(),.?;:#^&[\]{}|<>`=+_]/g, '') // Remove ALL junk characters except @ and .
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };
  
  // Special cleaner for website that preserves dots
  const cleanWebsite = (text: string): string => {
    if (!text) return '';
    return text
      .replace(/[!*~"'/\-\\(),?;:#^&[\]{}|<>`=+_]/g, '') // Remove junk characters but keep dots and @
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };
  
  // Ensure email is always populated if we have one (and always contains @)
  const finalEmail = emails[0] || '';
  
  // Ensure phone is clean (take the first one if we have multiple)
  const finalPhone = cleanPhones[0] || '';
  
  return {
    name: name ? cleanText(name) : '',
    company: company ? cleanText(company) : '',
    designation: designation ? cleanText(designation) : '',
    email: finalEmail, // Keep email as is to preserve @
    phone: finalPhone,
    website: finalWebsite ? cleanWebsite(finalWebsite) : '', // Use special cleaner for website
    address: address ? cleanText(address) : '',
    imageData: imageData, // Base64 encoded image data
  };
};
