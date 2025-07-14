# 🚀 Deployment Guide - Vercel

Panduan lengkap untuk mendeploy aplikasi Sensor Monitoring ke Vercel.

## ✅ Prerequisites

1. **Account Vercel** - Daftar di [vercel.com](https://vercel.com)
2. **Database PostgreSQL** - Gunakan [Supabase](https://supabase.com) (gratis)
3. **GitHub Repository** - Code harus di GitHub untuk auto-deployment

## 📋 Langkah-langkah Deployment

### 1. Setup Database (Supabase)

1. Buka [supabase.com](https://supabase.com) dan buat account
2. Klik "New Project"
3. Isi nama project dan password database
4. Tunggu project selesai dibuat
5. Pergi ke Settings → Database
6. Copy **Connection String** dalam format:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@[HOST]:6543/postgres
   ```

### 2. Prepare Code untuk Production

Pastikan file berikut sudah benar:

**vercel.json** ✅
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node"
    },
    {
      "src": "public/**",
      "use": "@vercel/static"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/index.js"
    },
    {
      "src": "/public/(.*)",
      "dest": "/public/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/api/index.js"
    }
  ],
  "functions": {
    "api/index.js": {
      "maxDuration": 30,
      "memory": 1024
    }
  },
  "buildCommand": "npm run build"
}
```

**package.json scripts** ✅
```json
{
  "scripts": {
    "build": "prisma generate && prisma migrate deploy",
    "vercel-build": "prisma generate && prisma migrate deploy"
  }
}
```

### 3. Deploy via GitHub (Recommended)

#### Step 1: Push ke GitHub
```bash
git add .
git commit -m "Ready for Vercel deployment"
git push origin main
```

#### Step 2: Import di Vercel
1. Login ke [vercel.com](https://vercel.com)
2. Klik "New Project"
3. Import repository dari GitHub
4. Select repository "sensor-monitoring"

#### Step 3: Configure Environment Variables
Di Vercel project settings, tambahkan:

**WAJIB:**
- `DATABASE_URL` = `[connection string dari Supabase]`

**OPSIONAL:**
- `MQTT_HOST` = `[mqtt broker host]`
- `MQTT_PORT` = `8883`
- `MQTT_USERNAME` = `[mqtt username]`
- `MQTT_PASSWORD` = `[mqtt password]`

#### Step 4: Deploy
1. Klik "Deploy"
2. Tunggu proses build selesai
3. Aplikasi akan tersedia di URL yang diberikan

### 4. Deploy via CLI (Alternative)

```bash
# Install Vercel CLI
npm install -g vercel

# Login ke Vercel
vercel login

# Deploy
vercel --prod

# Set environment variables (interaktif)
vercel env add DATABASE_URL
```

## 🔧 Post-Deployment

### 1. Test Deployment
Akses URL aplikasi dan pastikan:
- ✅ Dashboard loading dengan benar
- ✅ API endpoints berfungsi: `/api/health`
- ✅ Database connection berhasil: `/api/latest`

### 2. Setup Custom Domain (Optional)
1. Di Vercel project settings
2. Pergi ke Domains tab
3. Add custom domain

### 3. Monitor Logs
```bash
# Via CLI
vercel logs [deployment-url]

# Via Dashboard
# Buka Vercel dashboard → Project → Functions tab
```

## 🛠️ Troubleshooting

### ❌ Error: "Build failed"
**Solusi:**
```bash
# Update package.json
"scripts": {
  "vercel-build": "prisma generate && prisma migrate deploy"
}
```

### ❌ Error: "Database connection failed"
**Solusi:**
1. Cek `DATABASE_URL` di environment variables
2. Pastikan format connection string benar
3. Test koneksi dari local:
   ```bash
   npx prisma db push --preview-feature
   ```

### ❌ Error: "Module not found: mqtt"
**Solusi:**
1. Pastikan `mqtt` ada di `dependencies` (bukan `devDependencies`)
2. Update package.json:
   ```json
   {
     "dependencies": {
       "mqtt": "^5.13.2"
     }
   }
   ```

### ❌ Error: "Function timeout"
**Solusi:**
Update `vercel.json`:
```json
{
  "functions": {
    "api/index.js": {
      "maxDuration": 30,
      "memory": 1024
    }
  }
}
```

### ❌ Error: "Prisma generate failed"
**Solusi:**
```bash
# Local test
npm run build

# Jika berhasil, commit dan push ulang
git add .
git commit -m "Fix build script"
git push
```

## 📊 Monitoring Production

### Health Check
- URL: `https://your-app.vercel.app/api/health`
- Response: `{"status":"ok","timestamp":"..."}`

### API Endpoints
- `/api/latest` - Data sensor terbaru
- `/api/dashboard` - Data dashboard lengkap
- `/api/readings` - Historical data
- `/api/mqtt/status` - Status MQTT (serverless mode)

### Performance Monitoring
1. Vercel Dashboard → Analytics
2. Monitor response times dan error rates
3. Set up alerts untuk downtime

## 🔄 Continuous Deployment

Setelah setup awal, setiap push ke `main` branch akan otomatis:
1. Trigger build di Vercel
2. Run database migrations
3. Deploy update otomatis

```bash
# Workflow normal
git add .
git commit -m "Update feature"
git push origin main
# → Otomatis deploy ke production
```

## 🚨 Important Notes

1. **Serverless Limitations**: MQTT persistent connections tidak didukung
2. **Database Required**: Aplikasi memerlukan database connection untuk berfungsi
3. **Cold Start**: Fungsi pertama mungkin butuh waktu loading lebih lama
4. **Free Tier Limits**: Perhatikan limits Vercel dan Supabase

## 🎉 Success!

Jika semua langkah berhasil, aplikasi Anda sudah live di:
`https://your-project-name.vercel.app`

Dashboard akan menampilkan data sensor real-time dengan fallback ke database untuk environment serverless.
