/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { RotateCcw, Home, Award } from 'lucide-react';
import { GameStats, GameWorld, WORLD_CONFIGS } from '../game/types';

interface GameOverModalProps {
  stats: GameStats;
  isNewRecord: boolean;
  world?: GameWorld;
  onRestart: () => void;
  onReturnToMenu?: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  stats,
  isNewRecord,
  world = 'EARTH',
  onRestart,
  onReturnToMenu,
}) => {
  // Listen for Space / Enter to quickly restart
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        onRestart();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onRestart]);

  const formattedDistance =
    stats.distance >= 1000 ? `${(stats.distance / 1000).toFixed(2)} KM` : `${stats.distance} M`;

  const worldCfg = WORLD_CONFIGS[world];

  return (
    <div className="absolute inset-0 bg-[#080808]/85 backdrop-blur-md flex items-center justify-center p-4 z-30 font-sans select-none">
      <div className="bg-[#0e1117] border border-[#222834] rounded-[2px] p-6 sm:p-8 md:p-10 max-w-lg w-full text-center shadow-2xl relative">
        {/* Technical Sub-label */}
        <div className="text-[10px] font-mono tracking-[0.24em] text-[#858585] uppercase">
          POST-RUN TELEMETRY DEBRIEF // {worldCfg.name}
        </div>

        {/* Heading */}
        <h2 className="text-2xl sm:text-3xl font-light tracking-[0.18em] text-[#f5f5f3] uppercase mt-2">
          MISSION CONCLUDED
        </h2>

        {/* Sector Label */}
        <div className="text-[11px] font-mono tracking-[0.2em] text-[#b8bcc1] uppercase mt-1">
          {worldCfg.codename}
        </div>

        {/* Primary Score Presentation */}
        <div className="my-6 py-5 px-6 rounded-[2px] bg-[#12151d] border border-[#1e2430]">
          <div className="text-[10px] font-mono tracking-[0.2em] text-[#858585] uppercase">
            TOTAL HARVEST SCORE
          </div>
          <div className="text-4xl sm:text-5xl font-light font-mono tabular-nums text-[#f5f5f3] tracking-tight mt-1.5">
            {stats.score.toLocaleString()}
          </div>
          {isNewRecord && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-[2px] bg-[#171b24] text-[#f5f5f3] border border-[#3b485d] text-[10px] font-mono tracking-[0.18em] uppercase">
              <Award className="w-3.5 h-3.5 text-[#f5f5f3]" />
              NEW FLEET RECORD ESTABLISHED
            </div>
          )}
        </div>

        {/* Statistical Readout Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-7 text-left">
          {/* Distance */}
          <div className="bg-[#12151d] border border-[#1e2430] p-3 rounded-[2px]">
            <div className="text-[9px] font-mono tracking-[0.16em] text-[#858585] uppercase">
              DISTANCE
            </div>
            <div className="text-sm sm:text-base font-light font-mono text-[#f5f5f3] mt-0.5 tabular-nums">
              {formattedDistance}
            </div>
          </div>

          {/* Energy Harvest */}
          <div className="bg-[#12151d] border border-[#1e2430] p-3 rounded-[2px]">
            <div className="text-[9px] font-mono tracking-[0.16em] text-[#858585] uppercase">
              CREDITS
            </div>
            <div className="text-sm sm:text-base font-light font-mono text-[#f5f5f3] mt-0.5 tabular-nums">
              +{stats.coinsCollected}{' '}
              <span className="text-[10px] text-[#858585]">({stats.totalCoins})</span>
            </div>
          </div>

          {/* Top Speed */}
          <div className="bg-[#12151d] border border-[#1e2430] p-3 rounded-[2px]">
            <div className="text-[9px] font-mono tracking-[0.16em] text-[#858585] uppercase">
              PEAK VELOCITY
            </div>
            <div className="text-sm sm:text-base font-light font-mono text-[#f5f5f3] mt-0.5 tabular-nums">
              {stats.topSpeed}{' '}
              <span className="text-[10px] text-[#858585] uppercase">KM/H</span>
            </div>
          </div>

          {/* Flight Time */}
          <div className="bg-[#12151d] border border-[#1e2430] p-3 rounded-[2px]">
            <div className="text-[9px] font-mono tracking-[0.16em] text-[#858585] uppercase">
              AIRTIME DURATION
            </div>
            <div className="text-sm sm:text-base font-light font-mono text-[#f5f5f3] mt-0.5 tabular-nums">
              {stats.flightTime}s
            </div>
          </div>

          {/* Dodges / Maneuvers */}
          <div className="bg-[#12151d] border border-[#1e2430] p-3 rounded-[2px] col-span-2">
            <div className="text-[9px] font-mono tracking-[0.16em] text-[#858585] uppercase">
              REFLEX EVASIONS
            </div>
            <div className="text-sm sm:text-base font-light font-mono text-[#f5f5f3] mt-0.5 tabular-nums">
              {stats.nearMisses} Successful Interceptions
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={onRestart}
            className="w-full sm:w-auto px-8 py-3.5 bg-[#f5f5f3] hover:bg-white text-[#080808] font-semibold text-xs tracking-[0.18em] uppercase rounded-[2px] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RE-ENGAGE RUN
          </button>

          {onReturnToMenu && (
            <button
              onClick={onReturnToMenu}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#171b22] hover:bg-[#202530] text-[#858585] hover:text-[#f5f5f3] border border-[#2b3342] text-xs font-mono tracking-[0.16em] uppercase rounded-[2px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              VEHICLE SHOWROOM
            </button>
          )}
        </div>

        <div className="text-[10px] font-mono tracking-[0.16em] text-[#555e6b] uppercase mt-5">
          [SPACE] OR [ENTER] TO RE-ENGAGE
        </div>
      </div>
    </div>
  );
};
