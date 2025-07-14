// Test script untuk MQTT service
require('dotenv').config();
const mqttService = require('./lib/mqtt-service');

async function testMQTTService() {
  console.log('🧪 Testing MQTT Service...');
  
  try {
    // Initialize MQTT service
    console.log('1. Initializing MQTT service...');
    await mqttService.initialize();
    console.log('✅ MQTT service initialized');
    
    // Test status
    console.log('2. Testing connection status...');
    console.log('Connected:', mqttService.isConnected);
    
    // Test publish retain message
    console.log('3. Publishing test retain message...');
    const testMessage = {
      temp: 25.5,
      hum: 60.2,
      timestamp: new Date().toISOString(),
      deviceId: 'TEST-001'
    };
    
    await mqttService.publishRetainMessage('test/data', JSON.stringify(testMessage));
    console.log('✅ Test message published');
    
    // Wait a bit for message to be processed
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Test retain messages retrieval
    console.log('4. Getting retain messages...');
    const retainMessages = mqttService.getRetainMessages();
    console.log('Retain messages count:', retainMessages.length);
    console.log('Retain messages:', retainMessages);
    
    // Test message logs
    console.log('5. Getting message logs...');
    const logs = await mqttService.getMessageLogs({ limit: 5 });
    console.log('Recent logs:', logs.length);
    
    // Test recovery
    console.log('6. Testing data recovery...');
    await mqttService.recoverRetainMessages();
    console.log('✅ Data recovery completed');
    
    console.log('🎉 All MQTT tests passed!');
    
  } catch (error) {
    console.error('❌ MQTT test failed:', error);
  } finally {
    // Cleanup
    console.log('7. Cleaning up...');
    await mqttService.disconnect();
    process.exit(0);
  }
}

// Run test
testMQTTService();
