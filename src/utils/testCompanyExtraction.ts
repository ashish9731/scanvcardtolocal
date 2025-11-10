// Test function to verify company name extraction from website domains
import { parseCardData } from './ocrProcessor';

// Test data with website domain
const testData = `
JOHN DOE
CEO
john.doe@techcompany.com
www.techcompany.com
+1 (555) 123-4567
123 Tech Street
San Francisco, CA 94102
`;

console.log('Testing company name extraction from website domain...');
const result = parseCardData(testData);
console.log('Extracted company name:', result.company);
console.log('Expected company name: Techcompany');