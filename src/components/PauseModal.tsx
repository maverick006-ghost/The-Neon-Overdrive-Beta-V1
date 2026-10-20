/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, Home } from 'lucide-react';
import { GameWorld, WORLD_CONFIGS } from '../game/types';

interface PauseModalProps {
  world?: GameWorld;
  onResume: () => void;
  onRestart: () => void;
  onReturnToMenu?: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  world = 'EARTH',
  onResume,
  onRestart,
  onReturnToMenu,
  isMuted,
  onToggleMute,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyP' || e.code === 'Escape') {
        e.preventDefault();
        onResume();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onResume]);

  const worldCfg = WORLD_CONFIGS[world];

  return (
    <div className="absolute inset-0 bg-[#080808]/85 backdrop-blur-md flex items-center justify-center p-4 z-30 font-sans select-none">
      <div className="bg-[#0f1117] border border-[#232936] rounded-[2px] p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="text-[10px] font-mono tracking-[0.24em] text-[#858585] uppercase">
          VEHICLE STANDBY // {worldCfg.name}
        </div>
        <div className="text-[9px] font-mono tracking-[0.18em] text-[#b8bcc1] uppercase mt-0.5">
          {worldCfg.codename}
        </div>
        <h2 className="text-xl sm:text-2xl font-light tracking-[0.18em] text-[#f5f5f3] uppercase mt-2">
          MISSION PAUSED
        </h2>

        <div className="flex flex-col gap-2.5 mt-8">
          {/* Primary Action */}
          <button
            onClick={onResume}
            className="w-full py-3.5 bg-[#f5f5f3] hover:bg-white text-[#080808] font-semibold text-xs tracking-[0.18em] uppercase rounded-[2px] flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            RESUME DRIVE
          </button>

          {/* Secondary Action */}
          <button
            onClick={onRestart}
            className="w-full py-3 bg-[#171b22] hover:bg-[#202530] text-[#f5f5f3] border border-[#2b3342] text-xs font-mono tracking-[0.16em] uppercase rounded-[2px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            RESTART RUN
          </button>

          {/* Return to Vehicle Menu */}
          {onReturnToMenu && (
            <button
              onClick={onReturnToMenu}
              className="w-full py-2.5 bg-transparent hover:bg-[#141820] text-[#858585] hover:text-[#f5f5f3] border border-[#232936] text-[11px] font-mono tracking-[0.16em] uppercase rounded-[2px] flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" />
              VEHICLE SHOWROOM
            </button>
          )}

          {/* Audio Toggle */}
          <button
            onClick={onToggleMute}
            className="w-full py-2 bg-transparent text-[#858585] hover:text-[#b8bcc1] text-[10px] font-mono tracking-[0.16em] uppercase flex items-center justify-center gap-2 transition-colors cursor-pointer mt-1"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{isMuted ? 'AUDIO / MUTED' : 'AUDIO / ACTIVE'}</span>
          </button>
        </div>

        <div className="text-[10px] font-mono tracking-[0.16em] text-[#555e6b] uppercase mt-5">
          [P] OR [ESC] TO CONTINUE
        </div>
      </div>
    </div>
  );
};
