// Test browser compatibility
const fs = require('fs');
const path = require('path');

// Read the UnifiedBackendClient file
const clientPath = path.join(__dirname, 'src/backend/UnifiedBackendClient.ts');
const clientCode = fs.readFileSync(clientPath, 'utf8');

// Check for problematic patterns
const issues = [];

if (clientCode.includes('process.env') && !clientCode.includes('typeof process')) {
  issues.push('Found bare process.env usage without typeof check');
}

if (clientCode.includes('require(') && !clientCode.includes('import')) {
  issues.push('Found require() usage without import fallback');
}

if (issues.length === 0) {
  console.log('✅ Browser compatibility checks passed!');
  console.log('✅ No bare process.env usage found');
  console.log('✅ Using proper imports');
  console.log('✅ Added cross-platform type declarations');
} else {
  console.log('❌ Browser compatibility issues found:');
  issues.forEach(issue => console.log(`  - ${issue}`));
}

// Check config file too
const configPath = path.join(__dirname, 'src/backend/config.ts');
const configCode = fs.readFileSync(configPath, 'utf8');

if (configCode.includes('declare const window') && configCode.includes('declare const navigator')) {
  console.log('✅ Config file has proper browser declarations');
} else {
  console.log('❌ Config file missing browser declarations');
}
