/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';

export interface RoadsterMeshes {
  rootGroup: THREE.Group;
  bodyMesh: THREE.Mesh;
  canopyMesh: THREE.Mesh;
  wheels: THREE.Group[];
  thrusterPlumes: THREE.Group[];
  thrusterLight: THREE.PointLight;
  contactShadow: THREE.Mesh;
  rearLightBar: THREE.Mesh;
  rearLight: THREE.PointLight;
}

/**
 * Creates an authentic, sculptural Silver Electric Hypercar Roadster model
 * based on the sleek, enclosed, aerodynamic supercar silhouette:
 * - Low, ultra-wide stance with broad silver wedge body (width 2.04m front, 2.16m rear)
 * - Sculpted front nose tapering smoothly to an integrated aerodynamic carbon splitter
 * - Muscular arched front fenders that completely wrap over and enclose the front wheels
 * - Low, sweeping hood with recessed aerodynamic valley and muscular crests
 * - Wide panoramic dark smoked-glass canopy in a smooth low-slung teardrop dome
 * - Athletic waist with sculpted side intake coves flowing into massive muscular rear haunches
 * - Rear haunches that flare out and completely cover the wide rear tires
 * - Fastback rear deck terminating in an integrated ducktail spoiler lip
 * - Razor-thin continuous curved red LED light bar embedded directly into the rear fascia
 * - Four wheels recessed cleanly inside the fender silhouette with diamond-cut aero turbine rims
 * - Clean underside with four symmetric compact rocket thrusters and wide rear carbon diffuser
 */
