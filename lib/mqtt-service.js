const mqtt = require('mqtt');
const prisma = require('./prisma');

class MQTTService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.retainedMessages = new Map(); // Cache untuk retain messages
    this.processingInterval = null;
  }

  // Initialize MQTT connection dengan retain message support
  async initialize() {
    try {
      const mqttOptions = {
        host: process.env.MQTT_HOST,
        port: parseInt(process.env.MQTT_PORT),
        protocol: 'mqtts',
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        clean: false, // Penting untuk retain messages
        clientId: `sensor_monitor_${Date.now()}`, // Unique client ID
        keepalive: 60,
        reconnectPeriod: 5000,
        connectTimeout: 30000
      };

      this.client = mqtt.connect(mqttOptions);

      return new Promise((resolve, reject) => {
        this.client.on('connect', async () => {
          console.log('Connected to MQTT broker with retain support');
          this.isConnected = true;

          // Subscribe ke topik dengan retain flag
          const topics = [
            'sht20/data',
            'sht20/status',
            'sensor/+/data', // Wildcard untuk multiple sensors
            'sensor/+/status'
          ];

          for (const topic of topics) {
            this.client.subscribe(topic, { qos: 1, retain: true }, (err) => {
              if (err) {
                console.error(`Subscription error for ${topic}:`, err);
              } else {
                console.log(`Subscribed to ${topic} with retain support`);
              }
            });
          }

          // Pulihkan retain messages dari database
          await this.recoverRetainMessages();
          
          // Mulai processing interval untuk batch processing
          this.startProcessingInterval();

          resolve();
        });

        this.client.on('message', async (topic, message, packet) => {
          await this.handleMessage(topic, message, packet);
        });

        this.client.on('error', (err) => {
          console.error('MQTT error:', err);
          this.isConnected = false;
          reject(err);
        });

        this.client.on('close', () => {
          console.log('MQTT connection closed');
          this.isConnected = false;
        });

        this.client.on('reconnect', () => {
          console.log('MQTT reconnecting...');
        });
      });
    } catch (error) {
      console.error('Failed to initialize MQTT service:', error);
      throw error;
    }
  }

  // Handle incoming MQTT messages
  async handleMessage(topic, message, packet) {
    try {
      const messageString = message.toString();
      const timestamp = new Date();
      
      console.log(`MQTT Message received:`, {
        topic,
        message: messageString,
        retain: packet.retain,
        qos: packet.qos,
        timestamp: timestamp.toISOString()
      });

      // Parse message untuk mendapatkan device ID
      let deviceId = null;
      let messageType = 'unknown';
      
      try {
        const parsedMessage = JSON.parse(messageString);
        deviceId = parsedMessage.deviceId || this.extractDeviceIdFromTopic(topic);
        messageType = this.determineMessageType(topic, parsedMessage);
      } catch (parseError) {
        console.log('Message is not JSON format, treating as plain text');
        deviceId = this.extractDeviceIdFromTopic(topic);
      }

      // Simpan ke message log (semua pesan)
      await this.saveMessageLog({
        topic,
        message: messageString,
        qos: packet.qos || 0,
        retain: packet.retain || false,
        timestamp,
        deviceId,
        messageType
      });

      // Jika ini adalah retain message, simpan/update di retain table
      if (packet.retain) {
        await this.saveRetainMessage({
          topic,
          message: messageString,
          qos: packet.qos || 0,
          timestamp,
          deviceId
        });
        
        // Update cache
        this.retainedMessages.set(topic, {
          message: messageString,
          qos: packet.qos || 0,
          timestamp,
          deviceId
        });
      }

      // Process sensor data jika topik sesuai
      if (this.isSensorDataTopic(topic)) {
        await this.processSensorData(topic, messageString, timestamp);
      }

    } catch (error) {
      console.error('Error handling MQTT message:', error);
    }
  }

  // Simpan message log ke database
  async saveMessageLog(data) {
    try {
      await prisma.mqttMessageLog.create({
        data: {
          topic: data.topic,
          message: data.message,
          qos: data.qos,
          retain: data.retain,
          timestamp: data.timestamp,
          receivedAt: new Date(),
          deviceId: data.deviceId,
          messageType: data.messageType,
          processed: false
        }
      });
    } catch (error) {
      console.error('Error saving message log:', error);
    }
  }

  // Simpan/update retain message
  async saveRetainMessage(data) {
    try {
      await prisma.retainMessage.upsert({
        where: { topic: data.topic },
        update: {
          message: data.message,
          qos: data.qos,
          timestamp: data.timestamp,
          updatedAt: new Date(),
          deviceId: data.deviceId
        },
        create: {
          topic: data.topic,
          message: data.message,
          qos: data.qos,
          timestamp: data.timestamp,
          deviceId: data.deviceId
        }
      });
    } catch (error) {
      console.error('Error saving retain message:', error);
    }
  }

  // Pulihkan retain messages dari database saat startup
  async recoverRetainMessages() {
    try {
      console.log('Recovering retain messages from database...');
      
      const retainMessages = await prisma.retainMessage.findMany({
        orderBy: { updatedAt: 'desc' }
      });

      console.log(`Found ${retainMessages.length} retain messages to recover`);

      for (const retainMsg of retainMessages) {
        // Update cache
        this.retainedMessages.set(retainMsg.topic, {
          message: retainMsg.message,
          qos: retainMsg.qos,
          timestamp: retainMsg.timestamp,
          deviceId: retainMsg.deviceId
        });

        // Proses sebagai sensor data jika perlu
        if (this.isSensorDataTopic(retainMsg.topic)) {
          await this.processSensorData(retainMsg.topic, retainMsg.message, retainMsg.timestamp);
        }
      }

      // Proses unprocessed message logs
      await this.processUnprocessedMessages();

    } catch (error) {
      console.error('Error recovering retain messages:', error);
    }
  }

  // Proses unprocessed messages dari log
  async processUnprocessedMessages() {
    try {
      const unprocessedMessages = await prisma.mqttMessageLog.findMany({
        where: { processed: false },
        orderBy: { timestamp: 'asc' },
        take: 1000 // Limit untuk performa
      });

      console.log(`Processing ${unprocessedMessages.length} unprocessed messages`);

      for (const msgLog of unprocessedMessages) {
        if (this.isSensorDataTopic(msgLog.topic)) {
          await this.processSensorData(msgLog.topic, msgLog.message, msgLog.timestamp);
        }

        // Mark as processed
        await prisma.mqttMessageLog.update({
          where: { id: msgLog.id },
          data: { processed: true }
        });
      }

    } catch (error) {
      console.error('Error processing unprocessed messages:', error);
    }
  }

  // Proses data sensor
  async processSensorData(topic, messageString, timestamp) {
    try {
      const data = JSON.parse(messageString);
      
      // Validasi format data sensor
      if (typeof data.temp !== 'number' || typeof data.hum !== 'number') {
        console.log('Invalid sensor data format, skipping:', data);
        return;
      }

      const deviceId = data.deviceId || this.extractDeviceIdFromTopic(topic);
      const location = data.location || 'Default Room';

      // Simpan ke sensor readings
      const dbAccess = require('../database-access');
      const savedReading = await dbAccess.createReading({
        temperature: data.temp,
        humidity: data.hum,
        timestamp: timestamp,
        receivedAt: new Date(),
        location: location,
        deviceId: deviceId
      });

      console.log('Sensor data processed and saved:', {
        id: savedReading.id,
        deviceId: deviceId,
        temperature: data.temp,
        humidity: data.hum,
        timestamp: timestamp.toISOString()
      });

    } catch (error) {
      console.error('Error processing sensor data:', error);
    }
  }

  // Mulai interval processing untuk batch operations
  startProcessingInterval() {
    // Proses setiap 30 detik untuk unprocessed messages
    this.processingInterval = setInterval(async () => {
      try {
        await this.processUnprocessedMessages();
      } catch (error) {
        console.error('Error in processing interval:', error);
      }
    }, 30000);
  }

  // Helper methods
  extractDeviceIdFromTopic(topic) {
    // Extract device ID dari topic pattern seperti "sensor/device123/data"
    const match = topic.match(/sensor\/([^\/]+)\//) || topic.match(/([^\/]+)\/data/);
    return match ? match[1] : 'unknown';
  }

  determineMessageType(topic, parsedMessage) {
    if (topic.includes('/data')) return 'sensor_data';
    if (topic.includes('/status')) return 'status';
    if (topic.includes('/command')) return 'command';
    if (parsedMessage && parsedMessage.temp !== undefined) return 'sensor_data';
    return 'unknown';
  }

  isSensorDataTopic(topic) {
    return topic.includes('/data') || topic === 'sht20/data';
  }

  // Get all retain messages
  getRetainMessages() {
    return Array.from(this.retainedMessages.entries()).map(([topic, data]) => ({
      topic,
      ...data
    }));
  }

  // Get message logs with pagination
  async getMessageLogs(options = {}) {
    const {
      limit = 100,
      offset = 0,
      topic = null,
      deviceId = null,
      startDate = null,
      endDate = null,
      messageType = null
    } = options;

    const where = {};
    
    if (topic) where.topic = { contains: topic };
    if (deviceId) where.deviceId = deviceId;
    if (messageType) where.messageType = messageType;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    return await prisma.mqttMessageLog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  // Publish message dengan retain flag
  async publishRetainMessage(topic, message, options = {}) {
    if (!this.isConnected || !this.client) {
      throw new Error('MQTT client is not connected');
    }

    const publishOptions = {
      qos: options.qos || 1,
      retain: true, // Selalu set retain untuk method ini
      ...options
    };

    return new Promise((resolve, reject) => {
      this.client.publish(topic, message, publishOptions, (err) => {
        if (err) {
          console.error('Error publishing retain message:', err);
          reject(err);
        } else {
          console.log(`Retain message published to ${topic}`);
          resolve();
        }
      });
    });
  }

  // Cleanup resources
  async disconnect() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    if (this.client && this.isConnected) {
      this.client.end();
    }
  }
}

module.exports = new MQTTService();
