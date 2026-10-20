/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GameObject, GameWorld, PlayerCar } from './types';
import { createRoadsterModel, RoadsterMeshes } from './roadsterModel';

// Constants for 3D highway layout
export const LANE_WIDTH = 4.2; // Distance between lane centers
export const LANE_X = [-LANE_WIDTH, 0, LANE_WIDTH]; // Left, Center, Right
export const ROAD_WIDTH = 15.2; // Total highway width
export const ROAD_LENGTH = 320; // Length of highway section
export const Z_SCALE = 0.16; // Mapping from engine distance units to Three.js units

// Height configuration for physical flight and obstacle clearance
export const FLIGHT_ALTITUDE_HEIGHT = 2.4; // World units car lifts above road (barrier is 1.5)
export const BARRIER_MAX_HEIGHT = 1.5;

export class ThreeSceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public isContextLost = false;

  // Active World State
  public currentWorld: GameWorld = 'EARTH';
  private environmentGroup: THREE.Group;
  private earthMesh: THREE.Mesh | null = null;
  private earthTexture: THREE.CanvasTexture | null = null;

  // Lighting References for Dynamic World Tuning
  private ambientLight!: THREE.AmbientLight;
  private hemiLight!: THREE.HemisphereLight;
  private dirLight!: THREE.DirectionalLight;
  private rimLight!: THREE.DirectionalLight;

  // Highway Materials for World-Specific Styling
  private roadMat!: THREE.MeshStandardMaterial;
  private dashMat!: THREE.MeshBasicMaterial;
  private curbRailMat!: THREE.MeshStandardMaterial;
  private barrierMat!: THREE.MeshStandardMaterial;
  private pylonPostMat!: THREE.MeshStandardMaterial;
  private pylonStripMat!: THREE.MeshBasicMaterial;

  // Car 3D model references
  public carGroup: THREE.Group;
  private roadsterParts: RoadsterMeshes;

  // Environment & Road
  private roadGroup: THREE.Group;
  private roadDashes: THREE.Mesh[] = [];
  private pylons: THREE.Group[] = [];

  // Shared Geometries & Materials for Obstacles (ZERO runtime allocations)
  private sharedGeos: { [key: string]: THREE.BufferGeometry } = {};
  private sharedMats: { [key: string]: THREE.Material } = {};

  // Pooled Obstacle Meshes
  private obstacleMeshMap: Map<string, THREE.Group> = new Map();
  private poolBarrier: THREE.Group[] = [];
  private poolTraffic: THREE.Group[] = [];
  private poolGap: THREE.Group[] = [];
  private poolOrb: THREE.Group[] = [];
  private poolCoin: THREE.Group[] = [];
  private poolPowerup: THREE.Group[] = [];

  // Defensive Shield forcefield bubble
  private shieldBubbleMesh: THREE.Mesh;

  // Bounded Particle Pool
  private static readonly MAX_PARTICLES = 60;
  private particlePool: {
    mesh: THREE.Mesh;
    mat: THREE.MeshBasicMaterial;
    active: boolean;
    velocity: THREE.Vector3;
    life: number;
    maxLife: number;
    type: 'smoke' | 'spark' | 'flame';
    growth: number;
  }[] = [];
  private particleContainer: THREE.Group;

  // Temp vectors for zero-GC loop
  private _camTargetPos = new THREE.Vector3();
  private _camLookTarget = new THREE.Vector3();
  private _currentCamLook = new THREE.Vector3(0, 1.2, -16);

  private roadScrollOffset = 0;
  private time = 0;
  private envTexture: THREE.Texture | null = null;

  constructor(canvas: HTMLCanvasElement, initialWorld: GameWorld = 'EARTH') {
    // 1. Scene & Fog (configured dynamically by setWorld)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x080808);
    this.scene.fog = new THREE.FogExp2(0x080808, 0.007);

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(54, aspect, 0.2, 450);
    this.camera.position.set(0, 3.3, 7.5);

    // 3. Optimized Renderer (DPR <= 1.5, memory-capped shadows)
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    // Cap DPR to 1.5 for laptop and integrated GPU performance
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // WebGL context loss handling
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.isContextLost = true;
    });

    canvas.addEventListener('webglcontextrestored', () => {
      this.isContextLost = false;
    });

    // 4. Studio Environment Reflection (RoomEnvironment) for silver metallic realism
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    this.envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = this.envTexture;
    pmremGenerator.dispose();

    // 5. Lighting Rig (Stored references for dynamic world adjustments)
    this.setupLighting();

    // 6. Build Shared Obstacle Geometries & Materials
    this.initSharedObstacleAssets();

    // 7. Dynamic Environment Scenery Group
    this.environmentGroup = new THREE.Group();
    this.scene.add(this.environmentGroup);

    // 8. Build 3D Highway with road markings, rails & roadside pylons
    this.roadGroup = new THREE.Group();
    this.scene.add(this.roadGroup);
    this.buildHighway();

    // 9. Build Hero Electric Roadster (Custom sports car geometry & materials)
    this.roadsterParts = createRoadsterModel();
    this.carGroup = this.roadsterParts.rootGroup;
    this.scene.add(this.carGroup);
    this.scene.add(this.roadsterParts.contactShadow);

    // Defensive Forcefield Shield Bubble
    const shieldGeo = new THREE.SphereGeometry(1.68, 20, 14);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      wireframe: true,
      depthWrite: false,
    });
    this.shieldBubbleMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldBubbleMesh.position.set(0, 0.42, 0);
    this.shieldBubbleMesh.visible = false;
    this.carGroup.add(this.shieldBubbleMesh);

    // 10. Bounded Particle Pool
    this.particleContainer = new THREE.Group();
    this.scene.add(this.particleContainer);
    this.setupParticlePool();

    // 11. Initialize Selected World Environment & Lighting
    this.setWorld(initialWorld);
  }

  private setupLighting() {
    this.ambientLight = new THREE.AmbientLight(0x11141a, 0.85);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x222834, 0x080808, 0.95);
    this.scene.add(this.hemiLight);

    // Directional Key Light with bounded shadow map (512x512) for laptop GPU safety
    this.dirLight = new THREE.DirectionalLight(0xf5f5f3, 2.1);
    this.dirLight.position.set(10, 24, 12);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 512;
    this.dirLight.shadow.mapSize.height = 512;
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 60;
    this.dirLight.shadow.camera.left = -14;
    this.dirLight.shadow.camera.right = 14;
    this.dirLight.shadow.camera.top = 18;
    this.dirLight.shadow.camera.bottom = -18;
    this.dirLight.shadow.bias = -0.0008;
    this.dirLight.shadow.normalBias = 0.02;
    this.scene.add(this.dirLight);

    // Metallic rim light accentuating shoulder & rear roofline
    this.rimLight = new THREE.DirectionalLight(0xc8d2e0, 1.3);
    this.rimLight.position.set(-14, 12, -35);
    this.scene.add(this.rimLight);
  }

  /**
   * Pre-creates shared geometries and materials for all obstacle types
   * so ZERO geometries or materials are ever allocated during the render loop.
   */
  private initSharedObstacleAssets() {
    // Geometries
    this.sharedGeos['barrierPost'] = new THREE.BoxGeometry(0.36, 1.6, 0.36);
    this.sharedGeos['barrierBar'] = new THREE.BoxGeometry(LANE_WIDTH * 0.98, 0.14, 0.2);
    this.sharedGeos['barrierLaser'] = new THREE.PlaneGeometry(LANE_WIDTH * 0.96, 1.2);
    this.sharedGeos['barrierBeacon'] = new THREE.SphereGeometry(0.15, 8, 8);

    this.sharedGeos['trafficHull'] = new THREE.BoxGeometry(1.9, 0.55, 3.8);
    this.sharedGeos['trafficCabin'] = new THREE.BoxGeometry(1.4, 0.38, 1.8);
    this.sharedGeos['trafficLight'] = new THREE.BoxGeometry(1.6, 0.08, 0.08);

    const gapGeo = new THREE.PlaneGeometry(LANE_WIDTH * 0.98, 5.0);
    gapGeo.rotateX(-Math.PI * 0.5);
    this.sharedGeos['gapHole'] = gapGeo;
    this.sharedGeos['gapBorder'] = new THREE.BoxGeometry(LANE_WIDTH * 0.98, 0.1, 0.28);

    this.sharedGeos['orbCore'] = new THREE.OctahedronGeometry(0.55, 1);
    this.sharedGeos['orbRing'] = new THREE.TorusGeometry(0.85, 0.04, 8, 20);

    // Coins (Faceted cyber gold coin)
    const coinDisc = new THREE.CylinderGeometry(0.38, 0.38, 0.08, 16);
    coinDisc.rotateX(Math.PI * 0.5);
    this.sharedGeos['coinDisc'] = coinDisc;
    this.sharedGeos['coinRing'] = new THREE.RingGeometry(0.14, 0.28, 14);

    // Power-ups
    this.sharedGeos['powerupMagnet'] = new THREE.TorusGeometry(0.36, 0.09, 8, 16, Math.PI * 1.5);
    this.sharedGeos['powerupFuel'] = new THREE.CylinderGeometry(0.24, 0.24, 0.65, 8);
    this.sharedGeos['powerupShield'] = new THREE.IcosahedronGeometry(0.40, 0);
    this.sharedGeos['powerupMultiplier'] = new THREE.OctahedronGeometry(0.42, 0);
    this.sharedGeos['powerupHalo'] = new THREE.TorusGeometry(0.62, 0.03, 8, 20);

    // Materials
    this.sharedMats['barrierMetal'] = new THREE.MeshStandardMaterial({
      color: 0x1e2738,
      metalness: 0.85,
      roughness: 0.3,
    });
    this.sharedMats['barrierLaser'] = new THREE.MeshBasicMaterial({
      color: 0xff003c,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.sharedMats['barrierBeacon'] = new THREE.MeshBasicMaterial({ color: 0xff5500 });

    this.sharedMats['trafficBodyBlue'] = new THREE.MeshStandardMaterial({
      color: 0x2563eb,
      metalness: 0.85,
      roughness: 0.25,
    });
    this.sharedMats['trafficBodyGrey'] = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.85,
      roughness: 0.25,
    });
    this.sharedMats['trafficGlass'] = new THREE.MeshStandardMaterial({
      color: 0x050810,
      metalness: 0.9,
      roughness: 0.1,
    });
    this.sharedMats['tailLight'] = new THREE.MeshBasicMaterial({ color: 0xff0020 });
    this.sharedMats['headLight'] = new THREE.MeshBasicMaterial({ color: 0xffe066 });

    this.sharedMats['gapHole'] = new THREE.MeshBasicMaterial({ color: 0x000000 });
    this.sharedMats['gapBorder'] = new THREE.MeshBasicMaterial({ color: 0xf59e0b });

    this.sharedMats['orbCore'] = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.sharedMats['orbRing'] = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.9,
    });

    // Coin Materials
    this.sharedMats['coinGold'] = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.94,
      roughness: 0.16,
      emissive: 0xaa7200,
      emissiveIntensity: 0.45,
    });
    this.sharedMats['coinRim'] = new THREE.MeshBasicMaterial({ color: 0xfff3a1 });

    // Power-up Materials
    this.sharedMats['powerupMagnet'] = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x0088cc,
      emissiveIntensity: 0.6,
    });
    this.sharedMats['powerupFuel'] = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0x15803d,
      emissiveIntensity: 0.6,
    });
    this.sharedMats['powerupShield'] = new THREE.MeshStandardMaterial({
      color: 0xd946ef,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0xa21caf,
      emissiveIntensity: 0.6,
    });
    this.sharedMats['powerupMultiplier'] = new THREE.MeshStandardMaterial({
      color: 0xf97316,
      metalness: 0.85,
      roughness: 0.2,
      emissive: 0xc2410c,
      emissiveIntensity: 0.6,
    });
    this.sharedMats['powerupHalo'] = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.8,
    });
  }

  private buildHighway() {
    const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH, 1, 40);
    roadGeo.rotateX(-Math.PI * 0.5);
    this.roadMat = new THREE.MeshStandardMaterial({
      color: 0x101317,
      roughness: 0.55,
      metalness: 0.2,
      envMapIntensity: 0.65,
    });
    const roadMesh = new THREE.Mesh(roadGeo, this.roadMat);
    roadMesh.position.set(0, 0, -ROAD_LENGTH * 0.4);
    roadMesh.receiveShadow = true;
    this.roadGroup.add(roadMesh);

    // Clean Architectural Curbs
    const curbRailGeo = new THREE.BoxGeometry(0.24, 0.28, ROAD_LENGTH);
    this.curbRailMat = new THREE.MeshStandardMaterial({
      color: 0x232933,
      metalness: 0.6,
      roughness: 0.35,
    });

    const leftCurb = new THREE.Mesh(curbRailGeo, this.curbRailMat);
    leftCurb.position.set(-ROAD_WIDTH * 0.5 + 0.12, 0.14, -ROAD_LENGTH * 0.4);
    this.roadGroup.add(leftCurb);

    const rightCurb = new THREE.Mesh(curbRailGeo, this.curbRailMat);
    rightCurb.position.set(ROAD_WIDTH * 0.5 - 0.12, 0.14, -ROAD_LENGTH * 0.4);
    this.roadGroup.add(rightCurb);

    // Outer Guardrails in Graphite & Metallic Silver
    const barrierRailGeo = new THREE.BoxGeometry(0.18, 0.3, ROAD_LENGTH);
    this.barrierMat = new THREE.MeshStandardMaterial({
      color: 0x1b2028,
      metalness: 0.85,
      roughness: 0.3,
    });

    const leftRail = new THREE.Mesh(barrierRailGeo, this.barrierMat);
    leftRail.position.set(-ROAD_WIDTH * 0.5 - 0.25, 0.5, -ROAD_LENGTH * 0.4);
    this.roadGroup.add(leftRail);

    const rightRail = new THREE.Mesh(barrierRailGeo, this.barrierMat);
    rightRail.position.set(ROAD_WIDTH * 0.5 + 0.25, 0.5, -ROAD_LENGTH * 0.4);
    this.roadGroup.add(rightRail);

    // Dashed Lane Dividers
    const dashLength = 4.0;
    const dashSpacing = 8.0;
    const dashCount = Math.floor(ROAD_LENGTH / dashSpacing);

    const dashGeo = new THREE.PlaneGeometry(0.18, dashLength);
    dashGeo.rotateX(-Math.PI * 0.5);
    this.dashMat = new THREE.MeshBasicMaterial({
      color: 0xf5f5f3,
      transparent: true,
      opacity: 0.72,
    });

    [-LANE_WIDTH * 0.5, LANE_WIDTH * 0.5].forEach((xPos) => {
      for (let i = 0; i < dashCount; i++) {
        const dash = new THREE.Mesh(dashGeo, this.dashMat);
        dash.position.set(xPos, 0.015, -i * dashSpacing + 20);
        this.roadGroup.add(dash);
        this.roadDashes.push(dash);
      }
    });

    // Roadside Architectural Pylons
    const pylonSpacing = 40;
    const pylonCount = Math.floor(ROAD_LENGTH / pylonSpacing);

    this.pylonPostMat = new THREE.MeshStandardMaterial({
      color: 0x141820,
      metalness: 0.8,
      roughness: 0.4,
    });

    this.pylonStripMat = new THREE.MeshBasicMaterial({
      color: 0xe2e8f0,
      transparent: true,
      opacity: 0.75,
    });

    for (let i = 0; i < pylonCount; i++) {
      const pylonGroup = new THREE.Group();
      const z = -i * pylonSpacing + 10;

      const postGeo = new THREE.BoxGeometry(0.35, 4.8, 0.35);

      const leftPost = new THREE.Mesh(postGeo, this.pylonPostMat);
      leftPost.position.set(-ROAD_WIDTH * 0.5 - 1.2, 2.4, 0);
      pylonGroup.add(leftPost);

      const rightPost = new THREE.Mesh(postGeo, this.pylonPostMat);
      rightPost.position.set(ROAD_WIDTH * 0.5 + 1.2, 2.4, 0);
      pylonGroup.add(rightPost);

      const beamGeo = new THREE.BoxGeometry(ROAD_WIDTH + 3.0, 0.28, 0.35);
      const beam = new THREE.Mesh(beamGeo, this.pylonPostMat);
      beam.position.set(0, 4.8, 0);
      pylonGroup.add(beam);

      const stripGeo = new THREE.BoxGeometry(ROAD_WIDTH * 0.5, 0.06, 0.38);
      const strip = new THREE.Mesh(stripGeo, this.pylonStripMat);
      strip.position.set(0, 4.68, 0);
      pylonGroup.add(strip);

      pylonGroup.position.z = z;
      this.roadGroup.add(pylonGroup);
      this.pylons.push(pylonGroup);
    }
  }

  /**
   * Switches the active world environment smoothly with complete disposal
   * of previous meshes, lights, and textures (ZERO memory leaks).
   */
  public setWorld(world: GameWorld) {
    this.currentWorld = world;

    // 1. Dispose & Clear previous environment scenery
    this.clearGroup(this.environmentGroup);
    this.earthMesh = null;

    // 2. Configure World-Specific Atmospherics, Lighting & Highway Materials
    if (world === 'MOON') {
      this.scene.background = new THREE.Color(0x010103);
      this.scene.fog = new THREE.FogExp2(0x010103, 0.0025);

      // Harsh, high-contrast unfiltered sunlight in deep vacuum
      this.ambientLight.color.setHex(0x08090e);
      this.ambientLight.intensity = 0.40;
      this.hemiLight.color.setHex(0x141824);
      this.hemiLight.groundColor.setHex(0x010103);
      this.hemiLight.intensity = 0.60;
      this.dirLight.color.setHex(0xffffff);
      this.dirLight.intensity = 2.8;
      this.rimLight.color.setHex(0x94a3b8);
      this.rimLight.intensity = 1.0;

      if (this.roadMat) {
        this.roadMat.color.setHex(0x13151a);
        this.dashMat.color.setHex(0xe8ecf5);
        this.curbRailMat.color.setHex(0x2a303c);
        this.barrierMat.color.setHex(0x222834);
        this.pylonPostMat.color.setHex(0x1e2430);
        this.pylonStripMat.color.setHex(0x38bdf8);
      }

      this.buildMoonEnvironment();
    } else if (world === 'MARS') {
      this.scene.background = new THREE.Color(0x1a0a07);
      this.scene.fog = new THREE.FogExp2(0x1c0b08, 0.0055);

      // Warm Martian twilight, diffused solar irradiance through dust haze
      this.ambientLight.color.setHex(0x28120c);
      this.ambientLight.intensity = 0.95;
      this.hemiLight.color.setHex(0x3c180e);
      this.hemiLight.groundColor.setHex(0x140503);
      this.hemiLight.intensity = 1.05;
      this.dirLight.color.setHex(0xffcfa4);
      this.dirLight.intensity = 2.4;
      this.rimLight.color.setHex(0xe05626);
      this.rimLight.intensity = 1.3;

      if (this.roadMat) {
        this.roadMat.color.setHex(0x170f12);
        this.dashMat.color.setHex(0xffbe76);
        this.curbRailMat.color.setHex(0x351f18);
        this.barrierMat.color.setHex(0x2c1712);
        this.pylonPostMat.color.setHex(0x281814);
        this.pylonStripMat.color.setHex(0xf97316);
      }

      this.buildMarsEnvironment();
    } else {
      // EARTH
      this.scene.background = new THREE.Color(0x060b18);
      this.scene.fog = new THREE.FogExp2(0x060b18, 0.0065);

      // Cool automotive studio & coastal metropolis haze
      this.ambientLight.color.setHex(0x111624);
      this.ambientLight.intensity = 0.85;
      this.hemiLight.color.setHex(0x222a3d);
      this.hemiLight.groundColor.setHex(0x060b18);
      this.hemiLight.intensity = 0.95;
      this.dirLight.color.setHex(0xf0f4ff);
      this.dirLight.intensity = 2.1;
      this.rimLight.color.setHex(0x60a5fa);
      this.rimLight.intensity = 1.3;

      if (this.roadMat) {
        this.roadMat.color.setHex(0x101317);
        this.dashMat.color.setHex(0xf5f5f3);
        this.curbRailMat.color.setHex(0x232933);
        this.barrierMat.color.setHex(0x1b2028);
        this.pylonPostMat.color.setHex(0x141820);
        this.pylonStripMat.color.setHex(0xe2e8f0);
      }

      this.buildEarthEnvironment();
    }
  }

  private clearGroup(group: THREE.Group) {
    while (group.children.length > 0) {
      const child = group.children[0];
      group.remove(child);
      if ((child as THREE.Mesh).isMesh || (child as THREE.Points).isPoints) {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      } else if (child instanceof THREE.Group) {
        this.clearGroup(child);
      }
    }
  }

  private buildEarthEnvironment() {
    // 1. Skyscraper Skyline
    const towerMat1 = new THREE.MeshStandardMaterial({
      color: 0x060c1c,
      roughness: 0.5,
      metalness: 0.6,
    });
    const towerMat2 = new THREE.MeshStandardMaterial({
      color: 0x0a1428,
      roughness: 0.4,
      metalness: 0.7,
    });
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });

    const buildingCount = 40;
    for (let i = 0; i < buildingCount; i++) {
      const isLeft = i % 2 === 0;
      const xDist = (ROAD_WIDTH * 0.5 + 14) + Math.random() * 80;
      const x = isLeft ? -xDist : xDist;
      const z = -30 - Math.random() * 300;
      const width = 12 + Math.random() * 20;
      const depth = 12 + Math.random() * 20;
      const height = 30 + Math.random() * 100;

      const towerGeo = new THREE.BoxGeometry(width, height, depth);
      const tower = new THREE.Mesh(towerGeo, Math.random() > 0.5 ? towerMat1 : towerMat2);
      tower.position.set(x, height * 0.5 - 5, z);
      this.environmentGroup.add(tower);

      if (Math.random() > 0.5) {
        const beaconGeo = new THREE.SphereGeometry(0.5, 6, 6);
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.set(x, height - 4.5, z);
        this.environmentGroup.add(beacon);
      }
    }

    // 2. Coastal Ground Foundation Planes
    const groundGeo = new THREE.PlaneGeometry(240, ROAD_LENGTH, 1, 1);
    groundGeo.rotateX(-Math.PI * 0.5);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x070c18,
      roughness: 0.85,
      metalness: 0.3,
    });
    const leftGround = new THREE.Mesh(groundGeo, groundMat);
    leftGround.position.set(-(ROAD_WIDTH * 0.5 + 120), -0.05, -ROAD_LENGTH * 0.4);
    const rightGround = new THREE.Mesh(groundGeo, groundMat);
    rightGround.position.set(ROAD_WIDTH * 0.5 + 120, -0.05, -ROAD_LENGTH * 0.4);
    this.environmentGroup.add(leftGround, rightGround);

    // 3. City Starfield
    const starCount = 450;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 550;
      positions[i * 3 + 1] = 20 + Math.random() * 160;
      positions[i * 3 + 2] = -50 - Math.random() * 320;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0x93c5fd,
      size: 1.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.85,
    });

    const stars = new THREE.Points(starGeo, starMat);
    this.environmentGroup.add(stars);
  }

  private buildMoonEnvironment() {
    // 1. Deep Space Starfield (Crisp, sharp, unfiltered stars)
    const starCount = 650;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 600;
      positions[i * 3 + 1] = 10 + Math.random() * 200;
      positions[i * 3 + 2] = -40 - Math.random() * 360;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.4,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
    });
    const stars = new THREE.Points(starGeo, starMat);
    this.environmentGroup.add(stars);

    // 2. The Earth in the Sky (Detailed, recognizable Earth with atmospheric blue glow)
    if (!this.earthTexture) {
      this.earthTexture = this.createProceduralEarthTexture();
    }
    const earthGeo = new THREE.SphereGeometry(26, 32, 24);
    const earthMat = new THREE.MeshStandardMaterial({
      map: this.earthTexture,
      roughness: 0.65,
      metalness: 0.05,
      envMapIntensity: 0.4,
    });
    this.earthMesh = new THREE.Mesh(earthGeo, earthMat);
    this.earthMesh.position.set(-78, 72, -260);
    this.earthMesh.rotation.z = 0.41; // 23.5° axial tilt
    this.earthMesh.rotation.y = 1.8;
    this.environmentGroup.add(this.earthMesh);

    // Atmospheric Blue Corona around Earth
    const glowGeo = new THREE.SphereGeometry(27.4, 32, 24);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.32,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const earthGlow = new THREE.Mesh(glowGeo, glowMat);
    earthGlow.position.copy(this.earthMesh.position);
    this.environmentGroup.add(earthGlow);

    // 3. Basaltic Lunar Regolith Terrain Planes
    const terrainGeo = new THREE.PlaneGeometry(240, ROAD_LENGTH, 1, 1);
    terrainGeo.rotateX(-Math.PI * 0.5);
    const lunarTerrainMat = new THREE.MeshStandardMaterial({
      color: 0x242830,
      roughness: 0.94,
      metalness: 0.05,
    });
    const leftTerrain = new THREE.Mesh(terrainGeo, lunarTerrainMat);
    leftTerrain.position.set(-(ROAD_WIDTH * 0.5 + 120), -0.04, -ROAD_LENGTH * 0.4);
    leftTerrain.receiveShadow = true;
    const rightTerrain = new THREE.Mesh(terrainGeo, lunarTerrainMat);
    rightTerrain.position.set(ROAD_WIDTH * 0.5 + 120, -0.04, -ROAD_LENGTH * 0.4);
    rightTerrain.receiveShadow = true;
    this.environmentGroup.add(leftTerrain, rightTerrain);

    // 4. Lunar Craters (Circular rims with dark sunken floors)
    const craterRimMat = new THREE.MeshStandardMaterial({
      color: 0x363d4a,
      roughness: 0.92,
      metalness: 0.06,
    });
    const craterFloorMat = new THREE.MeshBasicMaterial({
      color: 0x16181f,
    });

    const craterConfigs = [
      { x: -28, z: -35, r: 11 },
      { x:  34, z: -65, r: 15 },
      { x: -48, z: -105, r: 22 },
      { x:  42, z: -135, r: 17 },
      { x: -36, z: -180, r: 13 },
      { x:  55, z: -215, r: 26 },
      { x: -55, z: -250, r: 20 },
      { x:  32, z: -285, r: 14 },
    ];

    craterConfigs.forEach((c) => {
      const rimGeo = new THREE.TorusGeometry(c.r, c.r * 0.14, 6, 24);
      rimGeo.rotateX(Math.PI * 0.5);
      const rim = new THREE.Mesh(rimGeo, craterRimMat);
      rim.scale.set(1, 0.24, 1);
      rim.position.set(c.x, 0.08, c.z);
      this.environmentGroup.add(rim);

      const floorGeo = new THREE.CircleGeometry(c.r * 0.92, 16);
      floorGeo.rotateX(-Math.PI * 0.5);
      const floor = new THREE.Mesh(floorGeo, craterFloorMat);
      floor.position.set(c.x, 0.01, c.z);
      this.environmentGroup.add(floor);
    });

    // 5. Faceted Lunar Basalt Boulders
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x2c3038,
      roughness: 0.88,
      metalness: 0.1,
    });

    for (let i = 0; i < 28; i++) {
      const isLeft = i % 2 === 0;
      const xDist = (ROAD_WIDTH * 0.5 + 4) + Math.random() * 65;
      const x = isLeft ? -xDist : xDist;
      const z = -15 - Math.random() * 290;
      const radius = 1.5 + Math.random() * 5.0;

      const rockGeo = new THREE.DodecahedronGeometry(radius, 0);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.scale.set(1.0 + Math.random() * 0.4, 0.7 + Math.random() * 0.5, 1.0 + Math.random() * 0.4);
      rock.position.set(x, radius * 0.4, z);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      this.environmentGroup.add(rock);
    }

    // 6. Distant Lunar Crater Wall Mountain Silhouettes along the Horizon
    const mtnMat = new THREE.MeshStandardMaterial({
      color: 0x181b22,
      roughness: 0.95,
      metalness: 0.05,
    });

    for (let i = 0; i < 18; i++) {
      const x = (i - 9) * 45 + (Math.random() - 0.5) * 20;
      const height = 28 + Math.random() * 38;
      const width = 35 + Math.random() * 45;
      const mtnGeo = new THREE.ConeGeometry(width, height, 4);
      const mtn = new THREE.Mesh(mtnGeo, mtnMat);
      mtn.position.set(x, height * 0.4 - 4, -320 - Math.random() * 40);
      mtn.rotation.y = Math.random() * Math.PI;
      this.environmentGroup.add(mtn);
    }
  }

  private buildMarsEnvironment() {
    // 1. Martian Twilight Sky, Distant Pale Sun & Phobos
    // Pale distant sun
    const sunGeo = new THREE.SphereGeometry(8, 20, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(55, 50, -265);
    this.environmentGroup.add(sun);

    // Warm coronal halo
    const coronaGeo = new THREE.RingGeometry(8, 18, 24);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffc48c,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const corona = new THREE.Mesh(coronaGeo, coronaMat);
    corona.position.copy(sun.position);
    this.environmentGroup.add(corona);

    // Phobos moonlet in Martian sky
    const phobosGeo = new THREE.DodecahedronGeometry(3.6, 1);
    const phobosMat = new THREE.MeshStandardMaterial({
      color: 0x786458,
      roughness: 0.9,
      metalness: 0.1,
    });
    const phobos = new THREE.Mesh(phobosGeo, phobosMat);
    phobos.position.set(-65, 78, -235);
    phobos.scale.set(1.2, 0.8, 1.0);
    this.environmentGroup.add(phobos);

    // Faint stars in upper Martian atmosphere
    const starCount = 300;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 550;
      positions[i * 3 + 1] = 40 + Math.random() * 160;
      positions[i * 3 + 2] = -50 - Math.random() * 320;
    }

    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffd1b2,
      size: 1.1,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.75,
    });
    const stars = new THREE.Points(starGeo, starMat);
    this.environmentGroup.add(stars);

    // 2. Oxidized Red Regolith Terrain Planes
    const terrainGeo = new THREE.PlaneGeometry(240, ROAD_LENGTH, 1, 1);
    terrainGeo.rotateX(-Math.PI * 0.5);
    const marsTerrainMat = new THREE.MeshStandardMaterial({
      color: 0x5a2314,
      roughness: 0.90,
      metalness: 0.08,
    });
    const leftTerrain = new THREE.Mesh(terrainGeo, marsTerrainMat);
    leftTerrain.position.set(-(ROAD_WIDTH * 0.5 + 120), -0.04, -ROAD_LENGTH * 0.4);
    leftTerrain.receiveShadow = true;
    const rightTerrain = new THREE.Mesh(terrainGeo, marsTerrainMat);
    rightTerrain.position.set(ROAD_WIDTH * 0.5 + 120, -0.04, -ROAD_LENGTH * 0.4);
    rightTerrain.receiveShadow = true;
    this.environmentGroup.add(leftTerrain, rightTerrain);

    // 3. Tiered Martian Mesas / Flat-Topped Canyon Buttes
    const mesaMat = new THREE.MeshStandardMaterial({
      color: 0x4a1b0e,
      roughness: 0.88,
      metalness: 0.12,
    });

    const mesaConfigs = [
      { x: -38, z: -40, topR: 16, btmR: 24, h: 22 },
      { x:  46, z: -75, topR: 20, btmR: 30, h: 28 },
      { x: -55, z: -115, topR: 25, btmR: 36, h: 35 },
      { x:  52, z: -150, topR: 18, btmR: 28, h: 26 },
      { x: -44, z: -190, topR: 22, btmR: 32, h: 32 },
      { x:  60, z: -225, topR: 28, btmR: 40, h: 42 },
      { x: -62, z: -260, topR: 30, btmR: 44, h: 48 },
      { x:  42, z: -290, topR: 19, btmR: 29, h: 27 },
      { x: -75, z: -60, topR: 22, btmR: 34, h: 30 },
      { x:  78, z: -110, topR: 26, btmR: 38, h: 38 },
      { x: -82, z: -160, topR: 28, btmR: 42, h: 40 },
      { x:  85, z: -210, topR: 32, btmR: 46, h: 46 },
    ];

    mesaConfigs.forEach((m) => {
      const mesaGeo = new THREE.CylinderGeometry(m.topR, m.btmR, m.h, 7);
      const mesa = new THREE.Mesh(mesaGeo, mesaMat);
      mesa.position.set(m.x, m.h * 0.5 - 2, m.z);
      mesa.castShadow = true;
      this.environmentGroup.add(mesa);
    });

    // 4. Ochre & Iron Rock Formations
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x42170d,
      roughness: 0.92,
      metalness: 0.1,
    });

    for (let i = 0; i < 30; i++) {
      const isLeft = i % 2 === 0;
      const xDist = (ROAD_WIDTH * 0.5 + 3) + Math.random() * 60;
      const x = isLeft ? -xDist : xDist;
      const z = -15 - Math.random() * 290;
      const radius = 1.4 + Math.random() * 4.5;

      const rockGeo = new THREE.DodecahedronGeometry(radius, 0);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.scale.set(1.0 + Math.random() * 0.5, 0.6 + Math.random() * 0.5, 1.0 + Math.random() * 0.5);
      rock.position.set(x, radius * 0.35, z);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      this.environmentGroup.add(rock);
    }
  }

  private createProceduralEarthTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return new THREE.CanvasTexture(canvas);
    }

    // Deep oceanic gradient
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, 256);
    oceanGrad.addColorStop(0, '#0c2444');
    oceanGrad.addColorStop(0.5, '#10396b');
    oceanGrad.addColorStop(1, '#0c2444');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, 512, 256);

    // Continents
    ctx.fillStyle = '#2d5e38'; // Temperate greenery
    // Eurasia
    ctx.beginPath();
    ctx.ellipse(300, 95, 75, 45, -0.15, 0, Math.PI * 2);
    ctx.fill();
    // Sahara & Middle East
    ctx.fillStyle = '#7a7d45';
    ctx.beginPath();
    ctx.ellipse(275, 125, 45, 38, 0.1, 0, Math.PI * 2);
    ctx.fill();
    // Sub-Saharan Africa
    ctx.fillStyle = '#326834';
    ctx.beginPath();
    ctx.ellipse(280, 168, 28, 38, 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Americas
    ctx.fillStyle = '#2d5e38';
    ctx.beginPath();
    ctx.ellipse(125, 88, 55, 38, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#275832';
    ctx.beginPath();
    ctx.ellipse(160, 165, 32, 52, 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Australia
    ctx.fillStyle = '#9e7d4d';
    ctx.beginPath();
    ctx.ellipse(410, 175, 28, 22, -0.1, 0, Math.PI * 2);
    ctx.fill();

    // Polar Ice Caps
    ctx.fillStyle = '#e8f4fc';
    ctx.beginPath();
    ctx.ellipse(256, 12, 240, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(256, 246, 240, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    // Atmospheric Cloud Bands
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    for (let i = 0; i < 16; i++) {
      const cy = 40 + i * 12;
      const cx = (i * 35) % 512;
      const cw = 60 + Math.sin(i) * 35;
      const ch = 10 + Math.cos(i) * 6;
      ctx.beginPath();
      ctx.ellipse(cx, cy, cw, ch, Math.sin(i * 0.7) * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 512, cy, cw, ch, Math.sin(i * 0.7) * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 512, cy, cw, ch, Math.sin(i * 0.7) * 0.25, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Bounded Particle Pool: exactly 60 particles, shared geometry, zero allocations
   */
  private setupParticlePool() {
    const pGeo = new THREE.SphereGeometry(0.28, 6, 6);

    for (let i = 0; i < ThreeSceneManager.MAX_PARTICLES; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xdde7f5,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(pGeo, mat);
      mesh.visible = false;
      this.particleContainer.add(mesh);
      this.particlePool.push({
        mesh,
        mat,
        active: false,
        velocity: new THREE.Vector3(),
        life: 0,
        maxLife: 1,
        type: 'smoke',
        growth: 1.5,
      });
    }
  }

  public spawnParticle(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    colorHex: number,
    life: number,
    type: 'smoke' | 'spark' | 'flame',
    initialScale = 1.0,
    growth = 1.5
  ) {
    // Find inactive or recycle oldest
    let p = this.particlePool.find((item) => !item.active);
    if (!p) {
      // Recycle lowest remaining life
      p = this.particlePool.reduce((min, curr) => (curr.life < min.life ? curr : min), this.particlePool[0]);
    }

    p.active = true;
    p.life = life;
    p.maxLife = life;
    p.type = type;
    p.growth = growth;
    p.velocity.set(vx, vy, vz);

    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(initialScale);
    p.mesh.visible = true;

    p.mat.color.setHex(colorHex);
    p.mat.opacity = type === 'smoke' ? 0.5 : 0.9;
  }

  /**
   * Instantiates an obstacle group using SHARED geometries and materials.
   */
  private createObstacleGroup(type: string, variant = 0): THREE.Group {
    const group = new THREE.Group();

    if (type === 'barrier') {
      const leftPost = new THREE.Mesh(this.sharedGeos['barrierPost'], this.sharedMats['barrierMetal']);
      leftPost.position.set(-LANE_WIDTH * 0.48, 0.8, 0);
      group.add(leftPost);

      const rightPost = new THREE.Mesh(this.sharedGeos['barrierPost'], this.sharedMats['barrierMetal']);
      rightPost.position.set(LANE_WIDTH * 0.48, 0.8, 0);
      group.add(rightPost);

      const topBar = new THREE.Mesh(this.sharedGeos['barrierBar'], this.sharedMats['barrierMetal']);
      topBar.position.set(0, 1.5, 0);
      group.add(topBar);

      const laser = new THREE.Mesh(this.sharedGeos['barrierLaser'], this.sharedMats['barrierLaser']);
      laser.position.set(0, 0.75, 0);
      laser.name = 'laser';
      group.add(laser);

      const beacon = new THREE.Mesh(this.sharedGeos['barrierBeacon'], this.sharedMats['barrierBeacon']);
      beacon.position.set(0, 1.65, 0);
      group.add(beacon);

    } else if (type === 'traffic') {
      const bodyMat = variant === 1 ? this.sharedMats['trafficBodyBlue'] : this.sharedMats['trafficBodyGrey'];
      const hull = new THREE.Mesh(this.sharedGeos['trafficHull'], bodyMat);
      hull.position.set(0, 0.42, 0);
      hull.castShadow = true;
      group.add(hull);

      const cabin = new THREE.Mesh(this.sharedGeos['trafficCabin'], this.sharedMats['trafficGlass']);
      cabin.position.set(0, 0.78, 0.2);
      group.add(cabin);

      const tail = new THREE.Mesh(this.sharedGeos['trafficLight'], this.sharedMats['tailLight']);
      tail.position.set(0, 0.46, 1.9);
      group.add(tail);

      const head = new THREE.Mesh(this.sharedGeos['trafficLight'], this.sharedMats['headLight']);
      head.position.set(0, 0.46, -1.9);
      group.add(head);

    } else if (type === 'gap') {
      const hole = new THREE.Mesh(this.sharedGeos['gapHole'], this.sharedMats['gapHole']);
      hole.position.set(0, 0.02, 0);
      group.add(hole);

      const frontBorder = new THREE.Mesh(this.sharedGeos['gapBorder'], this.sharedMats['gapBorder']);
      frontBorder.position.set(0, 0.05, -2.5);
      group.add(frontBorder);

      const backBorder = new THREE.Mesh(this.sharedGeos['gapBorder'], this.sharedMats['gapBorder']);
      backBorder.position.set(0, 0.05, 2.5);
      group.add(backBorder);

    } else if (type === 'orb') {
      const orb = new THREE.Mesh(this.sharedGeos['orbCore'], this.sharedMats['orbCore']);
      orb.position.set(0, 1.1, 0);
      orb.name = 'orbCore';
      group.add(orb);

      const ring = new THREE.Mesh(this.sharedGeos['orbRing'], this.sharedMats['orbRing']);
      ring.position.set(0, 1.1, 0);
      ring.rotation.x = Math.PI * 0.3;
      ring.name = 'orbRing';
      group.add(ring);

    } else if (type === 'coin') {
      const disc = new THREE.Mesh(this.sharedGeos['coinDisc'], this.sharedMats['coinGold']);
      disc.name = 'coinDisc';
      group.add(disc);

      const ringFront = new THREE.Mesh(this.sharedGeos['coinRing'], this.sharedMats['coinRim']);
      ringFront.position.z = 0.045;
      group.add(ringFront);

      const ringBack = new THREE.Mesh(this.sharedGeos['coinRing'], this.sharedMats['coinRim']);
      ringBack.position.z = -0.045;
      ringBack.rotation.y = Math.PI;
      group.add(ringBack);

    } else if (type === 'powerup') {
      const halo = new THREE.Mesh(this.sharedGeos['powerupHalo'], this.sharedMats['powerupHalo']);
      halo.name = 'powerupHalo';
      group.add(halo);

      const magnet = new THREE.Mesh(this.sharedGeos['powerupMagnet'], this.sharedMats['powerupMagnet']);
      magnet.name = 'mesh_magnet';
      group.add(magnet);

      const fuel = new THREE.Mesh(this.sharedGeos['powerupFuel'], this.sharedMats['powerupFuel']);
      fuel.name = 'mesh_fuel';
      group.add(fuel);

      const shield = new THREE.Mesh(this.sharedGeos['powerupShield'], this.sharedMats['powerupShield']);
      shield.name = 'mesh_shield';
      group.add(shield);

      const multiplier = new THREE.Mesh(this.sharedGeos['powerupMultiplier'], this.sharedMats['powerupMultiplier']);
      multiplier.name = 'mesh_multiplier';
      group.add(multiplier);
    }

    return group;
  }

  /**
   * Acquire an obstacle mesh from the pool, preventing unbounded memory growth.
   */
  private acquireObstacleMesh(obj: GameObject): THREE.Group {
    let pool: THREE.Group[];
    if (obj.type === 'barrier') pool = this.poolBarrier;
    else if (obj.type === 'traffic') pool = this.poolTraffic;
    else if (obj.type === 'gap') pool = this.poolGap;
    else if (obj.type === 'coin') pool = this.poolCoin;
    else if (obj.type === 'powerup') pool = this.poolPowerup;
    else pool = this.poolOrb;

    let group = pool.pop();
    if (!group) {
      group = this.createObstacleGroup(obj.type, obj.variant);
      this.scene.add(group);
    }

    if (obj.type === 'powerup') {
      const pType = obj.powerupType || 'fuel';
      ['magnet', 'fuel', 'shield', 'multiplier'].forEach((t) => {
        const m = group.getObjectByName(`mesh_${t}`);
        if (m) m.visible = t === pType;
      });
    }

    group.visible = true;
    this.obstacleMeshMap.set(obj.id, group);
    return group;
  }

  /**
   * Release obstacle mesh back to pool when it leaves screen.
   */
  private releaseObstacleMesh(id: string, group: THREE.Group, type: string) {
    group.visible = false;
    this.obstacleMeshMap.delete(id);

    if (type === 'barrier') this.poolBarrier.push(group);
    else if (type === 'traffic') this.poolTraffic.push(group);
    else if (type === 'gap') this.poolGap.push(group);
    else if (type === 'coin') this.poolCoin.push(group);
    else if (type === 'powerup') this.poolPowerup.push(group);
    else this.poolOrb.push(group);
  }

  /**
   * Main render update called each frame from React requestAnimationFrame
   */
  public update(
    dt: number,
    player: PlayerCar,
    objects: GameObject[],
    screenShake: number,
    screenShakeX: number,
    screenShakeY: number,
    isMenu: boolean = false
  ) {
    if (this.isContextLost) return;
    this.time += dt;

    // 1. Update Player Vehicle Position & Vertical Altitude (Physical Flight)
    const targetCarX = player.x * LANE_WIDTH;

    // Physical Altitude Lift:
    // When grounded (altitude = 0): Y = 0.
    // When airborne (altitude = 1.0): Y = FLIGHT_ALTITUDE_HEIGHT (2.4 units above road).
    // Barrier is height 1.5, giving a visible 0.9-unit clearance!
    const targetCarY = player.altitude * FLIGHT_ALTITUDE_HEIGHT;

    this.carGroup.position.x = targetCarX;
    this.carGroup.position.y = targetCarY;
    this.carGroup.position.z = 0;

    // Aerodynamic Banking / Roll when steering
    const targetRoll = -player.bankAngle * 0.18;
    this.carGroup.rotation.z = THREE.MathUtils.damp(this.carGroup.rotation.z, targetRoll, 12, dt);

    // Aerodynamic Pitch: slight nose pitch-up when taking off / flying
    const targetPitch = player.isFlying ? -0.06 : 0;
    this.carGroup.rotation.x = THREE.MathUtils.damp(this.carGroup.rotation.x, targetPitch, 8, dt);

    // Rotate Wheels based on road speed (grounded)
    const wheelSpinDelta = (player.speed / 3.6) * dt * 2.8;
    this.roadsterParts.wheels.forEach((wheel) => {
      wheel.rotation.x += wheelSpinDelta;
    });

    // 2. Flight Thrusters Animation & Downwash Effects
    const isAirborne = player.altitude > 0.04;
    const thrusterIntensity = Math.min(1, player.altitude * 1.5);

    this.roadsterParts.thrusterPlumes.forEach((plume, index) => {
      plume.visible = isAirborne;
      if (isAirborne) {
        const flicker = 0.85 + Math.sin(this.time * 45 + index * 1.8) * 0.2;
        const lengthScale = (0.9 + player.altitude * 0.6) * flicker;
        plume.scale.set(flicker, lengthScale, flicker);
      }
    });

    // Downwash illumination on road surface
    if (isAirborne) {
      this.roadsterParts.thrusterLight.intensity = thrusterIntensity * 5.5;
      this.roadsterParts.thrusterLight.distance = 16 + player.altitude * 8;
    } else {
      this.roadsterParts.thrusterLight.intensity = 0;
    }

    // Contact Ground Shadow: scales up and softens as vehicle ascends
    this.roadsterParts.contactShadow.position.x = targetCarX;
    const shadowScale = 1.0 + player.altitude * 1.4;
    this.roadsterParts.contactShadow.scale.set(shadowScale, shadowScale, shadowScale);
    const shadowMat = this.roadsterParts.contactShadow.material as THREE.MeshBasicMaterial;
    shadowMat.opacity = Math.max(0.12, 0.65 - player.altitude * 0.45);

    // Emit thruster smoke & sparks when airborne (originating at the 4 nozzles)
    if (isAirborne && Math.random() > 0.35) {
      const nozzleOffsets = [
        { x: -0.62, z: -0.85 },
        { x:  0.62, z: -0.85 },
        { x: -0.62, z:  0.85 },
        { x:  0.62, z:  0.85 },
      ];
      const noz = nozzleOffsets[Math.floor(Math.random() * nozzleOffsets.length)];
      const worldNozX = targetCarX + noz.x;
      const worldNozY = targetCarY + 0.12;
      const worldNozZ = noz.z;

      // World-specific spark & dust coloration
      const sparkColor = this.currentWorld === 'MARS'
        ? (Math.random() > 0.3 ? 0xff7733 : 0xffffff)
        : (this.currentWorld === 'MOON'
          ? (Math.random() > 0.3 ? 0x90caf9 : 0xffffff)
          : (Math.random() > 0.3 ? 0x00d4ff : 0xffffff));

      const dustColor = this.currentWorld === 'MOON'
        ? (Math.random() > 0.5 ? 0x9ca3af : 0xd1d5db)
        : (this.currentWorld === 'MARS'
          ? (Math.random() > 0.5 ? 0xca5832 : 0xdd6b20)
          : 0xdce6f2);

      // Downward flame spark from nozzle
      this.spawnParticle(
        worldNozX + (Math.random() - 0.5) * 0.08,
        worldNozY,
        worldNozZ,
        (Math.random() - 0.5) * 0.6,
        -12 - Math.random() * 8,
        (Math.random() - 0.5) * 0.6,
        sparkColor,
        0.18,
        'flame',
        0.55,
        1.2
      );

      // Billowing ground dust / vapor rolling outward below the airborne car
      const isLeft = Math.random() > 0.5;
      this.spawnParticle(
        worldNozX + (isLeft ? -0.4 : 0.4),
        0.05,
        worldNozZ - 0.4,
        (isLeft ? -3.2 : 3.2) + (Math.random() - 0.5) * 1.5,
        0.2 + Math.random() * 0.4,
        -4.0 - Math.random() * 3.0,
        dustColor,
        0.55,
        'smoke',
        0.8,
        3.2
      );
    }

    // High-speed ground dust kickup behind tires on Moon and Mars
    if (!isAirborne && (this.currentWorld === 'MOON' || this.currentWorld === 'MARS') && player.speed > 130 && Math.random() > 0.65) {
      const isLeftTire = Math.random() > 0.5;
      const tireOffset = isLeftTire ? -0.84 : 0.84;
      const dustColor = this.currentWorld === 'MOON'
        ? (Math.random() > 0.5 ? 0x9ca3af : 0xd1d5db)
        : (Math.random() > 0.5 ? 0xca5832 : 0xdd6b20);

      this.spawnParticle(
        targetCarX + tireOffset + (Math.random() - 0.5) * 0.1,
        0.04,
        1.2 + (Math.random() - 0.5) * 0.2,
        (isLeftTire ? -1.0 : 1.0) * (0.8 + Math.random() * 0.8),
        0.15 + Math.random() * 0.25,
        -4.0 - Math.random() * 3.0,
        dustColor,
        0.35,
        'smoke',
        0.6,
        2.2
      );
    }

    // Invulnerability blink effect on car body
    if (player.invulnerableTimer > 0) {
      const blink = Math.floor(this.time * 24) % 2 === 0;
      this.roadsterParts.bodyMesh.visible = blink;
      this.roadsterParts.canopyMesh.visible = blink;
    } else {
      this.roadsterParts.bodyMesh.visible = true;
      this.roadsterParts.canopyMesh.visible = true;
    }

    // Defensive Forcefield Shield Bubble
    if (player.hasShield) {
      this.shieldBubbleMesh.visible = true;
      this.shieldBubbleMesh.rotation.y += dt * 1.8;
      this.shieldBubbleMesh.rotation.z += dt * 1.2;
      const pulse = 0.28 + Math.sin(this.time * 8) * 0.12;
      (this.shieldBubbleMesh.material as THREE.MeshBasicMaterial).opacity = pulse;
    } else {
      this.shieldBubbleMesh.visible = false;
    }

    // 3. Update Road Scrolling
    const roadSpeed = (player.speed / 3.6) * Z_SCALE * 6.5;
    this.roadScrollOffset += roadSpeed * dt;

    this.roadDashes.forEach((dash) => {
      let newZ = dash.position.z + roadSpeed * dt;
      if (newZ > 25) {
        newZ -= ROAD_LENGTH;
      }
      dash.position.z = newZ;
    });

    this.pylons.forEach((pylon) => {
      let newZ = pylon.position.z + roadSpeed * dt;
      if (newZ > 25) {
        newZ -= ROAD_LENGTH;
      }
      pylon.position.z = newZ;
    });

    // 4. Update Dynamic 3D Obstacles with zero memory leak
    const activeObjIds = new Set<string>();

    objects.forEach((obj) => {
      activeObjIds.add(obj.id);
      let mesh = this.obstacleMeshMap.get(obj.id);
      if (!mesh) {
        mesh = this.acquireObstacleMesh(obj);
      }

      mesh.position.x = LANE_X[obj.lane];
      const distFromPlayer = obj.z - 60;
      mesh.position.z = -distFromPlayer * Z_SCALE;

      if (obj.type === 'coin') {
        mesh.visible = !obj.collected;
        if (!obj.collected) {
          const baseY = obj.isElevated ? 2.4 : 0.55;
          mesh.position.y = baseY + Math.sin(this.time * 6 + obj.z * 0.08) * 0.1;
          mesh.rotation.y += dt * 4.5;
        }
      } else if (obj.type === 'powerup') {
        mesh.visible = !obj.collected;
        if (!obj.collected) {
          const baseY = obj.isElevated ? 2.4 : 0.85;
          mesh.position.y = baseY + Math.sin(this.time * 4) * 0.14;
          mesh.rotation.y += dt * 2.8;
          const halo = mesh.getObjectByName('powerupHalo');
          if (halo) {
            halo.rotation.x = Math.PI * 0.5 + Math.sin(this.time * 3) * 0.2;
          }
        }
      } else if (obj.type === 'orb') {
        mesh.visible = !obj.collected;
        if (!obj.collected) {
          mesh.position.y = 1.1 + Math.sin(this.time * 4 + obj.z * 0.05) * 0.25;
          mesh.rotation.y += dt * 3.0;
        }
      } else if (obj.type === 'barrier') {
        // Laser wall pulsing intensity
        const laser = mesh.getObjectByName('laser') as THREE.Mesh;
        if (laser) {
          (laser.material as THREE.MeshBasicMaterial).opacity = 0.65 + Math.sin(this.time * 10) * 0.25;
        }
      } else if (obj.type === 'traffic') {
        mesh.position.y = 0;
      }
    });

    // Recycle removed obstacles into the pool (ZERO leaks!)
    for (const [id, mesh] of this.obstacleMeshMap.entries()) {
      if (!activeObjIds.has(id)) {
        // Determine type from object name or child count
        const type = mesh.getObjectByName('laser')
          ? 'barrier'
          : mesh.getObjectByName('coinDisc')
          ? 'coin'
          : mesh.getObjectByName('powerupHalo')
          ? 'powerup'
          : mesh.getObjectByName('orbCore')
          ? 'orb'
          : mesh.children.length === 3
          ? 'gap'
          : 'traffic';
        this.releaseObstacleMesh(id, mesh, type);
      }
    }

    // 5. Update Particles
    this.particlePool.forEach((p) => {
      if (!p.active) return;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.mesh.visible = false;
        return;
      }

      p.mesh.position.addScaledVector(p.velocity, dt);

      if (p.growth > 0) {
        const curScale = p.mesh.scale.x + p.growth * dt;
        p.mesh.scale.setScalar(curScale);
      }

      const progress = p.life / p.maxLife;
      p.mat.opacity = (p.type === 'smoke' ? 0.45 : 0.95) * progress;
    });

    // 6. Camera Follow: Cinematic Studio Orbit in Menu vs Third-Person Chase in Game
    if (isMenu) {
      // Slow, majestic cinematic orbit showcasing the silver Roadster from three-quarter angles
      const orbitSpeed = 0.2;
      const angle = this.time * orbitSpeed + 0.75;
      const radius = 6.6;
      const camX = Math.sin(angle) * radius * 0.75;
      const camY = 1.65 + Math.sin(this.time * 0.3) * 0.2;
      const camZ = Math.cos(angle) * radius;

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, camX, 4, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, camY, 4, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, camZ, 4, dt);

      this._camLookTarget.set(0, 0.45, 0);
      this._currentCamLook.x = THREE.MathUtils.damp(this._currentCamLook.x, this._camLookTarget.x, 6, dt);
      this._currentCamLook.y = THREE.MathUtils.damp(this._currentCamLook.y, this._camLookTarget.y, 6, dt);
      this._currentCamLook.z = THREE.MathUtils.damp(this._currentCamLook.z, this._camLookTarget.z, 6, dt);

      this.camera.lookAt(this._currentCamLook);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 48, 4, dt);
      this.camera.updateProjectionMatrix();
    } else {
      const camTargetX = targetCarX * 0.65;
      const camTargetY = 3.3 + player.altitude * 0.9;
      const camTargetZ = 7.4;

      this._camTargetPos.set(camTargetX, camTargetY, camTargetZ);

      if (screenShake > 0) {
        this._camTargetPos.x += (Math.random() - 0.5) * screenShake * 0.35;
        this._camTargetPos.y += (Math.random() - 0.5) * screenShake * 0.35;
      }

      this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, this._camTargetPos.x, 14, dt);
      this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, this._camTargetPos.y, 10, dt);
      this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, this._camTargetPos.z, 14, dt);

      // Look Target ahead down the highway
      this._camLookTarget.set(
        targetCarX * 0.35,
        1.3 + player.altitude * 0.45,
        -18
      );
      this._currentCamLook.x = THREE.MathUtils.damp(this._currentCamLook.x, this._camLookTarget.x, 12, dt);
      this._currentCamLook.y = THREE.MathUtils.damp(this._currentCamLook.y, this._camLookTarget.y, 10, dt);
      this._currentCamLook.z = this._camLookTarget.z;

      this.camera.lookAt(this._currentCamLook);

      // Subtle FOV expansion with speed and flight
      const speedRatio = Math.max(0, (player.speed - 160) / 200);
      const targetFOV = 56 + speedRatio * 8 + (player.isFlying ? 3 : 0);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFOV, 6, dt);
      this.camera.updateProjectionMatrix();
    }

    // 7. Celestial Animation (slow rotation of Earth in Moon sky)
    if (this.earthMesh) {
      this.earthMesh.rotation.y += dt * 0.02;
    }

    // 8. Render Scene
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Clean resize handler
   */
  public handleResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  }

  /**
   * Dispose all resources on unmount
   */
  public dispose() {
    this.clearGroup(this.environmentGroup);

    if (this.earthTexture) {
      this.earthTexture.dispose();
      this.earthTexture = null;
    }

    if (this.envTexture) {
      this.envTexture.dispose();
      this.envTexture = null;
    }
    this.renderer.dispose();
    this.obstacleMeshMap.clear();
    this.poolBarrier = [];
    this.poolTraffic = [];
    this.poolGap = [];
    this.poolOrb = [];

    // Dispose shared assets
    Object.values(this.sharedGeos).forEach((g) => g.dispose());
    Object.values(this.sharedMats).forEach((m) => m.dispose());
  }
}
