import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CloudFog,
  CloudRain,
  CloudSun,
  Compass,
  Monitor,
  RefreshCw,
  Sprout,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  formatTimeOfDay,
  getDayPhaseLabel,
  QUALITY_LABELS,
  QUALITY_TIERS,
  WEATHER_PRESETS,
  type BiomePreset,
  type CameraPreset,
  type GpuRenderInfo,
  type TerrariumSettings,
  type VesselStyle,
  type WeatherMode,
} from '../types/terrarium';

type DockTab = 'light' | 'weather' | 'flora' | 'vessel' | 'display';

interface ControlDockProps {
  settings: TerrariumSettings;
  gpuInfo: GpuRenderInfo | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onUpdate: (patch: Partial<TerrariumSettings>) => void;
  onSelectCamera: (preset: CameraPreset) => void;
  onReseed: () => void;
}

const WEATHER_OPTIONS: { id: WeatherMode; label: string; icon: typeof Sun }[] = [
  { id: 'clear', label: 'Clear', icon: Sun },
  { id: 'mist', label: 'Mist', icon: CloudFog },
  { id: 'rain', label: 'Rain', icon: CloudRain },
  { id: 'sunshower', label: 'Sunshower', icon: CloudSun },
];

const BIOME_OPTIONS: { id: BiomePreset; label: string }[] = [
  { id: 'fern_gully', label: 'Fern Gully' },
  { id: 'twilight_moss', label: 'Twilight Moss' },
  { id: 'arid_rosette', label: 'Arid Rosette' },
];

const VESSEL_OPTIONS: { id: VesselStyle; label: string }[] = [
  { id: 'bell', label: 'Bell Jar' },
  { id: 'geodesic', label: 'Geodesic' },
  { id: 'prism', label: 'Brass Prism' },
];

const CAMERA_OPTIONS: { id: CameraPreset; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'canopy', label: 'Canopy' },
  { id: 'moss_floor', label: 'Moss Floor' },
];

const TIME_PRESETS: { label: string; hour: number }[] = [
  { label: 'Dawn', hour: 6.2 },
  { label: 'Noon', hour: 12.5 },
  { label: 'Golden', hour: 17.6 },
  { label: 'Night', hour: 22.8 },
];

