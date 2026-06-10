
export const parseGoogleGeocode = (data: any) => {
  if (!data.results || data.results.length === 0) return null;
  
  const result = data.results[0];
  const components = result.address_components;
  
  const getComponent = (type: string) => {
    return components.find((c: any) => c.types.includes(type))?.long_name || '';
  };
  
  return {
    road: getComponent('route'),
    house_number: getComponent('street_number'),
    suburb: getComponent('sublocality') || getComponent('neighborhood'),
    city: getComponent('administrative_area_level_2'),
    state: getComponent('administrative_area_level_1'),
    postcode: getComponent('postal_code'),
    country: getComponent('country')
  };
};

export const parseGoogleSearch = (data: any) => {
  if (!data.results || data.results.length === 0) return null;
  const result = data.results[0];
  return {
    lat: result.geometry.location.lat,
    lon: result.geometry.location.lng,
  };
};
