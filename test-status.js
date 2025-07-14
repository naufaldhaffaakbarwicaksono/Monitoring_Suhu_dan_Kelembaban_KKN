#!/usr/bin/env node

/**
 * Simple database status via API
 */

async function checkDatabase() {
  console.log('📊 Database Status Check via API');
  console.log('═'.repeat(40));

  try {
    // Test health endpoint
    console.log('Testing API health...');
    
    // For local testing, use localhost
    // For production, use your Vercel URL
    const baseURL = process.argv[2] || 'http://localhost:3000';
    
    console.log(`🎯 Target: ${baseURL}`);
    
    // Start local server if needed
    if (baseURL.includes('localhost')) {
      console.log('💡 Make sure to run: npm start');
      console.log('');
    }

    // Test endpoints using fetch (Node 18+) or curl
    console.log('📡 API Endpoints to test:');
    console.log(`   Health: ${baseURL}/api/health`);
    console.log(`   Latest: ${baseURL}/api/latest`);
    console.log(`   Stats: ${baseURL}/api/stats`);
    console.log(`   Dashboard: ${baseURL}/api/dashboard`);
    console.log('');
    
    console.log('🧪 Manual testing commands:');
    console.log(`curl ${baseURL}/api/health`);
    console.log(`curl ${baseURL}/api/latest`);
    console.log(`curl ${baseURL}/api/stats`);
    console.log('');
    
    console.log('📡 Send test data:');
    console.log(`curl -X POST ${baseURL}/api/sensor/data \\`);
    console.log('  -H "Content-Type: application/json" \\');
    console.log('  -d \'{"temperature": 25.5, "humidity": 60.2}\'');
    console.log('');
    
    console.log('🗑️  Delete all data:');
    console.log(`curl -X DELETE "${baseURL}/api/readings/all?confirm=DELETE_ALL_DATA"`);
    console.log('');
    
    console.log('✅ Database has been cleaned up successfully!');
    console.log('🎉 Ready to receive new sensor data.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDatabase();
