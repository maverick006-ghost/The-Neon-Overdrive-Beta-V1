/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Volume2, VolumeX, Globe, Sparkles, Eye } from 'lucide-react';
import {
  GameWorld,
  WORLD_CONFIGS,
  VehicleId,
  VEHICLE_CONFIGS,
} from '../game/types';

interface StartScreenProps {
  highScore: number;
  selectedWorld: GameWorld;
  onSelectWorld: (world: GameWorld) => void;
  selectedVehicle: VehicleId;
  onSelectVehicle: (vehicle: VehicleId) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
  onOpenInspector: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  highScore,
  selectedWorld,
  onSelectWorld,
  selectedVehicle,
  onSelectVehicle,
  isMuted,
  onToggleMute,
  onStart,
  onOpenInspector,
}) => {
  const worlds: GameWorld[] = ['MOON', 'EARTH', 'MARS'];
  const vehicles: VehicleId[] = ['AERO_X', 'CYBER_GT', 'NEON_CYCLE'];

  const activeWorldConfig = WORLD_CONFIGS[selectedWorld];
  const activeVehicleConfig = VEHICLE_CONFIGS[selectedVehicle] || VEHICLE_CONFIGS['AERO_X'];

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 sm:p-6 md:p-8 z-20 font-sans select-none bg-gradient-to-b from-[#080808]/90 via-transparent to-[#080808]/95 overflow-y-auto">
      {/* 1. Minimal Top Navigation */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between pointer-events-auto shrink-0 pt-1">
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-mono tracking-[0.25em] text-[#b8bcc1] uppercase font-semibold">
            NEON OVERDRIVE
          </span>
          <span className="text-[#333333]">/</span>
          <span className="text-[10px] font-mono tracking-[0.18em] text-[#38bdf8] uppercase">
            {activeVehicleConfig.name}
          </span>
          <span className="hidden sm:inline text-[9px] font-mono tracking-widest text-[#555555] uppercase px-1.5 py-0.5 border border-[#222222] rounded-[2px]">
            {activeVehicleConfig.badge}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenInspector}
            className="flex items-center gap-1.5 text-[10px] font-mono tracking-[0.18em] text-[#38bdf8] hover:text-white transition-colors cursor-pointer py-1.5 px-3 rounded bg-[#0f172a]/70 hover:bg-[#1e293b] border border-[#38bdf8]/50"
            title="Inspect vehicle 3D model from all camera angles"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>3D INSPECTOR</span>
          </button>

          <button
            onClick={onToggleMute}
            className="flex items-center gap-2 text-[10px] font-mono tracking-[0.18em] text-[#858585] hover:text-[#f5f5f3] transition-colors cursor-pointer py-1.5 px-3 rounded border border-transparent hover:border-[#222222]"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isMuted ? 'AUDIO / OFF' : 'AUDIO / ON'}</span>
          </button>
        </div>
      </header>

      {/* 2. Hero Vehicle Typography & Active Machine Badge */}
      <div className="w-full max-w-4xl mx-auto text-center pointer-events-none my-auto py-2 shrink-0">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#222834] bg-[#0c1017]/80 backdrop-blur-md mb-2">
          <Sparkles className="w-3 h-3 text-[#38bdf8]" />
          <span className="text-[10px] font-mono tracking-[0.2em] text-[#94a3b8] uppercase">
            ELECTRIC HYPERCAR SPECIFICATION // {activeVehicleConfig.name}
          </span>
        </div>
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold tracking-[0.22em] text-[#f5f5f3] uppercase drop-shadow-sm">
          NEON OVERDRIVE
        </h1>
        <p className="text-xs sm:text-sm font-normal tracking-[0.18em] text-[#858585] uppercase mt-1.5 max-w-lg mx-auto">
          {activeVehicleConfig.tagline}
        </p>
      </div>

      {/* 3. Lower Control Center: Vehicle Selector, Planetary Route & Specs */}
      <footer className="w-full max-w-5xl mx-auto flex flex-col items-center gap-3.5 pointer-events-auto pb-1 shrink-0">
        
        {/* Dual Tier Selector: VEHICLE & ROUTE */}
        <div className="flex flex-col md:flex-row items-center justify-center gap-3 sm:gap-6 w-full max-w-4xl px-2">
          
          {/* A. Vehicle Selector */}
          <div className="flex flex-col items-center md:items-start gap-1.5 w-full md:w-auto">
            <span className="text-[9px] font-mono tracking-[0.22em] text-[#666666] uppercase px-1">
              SELECT VEHICLE (GARAGE)
            </span>
            <div className="flex items-center gap-1.5 p-1 rounded-sm bg-[#080808]/85 border border-[#1e232d] backdrop-blur-md w-full sm:w-auto justify-center">
              {vehicles.map((v) => {
                const isSelected = selectedVehicle === v;
                const cfg = VEHICLE_CONFIGS[v];

                return (
                  <button
                    key={v}
                    onClick={() => onSelectVehicle(v)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-[10px] font-mono tracking-[0.18em] uppercase transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-[#181c24] text-[#f5f5f3] border border-[#38bdf8]/80 shadow-[0_0_12px_rgba(56,189,248,0.2)] font-semibold'
                        : 'text-[#666666] hover:text-[#b8bcc1] border border-transparent hover:border-[#222222]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full border border-[#475569]/60 shrink-0"
                      style={{
                        backgroundColor: v === 'AERO_X'
                          ? '#cbd5e1'
                          : v === 'CYBER_GT'
                          ? '#475569'
                          : '#00f0ff',
                      }}
                    />
                    <span>{cfg.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div className="hidden md:block w-px h-10 bg-[#1c222c]" />

          {/* B. Planetary Route Selector */}
          <div className="flex flex-col items-center md:items-start gap-1.5 w-full md:w-auto">
            <span className="text-[9px] font-mono tracking-[0.22em] text-[#666666] uppercase px-1 flex items-center gap-1">
              <Globe className="w-2.5 h-2.5 text-[#555555]" />
              PLANETARY ROUTE
            </span>
            <div className="flex items-center gap-1.5 p-1 rounded-sm bg-[#080808]/85 border border-[#1e232d] backdrop-blur-md w-full sm:w-auto justify-center">
              {worlds.map((w, idx) => {
                const isSelected = selectedWorld === w;
                const cfg = WORLD_CONFIGS[w];

                return (
                  <button
                    key={w}
                    onClick={() => onSelectWorld(w)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-sm text-[10px] font-mono tracking-[0.18em] uppercase transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-[#181c24] text-[#f5f5f3] border border-[#f5f5f3]/80 shadow-md font-semibold'
                        : 'text-[#666666] hover:text-[#b8bcc1] border border-transparent hover:border-[#222222]'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        isSelected ? 'bg-[#f5f5f3]' : 'bg-[#333333]'
                      }`}
                    />
                    <span>0{idx + 1} · {cfg.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dynamic Telemetry Specs Bar (Automotive digital cluster style) */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-6 text-center w-full max-w-4xl px-4 py-2.5 border-t border-b border-[#1c222c]/90 backdrop-blur-sm bg-[#080808]/50">
          {/* Stat 1: 0-100 */}
          <div className="flex flex-col items-center">
            <span className="text-xl sm:text-2xl font-light tracking-tight text-[#f5f5f3] tabular-nums font-mono">
              {activeVehicleConfig.accel}
            </span>
            <span className="text-[9px] font-mono tracking-[0.18em] text-[#858585] uppercase mt-0.5">
              0-100 KM/H
            </span>
          </div>

          {/* Stat 2: Top Speed */}
          <div className="flex flex-col items-center">
            <span className="text-xl sm:text-2xl font-light tracking-tight text-[#f5f5f3] tabular-nums font-mono">
              {activeVehicleConfig.topSpeed.replace(' KM/H', '')}
              <span className="text-xs font-sans text-[#858585] ml-0.5">KM/H</span>
            </span>
            <span className="text-[9px] font-mono tracking-[0.18em] text-[#858585] uppercase mt-0.5">
              PEAK VELOCITY
            </span>
          </div>

          {/* Stat 3: Thrusters */}
          <div className="flex flex-col items-center">
            <span className="text-xs sm:text-sm font-light tracking-wider text-[#38bdf8] uppercase font-mono mt-1">
              {activeVehicleConfig.thrustSystem}
            </span>
            <span className="text-[9px] font-mono tracking-[0.18em] text-[#858585] uppercase mt-0.5">
              THRUST SYSTEM
            </span>
          </div>

          {/* Stat 4: World Gravitational Matrix */}
          <div className="flex flex-col items-center">
            <span className="text-sm sm:text-base font-light tracking-tight text-[#f5f5f3] uppercase font-mono mt-0.5">
              {activeWorldConfig.gravityLabel}
            </span>
            <span className="text-[9px] font-mono tracking-[0.18em] text-[#858585] uppercase mt-0.5">
              {activeWorldConfig.name} // {activeWorldConfig.atmosphereLabel}
            </span>
          </div>

          {/* Stat 5: Record */}
          <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center border-t sm:border-t-0 border-[#1c222c] pt-1.5 sm:pt-0">
            <span className="text-lg sm:text-xl font-medium tracking-tight text-[#f5f5f3] tabular-nums font-mono">
              {highScore > 0 ? highScore.toLocaleString() : '0'}
            </span>
            <span className="text-[9px] font-mono tracking-[0.18em] text-[#94a3b8] uppercase mt-0.5">
              RECORD DISTANCE
            </span>
          </div>
        </div>

        {/* Action Controls & Key Instruction */}
        <div className="flex flex-col items-center gap-2.5 w-full">
          <button
            onClick={onStart}
            className="w-full max-w-xs py-3 px-8 rounded bg-[#f5f5f3] hover:bg-white text-[#080808] font-semibold text-xs tracking-[0.25em] uppercase transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-[0_4px_24px_rgba(245,245,243,0.2)]"
          >
            START DRIVE // {activeVehicleConfig.name}
          </button>

          {/* Desktop & Mobile Quick Guide */}
          <div className="flex items-center gap-2.5 text-[9px] font-mono tracking-[0.16em] text-[#858585] uppercase">
            <span>[A/D or ←/→] STEER</span>
            <span className="text-[#333333]">·</span>
            <span>[SPACE] VECTOR THRUST</span>
            <span className="text-[#333333]">·</span>
            <span>[P / ESC] PAUSE</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
