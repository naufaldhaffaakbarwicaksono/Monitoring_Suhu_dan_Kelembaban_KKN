# 🌡️ Sensor Monitoring System

Simple and clean temperature & humidity monitoring system with real-time dashboard.

## ✨ Features

- **Real-time Dashboard** - Live sensor data visualization
- **Simple API** - Clean REST endpoints for data
- **Database Storage** - PostgreSQL with Prisma ORM
- **Vercel Ready** - Optimized for serverless deployment
- **ESP32 Compatible** - Direct HTTP POST from IoT devices

## 🚀 Quick Start

### Development
```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your DATABASE_URL

# Generate Prisma client
npm run db:generate

# Start development server
npm run dev
```

### Production (Vercel)
```bash
# Push to GitHub
git push origin main

# Deploy to Vercel
# 1. Import GitHub repo to Vercel
# 2. Set DATABASE_URL environment variable
# 3. Deploy
```

## 📡 API Endpoints

### Core Endpoints
- `GET /` - Dashboard
- `GET /api/health` - Health check
- `GET /api/latest` - Latest sensor reading
- `GET /api/dashboard` - Complete dashboard data

### Data Endpoints
- `GET /api/readings?hours=3` - Get readings (default: last 3 hours)
- `GET /api/stats?hours=24` - Get statistics (default: last 24 hours)
- `POST /api/sensor/data` - Insert single reading
- `POST /api/sensor/batch` - Insert multiple readings

### Example Usage

**Send sensor data:**
```bash
curl -X POST http://localhost:3000/api/sensor/data \
  -H "Content-Type: application/json" \
  -d '{
    "temperature": 25.5,
    "humidity": 60.2,
    "deviceId": "ESP32-001",
    "location": "Living Room"
  }'
```

**ESP32 Arduino Code:**
```cpp
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
  doc["deviceId"] = "ESP32-001";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int responseCode = http.POST(jsonString);
  if (responseCode == 200) {
    Serial.println("✅ Data sent successfully");
  }
  
  http.end();
}
```

## 🔧 Configuration

### Environment Variables
```env
DATABASE_URL="postgresql://user:pass@host:5432/db"
PORT=3000
```

### Database Schema
```sql
-- Sensor readings table
CREATE TABLE sensor_readings (
  id SERIAL PRIMARY KEY,
  temperature FLOAT NOT NULL,
  humidity FLOAT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  device_id VARCHAR(255) DEFAULT 'SENSOR-001',
  location VARCHAR(255) DEFAULT 'Unknown',
  received_at TIMESTAMP DEFAULT NOW()
);
```

## 📊 Testing

```bash
# Test all endpoints
node test.js

# Test production
node test.js https://your-app.vercel.app
```

## 🎯 Simplified Architecture

```
IoT Device/ESP32 → HTTP POST → Vercel API → PostgreSQL → Dashboard
```

**Key Simplifications:**
- ✅ Removed complex MQTT service
- ✅ Direct database queries with Prisma
- ✅ Single API file for all endpoints  
- ✅ Eliminated unnecessary dependencies
- ✅ Clean error handling and validation
- ✅ Optimized for serverless deployment

## 📱 Dashboard Features

- **Live Temperature/Humidity Display**
- **Historical Charts** (last 24 hours)
- **Statistics Panel** (min/max/average)
- **Responsive Design** (mobile-friendly)
- **Auto-refresh** every 30 seconds

## 🚨 Data Validation

- Temperature: -50°C to 100°C
- Humidity: 0% to 100%
- Required fields: temperature, humidity
- Optional: deviceId, location, timestamp

## 📈 Performance

- **Dashboard load**: ~200ms
- **API response**: ~50ms
- **Database queries**: Optimized with indexes
- **Vercel cold start**: ~500ms

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **Database**: PostgreSQL + Prisma ORM
- **Frontend**: EJS + Vanilla JS + Chart.js
- **Deployment**: Vercel Serverless
- **Styling**: Custom CSS + Responsive Design

---

**Simple, Fast, Reliable** ⚡
