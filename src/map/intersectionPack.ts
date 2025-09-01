let PACK: {signals: Array<{lat: number; lon: number}>} | null = null;

export async function loadIntersectionPack(url?: string) {
  try {
    if (url) {
      const res = await fetch(url);
      if (res.ok) {
        PACK = await res.json();
        return PACK;
      }
    }
  } catch {}
  PACK = require('./packs/sample_pack.json');
  return PACK;
}

export function nearestSignalAhead(
  location?: {lat: number; lon: number},
  heading?: number,
  radiusMeters: number = 220,
) {
  if (!location || !PACK) return null;
  let best = null as any;
  let bestD = Infinity;
  for (const s of PACK.signals) {
    const d = haversine(location.lat, location.lon, s.lat, s.lon);
    if (d < radiusMeters && d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best ? {...best, dist: bestD} : null;
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
