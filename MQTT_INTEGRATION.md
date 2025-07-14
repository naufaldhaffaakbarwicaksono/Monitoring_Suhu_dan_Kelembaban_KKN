# 📡 MQTT Data Integration Guide

Panduan lengkap untuk mengirim data sensor dari MQTT broker atau device langsung ke aplikasi.

## 🎯 Endpoints yang Tersedia

### 1. Single Sensor Data
**POST** `/api/sensor/data`

Untuk mengirim satu pembacaan sensor.

```json
{
  "temperature": 25.5,
  "humidity": 60.2,
  "deviceId": "SHT20-001",
  "location": "Living Room",
  "timestamp": "2025-07-14T10:30:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Sensor data saved successfully",
  "data": {
    "id": 123,
    "temperature": 25.5,
    "humidity": 60.2,
    "deviceId": "SHT20-001",
    "location": "Living Room",
    "timestamp": "2025-07-14T10:30:00.000Z"
  }
}
```

### 2. Batch Data Upload
**POST** `/api/sensor/batch`

Untuk mengirim multiple pembacaan sekaligus (max 100).

```json
{
  "readings": [
    {
      "temperature": 24.8,
      "humidity": 58.5,
      "deviceId": "SHT20-001"
    },
    {
      "temperature": 25.2,
      "humidity": 61.0,
      "deviceId": "SHT20-001"
    }
  ]
}
```

### 3. MQTT Webhook
**POST** `/api/mqtt/webhook`

Untuk integrasi dengan MQTT broker yang mendukung webhooks.

```json
{
  "topic": "sht20/data",
  "payload": "{\"temp\":25.5,\"hum\":60.2}",
  "timestamp": "2025-07-14T10:30:00Z",
  "clientId": "ESP32_001"
}
```

## 🔌 Metode Integrasi

### 1. ESP32/Arduino Direct POST

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "your-wifi";
const char* password = "your-password";
const char* serverURL = "https://your-app.vercel.app/api/sensor/data";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("Connected to WiFi");
}

void sendSensorData(float temperature, float humidity) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON
    DynamicJsonDocument doc(1024);
    doc["temperature"] = temperature;
    doc["humidity"] = humidity;
    doc["deviceId"] = "ESP32-SHT20";
    doc["location"] = "Room A";
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    // Send POST
    int httpResponseCode = http.POST(jsonString);
    
    if (httpResponseCode == 200) {
      Serial.println("✅ Data sent successfully");
    } else {
      Serial.println("❌ Error: " + String(httpResponseCode));
    }
    
    http.end();
  }
}

void loop() {
  // Read sensor (example)
  float temp = 25.5; // Read from SHT20
  float hum = 60.2;  // Read from SHT20
  
  sendSensorData(temp, hum);
  delay(60000); // Send every minute
}
```

### 2. Python Script (untuk testing)

```python
import requests
import json
import time
import random

url = "https://your-app.vercel.app/api/sensor/data"

def send_sensor_data():
    # Simulate sensor readings
    data = {
        "temperature": round(random.uniform(20, 30), 1),
        "humidity": round(random.uniform(40, 80), 1),
        "deviceId": "PYTHON-SIMULATOR",
        "location": "Test Lab"
    }
    
    try:
        response = requests.post(url, json=data)
        if response.status_code == 200:
            print(f"✅ Data sent: {data}")
        else:
            print(f"❌ Error: {response.status_code}")
    except Exception as e:
        print(f"❌ Exception: {e}")

# Send data every 30 seconds
while True:
    send_sensor_data()
    time.sleep(30)
```

### 3. MQTT Bridge Script

```javascript
const mqtt = require('mqtt');
const axios = require('axios');

const client = mqtt.connect('mqtts://your-mqtt-broker.com', {
  username: 'your-username',
  password: 'your-password'
});

const API_URL = 'https://your-app.vercel.app/api/sensor/data';

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe('sht20/data');
});

client.on('message', async (topic, message) => {
  try {
    const data = JSON.parse(message.toString());
    
    // Transform MQTT message to API format
    const apiData = {
      temperature: data.temp,
      humidity: data.hum,
      deviceId: data.deviceId || 'MQTT-BRIDGE',
      location: data.location || 'MQTT Source'
    };
    
    // Send to API
    const response = await axios.post(API_URL, apiData);
    console.log('✅ Data forwarded to API:', response.data);
    
  } catch (error) {
    console.error('❌ Error forwarding data:', error.message);
  }
});
```

## 🧪 Testing

### Manual Testing dengan cURL

```bash
# Test single data
curl -X POST https://your-app.vercel.app/api/sensor/data \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 25.5,
    "humidity": 60.2,
    "deviceId": "TEST-001",
    "location": "Test Room"
  }'

# Test batch data
curl -X POST https://your-app.vercel.app/api/sensor/batch \
  -H "Content-Type: application/json" \
  -d '{
    "readings": [
      {"temperature": 24.8, "humidity": 58.5},
      {"temperature": 25.2, "humidity": 61.0}
    ]
  }'
```

### Node.js Test Script

```bash
# Install axios
npm install axios

# Run test
node test-mqtt-endpoints.js
```

## 📊 Data Validation

### Required Fields
- `temperature` (number): -50 to 100°C
- `humidity` (number): 0 to 100%

### Optional Fields
- `deviceId` (string): Default "SHT20-001"
- `location` (string): Default "Default Room"
- `timestamp` (ISO string): Default current time

### Error Responses

```json
{
  "error": "Temperature and humidity are required",
  "received": {...}
}
```

```json
{
  "error": "Temperature out of valid range (-50 to 100°C)"
}
```

## 🔄 Real-time Updates

Data yang dikirim akan:
1. ✅ Disimpan ke database PostgreSQL
2. ✅ Langsung tersedia di dashboard
3. ✅ Dapat diakses via API `/api/latest`
4. ✅ Masuk dalam historical data

## 🚨 Rate Limiting

- **Single requests**: No limit
- **Batch requests**: Max 100 readings per request
- **Recommended frequency**: 1 reading per minute

## 🔐 Security Notes

- Endpoints tidak require authentication (sesuai kebutuhan IoT)
- Validate data di client-side sebelum kirim
- Monitor untuk data anomali
- Consider adding API key untuk production

## 📈 Monitoring

Cek data masuk via:
- Dashboard: `https://your-app.vercel.app/`
- Latest API: `https://your-app.vercel.app/api/latest`
- Health check: `https://your-app.vercel.app/api/health`
