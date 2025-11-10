import { createWorker } from 'tesseract.js';

export interface CardData {
  id: string;
  name: string;
  company: string;
  designation: string;
  email: string;
  phone: string;
  website: string;
  address: string;
}

export const processImage = async (imageData: string): Promise<CardData> => {
  const worker = await createWorker('eng');
  
  try {
    const { data: { text } } = await worker.recognize(imageData);
    
    // Debug: Log raw OCR text
    console.log('=== RAW OCR TEXT ===');
    console.log(text);
    console.log('===================');
    
    // Parse extracted text
    const parsedData = parseCardData(text);
    
    // Debug: Log parsed data
    console.log('=== PARSED DATA ===');
    console.log(parsedData);
    console.log('===================');
    
    return {
      id: Date.now().toString(),
      ...parsedData,
    };
  } finally {
    await worker.terminate();
  }
};

const parseCardData = (text: string): Omit<CardData, 'id'> => {
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
  let websiteFromText = websiteMatches ? websiteMatches[0].toLowerCase() : '';
  
  // Extract company name and website from email domain
  let companyFromEmail = '';
  let websiteFromEmail = '';
  
  if (emails.length > 0) {
    const emailParts = emails[0].split('@');
    if (emailParts.length === 2) {
      const domain = emailParts[1];
      // Remove TLD extensions to get company name (expanded list)
      const domainWithoutTLD = domain.replace(/\.(com|co\.in|co\.uk|net|org|io|edu|gov|biz|info|me|tv|us|uk|ca|au|de|fr|jp|cn|in|app|dev|tech|online|store|shop|site|xyz|club|pro|asia|eu)$/i, '');
      companyFromEmail = domainWithoutTLD.charAt(0).toUpperCase() + domainWithoutTLD.slice(1);
      // Generate website with www prefix if not found in text
      websiteFromEmail = websiteFromText || `www.${domain}`;
    }
  }
  
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
  let companyFromText = '';
  
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i].trim();
    const words = line.split(' ');
    const isAllCaps = line === line.toUpperCase();
    const hasNumbers = /\d/.test(line);
    const isPhone = phones.some(p => line.includes(p.replace(/[\s-]/g, '')));
    const isEmail = emails.some(e => line.toLowerCase().includes(e));
    const isDesignation = designationKeywords.some(kw => line.toLowerCase().includes(kw.toLowerCase()));
    const isName = line === name;
    
    // Company name is likely: in first lines, all caps or multiple words, not name/phone/email/designation
    if (line && 
        !isName &&
        !isEmail && 
        !isPhone &&
        !isDesignation &&
        line.length > 2 &&
        (isAllCaps || words.length >= 2) &&
        !hasNumbers) {
      companyFromText = line;
      break;
    }
  }
  
  // Prioritize: text from logo area > email domain
  company = companyFromText || companyFromEmail;
  
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
  };
};
