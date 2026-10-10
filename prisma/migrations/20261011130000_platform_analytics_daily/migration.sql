CREATE TABLE "platform_analytics_daily" (
    "id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "metricKey" TEXT NOT NULL,
    "metricValue" BIGINT NOT NULL DEFAULT 0,

    CONSTRAINT "platform_analytics_daily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_analytics_daily_date_metricKey_key" ON "platform_analytics_daily"("date", "metricKey");
