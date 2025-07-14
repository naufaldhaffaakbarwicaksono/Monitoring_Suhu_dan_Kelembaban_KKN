#!/usr/bin/env node

/**
 * Test script untuk memastikan aplikasi siap untuk deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Testing deployment readiness...\n');

// Test 1: Check required files
console.log('1. Checking required files...');
const requiredFiles = [
  'package.json',
  'vercel.json',
  'api/index.js',
  'prisma/schema.prisma',
  '.env'
];

const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
if (missingFiles.length > 0) {
  console.error('❌ Missing required files:', missingFiles);
  process.exit(1);
}
console.log('✅ All required files present');

// Test 2: Check package.json scripts
console.log('\n2. Checking package.json scripts...');
const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const requiredScripts = ['build', 'vercel-build'];
const missingScripts = requiredScripts.filter(script => !packageJson.scripts[script]);
if (missingScripts.length > 0) {
  console.warn('⚠️  Missing recommended scripts:', missingScripts);
} else {
  console.log('✅ Build scripts configured');
}

// Test 3: Check dependencies
console.log('\n3. Checking dependencies...');
const requiredDeps = ['@prisma/client', 'prisma', 'express'];
const missingDeps = requiredDeps.filter(dep => 
  !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]
);
if (missingDeps.length > 0) {
  console.error('❌ Missing required dependencies:', missingDeps);
  process.exit(1);
}
console.log('✅ Dependencies look good');

// Test 4: Check environment variables
console.log('\n4. Checking environment variables...');
require('dotenv').config();
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is required');
  process.exit(1);
}
console.log('✅ DATABASE_URL is configured');

// Test 5: Test Prisma schema
console.log('\n5. Testing Prisma configuration...');
try {
  execSync('npx prisma validate', { stdio: 'inherit' });
  console.log('✅ Prisma schema is valid');
} catch (error) {
  console.error('❌ Prisma schema validation failed');
  process.exit(1);
}

// Test 6: Test build process
console.log('\n6. Testing build process...');
try {
  execSync('npm run build', { stdio: 'inherit' });
  console.log('✅ Build completed successfully');
} catch (error) {
  console.error('❌ Build failed');
  process.exit(1);
}

// Test 7: Test API endpoints (if server is running)
console.log('\n7. Testing API structure...');
const apiIndexPath = path.join(__dirname, 'api', 'index.js');
if (fs.existsSync(apiIndexPath)) {
  try {
    require(apiIndexPath);
    console.log('✅ API module loads correctly');
  } catch (error) {
    console.error('❌ API module failed to load:', error.message);
    process.exit(1);
  }
} else {
  console.error('❌ api/index.js not found');
  process.exit(1);
}

console.log('\n🎉 All tests passed! Your app is ready for Vercel deployment.');
console.log('\nNext steps:');
console.log('1. Push your code to GitHub');
console.log('2. Import the repository in Vercel');
console.log('3. Set DATABASE_URL environment variable in Vercel');
console.log('4. Deploy!');
console.log('\nOr use Vercel CLI:');
console.log('  vercel --prod');
