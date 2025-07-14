# 🌡️ Sensor Monitoring System - Vercel Ready

## 📋 Overview
Sistem monitoring suhu dan kelembaban yang dioptimalkan untuk deployment di Vercel serverless platform.

## ⚠️ MQTT Important Notice
**MQTT persistent connections TIDAK DIDUKUNG di Vercel** karena serverless functions bersifat stateless dan memiliki timeout limit.

## ✅ Solusi yang Diimplementasikan

### 1. HTTP POST Endpoints (Primary)
- `POST /api/sensor/data` - Terima data dari ESP32/IoT devices
- `POST /api/sensor/test` - Generate random test data
- `POST /api/mqtt/webhook` - Webhook untuk MQTT bridge external

### 2. API Endpoints
- `GET /` - Dashboard web interface
- `GET /api/health` - Health check
- `GET /api/latest` - Data sensor terbaru
- `GET /api/readings` - List semua readings
- `GET /api/stats` - Statistik sistem
- `GET /api/esp32/guide` - Panduan integrasi ESP32

## 🚀 Deployment

### Prerequisites
1. **Database**: PostgreSQL di Supabase
2. **Deployment**: Vercel account terhubung ke GitHub
3. **Environment Variables**: Set di Vercel dashboard

### Environment Variables
```env
DATABASE_URL=postgresql://postgres.xxx:xxx@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres
MQTT_HOST=your-broker.hivemq.cloud
MQTT_PORT=8883
MQTT_USERNAME=your-username
MQTT_PASSWORD=your-password
NODE_ENV=production
```

### Auto Deployment
```bash
git add .
git commit -m "Deploy sensor monitoring system"
git push origin main
```

## 📡 ESP32 Integration

### HTTP POST Method (Recommended)
```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

const char* serverURL = "https://your-app.vercel.app/api/sensor/data";

void sendSensorData(float temp, float hum) {
  HTTPClient http;
  http.begin(serverURL);
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(1024);
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["device_id"] = "esp32_001";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("✅ Data sent: " + response);
  } else {
    Serial.println("❌ Error: " + String(httpResponseCode));
  }
  
  http.end();
}
```

## 🧪 Testing

### Manual Testing
```bash
# Health check
curl https://your-app.vercel.app/api/health

# Send test data
curl -X POST https://your-app.vercel.app/api/sensor/test

# Send manual data
curl -X POST https://your-app.vercel.app/api/sensor/data \
  -H "Content-Type: application/json" \
  -d '{"temperature": 25.5, "humidity": 60.2}'

# Get latest data
curl https://your-app.vercel.app/api/latest

# Get statistics
curl https://your-app.vercel.app/api/stats
```

## 📊 Features

### ✅ Implemented
- [x] HTTP POST sensor data ingestion
- [x] Real-time web dashboard
- [x] Data validation and error handling
- [x] PostgreSQL database integration
- [x] Responsive UI with charts
- [x] Comprehensive error handling
- [x] ESP32 integration guide
- [x] Automatic Vercel deployment

### ❌ Not Supported (Serverless Limitations)
- [ ] MQTT persistent connections
- [ ] WebSocket real-time updates
- [ ] Background processing
- [ ] Long-running connections

## 🔧 Architecture

```
ESP32 Sensor → HTTP POST → Vercel Function → PostgreSQL Database
                    ↓
               Web Dashboard (EJS)
```

## 🛠️ Development

### Local Setup
```bash
# Clone repository
git clone https://github.com/naufaldhaffaakbarwicaksono/Monitoring_Suhu_dan_Kelembaban_KKN.git
cd Monitoring_Suhu_dan_Kelembaban_KKN

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npx prisma generate

# Run development server
npm run dev
```

### Available Scripts
- `npm start` - Production server
- `npm run dev` - Development with nodemon
- `npm run build` - Build for production
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

## 📝 License
MIT License - Feel free to use and modify

## 👨‍💻 Author
Naufal Dhaffa - KKN Project 2025
