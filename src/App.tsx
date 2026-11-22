import { useCallback, useEffect, useRef, useState } from 'react';
import { TerrariumEngine } from './scene/TerrariumEngine';
import { AmbientAudioEngine } from './audio/AmbientAudio';
import { ControlDock } from './components/ControlDock';
import { SpeciesInspector } from './components/SpeciesInspector';
import {
  formatTimeOfDay,
  getDayPhaseLabel,
  INITIAL_SETTINGS,
  type CameraPreset,
  type GpuRenderInfo,
  type SpecimenInfo,
  type TerrariumSettings,
} from './types/terrarium';

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<TerrariumEngine | null>(null);
  const audioRef = useRef<AmbientAudioEngine | null>(null);

  const [settings, setSettings] = useState<TerrariumSettings>(INITIAL_SETTINGS);
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [selectedSpecimen, setSelectedSpecimen] = useState<SpecimenInfo | null>(null);
  const [contextLost, setContextLost] = useState(false);
  const [gpuInfo, setGpuInfo] = useState<GpuRenderInfo | null>(null);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const nightFactorRef = useRef(0);

  // Mount Three.js engine once in isolated container
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const audio = new AmbientAudioEngine();
    audioRef.current = audio;

    const engine = new TerrariumEngine(container, settingsRef.current, {
      onSelectSpecimen: (info) => setSelectedSpecimen(info),
      onTimeAdvance: (newTime) => {
        setSettings((prev) => ({ ...prev, timeOfDay: newTime }));
      },
      onContextLost: (lost) => setContextLost(lost),
      onNightFactorChange: (nightFactor) => {
        nightFactorRef.current = nightFactor;
        audio.updateAtmosphere(
          settingsRef.current.rainIntensity,
          settingsRef.current.mistIntensity,
          settingsRef.current.breeze,
          nightFactor
        );
      },
      onGpuInfoChange: (info) => setGpuInfo(info),
    });
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
      audio.dispose();
      audioRef.current = null;
    };
  }, []);

  // Push setting updates to engine & audio without remounting WebGL
  useEffect(() => {
    engineRef.current?.updateSettings(settings);
    audioRef.current?.setEnabled(settings.audioEnabled);
    audioRef.current?.updateAtmosphere(
      settings.rainIntensity,
      settings.mistIntensity,
      settings.breeze,
      nightFactorRef.current
    );
  }, [settings]);

  // Keyboard shortcut 'H' for Zen Mode (hide/show controls)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((c) => !c);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleUpdate = useCallback((patch: Partial<TerrariumSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleSelectCamera = useCallback((preset: CameraPreset) => {
    setSettings((prev) => ({ ...prev, cameraPreset: preset }));
    engineRef.current?.triggerCameraPreset(preset);
  }, []);

  const handleReseed = useCallback(() => {
    setSelectedSpecimen(null);
    setSettings((prev) => ({
      ...prev,
      seed: Math.floor(1000 + Math.random() * 89000),
    }));
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-[#121614]">
      {/* Isolated Full-Viewport WebGL Mount */}
      <div
        ref={mountRef}
        className="absolute inset-0 w-full h-full"
        aria-label="Interactive 3D Glass Terrarium Viewport"
      />

      {/* Top-Left Minimal Brand Title & Quiet Unboxed Metadata */}
      <header className="pointer-events-none fixed top-5 left-6 z-10">
        <h1 className="font-display text-2xl font-medium tracking-tight text-[#f0f4ec]">
          Verdant
        </h1>
        <p className="mt-0.5 text-xs text-[#aab7aa] flex items-center gap-1.5">
          <span>Glass Terrarium</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-tabular">
            {formatTimeOfDay(settings.timeOfDay)} {getDayPhaseLabel(settings.timeOfDay)}
          </span>
          <span aria-hidden="true">·</span>
          <span>Click flora to inspect</span>
        </p>
      </header>

      {/* Specimen Inspector Caption (only visible when user clicks a plant/fixture) */}
      <SpeciesInspector
        specimen={selectedSpecimen}
        onDismiss={() => setSelectedSpecimen(null)}
      />

      {/* WebGL Context Lost Graceful Fallback */}
      {contextLost && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#121614]/95 text-center p-6">
          <div className="max-w-sm">
            <h2 className="font-display text-xl text-[#f0f4ec]">Graphics Context Paused</h2>
            <p className="mt-2 text-sm text-[#aab7aa]">
              The 3D viewport is recovering its graphics context. Reload the page if the scene does not resume shortly.
            </p>
          </div>
        </div>
      )}

      {/* Collapsible Bottom Control Dock */}
      <ControlDock
        settings={settings}
        gpuInfo={gpuInfo}
        collapsed={dockCollapsed}
        onToggleCollapse={() => setDockCollapsed((c) => !c)}
        onUpdate={handleUpdate}
        onSelectCamera={handleSelectCamera}
        onReseed={handleReseed}
      />
    </main>
  );
}
