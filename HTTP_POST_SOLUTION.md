# 🚨 MQTT TIDAK BISA DI VERCEL - Solusi HTTP POST

## ❌ Mengapa MQTT Tidak Bisa di Vercel?

Vercel adalah platform **serverless** yang memiliki keterbatasan:
- **Tidak ada persistent connections**: Setiap request adalah instance baru
- **Timeout 30 detik**: Function mati setelah 30 detik
- **Stateless**: Tidak bisa menyimpan koneksi antar request
- **Cold start**: Function bisa tidur dan bangun lagi

## ✅ SOLUSI: Gunakan HTTP POST

### 1. Update ESP32 Code (RECOMMENDED)

Ganti MQTT dengan HTTP POST:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Server URL (ganti dengan URL Vercel kamu)
const char* serverURL = "https://your-app.vercel.app/api/sensor/data";

// DHT sensor
#define DHT_PIN 2
#define DHT_TYPE DHT22
DHT dht(DHT_PIN, DHT_TYPE);

void setup() {
  Serial.begin(115200);
  dht.begin();
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(1000);
    Serial.println("Connecting to WiFi...");
  }
  Serial.println("WiFi connected!");
}

void loop() {
  // Read sensor data
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  if (!isnan(temperature) && !isnan(humidity)) {
    sendSensorData(temperature, humidity);
  }
  
  delay(30000); // Send every 30 seconds
}

void sendSensorData(float temp, float hum) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload
    DynamicJsonDocument doc(1024);
    doc["temperature"] = temp;
    doc["humidity"] = hum;
    doc["device_id"] = "esp32_001";
    doc["timestamp"] = millis();
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    Serial.println("Sending: " + jsonString);
    
    int httpResponseCode = http.POST(jsonString);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Response Code: " + String(httpResponseCode));
      Serial.println("Response: " + response);
    } else {
      Serial.println("Error: " + String(httpResponseCode));
    }
    
    http.end();
  } else {
    Serial.println("WiFi not connected");
  }
}
```

### 2. Test Manual dengan curl

```bash
# Test endpoint
curl -X POST https://your-app.vercel.app/api/sensor/data \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 25.5,
    "humidity": 60.2,
    "device_id": "test_device"
  }'

# Generate test data
curl -X POST https://your-app.vercel.app/api/sensor/test

# Check latest data
curl https://your-app.vercel.app/api/latest

# Check statistics
curl https://your-app.vercel.app/api/stats
```

### 3. Alternative: MQTT Bridge Service

Jika tetap ingin menggunakan MQTT, deploy bridge service di platform lain:

**Option A: Node-RED di Railway/Heroku**
- Deploy Node-RED instance
- Subscribe ke MQTT
- Forward ke Vercel HTTP endpoint

**Option B: Simple Bridge Script**
```javascript
// Deploy this on Railway/Heroku/VPS
const mqtt = require('mqtt');
const axios = require('axios');

const client = mqtt.connect('mqtts://your-broker.com:8883', {
  username: 'username',
  password: 'password'
});

client.on('connect', () => {
  client.subscribe('sensor/data');
});

client.on('message', async (topic, message) => {
  if (topic === 'sensor/data') {
    try {
      const data = JSON.parse(message.toString());
      
      await axios.post('https://your-app.vercel.app/api/sensor/data', data);
      console.log('Data forwarded to Vercel');
    } catch (error) {
      console.error('Error forwarding data:', error);
    }
  }
});
```

## 🚀 Deploy Update ke Vercel

1. **Commit changes:**
```bash
git add .
git commit -m "Fix: Remove MQTT persistent connection, add HTTP POST endpoints"
git push origin main
```

2. **Test setelah deploy:**
- Health check: `https://your-app.vercel.app/api/health`
- ESP32 guide: `https://your-app.vercel.app/api/esp32/guide`
- Test data: `POST https://your-app.vercel.app/api/sensor/test`

## 📊 Monitoring

**Endpoints yang tersedia:**
- `GET /` - Dashboard
- `POST /api/sensor/data` - Terima data sensor
- `POST /api/sensor/test` - Generate test data
- `GET /api/latest` - Data terbaru
- `GET /api/readings` - List readings
- `GET /api/stats` - Statistik
- `GET /api/health` - Health check
- `GET /api/esp32/guide` - ESP32 integration guide

## 🎯 Hasil yang Diharapkan

✅ **HTTP POST**: ESP32 kirim data langsung ke API
✅ **Real-time**: Data langsung masuk database
✅ **Scalable**: Serverless auto-scale
✅ **Reliable**: Tidak ada connection drops
✅ **Simple**: Lebih mudah debug

❌ **MQTT Persistent**: Tidak didukung Vercel
❌ **WebSocket**: Tidak reliable di serverless
❌ **Long connections**: Auto-timeout 30s
