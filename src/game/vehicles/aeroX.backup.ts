/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { VehicleModelInstance } from './vehicleTypes';

/**
 * Vehicle 01 — AERO-X
 * Directly modeled from Reference Image 1 (Lotus Evija aesthetic):
 * - Low, wide, sculpted aerodynamic British hypercar in Liquid Titanium Silver.
 * - Prominent arched front fender crests with sunken hood extraction valley.
 * - Deeply carved side air intake venturi tunnels passing through the rear haunches.
 * - Floating black panoramic teardrop glass cockpit.
 * - Active rear aerodynamic wing mounted on twin vertical stanchions.
 * - Slender multi-spoke center-lock turbine wheels with yellow calipers.
 * - Continuous razor-thin rear ruby LED light bar and quad integrated rocket boosters.
 */
export function createAeroXModel(): VehicleModelInstance {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'Vehicle_AERO_X';

  const wheels: THREE.Object3D[] = [];
  const frontSteerNodes: THREE.Object3D[] = [];
  const thrusterFlames: THREE.Mesh[] = [];
  const thrusterLights: THREE.PointLight[] = [];
  const thrusterPositions: THREE.Vector3[] = [];

  // =========================================================================
  // 1. PBR MATERIALS RIG (Accurately tuned to Reference 1)
  // =========================================================================
  // Liquid Titanium Silver with deep multi-layer clearcoat
  const titaniumBodyPaint = new THREE.MeshPhysicalMaterial({
    color: 0xb5bac3,
    metalness: 0.94,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    reflectivity: 0.98,
    envMapIntensity: 1.6,
  });

  // Dark gloss carbon-fiber aero surfaces (splitter, diffuser, wing, tunnels)
  const carbonFiberMat = new THREE.MeshStandardMaterial({
    color: 0x121418,
    metalness: 0.85,
    roughness: 0.32,
  });

  // Deep black solar-tinted panoramic canopy glass
  const canopyGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x05080e,
    metalness: 0.96,
    roughness: 0.03,
    transmission: 0.45,
    thickness: 0.8,
    transparent: true,
    opacity: 0.96,
    envMapIntensity: 2.0,
  });

  // Premium racing slick tire rubber
  const tireRubberMat = new THREE.MeshStandardMaterial({
    color: 0x16181b,
    roughness: 0.92,
    metalness: 0.04,
  });

  // Machined silver turbine wheel spoke alloy
  const rimAlloyMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6edf5,
    metalness: 0.96,
    roughness: 0.12,
    clearcoat: 0.85,
    envMapIntensity: 1.5,
  });

  // Dark titanium rim inner barrel
  const rimBarrelMat = new THREE.MeshStandardMaterial({
    color: 0x22262e,
    metalness: 0.90,
    roughness: 0.30,
  });

  // Yellow sport brake calipers (from Reference 1)
  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xebb417,
    metalness: 0.35,
    roughness: 0.22,
  });

  // Cross-drilled brake rotors
  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x7c8592,
    metalness: 0.92,
    roughness: 0.25,
  });

  // Crystalline LED headlights
  const headlightMat = new THREE.MeshBasicMaterial({
    color: 0xe0f8ff,
  });

  // Full-width razor-thin rear ruby light blade
  const rearLightBladeMat = new THREE.MeshBasicMaterial({
    color: 0xff002b,
  });

  // Rocket thrusters
  const thrusterNozzleMat = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    metalness: 0.95,
    roughness: 0.20,
  });
  const thrusterPlasmaMat = new THREE.MeshBasicMaterial({
    color: 0x00f2ff,
    transparent: true,
    opacity: 0.0,
  });

  const bodyGroup = new THREE.Group();
  rootGroup.add(bodyGroup);

  // =========================================================================
  // 2. SCULPTED MAIN MONOCOQUE & HOOD WITH SUNKEN EXTRACTION VALLEY
  // =========================================================================
  // Central underbody floor tray
  const floorTrayGeo = new THREE.BoxGeometry(1.65, 0.08, 4.3);
  const floorTray = new THREE.Mesh(floorTrayGeo, carbonFiberMat);
  floorTray.position.set(0, 0.14, 0);
  floorTray.castShadow = true;
  bodyGroup.add(floorTray);

  // Sculpted central hull body
  const centralHullGeo = new THREE.CylinderGeometry(0.85, 0.98, 4.2, 16);
  centralHullGeo.rotateX(Math.PI * 0.5);
  centralHullGeo.scale(1.05, 0.32, 1.0);
  const centralHull = new THREE.Mesh(centralHullGeo, titaniumBodyPaint);
  centralHull.position.set(0, 0.36, 0);
  centralHull.castShadow = true;
  bodyGroup.add(centralHull);

  // Front Pointed Aerodynamic Nose Prow
  const noseProwGeo = new THREE.ConeGeometry(0.78, 1.25, 14);
  noseProwGeo.rotateX(Math.PI * 0.5);
  noseProwGeo.scale(1.15, 0.30, 1.0);
  const noseProw = new THREE.Mesh(noseProwGeo, titaniumBodyPaint);
  noseProw.position.set(0, 0.30, -2.15);
  noseProw.castShadow = true;
  bodyGroup.add(noseProw);

  // Deeply Sunken Front Hood Valley (Iconic Evija extractor scoop)
  const hoodValleyGeo = new THREE.BoxGeometry(0.75, 0.08, 1.15);
  const hoodValley = new THREE.Mesh(hoodValleyGeo, carbonFiberMat);
  hoodValley.position.set(0, 0.32, -1.45);
  hoodValley.rotation.x = -0.14;
  bodyGroup.add(hoodValley);

  // High Arched Front Fender Crests (Left and Right peaks flanking the hood)
  [-0.78, 0.78].forEach((x) => {
    // Fender arch peak
    const crestCurve = new THREE.CylinderGeometry(0.22, 0.28, 1.45, 12);
    crestCurve.rotateX(Math.PI * 0.5);
    crestCurve.scale(0.85, 0.55, 1.0);
    const crest = new THREE.Mesh(crestCurve, titaniumBodyPaint);
    crest.position.set(x, 0.46, -1.35);
    crest.rotation.y = x > 0 ? -0.06 : 0.06;
    crest.castShadow = true;
    bodyGroup.add(crest);

    // Flared wheel arch crown
    const archCrownGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.16, 16, 1, false, 0, Math.PI);
    archCrownGeo.rotateZ(Math.PI * 0.5);
    const archCrown = new THREE.Mesh(archCrownGeo, titaniumBodyPaint);
    archCrown.position.set(x > 0 ? x + 0.12 : x - 0.12, 0.34, -1.25);
    bodyGroup.add(archCrown);

    // Sleek diagonal LED headlight embedded in fender crest
    const headGeo = new THREE.BoxGeometry(0.08, 0.035, 0.42);
    const headMesh = new THREE.Mesh(headGeo, headlightMat);
    headMesh.position.set(x > 0 ? x - 0.08 : x + 0.08, 0.48, -1.65);
    headMesh.rotation.y = x > 0 ? -0.15 : 0.15;
    headMesh.rotation.z = x > 0 ? -0.25 : 0.25;
    bodyGroup.add(headMesh);
  });

  // Lower Front Carbon Splitter with Central Aero Keel
  const splitterGeo = new THREE.BoxGeometry(1.95, 0.04, 0.55);
  const splitter = new THREE.Mesh(splitterGeo, carbonFiberMat);
  splitter.position.set(0, 0.11, -2.25);
  splitter.castShadow = true;
  bodyGroup.add(splitter);

  // Central splitter keel
  const keelGeo = new THREE.BoxGeometry(0.05, 0.12, 0.45);
  const keel = new THREE.Mesh(keelGeo, carbonFiberMat);
  keel.position.set(0, 0.16, -2.22);
  bodyGroup.add(keel);

  // =========================================================================
  // 3. FLOATING BLACK PANORAMIC TEARDROP CANOPY
  // =========================================================================
  // Continuous aerodynamic glass dome
  const canopyDomeGeo = new THREE.CylinderGeometry(0.48, 0.68, 1.85, 18);
  canopyDomeGeo.rotateX(Math.PI * 0.5);
  canopyDomeGeo.scale(1.15, 0.46, 1.0);
  const canopyDome = new THREE.Mesh(canopyDomeGeo, canopyGlassMat);
  canopyDome.position.set(0, 0.66, -0.05);
  canopyDome.castShadow = true;
  bodyGroup.add(canopyDome);

  // Black gloss roof panel capping the canopy
  const roofCapGeo = new THREE.CylinderGeometry(0.40, 0.48, 1.35, 14);
  roofCapGeo.rotateX(Math.PI * 0.5);
  roofCapGeo.scale(1.05, 0.20, 1.0);
  const roofCap = new THREE.Mesh(roofCapGeo, carbonFiberMat);
  roofCap.position.set(0, 0.79, 0.05);
  bodyGroup.add(roofCap);

  // Ultra-thin carbon A-pillars
  [-0.48, 0.48].forEach((x) => {
    const aPillarGeo = new THREE.CylinderGeometry(0.02, 0.025, 1.05, 8);
    const aPillar = new THREE.Mesh(aPillarGeo, carbonFiberMat);
    aPillar.position.set(x, 0.62, -0.45);
    aPillar.rotation.x = -0.55;
    aPillar.rotation.z = x > 0 ? 0.32 : -0.32;
    bodyGroup.add(aPillar);
  });

  // =========================================================================
  // 4. DEEP VENTURI AIR TUNNELS & MUSCULAR REAR HAUNCHES (Evija Signature)
  // =========================================================================
  // Deeply pinched coke-bottle waist
  [-0.85, 0.85].forEach((x) => {
    const doorWaistGeo = new THREE.BoxGeometry(0.12, 0.28, 1.6);
    const doorWaist = new THREE.Mesh(doorWaistGeo, titaniumBodyPaint);
    doorWaist.position.set(x > 0 ? x - 0.08 : x + 0.08, 0.36, 0.05);
    doorWaist.castShadow = true;
    bodyGroup.add(doorWaist);

    // Carbon side rocker blade
    const sillGeo = new THREE.BoxGeometry(0.08, 0.04, 2.05);
    const sill = new THREE.Mesh(sillGeo, carbonFiberMat);
    sill.position.set(x, 0.13, 0);
    bodyGroup.add(sill);
  });

  // Rear Venturi Flow Tunnels passing through the rear quarters
  [-0.62, 0.62].forEach((x) => {
    const tunnelGeo = new THREE.CylinderGeometry(0.24, 0.32, 1.45, 14, 1, true);
    tunnelGeo.rotateX(Math.PI * 0.5);
    tunnelGeo.scale(0.85, 0.65, 1.0);
    const tunnel = new THREE.Mesh(tunnelGeo, carbonFiberMat);
    tunnel.position.set(x, 0.44, 1.35);
    bodyGroup.add(tunnel);
  });

  // Muscular outer rear fender shoulders (encasing the venturi tunnels)
  [-0.95, 0.95].forEach((x) => {
    const haunchGeo = new THREE.CylinderGeometry(0.32, 0.36, 1.75, 14);
    haunchGeo.rotateX(Math.PI * 0.5);
    haunchGeo.scale(0.85, 0.62, 1.0);
    const haunch = new THREE.Mesh(haunchGeo, titaniumBodyPaint);
    haunch.position.set(x, 0.48, 1.25);
    haunch.castShadow = true;
    bodyGroup.add(haunch);

    // Rear wheel arch crown flare
    const rearArchGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.18, 16, 1, false, 0, Math.PI);
    rearArchGeo.rotateZ(Math.PI * 0.5);
    const rearArch = new THREE.Mesh(rearArchGeo, titaniumBodyPaint);
    rearArch.position.set(x > 0 ? x + 0.08 : x - 0.08, 0.36, 1.25);
    bodyGroup.add(rearArch);
  });

  // =========================================================================
  // 5. ACTIVE REAR WING, RUBY LED BLADE & REAR DIFFUSER
  // =========================================================================
  // Twin vertical carbon stanchions (Reference 1 active wing)
  [-0.42, 0.42].forEach((x) => {
    const stanchionGeo = new THREE.BoxGeometry(0.04, 0.28, 0.22);
    const stanchion = new THREE.Mesh(stanchionGeo, carbonFiberMat);
    stanchion.position.set(x, 0.72, 1.88);
    stanchion.rotation.x = -0.12;
    bodyGroup.add(stanchion);
  });

  // Sculpted Carbon Rear Wing Aerofoil
  const aerofoilGeo = new THREE.BoxGeometry(1.92, 0.045, 0.38);
  const aerofoil = new THREE.Mesh(aerofoilGeo, carbonFiberMat);
  aerofoil.position.set(0, 0.86, 1.95);
  aerofoil.rotation.x = 0.06;
  aerofoil.castShadow = true;
  bodyGroup.add(aerofoil);

  // Wing endplates
  [-0.96, 0.96].forEach((x) => {
    const endplateGeo = new THREE.BoxGeometry(0.02, 0.14, 0.40);
    const endplate = new THREE.Mesh(endplateGeo, carbonFiberMat);
    endplate.position.set(x, 0.86, 1.95);
    bodyGroup.add(endplate);
  });

  // Continuous Full-Width Rear Ruby LED Light Ribbon
  const rearBladeGeo = new THREE.CylinderGeometry(0.018, 0.018, 1.84, 16);
  rearBladeGeo.rotateZ(Math.PI * 0.5);
  const rearBlade = new THREE.Mesh(rearBladeGeo, rearLightBladeMat);
  rearBlade.position.set(0, 0.56, 2.22);
  bodyGroup.add(rearBlade);

  // Deep Rear Venturi Diffuser Tray
  const diffuserGeo = new THREE.BoxGeometry(1.88, 0.16, 0.85);
  const diffuser = new THREE.Mesh(diffuserGeo, carbonFiberMat);
  diffuser.position.set(0, 0.20, 1.98);
  diffuser.rotation.x = -0.16;
  diffuser.castShadow = true;
  bodyGroup.add(diffuser);

  // 4 Diffuser vertical flow fences
  [-0.60, -0.20, 0.20, 0.60].forEach((x) => {
    const fenceGeo = new THREE.BoxGeometry(0.025, 0.16, 0.82);
    const fence = new THREE.Mesh(fenceGeo, carbonFiberMat);
    fence.position.set(x, 0.20, 1.98);
    fence.rotation.x = -0.16;
    bodyGroup.add(fence);
  });

  // =========================================================================
  // 6. QUAD REAR ROCKET THRUSTER NOZZLES (For unconstrained flight)
  // =========================================================================
  const nozzlePositions = [
    new THREE.Vector3(-0.46, 0.38, 2.20),
    new THREE.Vector3(0.46, 0.38, 2.20),
    new THREE.Vector3(-0.22, 0.26, 2.22),
    new THREE.Vector3(0.22, 0.26, 2.22),
  ];

  nozzlePositions.forEach((pos, idx) => {
    thrusterPositions.push(pos);

    // Titanium Nozzle Housing
    const nozGeo = new THREE.CylinderGeometry(0.10, 0.12, 0.16, 14);
    nozGeo.rotateX(Math.PI * 0.5);
    const nozMesh = new THREE.Mesh(nozGeo, thrusterNozzleMat);
    nozMesh.position.copy(pos);
    bodyGroup.add(nozMesh);

    // Glowing Cold-Gas Plasma Core
    const coreGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 12);
    coreGeo.rotateX(Math.PI * 0.5);
    const coreMesh = new THREE.Mesh(coreGeo, thrusterPlasmaMat);
    coreMesh.position.copy(pos).add(new THREE.Vector3(0, 0, 0.06));
    bodyGroup.add(coreMesh);

    // Tapered Flame Cone
    const flameGeo = new THREE.ConeGeometry(0.11, 0.95, 12);
    flameGeo.rotateX(-Math.PI * 0.5);
    flameGeo.translate(0, 0, 0.48);
    const flameMesh = new THREE.Mesh(flameGeo, thrusterPlasmaMat);
    flameMesh.position.copy(pos);
    flameMesh.scale.set(0, 0, 0);
    rootGroup.add(flameMesh);
    thrusterFlames.push(flameMesh);

    // Point Light for ground/exhaust illumination
    if (idx < 2) {
      const pLight = new THREE.PointLight(0x00f2ff, 0, 6);
      pLight.position.copy(pos).add(new THREE.Vector3(0, 0, 0.3));
      rootGroup.add(pLight);
      thrusterLights.push(pLight);
    }
  });

  // =========================================================================
  // 7. HIGH-DETAIL WHEELS (Slender Multi-Spoke Rims with Yellow Calipers)
  // =========================================================================
  const wheelSpecs = [
    { x: -0.90, y: 0.32, z: -1.25, isFront: true, isLeft: true },
    { x: 0.90, y: 0.32, z: -1.25, isFront: true, isLeft: false },
    { x: -0.96, y: 0.35, z: 1.25, isFront: false, isLeft: true },
    { x: 0.96, y: 0.35, z: 1.25, isFront: false, isLeft: false },
  ];

  wheelSpecs.forEach((spec) => {
    const wheelAnchor = new THREE.Group();
    wheelAnchor.position.set(spec.x, spec.y, spec.z);
    rootGroup.add(wheelAnchor);

    if (spec.isFront) {
      frontSteerNodes.push(wheelAnchor);
    }

    const rotatingHub = new THREE.Group();
    wheelAnchor.add(rotatingHub);
    wheels.push(rotatingHub);

    const radius = spec.isFront ? 0.32 : 0.35;
    const width = spec.isFront ? 0.22 : 0.26;

    // Performance low-profile tire
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
    tireGeo.rotateZ(Math.PI * 0.5);
    const tireMesh = new THREE.Mesh(tireGeo, tireRubberMat);
    tireMesh.castShadow = true;
    rotatingHub.add(tireMesh);

    // Dark Titanium Rim Barrel
    const rimR = radius * 0.74;
    const rimGeo = new THREE.CylinderGeometry(rimR, rimR, width + 0.005, 20);
    rimGeo.rotateZ(Math.PI * 0.5);
    const rimMesh = new THREE.Mesh(rimGeo, rimBarrelMat);
    rotatingHub.add(rimMesh);

    // Slender Multi-Spoke Turbine Rims (10 thin paired blades matching Ref 1)
    const spokeCount = 10;
    const faceX = (spec.isLeft ? -width * 0.5 : width * 0.5) * 0.92;

    for (let s = 0; s < spokeCount; s++) {
      const angle = (s / spokeCount) * Math.PI * 2;
      const spokeGeo = new THREE.BoxGeometry(0.025, rimR * 0.90, 0.035);
      const spokeMesh = new THREE.Mesh(spokeGeo, rimAlloyMat);
      spokeMesh.position.set(
        faceX,
        Math.cos(angle) * rimR * 0.45,
        Math.sin(angle) * rimR * 0.45
      );
      spokeMesh.rotation.x = angle;
      rotatingHub.add(spokeMesh);
    }

    // Center-Lock Hex Nut (Blue accent from Ref 1)
    const centerNutMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8, // Anodized Blue center nut
      metalness: 0.92,
      roughness: 0.20,
    });
    const nutGeo = new THREE.CylinderGeometry(rimR * 0.18, rimR * 0.18, 0.025, 6);
    nutGeo.rotateZ(Math.PI * 0.5);
    const nutMesh = new THREE.Mesh(nutGeo, centerNutMat);
    nutMesh.position.x = faceX;
    rotatingHub.add(nutMesh);

    // Stationary Cross-Drilled Rotor & Yellow Sport Caliper on Anchor
    const rotorGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, 0.02, 16);
    rotorGeo.rotateZ(Math.PI * 0.5);
    const rotorMesh = new THREE.Mesh(rotorGeo, rotorMat);
    rotorMesh.position.x = spec.isLeft ? 0.02 : -0.02;
    wheelAnchor.add(rotorMesh);

    const caliperGeo = new THREE.BoxGeometry(0.06, radius * 0.38, radius * 0.28);
    const caliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
    caliperMesh.position.set(spec.isLeft ? -0.035 : 0.035, radius * 0.32, 0);
    wheelAnchor.add(caliperMesh);
  });

  // =========================================================================
  // 8. REALISTIC UNDERBODY CONTACT SHADOW
  // =========================================================================
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 256;
  const ctx = shadowCanvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 128, 12, 64, 128, 64);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.92)');
    gradient.addColorStop(0.5, 'rgba(0, 0, 0, 0.55)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 256);
  }
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeo = new THREE.PlaneGeometry(2.6, 5.2);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.rotation.x = -Math.PI * 0.5;
  contactShadow.position.set(0, 0.02, 0);

  // =========================================================================
  // 9. ANIMATION UPDATE & CLEANUP HOOKS
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

    // Rotate wheels based on road velocity
    const wheelRotSpeed = (speed / 3.6 / 0.33) * delta;
    wheels.forEach((w) => {
      w.rotation.x += wheelRotSpeed;
    });

    // Front steering response
    frontSteerNodes.forEach((node) => {
      node.rotation.y = -bankAngle * 0.45;
    });

    // Roll and pitch
    bodyGroup.rotation.z = bankAngle * 0.35;
    bodyGroup.rotation.x = isFlying ? -0.06 : 0;

    // Thruster flame exhaust
    const thrustActive = isFlying && flightEnergy > 0;
    const targetScale = thrustActive ? 1.0 + Math.sin(localTime * 45) * 0.18 : 0;
    thrusterFlames.forEach((flame) => {
      flame.scale.set(targetScale, targetScale, targetScale * 1.35);
      (flame.material as THREE.MeshBasicMaterial).opacity = thrustActive ? 0.95 : 0;
    });

    thrusterLights.forEach((light) => {
      light.intensity = thrustActive ? 2.8 + Math.random() * 0.8 : 0;
    });

    // Contact shadow
    contactShadow.position.x = rootGroup.position.x;
    contactShadow.position.z = rootGroup.position.z;
    const heightFactor = Math.max(0, 1 - altitude * 0.22);
    shadowMat.opacity = 0.85 * heightFactor;
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
    id: 'AERO_X',
    rootGroup,
    contactShadow,
    wheels,
    frontSteerNodes,
    thrusterFlames,
    thrusterLights,
    thrusterPositions,
    update,
    dispose,
  };
}
