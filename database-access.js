const { PrismaClient } = require('@prisma/client');

/**
 * Database access functions for sensor monitoring application
 */

class DatabaseAccess {
  constructor() {
    this.prisma = require('./lib/prisma');
  }

  /**
   * Create fresh Prisma client for each critical operation to avoid prepared statement conflicts
   */
  async createFreshClient() {
    const client = new PrismaClient();
    return client;
  }

  /**
   * Get sensor readings with flexible filtering
   * @param {Object} options - Filter options
   * @param {number} options.days - Number of days to filter (supports decimals for hours)
   * @param {number} options.limit - Maximum number of records to return
   * @param {Date} options.startDate - Start date for filtering
   * @param {Date} options.endDate - End date for filtering
   * @returns {Promise<Array>} Array of sensor readings
   */
  async getReadings(options = {}) {
    const client = await this.createFreshClient();
    
    try {
      const { days = 0.125, limit = 1000, startDate, endDate } = options;
      
      let since;
      
      if (startDate && endDate) {
        // Use custom date range
        since = startDate;
      } else {
        // Calculate date range based on days parameter
        const daysFloat = parseFloat(days);
        
        if (daysFloat === 0.125) {
          // For "terkini" (3 hours), get data from 3 hours ago
          since = new Date();
          since.setHours(since.getHours() - 3);
        } else if (daysFloat === 1) {
          // For "hari ini", get data from start of today
          since = new Date();
          since.setHours(0, 0, 0, 0); // Start of today
        } else {
          // For other periods, get data from X days ago
          since = new Date();
          since.setDate(since.getDate() - parseInt(days));
        }
      }

      const whereClause = {
        timestamp: {
          gte: since
        }
      };

      if (endDate) {
        whereClause.timestamp.lte = endDate;
      }

      const readings = await client.sensorReading.findMany({
        where: whereClause,
        orderBy: { timestamp: 'desc' },
        take: parseInt(limit),
        select: {
          id: true,
          temperature: true,
          humidity: true,
          timestamp: true,
          receivedAt: true,
          location: true,
          deviceId: true
        }
      });

      console.log(`Database query completed: Found ${readings.length} readings for period ${days} days`);
      return readings;
    } catch (error) {
      console.error('Error in getReadings:', error);
      throw error;
    } finally {
      await client.$disconnect();
    }
  }

