# MQTT Serverless Implementation dengan Vercel dan Supabase

## Overview

Implementasi ini menggunakan teknik **retain message** untuk meminimalisir penggunaan listener MQTT pada environment serverless. Sistem menyimpan seluruh log pesan MQTT saat web serverless tidak aktif, kemudian memulihkan retain messages saat web aktif kembali.

## Fitur Utama

### 1. MQTT Retain Message Handling
- **Automatic Message Logging**: Semua pesan MQTT disimpan ke database
- **Retain Message Storage**: Pesan dengan flag retain disimpan secara terpisah
- **Message Recovery**: Otomatis memulihkan retain messages saat serverless function aktif
- **Data Persistence**: Data tersimpan tanpa batas waktu di Supabase

### 2. Serverless Optimization
- **Cold Start Handling**: MQTT service diinisialisasi saat function pertama kali dipanggil
- **Connection Pooling**: Menggunakan persistent connection untuk MQTT
- **Batch Processing**: Memproses unprocessed messages secara batch
- **Optimized API Endpoints**: Kombinasi data dari retain messages dan database

## Arsitektur Sistem

```
ESP32/IoT Device -> MQTT Broker -> Vercel Serverless Function -> Supabase Database
                                  ↓
                              Retain Messages Cache
                                  ↓
                              Web Dashboard
```

## Database Schema

### 1. MqttMessageLog
Menyimpan seluruh log pesan MQTT:
```sql
CREATE TABLE "mqtt_message_logs" (
    "id" SERIAL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "qos" INTEGER DEFAULT 0,
    "retain" BOOLEAN DEFAULT false,
    "timestamp" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN DEFAULT false,
    "deviceId" TEXT,
    "messageType" TEXT
);
```

### 2. RetainMessage
Menyimpan retain messages untuk quick access:
```sql
CREATE TABLE "retain_messages" (
    "id" SERIAL PRIMARY KEY,
    "topic" TEXT UNIQUE NOT NULL,
    "message" TEXT NOT NULL,
    "qos" INTEGER DEFAULT 0,
    "timestamp" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deviceId" TEXT
);
```

## API Endpoints

### Dashboard API
- `GET /api/dashboard` - Kombinasi data current + history + MQTT status
- `GET /api/latest` - Data sensor terkini (prioritas: retain message → database)

### MQTT Management API
- `GET /api/mqtt/status` - Status koneksi MQTT dan jumlah retain messages
- `GET /api/mqtt/retain` - List semua retain messages
- `GET /api/mqtt/logs` - Log semua pesan MQTT dengan filtering
- `POST /api/mqtt/recover` - Force recovery retain messages
- `POST /api/mqtt/publish` - Publish retain message

### Historical Data API
- `GET /api/readings` - Data sensor dengan filtering periode
- `GET /api/readings/grouped` - Data sensor yang dikelompokkan
- `GET /api/stats` - Statistik data sensor

## Cara Kerja Retain Message System

### 1. Saat ESP32 Mengirim Data
```javascript
// Format pesan dari ESP32
{
  "temp": 23.54,
  "hum": 71.93,
  "timestamp": "2025-07-14T10:30:00",
  "deviceId": "SHT20-001"
}
```

### 2. MQTT Service Processing
```javascript
// Setiap pesan MQTT akan:
// 1. Disimpan ke mqtt_message_logs
// 2. Jika retain=true, disimpan/update di retain_messages
// 3. Diproses sebagai sensor data jika topik sesuai
// 4. Disimpan ke sensor_readings untuk historical data
```

### 3. Data Recovery
```javascript
// Saat serverless function cold start:
// 1. Load retain messages dari database
// 2. Process unprocessed message logs
// 3. Update cache dengan data terkini
```

## Configuration

### Environment Variables
```bash
# MQTT Configuration
MQTT_HOST=your-mqtt-broker-host
MQTT_PORT=1883
MQTT_USERNAME=your-mqtt-username
MQTT_PASSWORD=your-mqtt-password

# Database
DATABASE_URL=postgresql://user:pass@host:port/db

# Server
NODE_ENV=production
```

