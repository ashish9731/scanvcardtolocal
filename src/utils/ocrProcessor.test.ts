import { parseCardData } from './ocrProcessor';

// Mock OCR text data for testing
const mockBusinessCardText1 = `
JOHN DOE
CEO
ACME CORPORATION
john.doe@acme.com
+1 (555) 123-4567
www.acme.com
123 Business Street, Suite 100
New York, NY 10001
`;

const mockBusinessCardText2 = `
JANE SMITH
Marketing Director
GLOBAL TECH SOLUTIONS
jane.smith@globaltech.io
(456) 987-6543
www.globaltech.io
456 Innovation Blvd
San Francisco, CA 94102
`;

const mockBusinessCardText3 = `
DR. ROBERT JOHNSON
CHIEF TECHNOLOGY OFFICER
INNOVATE LTD
robert.johnson@innovate.co.uk
+44 20 7123 4567
www.innovate.co.uk
789 Research Park
London, UK SW1A 1AA
`;

describe('OCR Processor Tests', () => {
  test('should correctly parse business card with standard format', () => {
    const result = parseCardData(mockBusinessCardText1);
    
    expect(result.name).toBe('JOHN DOE');
    expect(result.designation).toBe('CEO');
    expect(result.company).toBe('ACME CORPORATION');
    expect(result.email).toBe('john.doe@acme.com');
    expect(result.phone).toBe('+1 (555) 123-4567');
    expect(result.website).toBe('www.acme.com');
  });

  test('should correctly parse business card with different format', () => {
    const result = parseCardData(mockBusinessCardText2);
    
    expect(result.name).toBe('JANE SMITH');
    expect(result.designation).toBe('Marketing Director');
    expect(result.company).toBe('GLOBAL TECH SOLUTIONS');
    expect(result.email).toBe('jane.smith@globaltech.io');
    expect(result.phone).toBe('(456) 987-6543');
    expect(result.website).toBe('www.globaltech.io');
  });

  test('should correctly parse international business card', () => {
    const result = parseCardData(mockBusinessCardText3);
    
    expect(result.name).toBe('DR. ROBERT JOHNSON');
    expect(result.designation).toBe('CHIEF TECHNOLOGY OFFICER');
    expect(result.company).toBe('INNOVATE LTD');
    expect(result.email).toBe('robert.johnson@innovate.co.uk');
    expect(result.phone).toBe('+44 20 7123 4567');
    expect(result.website).toBe('www.innovate.co.uk');
  });
});