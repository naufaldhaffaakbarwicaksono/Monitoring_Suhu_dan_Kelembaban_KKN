#!/usr/bin/env node

/**
 * Database cleanup script - DELETE ALL DATA
 * ⚠️  WARNING: This will permanently delete all sensor data!
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function deleteAllData() {
  console.log('🚨 DATABASE CLEANUP SCRIPT');
  console.log('⚠️  WARNING: This will permanently delete ALL sensor data!');
  console.log('');

  // Safety confirmation
  const args = process.argv.slice(2);
  if (!args.includes('--confirm')) {
    console.log('❌ Confirmation required!');
    console.log('');
    console.log('To delete all data, run:');
    console.log('node cleanup-database.js --confirm');
    console.log('');
    console.log('This will delete:');
    console.log('• All sensor readings');
    console.log('• All daily averages (if exist)');
    console.log('• All historical data');
    process.exit(1);
  }

  try {
    console.log('🔄 Starting database cleanup...');
    
    // Count existing data first
    const sensorCount = await prisma.sensorReading.count();
    console.log(`📊 Found ${sensorCount} sensor readings`);

    let dailyCount = 0;
    try {
      dailyCount = await prisma.dailyAverage.count();
      console.log(`📈 Found ${dailyCount} daily averages`);
    } catch (error) {
      console.log('📈 Daily averages table not found (OK)');
    }

    if (sensorCount === 0 && dailyCount === 0) {
      console.log('✅ Database is already empty!');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('');
    console.log('🗑️  Deleting all data...');

    // Delete all sensor readings
    const sensorResult = await prisma.sensorReading.deleteMany({});
    console.log(`✅ Deleted ${sensorResult.count} sensor readings`);

    // Delete all daily averages
    let dailyResult = { count: 0 };
    try {
      dailyResult = await prisma.dailyAverage.deleteMany({});
      console.log(`✅ Deleted ${dailyResult.count} daily averages`);
    } catch (error) {
      console.log('✅ Daily averages table cleared (or doesn\'t exist)');
    }

    const totalDeleted = sensorResult.count + dailyResult.count;

    console.log('');
    console.log('🎉 Database cleanup completed!');
    console.log(`📊 Total records deleted: ${totalDeleted}`);
    console.log(`   • Sensor readings: ${sensorResult.count}`);
    console.log(`   • Daily averages: ${dailyResult.count}`);
    console.log('');
    console.log('✨ Database is now empty and ready for new data.');

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error('');
    console.error('Common issues:');
    console.error('• Database connection failed');
    console.error('• Table doesn\'t exist');
    console.error('• Permission denied');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Warning banner
console.log('');
console.log('═'.repeat(60));
console.log('🚨 DANGER ZONE - DATABASE CLEANUP SCRIPT 🚨');
console.log('═'.repeat(60));

deleteAllData();