### MQTT Topics Structure
```
sht20/data          # Sensor data utama
sht20/status        # Status device
sensor/+/data       # Multiple sensor support
sensor/+/status     # Multiple sensor status
```

## Frontend Features

### 1. Real-time Dashboard
- Menampilkan data terkini dari retain messages
- Fallback ke database jika retain message tidak tersedia
- Indicator sumber data (Retain Message / Database / Default)

### 2. MQTT Status Monitoring
- Status koneksi MQTT broker
- Jumlah retain messages tersimpan
- Manual data recovery button

### 3. Retain Messages Viewer
- List semua retain messages dengan timestamp
- Parse JSON messages untuk display yang user-friendly
- Device ID tracking

## Usage Examples

### 1. ESP32 Code Example
```cpp
// Publish dengan retain flag
String payload = "{\"temp\":" + String(temperature) + 
                ",\"hum\":" + String(humidity) + 
                ",\"timestamp\":\"" + getISO8601Time() + "\"" +
                ",\"deviceId\":\"SHT20-001\"}";

client.publish("sht20/data", payload.c_str(), true); // retain = true
```

### 2. Manual Data Recovery
```javascript
// Trigger manual recovery via API
fetch('/api/mqtt/recover', { method: 'POST' })
  .then(response => response.json())
  .then(result => console.log('Recovery:', result));
```

### 3. Get Latest Data
```javascript
// Prioritas: Retain Message > Database > Default
fetch('/api/latest')
  .then(response => response.json())
  .then(data => {
    console.log('Source:', data.source); // 'retain_message' atau 'database'
    console.log('Temperature:', data.temperature);
    console.log('Humidity:', data.humidity);
  });
```

## Benefits

### 1. Serverless Optimization
- **Minimized Cold Start Impact**: Data tersedia dari retain messages
- **Reduced Database Calls**: Cache retain messages di memory
- **Better Performance**: Kombinasi real-time dan historical data

### 2. Data Reliability
- **No Data Loss**: Semua pesan tersimpan ke database
- **Historical Access**: Akses unlimited ke data lampau
- **Recovery Capability**: Otomatis recovery saat system restart

### 3. Scalability
- **Multi-device Support**: Support multiple sensor devices
- **Topic Flexibility**: Wildcard topic subscriptions
- **Database Optimization**: Index untuk query performance

## Monitoring dan Troubleshooting

### 1. MQTT Status Check
```bash
curl https://your-vercel-app.vercel.app/api/mqtt/status
```

### 2. View Message Logs
```bash
curl "https://your-vercel-app.vercel.app/api/mqtt/logs?limit=10&topic=sht20"
```

### 3. Check Retain Messages
```bash
curl https://your-vercel-app.vercel.app/api/mqtt/retain
```

## Deployment

### 1. Database Migration
```bash
npx prisma migrate deploy
```

### 2. Vercel Deployment
```bash
vercel --prod
```

### 3. Environment Setup
- Configure environment variables di Vercel dashboard
- Ensure MQTT broker is accessible from Vercel
- Test database connectivity

## Future Enhancements

1. **WebSocket Integration**: Real-time updates untuk dashboard
2. **Alert System**: Notifications untuk abnormal sensor values
3. **Data Analytics**: Advanced analytics dan reporting
4. **Multi-tenant Support**: Support multiple locations/projects
5. **Mobile App**: Native mobile application
6. **Offline Support**: PWA dengan offline capability

## Security Considerations

1. **MQTT Authentication**: Gunakan username/password untuk MQTT
2. **Database Security**: Secure connection strings
3. **API Rate Limiting**: Implement rate limiting untuk API endpoints
4. **Input Validation**: Validate semua input data
5. **Environment Variables**: Jangan commit secrets ke repository
