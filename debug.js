const prisma = require('./lib/prisma');

async function debugDatabase() {
  try {
    console.log('Current time:', new Date());
    console.log('3 hours ago:', new Date(Date.now() - 3*60*60*1000));
    console.log('Start of today:', new Date(new Date().setHours(0,0,0,0)));
    
    const latest = await prisma.sensorReading.findMany({
      orderBy: { timestamp: 'desc' },
      take: 5
    });
    
    console.log('\nLatest 5 readings:');
    latest.forEach(r => {
      console.log(`ID: ${r.id}, Time: ${r.timestamp}, Temp: ${r.temperature}°C, Hum: ${r.humidity}%`);
    });
    
    // Check data in last 3 hours
    const threeHoursAgo = new Date(Date.now() - 3*60*60*1000);
    const recent = await prisma.sensorReading.findMany({
      where: {
        timestamp: { gte: threeHoursAgo }
      }
    });
    
    console.log(`\nData in last 3 hours (since ${threeHoursAgo}): ${recent.length} records`);
    
    // Check data from start of today
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const today = await prisma.sensorReading.findMany({
      where: {
        timestamp: { gte: startOfToday }
      }
    });
    
    console.log(`Data from start of today (since ${startOfToday}): ${today.length} records`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugDatabase();