export function ControlDock({
  settings,
  gpuInfo,
  collapsed,
  onToggleCollapse,
  onUpdate,
  onSelectCamera,
  onReseed,
}: ControlDockProps) {
  const [activeTab, setActiveTab] = useState<DockTab>('light');

  return (
    <div
      className="fixed bottom-5 left-1/2 z-20 w-[min(780px,94vw)] -translate-x-1/2 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
      style={{
        transform: collapsed ? 'translate(-50%, calc(100% + 22px))' : 'translate(-50%, 0)',
      }}
    >
      {/* Attached Collapse / Expand Tab */}
      <div className="flex justify-center mb-1.5 pointer-events-auto">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Show controls (H)' : 'Hide controls (H)'}
          className="inline-flex items-center gap-1.5 rounded-t-lg border border-white/12 bg-[rgba(18,23,20,0.9)] px-3.5 py-1 text-xs font-medium text-[#d7ded3] hover:text-white hover:bg-[rgba(28,36,31,0.95)] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a8c69f] whitespace-nowrap shrink-0 cursor-pointer"
          style={{
            transform: collapsed ? 'translateY(-36px)' : 'translateY(0)',
          }}
        >
          {collapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          <span>{collapsed ? 'Show Controls' : 'Hide Controls'}</span>
        </button>
      </div>

      {/* Main Dock Surface (Solid/RGBA, zero backdrop-filter) */}
      <div className="pointer-events-auto rounded-xl border border-white/12 bg-[rgba(17,22,19,0.92)] shadow-[0_18px_48px_rgba(0,0,0,0.48)] px-4 py-3">
        {/* Top Row: Category Tabs + Global Quick Toggles */}
        <div className="flex items-center justify-between gap-3 pb-2.5 mb-2.5 border-b border-white/10">
          <div className="flex items-center gap-1" role="tablist" aria-label="Terrarium control sections">
            {(
              [
                { id: 'light', label: 'Lighting', icon: Sun },
                { id: 'weather', label: 'Weather', icon: CloudRain },
                { id: 'flora', label: 'Flora', icon: Sprout },
                { id: 'vessel', label: 'Vessel', icon: Compass },
                { id: 'display', label: 'Display', icon: Monitor },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#a8c69f] ${
                    isActive
                      ? 'bg-[#2a382e] text-[#eef3eb] border border-[#5f7d64]/50'
                      : 'text-[#9aa79c] hover:text-[#e3e9e0] hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Global Ambient Toggles (Sound + Auto Orbit) */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onUpdate({ autoOrbit: !settings.autoOrbit })}
              aria-pressed={settings.autoOrbit}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#a8c69f] ${
                settings.autoOrbit
                  ? 'bg-[#2a382e] text-[#dce8d5] border border-[#5f7d64]/50'
                  : 'text-[#9aa79c] hover:text-[#e3e9e0] hover:bg-white/5 border border-transparent'
              }`}
            >
              <Compass className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Orbit</span>
            </button>

            <button
              type="button"
              onClick={() => onUpdate({ audioEnabled: !settings.audioEnabled })}
              aria-pressed={settings.audioEnabled}
              aria-label={settings.audioEnabled ? 'Mute ambient sound' : 'Enable ambient sound'}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#a8c69f] ${
                settings.audioEnabled
                  ? 'bg-[#2a382e] text-[#dce8d5] border border-[#5f7d64]/50'
                  : 'text-[#9aa79c] hover:text-[#e3e9e0] hover:bg-white/5 border border-transparent'
              }`}
            >
              {settings.audioEnabled ? (
                <Volume2 className="w-3.5 h-3.5" />
              ) : (
                <VolumeX className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{settings.audioEnabled ? 'Sound On' : 'Sound Off'}</span>
            </button>
          </div>
        </div>

        {/* Active Panel Body (Compact single-row layout) */}
        {activeTab === 'light' && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-[220px]">
              <span className="font-mono-tabular text-xs text-[#dce4d8] w-24 shrink-0">
                {formatTimeOfDay(settings.timeOfDay)} · {getDayPhaseLabel(settings.timeOfDay)}
              </span>
              <input
                type="range"
                min={0}
                max={24}
                step={0.05}
                value={settings.timeOfDay}
                aria-label="Time of day"
                onChange={(e) => onUpdate({ timeOfDay: parseFloat(e.target.value), autoCycle: false })}
                className="terrarium-slider w-full"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {TIME_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => onUpdate({ timeOfDay: preset.hour, autoCycle: false })}
                  className="rounded-md px-2.5 py-1 text-xs font-medium text-[#b5c0b4] hover:text-white hover:bg-white/8 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
              <span className="h-4 w-px bg-white/10 mx-1" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onUpdate({ autoCycle: !settings.autoCycle })}
                aria-pressed={settings.autoCycle}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  settings.autoCycle
                    ? 'bg-[#364a3b] text-[#eef5eb]'
                    : 'text-[#9aa79c] hover:text-white hover:bg-white/8'
                }`}
              >
                Auto Cycle
              </button>
            </div>
          </div>
        )}

        {activeTab === 'weather' && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {WEATHER_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = settings.weather === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        onUpdate({
                          weather: opt.id,
                          ...WEATHER_PRESETS[opt.id],
                        })
                      }
                      aria-pressed={active}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#2e3e33] text-white border border-[#65846b]/50'
                          : 'text-[#a3b0a4] hover:text-white hover:bg-white/6 border border-transparent'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
              <span className="hidden sm:inline text-xs text-[#8f9c91] whitespace-nowrap">
                Interior Microclimate
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-0.5">
              {(
                [
                  { key: 'rainIntensity', label: 'Rain', value: settings.rainIntensity },
                  { key: 'mistIntensity', label: 'Mist', value: settings.mistIntensity },
                  { key: 'condensationIntensity', label: 'Glass Dew', value: settings.condensationIntensity },
                  { key: 'breeze', label: 'Breeze', value: settings.breeze },
                ] as const
              ).map((slider) => (
                <label key={slider.key} className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[#9aa79c] whitespace-nowrap">{slider.label}</span>
                    <span className="font-mono-tabular text-[#cfd8cc]">
                      {Math.round(slider.value * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.02}
                    value={slider.value}
                    aria-label={`${slider.label} intensity`}
                    onChange={(e) => onUpdate({ [slider.key]: parseFloat(e.target.value) })}
                    className="terrarium-slider w-full"
                  />
                </label>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'flora' && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              {BIOME_OPTIONS.map((opt) => {
                const active = settings.biome === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdate({ biome: opt.id })}
                    aria-pressed={active}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#2e3e33] text-white border border-[#65846b]/50'
                        : 'text-[#a3b0a4] hover:text-white hover:bg-white/6 border border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs text-[#9aa79c] whitespace-nowrap">Density</span>
              <input
                type="range"
                min={0.4}
                max={1}
                step={0.05}
                value={settings.lushness}
                aria-label="Flora density"
                onChange={(e) => onUpdate({ lushness: parseFloat(e.target.value) })}
                className="terrarium-slider w-24"
              />
              <button
                type="button"
                onClick={onReseed}
                className="inline-flex items-center gap-1.5 rounded-lg border border-white/14 bg-white/6 px-3 py-1.5 text-xs font-medium text-[#e4ece0] hover:bg-white/12 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reseed</span>
              </button>
            </div>
          </div>
        )}

        {activeTab === 'vessel' && (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#8f9c91] mr-1 whitespace-nowrap">Vessel</span>
              {VESSEL_OPTIONS.map((opt) => {
                const active = settings.vesselStyle === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdate({ vesselStyle: opt.id })}
                    aria-pressed={active}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#2e3e33] text-white border border-[#65846b]/50'
                        : 'text-[#a3b0a4] hover:text-white hover:bg-white/6 border border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[#8f9c91] mr-1 whitespace-nowrap">Camera</span>
              {CAMERA_OPTIONS.map((opt) => {
                const active = settings.cameraPreset === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSelectCamera(opt.id)}
                    aria-pressed={active}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#2e3e33] text-white border border-[#65846b]/50'
                        : 'text-[#a3b0a4] hover:text-white hover:bg-white/6 border border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'display' && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Graphics Quality Slider (Low -> Ultra) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#9aa79c] font-medium">Graphics</span>
                  <span className="font-mono-tabular text-[#eef3eb]">
                    {QUALITY_LABELS[settings.graphicsQuality]}
                    <span className="text-[#8f9c91] ml-1.5">
                      ·{' '}
                      {settings.graphicsQuality === 'low'
                        ? 'Shadows Off'
                        : settings.graphicsQuality === 'medium'
                          ? '1K Shadows'
                          : settings.graphicsQuality === 'high'
                            ? '2K Shadows'
                            : '4K Shadows'}
                    </span>
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={QUALITY_TIERS.indexOf(settings.graphicsQuality)}
                  aria-label="Graphics quality"
                  onChange={(e) =>
                    onUpdate({ graphicsQuality: QUALITY_TIERS[parseInt(e.target.value, 10)] })
                  }
                  className="terrarium-slider w-full"
                />
                <div className="flex justify-between text-[10px] text-[#7e8b80] font-mono-tabular">
                  {QUALITY_TIERS.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => onUpdate({ graphicsQuality: tier })}
                      className={`cursor-pointer hover:text-[#dce4d8] transition-colors ${
                        settings.graphicsQuality === tier ? 'text-[#dce4d8]' : ''
                      }`}
                    >
                      {QUALITY_LABELS[tier]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution Slider (Low -> Ultra) */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-[#9aa79c] font-medium">Resolution</span>
                  <span className="font-mono-tabular text-[#eef3eb]">
                    {QUALITY_LABELS[settings.resolutionQuality]}
                    {gpuInfo && (
                      <span className="text-[#8f9c91] ml-1.5">
                        · {gpuInfo.renderWidth}×{gpuInfo.renderHeight}
                      </span>
                    )}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={QUALITY_TIERS.indexOf(settings.resolutionQuality)}
                  aria-label="Render resolution"
                  onChange={(e) =>
                    onUpdate({ resolutionQuality: QUALITY_TIERS[parseInt(e.target.value, 10)] })
                  }
                  className="terrarium-slider w-full"
                />
                <div className="flex justify-between text-[10px] text-[#7e8b80] font-mono-tabular">
                  {QUALITY_TIERS.map((tier) => (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => onUpdate({ resolutionQuality: tier })}
                      className={`cursor-pointer hover:text-[#dce4d8] transition-colors ${
                        settings.resolutionQuality === tier ? 'text-[#dce4d8]' : ''
                      }`}
                    >
                      {QUALITY_LABELS[tier]}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {gpuInfo && (
              <div className="flex items-center justify-between text-[11px] text-[#839185] pt-0.5 border-t border-white/8">
                <span className="truncate">Device GPU · {gpuInfo.rendererName}</span>
                <span className="font-mono-tabular shrink-0 ml-3">
                  {gpuInfo.pixelRatio.toFixed(2)}× Scale
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
