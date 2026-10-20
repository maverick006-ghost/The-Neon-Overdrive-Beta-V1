/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameStatus = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAMEOVER';

export type GameWorld = 'EARTH' | 'MOON' | 'MARS';

export interface WorldConfig {
  id: GameWorld;
  name: string;
  codename: string;
  subtitle: string;
  description: string;
  gravityLabel: string;
  atmosphereLabel: string;
  accentColor: string;
}

export const WORLD_CONFIGS: Record<GameWorld, WorldConfig> = {
  MOON: {
    id: 'MOON',
    name: 'MOON',
    codename: 'TRANQUILITY BASIN',
    subtitle: 'LUNAR REGOLITH // VACUUM GRID',
    description: 'Hard vacuum, basaltic crater fields, and deep space starfield with Earth rise.',
    gravityLabel: '0.16G',
    atmosphereLabel: 'VACUUM',
    accentColor: '#cbd5e1',
  },
  EARTH: {
    id: 'EARTH',
    name: 'EARTH',
    codename: 'NEO-TOKYO SECTOR 7',
    subtitle: 'ORBITAL HIGHWAY // MEGACITY',
    description: 'Futuristic atmospheric metropolis corridor with layered skyline and mag-rail grid.',
    gravityLabel: '1.00G',
    atmosphereLabel: '1.0 ATM',
    accentColor: '#38bdf8',
  },
  MARS: {
    id: 'MARS',
    name: 'MARS',
    codename: 'VALLES MARINERIS',
    subtitle: 'RUST CANYON // OCHRE PLATEAU',
    description: 'Oxidized iron regolith dunes, towering mesas, dust twilight, and warm solar diffusion.',
    gravityLabel: '0.38G',
    atmosphereLabel: '0.01 ATM',
    accentColor: '#fb923c',
  },
};

export type LaneIndex = 0 | 1 | 2; // 0 = Left, 1 = Center, 2 = Right

export type ObstacleType = 'traffic' | 'barrier' | 'gap' | 'coin' | 'powerup' | 'orb';
export type PowerupType = 'magnet' | 'fuel' | 'shield' | 'multiplier';

export interface PlayerCar {
  lane: LaneIndex;
  targetLane: LaneIndex;
  x: number; // -1 to 1 (left to right normalized position)
  targetX: number;
  y: number; // visual screen position calculated from projection
  altitude: number; // 0 = ground, 1 = max flight height (elevated)
  targetAltitude: number;
  isFlying: boolean;
  flightEnergy: number; // 0 to 100
  shields: number; // 3 max (three-hit survival)
  invulnerableTimer: number; // seconds remaining
  bankAngle: number; // roll when steering
  speed: number; // km/h
  distance: number; // meters traveled
  totalFlightTime: number; // seconds in flight

  // Power-up active states & timers
  magnetTimer: number; // seconds remaining
  shieldTimer: number; // seconds remaining
  hasShield: boolean;  // whether defensive shield is active
  multiplierTimer: number; // seconds remaining (2x score)
  coinsCollected: number; // coins collected in current run
}

export interface GameObject {
  id: string;
  type: ObstacleType;
  lane: LaneIndex;
  z: number; // distance ahead of player in road units (0 to 1500)
  speed: number; // forward movement speed relative to road
  width: number;
  height: number;
  cleared: boolean;
  hasOverflown?: boolean;
  collected?: boolean;
  variant?: number; // for visual variety
  pulsePhase?: number;

  // Coin & Power-up specific properties
  isElevated?: boolean; // elevated coins require rocket flight
  powerupType?: PowerupType;
  magnetized?: boolean; // currently flying toward vehicle
  yOffset?: number;
}

export interface RoadSegment {
  curve: number; // horizontal curvature (-1 to 1)
  pitch: number; // vertical undulation (-1 to 1)
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  vz: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  type?: 'smoke' | 'flame' | 'spark' | 'ring' | 'coin';
  growthRate?: number;
}

export interface GameStats {
  score: number;
  highScore: number;
  distance: number; // meters
  topSpeed: number; // km/h
  coinsCollected: number;
  totalCoins: number;
  nearMisses: number;
  flightTime: number; // seconds
}

export interface TouchInputState {
  left: boolean;
  right: boolean;
  fly: boolean;
}
