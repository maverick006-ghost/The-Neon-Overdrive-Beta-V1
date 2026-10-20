/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Rocket } from 'lucide-react';
import { TouchInputState } from '../game/types';

interface TouchControlsProps {
  onSteerLeft: () => void;
  onSteerRight: () => void;
  onTouchFlightChange?: (flying: boolean) => void;
  onTouchStateChange?: (state: TouchInputState) => void;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onSteerLeft,
  onSteerRight,
  onTouchFlightChange,
  onTouchStateChange,
}) => {
  const [isFlying, setIsFlying] = useState(false);

  const handleFlightStart = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsFlying(true);
    onTouchFlightChange?.(true);
    onTouchStateChange?.({ left: false, right: false, fly: true });
  };

  const handleFlightEnd = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    setIsFlying(false);
    onTouchFlightChange?.(false);
    onTouchStateChange?.({ left: false, right: false, fly: false });
  };

  return (
    <div className="absolute inset-x-0 bottom-16 px-6 flex items-center justify-between pointer-events-none md:hidden z-10 select-none">
      {/* Left & Right Steering Pad */}
      <div className="flex items-center gap-2.5 pointer-events-auto">
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onSteerLeft();
          }}
          onClick={onSteerLeft}
          aria-label="Steer Left"
          className="w-13 h-13 rounded-[2px] bg-[#0e1117]/85 active:bg-[#1a202c] border border-[#232936] text-[#f5f5f3] flex items-center justify-center transition-all shadow-md active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <button
          onTouchStart={(e) => {
            e.preventDefault();
            onSteerRight();
          }}
          onClick={onSteerRight}
          aria-label="Steer Right"
          className="w-13 h-13 rounded-[2px] bg-[#0e1117]/85 active:bg-[#1a202c] border border-[#232936] text-[#f5f5f3] flex items-center justify-center transition-all shadow-md active:scale-95"
        >
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>

      {/* Flight Thruster Lift Button */}
      <div className="pointer-events-auto">
        <button
          onTouchStart={handleFlightStart}
          onTouchEnd={handleFlightEnd}
          onMouseDown={handleFlightStart}
          onMouseUp={handleFlightEnd}
          onMouseLeave={handleFlightEnd}
          aria-label="Engage Flight Thrusters"
          className={`w-14 h-14 rounded-[2px] border flex flex-col items-center justify-center transition-all shadow-lg active:scale-95 ${
            isFlying
              ? 'bg-[#00F0FF] border-[#f5f5f3] text-[#080808] shadow-[0_0_18px_rgba(0,240,255,0.7)]'
              : 'bg-[#0e1117]/85 border-[#2b3342] text-[#f5f5f3]'
          }`}
        >
          <Rocket className="w-5 h-5" />
          <span className="text-[8px] font-mono tracking-wider uppercase mt-0.5">THRUST</span>
        </button>
      </div>
    </div>
  );
};
