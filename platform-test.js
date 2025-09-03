#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing cross-platform compatibility...\n');

// Test 1: Check that required dependencies exist
console.log('1. Checking native dependencies...');
const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const requiredDeps = [
  'react-native-geolocation-service',
  'react-native-vision-camera',
  'react-native-reanimated',
  'react-native-keep-awake',
  'react-native-heading',
  'react-native-tts',
  'react-native-haptic-feedback'
];

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    console.log(`   ✅ ${dep}: ${packageJson.dependencies[dep]}`);
  } else {
    console.log(`   ❌ ${dep}: Missing`);
  }
});

// Test 2: Check for platform-specific imports
console.log('\n2. Checking Platform.OS usage...');
const files = [
  'src/sensors/location.ts',
  'src/camera/CameraView.tsx',
  'src/components/WebAdaptation.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('Platform.OS')) {
      console.log(`   ✅ ${file}: Uses Platform.OS for cross-platform compatibility`);
    } else {
      console.log(`   ⚠️  ${file}: No Platform.OS usage detected`);
    }
  } else {
    console.log(`   ❌ ${file}: File not found`);
  }
});

// Test 3: Check for console.log cleanup
console.log('\n3. Checking for remaining console.log statements...');
const sourceFiles = [
  'src/App.tsx',
  'src/camera/CameraView.tsx',
  'src/sensors/location.ts',
  'src/components/WebAdaptation.tsx'
];

let hasConsoleLog = false;
sourceFiles.forEach(file => {
  if (fs.existsSync(file)) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    const consoleLines = lines
      .map((line, index) => ({ line: line.trim(), number: index + 1 }))
      .filter(({ line }) => line.includes('console.') && !line.startsWith('//'))
      .slice(0, 3); // Show first 3 occurrences

    if (consoleLines.length > 0) {
      hasConsoleLog = true;
      console.log(`   ⚠️  ${file}: Found console statements:`);
      consoleLines.forEach(({ line, number }) => {
        console.log(`      Line ${number}: ${line}`);
      });
    } else {
      console.log(`   ✅ ${file}: No console statements found`);
    }
  }
});

if (!hasConsoleLog) {
  console.log('   🎉 All console.log statements have been replaced with professional logging!');
}

// Test 4: Check web mocks
console.log('\n4. Checking web compatibility mocks...');
const webMocks = [
  'src/web/geolocation-mock.js',
  'src/web/camera-mock.js',
  'src/web/keep-awake-mock.js',
  'src/web/heading-mock.js',
  'src/web/tts-mock.js',
  'src/web/haptic-mock.js'
];

webMocks.forEach(mock => {
  if (fs.existsSync(mock)) {
    console.log(`   ✅ ${mock}: Available`);
  } else {
    console.log(`   ❌ ${mock}: Missing`);
  }
});

// Test 5: Check native module safe imports
console.log('\n5. Checking safe native module imports...');
if (fs.existsSync('src/camera/CameraView.tsx')) {
  const content = fs.readFileSync('src/camera/CameraView.tsx', 'utf8');
  if (content.includes('try {') && content.includes('require(') && content.includes('catch')) {
    console.log('   ✅ CameraView: Uses safe imports with try/catch');
  } else {
    console.log('   ❌ CameraView: Missing safe import pattern');
  }
}

console.log('\n📱 Platform-specific recommendations:');
console.log('');
console.log('For iOS testing:');
console.log('  1. Run: cd ios && pod install');
console.log('  2. Run: npx react-native run-ios');
console.log('  3. Test on simulator (camera will show fallback)');
console.log('  4. Test on device for full camera functionality');
console.log('');
console.log('For Android testing:');
console.log('  1. Run: npx react-native run-android');
console.log('  2. Ensure USB debugging is enabled');
console.log('  3. Grant camera and location permissions');
console.log('');
console.log('For Web testing:');
console.log('  1. Run: pnpm web');
console.log('  2. Check browser console for errors');
console.log('  3. Test geolocation permission prompts');
