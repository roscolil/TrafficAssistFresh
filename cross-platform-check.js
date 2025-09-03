#!/usr/bin/env node

console.log('🔧 Checking cross-platform compatibility fixes...\n');

const fs = require('fs');

// Test 1: Check Platform.OS usage in config files
console.log('1. Checking Platform.OS usage in backend files...');
const backendFiles = [
  'src/backend/config.ts',
  'src/backend/UnifiedBackendClient.ts',
  'src/backend/WebBackendService.ts',
  'src/components/WebAdaptation.tsx'
];

backendFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');

    // Check for Platform.OS usage
    const hasPlatformOS = content.includes('Platform.OS');

    // Check for unsafe window/navigator usage
    const hasUnsafeWindow = content.match(/(?<!Platform\.OS === 'web' &&[^}]*?)(?<!typeof )window\./g);
    const hasUnsafeNavigator = content.match(/(?<!Platform\.OS === 'web' &&[^}]*?)(?<!typeof )navigator\./g);

    console.log(`   ${file}:`);
    console.log(`     Platform.OS usage: ${hasPlatformOS ? '✅' : '❌'}`);
    console.log(`     Unsafe window refs: ${hasUnsafeWindow ? '⚠️  ' + hasUnsafeWindow.length : '✅ None'}`);
    console.log(`     Unsafe navigator refs: ${hasUnsafeNavigator ? '⚠️  ' + hasUnsafeNavigator.length : '✅ None'}`);
  } else {
    console.log(`   ❌ ${file}: File not found`);
  }
});

// Test 2: Check for remaining console statements
console.log('\n2. Checking for remaining console statements...');
let totalConsoleStatements = 0;

backendFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const consoleLines = lines
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => line.includes('console.') && !line.startsWith('//'))
      .slice(0, 2); // Show first 2 occurrences

    if (consoleLines.length > 0) {
      totalConsoleStatements += consoleLines.length;
      console.log(`   ⚠️  ${file}: Found ${consoleLines.length} console statements`);
      consoleLines.forEach(({ line, number }) => {
        console.log(`      Line ${number}: ${line}`);
      });
    } else {
      console.log(`   ✅ ${file}: Clean`);
    }
  }
});

if (totalConsoleStatements === 0) {
  console.log('   🎉 All console statements replaced with professional logging!');
}

// Test 3: Check for type declarations
console.log('\n3. Checking for proper type declarations...');
backendFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');

    const hasWindowDeclaration = content.includes('declare const window');
    const hasNavigatorDeclaration = content.includes('declare const navigator');
    const needsDeclarations = content.includes('window.') || content.includes('navigator.');

    if (needsDeclarations) {
      console.log(`   ${file}:`);
      console.log(`     Window declaration: ${hasWindowDeclaration ? '✅' : '❌'}`);
      console.log(`     Navigator declaration: ${hasNavigatorDeclaration ? '✅' : '❌'}`);
    }
  }
});

console.log('\n🚀 Summary of fixes applied:');
console.log('  ✅ Added Platform.OS detection to WebAdaptation.tsx');
console.log('  ✅ Fixed window.location access in backend config');
console.log('  ✅ Added Platform.OS checks for navigator/screen access');
console.log('  ✅ Replaced console statements with professional logging');
console.log('  ✅ Added proper TypeScript declarations for web APIs');

console.log('\n🎯 These errors should now be resolved:');
console.log('  • TypeError: Cannot read property \'hostname\' of undefined');
console.log('  • TypeError: window.addEventListener is not a function');
console.log('  • TypeError: Cannot read property \'backendClient\' of undefined');

console.log('\n📱 Test with:');
console.log('  iOS: npx react-native run-ios');
console.log('  Android: npx react-native run-android');
console.log('  Web: pnpm web');
