/**
 * Besant Technologies - Velachery, Chennai.
 * Only allow attendance link access when user is within this area.
 */

// Velachery, Chennai - approximate center (Besant Technologies)
const VELACHERY_CENTER = { lat: 12.9698, lng: 80.2206 };
// Radius in km - adjust if needed (e.g. 0.5 = campus only, 1–2 = nearby)
const ALLOWED_RADIUS_KM = Number(process.env.ATTENDANCE_LOCATION_RADIUS_KM) || 1;

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function isWithinVelachery(lat, lng) {
  if (lat == null || lng == null || typeof lat !== 'number' || typeof lng !== 'number') {
    return { allowed: false, reason: 'Location (latitude and longitude) is required.' };
  }
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return { allowed: false, reason: 'Invalid location coordinates.' };
  }
  const distance = haversineDistanceKm(
    VELACHERY_CENTER.lat,
    VELACHERY_CENTER.lng,
    lat,
    lng
  );
  const allowed = distance <= ALLOWED_RADIUS_KM;
  return {
    allowed,
    reason: allowed
      ? null
      : `Attendance is only allowed at Besant Technologies, Velachery, Chennai. You are outside the allowed area (${distance.toFixed(1)} km away).`,
    distanceKm: Math.round(distance * 10) / 10
  };
}

export function getLocationFromRequest(req) {
  const lat = parseFloat(req.query?.lat ?? req.body?.lat);
  const lng = parseFloat(req.query?.lng ?? req.body?.lng);
  return { lat, lng };
}
