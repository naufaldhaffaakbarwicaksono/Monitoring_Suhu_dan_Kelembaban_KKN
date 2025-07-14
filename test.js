#!/usr/bin/env node

/**
 * Simple test for sensor endpoints
 */

const baseURL = process.argv[2] || 'http://localhost:3000';

console.log('🧪 Testing Sensor API Endpoints');
console.log(`🎯 Target: ${baseURL}\n`);

// Test data
const testData = {
  temperature: 25.5,
  humidity: 65.2,
  deviceId: 'TEST-001',
  location: 'Test Lab'
};

async function testEndpoint(method, path, data = null) {
  try {
    const url = `${baseURL}${path}`;
    console.log(`Testing ${method} ${path}...`);
    
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    
    if (data) {
      options.body = JSON.stringify(data);
    }
    
    const response = await fetch(url, options);
    const result = await response.json();
    
    if (response.ok) {
      console.log(`✅ Success: ${response.status}`);
    } else {
      console.log(`❌ Error: ${response.status}`);
    }
    
    console.log('Response:', JSON.stringify(result, null, 2));
    console.log('-'.repeat(50));
  } catch (error) {
    console.log(`❌ Failed: ${error.message}`);
    console.log('-'.repeat(50));
  }
}

async function runTests() {
  // Test endpoints
  await testEndpoint('GET', '/api/health');
  await testEndpoint('POST', '/api/sensor/data', testData);
  await testEndpoint('GET', '/api/latest');
  await testEndpoint('GET', '/api/readings?hours=1');
  await testEndpoint('GET', '/api/stats?hours=24');
  await testEndpoint('GET', '/api/dashboard');
  
  console.log('🎉 Tests completed!');
  console.log('\n📖 Usage:');
  console.log(`node test.js ${baseURL}`);
}

if (typeof fetch === 'undefined') {
  // Node.js < 18 fallback
  console.log('❌ This test requires Node.js 18+ or install node-fetch');
  console.log('npm install node-fetch');
  process.exit(1);
}

runTests();
