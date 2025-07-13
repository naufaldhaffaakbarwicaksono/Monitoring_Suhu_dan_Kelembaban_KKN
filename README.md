# Sensor Monitoring System

Sistem monitoring suhu dan kelembaban ruangan menggunakan Node.js, Express, Socket.IO, dan MQTT.

## Fitur

- Real-time monitoring suhu dan kelembaban
- Dashboard web yang responsif
- Integrasi MQTT untuk komunikasi sensor
- Database PostgreSQL dengan Prisma ORM
- Real-time updates menggunakan Socket.IO

## Teknologi yang Digunakan

- **Backend**: Node.js, Express.js
- **Database**: PostgreSQL dengan Prisma ORM
- **Real-time**: Socket.IO
- **IoT Communication**: MQTT
- **Frontend**: EJS, HTML, CSS, JavaScript

## Prerequisites

- Node.js (v14 atau lebih tinggi)
- PostgreSQL database
- MQTT broker

## Installation

1. Clone repository ini:
```bash
git clone <repository-url>
cd sensor-monitoring
```

2. Install dependencies:
```bash
npm install
```

3. Setup environment variables:
```bash
cp .env.example .env
```

4. Edit file `.env` dengan konfigurasi Anda:
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
