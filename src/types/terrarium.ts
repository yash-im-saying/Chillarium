export type VesselStyle = 'bell' | 'geodesic' | 'prism';

export type WeatherMode = 'clear' | 'mist' | 'rain' | 'sunshower';

export type BiomePreset = 'fern_gully' | 'twilight_moss' | 'arid_rosette';

export type CameraPreset = 'overview' | 'canopy' | 'moss_floor';

export type QualityTier = 'low' | 'medium' | 'high' | 'ultra';

export const QUALITY_TIERS: QualityTier[] = ['low', 'medium', 'high', 'ultra'];

export const QUALITY_LABELS: Record<QualityTier, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  ultra: 'Ultra',
};

export interface GpuRenderInfo {
  rendererName: string;
  isSoftwareGl: boolean;
  pixelRatio: number;
  renderWidth: number;
  renderHeight: number;
}

export interface SpecimenInfo {
  id: string;
  commonName: string;
  scientificName: string;
  category: 'Flora' | 'Fungi' | 'Mineral' | 'Fixture';
  note: string;
}

export interface TerrariumSettings {
  vesselStyle: VesselStyle;
  biome: BiomePreset;
  weather: WeatherMode;
  rainIntensity: number; // 0.0..1.0
  mistIntensity: number; // 0.0..1.0
  condensationIntensity: number; // 0.0..1.0
  timeOfDay: number; // 0..24 hours (e.g., 10.5 = 10:30 AM)
  autoCycle: boolean;
  lushness: number; // 0.4..1.0
  breeze: number; // 0.0..1.0
  autoOrbit: boolean;
  cameraPreset: CameraPreset;
  audioEnabled: boolean;
  graphicsQuality: QualityTier;
  resolutionQuality: QualityTier;
  seed: number;
}

export const WEATHER_PRESETS: Record<
  WeatherMode,
  { rainIntensity: number; mistIntensity: number; condensationIntensity: number }
> = {
  clear: { rainIntensity: 0, mistIntensity: 0.04, condensationIntensity: 0 },
  mist: { rainIntensity: 0, mistIntensity: 0.78, condensationIntensity: 0.68 },
  rain: { rainIntensity: 0.8, mistIntensity: 0.28, condensationIntensity: 0.85 },
  sunshower: { rainIntensity: 0.48, mistIntensity: 0.16, condensationIntensity: 0.45 },
};

export const INITIAL_SETTINGS: TerrariumSettings = {
  vesselStyle: 'bell',
  biome: 'fern_gully',
  weather: 'clear',
  ...WEATHER_PRESETS.clear,
  timeOfDay: 9.75, // Morning golden-fresh light
  autoCycle: false,
  lushness: 0.85,
  breeze: 0.45,
  autoOrbit: false,
  cameraPreset: 'overview',
  audioEnabled: false,
  graphicsQuality: 'high',
  resolutionQuality: 'high',
  seed: 4201,
};

export function formatTimeOfDay(hours: number): string {
  const normalized = ((hours % 24) + 24) % 24;
  const h = Math.floor(normalized);
  const m = Math.floor((normalized - h) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function getDayPhaseLabel(hours: number): string {
  const h = ((hours % 24) + 24) % 24;
  if (h >= 5 && h < 7.5) return 'Dawn';
  if (h >= 7.5 && h < 11.5) return 'Morning';
  if (h >= 11.5 && h < 16.5) return 'Midday';
  if (h >= 16.5 && h < 19.5) return 'Golden Hour';
  if (h >= 19.5 && h < 21.5) return 'Dusk';
  return 'Night';
}
