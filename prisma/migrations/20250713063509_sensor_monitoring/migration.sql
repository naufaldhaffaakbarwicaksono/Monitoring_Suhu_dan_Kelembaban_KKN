-- CreateTable
CREATE TABLE "sensor_readings" (
    "id" SERIAL NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL,
    "humidity" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "location" TEXT DEFAULT 'Default Room',

    CONSTRAINT "sensor_readings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_averages" (
    "id" SERIAL NOT NULL,
    "date" DATE NOT NULL,
    "avg_temperature" DOUBLE PRECISION NOT NULL,
    "avg_humidity" DOUBLE PRECISION NOT NULL,
    "max_temperature" DOUBLE PRECISION NOT NULL,
    "min_temperature" DOUBLE PRECISION NOT NULL,
    "max_humidity" DOUBLE PRECISION NOT NULL,
    "min_humidity" DOUBLE PRECISION NOT NULL,
    "reading_count" INTEGER NOT NULL,

    CONSTRAINT "daily_averages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_averages_date_key" ON "daily_averages"("date");
