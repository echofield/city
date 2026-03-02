/**
 * Zone name → WGS84 (lat, lng) for NAVIGUER (Waze / Google Maps).
 * Paris arrondissements and common place names.
 */

export const ZONE_CENTROIDS: Record<string, [number, number]> = {
  "1er": [48.8606, 2.3376],
  "2e": [48.8698, 2.3417],
  "3e": [48.8642, 2.3614],
  "4e": [48.8558, 2.3563],
  "5e": [48.8447, 2.3469],
  "6e": [48.8534, 2.3333],
  "7e": [48.8560, 2.3015],
  "8e": [48.8738, 2.3083],
  "9e": [48.8720, 2.3428],
  "10e": [48.8804, 2.3567],
  "11e": [48.8574, 2.3795],
  "12e": [48.8412, 2.3955],
  "13e": [48.8323, 2.3656],
  "14e": [48.8331, 2.3264],
  "15e": [48.8422, 2.2988],
  "16e": [48.8634, 2.2767],
  "17e": [48.8834, 2.3214],
  "18e": [48.8925, 2.3442],
  "19e": [48.8817, 2.3822],
  "20e": [48.8647, 2.3986],
  Châtelet: [48.8606, 2.3469],
  Bastille: [48.8534, 2.3693],
  Montmartre: [48.8860, 2.3430],
  "Quartier Latin": [48.8486, 2.3442],
  Trocadéro: [48.8619, 2.2878],
  République: [48.8676, 2.3636],
  Nation: [48.8489, 2.3959],
  Bercy: [48.8394, 2.3872],
  "Porte de Versailles": [48.8322, 2.2865],
  "Gare du Nord": [48.8809, 2.3553],
  "Gare de Lyon": [48.8442, 2.3734],
  "Saint-Germain": [48.8540, 2.3342],
  Marais: [48.8574, 2.3614],
  Louvre: [48.8606, 2.3376],
  "La Défense": [48.8910, 2.2380],
  "Parc des Princes": [48.8414, 2.2530],
  "Stade de France": [48.9244, 2.3601],
  Villepinte: [48.9622, 2.5325],
};

/** Prefer Waze, fallback Google Maps. */
export function getNavUrl(zoneOrLabel: string): string {
  const normalized = Object.keys(ZONE_CENTROIDS).find(
    (k) => k.toLowerCase() === zoneOrLabel.toLowerCase() || zoneOrLabel.includes(k)
  );
  const key = normalized ?? Object.keys(ZONE_CENTROIDS).find((k) => zoneOrLabel.includes(k)) ?? "Châtelet";
  const [lat, lng] = ZONE_CENTROIDS[key];
  const waze = `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  return waze;
}

export function getGoogleMapsUrl(zoneOrLabel: string): string {
  const normalized = Object.keys(ZONE_CENTROIDS).find(
    (k) => k.toLowerCase() === zoneOrLabel.toLowerCase() || zoneOrLabel.includes(k)
  );
  const key = normalized ?? Object.keys(ZONE_CENTROIDS).find((k) => zoneOrLabel.includes(k)) ?? "Châtelet";
  const [lat, lng] = ZONE_CENTROIDS[key];
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}
