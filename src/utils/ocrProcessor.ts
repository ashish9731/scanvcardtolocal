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
    
    // Parse extracted text
    const parsedData = parseCardData(text);
    
    return {
      id: Date.now().toString(),
      ...parsedData,
    };
  } finally {
    await worker.terminate();
  }
};

const parseCardData = (text: string): Omit<CardData, 'id'> => {
  const lines = text.split('\n').filter(line => line.trim());
  
  // Email regex
  const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
  const emailMatches = text.match(emailRegex);
  const emails: string[] = emailMatches ? Array.from(emailMatches) : [];
  
  // Phone regex (various formats)
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\+?\d{10,}/g;
  const phoneMatches = text.match(phoneRegex);
  const phones: string[] = phoneMatches ? Array.from(phoneMatches) : [];
  
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
      // Generate website with www prefix
      websiteFromEmail = `www.${domain}`;
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
  
  // Find company name - prioritize logo area (first few lines) or email domain
  // Logo company names are usually in the first 3-4 lines, often capitalized or unique
  let companyFromText = '';
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const line = lines[i].trim();
    const hasNumbers = /\d/.test(line);
    const isPhone = phones.some((p: string) => line.includes(p));
    const isEmail = emails.some((e: string) => line.includes(e));
    const isDesignation = designationKeywords.some((kw: string) => line.toLowerCase().includes(kw.toLowerCase()));
    const hasMultipleWords = line.split(' ').length >= 2;
    const isCapitalized = /^[A-Z]/.test(line);
    
    // Company name is likely: capitalized, 2+ words, no numbers, not email/phone/designation
    if (line && 
        !isEmail && 
        !isPhone &&
        !isDesignation &&
        !hasNumbers &&
        hasMultipleWords &&
        isCapitalized &&
        line.length > 3) {
      companyFromText = line;
      break;
    }
  }
  
  // Prioritize: text from logo area > email domain
  company = companyFromText || companyFromEmail;
  
  // If still no company, fallback to safer text parsing
  if (!company && lines.length > 1) {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      const hasNumbers = /\d/.test(line);
      const isPhone = phones.some((p: string) => line.includes(p));
      const isDesignation = designationKeywords.some((kw: string) => line.toLowerCase().includes(kw.toLowerCase()));
      
      if (line && 
          !emails.includes(line) && 
          !isPhone &&
          !isDesignation &&
          !hasNumbers &&
          line.length > 2) {
        company = line;
        break;
      }
    }
  }
  
  // Heuristic: First non-empty line that's not the company is often the name
  if (lines.length > 0) {
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i].trim();
      if (line && line !== company && !designationKeywords.some(kw => line.toLowerCase().includes(kw.toLowerCase()))) {
        name = line;
        break;
      }
    }
  }
  
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
