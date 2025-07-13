const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const mqtt = require('mqtt');
require('dotenv').config();
const prisma = require('./lib/prisma');
const dbAccess = require('./database-access');

// Setup EJS dan static files
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

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

// API endpoint for latest sensor data (alternative to Socket.IO)
app.get('/api/latest', async (req, res) => {
  try {
    const latestReading = await dbAccess.getReadings({ limit: 1 });
    if (latestReading.length > 0) {
      res.json(latestReading[0]);
    } else {
      res.json({ temperature: 0, humidity: 0, timestamp: new Date().toISOString() });
    }
  } catch (error) {
    console.error('Error in /api/latest:', error);
    res.status(500).json({ error: 'Failed to fetch latest reading', details: error.message });
  }
});

// Data structure
let sensorData = {
  temperature: 0,
  humidity: 0,
  history: []
};

// MQTT Configuration
// Expected message format: {"temp":23.54,"hum":71.93,"timestamp":"2025-07-13T17:09:02"}
const mqttOptions = {
  host: process.env.MQTT_HOST,
  port: parseInt(process.env.MQTT_PORT),
  protocol: 'mqtts',
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD
};

// Connect to MQTT broker
const client = mqtt.connect(mqttOptions);

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  client.subscribe('sht20/data', (err) => {
    if (err) {
      console.error('Subscription error:', err);
    }
  });
});

client.on('message', async (topic, message) => {
  if (topic === 'sht20/data') {
    try {
      const data = JSON.parse(message.toString());
      
      // Validate required fields for new format: {"temp":23.54,"hum":71.93,"timestamp":"2025-07-13T17:09:02"}
      if (typeof data.temp !== 'number' || typeof data.hum !== 'number') {
        console.error('Invalid MQTT message format. Expected temp and hum as numbers:', data);
        return;
      }
      
      // Create comprehensive timestamp
      const receivedAt = new Date();
      const timestamp = data.timestamp ? new Date(data.timestamp) : receivedAt;
      
      console.log('MQTT Data received:', {
        topic,
        data,
        receivedAt: receivedAt.toISOString(),
        dataTimestamp: data.timestamp || 'No timestamp from device',
        usedTimestamp: timestamp.toISOString()
      });
      
      // Save to database with proper timestamp
      const savedReading = await dbAccess.createReading({
        temperature: data.temp,
        humidity: data.hum,
        timestamp: timestamp,  // Timestamp dari device atau received time
        receivedAt: receivedAt,  // Kapan server menerima data
        location: data.location || 'Default Room',
        deviceId: data.deviceId || 'SHT20-001'  // Simplified device ID handling
      });
      
      console.log('Data saved to DB:', {
        id: savedReading.id,
        timestamp: savedReading.timestamp.toISOString(),
        temperature: savedReading.temperature,
        humidity: savedReading.humidity
      });
      
      // Update current data
      sensorData.temperature = data.temp;
      sensorData.humidity = data.hum;
      sensorData.timestamp = timestamp;
      sensorData.receivedAt = receivedAt;
      sensorData.deviceId = data.deviceId || 'SHT20-001';  // Simplified device ID handling
      
      // Get recent history from database (last 24 entries)
      const recentReadings = await dbAccess.getRecentReadings(24);
      
      sensorData.history = recentReadings.map(reading => ({
        time: reading.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}),
        temperature: reading.temperature,
        humidity: reading.humidity
      }));
      
      // Send update to all connected clients
      io.emit('update', sensorData);
    } catch (err) {
      console.error('Error parsing MQTT message or saving to database:', err);
    }
  }
});

client.on('error', (err) => {
  console.error('MQTT error:', err);
});

// Socket.io connection
io.on('connection', async (socket) => {
  console.log('Client connected');
  
  try {
    // Test database connection
    const dbConnected = await dbAccess.testConnection();
    if (!dbConnected) {
      console.error('Database connection failed on startup');
    }
    
    // Get latest reading from database
    const latestReading = await dbAccess.getLatestReading();
    
    if (latestReading) {
      sensorData.temperature = latestReading.temperature;
      sensorData.humidity = latestReading.humidity;
      sensorData.timestamp = latestReading.timestamp;
      sensorData.receivedAt = latestReading.receivedAt;
      sensorData.deviceId = latestReading.deviceId;
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
    console.error('Error fetching data from database:', err);
    socket.emit('update', sensorData);
  }
  
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Export app for Vercel
module.exports = app;

// Start server (only in non-production environment)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3000;
  http.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down gracefully...');
    await dbAccess.disconnect();
    process.exit(0);
  });
}