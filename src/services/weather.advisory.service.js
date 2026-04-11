/**
 * Weather Advisory Service
 * Generates actionable farming advisories from weather + soil data.
 * All advisories are bilingual (EN + HI).
 *
 * Advisory categories:
 *  - irrigation  : based on soil moisture + upcoming rain
 *  - spraying    : based on wind speed + rain probability
 *  - frost/heat  : temperature extremes
 *  - uv          : UV index fieldwork warning
 *  - storm       : thunderstorm/hail warning
 *  - harvest     : rain risk during harvest window
 */

// ── Advisory templates ─────────────────────────────────────────────────────────
const ADVISORIES = {
  irrigateToday: {
    id:       'irrigation',
    icon:     'water',
    color:    'orange',   // caution
    en: { title: 'Irrigate Today',          desc: 'Soil is dry and no rain expected. Water your crops now.' },
    hi: { title: 'आज सिंचाई करें',          desc: 'मिट्टी सूखी है और बारिश की उम्मीद नहीं। अभी सिंचाई करें।' },
  },
  skipIrrigation: {
    id:       'irrigation',
    icon:     'water-outline',
    color:    'green',    // safe
    en: { title: 'Skip Irrigation',         desc: 'Rain expected within 24h. Save water, skip watering.' },
    hi: { title: 'सिंचाई छोड़ें',            desc: '24 घंटे में बारिश संभव। पानी बचाएं, सिंचाई न करें।' },
  },
  avoidSpraying: {
    id:       'spraying',
    icon:     'cloud-upload',
    color:    'red',      // warning
    en: { title: 'Avoid Spraying',          desc: 'High wind or rain expected. Pesticide/fertilizer spraying not effective.' },
    hi: { title: 'छिड़काव न करें',          desc: 'तेज हवा या बारिश। कीटनाशक/उर्वरक छिड़काव प्रभावी नहीं होगा।' },
  },
  goodForSpraying: {
    id:       'spraying',
    icon:     'leaf',
    color:    'green',
    en: { title: 'Good for Spraying',       desc: 'Calm wind and clear sky. Ideal time for pesticide or fertilizer application.' },
    hi: { title: 'छिड़काव के लिए अच्छा',    desc: 'कम हवा और साफ आसमान। कीटनाशक/उर्वरक छिड़काव का उचित समय।' },
  },
  frostRisk: {
    id:       'frost',
    icon:     'snow',
    color:    'red',
    en: { title: 'Frost Risk Tonight',      desc: 'Temperature may drop below 5°C. Cover sensitive crops and seedlings.' },
    hi: { title: 'आज रात पाला पड़ सकता है', desc: 'तापमान 5°C से नीचे जा सकता है। नाजुक फसलें ढकें।' },
  },
  extremeHeat: {
    id:       'heat',
    icon:     'sunny',
    color:    'red',
    en: { title: 'Extreme Heat Warning',    desc: 'Max temp above 42°C. Protect crops, irrigate in evening, avoid fieldwork 11am–3pm.' },
    hi: { title: 'अत्यधिक गर्मी चेतावनी',  desc: 'तापमान 42°C से ऊपर। शाम को सिंचाई करें, 11–3 बजे खेत में न जाएं।' },
  },
  highUV: {
    id:       'uv',
    icon:     'sunny-outline',
    color:    'orange',
    en: { title: 'High UV — Limit Fieldwork', desc: 'UV index above 8. Avoid fieldwork 11am–3pm. Wear protective clothing.' },
    hi: { title: 'तेज धूप — सावधानी बरतें', desc: 'UV इंडेक्स 8 से ऊपर। 11–3 बजे खेत में काम न करें।' },
  },
  stormWarning: {
    id:       'storm',
    icon:     'thunderstorm',
    color:    'red',
    en: { title: 'Thunderstorm Warning',    desc: 'Thunderstorm expected. Secure equipment, stay indoors, delay harvesting.' },
    hi: { title: 'आंधी-तूफान की चेतावनी',  desc: 'तूफान आ सकता है। उपकरण सुरक्षित करें, घर के अंदर रहें।' },
  },
  harvestRisk: {
    id:       'harvest',
    icon:     'cut',
    color:    'orange',
    en: { title: 'Harvest Risk — Rain Coming', desc: 'Rain expected in 2 days. Harvest mature crops before rains if possible.' },
    hi: { title: 'कटाई का ख़तरा — बारिश आने वाली', desc: '2 दिन में बारिश। पकी फसल जल्दी काटें।' },
  },
  goodWeather: {
    id:       'general',
    icon:     'checkmark-circle',
    color:    'green',
    en: { title: 'Good Farming Weather',    desc: 'Pleasant conditions. Good time to inspect crops for pest and disease signs.' },
    hi: { title: 'खेती के लिए अच्छा मौसम', desc: 'मौसम अनुकूल है। कीट और बीमारी की जांच करने का अच्छा समय।' },
  },
  fungalRisk: {
    id:       'disease',
    icon:     'bug',
    color:    'red',
    en: { title: 'High Fungal Disease Risk', desc: 'Leaf wetness high + humid conditions. Apply fungicide. Check for blight, mildew.' },
    hi: { title: 'फंगल रोग का ख़तरा',       desc: 'पत्तियाँ गीली हैं। फफूंदनाशक का छिड़काव करें। झुलसा और फफूंदी जांचें।' },
  },
  lowVisibility: {
    id:       'visibility',
    icon:     'eye-off',
    color:    'orange',
    en: { title: 'Low Visibility — Fog/Haze', desc: 'Visibility below 2km. Delay spray operations and machinery movement.' },
    hi: { title: 'कम दृश्यता — कोहरा/धुंध',  desc: 'दृश्यता 2km से कम। छिड़काव और यंत्र संचालन रोकें।' },
  },
  highVPD: {
    id:       'vpd',
    icon:     'water-outline',
    color:    'orange',
    en: { title: 'High Crop Water Stress',   desc: 'Vapour pressure deficit is high. Crops are losing water fast. Irrigate soon.' },
    hi: { title: 'फसल पर जल तनाव अधिक',    desc: 'हवा बहुत शुष्क है, फसल तेज़ी से पानी खो रही है। जल्दी सिंचाई करें।' },
  },
  strongStorm: {
    id:       'cape',
    icon:     'flash',
    color:    'red',
    en: { title: 'Severe Storm Risk (CAPE High)', desc: 'Atmospheric instability very high. Strong thunderstorms, hail possible. Stay indoors.' },
    hi: { title: 'भारी तूफ़ान का ख़तरा',          desc: 'वायुमंडल बहुत अस्थिर है। तेज़ तूफ़ान और ओले पड़ सकते हैं। घर के अंदर रहें।' },
  },
  goodSolar: {
    id:       'solar',
    icon:     'sunny',
    color:    'green',
    en: { title: 'Excellent Solar Day',      desc: 'High sunshine hours today. Good for solar drying of crops and solar pump use.' },
    hi: { title: 'बेहतरीन धूप का दिन',      desc: 'आज अच्छी धूप है। फसल सुखाने और सोलर पंप के लिए उत्तम समय।' },
  },
  dewPointRisk: {
    id:       'dew',
    icon:     'thermometer',
    color:    'orange',
    en: { title: 'Dew Point Alert',          desc: 'Temperature near dew point. Condensation on crops increases disease risk at night.' },
    hi: { title: 'ओस बिंदु चेतावनी',         desc: 'तापमान ओस बिंदु के पास है। रात में फसल पर नमी से बीमारी का खतरा।' },
  },
};

