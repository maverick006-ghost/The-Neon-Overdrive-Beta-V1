/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { VehicleDef, VehicleId, VehicleModelInstance } from './vehicleTypes';
import { createAeroXModel } from './aeroX';
import { createCyberGTModel } from './cyberGT';
import { createNeonCycleModel } from './neonCycle';

export const VEHICLE_DEFINITIONS: Record<VehicleId, VehicleDef> = {
  AERO_X: {
    id: 'AERO_X',
    name: 'AERO-X',
    category: 'HYPERCAR',
    badge: 'FLAGSHIP // HYPERCAR',
    codename: 'AERO-X INTERCEPTOR',
    tagline: 'Sculpted Liquid Titanium · Twin Venturi Air Tunnels & Active Wing',
    description:
      'Inspired by British electric hypercar design with sculpted fender peaks, sunken hood extraction valley, flowing side venturi tunnels, and active rear aero wing.',
    accel: '1.8s',
    topSpeed: '420 KM/H',
    flightCeiling: '45m',
    thrustSystem: 'QUAD COLD-GAS',
    wheelCount: 4,
    bankFactor: 1.0,
    bodyColor: 0xb5bac3,
    paintName: 'LIQUID TITANIUM SILVER',
    accentColor: '#38bdf8',
    thrusterColor: 0x00f2ff,
    hitbox: {
      width: 1.95,
      height: 0.95,
      length: 4.4,
    },
  },
  CYBER_GT: {
    id: 'CYBER_GT',
    name: 'CYBER GT',
    category: 'HYPERCAR',
    badge: 'PERFORMANCE // HYPERCAR',
    codename: 'CYBER GT COMPETITION',
    tagline: 'Deep Graphite Bronze · Vertical Quad-LED Towers & Dome Cockpit',
    description:
      'Inspired by prototype endurance hypercars with raised front arch blisters, vertical quad-element LED light pillars, dome glass canopy, and bifurcated bronze wheels.',
    accel: '1.9s',
    topSpeed: '435 KM/H',
    flightCeiling: '42m',
    thrustSystem: 'DUAL PLASMA CORE',
    wheelCount: 4,
    bankFactor: 1.1,
    bodyColor: 0x302e2b,
    paintName: 'DEEP GRAPHITE BRONZE',
    accentColor: '#00f0ff',
    thrusterColor: 0x00f0ff,
    hitbox: {
      width: 2.05,
      height: 1.0,
      length: 4.5,
    },
  },
  NEON_CYCLE: {
    id: 'NEON_CYCLE',
    name: 'NEON CYCLE',
    category: 'MOTORCYCLE',
    badge: 'LIGHTCYCLE // MOTORCYCLE',
    codename: 'NEON CYCLE TRON-SPEC',
    tagline: 'Futuristic Lightcycle · Twin Hubless Glowing Cyan Wheel Rings',
    description:
      'Inspired by iconic science-fiction lightcycles with two large enclosed hubless wheels, continuous brilliant cyan neon rings, dorsal spine, and energy trail.',
    accel: '1.6s',
    topSpeed: '390 KM/H',
    flightCeiling: '48m',
    thrustSystem: 'ION VECTOR JETS',
    wheelCount: 2,
    bankFactor: 1.8,
    bodyColor: 0x121418,
    paintName: 'DEEP OBSIDIAN / CYAN NEON',
    accentColor: '#00f2ff',
    thrusterColor: 0x00f2ff,
    hitbox: {
      width: 0.85,
      height: 0.88,
      length: 3.4,
    },
  },
};

/**
 * Factory function to instantiate an independent 3D vehicle model.
 */
export function createVehicleModel(vehicleId: VehicleId): VehicleModelInstance {
  switch (vehicleId) {
    case 'AERO_X':
      return createAeroXModel();
    case 'CYBER_GT':
      return createCyberGTModel();
    case 'NEON_CYCLE':
      return createNeonCycleModel();
    default:
      return createAeroXModel();
  }
}
