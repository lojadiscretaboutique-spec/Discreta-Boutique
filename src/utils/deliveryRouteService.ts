/**
 * Service to calculate physical routes using OSRM (Open Source Routing Machine)
 * with a fallback to Haversine formula (straight-line distance) in case of failure.
 */

export function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the Earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  geometry?: any;
  isFallback: boolean;
}

export const deliveryRouteService = {
  async calculateRoute(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ): Promise<RouteResult> {
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
      );
      
      if (!response.ok) {
        throw new Error('OSRM API response not OK');
      }
      
      const data = await response.json();
      
      if (data && data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // OSRM returns distance in meters and duration in seconds
        const distanceKm = route.distance / 1000;
        const durationMinutes = route.duration / 60;
        const geometry = route.geometry; // GEOJson geometry to render path on Leaflet
        
        return {
          distanceKm,
          durationMinutes,
          geometry,
          isFallback: false
        };
      } else {
        throw new Error('No routes returned from OSRM');
      }
    } catch (e) {
      console.log('OSRM routing failed. Estimating route distance based on spatial data:', e);
      // Fallback: estimate actual road routing distance (usually ~1.35x of straight-line distance)
      const straightLine = getHaversineDistance(origin.lat, origin.lng, destination.lat, destination.lng);
      const distanceKm = straightLine * 1.35;
      // Fallback estimate: 2.5 minutes per km + 3 minutes base wait time
      const durationMinutes = distanceKm * 2.5 + 3;
      
      return {
        distanceKm,
        durationMinutes,
        isFallback: true
      };
    }
  }
};
