# MQTT Alternatives for Vercel Deployment

This document explains the MQTT-to-HTTP migration for your sensor monitoring project on Vercel.

## Why the Change?

Vercel's serverless functions don't support persistent connections, which means MQTT clients can't maintain long-term connections. This is a platform limitation, not a code issue.

## Solutions Implemented

### 1. HTTP Polling (Current Implementation)

**Client-side (`public/js/app.js`):**
- Polls `/api/latest` every 5 seconds for new data
- Updates charts and displays in real-time
- Reduces polling frequency when page is hidden (30s)
- Automatic cleanup on page unload

**How it works:**
```javascript
// Polls every 5 seconds
setInterval(() => {
  fetch('/api/latest')
    .then(response => response.json())
    .then(data => updateDisplay(data));
}, 5000);
```

### 2. Direct HTTP POST (For ESP32/IoT Devices)

**Endpoint:** `POST /api/sensor/data`

**ESP32 Code Example:**
```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

void sendSensorData(float temp, float hum) {
  HTTPClient http;
  http.begin("https://your-vercel-app.vercel.app/api/sensor/data");
  http.addHeader("Content-Type", "application/json");
  
  DynamicJsonDocument doc(1024);
  doc["temperature"] = temp;
  doc["humidity"] = hum;
  doc["device_id"] = "esp32_001";
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  http.end();
}
```

### 3. MQTT Webhook (For External MQTT Brokers)

**Endpoint:** `POST /api/mqtt/webhook`

Configure your MQTT broker (like AWS IoT, CloudMQTT, or HiveMQ) to send HTTP webhooks to this endpoint when messages arrive.

## Available Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/sensor/data` | POST | Direct sensor data from IoT devices |
| `/api/sensor/test` | POST | Generate test data |
| `/api/latest` | GET | Get latest sensor reading |
| `/api/readings` | GET | Get multiple readings (with limit) |
| `/api/stats` | GET | Get statistics |
| `/api/health` | GET | Health check and API status |
| `/api/esp32/guide` | GET | ESP32 integration guide |

## Your Original MQTT React Code - Analysis

### Option 1 (useRef) - Had Issues:
```javascript
// ❌ WRONG - This would never create a client
if (clientRef.current) {
  clientRef.current = mqtt.connect(mqttUri, options);
}

// ✅ CORRECT - Should be:
if (!clientRef.current) {
  clientRef.current = mqtt.connect(mqttUri, options);
}
```

### Option 2 (Simple) - Good Pattern:
```javascript
// ✅ This was correct
useEffect(() => {
  const client = mqtt.connect(mqttUri, options);
  // ... setup
  return () => client.end();
}, []); // Empty deps - runs once
```

## Files Created/Modified

1. **`public/js/mqtt-alternative.js`** - React hooks for HTTP polling
2. **`public/js/mqtt-patterns.js`** - Corrected MQTT patterns (for reference)
3. **`public/js/app.js`** - Updated to use HTTP polling instead of MQTT
4. **`api/index.js`** - Already had HTTP endpoints (no changes needed)

## Migration Benefits

✅ **Works on Vercel** - No serverless limitations  
✅ **Simpler deployment** - No external MQTT broker needed  
✅ **Better error handling** - HTTP status codes and responses  
✅ **Easier testing** - Use curl, Postman, or browser  
✅ **Lower latency** - Direct HTTP calls vs MQTT routing  

## Performance Considerations

- **Polling frequency:** 5 seconds (adjustable)
- **Reduced when hidden:** 30 seconds (saves resources)
- **Chart throttling:** Updates limited to every 2 seconds
- **Data limits:** Charts keep last 100 points

## Testing

Test the new implementation:

```bash
# Test sensor data endpoint
curl -X POST https://your-app.vercel.app/api/sensor/data \
  -H "Content-Type: application/json" \
  -d '{"temperature": 25.5, "humidity": 60.2}'

# Test latest data
curl https://your-app.vercel.app/api/latest

# Generate test data
curl -X POST https://your-app.vercel.app/api/sensor/test
```

## For Future MQTT Needs

If you need true MQTT support later, consider these platforms:
- **Railway** - Supports persistent connections
- **Heroku** - Full server environment
- **Digital Ocean Apps** - Container-based deployment
- **AWS EC2/Lambda + IoT Core** - For enterprise solutions

The HTTP polling approach will work for most real-time monitoring needs with update frequencies of 1-10 seconds.