function makeAdvisory(key, lang) {
  const a = ADVISORIES[key];
  return {
    id:    a.id,
    icon:  a.icon,
    color: a.color,
    ...(lang === 'hi' ? a.hi : a.en),
  };
}

/**
 * Generate farming advisories from weather + soil + agriculture data.
 *
 * @param {object} current        - current weather (from openMeteo)
 * @param {object} daily          - array of daily forecasts
 * @param {object} agriculture    - soil temperature + moisture + ET
 * @param {'en'|'hi'} lang
 * @returns {Array} advisories[]
 */
export function generateAdvisories(current, daily, agriculture, lang = 'en') {
  const advisories = [];
  const tomorrow   = daily?.[1] || daily?.[0];
  const today      = daily?.[0];

  // ── Severe storm via CAPE (highest priority) ──────────────────────────────
  if (current.cape != null && current.cape > 1000) {
    advisories.push(makeAdvisory('strongStorm', lang));
  } else if (current.isStorm || current.weatherCode >= 95) {
    advisories.push(makeAdvisory('stormWarning', lang));
  }

  // ── Frost risk (min temp tonight) ─────────────────────────────────────────
  if (daily?.[0]?.minTemp != null && daily[0].minTemp < 5) {
    advisories.push(makeAdvisory('frostRisk', lang));
  }

  // ── Extreme heat ──────────────────────────────────────────────────────────
  if (daily?.[0]?.maxTemp != null && daily[0].maxTemp > 42) {
    advisories.push(makeAdvisory('extremeHeat', lang));
  }

  // ── UV advisory ───────────────────────────────────────────────────────────
  if (daily?.[0]?.uvIndexMax != null && daily[0].uvIndexMax > 8) {
    advisories.push(makeAdvisory('highUV', lang));
  }

  // ── Irrigation advisory ───────────────────────────────────────────────────
  const rainProb24h = tomorrow?.precipitationProbability ?? 0;
  const surfaceMoisture = agriculture?.soilMoisture?.surface ?? null;

  if (rainProb24h > 60) {
    // Rain expected — skip irrigation
    advisories.push(makeAdvisory('skipIrrigation', lang));
  } else if (
    (surfaceMoisture != null && surfaceMoisture < 20) &&
    rainProb24h < 30
  ) {
    // Dry soil, no rain coming — irrigate
    advisories.push(makeAdvisory('irrigateToday', lang));
  }

  // ── Spraying advisory ─────────────────────────────────────────────────────
  const shouldAvoidSpraying =
    current.windSpeed > 15 ||           // wind > 15 km/h
    current.isRain ||                   // currently raining
    (tomorrow?.precipitationProbability ?? 0) > 40;  // rain likely tomorrow

  if (shouldAvoidSpraying) {
    advisories.push(makeAdvisory('avoidSpraying', lang));
  } else if (
    current.cloudCover < 40 &&
    current.windSpeed < 10 &&
    !current.isRain
  ) {
    advisories.push(makeAdvisory('goodForSpraying', lang));
  }

  // ── Harvest risk (rain in next 2 days) ────────────────────────────────────
  const twoDayRainProb = Math.max(
    daily?.[1]?.precipitationProbability ?? 0,
    daily?.[2]?.precipitationProbability ?? 0
  );
  if (twoDayRainProb > 50 && !advisories.some(a => a.id === 'storm')) {
    advisories.push(makeAdvisory('harvestRisk', lang));
  }

  // ── Fungal disease risk (leaf wetness high) ────────────────────────────────
  if (current.leafWetness != null && current.leafWetness > 60) {
    advisories.push(makeAdvisory('fungalRisk', lang));
  } else if (
    current.dewPoint != null &&
    current.temperature != null &&
    (current.temperature - current.dewPoint) < 3
  ) {
    advisories.push(makeAdvisory('dewPointRisk', lang));
  }

  // ── Low visibility ─────────────────────────────────────────────────────────
  if (current.visibility != null && current.visibility < 2) {
    advisories.push(makeAdvisory('lowVisibility', lang));
  }

  // ── High vapour pressure deficit → crop water stress ──────────────────────
  if (current.vapourPressureDeficit != null && current.vapourPressureDeficit > 2.0) {
    advisories.push(makeAdvisory('highVPD', lang));
  }

  // ── Good solar day ────────────────────────────────────────────────────────
  if (today?.sunshineDuration != null && today.sunshineDuration >= 8) {
    advisories.push(makeAdvisory('goodSolar', lang));
  }

  // ── Fallback: good weather ─────────────────────────────────────────────────
  if (advisories.length === 0) {
    advisories.push(makeAdvisory('goodWeather', lang));
  }

  return advisories;
}
