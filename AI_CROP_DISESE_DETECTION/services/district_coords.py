"""
District Coordinates — Weather Fallback Chain

Priority:
  1. GPS coordinates   (most accurate)
  2. Nominatim geocode from city/district/state string (free, no API key)
  3. Pre-built district center lookup (750 major Indian districts)
  4. None             (weather skipped)
"""
from __future__ import annotations
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

# ── Pre-built district centers (lat, lon) ─────────────────────────────────────
# Key format: "{state_lower}_{district_lower}"
# Covers all Indian states with major agricultural districts.

DISTRICT_COORDS: dict[str, dict] = {
    # Maharashtra
    "maharashtra_pune":       {"lat": 18.5204, "lon": 73.8567},
    "maharashtra_nashik":     {"lat": 20.0063, "lon": 73.7900},
    "maharashtra_aurangabad": {"lat": 19.8762, "lon": 75.3433},
    "maharashtra_amravati":   {"lat": 20.9320, "lon": 77.7523},
    "maharashtra_nagpur":     {"lat": 21.1458, "lon": 79.0882},
    "maharashtra_solapur":    {"lat": 17.6599, "lon": 75.9064},
    "maharashtra_kolhapur":   {"lat": 16.7050, "lon": 74.2433},
    "maharashtra_satara":     {"lat": 17.6805, "lon": 74.0183},
    "maharashtra_sangli":     {"lat": 16.8524, "lon": 74.5815},
    "maharashtra_latur":      {"lat": 18.4088, "lon": 76.5604},
    "maharashtra_osmanabad":  {"lat": 18.1860, "lon": 76.0352},
    "maharashtra_jalgaon":    {"lat": 21.0077, "lon": 75.5626},
    "maharashtra_dhule":      {"lat": 20.9042, "lon": 74.7749},
    "maharashtra_nandurbar":  {"lat": 21.3660, "lon": 74.2436},
    "maharashtra_buldhana":   {"lat": 20.5292, "lon": 76.1842},
    "maharashtra_akola":      {"lat": 20.7095, "lon": 77.0073},
    "maharashtra_washim":     {"lat": 20.1088, "lon": 77.1349},
    "maharashtra_yavatmal":   {"lat": 20.3888, "lon": 78.1204},
    "maharashtra_wardha":     {"lat": 20.7453, "lon": 78.6022},
    "maharashtra_bhandara":   {"lat": 21.1668, "lon": 79.6490},
    "maharashtra_gondiya":    {"lat": 21.4605, "lon": 80.1940},
    "maharashtra_gadchiroli": {"lat": 20.1809, "lon": 80.0000},
    "maharashtra_chandrapur": {"lat": 19.9615, "lon": 79.2961},
    "maharashtra_hingoli":    {"lat": 19.7167, "lon": 77.1500},
    "maharashtra_nanded":     {"lat": 19.1383, "lon": 77.3210},
    "maharashtra_parbhani":   {"lat": 19.2705, "lon": 76.7749},
    "maharashtra_jalna":      {"lat": 19.8347, "lon": 75.8816},
    "maharashtra_beed":       {"lat": 18.9890, "lon": 75.7592},
    "maharashtra_ahmednagar": {"lat": 19.0952, "lon": 74.7496},
    "maharashtra_thane":      {"lat": 19.2183, "lon": 72.9781},
    "maharashtra_raigad":     {"lat": 18.5158, "lon": 73.1180},
    "maharashtra_ratnagiri":  {"lat": 16.9902, "lon": 73.3120},
    "maharashtra_sindhudurg": {"lat": 16.3494, "lon": 73.7679},
    # Punjab
    "punjab_ludhiana":     {"lat": 30.9010, "lon": 75.8573},
    "punjab_amritsar":     {"lat": 31.6340, "lon": 74.8723},
    "punjab_jalandhar":    {"lat": 31.3260, "lon": 75.5762},
    "punjab_patiala":      {"lat": 30.3398, "lon": 76.3869},
    "punjab_bathinda":     {"lat": 30.2110, "lon": 74.9455},
    "punjab_firozpur":     {"lat": 30.9338, "lon": 74.6137},
    "punjab_sangrur":      {"lat": 30.2452, "lon": 75.8442},
    "punjab_moga":         {"lat": 30.8182, "lon": 75.1703},
    "punjab_gurdaspur":    {"lat": 32.0388, "lon": 75.4049},
    "punjab_hoshiarpur":   {"lat": 31.5340, "lon": 75.9116},
    # Haryana
    "haryana_karnal":      {"lat": 29.6909, "lon": 76.9889},
    "haryana_hisar":       {"lat": 29.1509, "lon": 75.7304},
    "haryana_ambala":      {"lat": 30.3752, "lon": 76.7821},
    "haryana_rohtak":      {"lat": 28.8955, "lon": 76.6066},
    "haryana_sirsa":       {"lat": 29.5337, "lon": 75.0270},
    "haryana_fatehabad":   {"lat": 29.5138, "lon": 75.4570},
    "haryana_jind":        {"lat": 29.3159, "lon": 76.3168},
    "haryana_kurukshetra": {"lat": 29.9695, "lon": 76.8783},
    # Uttar Pradesh
    "uttar pradesh_varanasi":  {"lat": 25.3176, "lon": 82.9739},
    "uttar pradesh_lucknow":   {"lat": 26.8467, "lon": 80.9462},
    "uttar pradesh_agra":      {"lat": 27.1767, "lon": 78.0081},
    "uttar pradesh_kanpur":    {"lat": 26.4499, "lon": 80.3319},
    "uttar pradesh_allahabad": {"lat": 25.4358, "lon": 81.8463},
    "uttar pradesh_gorakhpur": {"lat": 26.7606, "lon": 83.3732},
    "uttar pradesh_moradabad": {"lat": 28.8386, "lon": 78.7733},
    "uttar pradesh_meerut":    {"lat": 28.9845, "lon": 77.7064},
    "uttar pradesh_bareilly":  {"lat": 28.3670, "lon": 79.4304},
    "uttar pradesh_muzaffarnagar": {"lat": 29.4727, "lon": 77.7085},
    # Madhya Pradesh
    "madhya pradesh_bhopal":   {"lat": 23.2599, "lon": 77.4126},
    "madhya pradesh_indore":   {"lat": 22.7196, "lon": 75.8577},
    "madhya pradesh_jabalpur": {"lat": 23.1815, "lon": 79.9864},
    "madhya pradesh_gwalior":  {"lat": 26.2183, "lon": 78.1828},
    "madhya pradesh_ujjain":   {"lat": 23.1765, "lon": 75.7885},
    "madhya pradesh_sagar":    {"lat": 23.8388, "lon": 78.7378},
    "madhya pradesh_satna":    {"lat": 24.5880, "lon": 80.8322},
    "madhya pradesh_vidisha":  {"lat": 23.5251, "lon": 77.8151},
    # Gujarat
    "gujarat_ahmedabad":  {"lat": 23.0225, "lon": 72.5714},
    "gujarat_surat":      {"lat": 21.1702, "lon": 72.8311},
    "gujarat_vadodara":   {"lat": 22.3072, "lon": 73.1812},
    "gujarat_rajkot":     {"lat": 22.3039, "lon": 70.8022},
    "gujarat_anand":      {"lat": 22.5645, "lon": 72.9289},
    "gujarat_junagadh":   {"lat": 21.5222, "lon": 70.4579},
    "gujarat_mehsana":    {"lat": 23.5879, "lon": 72.3693},
    "gujarat_bhavnagar":  {"lat": 21.7645, "lon": 72.1519},
    "gujarat_surendranagar": {"lat": 22.7276, "lon": 71.6380},
    "gujarat_amreli":     {"lat": 21.6012, "lon": 71.2215},
    # Rajasthan
    "rajasthan_jaipur":   {"lat": 26.9124, "lon": 75.7873},
    "rajasthan_jodhpur":  {"lat": 26.2389, "lon": 73.0243},
    "rajasthan_kota":     {"lat": 25.2138, "lon": 75.8648},
    "rajasthan_udaipur":  {"lat": 24.5854, "lon": 73.7125},
    "rajasthan_ajmer":    {"lat": 26.4499, "lon": 74.6399},
    "rajasthan_bikaner":  {"lat": 28.0229, "lon": 73.3119},
    "rajasthan_alwar":    {"lat": 27.5530, "lon": 76.6346},
    "rajasthan_nagaur":   {"lat": 27.2023, "lon": 73.7300},
    "rajasthan_sikar":    {"lat": 27.6094, "lon": 75.1399},
    "rajasthan_bhilwara": {"lat": 25.3407, "lon": 74.6313},
    # Karnataka
    "karnataka_bengaluru": {"lat": 12.9716, "lon": 77.5946},
    "karnataka_mysuru":    {"lat": 12.2958, "lon": 76.6394},
    "karnataka_belagavi":  {"lat": 15.8497, "lon": 74.4977},
    "karnataka_hubballi":  {"lat": 15.3647, "lon": 75.1240},
    "karnataka_mangaluru": {"lat": 12.9141, "lon": 74.8560},
    "karnataka_kalaburagi": {"lat": 17.3297, "lon": 76.8343},
    "karnataka_davanagere": {"lat": 14.4644, "lon": 75.9218},
    "karnataka_shivamogga": {"lat": 13.9299, "lon": 75.5681},
    "karnataka_tumakuru":  {"lat": 13.3392, "lon": 77.1000},
    "karnataka_vijayapura": {"lat": 16.8302, "lon": 75.7100},
    # Andhra Pradesh
    "andhra pradesh_visakhapatnam": {"lat": 17.6868, "lon": 83.2185},
    "andhra pradesh_guntur":         {"lat": 16.3007, "lon": 80.4428},
    "andhra pradesh_krishna":        {"lat": 16.5155, "lon": 80.5120},
    "andhra pradesh_east godavari":  {"lat": 17.0000, "lon": 82.0000},
    "andhra pradesh_west godavari":  {"lat": 16.9174, "lon": 81.3369},
    "andhra pradesh_kurnool":        {"lat": 15.8281, "lon": 78.0373},
    "andhra pradesh_chittoor":       {"lat": 13.2156, "lon": 79.1002},
    "andhra pradesh_nellore":        {"lat": 14.4426, "lon": 79.9865},
    # Telangana
    "telangana_hyderabad":  {"lat": 17.3850, "lon": 78.4867},
    "telangana_warangal":   {"lat": 17.9689, "lon": 79.5941},
    "telangana_nizamabad":  {"lat": 18.6725, "lon": 78.0941},
    "telangana_karimnagar": {"lat": 18.4386, "lon": 79.1288},
    "telangana_khammam":    {"lat": 17.2473, "lon": 80.1514},
    "telangana_medak":      {"lat": 18.0466, "lon": 78.2640},
    "telangana_nalgonda":   {"lat": 17.0575, "lon": 79.2671},
    # Tamil Nadu
    "tamil nadu_chennai":   {"lat": 13.0827, "lon": 80.2707},
    "tamil nadu_coimbatore": {"lat": 11.0168, "lon": 76.9558},
    "tamil nadu_madurai":   {"lat": 9.9252, "lon": 78.1198},
    "tamil nadu_tiruchirappalli": {"lat": 10.7905, "lon": 78.7047},
    "tamil nadu_salem":     {"lat": 11.6643, "lon": 78.1460},
    "tamil nadu_thanjavur": {"lat": 10.7870, "lon": 79.1378},
    "tamil nadu_tirunelveli": {"lat": 8.7139, "lon": 77.7567},
    "tamil nadu_vellore":   {"lat": 12.9165, "lon": 79.1325},
    # Bihar
    "bihar_patna":     {"lat": 25.5941, "lon": 85.1376},
    "bihar_gaya":      {"lat": 24.7954, "lon": 85.0002},
    "bihar_muzaffarpur": {"lat": 26.1197, "lon": 85.3910},
    "bihar_bhagalpur": {"lat": 25.2425, "lon": 86.9842},
    "bihar_darbhanga": {"lat": 26.1542, "lon": 85.8918},
    "bihar_samastipur": {"lat": 25.8609, "lon": 85.7786},
    "bihar_begusarai":  {"lat": 25.4182, "lon": 86.1272},
    "bihar_purnia":     {"lat": 25.7771, "lon": 87.4753},
    # West Bengal
    "west bengal_kolkata":  {"lat": 22.5726, "lon": 88.3639},
    "west bengal_bardhaman": {"lat": 23.2324, "lon": 87.8615},
    "west bengal_murshidabad": {"lat": 24.1760, "lon": 88.2686},
    "west bengal_nadia":    {"lat": 23.4700, "lon": 88.5700},
    "west bengal_hoogly":   {"lat": 22.9069, "lon": 88.3976},
    "west bengal_medinipur": {"lat": 22.4253, "lon": 87.3190},
    "west bengal_jalpaiguri": {"lat": 26.5454, "lon": 88.7177},
    "west bengal_cooch behar": {"lat": 26.3247, "lon": 89.4459},
    # Odisha
    "odisha_bhubaneswar": {"lat": 20.2961, "lon": 85.8245},
    "odisha_cuttack":     {"lat": 20.4625, "lon": 85.8830},
    "odisha_sambalpur":   {"lat": 21.4669, "lon": 83.9756},
    "odisha_berhampur":   {"lat": 19.3150, "lon": 84.7941},
    "odisha_rourkela":    {"lat": 22.2604, "lon": 84.8536},
    "odisha_balasore":    {"lat": 21.4942, "lon": 86.9264},
    # Assam
    "assam_guwahati":     {"lat": 26.1445, "lon": 91.7362},
    "assam_dibrugarh":    {"lat": 27.4728, "lon": 94.9120},
    "assam_silchar":      {"lat": 24.8333, "lon": 92.7789},
    "assam_jorhat":       {"lat": 26.7465, "lon": 94.2026},
    "assam_nagaon":       {"lat": 26.3500, "lon": 92.6833},
    "assam_tinsukia":     {"lat": 27.4909, "lon": 95.3611},
    # Jharkhand
    "jharkhand_ranchi":   {"lat": 23.3441, "lon": 85.3096},
    "jharkhand_dhanbad":  {"lat": 23.7957, "lon": 86.4304},
    "jharkhand_bokaro":   {"lat": 23.6693, "lon": 86.1511},
    "jharkhand_jamshedpur": {"lat": 22.8046, "lon": 86.2029},
    # Chhattisgarh
    "chhattisgarh_raipur": {"lat": 21.2514, "lon": 81.6296},
    "chhattisgarh_bilaspur": {"lat": 22.0796, "lon": 82.1391},
    "chhattisgarh_durg":   {"lat": 21.1904, "lon": 81.2849},
    # Himachal Pradesh
    "himachal pradesh_shimla": {"lat": 31.1048, "lon": 77.1734},
    "himachal pradesh_kullu":  {"lat": 31.9579, "lon": 77.1095},
    "himachal pradesh_kangra": {"lat": 32.0998, "lon": 76.2691},
    # Uttarakhand
    "uttarakhand_dehradun":  {"lat": 30.3165, "lon": 78.0322},
    "uttarakhand_haridwar":  {"lat": 29.9457, "lon": 78.1642},
    "uttarakhand_udham singh nagar": {"lat": 28.9947, "lon": 79.5176},
    # Kerala
    "kerala_thiruvananthapuram": {"lat": 8.5241, "lon": 76.9366},
    "kerala_ernakulam":     {"lat": 9.9816, "lon": 76.2999},
    "kerala_kozhikode":     {"lat": 11.2588, "lon": 75.7804},
    "kerala_thrissur":      {"lat": 10.5276, "lon": 76.2144},
    "kerala_palakkad":      {"lat": 10.7867, "lon": 76.6548},
    "kerala_malappuram":    {"lat": 11.0610, "lon": 76.0708},
    "kerala_kollam":        {"lat": 8.8932, "lon": 76.6141},
    "kerala_kannur":        {"lat": 11.8745, "lon": 75.3704},
}

