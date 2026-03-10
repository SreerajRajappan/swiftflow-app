export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Geocode an address to coordinates.
 * Primary: Google Maps Geocoding API (server-side key)
 * Fallback: OpenStreetMap Nominatim (free)
 */
export async function geocodeAddress(
  address: string,
): Promise<Coordinates | null> {
  const google = await geocodeWithGoogle(address);
  if (google) return google;
  return geocodeWithNominatim(address);
}

async function geocodeWithGoogle(address: string): Promise<Coordinates | null> {
  // Use separate geocoding key if available, fallback to maps key
  const apiKey =
    process.env.GOOGLE_GEOCODING_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`;
    const res = await fetch(url);
    const data = (await res.json()) as {
      status: string;
      results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
    };

    if (data.status === "OK" && data.results[0]) {
      return data.results[0].geometry.location;
    }
  } catch (err) {
    console.error("[Geocoding] Google error:", err);
  }
  return null;
}

async function geocodeWithNominatim(
  address: string,
): Promise<Coordinates | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "SwiftFlow-ShopifyApp/1.0" },
    });
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;

    if (data?.[0]) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.error("[Geocoding] Nominatim error:", err);
  }
  return null;
}
