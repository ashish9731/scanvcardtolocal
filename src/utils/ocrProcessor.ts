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
  
  // Website regex
  const websiteRegex = /(https?:\/\/)?(www\.)?[-a-zA-Z0-9@:%._+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_+.~#?&//=]*)/gi;
  const websiteMatches = text.match(websiteRegex);
  const websites: string[] = websiteMatches ? Array.from(websiteMatches) : [];
  
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
  
  // Company name is often second line or line with certain keywords
  if (lines.length > 1) {
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && 
          !emails.includes(line) && 
          !phones.some((p: string) => line.includes(p)) &&
          line !== designation &&
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
    website: websites.filter((w: string) => !w.includes('@'))[0] || '',
    address: address || '',
  };
};
