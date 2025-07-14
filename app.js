/**
 * Development Server Entry Point
 * Vercel akan menggunakan api/index.js langsung
 */

const app = require('./api/index');

const PORT = process.env.PORT || 3000;

// Only start server if not in Vercel environment
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log('🚀 Development server running');
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔗 API Health: http://localhost:${PORT}/api/health`);
    console.log(`📡 ESP32 Guide: http://localhost:${PORT}/api/esp32/guide`);
    console.log('');
    console.log('📝 Available endpoints:');
    console.log(`   POST /api/sensor/data - Receive sensor data`);
    console.log(`   POST /api/sensor/test - Generate test data`);
    console.log(`   GET  /api/latest - Latest reading`);
    console.log(`   GET  /api/readings - All readings`);
    console.log(`   GET  /api/stats - Statistics`);
    console.log('');
    console.log('⚠️  MQTT persistent connections are not supported in Vercel');
    console.log('✅ Use HTTP POST endpoints instead');
  });
} else {
  console.log('🔄 Running in Vercel serverless environment');
}

module.exports = app;
