// Debug script to test company name extraction
import { parseCardData } from './ocrProcessor';

// Test case 1: Business card with website
const testCard1 = `
JOHN DOE
CEO
ACME CORPORATION
john.doe@acme.com
www.abc.com
+1 (555) 123-4567
123 Business Street
`;

// Test case 2: Business card with website but no clear company name in text
const testCard2 = `
JOHN DOE
Chief Executive Officer
john.doe@xyz.com
www.xyz.com
+1 (555) 987-6543
456 Corporate Ave
`;

console.log('=== Test Case 1 ===');
const result1 = parseCardData(testCard1);
console.log('Name:', result1.name);
console.log('Designation:', result1.designation);
console.log('Company:', result1.company);
console.log('Website:', result1.website);
console.log('');

console.log('=== Test Case 2 ===');
const result2 = parseCardData(testCard2);
console.log('Name:', result2.name);
console.log('Designation:', result2.designation);
console.log('Company:', result2.company);
console.log('Website:', result2.website);