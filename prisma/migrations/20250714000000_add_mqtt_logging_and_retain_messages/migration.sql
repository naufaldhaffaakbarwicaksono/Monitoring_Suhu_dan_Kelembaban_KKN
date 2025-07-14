-- CreateTable
CREATE TABLE "mqtt_message_logs" (
    "id" SERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "qos" INTEGER NOT NULL DEFAULT 0,
    "retain" BOOLEAN NOT NULL DEFAULT false,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "deviceId" TEXT,
    "messageType" TEXT,

    CONSTRAINT "mqtt_message_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retain_messages" (
    "id" SERIAL NOT NULL,
    "topic" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "qos" INTEGER NOT NULL DEFAULT 0,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deviceId" TEXT,

    CONSTRAINT "retain_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "mqtt_message_logs_topic_timestamp_idx" ON "mqtt_message_logs"("topic", "timestamp");

-- CreateIndex
CREATE INDEX "mqtt_message_logs_retain_processed_idx" ON "mqtt_message_logs"("retain", "processed");

-- CreateIndex
CREATE INDEX "mqtt_message_logs_deviceId_timestamp_idx" ON "mqtt_message_logs"("deviceId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "retain_messages_topic_key" ON "retain_messages"("topic");

-- CreateIndex
CREATE INDEX "retain_messages_topic_idx" ON "retain_messages"("topic");

-- CreateIndex
CREATE INDEX "retain_messages_deviceId_idx" ON "retain_messages"("deviceId");
