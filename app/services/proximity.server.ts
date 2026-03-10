export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Haversine formula — returns distance in miles
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 3959; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/** Normalise any unit system radius to miles */
export function getRadiusInMiles(radius: number, unitSystem: string): number {
  return unitSystem === "IMPERIAL" ? radius : radius * 0.621371;
}

export function isWithinRadius(
  storeLat: number,
  storeLng: number,
  customerLat: number,
  customerLng: number,
  radiusMiles: number,
): boolean {
  return (
    calculateDistance(storeLat, storeLng, customerLat, customerLng) <=
    radiusMiles
  );
}

/** Human-readable ETA based on distance */
export function estimateDeliveryTime(distanceMiles: number): string {
  if (distanceMiles <= 1) return "10–15 minutes";
  if (distanceMiles <= 2) return "15–25 minutes";
  if (distanceMiles <= 5) return "25–40 minutes";
  return "40–60 minutes";
}
