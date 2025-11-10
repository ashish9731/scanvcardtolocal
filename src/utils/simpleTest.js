// Simple test to verify company name extraction
const { parseCardData } = require('./ocrProcessor');

// Test case: Business card with website www.abc.com
const testCard = `
JOHN DOE
CEO
john.doe@example.com
www.abc.com
+1 (555) 123-4567
`;

console.log('Testing company name extraction...');
const result = parseCardData(testCard);
console.log('Name:', result.name);
console.log('Designation:', result.designation);
console.log('Company:', result.company);
console.log('Website:', result.website);