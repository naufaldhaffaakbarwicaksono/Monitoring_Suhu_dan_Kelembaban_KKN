// Vercel serverless function entry point
const express = require('express');
const path = require('path');
require('dotenv').config();

// Import services
const dbAccess = require('../database-access');

const app = express();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Setup EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

// Conditional MQTT service untuk serverless
let mqttService = null;

// Safely initialize MQTT if available
async function initializeMQTTSafe() {
  if (!mqttService) {
    try {
      // Only load MQTT in non-serverless environments
      if (process.env.VERCEL !== '1' && process.env.NODE_ENV !== 'production') {
        const mqttServiceModule = require('../lib/mqtt-service');
        await mqttServiceModule.initialize();
        mqttService = mqttServiceModule;
        console.log('MQTT service initialized for development');
      } else {
        // Serverless fallback
        mqttService = {
          isConnected: false,
          getRetainMessages: () => [],
          getMessageLogs: () => Promise.resolve([]),
          publishRetainMessage: () => Promise.resolve(),
          recoverRetainMessages: () => Promise.resolve()
        };
        console.log('MQTT service running in serverless mode');
      }
    } catch (error) {
      console.log('MQTT service unavailable, using database fallback');
      mqttService = {
        isConnected: false,
        getRetainMessages: () => [],
        getMessageLogs: () => Promise.resolve([]),
        publishRetainMessage: () => Promise.resolve(),
        recoverRetainMessages: () => Promise.resolve()
      };
    }
  }
  return mqttService;
}

// Route utama
app.get('/', (req, res) => {
  res.render('index');
});

// API Routes untuk sensor readings
app.get('/api/readings', async (req, res) => {
  try {
    const { limit = 100, days = 0.125 } = req.query;
    
    console.log(`API Request: /api/readings?days=${days}&limit=${limit}`);
    
    const readings = await dbAccess.getReadings({
      days: parseFloat(days),
      limit: parseInt(limit)
    });
    
    console.log(`API Response: Returning ${readings.length} readings`);
    res.json(readings);
  } catch (error) {
    console.error('Error in /api/readings:', error);
    res.status(500).json({ error: 'Failed to fetch readings', details: error.message });
  }
});

// API endpoint untuk grouped data
app.get('/api/readings/grouped', async (req, res) => {
  try {
    const { days = 0.125, interval = 'minutes', intervalSize = 15 } = req.query;
    
    console.log(`API Request: /api/readings/grouped?days=${days}&interval=${interval}&intervalSize=${intervalSize}`);
    
    const groupedData = await dbAccess.getGroupedData({
      days: parseFloat(days),
      interval,
      intervalSize: parseInt(intervalSize)
    });
    
    console.log(`API Response: Returning ${groupedData.length} grouped data points`);
    res.json(groupedData);
  } catch (error) {
    console.error('Error in /api/readings/grouped:', error);
    res.status(500).json({ error: 'Failed to fetch grouped readings', details: error.message });
  }
});

// API endpoint untuk statistics
app.get('/api/stats', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    console.log(`API Request: /api/stats?days=${days}`);
    
    const stats = await dbAccess.getStatistics(parseInt(days));
    
    console.log(`API Response: Returning statistics for ${days} days`);
    res.json(stats);
  } catch (error) {
    console.error('Error in /api/stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics', details: error.message });
  }
});

// API endpoint untuk latest sensor data
app.get('/api/latest', async (req, res) => {
  try {
    // Dalam serverless environment, prioritaskan database
    const latestReading = await dbAccess.getReadings({ limit: 1 });
    if (latestReading.length > 0) {
      res.json({
        ...latestReading[0],
        source: 'database'
      });
    } else {
      res.json({ 
        temperature: 0, 
        humidity: 0, 
        timestamp: new Date().toISOString(),
        source: 'default'
      });
    }
  } catch (error) {
    console.error('Error in /api/latest:', error);
    res.status(500).json({ error: 'Failed to fetch latest reading', details: error.message });
  }
});

// Simplified MQTT endpoints untuk serverless
app.get('/api/mqtt/logs', async (req, res) => {
  try {
    const service = await initializeMQTTSafe();
    const logs = await service.getMessageLogs({
      limit: parseInt(req.query.limit || 100),
      offset: parseInt(req.query.offset || 0)
    });
    
    res.json({
      logs,
      pagination: {
        limit: parseInt(req.query.limit || 100),
        offset: parseInt(req.query.offset || 0)
      }
    });
  } catch (error) {
    console.error('Error in /api/mqtt/logs:', error);
    res.status(500).json({ error: 'MQTT logs unavailable', details: error.message });
  }
});

