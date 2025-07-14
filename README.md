# 🌡️ Sensor Monitoring - MQTT Serverless Edition

Sistem monitoring suhu dan kelembaban real-time menggunakan **MQTT Serverless** dengan **Vercel** dan **Supabase**. Implementasi ini menggunakan teknik **retain message** untuk meminimalisir penggunaan listener dan memastikan data persistence dalam environment serverless.

## ✨ Features

### 🚀 MQTT Serverless Architecture
- **Retain Message System**: Menyimpan pesan MQTT dengan flag retain untuk quick access
- **Automatic Data Recovery**: Memulihkan retain messages saat serverless function cold start
- **Unlimited Historical Data**: Akses data lampau tanpa batas waktu
- **Message Logging**: Log semua pesan MQTT untuk audit dan recovery

### 📊 Real-time Dashboard
- **Live Sensor Data**: Temperature dan humidity real-time
- **Interactive Charts**: Grafik data dengan berbagai periode waktu
- **MQTT Status Monitoring**: Monitor koneksi dan retain messages
- **Data Source Indicator**: Menampilkan sumber data (Retain/Database)

### 🔧 Advanced Features
- **Multi-device Support**: Support multiple sensor devices
- **Responsive Design**: Optimized untuk desktop dan mobile
- **Data Analytics**: Statistik dan tren data sensor
- **Manual Recovery**: Button untuk manual data recovery

## 🏗️ Architecture

```
ESP32/IoT Device → MQTT Broker → Vercel Serverless → Supabase Database
                                       ↓
                                Retain Messages Cache
                                       ↓
                                 Web Dashboard
```

## 🚀 Quick Start

### 1. Clone Repository
```bash
git clone [repository-url]
cd sensor-monitoring
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
```bash
cp .env.example .env
# Edit .env dengan konfigurasi Anda
```

### 4. Database Setup
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:deploy
```

### 5. Development
```bash
npm run dev
```

### 6. Test MQTT Service
```bash
npm run mqtt:test
```
```
DATABASE_URL="postgresql://username:password@localhost:5432/sensor_monitoring"
MQTT_HOST="your-mqtt-broker-host"
MQTT_PORT=1883
MQTT_USERNAME="your-mqtt-username"
MQTT_PASSWORD="your-mqtt-password"
PORT=3000
```

5. Generate Prisma client dan jalankan migrations:
```bash
npm run db:generate
npm run db:migrate
```

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

### Database Commands
```bash
# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate

# Deploy migrations (production)
npm run db:deploy

# Open Prisma Studio
npm run db:studio

# Check database health
npm run db:health
```

## API Endpoints

- `GET /` - Dashboard utama
- `GET /api/readings` - Mendapatkan data sensor readings
- `GET /api/daily-averages` - Mendapatkan rata-rata harian

## Project Structure

```
├── app.js                 # Main application file
├── database-access.js     # Database access layer
├── db-health-check.js     # Database health checker
├── lib/
│   └── prisma.js         # Prisma client configuration
├── prisma/
│   ├── schema.prisma     # Database schema
│   └── migrations/       # Database migrations
├── public/               # Static files (CSS, JS, icons)
├── views/                # EJS templates
├── bin/                  # Scripts and utilities
└── archive/              # Archived files and documentation
```

## Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.
