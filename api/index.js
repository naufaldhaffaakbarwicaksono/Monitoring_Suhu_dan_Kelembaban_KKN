/**
 * Vercel-Compatible Sensor Monitoring (In-Memory Storage)
 * 
 * MQTT PERSISTENT CONNECTIONS TIDAK BISA DI VERCEL!
 * DATABASE DIHAPUS - MENGGUNAKAN IN-MEMORY STORAGE!
 * 
 * Solusi yang tersedia:
 * 1. HTTP POST langsung dari ESP32 (RECOMMENDED)
 * 2. In-memory storage untuk data sensor
 * 3. Data akan hilang saat restart (serverless nature)
 */

const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();

// In-memory storage untuk data sensor (menggantikan database)
let sensorReadings = [];
let readingIdCounter = 1;

// Fungsi untuk menyimpan data sensor ke memori
function saveSensorDataToMemory(data) {
  const reading = {
    id: readingIdCounter++,
    temperature: data.temperature,
    humidity: data.humidity,
    timestamp: new Date().toISOString(),
    source: 'http_post'
  };
  
  sensorReadings.push(reading);
  
  // Batasi hanya 1000 readings terakhir untuk menghemat memori
  if (sensorReadings.length > 1000) {
    sensorReadings = sensorReadings.slice(-1000);
  }
  
  return reading;
}

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Utility function untuk format response
function formatSuccessResponse(data, message = 'Success', meta = {}) {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
    ...meta
  };
}

function formatErrorResponse(error, message = 'Error occurred', statusCode = 500) {
  return {
    success: false,
    error: message,
    details: error instanceof Error ? error.message : error,
    timestamp: new Date().toISOString(),
    statusCode
  };
}

// Save sensor data to memory with validation
async function saveSensorData(data) {
  try {
    // Validate input data
    const temperature = parseFloat(data.temperature);
    const humidity = parseFloat(data.humidity);
    
    if (isNaN(temperature) || isNaN(humidity)) {
      throw new Error('Invalid temperature or humidity values');
    }
    
    if (temperature < -50 || temperature > 100) {
      throw new Error('Temperature out of valid range (-50°C to 100°C)');
    }
    
    if (humidity < 0 || humidity > 100) {
      throw new Error('Humidity out of valid range (0% to 100%)');
    }
    
    const sensorReading = saveSensorDataToMemory({
      temperature: temperature,
      humidity: humidity
    });
    
    console.log('💾 Saved to memory:', sensorReading.id, `T:${temperature}°C H:${humidity}%`);
    return sensorReading;
  } catch (error) {
    console.error('❌ Memory save error:', error);
    throw error;
  }
}

// Route utama - Dashboard
app.get('/', async (req, res) => {
  try {
    // Get latest sensor readings from memory
    const latestReadings = sensorReadings
      .slice(-50)  // Last 50 readings
      .reverse();  // Most recent first

    // Get statistics
    const totalReadings = sensorReadings.length;
    const lastReading = sensorReadings[sensorReadings.length - 1] || null;
    
    const stats = {
      totalReadings,
      lastReading,
      deployment: 'Vercel Serverless (In-Memory)',
      note: 'Data stored in memory - will reset on deployment/restart'
    };

    res.render('index', {
      readings: latestReadings,
      stats
    });
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.render('index', {
      readings: [],
      stats: { totalReadings: 0, lastReading: null }
    });
  }
});

// SOLUTION 1: MQTT Webhook Endpoint
// Configure your MQTT broker to send HTTP POST to this endpoint
app.post('/api/mqtt/webhook', async (req, res) => {
  try {
    console.log('📡 MQTT webhook received:', req.body);
    
    const { temperature, humidity, topic, timestamp } = req.body;
    
    // Validate MQTT data
    if (topic === 'sensor/data' && typeof temperature === 'number' && typeof humidity === 'number') {
      const result = await saveSensorData({ temperature, humidity });
      
      res.json(formatSuccessResponse(null, 'Sensor data saved', { id: result.id }));
    } else {
      res.status(400).json(formatErrorResponse('Invalid sensor data format'));
    }
  } catch (error) {
    console.error('❌ MQTT webhook error:', error);
    res.status(500).json(formatErrorResponse(error));
  }
});

// SOLUTION 2: Direct HTTP POST for ESP32/IoT devices
app.post('/api/sensor/data', async (req, res) => {
  try {
    console.log('📊 Direct sensor data received:', req.body);
    
    const { temperature, humidity } = req.body;
    
    // Validate data
    if (typeof temperature === 'number' && typeof humidity === 'number') {
      const result = await saveSensorData({ temperature, humidity });
      
      res.json(formatSuccessResponse(result, 'Data saved successfully'));
    } else {
      res.status(400).json(formatErrorResponse('Invalid data format. Required: {temperature: number, humidity: number}'));
    }
  } catch (error) {
    console.error('❌ Sensor data error:', error);
    res.status(500).json(formatErrorResponse(error));
  }
});

