-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'SUBMITTED', 'VERIFIED', 'REJECTED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SELLER';

-- AlterTable
ALTER TABLE "animal_listings" ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "hours" INTEGER,
ADD COLUMN     "workerCount" INTEGER DEFAULT 1;

-- AlterTable
ALTER TABLE "labour_listings" ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "availableTo" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "groupName" TEXT,
ADD COLUMN     "image" TEXT,
ADD COLUMN     "images" TEXT[],
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "leader" TEXT,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "pricePerHour" DOUBLE PRECISION,
ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videos" TEXT[];

-- AlterTable
ALTER TABLE "machinery_listings" ADD COLUMN     "ageYears" DOUBLE PRECISION,
ADD COLUMN     "availableFrom" TIMESTAMP(3),
ADD COLUMN     "availableTo" TIMESTAMP(3),
ADD COLUMN     "brand" TEXT,
ADD COLUMN     "features" TEXT[],
ADD COLUMN     "fuelType" TEXT,
ADD COLUMN     "horsePower" TEXT,
ADD COLUMN     "lat" DOUBLE PRECISION,
ADD COLUMN     "lng" DOUBLE PRECISION,
ADD COLUMN     "mileageHours" INTEGER,
ADD COLUMN     "ownerName" TEXT,
ADD COLUMN     "ownerPhone" TEXT,
ADD COLUMN     "pricePerAcre" DOUBLE PRECISION,
ADD COLUMN     "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "ratingCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "videos" TEXT[];

-- AlterTable
ALTER TABLE "order_items" ADD COLUMN     "sellerId" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "brand" TEXT,
ADD COLUMN     "countryOfOrigin" TEXT,
ADD COLUMN     "harvestDate" TEXT,
ADD COLUMN     "highlights" TEXT[],
ADD COLUMN     "manufacturer" TEXT,
ADD COLUMN     "minOrderQty" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "sellScope" TEXT NOT NULL DEFAULT 'district',
ADD COLUMN     "specifications" JSONB,
ADD COLUMN     "subcategory" TEXT,
ADD COLUMN     "taluka" TEXT,
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "village" TEXT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "businessType" TEXT,
ADD COLUMN     "gstNumber" TEXT,
ADD COLUMN     "gstOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kycStatus" "KycStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "profileCompletion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "taluka" TEXT,
ADD COLUMN     "village" TEXT;