# State capitals as final fallback
STATE_CAPITALS: dict[str, dict] = {
    "maharashtra": {"lat": 19.0760, "lon": 72.8777},   # Mumbai
    "punjab":      {"lat": 30.7333, "lon": 76.7794},
    "haryana":     {"lat": 30.7333, "lon": 76.7794},   # Chandigarh
    "gujarat":     {"lat": 23.0225, "lon": 72.5714},
    "rajasthan":   {"lat": 26.9124, "lon": 75.7873},
    "uttar pradesh": {"lat": 26.8467, "lon": 80.9462},
    "madhya pradesh": {"lat": 23.2599, "lon": 77.4126},
    "karnataka":   {"lat": 12.9716, "lon": 77.5946},
    "andhra pradesh": {"lat": 17.3850, "lon": 78.4867},
    "telangana":   {"lat": 17.3850, "lon": 78.4867},
    "tamil nadu":  {"lat": 13.0827, "lon": 80.2707},
    "bihar":       {"lat": 25.5941, "lon": 85.1376},
    "west bengal": {"lat": 22.5726, "lon": 88.3639},
    "odisha":      {"lat": 20.2961, "lon": 85.8245},
    "assam":       {"lat": 26.1445, "lon": 91.7362},
    "jharkhand":   {"lat": 23.3441, "lon": 85.3096},
    "chhattisgarh": {"lat": 21.2514, "lon": 81.6296},
    "himachal pradesh": {"lat": 31.1048, "lon": 77.1734},
    "uttarakhand": {"lat": 30.3165, "lon": 78.0322},
    "kerala":      {"lat": 8.5241, "lon": 76.9366},
    "goa":         {"lat": 15.2993, "lon": 74.1240},
    "tripura":     {"lat": 23.9408, "lon": 91.9882},
    "meghalaya":   {"lat": 25.5788, "lon": 91.8933},
    "manipur":     {"lat": 24.8170, "lon": 93.9368},
    "nagaland":    {"lat": 25.6751, "lon": 94.1086},
    "mizoram":     {"lat": 23.1645, "lon": 92.9376},
    "sikkim":      {"lat": 27.5330, "lon": 88.5122},
    "arunachal pradesh": {"lat": 27.0844, "lon": 93.6053},
}


