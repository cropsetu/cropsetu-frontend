/**
 * Weather Service — FarmEasy Krishi Raksha
 * Uses Open-Meteo (https://open-meteo.com) — completely FREE, no API key needed.
 * Uses Nominatim (OpenStreetMap) for pincode → coordinates — also FREE.
 *
 * Replaces OpenWeatherMap so OPENWEATHER_API_KEY is no longer required.
 */
import axios from 'axios';

const OPEN_METEO  = 'https://api.open-meteo.com/v1';
const NOMINATIM   = 'https://nominatim.openstreetmap.org';

// ─── WMO Weather Interpretation Code → human description ─────────────────────
function wmoDesc(code) {
  if (code === 0)              return 'clear sky';
  if (code <= 3)               return 'partly cloudy';
  if (code <= 48)              return 'foggy';
  if (code <= 55)              return 'drizzle';
  if (code <= 65)              return 'rain';
  if (code <= 77)              return 'snow';
  if (code <= 82)              return 'rain showers';
  if (code <= 86)              return 'snow showers';
  if (code >= 95)              return 'thunderstorm';
  return 'overcast';
}

// ─── Pincode → Coordinates ────────────────────────────────────────────────────
// Primary: Nominatim (OpenStreetMap geocoding — free, no key)
// Fallback: hardcoded Maharashtra district centres
async function pincodeToCoords(pincode) {
  try {
    const { data } = await axios.get(`${NOMINATIM}/search`, {
      params: { postalcode: pincode, country: 'IN', format: 'json', limit: 1 },
      headers: { 'User-Agent': 'FarmEasy/1.0' },
      timeout: 6000,
    });
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        name: data[0].display_name.split(',')[0].trim(),
      };
    }
  } catch { /* fall through to hardcoded */ }

  // Hardcoded Maharashtra fallback keyed by first 3 digits of pincode
  const fallback = {
    '413': { lat: 17.68, lon: 75.28, name: 'Solapur' },
    '411': { lat: 18.52, lon: 73.86, name: 'Pune' },
    '400': { lat: 19.07, lon: 72.87, name: 'Mumbai' },
    '422': { lat: 19.99, lon: 73.79, name: 'Nashik' },
    '431': { lat: 19.87, lon: 75.34, name: 'Aurangabad' },
    '440': { lat: 21.14, lon: 79.09, name: 'Nagpur' },
    '416': { lat: 16.70, lon: 74.24, name: 'Kolhapur' },
    '415': { lat: 17.00, lon: 74.30, name: 'Sangli' },
    '425': { lat: 21.00, lon: 74.74, name: 'Dhule' },
    '444': { lat: 20.59, lon: 78.12, name: 'Amravati' },
    '423': { lat: 20.55, lon: 74.38, name: 'Malegaon' },
    '414': { lat: 19.08, lon: 75.01, name: 'Ahmednagar' },
    '432': { lat: 20.00, lon: 76.14, name: 'Jalna' },
    '431': { lat: 19.87, lon: 75.34, name: 'Chhatrapati Sambhajinagar' },
  };
  const prefix = String(pincode).slice(0, 3);
  return fallback[prefix] || { lat: 18.52, lon: 73.86, name: 'Maharashtra' };
}

// ─── Magnus formula for dew point ─────────────────────────────────────────────
function calcDewPoint(tempC, humidity) {
  const a = 17.27, b = 237.7;
  const alpha = ((a * tempC) / (b + tempC)) + Math.log(humidity / 100);
  return Math.round((b * alpha) / (a - alpha) * 10) / 10;
}

