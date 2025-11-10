import { createWorker } from 'tesseract.js';

// Helper function to resize image for better OCR performance
const resizeImageForOCR = (imageData: string): Promise<string> => {
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
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.src = imageData;
  });
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
  linkedinUrl?: string; // Optional LinkedIn profile URL
}

export const processImage = async (imageData: string): Promise<CardData> => {
  const worker = await createWorker('eng');
  
  try {
    // Configure worker for better performance with business cards
    await worker.setParameters({
      tessedit_pageseg_mode: '6' as unknown as Tesseract.PSM, // Assume a single uniform block of text (PSM.SINGLE_BLOCK)
      tessedit_ocr_engine_mode: '1' as unknown as Tesseract.OEM, // Use LSTM OCR Engine only (OEM.LSTM_ONLY)
      tessedit_do_invert: '0', // Skip inversion for better performance
    });
    
    // Resize image for better performance if it's too large
    const resizedImageData = await resizeImageForOCR(imageData);
    
    const { data: { text } } = await worker.recognize(resizedImageData);
    
    // Parse extracted text
    const parsedData = parseCardData(text, resizedImageData);
    
    return {
      id: Date.now().toString(),
      ...parsedData,
    };
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
  
  // Enhanced name detection - look for capitalized names (2-4 words, no designation keywords)
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    const words = line.split(' ');
    const isAllCaps = line === line.toUpperCase() && line.length > 3;
    const hasDesignation = designationKeywords.some(kw => line.toLowerCase().includes(kw.toLowerCase()));
    const hasNumbers = /\d/.test(line);
    const hasEmail = emails.some(e => line.toLowerCase().includes(e));
    const hasPhone = phones.some(p => line.includes(p.replace(/[\s-]/g, '')));
    
    // Name is likely: all caps or capitalized, 2-4 words, no designation/numbers/email/phone
    if (line && 
        words.length >= 2 && 
        words.length <= 4 &&
        (isAllCaps || /^[A-Z][a-z]/.test(line)) &&
        !hasDesignation &&
        !hasNumbers &&
        !hasEmail &&
        !hasPhone) {
      name = line;
      break;
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
  
  for (let i = 0; i < logoAreaLines.length; i++) {
    const line = logoAreaLines[i].trim();
    const words = line.split(' ');
    const isAllCaps = line === line.toUpperCase() && line.length > 1;
    const hasNumbers = /\d/.test(line);
    const isPhone = phones.some(p => line.includes(p.replace(/[\s-]/g, '')));
    const isEmail = emails.some(e => line.toLowerCase().includes(e));
    const isDesignation = designationKeywords.some(kw => line.toLowerCase().includes(kw.toLowerCase()));
    const isName = line === name;
    const hasCompanySuffix = companySuffixes.some(suffix => line.toLowerCase().includes(suffix.toLowerCase()));
    
    // Enhanced company detection logic:
    // - All caps text in logo area (often company names/logos)
    // - Multiple words (2-6) that don't contain numbers
    // - Contains company suffixes
    // - Not identified as name, phone, email, or designation
    if (line && 
        !isName &&
        !isEmail && 
        !isPhone &&
        !isDesignation &&
        line.length > 1 &&
        (isAllCaps || (words.length >= 2 && words.length <= 6) || hasCompanySuffix) &&
        !hasNumbers) {
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
  const addressKeywords: string[] = ['street', 'road', 'avenue', 'ave', 'blvd', 'suite', 'floor', 'building'];
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.length > 20 || addressKeywords.some((kw: string) => line.toLowerCase().includes(kw))) {
      address = line;
      break;
    }
  }
  
  return {
    name: name || '',
    company: company || '',
    designation: designation || '',
    email: emails[0] || '',
    phone: phones[0] || '',
    website: websiteFromEmail || '',
    address: address || '',
    imageData: imageData, // Base64 encoded image data
  };
};
