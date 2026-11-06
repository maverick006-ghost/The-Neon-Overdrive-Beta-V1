/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { VehicleModelInstance } from './vehicleTypes';

/**
 * Vehicle 02 — CYBER GT
 * Directly modeled from Reference Image 2 (Porsche Mission X aesthetic):
 * - Aggressive futuristic endurance hypercar in Deep Rocket Metallic Bronze / Dark Graphite.
 * - Prominent raised front wheel arch blisters flanking a recessed, low front prow.
 * - Distinctive vertical quad-element LED light towers on the front fender faces.
 * - Lightweight dome glass cockpit canopy with exposed carbon exoskeleton framing.
 * - Muscular rounded rear haunches sweeping smoothly into the aerodynamic rear deck.
 * - Sculpted 5-bifurcated-arm aerodynamic magnesium wheels with center locks.
 * - Dual integrated high-output plasma rocket thrusters with subtle cyan energy accents.
 */
export function createCyberGTModel(): VehicleModelInstance {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'Vehicle_CYBER_GT';

  const wheels: THREE.Object3D[] = [];
  const frontSteerNodes: THREE.Object3D[] = [];
  const thrusterFlames: THREE.Mesh[] = [];
  const thrusterLights: THREE.PointLight[] = [];
  const thrusterPositions: THREE.Vector3[] = [];

  // =========================================================================
  // 1. PBR MATERIALS RIG (Accurately tuned to Reference 2)
  // =========================================================================
  // Deep Rocket Metallic Bronze / Dark Graphite (Reference 2 paint)
  const graphiteBronzePaint = new THREE.MeshPhysicalMaterial({
    color: 0x302e2b,
    metalness: 0.92,
    roughness: 0.22,
    clearcoat: 0.90,
    clearcoatRoughness: 0.08,
    reflectivity: 0.92,
    envMapIntensity: 1.5,
  });

  // Matte stealth carbon-composite aero components
  const matteCarbonMat = new THREE.MeshStandardMaterial({
    color: 0x111214,
    metalness: 0.75,
    roughness: 0.45,
  });

  // Dome cockpit lightweight glass
  const domeGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x080a0e,
    metalness: 0.96,
    roughness: 0.04,
    transmission: 0.45,
    thickness: 0.75,
    transparent: true,
    opacity: 0.96,
    envMapIntensity: 1.8,
  });

  // Performance racing slick tires
  const tireRubberMat = new THREE.MeshStandardMaterial({
    color: 0x141618,
    roughness: 0.92,
    metalness: 0.04,
  });

  // Sculpted bronze-graphite alloy wheels (Reference 2 rims)
  const rimBronzeMat = new THREE.MeshPhysicalMaterial({
    color: 0xa89a88,
    metalness: 0.94,
    roughness: 0.20,
    clearcoat: 0.75,
    envMapIntensity: 1.4,
  });

  // Dark inner barrel
  const rimBarrelMat = new THREE.MeshStandardMaterial({
    color: 0x181a1e,
    metalness: 0.90,
    roughness: 0.32,
  });

  // Dark stealth brake calipers
  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.65,
    roughness: 0.25,
  });

  // Vertical Quad-Element Headlight Light Towers (Reference 2)
  const verticalHeadlightMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
  });

  // Cyan-blue illuminated detailing used sparingly (as requested)
  const cyanDetailMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
  });

  // Rear light blade
  const rearLightBladeMat = new THREE.MeshBasicMaterial({
    color: 0xff1e28,
  });

  // High-output plasma thrusters
  const thrusterNozzleMat = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    metalness: 0.96,
    roughness: 0.18,
  });
  const thrusterPlasmaMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    transparent: true,
    opacity: 0.0,
  });

  const bodyGroup = new THREE.Group();
  rootGroup.add(bodyGroup);

  // =========================================================================
  // 2. MUSCULAR MAIN MONOCOQUE & RAISED FRONT FENDER BLISTERS
  // =========================================================================
  // Low-slung carbon floor
  const floorGeo = new THREE.BoxGeometry(1.85, 0.08, 4.4);
  const floor = new THREE.Mesh(floorGeo, matteCarbonMat);
  floor.position.set(0, 0.14, 0);
  floor.castShadow = true;
  bodyGroup.add(floor);

  // Wide, sculpted muscular fuselage
  const fuselageGeo = new THREE.CylinderGeometry(0.92, 1.05, 4.3, 16);
  fuselageGeo.rotateX(Math.PI * 0.5);
  fuselageGeo.scale(1.08, 0.34, 1.0);
  const fuselage = new THREE.Mesh(fuselageGeo, graphiteBronzePaint);
  fuselage.position.set(0, 0.36, 0);
  fuselage.castShadow = true;
  bodyGroup.add(fuselage);

  // Low Recessed Front Nose with Central Air Dam (Reference 2)
  const frontNoseGeo = new THREE.BoxGeometry(0.95, 0.24, 1.4);
  const frontNose = new THREE.Mesh(frontNoseGeo, graphiteBronzePaint);
  frontNose.position.set(0, 0.30, -1.65);
  frontNose.rotation.x = -0.15;
  frontNose.castShadow = true;
  bodyGroup.add(frontNose);

  // Front Carbon Splitter with Dual Tunnels
  const splitterGeo = new THREE.BoxGeometry(2.05, 0.05, 0.55);
  const splitter = new THREE.Mesh(splitterGeo, matteCarbonMat);
  splitter.position.set(0, 0.11, -2.25);
  splitter.castShadow = true;
  bodyGroup.add(splitter);

  // Prominent Raised Front Wheel Blisters (Iconic Mission X arch towers)
  [-0.85, 0.85].forEach((x) => {
    // High-standing arched blister
    const blisterGeo = new THREE.CylinderGeometry(0.26, 0.32, 1.55, 14);
    blisterGeo.rotateX(Math.PI * 0.5);
    blisterGeo.scale(0.88, 0.65, 1.0);
    const blister = new THREE.Mesh(blisterGeo, graphiteBronzePaint);
    blister.position.set(x, 0.52, -1.30);
    blister.castShadow = true;
    bodyGroup.add(blister);

    // Front Wheel Arch Flare
    const flareGeo = new THREE.CylinderGeometry(0.44, 0.44, 0.18, 16, 1, false, 0, Math.PI);
    flareGeo.rotateZ(Math.PI * 0.5);
    const flare = new THREE.Mesh(flareGeo, graphiteBronzePaint);
    flare.position.set(x > 0 ? x + 0.12 : x - 0.12, 0.36, -1.25);
    bodyGroup.add(flare);

    // DISTINCTIVE VERTICAL QUAD-ELEMENT LIGHT TOWER (Leading edge of front fender)
    const towerHousingGeo = new THREE.BoxGeometry(0.06, 0.38, 0.08);
    const towerHousing = new THREE.Mesh(towerHousingGeo, matteCarbonMat);
    towerHousing.position.set(x > 0 ? x - 0.06 : x + 0.06, 0.42, -2.12);
    bodyGroup.add(towerHousing);

    // 4 Distinct stacked LED light modules
    for (let l = 0; l < 4; l++) {
      const ledGeo = new THREE.BoxGeometry(0.045, 0.055, 0.03);
      const ledMesh = new THREE.Mesh(ledGeo, verticalHeadlightMat);
      ledMesh.position.set(
        x > 0 ? x - 0.06 : x + 0.06,
        0.28 + l * 0.085,
        -2.16
      );
      bodyGroup.add(ledMesh);
    }
  });

  // =========================================================================
  // 3. DOME GLASS COCKPIT CANOPY WITH CARBON EXOSKELETON
  // =========================================================================
  // Rounded bubble canopy (Reference 2 dome)
  const domeGeo = new THREE.SphereGeometry(0.72, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
  domeGeo.scale(0.95, 0.55, 1.45);
  const dome = new THREE.Mesh(domeGeo, domeGlassMat);
  dome.position.set(0, 0.48, 0.05);
  dome.castShadow = true;
  bodyGroup.add(dome);

  // Carbon Exoskeleton Framing Arches across the canopy
  [-0.38, 0.38].forEach((x) => {
    const frameArchGeo = new THREE.TorusGeometry(0.56, 0.025, 8, 18, Math.PI);
    frameArchGeo.rotateX(Math.PI * 0.5);
    frameArchGeo.rotateY(Math.PI * 0.5);
    frameArchGeo.scale(1.25, 0.85, 0.4);
    const frameArch = new THREE.Mesh(frameArchGeo, matteCarbonMat);
    frameArch.position.set(x, 0.50, 0.05);
    bodyGroup.add(frameArch);
  });

  // Center roof spine with subtle cyan illuminated status dot
  const centerSpineGeo = new THREE.BoxGeometry(0.04, 0.03, 1.4);
  const centerSpine = new THREE.Mesh(centerSpineGeo, matteCarbonMat);
  centerSpine.position.set(0, 0.84, 0.05);
  bodyGroup.add(centerSpine);

  const cyanRoofAccent = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.3), cyanDetailMat);
  cyanRoofAccent.position.set(0, 0.85, 0.5);
  bodyGroup.add(cyanRoofAccent);

  // =========================================================================
  // 4. SCULPTED SIDE PANELS & HIGH MUSCULAR REAR HAUNCHES
  // =========================================================================
  // Sculpted side doors with lower carbon sill blades
  [-0.92, 0.92].forEach((x) => {
    const doorGeo = new THREE.BoxGeometry(0.14, 0.32, 1.7);
    const door = new THREE.Mesh(doorGeo, graphiteBronzePaint);
    door.position.set(x > 0 ? x - 0.08 : x + 0.08, 0.38, 0.0);
    door.castShadow = true;
    bodyGroup.add(door);

    const sillGeo = new THREE.BoxGeometry(0.10, 0.04, 2.15);
    const sill = new THREE.Mesh(sillGeo, matteCarbonMat);
    sill.position.set(x, 0.13, 0.0);
    bodyGroup.add(sill);

    // Subtle cyan illumination accent along the lower sill (used sparingly)
    const cyanSillGeo = new THREE.BoxGeometry(0.015, 0.015, 0.85);
    const cyanSill = new THREE.Mesh(cyanSillGeo, cyanDetailMat);
    cyanSill.position.set(x > 0 ? x + 0.045 : x - 0.045, 0.16, 0.0);
    bodyGroup.add(cyanSill);
  });

  // Muscular high-arching rear haunches (Reference 2 rear fenders)
  [-1.02, 1.02].forEach((x) => {
    const rearHaunchGeo = new THREE.CylinderGeometry(0.36, 0.40, 1.85, 14);
    rearHaunchGeo.rotateX(Math.PI * 0.5);
    rearHaunchGeo.scale(0.88, 0.65, 1.0);
    const rearHaunch = new THREE.Mesh(rearHaunchGeo, graphiteBronzePaint);
    rearHaunch.position.set(x, 0.52, 1.25);
    rearHaunch.castShadow = true;
    bodyGroup.add(rearHaunch);

    // Rear Wheel Arch Flare
    const flareGeo = new THREE.CylinderGeometry(0.46, 0.46, 0.20, 16, 1, false, 0, Math.PI);
    flareGeo.rotateZ(Math.PI * 0.5);
    const flare = new THREE.Mesh(flareGeo, graphiteBronzePaint);
    flare.position.set(x > 0 ? x + 0.10 : x - 0.10, 0.38, 1.25);
    bodyGroup.add(flare);
  });

  // Long aerodynamic rear deck flowing into active spoiler
  const rearDeckGeo = new THREE.BoxGeometry(1.65, 0.12, 1.35);
  const rearDeck = new THREE.Mesh(rearDeckGeo, graphiteBronzePaint);
  rearDeck.position.set(0, 0.52, 1.55);
  rearDeck.rotation.x = 0.06;
  rearDeck.castShadow = true;
  bodyGroup.add(rearDeck);

  // Integrated Full-Width Rear LED Light Blade
  const rearLightGeo = new THREE.BoxGeometry(1.88, 0.035, 0.04);
  const rearLight = new THREE.Mesh(rearLightGeo, rearLightBladeMat);
  rearLight.position.set(0, 0.58, 2.22);
  bodyGroup.add(rearLight);

  // Underbody Venturi Diffuser
  const diffuserGeo = new THREE.BoxGeometry(1.95, 0.18, 0.90);
  const diffuser = new THREE.Mesh(diffuserGeo, matteCarbonMat);
  diffuser.position.set(0, 0.20, 2.05);
  diffuser.rotation.x = -0.15;
  diffuser.castShadow = true;
  bodyGroup.add(diffuser);

  // =========================================================================
  // 5. DUAL HIGH-OUTPUT PLASMA PROPULSION (Rear thruster ports)
  // =========================================================================
  const thrusterLocalCoords = [
    new THREE.Vector3(-0.48, 0.38, 2.22),
    new THREE.Vector3(0.48, 0.38, 2.22),
  ];

  thrusterLocalCoords.forEach((tPos) => {
    thrusterPositions.push(tPos);

    // Titanium Propulsion Housing
    const nozGeo = new THREE.CylinderGeometry(0.14, 0.17, 0.20, 16);
    nozGeo.rotateX(Math.PI * 0.5);
    const noz = new THREE.Mesh(nozGeo, thrusterNozzleMat);
    noz.position.copy(tPos);
    bodyGroup.add(noz);

    // Glowing Cyan Core
    const coreGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 14);
    coreGeo.rotateX(Math.PI * 0.5);
    const core = new THREE.Mesh(coreGeo, thrusterPlasmaMat);
    core.position.copy(tPos).add(new THREE.Vector3(0, 0, 0.08));
    bodyGroup.add(core);

    // Flame Cone
    const flameGeo = new THREE.ConeGeometry(0.16, 1.25, 14);
    flameGeo.rotateX(-Math.PI * 0.5);
    flameGeo.translate(0, 0, 0.62);
    const flame = new THREE.Mesh(flameGeo, thrusterPlasmaMat);
    flame.position.copy(tPos);
    flame.scale.set(0, 0, 0);
    rootGroup.add(flame);
    thrusterFlames.push(flame);

    const pLight = new THREE.PointLight(0x00f0ff, 0, 8);
    pLight.position.copy(tPos).add(new THREE.Vector3(0, 0, 0.35));
    rootGroup.add(pLight);
    thrusterLights.push(pLight);
  });

  // =========================================================================
  // 6. DETAILED 5-BIFURCATED-ARM BRONZE WHEELS (Reference 2 Rims)
  // =========================================================================
  const wheelSpecs = [
    { x: -0.92, y: 0.33, z: -1.25, isFront: true, isLeft: true },
    { x: 0.92, y: 0.33, z: -1.25, isFront: true, isLeft: false },
    { x: -1.02, y: 0.36, z: 1.25, isFront: false, isLeft: true },
    { x: 1.02, y: 0.36, z: 1.25, isFront: false, isLeft: false },
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

    const radius = spec.isFront ? 0.33 : 0.36;
    const width = spec.isFront ? 0.24 : 0.28;

    // Racing tire
    const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
    tireGeo.rotateZ(Math.PI * 0.5);
    const tire = new THREE.Mesh(tireGeo, tireRubberMat);
    tire.castShadow = true;
    rotatingHub.add(tire);

    // Inner Barrel
    const rimR = radius * 0.74;
    const barrelGeo = new THREE.CylinderGeometry(rimR, rimR, width + 0.005, 20);
    barrelGeo.rotateZ(Math.PI * 0.5);
    const barrel = new THREE.Mesh(barrelGeo, rimBarrelMat);
    rotatingHub.add(barrel);

    // 5 Bifurcated (Tuned V-pair) Bronze Spokes (Matching Reference 2)
    const spokeCount = 5;
    const faceX = (spec.isLeft ? -width * 0.5 : width * 0.5) * 0.92;

    for (let s = 0; s < spokeCount; s++) {
      const angle = (s / spokeCount) * Math.PI * 2;
      // Twin arms forming bifurcated V-spoke
      [-0.08, 0.08].forEach((offsetAngle) => {
        const spokeGeo = new THREE.BoxGeometry(0.028, rimR * 0.88, 0.04);
        const spoke = new THREE.Mesh(spokeGeo, rimBronzeMat);
        const totalAngle = angle + offsetAngle;
        spoke.position.set(
          faceX,
          Math.cos(totalAngle) * rimR * 0.44,
          Math.sin(totalAngle) * rimR * 0.44
        );
        spoke.rotation.x = totalAngle;
        rotatingHub.add(spoke);
      });
    }

    // Center-Lock Cap
    const capGeo = new THREE.CylinderGeometry(rimR * 0.20, rimR * 0.20, 0.025, 8);
    capGeo.rotateZ(Math.PI * 0.5);
    const cap = new THREE.Mesh(capGeo, rimBronzeMat);
    cap.position.x = faceX;
    rotatingHub.add(cap);

    // Stationary Brake Rotor & Caliper on Anchor
    const rotorGeo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, 0.02, 16);
    rotorGeo.rotateZ(Math.PI * 0.5);
    const rotor = new THREE.Mesh(rotorGeo, new THREE.MeshStandardMaterial({ color: 0x777e8a, metalness: 0.9, roughness: 0.28 }));
    rotor.position.x = spec.isLeft ? 0.02 : -0.02;
    wheelAnchor.add(rotor);

    const caliperGeo = new THREE.BoxGeometry(0.06, radius * 0.36, radius * 0.26);
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(spec.isLeft ? -0.035 : 0.035, radius * 0.32, 0);
    wheelAnchor.add(caliper);
  });

  // =========================================================================
  // 7. UNDERBODY CONTACT SHADOW
  // =========================================================================
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 128;
  shadowCanvas.height = 256;
  const ctx = shadowCanvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(64, 128, 12, 64, 128, 64);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.94)');
    gradient.addColorStop(0.55, 'rgba(0, 0, 0, 0.60)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 256);
  }
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowGeo = new THREE.PlaneGeometry(2.8, 5.4);
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
  // 8. ANIMATION CONTROLLER
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

    const wheelRotSpeed = (speed / 3.6 / 0.35) * delta;
    wheels.forEach((w) => {
      w.rotation.x += wheelRotSpeed;
    });

    frontSteerNodes.forEach((node) => {
      node.rotation.y = -bankAngle * 0.40;
    });

    bodyGroup.rotation.z = bankAngle * 0.38;
    bodyGroup.rotation.x = isFlying ? -0.07 : 0;

    const thrustActive = isFlying && flightEnergy > 0;
    const targetScale = thrustActive ? 1.05 + Math.sin(localTime * 50) * 0.22 : 0;
    thrusterFlames.forEach((flame) => {
      flame.scale.set(targetScale, targetScale, targetScale * 1.5);
      (flame.material as THREE.MeshBasicMaterial).opacity = thrustActive ? 0.98 : 0;
    });

    thrusterLights.forEach((light) => {
      light.intensity = thrustActive ? 3.6 + Math.random() * 1.0 : 0;
    });

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
    id: 'CYBER_GT',
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
