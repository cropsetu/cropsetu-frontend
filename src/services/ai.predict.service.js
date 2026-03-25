/**
 * AI Prediction Service — FarmEasy Krishi Raksha
 * Supports Google Gemini (free) and OpenAI GPT-4o (paid).
 * Gemini exposes an OpenAI-compatible endpoint so the same SDK works for both.
 *
 * Set GEMINI_API_KEY in .env for free usage (15 RPM / 1M tokens per day).
 * Get your free key at: https://aistudio.google.com/app/apikey
 */
import OpenAI from 'openai';
import fs from 'fs';
import { ENV } from '../config/env.js';

// Prefer Gemini (free) over OpenAI if both keys are present
let _client = null;
function getClient() {
  if (!_client) {
    if (ENV.GEMINI_API_KEY) {
      _client = new OpenAI({
        apiKey: ENV.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
    } else if (ENV.OPENAI_API_KEY) {
      _client = new OpenAI({ apiKey: ENV.OPENAI_API_KEY });
    } else {
      throw new Error('No AI key configured — set GEMINI_API_KEY (free) or OPENAI_API_KEY in .env');
    }
  }
  return _client;
}

function getModel() {
  // gemini-2.0-flash supports vision and is free tier
  return ENV.GEMINI_API_KEY ? 'gemini-2.0-flash' : 'gpt-4o';
}

// ─── Days After Sowing ────────────────────────────────────────────────────────
function calcDAS(sowingDate) {
  if (!sowingDate) return null;
  const sowing = new Date(sowingDate);
  const today = new Date();
  const diffMs = today - sowing;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

// ─── Image → base64 ───────────────────────────────────────────────────────────
function imageToBase64(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}

function getImageMimeType(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  return ext === 'png' ? 'image/png' : 'image/jpeg';
}

// ─── Build the comprehensive prompt ──────────────────────────────────────────
function buildSystemPrompt() {
  return `You are Dr. Krishi AI, an expert plant pathologist and agronomist with 25+ years of experience in Indian agriculture, specialising in Maharashtra. You have deep knowledge of:
- ICAR All India Crop Research disease thresholds and management protocols
- CIB&RC registered pesticides and their dosages
- ICAR-CRIDA agro-climatic zones and Maharashtra soil health
- IMD weather-disease correlation models
- NCIPM Integrated Pest Management guidelines
- Maharashtra State Dept of Agriculture recommendations

Your task: Analyse ALL provided parameters (weather, soil, crop details, field conditions, symptoms, and images) and provide a highly accurate, actionable crop disease prediction.

CRITICAL REQUIREMENTS:
1. Cross-reference ALL parameters together — weather × soil × growth stage × symptoms × image
2. Use ICAR disease threshold values (e.g., Blast: humidity >80% + temp 24-32°C + excess N)
3. Recommend only CIB&RC registered pesticides with exact registration numbers
4. Provide dosages per litre of water AND per acre
5. Account for Maharashtra-specific ICAR agro-climatic zone conditions
6. Consider PHI (Pre-Harvest Interval) for all pesticides
7. Flag resistance issues and suggest rotation chemicals

OUTPUT: Return ONLY valid JSON matching the schema provided. No extra text.`;
}

function buildUserPrompt(params) {
  const {
    pincode, cropType, growthStage, variety, sowingDate, fieldArea,
    irrigationMethod, lastIrrigatedDate, fertilizerType, prevCrop, waterQuality,
    soilPh, organicCarbon, nitrogenLevel, phosphorusLevel, potassiumLevel, soilMoisture,
    lastFungicideDate,
    symptoms,
    weather, soilData,
  } = params;

  const das = calcDAS(sowingDate);
  const daysSinceIrrigation = lastIrrigatedDate
    ? Math.round((new Date() - new Date(lastIrrigatedDate)) / 86400000)
    : null;
  const daysSinceFungicide = lastFungicideDate
    ? Math.round((new Date() - new Date(lastFungicideDate)) / 86400000)
    : null;

  const w = weather?.current || {};
  const forecast = weather?.forecast?.slice(0, 3) || [];
  const soil = soilData?.soil || {};

  return `## FARM ANALYSIS REQUEST

### 1. LOCATION & IDENTITY
- Pincode: ${pincode}
- District: ${soilData?.district || 'Unknown'}
- State: Maharashtra
- Agro-climatic Zone: ${soilData?.agroClimaticZone?.id || 'V'} — ${soilData?.agroClimaticZone?.name || ''}
- Coordinates: ${weather?.location?.lat}°N, ${weather?.location?.lon}°E

### 2. CROP DETAILS
- Crop: ${cropType}
- Variety: ${variety || 'Not specified'}
- Growth Stage: ${growthStage}
- Days After Sowing (DAS): ${das !== null ? das : 'Not provided'}
- Sowing Date: ${sowingDate || 'Not provided'}
- Field Area: ${fieldArea || '1'} acres
- Previous Crop: ${prevCrop || 'Not specified'}

### 3. CURRENT WEATHER (OpenWeatherMap Live Data)
- Temperature: ${w.temp || '?'}°C (feels like ${w.feelsLike || '?'}°C)
- Humidity: ${w.humidity || '?'}%
- Dew Point: ${w.dewPoint || '?'}°C
- Wind Speed: ${w.windSpeed || '?'} km/h
- Cloud Cover: ${w.cloudCover || '?'}%
- Weather: ${w.weatherDesc || '?'}

### 4. 3-DAY WEATHER FORECAST
${forecast.map((d, i) => `Day ${i + 1} (${d.date}): Temp ${d.tempMin}–${d.tempMax}°C | Humidity ${d.humidity}% | Rain ${d.rainfall}mm | Clouds ${d.cloudCover}%`).join('\n')}

Weather Risk Assessment: ${weather?.weatherRisk?.riskLevel || 'UNKNOWN'}
Risk Factors: ${(weather?.weatherRisk?.riskFactors || []).join('; ')}

### 5. SOIL PARAMETERS
- Soil Type: ${soil.soilType || soilData?.soil?.soilType || 'Black Cotton'}
- Soil Texture: ${soil.soilTexture || '?'}
- Zone avg pH: ${soil.soilPH?.avg || '7.5'}
- User-entered pH: ${soilPh || 'Not provided'}
- Organic Carbon: ${organicCarbon ? `${organicCarbon}% (user)` : `${soil.organicCarbon?.avg || 0.5}% (zone avg)`}
- Nitrogen: ${nitrogenLevel || soil.nitrogen?.status || 'Medium'}
- Phosphorus: ${phosphorusLevel || soil.phosphorus?.status || 'Medium'}
- Potassium: ${potassiumLevel || soil.potassium?.status || 'High'}
- Zinc: ${soil.zinc?.status || 'Deficient in 60-70% soils'}
- Soil Moisture: ${soilMoisture ? `${soilMoisture}%` : 'Not provided'}
- Water Holding Capacity: ${soil.waterHoldingCapacity || '?'}
- Drainage: ${soil.drainageStatus || '?'}
- Annual Rainfall: ${soil.annualRainfall || '?'}
- Zone Disease Pressure: ${(soilData?.historicalDiseasePressure?.[cropType?.toLowerCase()] || []).join(', ') || 'Refer general zone data'}

### 6. FIELD MANAGEMENT
- Irrigation Method: ${irrigationMethod || 'Not specified'}
- Days Since Last Irrigation: ${daysSinceIrrigation !== null ? daysSinceIrrigation : 'Not provided'}
- Fertilizer Type: ${fertilizerType || 'Not specified'}
- Water Source Quality: ${waterQuality || 'Good'}
- Days Since Last Fungicide: ${daysSinceFungicide !== null ? daysSinceFungicide : 'Not provided / First spray'}

### 7. REPORTED SYMPTOMS
${Array.isArray(symptoms) ? symptoms.join(', ') : (symptoms || 'None reported')}

### 8. ZONE DISEASE RISK FACTORS (from ICAR data)
${(soil.diseaseRiskFactors || []).join('\n')}

---

## REQUIRED JSON SCHEMA (return ONLY this JSON):
{
  "overallRisk": <0-100 integer>,
  "riskLevel": "<LOW|MODERATE|HIGH|CRITICAL>",
  "confidenceScore": <0-100 float>,
  "primaryDisease": {
    "name": "<disease name>",
    "scientificName": "<scientific name>",
    "probability": <0-100>,
    "severity": "<Low|Moderate|High|Critical>",
    "description": "<symptom description, 1-2 sentences>",
    "cause": "<pathogen type and favourable conditions>"
  },
  "diseases": [
    { "name": "<name>", "probability": <0-100>, "severity": "<Low|Moderate|High>" }
  ],
  "pesticides": [
    {
      "name": "<CIB&RC registered product name>",
      "activeIngredient": "<a.i. + concentration>",
      "dose": "<g or ml per litre water>",
      "dosePerAcre": "<per acre dose>",
      "timing": "<application timing and conditions>",
      "regNo": "<CIB&RC registration number if known>",
      "type": "<Fungicide|Bactericide|Insecticide|Miticide>",
      "phi": "<pre-harvest interval>",
      "resistanceGroup": "<FRAC/IRAC code if applicable>"
    }
  ],
  "fertilizers": [
    {
      "nutrient": "<nutrient name>",
      "product": "<fertilizer product>",
      "dose": "<dose per acre>",
      "method": "<soil application|foliar spray>",
      "timing": "<when to apply>",
      "reason": "<why needed based on soil data>"
    }
  ],
  "culturalControls": ["<action 1>", "<action 2>"],
  "immediateActions": ["<priority action 1>", "<priority action 2>"],
  "preventiveMeasures": ["<long-term measure 1>"],
  "weatherRisk": {
    "next3Days": "<weather risk summary>",
    "riskTrend": "<DECREASING|STABLE|INCREASING>"
  },
  "nutritionalDeficiencies": [
    { "nutrient": "<nutrient>", "symptom": "<visible sign>", "correction": "<remedy>" }
  ],
  "locationInfo": {
    "pincode": "${pincode}",
    "district": "${soilData?.district || '?'}",
    "zone": "Zone ${soilData?.agroClimaticZone?.id || '?'} — ${soilData?.agroClimaticZone?.name || ''}",
    "kvkContact": "${soilData?.kvkContact?.phone || 'Contact local KVK'}",
    "icarRegion": "ICAR-CRIDA ${soilData?.district || 'Maharashtra'}"
  },
  "analysisNotes": "<any important additional observations>"
}`;
}

// ─── Main prediction function ─────────────────────────────────────────────────
export async function predictCropDisease(params, imagePaths = []) {
  const client = getClient(); // throws if no key configured
  const model  = getModel();

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
  ];

  // Build user message — text + optional images
  const userContent = [];

  userContent.push({ type: 'text', text: buildUserPrompt(params) });

  // Attach up to 3 images
  for (const imgPath of imagePaths.slice(0, 3)) {
    try {
      const base64 = imageToBase64(imgPath);
      const mimeType = getImageMimeType(imgPath);
      userContent.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64}`,
          detail: 'high',
        },
      });
    } catch {
      // Skip unreadable images
    }
  }

  if (imagePaths.length > 0) {
    userContent.push({
      type: 'text',
      text: 'Please also analyse the crop images above for visible disease symptoms, lesion patterns, necrosis shape, discoloration, mold presence, insect damage etc. and incorporate image findings into your diagnosis.',
    });
  }

  messages.push({ role: 'user', content: userContent });

  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: 3000,
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  let rawContent = response.choices[0]?.message?.content || '{}';

  // Gemini sometimes wraps JSON in markdown code fences — strip them
  rawContent = rawContent.trim();
  if (rawContent.startsWith('```')) {
    rawContent = rawContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let result;
  try {
    result = JSON.parse(rawContent);
  } catch {
    throw new Error('AI returned invalid JSON response');
  }

  // Enrich with metadata
  result.meta = {
    model,
    imagesAnalysed: imagePaths.length,
    tokensUsed: response.usage?.total_tokens || 0,
    generatedAt: new Date().toISOString(),
    dataVersion: '1.0',
  };

  return result;
}
