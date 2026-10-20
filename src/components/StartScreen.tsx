/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Volume2, VolumeX, Globe } from 'lucide-react';
import { GameWorld, WORLD_CONFIGS } from '../game/types';

interface StartScreenProps {
  highScore: number;
  selectedWorld: GameWorld;
  onSelectWorld: (world: GameWorld) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
}

export const StartScreen: React.FC<StartScreenProps> = ({
  highScore,
  selectedWorld,
  onSelectWorld,
  isMuted,
  onToggleMute,
  onStart,
}) => {
  const worlds: GameWorld[] = ['MOON', 'EARTH', 'MARS'];
  const activeConfig = WORLD_CONFIGS[selectedWorld];

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 sm:p-8 md:p-12 z-20 font-sans select-none bg-gradient-to-b from-[#080808]/85 via-transparent to-[#080808]/95">
      {/* 1. Minimal Top Navigation */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between pointer-events-auto">
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-mono tracking-[0.25em] text-[#b8bcc1] uppercase font-semibold">
            NEON OVERDRIVE
          </span>
          <span className="text-[#333333]">/</span>
          <span className="text-[10px] font-mono tracking-[0.18em] text-[#858585] uppercase hidden sm:inline">
            AERODYNAMIC INTERCEPTOR
          </span>
        </div>

        <button
          onClick={onToggleMute}
          className="flex items-center gap-2 text-[11px] font-mono tracking-[0.18em] text-[#858585] hover:text-[#f5f5f3] transition-colors cursor-pointer py-1.5 px-3 rounded border border-transparent hover:border-[#222222]"
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          <span>{isMuted ? 'AUDIO / MUTED' : 'AUDIO / ACTIVE'}</span>
        </button>
      </header>

      {/* 2. Hero Vehicle Typography (Upper Mid) */}
      <div className="w-full max-w-4xl mx-auto text-center pointer-events-none -mt-2 sm:-mt-6">
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-semibold tracking-[0.22em] text-[#f5f5f3] uppercase">
          NEON OVERDRIVE
        </h1>
        <p className="text-xs sm:text-sm font-normal tracking-[0.2em] text-[#858585] uppercase mt-2 max-w-lg mx-auto">
          All-Electric Highway Interceptor · Unconstrained Performance
        </p>
      </div>

      {/* 3. Center Lower: Premium World Selection & Telemetry Specs */}
      <footer className="w-full max-w-5xl mx-auto flex flex-col items-center gap-5 sm:gap-6 pointer-events-auto pb-2">
        {/* World Selection Tabs */}
        <div className="flex flex-col items-center gap-2.5 w-full max-w-2xl px-2">
          {/* Segmented Control */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 p-1 rounded-sm bg-[#080808]/75 border border-[#1c1c1c] backdrop-blur-md">
            {worlds.map((w, idx) => {
              const isSelected = selectedWorld === w;
              const cfg = WORLD_CONFIGS[w];

              return (
                <button
                  key={w}
                  onClick={() => onSelectWorld(w)}
                  className={`flex items-center gap-2 px-3.5 sm:px-5 py-2 rounded-sm text-[11px] font-mono tracking-[0.2em] uppercase transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'bg-[#171717] text-[#f5f5f3] border border-[#f5f5f3]/80 shadow-md font-semibold'
                      : 'text-[#666666] hover:text-[#b8bcc1] border border-transparent hover:border-[#222222]'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full transition-colors ${
                    isSelected ? 'bg-[#f5f5f3]' : 'bg-[#333333]'
                  }`} />
                  <span>0{idx + 1} · {cfg.name}</span>
                </button>
              );
            })}
          </div>

          {/* Active World Subtitle & Description */}
          <div className="flex flex-col items-center text-center max-w-lg px-4 py-1.5">
            <div className="flex items-center gap-2 text-[10px] font-mono tracking-[0.22em] text-[#b8bcc1] uppercase">
              <Globe className="w-3 h-3 text-[#858585]" />
              <span>LOCATION // {activeConfig.codename}</span>
              <span className="text-[#444444]">·</span>
              <span className="text-[#858585]">{activeConfig.gravityLabel}</span>
            </div>
            <p className="text-[11px] sm:text-xs text-[#858585] tracking-wide mt-1 line-clamp-2">
              {activeConfig.description}
            </p>
          </div>
        </div>

        {/* Tesla Specs Bar Style Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4 sm:gap-8 text-center w-full max-w-4xl px-4 py-3 border-t border-b border-[#1c1c1c]/80 backdrop-blur-sm bg-[#080808]/40">
          {/* Stat 1 */}
          <div className="flex flex-col items-center">
            <span className="text-xl sm:text-2xl font-light tracking-tight text-[#f5f5f3] tabular-nums font-mono">
              1.9<span className="text-sm font-sans text-[#858585] ml-0.5">s</span>
            </span>
            <span className="text-[9px] font-mono tracking-[0.2em] text-[#858585] uppercase mt-1">
              0-100 KM/H
            </span>
          </div>

          {/* Stat 2 */}
          <div className="flex flex-col items-center">
            <span className="text-xl sm:text-2xl font-light tracking-tight text-[#f5f5f3] tabular-nums font-mono">
              45<span className="text-sm font-sans text-[#858585] ml-0.5">m</span>
            </span>
            <span className="text-[9px] font-mono tracking-[0.2em] text-[#858585] uppercase mt-1">
              FLIGHT CEILING
            </span>
          </div>

          {/* Stat 3 */}
          <div className="flex flex-col items-center">
            <span className="text-base sm:text-lg font-light tracking-tight text-[#f5f5f3] uppercase font-mono mt-0.5">
              COLD-GAS
            </span>
            <span className="text-[9px] font-mono tracking-[0.2em] text-[#858585] uppercase mt-1">
              THRUST SYSTEM
            </span>
          </div>

          {/* Stat 4 (World Gravity / Atmosphere) */}
          <div className="flex flex-col items-center">
            <span className="text-lg sm:text-xl font-light tracking-tight text-[#f5f5f3] uppercase font-mono">
              {activeConfig.gravityLabel}
            </span>
            <span className="text-[9px] font-mono tracking-[0.2em] text-[#858585] uppercase mt-1">
              {activeConfig.atmosphereLabel}
            </span>
          </div>

          {/* Stat 5 (Record) */}
          <div className="col-span-2 sm:col-span-4 md:col-span-1 flex flex-col items-center justify-center border-t sm:border-t-0 border-[#1c1c1c] pt-2 sm:pt-0">
            <span className="text-lg sm:text-xl font-medium tracking-tight text-[#f5f5f3] tabular-nums font-mono">
              {highScore > 0 ? highScore.toLocaleString() : '0'}
            </span>
            <span className="text-[9px] font-mono tracking-[0.2em] text-[#b8bcc1] uppercase mt-1">
              SYSTEM RECORD
            </span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col items-center gap-3 w-full">
          <button
            onClick={onStart}
            className="w-full max-w-xs py-3.5 px-8 rounded bg-[#f5f5f3] hover:bg-white text-[#080808] font-semibold text-xs tracking-[0.25em] uppercase transition-all duration-200 transform hover:scale-[1.01] active:scale-[0.99] cursor-pointer shadow-xl"
          >
            START DRIVE
          </button>

          {/* Minimal Key Instructions */}
          <div className="flex items-center gap-3 text-[10px] font-mono tracking-[0.16em] text-[#858585] uppercase">
            <span>[A/D or ←/→] STEER</span>
            <span className="text-[#333333]">·</span>
            <span>[SPACE] THRUSTERS</span>
            <span className="text-[#333333]">·</span>
            <span>[P / ESC] PAUSE</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
