"""
Weather Service — Open-Meteo (free, no API key required)
Fetches current conditions + 7-day forecast + agriculture variables.
"""
from __future__ import annotations
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)


_CURRENT_VARS = (
    "temperature_2m,relative_humidity_2m,apparent_temperature,"
    "precipitation,wind_speed_10m,cloud_cover,weather_code,"
    "dew_point_2m,vapour_pressure_deficit,et0_fao_evapotranspiration"
)
_DAILY_VARS = (
    "temperature_2m_max,temperature_2m_min,precipitation_sum,"
    "relative_humidity_2m_max,relative_humidity_2m_min,wind_speed_10m_max,"
    "precipitation_probability_max,weather_code"
)
_HOURLY_SOIL = (
    "soil_temperature_0cm,soil_temperature_6cm,"
    "soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm"
)

WEATHER_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
    80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
}


def _risk_from_weather(current: dict, daily: list[dict]) -> dict:
    """Derive a basic disease-risk flag from raw weather data."""
    temp   = current.get("temperature_2m", 20)
    rh     = current.get("relative_humidity_2m", 60)
    vpd    = current.get("vapour_pressure_deficit", 1.0)
    precip = current.get("precipitation", 0)

    risk_factors = []
    if rh > 80 and 15 <= temp <= 30:
        risk_factors.append(f"High humidity ({rh}%) + warm temp favours fungal disease")
    if rh > 90:
        risk_factors.append("Critical humidity (>90%) — leaf wetness risk")
    if precip > 0:
        risk_factors.append("Recent precipitation — splash dispersal risk for bacteria/fungi")
    if vpd < 0.4:
        risk_factors.append("Low VPD — high leaf wetness duration")
    if temp > 35 and rh < 40:
        risk_factors.append("High temp + dry conditions — spider mite risk")

    # Check 3-day forecast for upcoming rain
    rain_days = sum(1 for d in daily[:3] if d.get("precipitation_sum", 0) > 2)
    if rain_days >= 2:
        risk_factors.append(f"Rain forecast {rain_days}/3 days — sustained disease-favourable window")

    if len(risk_factors) >= 3 or rh > 90:
        risk_level = "HIGH"
    elif len(risk_factors) >= 2 or rh > 80:
        risk_level = "MODERATE"
    elif risk_factors:
        risk_level = "LOW"
    else:
        risk_level = "LOW"

    return {"risk_level": risk_level, "risk_factors": risk_factors}


async def fetch_weather(latitude: float, longitude: float) -> Optional[dict]:
    """
    Returns a structured weather dict or None on failure.
    """
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": _CURRENT_VARS,
        "daily": _DAILY_VARS,
        "hourly": _HOURLY_SOIL,
        "timezone": "Asia/Kolkata",
        "forecast_days": 7,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            raw = resp.json()

        current_raw = raw.get("current", {})
        daily_raw   = raw.get("daily", {})
        hourly_raw  = raw.get("hourly", {})

        # Build daily forecast list
        dates    = daily_raw.get("time", [])
        daily_list = []
        for i, date in enumerate(dates):
            daily_list.append({
                "date": date,
                "temp_max":  daily_raw.get("temperature_2m_max",  [None]*10)[i],
                "temp_min":  daily_raw.get("temperature_2m_min",  [None]*10)[i],
                "rainfall":  daily_raw.get("precipitation_sum",   [0]*10)[i],
                "humidity_max": daily_raw.get("relative_humidity_2m_max", [None]*10)[i],
                "humidity_min": daily_raw.get("relative_humidity_2m_min", [None]*10)[i],
                "wind_max":  daily_raw.get("wind_speed_10m_max",  [None]*10)[i],
                "rain_prob": daily_raw.get("precipitation_probability_max", [0]*10)[i],
                "weather_code": daily_raw.get("weather_code", [0]*10)[i],
                "weather_desc": WEATHER_CODES.get(daily_raw.get("weather_code", [0]*10)[i], "Unknown"),
            })

        current = {
            "temperature":          current_raw.get("temperature_2m"),
            "humidity":             current_raw.get("relative_humidity_2m"),
            "apparent_temperature": current_raw.get("apparent_temperature"),
            "precipitation":        current_raw.get("precipitation", 0),
            "wind_speed":           current_raw.get("wind_speed_10m"),
            "cloud_cover":          current_raw.get("cloud_cover"),
            "weather_code":         current_raw.get("weather_code", 0),
            "weather_desc":         WEATHER_CODES.get(current_raw.get("weather_code", 0), "Unknown"),
            "dew_point":            current_raw.get("dew_point_2m"),
            "vpd":                  current_raw.get("vapour_pressure_deficit"),
            "evapotranspiration":   current_raw.get("et0_fao_evapotranspiration"),
        }

        # Latest soil readings (index 0 = current hour)
        soil = {
            "temperature_surface": (hourly_raw.get("soil_temperature_0cm") or [None])[0],
            "temperature_6cm":     (hourly_raw.get("soil_temperature_6cm") or [None])[0],
            "moisture_0_1cm":      (hourly_raw.get("soil_moisture_0_to_1cm") or [None])[0],
            "moisture_1_3cm":      (hourly_raw.get("soil_moisture_1_to_3cm") or [None])[0],
            "moisture_3_9cm":      (hourly_raw.get("soil_moisture_3_to_9cm") or [None])[0],
        }

        weather_risk = _risk_from_weather(current_raw, daily_list)

        return {
            "location": {"latitude": latitude, "longitude": longitude},
            "current": current,
            "daily_forecast": daily_list,
            "soil": soil,
            "weather_risk": weather_risk,
        }

    except Exception as exc:
        logger.warning(f"[WeatherService] Failed to fetch weather: {exc}")
        return None
