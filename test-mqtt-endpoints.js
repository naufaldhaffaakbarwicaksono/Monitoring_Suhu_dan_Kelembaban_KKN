/**
 * Test script untuk MQTT data endpoints
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000'; // Change to your deployment URL
const API_URL = `${BASE_URL}/api`;

// Test data
const sampleSensorData = {
  temperature: 25.5,
  humidity: 60.2,
  deviceId: 'SHT20-001',
  location: 'Living Room',
  timestamp: new Date().toISOString()
};

const batchSensorData = {
  readings: [
    {
      temperature: 24.8,
      humidity: 58.5,
      deviceId: 'SHT20-001',
      location: 'Living Room'
    },
    {
      temperature: 25.2,
      humidity: 61.0,
      deviceId: 'SHT20-001',
      location: 'Living Room'
    },
    {
      temperature: 24.9,
      humidity: 59.8,
      deviceId: 'SHT20-001',
      location: 'Living Room'
    }
  ]
};

const mqttWebhookData = {
  topic: 'sht20/data',
  payload: {
    temp: 26.1,
    hum: 62.5,
    deviceId: 'SHT20-ESP32'
  },
  timestamp: new Date().toISOString(),
  clientId: 'ESP32_001'
};

async function testEndpoint(method, endpoint, data = null) {
  try {
    console.log(`\n🧪 Testing ${method.toUpperCase()} ${endpoint}`);
    console.log('Data:', data ? JSON.stringify(data, null, 2) : 'No data');
    
    const config = {
      method,
      url: `${API_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    console.log('✅ Success:', response.status);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log('❌ Error:', error.response?.status || 'Connection error');
    console.log('Error details:', error.response?.data || error.message);
    return null;
  }
}

async function runTests() {
  console.log('🚀 Testing MQTT Data Endpoints\n');
  console.log('='.repeat(50));
  
  // Test 1: Health check
  await testEndpoint('GET', '/health');
  
  // Test 2: Single sensor data insert
  await testEndpoint('POST', '/sensor/data', sampleSensorData);
  
  // Test 3: Batch sensor data insert
  await testEndpoint('POST', '/sensor/batch', batchSensorData);
  
  // Test 4: MQTT webhook
  await testEndpoint('POST', '/mqtt/webhook', mqttWebhookData);
  
  // Test 5: Get latest data to verify insert
  await testEndpoint('GET', '/latest');
  
  // Test 6: Get recent readings
  await testEndpoint('GET', '/readings?limit=5');
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 All tests completed!');
  console.log('\n📝 Usage Examples:');
  
  console.log('\n1. ESP32 POST data directly:');
  console.log(`POST ${API_URL}/sensor/data`);
  console.log('Body:', JSON.stringify({
    temperature: 25.5,
    humidity: 60.2,
    deviceId: 'ESP32-001'
  }, null, 2));
  
  console.log('\n2. MQTT Broker Webhook:');
  console.log(`POST ${API_URL}/mqtt/webhook`);
  console.log('Body:', JSON.stringify({
    topic: 'sht20/data',
    payload: '{"temp":25.5,"hum":60.2}',
    clientId: 'ESP32-001'
  }, null, 2));
  
  console.log('\n3. Batch data upload:');
  console.log(`POST ${API_URL}/sensor/batch`);
  console.log('Body: { "readings": [...] }');
  
  console.log('\n🔗 Integration Options:');
  console.log('• ESP32 dapat POST langsung ke /api/sensor/data');
  console.log('• MQTT broker dengan webhook ke /api/mqtt/webhook');
  console.log('• Aplikasi mobile/desktop POST ke endpoints ini');
  console.log('• Scheduled jobs untuk data synchronization');
}

// ESP32 Arduino code example
function generateArduinoCode() {
  console.log('\n📟 ESP32 Arduino Code Example:');
  console.log('```cpp');
  console.log(`
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* serverURL = "${API_URL}/sensor/data";

void sendSensorData(float temp, float hum) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload
    DynamicJsonDocument doc(1024);
    doc["temperature"] = temp;
    doc["humidity"] = hum;
    doc["deviceId"] = "ESP32-SHT20";
    doc["location"] = "Sensor Location";
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    // Send POST request
    int httpResponseCode = http.POST(jsonString);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Data sent successfully: " + response);
    } else {
      Serial.println("Error sending data: " + String(httpResponseCode));
    }
    
    http.end();
  }
}
`);
  console.log('```');
}

// Run tests if called directly
if (require.main === module) {
  runTests().then(() => {
    generateArduinoCode();
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = {
  testEndpoint,
  runTests,
  generateArduinoCode
};
