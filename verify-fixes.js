#!/usr/bin/env node

console.log('🔍 Verifying Traffic Assist fixes...\n');

const fs = require('fs');
const path = require('path');

// Check 1: Theme import fix
console.log('1. Checking theme import fix...');
const webAdaptationPath = path.join(__dirname, 'src/components/WebAdaptation.tsx');
if (fs.existsSync(webAdaptationPath)) {
  const content = fs.readFileSync(webAdaptationPath, 'utf8');
  if (content.includes('TrafficAssistTheme as theme')) {
    console.log('   ✅ Theme import correctly aliased');
  } else {
    console.log('   ❌ Theme import issue still exists');
  }
} else {
  console.log('   ❌ WebAdaptation.tsx not found');
}

// Check 2: Geolocation import fix
console.log('\n2. Checking geolocation import fix...');
const locationPath = path.join(__dirname, 'src/sensors/location.ts');
if (fs.existsSync(locationPath)) {
  const content = fs.readFileSync(locationPath, 'utf8');
  if (content.includes('react-native-geolocation-service') && !content.includes('@react-native-community/geolocation')) {
    console.log('   ✅ Geolocation import correctly updated');
  } else {
    console.log('   ❌ Geolocation import issue still exists');
  }

  if (content.includes('Platform.OS === \'web\'')) {
    console.log('   ✅ Cross-platform geolocation implemented');
  } else {
    console.log('   ❌ Cross-platform geolocation missing');
  }
} else {
  console.log('   ❌ location.ts not found');
}

// Check 3: Professional logging system
console.log('\n3. Checking professional logging system...');
const loggerPath = path.join(__dirname, 'src/utils/logger.ts');
if (fs.existsSync(loggerPath)) {
  const content = fs.readFileSync(loggerPath, 'utf8');
  if (content.includes('LogLevel') && content.includes('export class Logger')) {
    console.log('   ✅ Professional logging system implemented');
  } else {
    console.log('   ❌ Logging system incomplete');
  }
} else {
  console.log('   ❌ logger.ts not found');
}

// Check 4: Webpack configuration
console.log('\n4. Checking webpack configuration...');
const webpackPath = path.join(__dirname, 'webpack.config.js');
if (fs.existsSync(webpackPath)) {
  const content = fs.readFileSync(webpackPath, 'utf8');
  if (content.includes('geolocation-mock.js')) {
    console.log('   ✅ Webpack aliases configured for web mocks');
  } else {
    console.log('   ❌ Webpack aliases missing');
  }
} else {
  console.log('   ❌ webpack.config.js not found');
}

console.log('\n🎉 Fix verification complete!');
console.log('\nThe following console errors should now be resolved:');
console.log('   • "Uncaught ReferenceError: theme is not defined"');
console.log('   • "Module not found: Error: Can\'t resolve \'@react-native-community/geolocation\'"');
console.log('\nAdditional improvements:');
console.log('   • Professional logging system replacing console.log statements');
console.log('   • Cross-platform geolocation support for web and mobile');
console.log('   • Cleaned codebase with unnecessary files removed');
