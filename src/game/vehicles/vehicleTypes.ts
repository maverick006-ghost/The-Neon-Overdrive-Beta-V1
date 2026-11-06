/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export type VehicleId = 'AERO_X' | 'CYBER_GT' | 'NEON_CYCLE';

export type VehicleCategory = 'HYPERCAR' | 'MOTORCYCLE';

export interface VehicleDef {
  id: VehicleId;
  name: string;
  category: VehicleCategory;
  badge: string;
  codename: string;
  tagline: string;
  description: string;
  accel: string;
  topSpeed: string;
  flightCeiling: string;
  thrustSystem: string;
  wheelCount: 2 | 4;
  bankFactor: number; // multiplier for banking roll angle
  bodyColor: number;
  paintName: string;
  accentColor: string;
  thrusterColor: number;
  // Hitbox / collision bounding box half-extents
  hitbox: {
    width: number;
    height: number;
    length: number;
  };
}

export interface VehicleModelInstance {
  id: VehicleId;
  rootGroup: THREE.Group;
  contactShadow: THREE.Mesh;
  // All wheels that should rotate forward with ground speed
  wheels: THREE.Object3D[];
  frontSteerNodes?: THREE.Object3D[];
  // Thruster flame meshes & point lights
  thrusterFlames: THREE.Mesh[];
  thrusterLights: THREE.PointLight[];
  // Thruster positions in local coordinates
  thrusterPositions: THREE.Vector3[];
  // Optional light trail for NEON CYCLE
  lightTrailMesh?: THREE.Mesh;
  lightTrailPositions?: Float32Array;
  // Animation hook called each frame
  update: (
    delta: number,
    speed: number,
    isFlying: boolean,
    altitude: number,
    flightEnergy: number,
    bankAngle: number
  ) => void;
  // Cleanup hook
  dispose: () => void;
}