app.get('/api/mqtt/retain', async (req, res) => {
  try {
    const service = await initializeMQTTSafe();
    const retainMessages = service.getRetainMessages();
    res.json(retainMessages);
  } catch (error) {
    console.error('Error in /api/mqtt/retain:', error);
    res.status(500).json({ error: 'Retain messages unavailable', details: error.message });
  }
});

app.post('/api/mqtt/publish', async (req, res) => {
  try {
    const service = await initializeMQTTSafe();
    const { topic, message, qos = 1 } = req.body;
    
    if (!topic || !message) {
      return res.status(400).json({ error: 'Topic and message are required' });
    }
    
    if (!service.isConnected) {
      return res.status(503).json({ error: 'MQTT service not available in serverless environment' });
    }
    
    await service.publishRetainMessage(topic, JSON.stringify(message), { qos });
    
    res.json({ 
      success: true, 
      message: 'Message published successfully',
      topic,
      qos
    });
  } catch (error) {
    console.error('Error in /api/mqtt/publish:', error);
    res.status(500).json({ error: 'Failed to publish message', details: error.message });
  }
});

app.post('/api/mqtt/recover', async (req, res) => {
  try {
    const service = await initializeMQTTSafe();
    await service.recoverRetainMessages();
    
    res.json({ 
      success: true, 
      message: 'Recovery completed' 
    });
  } catch (error) {
    console.error('Error in /api/mqtt/recover:', error);
    res.status(500).json({ error: 'Failed to recover data', details: error.message });
  }
});

app.get('/api/mqtt/status', async (req, res) => {
  try {
    const service = await initializeMQTTSafe();
    const status = {
      initialized: service !== null,
      connected: service.isConnected,
      retainMessagesCount: service.getRetainMessages().length,
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL === '1' ? 'serverless' : 'development'
    };
    
    res.json(status);
  } catch (error) {
    console.error('Error in /api/mqtt/status:', error);
    res.status(500).json({ error: 'Failed to get MQTT status', details: error.message });
  }
});

// Optimized dashboard endpoint untuk serverless
app.get('/api/dashboard', async (req, res) => {
  try {
    const service = await initializeMQTTSafe();
    
    // Parallel requests untuk performa
    const [latestReading, recentReadings, stats] = await Promise.all([
      dbAccess.getReadings({ limit: 1 }),
      dbAccess.getReadings({ limit: 24, days: 1 }),
      dbAccess.getStatistics(1)
    ]);
    
    // Try to get current data from MQTT retain messages first
    let currentData = null;
    const retainMessages = service.getRetainMessages();
    const sensorRetainMessage = retainMessages.find(msg => 
      msg.topic && (msg.topic.includes('data') || msg.topic === 'sht20/data')
    );
    
    if (sensorRetainMessage) {
      try {
        const data = JSON.parse(sensorRetainMessage.message);
        if (data.temp !== undefined && data.hum !== undefined) {
          currentData = {
            temperature: data.temp,
            humidity: data.hum,
            timestamp: sensorRetainMessage.timestamp,
            source: 'retain_message',
            deviceId: sensorRetainMessage.deviceId
          };
        }
      } catch (parseError) {
        console.log('Error parsing retain message:', parseError.message);
      }
    }
    
    // Fallback to database for current data
    if (!currentData && latestReading.length > 0) {
      currentData = {
        ...latestReading[0],
        source: 'database'
      };
    }
    
    res.json({
      current: currentData || { 
        temperature: 0, 
        humidity: 0, 
        timestamp: new Date().toISOString(),
        source: 'default'
      },
      history: recentReadings.map(reading => ({
        time: reading.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        temperature: reading.temperature,
        humidity: reading.humidity,
        timestamp: reading.timestamp
      })),
      stats: stats,
      mqtt: {
        retainMessagesCount: retainMessages.length,
        connected: service.isConnected,
        environment: process.env.VERCEL === '1' ? 'serverless' : 'development'
      }
    });
  } catch (error) {
    console.error('Error in /api/dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: 'serverless'
  });
});

module.exports = app;
