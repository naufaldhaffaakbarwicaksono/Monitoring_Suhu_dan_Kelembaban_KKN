/**
 * MQTT Sensor Monitoring for Vercel Serverless
 * 
 * IMPORTANT: MQTT persistent connections don't work well in Vercel serverless functions
 * because functions are stateless and have execution time limits.
 * 
 * SOLUTIONS:
 * 1. Use MQTT webhooks (MQTT broker sends HTTP POST to your API)
 * 2. Use polling approach (periodically check MQTT messages)
 * 3. Use external MQTT-to-HTTP bridge service
 * 4. Deploy to a platform that supports persistent connections (Railway, Heroku, VPS)
 */

const express = require('express');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Save sensor data to database
async function saveSensorData(data) {
  try {
    const sensorReading = await prisma.sensorReading.create({
      data: {
        temperature: data.temperature,
        humidity: data.humidity,
        timestamp: new Date()
      }
    });
    
    console.log('💾 Saved to database:', sensorReading.id);
    return sensorReading;
  } catch (error) {
    console.error('❌ Database save error:', error);
    throw error;
  }
}

// Route utama - Dashboard
app.get('/', async (req, res) => {
  try {
    // Get latest sensor readings
    const latestReadings = await prisma.sensorReading.findMany({
      orderBy: { timestamp: 'desc' },
      take: 50
    });

    // Get statistics
    const totalReadings = await prisma.sensorReading.count();
    
    const stats = {
      totalReadings,
      lastReading: latestReadings[0] || null,
      mqttBroker: process.env.MQTT_HOST,
      mqttPort: process.env.MQTT_PORT
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
      
      res.json({
        success: true,
        message: 'Sensor data saved',
        id: result.id
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid sensor data format'
      });
    }
  } catch (error) {
    console.error('❌ MQTT webhook error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
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
      
      res.json({
        success: true,
        message: 'Data saved successfully',
        id: result.id,
        timestamp: result.timestamp
      });
    } else {
      res.status(400).json({
        success: false,
        error: 'Invalid data format. Required: {temperature: number, humidity: number}'
      });
    }
  } catch (error) {
    console.error('❌ Sensor data error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint untuk mendapatkan data terbaru
app.get('/api/latest', async (req, res) => {
  try {
    const latest = await prisma.sensorReading.findFirst({
      orderBy: { timestamp: 'desc' }
    });
    
    res.json({
      success: true,
      data: latest
    });
  } catch (error) {
    console.error('❌ API latest error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// API endpoint untuk mendapatkan readings
app.get('/api/readings', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    
    const readings = await prisma.sensorReading.findMany({
      orderBy: { timestamp: 'desc' },
      take: parseInt(limit)
    });
    
    res.json({
      success: true,
      data: readings,
      count: readings.length
    });
  } catch (error) {
    console.error('❌ API readings error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MQTT Sensor Monitor',
    timestamp: new Date().toISOString(),
    endpoints: {
      mqtt_webhook: '/api/mqtt/webhook',
      sensor_data: '/api/sensor/data',
      latest: '/api/latest',
      readings: '/api/readings'
    }
  });
});

// MQTT Configuration Info endpoint
app.get('/api/mqtt/config', (req, res) => {
  res.json({
    broker: process.env.MQTT_HOST,
    port: process.env.MQTT_PORT,
    topic: 'sensor/data',
    webhook_url: `${req.protocol}://${req.get('host')}/api/mqtt/webhook`,
    direct_post_url: `${req.protocol}://${req.get('host')}/api/sensor/data`,
    note: 'MQTT persistent connections are not supported in Vercel serverless. Use webhooks or direct HTTP POST.'
  });
});

// Export for Vercel
module.exports = app;
