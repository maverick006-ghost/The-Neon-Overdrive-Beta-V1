/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Volume2, VolumeX, Pause } from 'lucide-react';
import { GameWorld, PlayerCar, WORLD_CONFIGS } from '../game/types';

interface HUDProps {
  score: number;
  highScore: number;
  distance: number;
  player: PlayerCar;
  world?: GameWorld;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  nearMissAlert: string | null;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  highScore,
  distance,
  player,
  world = 'EARTH',
  isMuted,
  onToggleMute,
  onPause,
  nearMissAlert,
}) => {
  const formattedDistance =
    distance >= 1000 ? `${(distance / 1000).toFixed(2)} KM` : `${Math.floor(distance)} M`;

  const fuelPercent = Math.max(0, Math.min(100, Math.floor(player.flightEnergy)));
  const isFlightActive = player.altitude > 0.06;
  const isLowIntegrity = player.shields === 1;

  // Active power-up states
  const hasMagnet = player.magnetTimer > 0;
  const hasShield = player.hasShield || player.shieldTimer > 0;
  const hasMultiplier = player.multiplierTimer > 0;
  const anyPowerupActive = hasMagnet || hasShield || hasMultiplier;

  return (
    <div className="absolute inset-x-0 top-0 pointer-events-none p-3 sm:p-6 flex flex-col items-center z-10 font-sans select-none">
      {/* 1. Primary Automotive Digital Cluster Top Bar */}
      <header className="w-full max-w-6xl flex items-center justify-between gap-4 px-4 sm:px-6 py-2.5 rounded bg-[#080808]/85 border border-[#1f242d]/80 backdrop-blur-md shadow-2xl pointer-events-auto">
        {/* Left: Speed Readout & Hull Integrity Segments */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Large Speedometer */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl sm:text-3xl font-light font-mono tracking-tight text-[#f5f5f3] tabular-nums">
                {Math.floor(player.speed)}
              </span>
              <span className="text-[10px] font-mono tracking-[0.16em] text-[#858585] uppercase">
                KM/H
              </span>
            </div>
            <span className="text-[9px] font-mono tracking-[0.18em] text-[#858585] uppercase -mt-1">
              GROUND VELOCITY
            </span>
          </div>

          <div className="h-7 w-px bg-[#1f242d]" />

          {/* Hull Integrity Pips (Minimal Segmented Bar) */}
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((idx) => {
                const isAlive = idx < player.shields;
                return (
                  <div
                    key={idx}
                    className={`w-4 sm:w-6 h-2 rounded-[2px] transition-all duration-200 ${
                      isAlive
                        ? isLowIntegrity
                          ? 'bg-[#E82127] animate-pulse'
                          : 'bg-[#f5f5f3]'
                        : 'bg-[#1c1c1c] border border-[#2b2b2b]'
                    }`}
                    title={`Hull Integrity: ${player.shields}/3 hits`}
                  />
                );
              })}
              {player.hasShield && (
                <span className="ml-1 px-1.5 py-0.5 rounded-[2px] bg-[#1a2333] border border-[#3b4860] text-[9px] font-mono tracking-wider text-[#b8bcc1] uppercase">
                  SHIELD
                </span>
              )}
            </div>
            <span className="text-[9px] font-mono tracking-[0.18em] text-[#858585] uppercase mt-1">
              {isLowIntegrity ? (
                <span className="text-[#E82127] font-semibold">HULL CRITICAL</span>
              ) : (
                `INTEGRITY ${player.shields}/3`
              )}
            </span>
          </div>
        </div>

        {/* Center: Score, Distance & Total Energy Credits */}
        <div className="flex flex-col items-center">
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-light font-mono tracking-tight text-[#f5f5f3] tabular-nums">
              {score.toLocaleString()}
            </span>
            {hasMultiplier && (
              <span className="px-1.5 py-0.2 rounded-[2px] bg-[#f5f5f3] text-[#080808] text-[9px] font-mono font-bold tracking-wider">
                2X
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5 -mt-0.5 text-[10px] font-mono tracking-[0.16em] text-[#858585] uppercase">
            <span>{formattedDistance}</span>
            <span className="text-[#333333]">·</span>
            <span className="text-[#b8bcc1]">⚡ {player.coinsCollected || 0}</span>
            <span className="text-[#333333] hidden sm:inline">·</span>
            <span className="hidden sm:inline text-[#a3a3a3]">
              {WORLD_CONFIGS[world]?.name}
            </span>
            {highScore > 0 && (
              <>
                <span className="text-[#333333] hidden md:inline">·</span>
                <span className="hidden md:inline text-[#858585]">
                  BEST <span className="text-[#f5f5f3] tabular-nums">{highScore.toLocaleString()}</span>
                </span>
              </>
            )}
          </div>
        </div>

        {/* Right: Flight Energy Gauge & Minimal Controls */}
        <div className="flex items-center gap-4 sm:gap-6">
          {/* Rocket Thruster Fuel Indicator */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-mono tracking-[0.18em] uppercase ${
                  isFlightActive
                    ? 'text-[#00F0FF] font-semibold'
                    : fuelPercent < 20
                    ? 'text-[#E82127]'
                    : 'text-[#858585]'
                }`}
              >
                {isFlightActive ? 'THRUSTERS ENGAGED' : 'COLD-GAS ENERGY'}
              </span>
              <span className="text-xs font-mono font-medium text-[#f5f5f3] tabular-nums">
                {fuelPercent}%
              </span>
            </div>

            {/* Sleek Linear Gauge */}
            <div className="w-24 sm:w-36 h-1.5 bg-[#171717] rounded-none overflow-hidden mt-1 border border-[#262626]">
              <div
                className={`h-full transition-all duration-75 ${
                  isFlightActive
                    ? 'bg-[#00F0FF] shadow-[0_0_10px_rgba(0,240,255,0.7)]'
                    : fuelPercent < 20
                    ? 'bg-[#E82127]'
                    : 'bg-[#f5f5f3]'
                }`}
                style={{ width: `${fuelPercent}%` }}
              />
            </div>
          </div>

          <div className="h-7 w-px bg-[#1f242d] hidden sm:block" />

          {/* Minimal Icon Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="p-1.5 text-[#858585] hover:text-[#f5f5f3] transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              onClick={onPause}
              aria-label="Pause Drive"
              className="p-1.5 text-[#858585] hover:text-[#f5f5f3] transition-colors cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* 2. Active Power-Up Telemetry Strip */}
      {anyPowerupActive && (
        <div className="flex items-center gap-2 mt-2.5 pointer-events-none">
          {hasMagnet && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-[2px] bg-[#0d1017]/90 border border-[#252e3d] text-[10px] font-mono tracking-wider text-[#f5f5f3]">
              <span className="text-[#00F0FF]">MAGNETIC COUPLER</span>
              <span className="text-[#858585] tabular-nums">{player.magnetTimer.toFixed(1)}s</span>
            </div>
          )}

          {hasShield && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-[2px] bg-[#0d1017]/90 border border-[#252e3d] text-[10px] font-mono tracking-wider text-[#f5f5f3]">
              <span className="text-[#b8bcc1]">FORCEFIELD MATRIX</span>
              <span className="text-[#858585] tabular-nums">{player.shieldTimer.toFixed(1)}s</span>
            </div>
          )}

          {hasMultiplier && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-[2px] bg-[#0d1017]/90 border border-[#252e3d] text-[10px] font-mono tracking-wider text-[#f5f5f3]">
              <span className="text-[#f5f5f3]">OVERDRIVE 2X</span>
              <span className="text-[#858585] tabular-nums">{player.multiplierTimer.toFixed(1)}s</span>
            </div>
          )}
        </div>
      )}

      {/* 3. Understated Automotive Notification Alert */}
      {nearMissAlert && (
        <div className="mt-3 px-4 py-1.5 rounded-[2px] bg-[#12151c]/95 border border-[#262c38] text-[11px] font-mono tracking-[0.16em] text-[#f5f5f3] uppercase shadow-lg">
          {nearMissAlert}
        </div>
      )}
    </div>
  );
};
