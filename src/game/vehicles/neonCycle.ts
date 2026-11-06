/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { VehicleModelInstance } from './vehicleTypes';

/**
 * Vehicle 03 — NEON CYCLE
 * Directly modeled from Reference Image 3 (TRON Lightcycle aesthetic):
 * - Extremely low, elongated aerodynamic motorcycle silhouette in deep obsidian mirror metallic.
 * - Two huge enclosed hubless wheels with continuous brilliant glowing cyan neon rings on both faces.
 * - Continuous razor-thin cyan illuminated light spine running over the center back and rear fairing.
 * - Sweeping horseshoe-shaped cyan neon contour line along the curved flank.
 * - Deep sculpted aerodynamic rider cockpit cowl with horizontal streamlined seating.
 * - Luminous cyan energy ribbon trail trailing behind the rear wheel during acceleration.
 * - Authentic 2-wheel rotation and deep dynamic motorcycle banking (up to 35-40 degrees).
 */
export function createNeonCycleModel(): VehicleModelInstance {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'Vehicle_NEON_CYCLE';

  const wheels: THREE.Object3D[] = [];
  const thrusterFlames: THREE.Mesh[] = [];
  const thrusterLights: THREE.PointLight[] = [];
  const thrusterPositions: THREE.Vector3[] = [];

  // =========================================================================
  // 1. PBR MATERIALS RIG (Accurately tuned to Reference 3)
  // =========================================================================
  // Mirror-like Deep Obsidian / Dark Graphite Metallic finish
  const obsidianMirrorPaint = new THREE.MeshPhysicalMaterial({
    color: 0x121418,
    metalness: 0.95,
    roughness: 0.14,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.98,
    envMapIntensity: 1.8,
  });

  // Matte stealth carbon structural frame
  const stealthFrameMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c0f,
    metalness: 0.85,
    roughness: 0.40,
  });

  // Dark tinted visor glass
  const visorGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x040608,
    metalness: 0.98,
    roughness: 0.05,
    transmission: 0.50,
    thickness: 0.6,
    transparent: true,
    opacity: 0.96,
  });

  // Performance motorcycle tire rubber
  const tireRubberMat = new THREE.MeshStandardMaterial({
    color: 0x141618,
    roughness: 0.94,
    metalness: 0.04,
  });

  // High-intensity Glowing Cyan Neon (Reference 3 signature color)
  const cyanNeonGlowMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
  });

  // Inner hub cyan glow
  const cyanCoreGlowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.85,
  });

  // Thruster rocket plasma
  const thrusterPlasmaMat = new THREE.MeshBasicMaterial({
    color: 0x00f2ff,
    transparent: true,
    opacity: 0.0,
  });

  // Banking group: everything inside rolls deeply during lane changes
  const leanGroup = new THREE.Group();
  rootGroup.add(leanGroup);

  // =========================================================================
  // 2. ELONGATED AERODYNAMIC FUSELAGE & RIDER COCKPIT (Reference 3)
  // =========================================================================
  // Main elongated aerodynamic monocoque connecting front and rear wheels
  const fuselageGeo = new THREE.CylinderGeometry(0.36, 0.42, 2.8, 18);
  fuselageGeo.rotateX(Math.PI * 0.5);
  fuselageGeo.scale(0.85, 0.65, 1.0);
  const fuselage = new THREE.Mesh(fuselageGeo, obsidianMirrorPaint);
  fuselage.position.set(0, 0.46, 0);
  fuselage.castShadow = true;
  leanGroup.add(fuselage);

  // Lower chassis belly pan
  const bellyPanGeo = new THREE.BoxGeometry(0.52, 0.16, 2.6);
  const bellyPan = new THREE.Mesh(bellyPanGeo, stealthFrameMat);
  bellyPan.position.set(0, 0.22, 0);
  bellyPan.castShadow = true;
  leanGroup.add(bellyPan);

  // Streamlined Horizontal Rider Canopy / Cockpit Cowl (Reference 3)
  const riderCowlGeo = new THREE.CylinderGeometry(0.24, 0.32, 1.45, 16);
  riderCowlGeo.rotateX(Math.PI * 0.5);
  riderCowlGeo.scale(0.88, 0.55, 1.0);
  const riderCowl = new THREE.Mesh(riderCowlGeo, visorGlassMat);
  riderCowl.position.set(0, 0.68, -0.32);
  riderCowl.castShadow = true;
  leanGroup.add(riderCowl);

  // Sculpted Rider Shoulder Bolsters
  [-0.26, 0.26].forEach((x) => {
    const bolsterGeo = new THREE.CylinderGeometry(0.12, 0.16, 1.2, 12);
    bolsterGeo.rotateX(Math.PI * 0.5);
    const bolster = new THREE.Mesh(bolsterGeo, obsidianMirrorPaint);
    bolster.position.set(x, 0.62, -0.2);
    leanGroup.add(bolster);
  });

  // CONTINUOUS ILLUMINATED CYAN SPINE (Reference 3 signature center light)
  // Runs down the entire dorsal spine over the rear cowl to the tail
  const spineLightGeo = new THREE.BoxGeometry(0.025, 0.025, 2.6);
  const spineLight = new THREE.Mesh(spineLightGeo, cyanNeonGlowMat);
  spineLight.position.set(0, 0.74, 0.4);
  leanGroup.add(spineLight);

  // Vertical rear tail fin light slit (Reference 3 rear fin)
  const rearFinLightGeo = new THREE.BoxGeometry(0.02, 0.22, 0.03);
  const rearFinLight = new THREE.Mesh(rearFinLightGeo, cyanNeonGlowMat);
  rearFinLight.position.set(0, 0.68, 1.62);
  leanGroup.add(rearFinLight);

  // SWEEPING HORSESHOE CYAN FLANK ACCENT (Reference 3 curved side lights)
  [-0.32, 0.32].forEach((x) => {
    // Horseshoe curve around rider thigh cutout
    const horseshoeCurve = new THREE.TorusGeometry(0.28, 0.015, 8, 24, Math.PI * 1.2);
    horseshoeCurve.rotateY(Math.PI * 0.5);
    horseshoeCurve.scale(1.0, 1.1, 0.85);
    const horseshoe = new THREE.Mesh(horseshoeCurve, cyanNeonGlowMat);
    horseshoe.position.set(x > 0 ? x + 0.02 : x - 0.02, 0.52, -0.15);
    leanGroup.add(horseshoe);

    // Horizontal sill accent line
    const sillLineGeo = new THREE.BoxGeometry(0.015, 0.015, 1.4);
    const sillLine = new THREE.Mesh(sillLineGeo, cyanNeonGlowMat);
    sillLine.position.set(x > 0 ? x + 0.03 : x - 0.03, 0.32, 0.1);
    leanGroup.add(sillLine);
  });

  // =========================================================================
  // 3. TWO LARGE ENCLOSED HUBLESS WHEELS (Reference 3 Iconic Architecture)
  // =========================================================================
  // Wheel specifications:
  // Front wheel: z = -1.25, radius = 0.46, width = 0.32
  // Rear wheel:  z = 1.25,  radius = 0.50, width = 0.38
  const cycleWheels = [
    { z: -1.25, y: 0.46, radius: 0.46, width: 0.32, isFront: true },
    { z: 1.25,  y: 0.50, radius: 0.50, width: 0.38, isFront: false },
  ];

  cycleWheels.forEach((w) => {
    // Large Enclosing Wheel Fairing Cowl (Reference 3 smooth body shell over wheel)
    const cowlGeo = new THREE.CylinderGeometry(w.radius + 0.06, w.radius + 0.06, w.width + 0.08, 20, 1, false, 0, Math.PI);
    cowlGeo.rotateZ(Math.PI * 0.5);
    const cowl = new THREE.Mesh(cowlGeo, obsidianMirrorPaint);
    cowl.position.set(0, w.y, w.z);
    cowl.castShadow = true;
    leanGroup.add(cowl);

    // Front/Rear aerodynamic cowl nose/tail extensions
    const extGeo = new THREE.SphereGeometry(w.radius + 0.06, 16, 12, 0, Math.PI, 0, Math.PI * 0.5);
    extGeo.rotateX(w.isFront ? -Math.PI * 0.5 : Math.PI * 0.5);
    extGeo.scale(0.38, 1.0, 0.85);
    const ext = new THREE.Mesh(extGeo, obsidianMirrorPaint);
    ext.position.set(0, w.y, w.isFront ? w.z - 0.15 : w.z + 0.15);
    leanGroup.add(ext);

    // Rotating Wheel Hub Group
    const wheelAnchor = new THREE.Group();
    wheelAnchor.position.set(0, w.y, w.z);
    leanGroup.add(wheelAnchor);
    wheels.push(wheelAnchor);

    // Outer Heavy Tire Tread
    const tireGeo = new THREE.CylinderGeometry(w.radius, w.radius, w.width, 24);
    tireGeo.rotateZ(Math.PI * 0.5);
    const tire = new THREE.Mesh(tireGeo, tireRubberMat);
    tire.castShadow = true;
    wheelAnchor.add(tire);

    // Hubless Center Void Barrel (Deep inner void)
    const voidGeo = new THREE.CylinderGeometry(w.radius * 0.62, w.radius * 0.62, w.width + 0.02, 24);
    voidGeo.rotateZ(Math.PI * 0.5);
    const voidMesh = new THREE.Mesh(voidGeo, stealthFrameMat);
    wheelAnchor.add(voidMesh);

    // CONTINUOUS BRILLIANT CYAN NEON WHEEL RINGS (Reference 3 outer illuminated rings)
    [-w.width * 0.5 - 0.005, w.width * 0.5 + 0.005].forEach((xFace) => {
      // Primary outer glowing cyan ring
      const ringGeo = new THREE.RingGeometry(w.radius * 0.66, w.radius * 0.90, 32);
      ringGeo.rotateY(Math.PI * 0.5);
      const ring = new THREE.Mesh(ringGeo, cyanNeonGlowMat);
      ring.position.x = xFace;
      wheelAnchor.add(ring);

      // Inner secondary concentric cyan accent ring
      const innerRingGeo = new THREE.RingGeometry(w.radius * 0.45, w.radius * 0.55, 24);
      innerRingGeo.rotateY(Math.PI * 0.5);
      const innerRing = new THREE.Mesh(innerRingGeo, cyanCoreGlowMat);
      innerRing.position.x = xFace;
      wheelAnchor.add(innerRing);
    });

    // Stationary Internal Hub Mechanism (Reference 3 magnetic stator caliper linkage)
    const statorGeo = new THREE.BoxGeometry(w.width + 0.04, 0.12, 0.35);
    const stator = new THREE.Mesh(statorGeo, stealthFrameMat);
    stator.position.set(0, w.y, w.isFront ? w.z + 0.22 : w.z - 0.22);
    leanGroup.add(stator);
  });

  // =========================================================================
  // 4. REAR PROPULSION & VECTORING THRUSTERS
  // =========================================================================
  const thrusterLocalCoords = [
    new THREE.Vector3(-0.16, 0.45, 1.55),
    new THREE.Vector3(0.16, 0.45, 1.55),
  ];

  thrusterLocalCoords.forEach((tPos) => {
    thrusterPositions.push(tPos);

    // Nozzle Housing
    const nozGeo = new THREE.CylinderGeometry(0.08, 0.11, 0.18, 14);
    nozGeo.rotateX(Math.PI * 0.5);
    const noz = new THREE.Mesh(nozGeo, stealthFrameMat);
    noz.position.copy(tPos);
    leanGroup.add(noz);

    // Flame Cone
    const flameGeo = new THREE.ConeGeometry(0.11, 1.15, 12);
    flameGeo.rotateX(-Math.PI * 0.5);
    flameGeo.translate(0, 0, 0.58);
    const flame = new THREE.Mesh(flameGeo, thrusterPlasmaMat);
    flame.position.copy(tPos);
    flame.scale.set(0, 0, 0);
    leanGroup.add(flame);
    thrusterFlames.push(flame);

    const pLight = new THREE.PointLight(0x00f0ff, 0, 6);
    pLight.position.copy(tPos).add(new THREE.Vector3(0, 0, 0.25));
    leanGroup.add(pLight);
    thrusterLights.push(pLight);
  });

  // =========================================================================
  // 5. LUMINOUS CYAN ENERGY LIGHT RIBBON TRAIL (Reference 3 signature)
  // =========================================================================
  const TRAIL_SEGMENTS = 24;
  const trailGeo = new THREE.PlaneGeometry(0.18, 3.4, 1, TRAIL_SEGMENTS);
  trailGeo.rotateX(Math.PI * 0.5);
  trailGeo.translate(0, 0.24, 2.8);

  const trailMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.70,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const lightTrailMesh = new THREE.Mesh(trailGeo, trailMat);
  leanGroup.add(lightTrailMesh);

  // =========================================================================
  // 6. UNDERBODY CONTACT SHADOW (Narrow motorcycle footprint)
  // =========================================================================
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 64;
  shadowCanvas.height = 256;
  const ctx = shadowCanvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 128, 6, 32, 128, 32);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.94)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.50)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 256);
  }
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeo = new THREE.PlaneGeometry(1.2, 4.4);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI * 0.5;
  contactShadow.position.set(0, 0.02, 0);

  // =========================================================================
  // 7. ANIMATION CONTROLLER (Authentic 2-Wheel & Deep Banking)
  // =========================================================================
  let localTime = 0;

  const update = (
    delta: number,
    speed: number,
    isFlying: boolean,
    altitude: number,
    flightEnergy: number,
    bankAngle: number
  ) => {
    localTime += delta;

    // Rotate 2 wheels
    const wheelRotSpeed = (speed / 3.6 / 0.48) * delta;
    wheels.forEach((w) => {
      w.rotation.x += wheelRotSpeed;
    });

    // Deep motorcycle banking (leans deeply into turns up to 35-40 degrees!)
    leanGroup.rotation.z = bankAngle * 1.70;
    leanGroup.rotation.y = -bankAngle * 0.22;
    leanGroup.rotation.x = isFlying ? -0.05 : 0;

    // Thruster flames
    const thrustActive = isFlying && flightEnergy > 0;
    const targetScale = thrustActive ? 1.0 + Math.sin(localTime * 48) * 0.2 : 0;
    thrusterFlames.forEach((flame) => {
      flame.scale.set(targetScale, targetScale, targetScale * 1.4);
      (flame.material as THREE.MeshBasicMaterial).opacity = thrustActive ? 0.95 : 0;
    });

    thrusterLights.forEach((light) => {
      light.intensity = thrustActive ? 2.8 + Math.random() * 0.6 : 0;
    });

    // Energy Light Ribbon intensity
    const isAccelerating = speed > 60;
    trailMat.opacity = isAccelerating ? (thrustActive ? 0.90 : 0.65) : 0.25;

    // Contact shadow
    contactShadow.position.x = rootGroup.position.x;
    contactShadow.position.z = rootGroup.position.z;
    const heightFactor = Math.max(0, 1 - altitude * 0.22);
    shadowMat.opacity = 0.88 * heightFactor;
    contactShadow.scale.setScalar(1 + altitude * 0.35);
  };

  const dispose = () => {
    shadowTexture.dispose();
    shadowGeo.dispose();
    shadowMat.dispose();

    rootGroup.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      }
    });
  };

  return {
    id: 'NEON_CYCLE',
    rootGroup,
    contactShadow,
    wheels,
    thrusterFlames,
    thrusterLights,
    thrusterPositions,
    lightTrailMesh,
    update,
    dispose,
  };
}
