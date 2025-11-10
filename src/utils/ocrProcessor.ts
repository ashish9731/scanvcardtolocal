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
      // Remove TLD extensions to get company name
      const domainWithoutTLD = domain.replace(/\.(com|co\.in|net|org|io|edu|gov|biz|info|me|tv|us|uk|ca|au|de|fr|jp|cn|in)$/i, '');
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
  
  // Heuristic: First non-empty line is often the name
  if (lines.length > 0) {
    name = lines[0].trim();
  }
  
  // Company name: prioritize email domain, fallback to parsed text
  company = companyFromEmail;
  
  // If no company from email, try finding from text (but avoid phone numbers and designations)
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
