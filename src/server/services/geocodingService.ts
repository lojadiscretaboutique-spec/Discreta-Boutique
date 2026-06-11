import fetch from 'node-fetch';

export interface GeocodingResult {
  road: string;
  house_number: string;
  suburb: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  display_name?: string;
  provider: string;
}

export class GeocodingService {
  private static USER_AGENT = 'DiscretaBoutiqueApp/1.0 (contact: lojadiscretaboutique@gmail.com)';

  static async reverseGeocode(lat: number, lng: number): Promise<GeocodingResult | null> {
    console.log(`[GeocodingService] Reverse geocoding for ${lat}, ${lng}`);

    // Try Google first if available (already in server.ts but let's centralize)
    const googleResult = await this.tryGoogle(lat, lng);
    if (googleResult) return googleResult;

    // Fallback 1: Nominatim (OpenStreetMap)
    const nominatimResult = await this.tryNominatim(lat, lng);
    if (nominatimResult) return nominatimResult;

    // Fallback 2: Photon (Komoot)
    const photonResult = await this.tryPhoton(lat, lng);
    if (photonResult) return photonResult;

    return null;
  }

  private static async tryGoogle(lat: number, lng: number): Promise<GeocodingResult | null> {
    const apiKey = process.env.GOOGLE_MAPS_PLATFORM_KEY;
    if (!apiKey) return null;

    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=pt-BR`;
      const response = await fetch(url);
      if (!response.ok) return null;
      
      const data: any = await response.json();
      if (data.status !== 'OK' || !data.results || data.results.length === 0) return null;

      const result = data.results[0];
      const components = result.address_components;

      const getComponent = (type: string) => {
        return components.find((c: any) => c.types.includes(type))?.long_name || '';
      };

      return {
        road: getComponent('route'),
        house_number: getComponent('street_number'),
        suburb: getComponent('sublocality_level_1') || getComponent('sublocality') || getComponent('neighborhood'),
        city: getComponent('administrative_area_level_2'),
        state: getComponent('administrative_area_level_1'),
        postcode: getComponent('postal_code'),
        country: getComponent('country'),
        display_name: result.formatted_address,
        provider: 'google'
      };
    } catch (e) {
      console.error('[GeocodingService] Google error:', e);
      return null;
    }
  }

  private static async tryNominatim(lat: number, lng: number): Promise<GeocodingResult | null> {
    try {
      // OSM Nominatim
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=pt-BR`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': this.USER_AGENT,
          'Accept-Language': 'pt-BR'
        }
      });

      if (!response.ok) return null;
      const data: any = await response.json();
      
      if (!data.address) return null;

      const addr = data.address;
      return {
        road: addr.road || addr.pedestrian || addr.cycleway || addr.footway || addr.path || '',
        house_number: addr.house_number || '',
        suburb: addr.suburb || addr.neighbourhood || addr.quarter || addr.city_district || '',
        city: addr.city || addr.town || addr.municipality || addr.village || '',
        state: addr.state || '',
        postcode: addr.postcode || '',
        country: addr.country || 'Brasil',
        display_name: data.display_name,
        provider: 'nominatim'
      };
    } catch (e) {
      console.error('[GeocodingService] Nominatim error:', e);
      return null;
    }
  }

  private static async tryPhoton(lat: number, lng: number): Promise<GeocodingResult | null> {
    try {
      const url = `https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`;
      const response = await fetch(url);
      if (!response.ok) return null;
      const data: any = await response.json();

      if (!data.features || data.features.length === 0) return null;

      const properties = data.features[0].properties;
      return {
        road: properties.street || properties.name || '',
        house_number: properties.housenumber || '',
        suburb: properties.district || '',
        city: properties.city || '',
        state: properties.state || '',
        postcode: properties.postcode || '',
        country: properties.country || 'Brasil',
        display_name: properties.name,
        provider: 'photon'
      };
    } catch (e) {
      console.error('[GeocodingService] Photon error:', e);
      return null;
    }
  }
}
