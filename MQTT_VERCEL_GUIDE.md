# MQTT di Vercel - Panduan Implementasi

## ⚠️ Masalah MQTT di Serverless

Vercel adalah platform serverless yang memiliki keterbatasan:
- **Tidak ada persistent connections**: Fungsi serverless berjalan sekali lalu mati
- **Timeout limit**: Maksimal 30 detik per request
- **Stateless**: Tidak bisa menyimpan state antar request

## ✅ Solusi untuk MQTT di Vercel

### 1. MQTT Webhook (RECOMMENDED)
Konfigurasi MQTT broker untuk mengirim HTTP POST ke API endpoint:

**Endpoint:** `POST /api/mqtt/webhook`

```json
{
  "temperature": 25.5,
  "humidity": 60.2,
  "topic": "sensor/data",
  "timestamp": "2025-07-14T12:00:00Z"
}
```

**Konfigurasi MQTT Broker:**
- HiveMQ: Gunakan fitur "Webhooks" atau "HTTP Action"
- AWS IoT: Gunakan IoT Rules dengan HTTP Action
- Mosquitto: Gunakan bridge ke HTTP endpoint

### 2. Direct HTTP POST dari ESP32
Ubah ESP32 untuk mengirim data langsung via HTTP:

```cpp
// ESP32 Code
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

void sendSensorData(float temp, float hum) {
  HTTPClient http;
  http.begin("https://your-app.vercel.app/api/sensor/data");
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(1024);
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("Response: " + response);
  }
  
  http.end();
}
```

### 3. MQTT-to-HTTP Bridge Service
Gunakan service external yang menjembatani MQTT ke HTTP:
- **Node-RED**: Deploy di VPS/Heroku
- **AWS IoT Rules**: Forward MQTT ke HTTP endpoint
- **IFTTT/Zapier**: Bridge MQTT ke webhook

## 🚀 Testing API Endpoints

### Test Webhook MQTT:
```bash
curl -X POST https://your-app.vercel.app/api/mqtt/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 25.5,
    "humidity": 60.2,
    "topic": "sensor/data",
    "timestamp": "2025-07-14T12:00:00Z"
  }'
```

### Test Direct Sensor Data:
```bash
curl -X POST https://your-app.vercel.app/api/sensor/data \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 25.5,
    "humidity": 60.2
  }'
```

### Get Latest Data:
```bash
curl https://your-app.vercel.app/api/latest
```

## 🔧 Deployment ke Vercel

1. **Install dependencies:**
```bash
npm install
```

2. **Push ke GitHub:**
```bash
git add .
git commit -m "MQTT webhook implementation for Vercel"
git push origin main
```

3. **Deploy otomatis** di Vercel setelah push

## 🌐 Alternative Platforms untuk MQTT Persistent

Jika butuh MQTT persistent connection:
- **Railway**: Support long-running processes
- **Heroku**: Support persistent connections
- **DigitalOcean App Platform**: Support background workers
- **VPS**: Full control over MQTT connections

## 📋 Environment Variables di Vercel

Set di Vercel Dashboard → Settings → Environment Variables:
```
DATABASE_URL=postgresql://...
MQTT_HOST=your-broker.com
MQTT_PORT=8883
MQTT_USERNAME=username
MQTT_PASSWORD=password
```

## ✅ Best Practices

1. **Use HTTP endpoints** instead of persistent MQTT
2. **Validate input data** in webhook endpoints
3. **Add authentication** for production webhooks
4. **Handle errors gracefully**
5. **Log all incoming data** for debugging

## 🔍 Monitoring

Check deployment status:
- Vercel Dashboard → Functions tab
- Check logs for incoming requests
- Monitor `/api/health` endpoint