-- CreateTable
CREATE TABLE "seller_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bankHolderName" TEXT,
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankIfsc" TEXT,
    "aadharNumber" TEXT,
    "panNumber" TEXT,
    "kycDocumentUrls" TEXT[],
    "kycVerifiedAt" TIMESTAMP(3),
    "kycRejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'HOME',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "flat" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "landmark" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_disease_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "growthStage" TEXT NOT NULL,
    "variety" TEXT,
    "fieldArea" TEXT,
    "symptoms" TEXT[],
    "imageCount" INTEGER NOT NULL DEFAULT 0,
    "overallRisk" INTEGER NOT NULL,
    "riskLevel" TEXT NOT NULL,
    "primaryDisease" TEXT NOT NULL,
    "confidenceScore" DOUBLE PRECISION NOT NULL,
    "diagnosisMethod" TEXT NOT NULL DEFAULT 'vision',
    "modelAgreement" BOOLEAN,
    "fullReport" JSONB NOT NULL,
    "weatherSnapshot" JSONB,
    "soilSnapshot" JSONB,
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crop_disease_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_conversations" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "summary" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "language" TEXT NOT NULL DEFAULT 'en',
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "isScanSession" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_messages" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'text',
    "structuredData" JSONB,
    "language" TEXT NOT NULL DEFAULT 'en',
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "modelUsed" TEXT,
    "ragUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "planner_tasks" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "crop" TEXT,
    "field" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'today',
    "icon" TEXT,
    "color" TEXT,
    "doneAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "planner_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disease_feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "predictedDisease" TEXT NOT NULL,
    "confirmedDisease" TEXT,
    "farmerAgreed" BOOLEAN NOT NULL,
    "confirmedBy" TEXT NOT NULL DEFAULT 'farmer_self',
    "expertNotes" TEXT,
    "usedForRetrain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disease_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "government_schemes" (
    "id" TEXT NOT NULL,
    "schemeCode" TEXT NOT NULL,
    "schemeName" TEXT NOT NULL,
    "schemeNameHi" TEXT,
    "schemeNameMr" TEXT,
    "ministry" TEXT,
    "type" TEXT NOT NULL,
    "state" TEXT,
    "description" TEXT NOT NULL,
    "benefitsSummary" TEXT NOT NULL,
    "eligibility" JSONB NOT NULL,
    "documentsReq" TEXT[],
    "applicationUrl" TEXT,
    "helpline" TEXT,
    "benefitAmount" DOUBLE PRECISION,
    "benefitType" TEXT NOT NULL,
    "deadline" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "fullText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "government_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheme_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'interested',
    "notes" TEXT,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheme_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "transcription" TEXT,
    "transcriptionConf" DOUBLE PRECISION,
    "responseText" TEXT,
    "audioInputUrl" TEXT,
    "audioOutputUrl" TEXT,
    "languageDetected" TEXT,
    "languageRequested" TEXT,
    "durationSeconds" DOUBLE PRECISION,
    "whisperModel" TEXT,
    "ttsVoice" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "veterinary_doctors" (
    "id" TEXT NOT NULL,
    "fullNameEn" TEXT NOT NULL,
    "fullNameMr" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "altPhone" TEXT,
    "email" TEXT,
    "profilePhoto" TEXT,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "addressLine1" TEXT,
    "village" TEXT,
    "taluka" TEXT,
    "district" TEXT,
    "state" TEXT NOT NULL DEFAULT 'Maharashtra',
    "pincode" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "registrationNumber" TEXT,
    "councilName" TEXT NOT NULL DEFAULT 'Maharashtra State Veterinary Council',
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "qualifications" JSONB NOT NULL DEFAULT '[]',
    "practiceType" TEXT NOT NULL DEFAULT 'clinic',
    "clinicName" TEXT,
    "clinicAddress" TEXT,
    "clinicPhotos" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "animalTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "availableDays" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startTime" TEXT,
    "endTime" TEXT,
    "emergencyAvailable" BOOLEAN NOT NULL DEFAULT false,
    "consultationFee" DOUBLE PRECISION,
    "visitFee" DOUBLE PRECISION,
    "feeNoteEn" TEXT,
    "feeNoteMr" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "verificationStatus" TEXT NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isListed" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "profileViews" INTEGER NOT NULL DEFAULT 0,
    "callClicks" INTEGER NOT NULL DEFAULT 0,
    "whatsappClicks" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "veterinary_doctors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_reviews" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmerName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctor_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weather_cache" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "weather_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_master" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameHi" TEXT NOT NULL,
    "nameMr" TEXT,
    "category" TEXT NOT NULL,
    "seasons" TEXT[],
    "maturityDays" INTEGER NOT NULL DEFAULT 120,
    "varieties" JSONB NOT NULL DEFAULT '[]',
    "seedRate" JSONB,
    "spacing" JSONB,
    "fertilizerSchedule" JSONB NOT NULL DEFAULT '[]',
    "irrigationSchedule" JSONB NOT NULL DEFAULT '[]',
    "commonPests" JSONB NOT NULL DEFAULT '[]',
    "commonDiseases" JSONB NOT NULL DEFAULT '[]',
    "harvestIndicators" TEXT[],
    "mspCommodityCode" TEXT,
    "agmarknetCode" TEXT,
    "kcInitial" DOUBLE PRECISION DEFAULT 0.4,
    "kcMid" DOUBLE PRECISION DEFAULT 1.0,
    "kcLate" DOUBLE PRECISION DEFAULT 0.6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crop_master_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "msp_rates" (
    "id" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "commodityHi" TEXT,
    "season" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "mspPrice" DOUBLE PRECISION NOT NULL,
    "previousYearMSP" DOUBLE PRECISION,
    "increasePercent" DOUBLE PRECISION,
    "bonusIfAny" DOUBLE PRECISION,
    "procurementAgency" TEXT,
    "procurementStartDate" TIMESTAMP(3),
    "procurementEndDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "msp_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mandi_prices" (
    "id" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "commodityHi" TEXT,
    "variety" TEXT,
    "market" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "minPrice" DOUBLE PRECISION NOT NULL,
    "maxPrice" DOUBLE PRECISION NOT NULL,
    "modalPrice" DOUBLE PRECISION NOT NULL,
    "arrivalQty" DOUBLE PRECISION,
    "priceDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'data.gov.in',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mandi_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_alerts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commodity" TEXT NOT NULL,
    "market" TEXT,
    "targetPrice" DOUBLE PRECISION NOT NULL,
    "condition" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "triggeredAt" TIMESTAMP(3),
    "notificationMethod" TEXT NOT NULL DEFAULT 'push',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soil_health_records" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fieldName" TEXT,
    "testDate" TIMESTAMP(3),
    "sampleId" TEXT,
    "nitrogen" DOUBLE PRECISION,
    "phosphorus" DOUBLE PRECISION,
    "potassium" DOUBLE PRECISION,
    "ph" DOUBLE PRECISION,
    "ec" DOUBLE PRECISION,
    "organicCarbon" DOUBLE PRECISION,
    "zinc" DOUBLE PRECISION,
    "iron" DOUBLE PRECISION,
    "manganese" DOUBLE PRECISION,
    "copper" DOUBLE PRECISION,
    "boron" DOUBLE PRECISION,
    "sulphur" DOUBLE PRECISION,
    "ratings" JSONB,
    "recommendations" JSONB,
    "inputMethod" TEXT NOT NULL DEFAULT 'manual',
    "scanImageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "soil_health_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pest_alerts" (
    "id" TEXT NOT NULL,
    "pest" TEXT NOT NULL,
    "pestHi" TEXT,
    "affectedCrops" TEXT[],
    "severity" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "districts" TEXT[],
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "radiusKm" DOUBLE PRECISION,
    "symptoms" JSONB NOT NULL DEFAULT '[]',
    "solutions" JSONB NOT NULL DEFAULT '{}',
    "triggerConditions" JSONB,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'auto',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pest_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_calendars" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "year" TEXT NOT NULL,
    "sowingDate" TIMESTAMP(3) NOT NULL,
    "maturityDays" INTEGER NOT NULL DEFAULT 120,
    "state" TEXT,
    "district" TEXT,
    "fieldName" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crop_calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_calendar_tasks" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleHi" TEXT,
    "description" TEXT,
    "descriptionHi" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'upcoming',
    "completedDate" TIMESTAMP(3),
    "weatherAdjusted" BOOLEAN NOT NULL DEFAULT false,
    "originalDate" TIMESTAMP(3),
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "crop_calendar_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "irrigation_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "crop" TEXT NOT NULL,
    "fieldName" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shouldIrrigate" BOOLEAN NOT NULL,
    "reason" TEXT,
    "reasonHi" TEXT,
    "waterAmount" TEXT,
    "bestTime" TEXT,
    "temp" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "rainfall" DOUBLE PRECISION,
    "rainForecast" DOUBLE PRECISION,
    "windSpeed" DOUBLE PRECISION,
    "cropStage" TEXT,
    "etcValue" DOUBLE PRECISION,
    "et0Value" DOUBLE PRECISION,
    "kcValue" DOUBLE PRECISION,
    "farmerAction" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "irrigation_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feature_flags" (
    "id" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "disabledReason" TEXT,
    "disabledAt" TIMESTAMP(3),
    "enabledAt" TIMESTAMP(3),
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_health_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "responseTimeMs" INTEGER,
    "payloadSizeBytes" INTEGER,
    "errorMessage" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_health_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "scanCount" INTEGER NOT NULL DEFAULT 0,
    "chatCount" INTEGER NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "totalCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "monthlyTokens" INTEGER NOT NULL DEFAULT 0,
    "monthlyCostUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_userId_key" ON "seller_profiles"("userId");

-- CreateIndex
CREATE INDEX "saved_addresses_userId_idx" ON "saved_addresses"("userId");

-- CreateIndex
CREATE INDEX "saved_addresses_userId_isDefault_idx" ON "saved_addresses"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "crop_disease_reports_userId_idx" ON "crop_disease_reports"("userId");

-- CreateIndex
CREATE INDEX "crop_disease_reports_userId_createdAt_idx" ON "crop_disease_reports"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "crop_disease_reports_cropType_idx" ON "crop_disease_reports"("cropType");

-- CreateIndex
CREATE INDEX "crop_disease_reports_pincode_idx" ON "crop_disease_reports"("pincode");

-- CreateIndex
CREATE INDEX "crop_disease_reports_riskLevel_idx" ON "crop_disease_reports"("riskLevel");

-- CreateIndex
CREATE INDEX "crop_disease_reports_conversationId_idx" ON "crop_disease_reports"("conversationId");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_idx" ON "ai_conversations"("userId");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_updatedAt_idx" ON "ai_conversations"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "ai_conversations_userId_isArchived_idx" ON "ai_conversations"("userId", "isArchived");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_idx" ON "ai_messages"("conversationId");

-- CreateIndex
CREATE INDEX "ai_messages_conversationId_createdAt_idx" ON "ai_messages"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "planner_tasks_userId_idx" ON "planner_tasks"("userId");

-- CreateIndex
CREATE INDEX "planner_tasks_userId_scheduledFor_idx" ON "planner_tasks"("userId", "scheduledFor");

-- CreateIndex
CREATE INDEX "disease_feedback_reportId_idx" ON "disease_feedback"("reportId");

-- CreateIndex
CREATE INDEX "disease_feedback_farmerAgreed_idx" ON "disease_feedback"("farmerAgreed");

-- CreateIndex
CREATE INDEX "disease_feedback_usedForRetrain_idx" ON "disease_feedback"("usedForRetrain");

-- CreateIndex
CREATE UNIQUE INDEX "disease_feedback_userId_reportId_key" ON "disease_feedback"("userId", "reportId");

-- CreateIndex
CREATE UNIQUE INDEX "government_schemes_schemeCode_key" ON "government_schemes"("schemeCode");

-- CreateIndex
CREATE INDEX "government_schemes_type_idx" ON "government_schemes"("type");

-- CreateIndex
CREATE INDEX "government_schemes_state_idx" ON "government_schemes"("state");

-- CreateIndex
CREATE INDEX "government_schemes_isActive_idx" ON "government_schemes"("isActive");

-- CreateIndex
CREATE INDEX "government_schemes_isActive_type_idx" ON "government_schemes"("isActive", "type");

-- CreateIndex
CREATE INDEX "scheme_applications_userId_idx" ON "scheme_applications"("userId");

-- CreateIndex
CREATE INDEX "scheme_applications_userId_status_idx" ON "scheme_applications"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "scheme_applications_userId_schemeId_key" ON "scheme_applications"("userId", "schemeId");

-- CreateIndex
CREATE INDEX "voice_sessions_userId_idx" ON "voice_sessions"("userId");

-- CreateIndex
CREATE INDEX "voice_sessions_userId_createdAt_idx" ON "voice_sessions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "voice_sessions_conversationId_idx" ON "voice_sessions"("conversationId");

-- CreateIndex
CREATE UNIQUE INDEX "veterinary_doctors_phone_key" ON "veterinary_doctors"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "veterinary_doctors_registrationNumber_key" ON "veterinary_doctors"("registrationNumber");

-- CreateIndex
CREATE INDEX "veterinary_doctors_isListed_ratingAverage_idx" ON "veterinary_doctors"("isListed", "ratingAverage" DESC);

-- CreateIndex
CREATE INDEX "veterinary_doctors_isListed_district_idx" ON "veterinary_doctors"("isListed", "district");

-- CreateIndex
CREATE INDEX "veterinary_doctors_verificationStatus_idx" ON "veterinary_doctors"("verificationStatus");

-- CreateIndex
CREATE INDEX "doctor_reviews_doctorId_createdAt_idx" ON "doctor_reviews"("doctorId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "doctor_reviews_doctorId_userId_key" ON "doctor_reviews"("doctorId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "weather_cache_cacheKey_key" ON "weather_cache"("cacheKey");

-- CreateIndex
CREATE INDEX "weather_cache_expiresAt_idx" ON "weather_cache"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "crop_master_name_key" ON "crop_master"("name");

-- CreateIndex
CREATE INDEX "crop_master_category_idx" ON "crop_master"("category");

-- CreateIndex
CREATE INDEX "msp_rates_season_year_idx" ON "msp_rates"("season", "year");

-- CreateIndex
CREATE UNIQUE INDEX "msp_rates_commodity_season_year_key" ON "msp_rates"("commodity", "season", "year");

-- CreateIndex
CREATE INDEX "mandi_prices_commodity_state_district_idx" ON "mandi_prices"("commodity", "state", "district");

-- CreateIndex
CREATE INDEX "mandi_prices_commodity_priceDate_idx" ON "mandi_prices"("commodity", "priceDate" DESC);

-- CreateIndex
CREATE INDEX "mandi_prices_expiresAt_idx" ON "mandi_prices"("expiresAt");

-- CreateIndex
CREATE INDEX "price_alerts_userId_idx" ON "price_alerts"("userId");

-- CreateIndex
CREATE INDEX "price_alerts_commodity_isActive_idx" ON "price_alerts"("commodity", "isActive");

-- CreateIndex
CREATE INDEX "soil_health_records_userId_idx" ON "soil_health_records"("userId");

-- CreateIndex
CREATE INDEX "soil_health_records_userId_createdAt_idx" ON "soil_health_records"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "pest_alerts_state_isActive_idx" ON "pest_alerts"("state", "isActive");

-- CreateIndex
CREATE INDEX "pest_alerts_isActive_validUntil_idx" ON "pest_alerts"("isActive", "validUntil");

-- CreateIndex
CREATE INDEX "crop_calendars_userId_isActive_idx" ON "crop_calendars"("userId", "isActive");

-- CreateIndex
CREATE INDEX "crop_calendar_tasks_calendarId_scheduledDate_idx" ON "crop_calendar_tasks"("calendarId", "scheduledDate");

-- CreateIndex
CREATE INDEX "crop_calendar_tasks_status_idx" ON "crop_calendar_tasks"("status");

-- CreateIndex
CREATE INDEX "irrigation_logs_userId_date_idx" ON "irrigation_logs"("userId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "feature_flags_featureKey_key" ON "feature_flags"("featureKey");

-- CreateIndex
CREATE INDEX "api_health_logs_source_timestamp_idx" ON "api_health_logs"("source", "timestamp" DESC);

-- CreateIndex
CREATE INDEX "api_health_logs_timestamp_idx" ON "api_health_logs"("timestamp");

-- CreateIndex
CREATE INDEX "ai_usage_userId_idx" ON "ai_usage"("userId");

-- CreateIndex
CREATE INDEX "ai_usage_userId_date_idx" ON "ai_usage"("userId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ai_usage_userId_date_key" ON "ai_usage"("userId", "date");

-- CreateIndex
CREATE INDEX "animal_listings_createdAt_idx" ON "animal_listings"("createdAt");

-- CreateIndex
CREATE INDEX "bookings_userId_status_idx" ON "bookings"("userId", "status");

-- CreateIndex
CREATE INDEX "bookings_machineryListingId_idx" ON "bookings"("machineryListingId");

-- CreateIndex
CREATE INDEX "bookings_labourListingId_idx" ON "bookings"("labourListingId");

-- CreateIndex
CREATE INDEX "bookings_startDate_endDate_idx" ON "bookings"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "bookings_createdAt_idx" ON "bookings"("createdAt");

-- CreateIndex
CREATE INDEX "cart_items_userId_idx" ON "cart_items"("userId");

-- CreateIndex
CREATE INDEX "chat_messages_chatId_createdAt_idx" ON "chat_messages"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "chats_sellerId_idx" ON "chats"("sellerId");

-- CreateIndex
CREATE INDEX "chats_buyerId_idx" ON "chats"("buyerId");

-- CreateIndex
CREATE INDEX "comment_likes_userId_idx" ON "comment_likes"("userId");

-- CreateIndex
CREATE INDEX "comments_postId_createdAt_idx" ON "comments"("postId", "createdAt");

-- CreateIndex
CREATE INDEX "comments_authorId_idx" ON "comments"("authorId");

-- CreateIndex
CREATE INDEX "direct_messages_receiverId_readAt_idx" ON "direct_messages"("receiverId", "readAt");

-- CreateIndex
CREATE INDEX "group_messages_groupId_createdAt_idx" ON "group_messages"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "groups_createdById_idx" ON "groups"("createdById");

-- CreateIndex
CREATE INDEX "labour_listings_status_idx" ON "labour_listings"("status");

-- CreateIndex
CREATE INDEX "labour_listings_lat_lng_idx" ON "labour_listings"("lat", "lng");

-- CreateIndex
CREATE INDEX "machinery_listings_category_idx" ON "machinery_listings"("category");

-- CreateIndex
CREATE INDEX "machinery_listings_status_idx" ON "machinery_listings"("status");

-- CreateIndex
CREATE INDEX "machinery_listings_status_category_idx" ON "machinery_listings"("status", "category");

-- CreateIndex
CREATE INDEX "machinery_listings_lat_lng_idx" ON "machinery_listings"("lat", "lng");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE INDEX "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_sellerId_idx" ON "order_items"("sellerId");

-- CreateIndex
CREATE INDEX "order_items_sellerId_orderId_idx" ON "order_items"("sellerId", "orderId");

-- CreateIndex
CREATE INDEX "orders_userId_status_idx" ON "orders"("userId", "status");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "otp_sessions_expiresAt_idx" ON "otp_sessions"("expiresAt");

-- CreateIndex
CREATE INDEX "post_bookmarks_userId_idx" ON "post_bookmarks"("userId");

-- CreateIndex
CREATE INDEX "post_likes_userId_idx" ON "post_likes"("userId");

-- CreateIndex
CREATE INDEX "posts_scope_district_idx" ON "posts"("scope", "district");

-- CreateIndex
CREATE INDEX "posts_createdAt_idx" ON "posts"("createdAt");

-- CreateIndex
CREATE INDEX "products_taluka_idx" ON "products"("taluka");

-- CreateIndex
CREATE INDEX "products_isActive_isFeatured_idx" ON "products"("isActive", "isFeatured");

-- CreateIndex
CREATE INDEX "products_isActive_rating_idx" ON "products"("isActive", "rating");

-- CreateIndex
CREATE INDEX "products_createdAt_idx" ON "products"("createdAt");

-- CreateIndex
CREATE INDEX "push_tokens_userId_idx" ON "push_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "reviews_productId_idx" ON "reviews"("productId");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_district_idx" ON "users"("district");

-- CreateIndex
CREATE INDEX "users_kycStatus_idx" ON "users"("kycStatus");

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_addresses" ADD CONSTRAINT "saved_addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_disease_reports" ADD CONSTRAINT "crop_disease_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_disease_reports" ADD CONSTRAINT "crop_disease_reports_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_conversations" ADD CONSTRAINT "ai_conversations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "planner_tasks" ADD CONSTRAINT "planner_tasks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disease_feedback" ADD CONSTRAINT "disease_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disease_feedback" ADD CONSTRAINT "disease_feedback_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "crop_disease_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_applications" ADD CONSTRAINT "scheme_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_applications" ADD CONSTRAINT "scheme_applications_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "government_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_sessions" ADD CONSTRAINT "voice_sessions_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "veterinary_doctors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_reviews" ADD CONSTRAINT "doctor_reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_alerts" ADD CONSTRAINT "price_alerts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "soil_health_records" ADD CONSTRAINT "soil_health_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_calendars" ADD CONSTRAINT "crop_calendars_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crop_calendar_tasks" ADD CONSTRAINT "crop_calendar_tasks_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "crop_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "irrigation_logs" ADD CONSTRAINT "irrigation_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

┌─────────────────────────────────────────────────────────┐
│  Update available 5.22.0 -> 7.7.0                       │
│                                                         │
│  This is a major update - please follow the guide at    │
│  https://pris.ly/d/major-version-upgrade                │
│                                                         │
│  Run the following to update                            │
│    npm i --save-dev prisma@latest                       │
│    npm i @prisma/client@latest                          │
└─────────────────────────────────────────────────────────┘