  /**
   * Get latest sensor reading
   * @returns {Promise<Object|null>} Latest sensor reading or null
   */
  async getLatestReading() {
    try {
      const reading = await this.prisma.sensorReading.findFirst({
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          temperature: true,
          humidity: true,
          timestamp: true,
          receivedAt: true,
          location: true,
          deviceId: true
        }
      });

      return reading;
    } catch (error) {
      console.error('Error in getLatestReading:', error);
      throw error;
    }
  }

  /**
   * Get recent readings for real-time chart
   * @param {number} count - Number of recent readings to get
   * @returns {Promise<Array>} Array of recent readings
   */
  async getRecentReadings(count = 24) {
    try {
      const readings = await this.prisma.sensorReading.findMany({
        orderBy: { timestamp: 'desc' },
        take: parseInt(count),
        select: {
          id: true,
          temperature: true,
          humidity: true,
          timestamp: true
        }
      });

      return readings.reverse(); // Return in ascending order for charts
    } catch (error) {
      console.error('Error in getRecentReadings:', error);
      throw error;
    }
  }

  /**
   * Get statistics for a period
   * @param {number} days - Number of days for statistics
   * @returns {Promise<Object>} Statistics object
   */
  async getStatistics(days = 7) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - parseInt(days));

      const stats = await this.prisma.sensorReading.aggregate({
        where: {
          timestamp: {
            gte: since
          }
        },
        _avg: {
          temperature: true,
          humidity: true
        },
        _max: {
          temperature: true,
          humidity: true
        },
        _min: {
          temperature: true,
          humidity: true
        },
        _count: true
      });

      return stats;
    } catch (error) {
      console.error('Error in getStatistics:', error);
      throw error;
    }
  }

  /**
   * Create a new sensor reading
   * @param {Object} data - Sensor reading data
   * @returns {Promise<Object>} Created reading
   */
  async createReading(data) {
    try {
      const reading = await this.prisma.sensorReading.create({
        data: {
          temperature: data.temperature,
          humidity: data.humidity,
          timestamp: data.timestamp || new Date(),
          receivedAt: data.receivedAt || new Date(),
          location: data.location || 'Default Room',
          deviceId: data.deviceId || 'SHT20-001'
        }
      });

      console.log(`New reading created: ID ${reading.id}, Temp: ${reading.temperature}°C, Humidity: ${reading.humidity}%`);
      return reading;
    } catch (error) {
      console.error('Error in createReading:', error);
      throw error;
    }
  }

  /**
   * Insert a new sensor reading
   * @param {Object} data - Sensor reading data
   * @param {number} data.temperature - Temperature value
   * @param {number} data.humidity - Humidity value
   * @param {string} data.deviceId - Device identifier
   * @param {string} data.location - Location name
   * @param {Date} data.timestamp - Reading timestamp
   * @returns {Promise<Object>} Created sensor reading
   */
  async insertReading(data) {
    const client = await this.createFreshClient();
    
    try {
      const { temperature, humidity, deviceId, location, timestamp } = data;
      
      const reading = await client.sensorReading.create({
        data: {
          temperature: parseFloat(temperature),
          humidity: parseFloat(humidity),
          deviceId: deviceId || 'SHT20-001',
          location: location || 'Default Room',
          timestamp: timestamp || new Date(),
          receivedAt: new Date()
        }
      });
      
      console.log(`New reading inserted: ID=${reading.id}, T=${reading.temperature}°C, H=${reading.humidity}%`);
      return reading;
    } catch (error) {
      console.error('Error inserting reading:', error);
      throw error;
    } finally {
      await client.$disconnect();
    }
  }

  /**
   * Insert multiple sensor readings (batch insert)
   * @param {Array} readings - Array of sensor reading data
   * @returns {Promise<Array>} Array of created sensor readings
   */
  async insertMultipleReadings(readings) {
    const client = await this.createFreshClient();
    
    try {
      const now = new Date();
      
      const dataToInsert = readings.map(reading => ({
        temperature: parseFloat(reading.temperature),
        humidity: parseFloat(reading.humidity),
        deviceId: reading.deviceId || 'SHT20-001',
        location: reading.location || 'Default Room',
        timestamp: reading.timestamp || now,
        receivedAt: now
      }));
      
      // Use createMany for better performance
      const result = await client.sensorReading.createMany({
        data: dataToInsert,
        skipDuplicates: true
      });
      
      console.log(`Batch insert completed: ${result.count} readings inserted`);
      
      // Return the created readings (Note: createMany doesn't return the actual records)
      // So we'll return the count and a sample of what was inserted
      return {
        count: result.count,
        inserted: dataToInsert.slice(0, 5), // Return first 5 as sample
        total: dataToInsert.length
      };
    } catch (error) {
      console.error('Error inserting multiple readings:', error);
      throw error;
    } finally {
      await client.$disconnect();
    }
  }

  /**
   * Delete old sensor readings (cleanup function)
   * @param {number} daysToKeep - Number of days to keep (older data will be deleted)
   * @returns {Promise<number>} Number of deleted records
   */
  async cleanupOldReadings(daysToKeep = 30) {
    const client = await this.createFreshClient();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      
      const result = await client.sensorReading.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      });
      
      console.log(`Cleanup completed: ${result.count} old readings deleted`);
      return result.count;
    } catch (error) {
      console.error('Error cleaning up old readings:', error);
      throw error;
    } finally {
      await client.$disconnect();
    }
  }

  /**
   * Test database connection
   * @returns {Promise<boolean>} Connection status
   */
  async testConnection() {
    try {
      const count = await this.prisma.sensorReading.count();
      console.log(`Database connection successful. Total readings: ${count}`);
      return true;
    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }

  /**
   * Get data grouped by time intervals for chart display
   * @param {Object} options - Grouping options
   * @param {number} options.days - Period in days
   * @param {string} options.interval - Grouping interval ('minutes', 'hours', 'days')
   * @param {number} options.intervalSize - Size of interval (e.g., 15 for 15 minutes)
   * @returns {Promise<Array>} Grouped data array
   */
  async getGroupedData(options = {}) {
    try {
      const { days = 0.125, interval = 'minutes', intervalSize = 15 } = options;
      
      // Get raw data first
      const readings = await this.getReadings({ days, limit: 5000 });
      
      if (readings.length === 0) {
        return [];
      }

      // Group data based on interval
      const groups = {};
      
      readings.forEach(reading => {
        const date = new Date(reading.timestamp);
        let key;
        
        switch (interval) {
          case 'minutes':
            const roundedMinutes = Math.floor(date.getMinutes() / intervalSize) * intervalSize;
            date.setMinutes(roundedMinutes, 0, 0);
            key = date.getTime();
            break;
          case 'hours':
            const roundedHours = Math.floor(date.getHours() / intervalSize) * intervalSize;
            date.setHours(roundedHours, 0, 0, 0);
            key = date.getTime();
            break;
          case 'days':
            date.setHours(0, 0, 0, 0);
            key = date.getTime();
            break;
          default:
            key = date.getTime();
        }
        
        if (!groups[key]) {
          groups[key] = {
            timestamp: new Date(key),
            temperatures: [],
            humidities: [],
            count: 0
          };
        }
        
        groups[key].temperatures.push(reading.temperature);
        groups[key].humidities.push(reading.humidity);
        groups[key].count++;
      });
      
      // Calculate averages and format for chart
      const result = Object.values(groups).map(group => ({
        timestamp: group.timestamp,
        temperature: group.temperatures.reduce((a, b) => a + b) / group.temperatures.length,
        humidity: group.humidities.reduce((a, b) => a + b) / group.humidities.length,
        count: group.count
      })).sort((a, b) => a.timestamp - b.timestamp);
      
      console.log(`Grouped data: ${result.length} intervals from ${readings.length} raw readings`);
      return result;
    } catch (error) {
      console.error('Error in getGroupedData:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  async disconnect() {
    try {
      await this.prisma.$disconnect();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
}

module.exports = new DatabaseAccess();
