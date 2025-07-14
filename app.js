const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
require('dotenv').config();
const prisma = require('./lib/prisma');
const dbAccess = require('./database-access');
const mqttService = require('./lib/mqtt-service');

// Setup EJS dan static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Route utama
app.get('/', (req, res) => {
  res.render('index');
});

// API Routes
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

// New API endpoint for grouped data
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

// API endpoint for latest sensor data with MQTT retain support
app.get('/api/latest', async (req, res) => {
  try {
    // Prioritas: 1. Retain message, 2. Database
    const retainMessages = mqttService.getRetainMessages();
    const sensorRetainMessage = retainMessages.find(msg => 
      msg.topic.includes('data') || msg.topic === 'sht20/data'
    );
    
    if (sensorRetainMessage) {
      try {
        const data = JSON.parse(sensorRetainMessage.message);
        if (data.temp !== undefined && data.hum !== undefined) {
          return res.json({
            temperature: data.temp,
            humidity: data.hum,
            timestamp: sensorRetainMessage.timestamp,
            source: 'retain_message',
            deviceId: sensorRetainMessage.deviceId
          });
        }
      } catch (parseError) {
        console.log('Error parsing retain message');
      }
    }
    
    // Fallback ke database
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

// MQTT API endpoints
app.get('/api/mqtt/logs', async (req, res) => {
  try {
    const {
      limit = 100,
      offset = 0,
      topic,
      deviceId,
      startDate,
      endDate,
      messageType
    } = req.query;
    
    const logs = await mqttService.getMessageLogs({
      limit: parseInt(limit),
      offset: parseInt(offset),
      topic,
      deviceId,
      startDate,
      endDate,
      messageType
    });
    
    res.json({
      logs,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error in /api/mqtt/logs:', error);
    res.status(500).json({ error: 'Failed to fetch MQTT logs', details: error.message });
  }
});

app.get('/api/mqtt/retain', async (req, res) => {
  try {
    const retainMessages = mqttService.getRetainMessages();
    res.json(retainMessages);
  } catch (error) {
    console.error('Error in /api/mqtt/retain:', error);
    res.status(500).json({ error: 'Failed to fetch retain messages', details: error.message });
  }
});

app.post('/api/mqtt/publish', async (req, res) => {
  try {
    const { topic, message, qos = 1 } = req.body;
    
    if (!topic || !message) {
      return res.status(400).json({ error: 'Topic and message are required' });
    }
    
    await mqttService.publishRetainMessage(topic, JSON.stringify(message), { qos });
    
    res.json({ 
      success: true, 
      message: 'Retain message published successfully',
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
    await mqttService.recoverRetainMessages();
    
    res.json({ 
      success: true, 
      message: 'Data recovery completed successfully' 
    });
  } catch (error) {
    console.error('Error in /api/mqtt/recover:', error);
    res.status(500).json({ error: 'Failed to recover data', details: error.message });
  }
});

app.get('/api/mqtt/status', async (req, res) => {
  try {
    const status = {
      connected: mqttService.isConnected,
      retainMessagesCount: mqttService.getRetainMessages().length,
      timestamp: new Date().toISOString()
    };
    
    res.json(status);
  } catch (error) {
    console.error('Error in /api/mqtt/status:', error);
    res.status(500).json({ error: 'Failed to get MQTT status', details: error.message });
  }
});

// Dashboard API dengan data kombinasi retain + database
app.get('/api/dashboard', async (req, res) => {
  try {
    const [latestReading, recentReadings, retainMessages, stats] = await Promise.all([
      dbAccess.getReadings({ limit: 1 }),
      dbAccess.getReadings({ limit: 24, days: 1 }),
      Promise.resolve(mqttService.getRetainMessages()),
      dbAccess.getStatistics(1)
    ]);
    
    // Prioritize retain message untuk data terkini
    let currentData = null;
    const sensorRetainMessage = retainMessages.find(msg => 
      msg.topic.includes('data') || msg.topic === 'sht20/data'
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
        console.log('Error parsing retain message');
      }
    }
    
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
        connected: mqttService.isConnected
      }
    });
  } catch (error) {
    console.error('Error in /api/dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard data', details: error.message });
  }
});

// Data structure untuk backward compatibility
let sensorData = {
  temperature: 0,
  humidity: 0,
  history: []
};

// Initialize MQTT service
let mqttInitialized = false;

async function initializeMQTT() {
  if (!mqttInitialized) {
    try {
      await mqttService.initialize();
      mqttInitialized = true;
      console.log('MQTT service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MQTT service:', error);
    }
  }
}

// Socket.io connection dengan MQTT retain support
io.on('connection', async (socket) => {
  console.log('Client connected');
  
  try {
    // Ensure MQTT is initialized
    await initializeMQTT();
    
    // Test database connection
    const dbConnected = await dbAccess.testConnection();
    if (!dbConnected) {
      console.error('Database connection failed on startup');
    }
    
    // Get data dari retain messages terlebih dahulu
    const retainMessages = mqttService.getRetainMessages();
    const sensorRetainMessage = retainMessages.find(msg => 
      msg.topic.includes('data') || msg.topic === 'sht20/data'
    );
    
    if (sensorRetainMessage) {
      try {
        const data = JSON.parse(sensorRetainMessage.message);
        if (data.temp !== undefined && data.hum !== undefined) {
          sensorData.temperature = data.temp;
          sensorData.humidity = data.hum;
          sensorData.timestamp = sensorRetainMessage.timestamp;
          sensorData.deviceId = sensorRetainMessage.deviceId;
        }
      } catch (parseError) {
        console.log('Error parsing retain message, falling back to database');
      }
    }
    
    // Fallback ke database jika tidak ada retain message
    if (!sensorRetainMessage || sensorData.temperature === 0) {
      const latestReading = await dbAccess.getLatestReading();
      
      if (latestReading) {
        sensorData.temperature = latestReading.temperature;
        sensorData.humidity = latestReading.humidity;
        sensorData.timestamp = latestReading.timestamp;
        sensorData.receivedAt = latestReading.receivedAt;
        sensorData.deviceId = latestReading.deviceId;
      }
    }
    
    // Get recent history from database
    const recentReadings = await dbAccess.getRecentReadings(24);
    
    sensorData.history = recentReadings.map(reading => ({
      time: reading.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
      temperature: reading.temperature,
      humidity: reading.humidity
    }));
    
    // Send initial data
    socket.emit('update', sensorData);
  } catch (err) {
    console.error('Error fetching data:', err);
    socket.emit('update', sensorData);
  }
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
  
  // Handle manual data refresh request
  socket.on('refresh', async () => {
    try {
      await mqttService.recoverRetainMessages();
      socket.emit('refreshComplete', { success: true });
    } catch (error) {
      socket.emit('refreshComplete', { success: false, error: error.message });
    }
  });
});

// Export app for Vercel
module.exports = app;

// Start server (only in non-production environment)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  
  // Initialize MQTT before starting server
  initializeMQTT().then(() => {
    http.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }).catch(error => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await mqttService.disconnect();
    await dbAccess.disconnect();
    process.exit(0);
  });
}