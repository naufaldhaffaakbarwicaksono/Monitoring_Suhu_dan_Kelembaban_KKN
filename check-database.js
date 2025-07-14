#!/usr/bin/env node

/**
 * Database status check script
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function checkDatabaseStatus() {
  console.log('📊 DATABASE STATUS CHECK');
  console.log('═'.repeat(40));

  try {
    // Test database connection
    await prisma.$connect();
    console.log('✅ Database connection: OK');

    // Count sensor readings
    const sensorCount = await prisma.sensorReading.count();
    console.log(`📈 Sensor readings: ${sensorCount}`);

    // Count daily averages
    let dailyCount = 0;
    try {
      dailyCount = await prisma.dailyAverage.count();
      console.log(`📊 Daily averages: ${dailyCount}`);
    } catch (error) {
      console.log('📊 Daily averages: Table not found');
    }

    // Get latest reading if any
    if (sensorCount > 0) {
      const latest = await prisma.sensorReading.findFirst({
        orderBy: { timestamp: 'desc' }
      });
      
      console.log('');
      console.log('🕐 Latest reading:');
      console.log(`   Temperature: ${latest.temperature}°C`);
      console.log(`   Humidity: ${latest.humidity}%`);
      console.log(`   Device: ${latest.deviceId}`);
      console.log(`   Time: ${latest.timestamp.toISOString()}`);
      
      // Get oldest reading
      const oldest = await prisma.sensorReading.findFirst({
        orderBy: { timestamp: 'asc' }
      });
      
      console.log('');
      console.log('📅 Data range:');
      console.log(`   From: ${oldest.timestamp.toISOString()}`);
      console.log(`   To: ${latest.timestamp.toISOString()}`);
      
      // Calculate days
      const daysDiff = Math.ceil((latest.timestamp - oldest.timestamp) / (1000 * 60 * 60 * 24));
      console.log(`   Duration: ${daysDiff} days`);
    } else {
      console.log('');
      console.log('📭 Database is empty');
      console.log('   Ready for new sensor data!');
    }

    console.log('');
    console.log('🌐 Database info:');
    console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   URL configured: ${process.env.DATABASE_URL ? 'Yes' : 'No'}`);

  } catch (error) {
    console.error('❌ Database error:', error.message);
    
    if (error.message.includes('password authentication failed')) {
      console.error('💡 Check your DATABASE_URL credentials');
    } else if (error.message.includes('does not exist')) {
      console.error('💡 Check if database exists');
    } else if (error.message.includes('timeout')) {
      console.error('💡 Check network connection to database');
    }
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabaseStatus();