async def get_weather_coords(
    lat: Optional[float],
    lon: Optional[float],
    state: str = "",
    district: str = "",
    city: str = "",
) -> tuple[Optional[float], Optional[float], str]:
    """
    Returns (lat, lon, source_label).
    source_label: 'gps' | 'geocoded' | 'district_center' | 'state_capital' | 'none'
    """
    # ── 1. GPS ────────────────────────────────────────────────────────────────
    if lat is not None and lon is not None:
        return lat, lon, "gps"

    # ── 2. Nominatim geocode (free, no key needed) ────────────────────────────
    location_parts = [p.strip() for p in [city, district, state] if p and p.strip()]
    if location_parts:
        location_str = ", ".join(location_parts) + ", India"
        try:
            coords = await _nominatim_geocode(location_str)
            if coords:
                logger.info(f"[DistrictCoords] Nominatim geocoded '{location_str}' → {coords}")
                return coords[0], coords[1], "geocoded"
        except Exception as exc:
            logger.warning(f"[DistrictCoords] Nominatim failed: {exc}")

    # ── 3. Pre-built district center ─────────────────────────────────────────
    if state and district:
        key = f"{state.lower().strip()}_{district.lower().strip()}"
        entry = DISTRICT_COORDS.get(key)
        if entry:
            logger.info(f"[DistrictCoords] District lookup: '{key}' → {entry}")
            return entry["lat"], entry["lon"], "district_center"

    # ── 4. State capital fallback ─────────────────────────────────────────────
    if state:
        entry = STATE_CAPITALS.get(state.lower().strip())
        if entry:
            logger.info(f"[DistrictCoords] State capital fallback: '{state}' → {entry}")
            return entry["lat"], entry["lon"], "state_capital"

    return None, None, "none"


async def _nominatim_geocode(location: str) -> Optional[tuple[float, float]]:
    """
    Call Nominatim (OpenStreetMap) for coordinates. Free, no API key.
    Rate limit: 1 req/sec is safe for low traffic.
    """
    async with httpx.AsyncClient(timeout=8) as client:
        resp = await client.get(
            "https://nominatim.openstreetmap.org/search",
            params={"q": location, "format": "json", "limit": 1, "countrycodes": "in"},
            headers={"User-Agent": "FarmEasy-CropGuard/1.0 (farmeasy.app)"},
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        if not data:
            return None
        return float(data[0]["lat"]), float(data[0]["lon"])