export function createRoadsterModel(): RoadsterMeshes {
  const rootGroup = new THREE.Group();

  // ==========================================
  // 1. Premium Automotive Materials
  // ==========================================

  // Liquid Tungsten-Silver Metallic Paint
  // Physical material with rich clearcoat and controlled specular sheen
  const silverBodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x666f7e, // Deep liquid titanium / tungsten silver base
    metalness: 0.90,
    roughness: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.95,
    envMapIntensity: 1.2,
  });

  // Dark satin carbon-fiber aerodynamic trim
  const carbonAeroMat = new THREE.MeshStandardMaterial({
    color: 0x11141a,
    metalness: 0.70,
    roughness: 0.35,
    envMapIntensity: 0.8,
  });

  // Dark wheel well liner & underbody lining
  const underbodyMat = new THREE.MeshBasicMaterial({
    color: 0x080a0e,
  });

  // Deep obsidian smoked-glass panoramic canopy
  const smokedGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x04060a,
    metalness: 0.12,
    roughness: 0.03,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    transmission: 0.14,
    thickness: 0.4,
    envMapIntensity: 1.5,
  });

  // Matte performance tire rubber
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x121417,
    roughness: 0.88,
    metalness: 0.04,
  });

  // Titanium rim barrel
  const rimBarrelMat = new THREE.MeshStandardMaterial({
    color: 0x1b202a,
    metalness: 0.88,
    roughness: 0.32,
  });

  // Diamond-cut machined silver aero turbine blades
  const rimSpokeMat = new THREE.MeshPhysicalMaterial({
    color: 0xd8e0ec,
    metalness: 0.96,
    roughness: 0.12,
    clearcoat: 0.9,
    envMapIntensity: 1.4,
  });

  // Cross-drilled brake rotor disc
  const rotorMat = new THREE.MeshStandardMaterial({
    color: 0x7b8390,
    metalness: 0.92,
    roughness: 0.26,
  });

  // Sport red brake caliper
  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xd60028,
    metalness: 0.4,
    roughness: 0.25,
  });

  // Continuous razor-thin red rear LED light bar
  const redNeonMat = new THREE.MeshBasicMaterial({
    color: 0xff0033,
  });

  // Front slim crystal LED matrix blade headlights
  const headlightLedMat = new THREE.MeshBasicMaterial({
    color: 0xe6f4fe,
  });

  // Underside rocket thrusters
  const thrusterMetalMat = new THREE.MeshStandardMaterial({
    color: 0x1a212e,
    metalness: 0.94,
    roughness: 0.20,
  });

  const thrusterRingMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
  });

  // ==========================================
  // 2. Continuous Sculpted Monocoque Body
  // ==========================================
  // Parametric cross-sectional lofting from Front Wedge (Z = -2.25) to Kamm Tail (Z = +2.18)
  // The body forms a continuous, low-slung aerodynamic sports car envelope:
  // - Muscular front fenders that rise up to Y = 0.60 and wrap OVER the front wheels (top Y = 0.56)
  // - Muscular rear haunches that flare out to half-width 1.08m and rise to Y = 0.70 over the rear wheels (top Y = 0.58)
  // - Substantial waist (half-width 0.95m) with sculpted lower side coves
  // - Wheel arch cutouts seamlessly integrated into the rocker sills

  interface BodySlice {
    z: number;
    halfWidth: number;
    yBottom: number;
    ySill: number;
    yArchCutout: number;
    yBelt: number;
    yCrown: number;
    yValley: number;
    ySpine: number;
  }

  const rawSlices: BodySlice[] = [
    // --- NOSE & FRONT WEDGE (Z = -2.25 to -1.80) ---
    { z: -2.25, halfWidth: 0.48, yBottom: 0.12, ySill: 0.14, yArchCutout: 0.14, yBelt: 0.18, yCrown: 0.21, yValley: 0.19, ySpine: 0.20 },
    { z: -2.10, halfWidth: 0.65, yBottom: 0.12, ySill: 0.15, yArchCutout: 0.15, yBelt: 0.23, yCrown: 0.28, yValley: 0.24, ySpine: 0.25 },
    { z: -1.90, halfWidth: 0.82, yBottom: 0.12, ySill: 0.16, yArchCutout: 0.16, yBelt: 0.29, yCrown: 0.36, yValley: 0.30, ySpine: 0.31 },
    { z: -1.70, halfWidth: 0.96, yBottom: 0.12, ySill: 0.18, yArchCutout: 0.18, yBelt: 0.36, yCrown: 0.45, yValley: 0.35, ySpine: 0.37 },

    // --- FRONT WHEEL ARCH & FENDER (Front wheel center at Z = -1.30, R = 0.28, top of tire = 0.56) ---
    // Muscular front fenders arch OVER the wheels up to Y = 0.60, with halfWidth = 1.02 covering outer tire at 0.92
    { z: -1.54, halfWidth: 1.01, yBottom: 0.13, ySill: 0.19, yArchCutout: 0.24, yBelt: 0.42, yCrown: 0.54, yValley: 0.38, ySpine: 0.40 },
    { z: -1.42, halfWidth: 1.02, yBottom: 0.13, ySill: 0.22, yArchCutout: 0.34, yBelt: 0.47, yCrown: 0.58, yValley: 0.40, ySpine: 0.42 },
    { z: -1.30, halfWidth: 1.03, yBottom: 0.13, ySill: 0.24, yArchCutout: 0.38, yBelt: 0.49, yCrown: 0.60, yValley: 0.42, ySpine: 0.44 }, // Front Wheel Apex
    { z: -1.18, halfWidth: 1.02, yBottom: 0.13, ySill: 0.22, yArchCutout: 0.34, yBelt: 0.48, yCrown: 0.59, yValley: 0.43, ySpine: 0.45 },
    { z: -1.06, halfWidth: 1.00, yBottom: 0.13, ySill: 0.19, yArchCutout: 0.24, yBelt: 0.45, yCrown: 0.57, yValley: 0.44, ySpine: 0.46 },

    // --- HOOD COWL & ATHLETIC CABIN WAIST (Z = -0.80 to +0.55) ---
    // Substantial sports car body (width 1.90m - 1.96m), never a pinched pod!
    { z: -0.80, halfWidth: 0.98, yBottom: 0.13, ySill: 0.15, yArchCutout: 0.16, yBelt: 0.43, yCrown: 0.54, yValley: 0.46, ySpine: 0.48 },
    { z: -0.55, halfWidth: 0.96, yBottom: 0.13, ySill: 0.15, yArchCutout: 0.15, yBelt: 0.44, yCrown: 0.53, yValley: 0.48, ySpine: 0.50 }, // Windshield Cowl
    { z: -0.20, halfWidth: 0.95, yBottom: 0.13, ySill: 0.15, yArchCutout: 0.15, yBelt: 0.45, yCrown: 0.53, yValley: 0.49, ySpine: 0.51 }, // Waist Minimum
    { z:  0.15, halfWidth: 0.96, yBottom: 0.13, ySill: 0.15, yArchCutout: 0.15, yBelt: 0.46, yCrown: 0.54, yValley: 0.50, ySpine: 0.52 },
    { z:  0.45, halfWidth: 0.98, yBottom: 0.13, ySill: 0.16, yArchCutout: 0.16, yBelt: 0.48, yCrown: 0.57, yValley: 0.52, ySpine: 0.54 },

    // --- REAR HAUNCH FLARING & REAR WHEEL ARCH (Rear wheel center at Z = +1.30, R = 0.29, top of tire = 0.58) ---
    // Massive muscular rear hips flaring out to 2.16m width and rising to Y = 0.70 over the rear wheels
    { z:  0.75, halfWidth: 1.03, yBottom: 0.13, ySill: 0.16, yArchCutout: 0.17, yBelt: 0.52, yCrown: 0.63, yValley: 0.54, ySpine: 0.57 },
    { z:  1.02, halfWidth: 1.07, yBottom: 0.14, ySill: 0.20, yArchCutout: 0.26, yBelt: 0.56, yCrown: 0.67, yValley: 0.56, ySpine: 0.59 },
    { z:  1.16, halfWidth: 1.08, yBottom: 0.14, ySill: 0.23, yArchCutout: 0.35, yBelt: 0.58, yCrown: 0.69, yValley: 0.57, ySpine: 0.60 },
    { z:  1.30, halfWidth: 1.08, yBottom: 0.14, ySill: 0.25, yArchCutout: 0.39, yBelt: 0.60, yCrown: 0.70, yValley: 0.58, ySpine: 0.61 }, // Rear Wheel Apex
    { z:  1.44, halfWidth: 1.08, yBottom: 0.14, ySill: 0.23, yArchCutout: 0.35, yBelt: 0.59, yCrown: 0.70, yValley: 0.59, ySpine: 0.62 },
    { z:  1.58, halfWidth: 1.07, yBottom: 0.14, ySill: 0.20, yArchCutout: 0.26, yBelt: 0.58, yCrown: 0.69, yValley: 0.60, ySpine: 0.63 },

    // --- REAR QUARTER & DUCKTAIL KAMM TAIL (Z = +1.80 to +2.18) ---
    // Rear body wraps completely behind the rear wheels into the rear fascia and integrated spoiler lip
    { z:  1.82, halfWidth: 1.04, yBottom: 0.16, ySill: 0.18, yArchCutout: 0.18, yBelt: 0.57, yCrown: 0.69, yValley: 0.62, ySpine: 0.65 },
    { z:  2.02, halfWidth: 1.00, yBottom: 0.20, ySill: 0.22, yArchCutout: 0.22, yBelt: 0.58, yCrown: 0.69, yValley: 0.65, ySpine: 0.67 },
    { z:  2.18, halfWidth: 0.96, yBottom: 0.24, ySill: 0.26, yArchCutout: 0.26, yBelt: 0.59, yCrown: 0.70, yValley: 0.67, ySpine: 0.69 }, // Ducktail Lip
  ];

  const bodyVertices: number[] = [];
  const bodyIndices: number[] = [];

  // 19 profile points across each cross-section for silky-smooth, cohesive surfaces
  // 0: Underbody channel edge (-w * 0.40, yBottom)
  // 1: Rocker undertray seam (-w * 0.75, yBottom)
  // 2: Outer rocker / wheel arch cutout lip (-w * 0.98, yArchCutout)
  // 3: Lower chine flare (-w * 1.00, yChine)
  // 4: Mid-body cove concavity (-w * 0.95, yMidBody)
  // 5: Beltline shoulder crease (-w * 0.98, yBelt)
  // 6: Upper shoulder tumblehome (-w * 0.90, yShoulder)
  // 7: Fender crown ridge (-w * 0.76, yCrown)
  // 8: Hood / deck aerodynamic valley (-w * 0.38, yValley)
  // 9: Center spine (X = 0, ySpine)
  // 10-18: Symmetrical Right Side (10: Valley, 11: Crown, 12: Shoulder, 13: Belt, 14: Cove, 15: Chine, 16: Arch, 17: Seam, 18: Underbody)
  const pps = 19;

  rawSlices.forEach((s) => {
    const w = s.halfWidth;
    const yUnder = s.yBottom;
    const ySill = s.ySill;
    const yArch = s.yArchCutout;
    const yChine = Math.max(yArch + 0.04, ySill + 0.06);
    const yBelt = s.yBelt;
    const yMid = (yChine + yBelt) * 0.5;
    const yCrown = s.yCrown;
    const yShoulder = (yBelt + yCrown) * 0.52;
    const yValley = s.yValley;
    const ySpine = s.ySpine;

    // Left points (negative X)
    bodyVertices.push(-w * 0.40, yUnder, s.z);                      // 0: Underbody center
    bodyVertices.push(-w * 0.75, yUnder, s.z);                      // 1: Undertray seam
    bodyVertices.push(-w * 0.98, yArch, s.z);                       // 2: Wheel arch cutout lip
    bodyVertices.push(-w * 1.00, yChine, s.z);                      // 3: Lower chine flare
    bodyVertices.push(-w * 0.95, yMid, s.z);                        // 4: Mid-door cove
    bodyVertices.push(-w * 0.98, yBelt, s.z);                       // 5: Beltline crease
    bodyVertices.push(-w * 0.90, yShoulder, s.z);                   // 6: Shoulder tumblehome
    bodyVertices.push(-w * 0.76, yCrown, s.z);                      // 7: Muscular fender crown
    bodyVertices.push(-w * 0.38, yValley, s.z);                     // 8: Hood/deck valley
    // Center point
    bodyVertices.push(0, ySpine, s.z);                              // 9: Center spine
    // Right points (positive X, symmetrical)
    bodyVertices.push(w * 0.38, yValley, s.z);                      // 10
    bodyVertices.push(w * 0.76, yCrown, s.z);                       // 11
    bodyVertices.push(w * 0.90, yShoulder, s.z);                    // 12
    bodyVertices.push(w * 0.98, yBelt, s.z);                        // 13
    bodyVertices.push(w * 0.95, yMid, s.z);                         // 14
    bodyVertices.push(w * 1.00, yChine, s.z);                       // 15
    bodyVertices.push(w * 0.98, yArch, s.z);                        // 16
    bodyVertices.push(w * 0.75, yUnder, s.z);                       // 17
    bodyVertices.push(w * 0.40, yUnder, s.z);                       // 18
  });

  // Connect longitudinal slices into outward-facing quads with correct CCW normals
  for (let i = 0; i < rawSlices.length - 1; i++) {
    const rowA = i * pps;
    const rowB = (i + 1) * pps;

    for (let j = 0; j < pps - 1; j++) {
      const a = rowA + j;
      const b = rowA + j + 1;
      const c = rowB + j + 1;
      const d = rowB + j;

      // Outward-facing CCW triangles: (a, d, c) and (a, c, b)
      bodyIndices.push(a, d, c);
      bodyIndices.push(a, c, b);
    }

    // Watertight flat undertray quads (connecting Point 0 to Point 18 along the bottom)
    const bLeftA = rowA + 0;
    const bRightA = rowA + (pps - 1);
    const bLeftB = rowB + 0;
    const bRightB = rowB + (pps - 1);

    // Downward-facing undertray normals: (bLeftA, bRightA, bRightB) and (bLeftA, bRightB, bLeftB)
    bodyIndices.push(bLeftA, bRightA, bRightB);
    bodyIndices.push(bLeftA, bRightB, bLeftB);
  }

  // Front wedge aerodynamic nose cap (faces forward -Z)
  const frontCapCenter = bodyVertices.length / 3;
  bodyVertices.push(0, 0.16, -2.27);
  for (let j = 0; j < pps - 1; j++) {
    bodyIndices.push(frontCapCenter, j + 1, j);
  }
  bodyIndices.push(frontCapCenter, 0, pps - 1);

  // Rear Kamm fascia end cap (faces rearward +Z)
  const lastSliceOffset = (rawSlices.length - 1) * pps;
  const rearCapCenter = bodyVertices.length / 3;
  bodyVertices.push(0, 0.47, 2.19);
  for (let j = 0; j < pps - 1; j++) {
    bodyIndices.push(rearCapCenter, lastSliceOffset + j, lastSliceOffset + j + 1);
  }
  bodyIndices.push(rearCapCenter, lastSliceOffset + pps - 1, lastSliceOffset);

  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute('position', new THREE.Float32BufferAttribute(bodyVertices, 3));
  bodyGeo.setIndex(bodyIndices);
  bodyGeo.computeVertexNormals();

  const bodyMesh = new THREE.Mesh(bodyGeo, silverBodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  rootGroup.add(bodyMesh);

  // Inner Wheel Well Liners (Dark matte geometry strictly confined under fenders)
  // Kept low (Y max 0.36) so they can NEVER protrude above the hood or rear deck!
  const frontLinerGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.22, 16, 1, true, 0, Math.PI);
  frontLinerGeo.rotateZ(Math.PI * 0.5);

  [
    { x: -0.80, y: 0.28, z: -1.30 },
    { x:  0.80, y: 0.28, z: -1.30 },
  ].forEach((pos) => {
    const liner = new THREE.Mesh(frontLinerGeo, underbodyMat);
    liner.position.set(pos.x, pos.y, pos.z);
    liner.rotation.y = pos.x > 0 ? Math.PI : 0;
    rootGroup.add(liner);
  });

  const rearLinerGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.26, 16, 1, true, 0, Math.PI);
  rearLinerGeo.rotateZ(Math.PI * 0.5);

  [
    { x: -0.82, y: 0.29, z:  1.30 },
    { x:  0.82, y: 0.29, z:  1.30 },
  ].forEach((pos) => {
    const liner = new THREE.Mesh(rearLinerGeo, underbodyMat);
    liner.position.set(pos.x, pos.y, pos.z);
    liner.rotation.y = pos.x > 0 ? Math.PI : 0;
    rootGroup.add(liner);
  });

  // ==========================================
  // 3. Wide Panoramic Smoked-Glass Teardrop Canopy
  // ==========================================
  // Continuous aerodynamic glass dome smoothly sweeping from cowl to rear deck
  // Wide panoramic glass (half-width 0.55m to 0.60m) with low 0.93m roofline
  // Blends windshield, roof, and fastback rear glass into one coherent form

  interface CanopySlice {
    z: number;
    halfWidth: number;
    yBase: number;
    yRoof: number;
  }

  const canopySlices: CanopySlice[] = [
    { z: -0.66, halfWidth: 0.60, yBase: 0.46, yRoof: 0.52 }, // Windshield Cowl Base
    { z: -0.42, halfWidth: 0.58, yBase: 0.48, yRoof: 0.72 }, // Windshield Rake
    { z: -0.16, halfWidth: 0.56, yBase: 0.49, yRoof: 0.88 }, // A-Pillars
    { z:  0.10, halfWidth: 0.55, yBase: 0.50, yRoof: 0.93 }, // Roof Apex (Low-slung 0.93m!)
    { z:  0.50, halfWidth: 0.55, yBase: 0.51, yRoof: 0.88 }, // Mid-Canopy
    { z:  0.90, halfWidth: 0.56, yBase: 0.53, yRoof: 0.81 }, // Fastback Glass Slope
    { z:  1.30, halfWidth: 0.55, yBase: 0.56, yRoof: 0.73 }, // Rear Window
    { z:  1.68, halfWidth: 0.54, yBase: 0.60, yRoof: 0.66 }, // Rear Deck Blend
  ];

  const canopyVertices: number[] = [];
  const canopyIndices: number[] = [];
  const cPps = 13; // 13 points across the aerodynamic dome for silky reflections

  canopySlices.forEach((s) => {
    for (let k = 0; k < cPps; k++) {
      const u = k / (cPps - 1); // 0 (left) to 1 (right)
      const angle = (1.0 - u) * Math.PI; // PI to 0
      const x = -Math.cos(angle) * s.halfWidth;
      const sinA = Math.sin(angle);
      // Smooth dual-curvature dome: curved shoulders flattening slightly at crown
      const y = s.yBase + sinA * (s.yRoof - s.yBase) * (0.88 + 0.12 * Math.pow(sinA, 0.65));
      canopyVertices.push(x, y, s.z);
    }
  });

  for (let i = 0; i < canopySlices.length - 1; i++) {
    const rowA = i * cPps;
    const rowB = (i + 1) * cPps;

    for (let j = 0; j < cPps - 1; j++) {
      const a = rowA + j;
      const b = rowA + j + 1;
      const c = rowB + j + 1;
      const d = rowB + j;

      // Outward-facing CCW triangles
      canopyIndices.push(a, d, c);
      canopyIndices.push(a, c, b);
    }
  }

  // Front windshield seal
  const cFrontCenter = canopyVertices.length / 3;
  canopyVertices.push(0, 0.48, -0.68);
  for (let j = 0; j < cPps - 1; j++) {
    canopyIndices.push(cFrontCenter, j, j + 1);
  }

  // Rear fastback window seal
  const cLastRow = (canopySlices.length - 1) * cPps;
  const cRearCenter = canopyVertices.length / 3;
  canopyVertices.push(0, 0.61, 1.70);
  for (let j = 0; j < cPps - 1; j++) {
    canopyIndices.push(cRearCenter, cLastRow + j + 1, cLastRow + j);
  }

  const canopyGeo = new THREE.BufferGeometry();
  canopyGeo.setAttribute('position', new THREE.Float32BufferAttribute(canopyVertices, 3));
  canopyGeo.setIndex(canopyIndices);
  canopyGeo.computeVertexNormals();

  const canopyMesh = new THREE.Mesh(canopyGeo, smokedGlassMat);
  canopyMesh.castShadow = true;
  rootGroup.add(canopyMesh);

  // Interior Cockpit Depth (Subtle dark sport seats visible through smoked glass)
  const interiorGroup = new THREE.Group();
  interiorGroup.position.set(0, 0.42, 0.15);

  const seatGeo = new THREE.BoxGeometry(0.32, 0.36, 0.42);
  const leftSeat = new THREE.Mesh(seatGeo, carbonAeroMat);
  leftSeat.position.set(-0.25, 0.12, 0.10);
  const rightSeat = new THREE.Mesh(seatGeo, carbonAeroMat);
  rightSeat.position.set(0.25, 0.12, 0.10);
  interiorGroup.add(leftSeat, rightSeat);

  const dashGeo = new THREE.BoxGeometry(0.88, 0.14, 0.30);
  const dash = new THREE.Mesh(dashGeo, carbonAeroMat);
  dash.position.set(0, 0.16, -0.42);
  interiorGroup.add(dash);
  rootGroup.add(interiorGroup);

  // Slim Silver A-Pillars / Roof Rails (Framing the glass canopy seamlessly into the body)
  [-1, 1].forEach((side) => {
    const railCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.61, 0.47, -0.64),
      new THREE.Vector3(side * 0.57, 0.72, -0.22),
      new THREE.Vector3(side * 0.54, 0.91,  0.12),
      new THREE.Vector3(side * 0.55, 0.83,  0.75),
      new THREE.Vector3(side * 0.54, 0.65,  1.55),
    ]);
    const railGeo = new THREE.TubeGeometry(railCurve, 24, 0.016, 8, false);
    const railMesh = new THREE.Mesh(railGeo, silverBodyMat);
    rootGroup.add(railMesh);
  });

  // Aerodynamic Digital Side Camera Stalks / Mirrors
  [-1, 1].forEach((side) => {
    const mirrorStemGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 8);
    mirrorStemGeo.rotateZ(side * Math.PI * 0.35);
    const mirrorStem = new THREE.Mesh(mirrorStemGeo, silverBodyMat);
    mirrorStem.position.set(side * 0.68, 0.54, -0.52);

    const mirrorHeadGeo = new THREE.BoxGeometry(0.04, 0.03, 0.10);
    const mirrorHead = new THREE.Mesh(mirrorHeadGeo, carbonAeroMat);
    mirrorHead.position.set(side * 0.74, 0.58, -0.52);

    rootGroup.add(mirrorStem, mirrorHead);
  });

  // ==========================================
  // 4. Integrated Thin Red Rear Light Bar
  // ==========================================
  // Seamlessly embedded into the rear fascia / ducktail lip
  const lightBarCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.92, 0.66, 2.17),
    new THREE.Vector3(0, 0.68, 2.20),
    new THREE.Vector3(0.92, 0.66, 2.17)
  );
  const lightBarGeo = new THREE.TubeGeometry(lightBarCurve, 32, 0.020, 8, false);
  const rearLightBar = new THREE.Mesh(lightBarGeo, redNeonMat);
  rootGroup.add(rearLightBar);

  // Rear diffuse red road glow
  const rearLight = new THREE.PointLight(0xff0033, 1.8, 9);
  rearLight.position.set(0, 0.65, 2.40);
  rootGroup.add(rearLight);

  // ==========================================
  // 5. Clean, Wide Rear Carbon Diffuser & Strakes
  // ==========================================
  const diffuserShape = new THREE.Shape();
  diffuserShape.moveTo(-0.90, 1.70);
  diffuserShape.lineTo(-0.94, 2.17);
  diffuserShape.lineTo(0.94, 2.17);
  diffuserShape.lineTo(0.90, 1.70);
  diffuserShape.closePath();

  const diffuserGeo = new THREE.ExtrudeGeometry(diffuserShape, {
    depth: 0.10,
    bevelEnabled: false,
  });
  diffuserGeo.rotateX(Math.PI * 0.5);
  diffuserGeo.translate(0, 0.17, 0);
  const diffuser = new THREE.Mesh(diffuserGeo, carbonAeroMat);
  rootGroup.add(diffuser);

  // 4 Clean Vertical Aero Strakes
  [-0.52, -0.18, 0.18, 0.52].forEach((fx) => {
    const finGeo = new THREE.BoxGeometry(0.024, 0.11, 0.42);
    const fin = new THREE.Mesh(finGeo, carbonAeroMat);
    fin.position.set(fx, 0.17, 1.95);
    rootGroup.add(fin);
  });

  // ==========================================
  // 6. Front Slim Crystal Matrix LED Headlights & Splitter
  // ==========================================
  [-0.62, 0.62].forEach((hx) => {
    const hlCurve = new THREE.LineCurve3(
      new THREE.Vector3(hx * 0.96, 0.31, -2.12),
      new THREE.Vector3(hx * 0.64, 0.28, -2.17)
    );
    const hlGeo = new THREE.TubeGeometry(hlCurve, 8, 0.015, 6, false);
    const hl = new THREE.Mesh(hlGeo, headlightLedMat);
    rootGroup.add(hl);
  });

  // Front Carbon Splitter
  const splitterShape = new THREE.Shape();
  splitterShape.moveTo(-0.92, -1.75);
  splitterShape.lineTo(-0.52, -2.28);
  splitterShape.lineTo(0.52, -2.28);
  splitterShape.lineTo(0.92, -1.75);
  splitterShape.closePath();

  const splitterGeo = new THREE.ExtrudeGeometry(splitterShape, {
    depth: 0.028,
    bevelEnabled: false,
  });
  splitterGeo.rotateX(Math.PI * 0.5);
  splitterGeo.translate(0, 0.10, 0);
  const splitter = new THREE.Mesh(splitterGeo, carbonAeroMat);
  splitter.castShadow = true;
  rootGroup.add(splitter);

  // Forward road illumination
  const headlightsSpot = new THREE.SpotLight(0xd4e9ff, 2.5, 36, Math.PI * 0.28, 0.4, 1.2);
  headlightsSpot.position.set(0, 0.42, -2.1);
  headlightsSpot.target.position.set(0, 0, -28);
  rootGroup.add(headlightsSpot);
  rootGroup.add(headlightsSpot.target);

  // ==========================================
  // 7. Four High-Detail Performance Aero Turbine Wheels
  // ==========================================
  // RECESSED NEATLY INSIDE FENDER SILHOUETTE
  // Front: Center at X = ±0.82, radius 0.28, width 0.20 -> Outer edge at X = 0.92 (inside fender halfWidth 1.03)
  // Rear: Center at X = ±0.84, radius 0.29, width 0.24 -> Outer edge at X = 0.96 (inside rear haunch halfWidth 1.08)
  const wheelConfigs = [
    { x: -0.82, y: 0.28, z: -1.30, radius: 0.28, width: 0.20, isRear: false }, // Front Left
    { x:  0.82, y: 0.28, z: -1.30, radius: 0.28, width: 0.20, isRear: false }, // Front Right
    { x: -0.84, y: 0.29, z:  1.30, radius: 0.29, width: 0.24, isRear: true },  // Rear Left
    { x:  0.84, y: 0.29, z:  1.30, radius: 0.29, width: 0.24, isRear: true },  // Rear Right
  ];

  const wheels: THREE.Group[] = [];

  wheelConfigs.forEach((cfg) => {
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(cfg.x, cfg.y, cfg.z);

    // Subtle sports car negative camber (-1.5°)
    const camberAngle = cfg.x > 0 ? -0.026 : 0.026;
    wheelGroup.rotation.z = camberAngle;

    // 1. Matte Performance Rubber Tire (touches road at Y = 0.00)
    const tireGeo = new THREE.CylinderGeometry(cfg.radius, cfg.radius, cfg.width, 32);
    tireGeo.rotateZ(Math.PI * 0.5);
    const tire = new THREE.Mesh(tireGeo, tireMat);
    tire.castShadow = true;
    wheelGroup.add(tire);

    // 2. Titanium Rim Barrel
    const rimRadius = cfg.radius * 0.76;
    const rimGeo = new THREE.CylinderGeometry(rimRadius, rimRadius, cfg.width * 1.01, 24);
    rimGeo.rotateZ(Math.PI * 0.5);
    const rim = new THREE.Mesh(rimGeo, rimBarrelMat);
    wheelGroup.add(rim);

    // 3. Center Hub Cap
    const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, cfg.width * 1.03, 12);
    hubGeo.rotateZ(Math.PI * 0.5);
    const hub = new THREE.Mesh(hubGeo, carbonAeroMat);
    wheelGroup.add(hub);

    // 4. Directional Machined Silver Aero Turbine Blades (10 Blades)
    const spokeCount = 10;
    const spokeLength = rimRadius * 0.78;
    const spokeGeo = new THREE.BoxGeometry(0.024, spokeLength, 0.014);
    const outerFaceX = cfg.x > 0 ? (cfg.width * 0.5 + 0.004) : -(cfg.width * 0.5 + 0.004);

    for (let s = 0; s < spokeCount; s++) {
      const angle = (s / spokeCount) * Math.PI * 2;
      const spoke = new THREE.Mesh(spokeGeo, rimSpokeMat);
      const rad = spokeLength * 0.55;
      spoke.position.set(outerFaceX, Math.sin(angle) * rad, Math.cos(angle) * rad);
      spoke.rotation.x = -angle;
      spoke.rotation.y = cfg.x > 0 ? 0.12 : -0.12; // Directional blade pitch
      wheelGroup.add(spoke);
    }

    // 5. Cross-Drilled Brake Rotor & Sport Red Caliper
    const rotorGeo = new THREE.CylinderGeometry(rimRadius * 0.82, rimRadius * 0.82, 0.018, 20);
    rotorGeo.rotateZ(Math.PI * 0.5);
    const rotor = new THREE.Mesh(rotorGeo, rotorMat);
    rotor.position.x = cfg.x > 0 ? 0.015 : -0.015;
    wheelGroup.add(rotor);

    const caliperGeo = new THREE.BoxGeometry(0.035, 0.10, 0.12);
    const caliper = new THREE.Mesh(caliperGeo, caliperMat);
    caliper.position.set(cfg.x > 0 ? 0.025 : -0.025, rimRadius * 0.42, 0.05);
    wheelGroup.add(caliper);

    rootGroup.add(wheelGroup);
    wheels.push(wheelGroup);
  });

  // ==========================================
  // 8. Four Underside SpaceX-Style Rocket Thrusters
  // ==========================================
  // Compact, symmetric, tucked directly under the chassis (Y = 0.12)
  const thrusterPositions = [
    { x: -0.50, z: -0.75 }, // Front Left
    { x:  0.50, z: -0.75 }, // Front Right
    { x: -0.50, z:  0.75 }, // Rear Left
    { x:  0.50, z:  0.75 }, // Rear Right
  ];

  const nozzleGeo = new THREE.CylinderGeometry(0.10, 0.075, 0.10, 16);
  const throatRingGeo = new THREE.RingGeometry(0.025, 0.075, 16);
  throatRingGeo.rotateX(Math.PI * 0.5);

  const thrusterPlumes: THREE.Group[] = [];

  thrusterPositions.forEach((pos) => {
    const nozzleGroup = new THREE.Group();
    nozzleGroup.position.set(pos.x, 0.11, pos.z);

    // Dark titanium bell nozzle
    const nozzle = new THREE.Mesh(nozzleGeo, thrusterMetalMat);
    nozzleGroup.add(nozzle);

    // Cyan glowing interior throat ring
    const ring = new THREE.Mesh(throatRingGeo, thrusterRingMat);
    ring.position.y = -0.052;
    nozzleGroup.add(ring);

    // Animated downward exhaust plume
    const plumeGroup = new THREE.Group();
    plumeGroup.position.y = -0.06;

    // Outer cyan plasma flame
    const outerConeGeo = new THREE.ConeGeometry(0.16, 1.4, 14, 1, true);
    outerConeGeo.rotateX(Math.PI);
    outerConeGeo.translate(0, -0.7, 0);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x00c8ff,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const outerMesh = new THREE.Mesh(outerConeGeo, outerMat);
    plumeGroup.add(outerMesh);

    // Inner brilliant white core
    const innerConeGeo = new THREE.ConeGeometry(0.07, 0.95, 12, 1, true);
    innerConeGeo.rotateX(Math.PI);
    innerConeGeo.translate(0, -0.47, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const innerMesh = new THREE.Mesh(innerConeGeo, innerMat);
    plumeGroup.add(innerMesh);

    plumeGroup.visible = false;
    nozzleGroup.add(plumeGroup);
    thrusterPlumes.push(plumeGroup);

    rootGroup.add(nozzleGroup);
  });

  // ==========================================
  // 9. Downwash Point Light on Road Surface
  // ==========================================
  const thrusterLight = new THREE.PointLight(0x00f0ff, 0, 16);
  thrusterLight.position.set(0, -0.1, 0);
  rootGroup.add(thrusterLight);

  // ==========================================
  // 10. Contact Ground Shadow Decal
  // ==========================================
  const shadowGeo = new THREE.PlaneGeometry(2.6, 4.6);
  shadowGeo.rotateX(-Math.PI * 0.5);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.65,
    depthWrite: false,
  });
  const contactShadow = new THREE.Mesh(shadowGeo, shadowMat);
  contactShadow.position.set(0, 0.02, 0);

  return {
    rootGroup,
    bodyMesh,
    canopyMesh,
    wheels,
    thrusterPlumes,
    thrusterLight,
    contactShadow,
    rearLightBar,
    rearLight,
  };
}