// API endpoint untuk mendapatkan data terbaru
app.get('/api/latest', async (req, res) => {
  try {
    const latest = sensorReadings[sensorReadings.length - 1] || null;
    
    res.json(formatSuccessResponse(latest));
  } catch (error) {
    console.error('❌ API latest error:', error);
    res.status(500).json(formatErrorResponse(error));
  }
});

// API endpoint untuk mendapatkan readings
app.get('/api/readings', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const limitNum = parseInt(limit);
    
    const readings = sensorReadings
      .slice(-limitNum)  // Last N readings
      .reverse();        // Most recent first
    
    res.json(formatSuccessResponse(readings, 'Readings fetched', { count: readings.length }));
  } catch (error) {
    console.error('❌ API readings error:', error);
    res.status(500).json(formatErrorResponse(error));
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Sensor Monitor (Vercel - In-Memory)',
    timestamp: new Date().toISOString(),
    storage: 'In-Memory (no database)',
    current_readings: sensorReadings.length,
    memory_limit: '1000 readings max',
    mqtt_support: false,
    mqtt_note: 'Use HTTP POST endpoints instead',
    endpoints: {
      sensor_data: '/api/sensor/data (POST)',
      test_data: '/api/sensor/test (POST)', 
      latest: '/api/latest (GET)',
      readings: '/api/readings (GET)',
      stats: '/api/stats (GET)',
      esp32_guide: '/api/esp32/guide (GET)'
    }
  });
});

// MQTT Configuration Info endpoint (Legacy - for reference only)
app.get('/api/mqtt/config', (req, res) => {
  res.json({
    warning: 'MQTT persistent connections are NOT supported in Vercel',
    broker: process.env.MQTT_HOST,
    port: process.env.MQTT_PORT,
    topic: 'sensor/data',
    alternative_solution: 'Use HTTP POST instead',
    webhook_url: `${req.protocol}://${req.get('host')}/api/mqtt/webhook`,
    direct_post_url: `${req.protocol}://${req.get('host')}/api/sensor/data`,
    esp32_guide: `${req.protocol}://${req.get('host')}/api/esp32/guide`,
    note: 'Consider deploying to Railway, Heroku, or VPS for MQTT support'
  });
});

// Test endpoint untuk simulasi data sensor
app.post('/api/sensor/test', async (req, res) => {
  try {
    // Generate random sensor data
    const testData = {
      temperature: Math.round((Math.random() * 15 + 20) * 100) / 100, // 20-35°C
      humidity: Math.round((Math.random() * 40 + 40) * 100) / 100,    // 40-80%
    };
    
    const result = await saveSensorData(testData);
    
    res.json(formatSuccessResponse(testData, 'Test data generated and saved'));
  } catch (error) {
    console.error('❌ Test data error:', error);
    res.status(500).json(formatErrorResponse(error));
  }
});

// API endpoint untuk statistik
app.get('/api/stats', async (req, res) => {
  try {
    const totalReadings = sensorReadings.length;
    const latest = sensorReadings[sensorReadings.length - 1] || null;
    
    // Get readings from last 24 hours
    const since24h = new Date();
    since24h.setHours(since24h.getHours() - 24);
    
    const readings24h = sensorReadings.filter(reading => 
      new Date(reading.timestamp) >= since24h
    ).length;
    
    res.json(formatSuccessResponse({
      total_readings: totalReadings,
      readings_24h: readings24h,
      latest_reading: latest,
      storage_type: 'in-memory',
      note: 'Data resets on deployment/restart'
    }, 'Statistics fetched'));
  } catch (error) {
    console.error('❌ API stats error:', error);
    res.status(500).json(formatErrorResponse(error));
  }
});

// ESP32 Integration guide endpoint
app.get('/api/esp32/guide', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  
  res.json({
    title: 'ESP32 Integration Guide for Vercel',
    mqtt_issue: 'MQTT persistent connections are not supported in Vercel serverless functions',
    solution: 'Use HTTP POST instead of MQTT',
    endpoint: `${baseUrl}/api/sensor/data`,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    payload: {
      temperature: 25.5,
      humidity: 60.2,
      device_id: 'esp32_001'
    },
    esp32_code_example: `
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

void sendSensorData(float temp, float hum) {
  HTTPClient http;
  http.begin("${baseUrl}/api/sensor/data");
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
    Serial.println("Response: " + response);
  }
  
  http.end();
}
    `
  });
});

// Export for Vercel
module.exports = app;