// ─── Disease risk assessment ───────────────────────────────────────────────────
function assessWeatherRisk(current, forecast) {
  const risks = [];
  const next3 = forecast.slice(0, 3);

  const avgHumidity = next3.reduce((a, b) => a + b.humidity, 0) / next3.length;
  const avgTemp     = next3.reduce((a, b) => a + b.tempAvg,  0) / next3.length;
  const totalRain   = next3.reduce((a, b) => a + b.rainfall, 0);
  const highCloudDays = next3.filter((d) => d.cloudCover > 70).length;

  if (avgHumidity > 80 && avgTemp >= 24 && avgTemp <= 32) {
    risks.push('HIGH fungal disease risk — humidity >80% + temp 24–32°C ideal for Blast/Blight sporulation');
  } else if (avgHumidity > 70) {
    risks.push('MODERATE fungal disease risk — elevated humidity favours mildew and rust');
  }
  if (totalRain > 20) {
    risks.push('Heavy rainfall — risk of waterlogging, root rot, and splash-dispersed diseases');
  } else if (totalRain > 5) {
    risks.push('Moderate rainfall — conditions favour bacterial blight spread');
  }
  if (highCloudDays >= 2) risks.push('Extended cloud cover — reduced UV, increased leaf wetness duration');
  if (current.windSpeed > 30) risks.push('High wind speed — spore dispersal risk elevated');

  const riskLevel =
    risks.some((r) => r.startsWith('HIGH')) ? 'HIGH' :
    risks.length > 1 ? 'MODERATE' : 'LOW';

  return {
    riskLevel,
    riskFactors: risks,
    avgHumidity: Math.round(avgHumidity),
    avgTemp: Math.round(avgTemp),
    totalRainfall3Days: totalRain,
    leafWetnessPeriod: avgHumidity > 75 ? 'PROLONGED (>8 hrs/day)' : 'NORMAL (<6 hrs/day)',
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export async function getWeatherData(pincode) {
  const coords = await pincodeToCoords(pincode);

  const { data } = await axios.get(`${OPEN_METEO}/forecast`, {
    params: {
      latitude:  coords.lat,
      longitude: coords.lon,
      current: [
        'temperature_2m', 'relative_humidity_2m', 'apparent_temperature',
        'wind_speed_10m', 'weather_code', 'cloud_cover',
        'surface_pressure', 'dew_point_2m',
      ].join(','),
      daily: [
        'temperature_2m_max', 'temperature_2m_min',
        'precipitation_sum', 'weather_code',
        'relative_humidity_2m_max', 'cloud_cover_mean',
      ].join(','),
      forecast_days:   5,
      timezone:        'Asia/Kolkata',
      wind_speed_unit: 'kmh',
    },
    timeout: 10000,
  });

  const c = data.current;
  const current = {
    temp:        Math.round(c.temperature_2m),
    tempMin:     Math.round(c.temperature_2m),
    tempMax:     Math.round(c.temperature_2m),
    feelsLike:   Math.round(c.apparent_temperature),
    humidity:    c.relative_humidity_2m,
    pressure:    Math.round(c.surface_pressure),
    windSpeed:   Math.round(c.wind_speed_10m),
    windDeg:     0,
    cloudCover:  c.cloud_cover,
    visibility:  10,
    weatherMain: wmoDesc(c.weather_code),
    weatherDesc: wmoDesc(c.weather_code),
    uvIndex:     null,
    dewPoint:    Math.round((c.dew_point_2m ?? calcDewPoint(c.temperature_2m, c.relative_humidity_2m)) * 10) / 10,
    timestamp:   new Date().toISOString(),
  };

  const d = data.daily;
  const forecast = d.time.map((date, i) => ({
    date,
    tempMin:    Math.round(d.temperature_2m_min[i]),
    tempMax:    Math.round(d.temperature_2m_max[i]),
    tempAvg:    Math.round((d.temperature_2m_min[i] + d.temperature_2m_max[i]) / 2),
    humidity:   d.relative_humidity_2m_max?.[i] ?? 60,
    rainfall:   Math.round((d.precipitation_sum[i] || 0) * 10) / 10,
    cloudCover: Math.round(d.cloud_cover_mean?.[i] || 0),
    description: wmoDesc(d.weather_code[i]),
  }));

  const weatherRisk = assessWeatherRisk(current, forecast);

  return {
    location: { pincode, name: coords.name, lat: coords.lat, lon: coords.lon },
    current,
    forecast,
    weatherRisk,
    fetchedAt: new Date().toISOString(),
  };
}
