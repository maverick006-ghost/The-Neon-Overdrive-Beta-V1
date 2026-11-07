/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GameObject, GameWorld, PlayerCar, VehicleId } from './types';
import { createVehicleModel, VEHICLE_DEFINITIONS } from './vehicles/vehicleRegistry';
import { VehicleModelInstance } from './vehicles/vehicleTypes';

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

  // Active World & Vehicle State
  public currentWorld: GameWorld = 'EARTH';
  public currentVehicleId: VehicleId = 'AERO_X';
  private environmentGroup: THREE.Group;
  private earthMesh: THREE.Mesh | null = null;
  private earthTexture: THREE.CanvasTexture | null = null;
  private cityWindowTexture: THREE.CanvasTexture | null = null;
  private lunarRegolithTexture: THREE.CanvasTexture | null = null;
  private marsStrataTexture: THREE.CanvasTexture | null = null;

  // Environmental Parallax and Dynamic World Animation
  private scrollingScenery: {
    object: THREE.Object3D;
    speedRatio: number;
    minZ: number;
    maxZ: number;
  }[] = [];
  private animatedScenery: ((dt: number, time: number) => void)[] = [];

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
  private barrierLightStripMat!: THREE.MeshBasicMaterial;
  private pylonPostMat!: THREE.MeshStandardMaterial;
  private pylonStripMat!: THREE.MeshBasicMaterial;

  // Vehicle Kinematics & Physical Animation
  private wheelSpinAngle = 0;
  private prevAirborne = false;
  private landingBounce = 0;
  private thrusterDeployAnim = 0;
  private smoothRoll = 0;
  private smoothYaw = 0;
  private currentSuspensionY = 0;

  // Car 3D model references
  public carGroup: THREE.Group;
  public currentVehicle: VehicleModelInstance;

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

  constructor(
    canvas: HTMLCanvasElement,
    initialWorld: GameWorld = 'EARTH',
    initialVehicle: VehicleId = 'AERO_X'
  ) {
    this.currentVehicleId = initialVehicle;
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

    // 9. Build Hero Vehicle (Custom 3D geometry & materials)
    this.currentVehicle = createVehicleModel(initialVehicle);
    this.carGroup = this.currentVehicle.rootGroup;
    this.scene.add(this.carGroup);
    this.scene.add(this.currentVehicle.contactShadow);

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

    // Continuous Illuminated Barrier Edge Light Strips (matches Earth & Mars references)
    const lightStripGeo = new THREE.BoxGeometry(0.08, 0.05, ROAD_LENGTH);
    this.barrierLightStripMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.95,
    });

    const leftLightStrip = new THREE.Mesh(lightStripGeo, this.barrierLightStripMat);
    leftLightStrip.position.set(-ROAD_WIDTH * 0.5 - 0.25, 0.66, -ROAD_LENGTH * 0.4);
    this.roadGroup.add(leftLightStrip);

    const rightLightStrip = new THREE.Mesh(lightStripGeo, this.barrierLightStripMat);
    rightLightStrip.position.set(ROAD_WIDTH * 0.5 + 0.25, 0.66, -ROAD_LENGTH * 0.4);
    this.roadGroup.add(rightLightStrip);

    // Regular Vertical Support Posts for physical grounding
    const postGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.52, 6);
    for (let pz = -ROAD_LENGTH * 0.85; pz <= 20; pz += 10) {
      const lp = new THREE.Mesh(postGeo, this.barrierMat);
      lp.position.set(-ROAD_WIDTH * 0.5 - 0.25, 0.26, pz);
      this.roadGroup.add(lp);

      const rp = new THREE.Mesh(postGeo, this.barrierMat);
      rp.position.set(ROAD_WIDTH * 0.5 + 0.25, 0.26, pz);
      this.roadGroup.add(rp);
    }

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

    // 1. Reset animation and scrolling scenery registries
    this.scrollingScenery = [];
    this.animatedScenery = [];

    // 2. Dispose & Clear previous environment scenery
    this.clearGroup(this.environmentGroup);
    this.earthMesh = null;

    // 3. Configure World-Specific Atmospherics, Lighting & Highway Materials
    if (world === 'MOON') {
      // Natural Lunar Environment (matching image_6211f798.png)
      this.scene.background = new THREE.Color(0x010204);
      this.scene.fog = new THREE.FogExp2(0x010204, 0.0016);

      // Unfiltered direct solar irradiance in space vacuum
      this.ambientLight.color.setHex(0x0a0c10);
      this.ambientLight.intensity = 0.28;
      this.hemiLight.color.setHex(0x161a24);
      this.hemiLight.groundColor.setHex(0x06070a);
      this.hemiLight.intensity = 0.40;
      this.dirLight.color.setHex(0xffffff);
      this.dirLight.intensity = 2.9;
      this.rimLight.color.setHex(0x90a4be);
      this.rimLight.intensity = 1.1;

      if (this.roadMat) {
        this.roadMat.color.setHex(0x15171c);
        this.dashMat.color.setHex(0xe2e8f0);
        this.curbRailMat.color.setHex(0x22262e);
        this.barrierMat.color.setHex(0x282d36); // Dark titanium crash rail
        this.barrierLightStripMat.color.setHex(0x475569);
        this.barrierLightStripMat.opacity = 0.20;
        this.pylonPostMat.color.setHex(0x1a1e26);
        this.pylonStripMat.color.setHex(0x38bdf8);
      }

      this.buildMoonEnvironment();
    } else if (world === 'MARS') {
      // Red Frontier Canyon Viaduct (matching image_7f8c85cf.png)
      this.scene.background = new THREE.Color(0x2a130a);
      this.scene.fog = new THREE.FogExp2(0x2a130a, 0.0042);

      // Warm Martian twilight, diffused solar irradiance through dust haze
      this.ambientLight.color.setHex(0x301309);
      this.ambientLight.intensity = 0.90;
      this.hemiLight.color.setHex(0x542314);
      this.hemiLight.groundColor.setHex(0x1a0604);
      this.hemiLight.intensity = 1.0;
      this.dirLight.color.setHex(0xffc48c);
      this.dirLight.intensity = 2.6;
      this.rimLight.color.setHex(0xe55624);
      this.rimLight.intensity = 1.4;

      if (this.roadMat) {
        this.roadMat.color.setHex(0x1c1210);
        this.dashMat.color.setHex(0xffeed8);
        this.curbRailMat.color.setHex(0x381c16);
        this.barrierMat.color.setHex(0x381c16);
        this.barrierLightStripMat.color.setHex(0xf97316);
        this.barrierLightStripMat.opacity = 0.90; // Warm amber reflector strip
        this.pylonPostMat.color.setHex(0x2d1712);
        this.pylonStripMat.color.setHex(0xfb923c);
      }

      this.buildMarsEnvironment();
    } else {
      // EARTH — Neo Horizon (matching image_f1cb117e.png)
      this.scene.background = new THREE.Color(0x0b1c34);
      this.scene.fog = new THREE.FogExp2(0x0b1c34, 0.0045);

      // Crisp daytime lighting & sky fill
      this.ambientLight.color.setHex(0x122340);
      this.ambientLight.intensity = 0.85;
      this.hemiLight.color.setHex(0x1f3c64);
      this.hemiLight.groundColor.setHex(0x0c1e14);
      this.hemiLight.intensity = 1.10;
      this.dirLight.color.setHex(0xfffaea);
      this.dirLight.intensity = 2.3;
      this.rimLight.color.setHex(0x38bdf8);
      this.rimLight.intensity = 1.3;

      if (this.roadMat) {
        this.roadMat.color.setHex(0x111620);
        this.dashMat.color.setHex(0xf8fafc);
        this.curbRailMat.color.setHex(0x1c2432);
        this.barrierMat.color.setHex(0xf1f5f9); // Clean white aerodynamic safety barrier
        this.barrierLightStripMat.color.setHex(0x10b981); // Emerald/cyan glowing ribbon edge
        this.barrierLightStripMat.opacity = 1.0;
        this.pylonPostMat.color.setHex(0x1e293b);
        this.pylonStripMat.color.setHex(0x10b981);
      }

      this.buildEarthEnvironment();
    }
  }

  /**
   * Switches the active hero vehicle model in real-time,
   * cleanly disposing previous vehicle geometry/materials and reattaching
   * the defensive forcefield shield mesh and contact shadow.
   */
  public setVehicle(vehicleId: VehicleId) {
    if (this.currentVehicleId === vehicleId && this.carGroup.children.length > 0) return;
    this.currentVehicleId = vehicleId;

    if (this.shieldBubbleMesh && this.shieldBubbleMesh.parent) {
      this.shieldBubbleMesh.parent.remove(this.shieldBubbleMesh);
    }
    if (this.currentVehicle?.contactShadow && this.currentVehicle.contactShadow.parent) {
      this.currentVehicle.contactShadow.parent.remove(this.currentVehicle.contactShadow);
    }
    if (this.currentVehicle) {
      this.scene.remove(this.carGroup);
      this.currentVehicle.dispose();
    }

    this.currentVehicle = createVehicleModel(vehicleId);
    this.carGroup = this.currentVehicle.rootGroup;
    this.scene.add(this.carGroup);
    this.scene.add(this.currentVehicle.contactShadow);

    if (this.shieldBubbleMesh) {
      const isMotorcycle = vehicleId === 'NEON_CYCLE';
      this.shieldBubbleMesh.scale.set(isMotorcycle ? 0.75 : 1.0, 1.0, isMotorcycle ? 0.85 : 1.0);
      this.carGroup.add(this.shieldBubbleMesh);
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

  /**
   * EARTH — NEO HORIZON (Inspired by image_ed19bfff.png)
   * Elevated urban superhighway overlooking a dense, panoramic metropolis at twilight/blue-hour.
   * Features glowing skyscraper window grids, architectural crowns, support piers, and sky-traffic.
   */
  private buildEarthEnvironment() {
    if (!this.cityWindowTexture) {
      this.cityWindowTexture = this.createCityWindowTexture();
    }

    // 1. Natural Rolling Green Hills and River Valley Beneath the Highway
    const terrainGeo = new THREE.PlaneGeometry(380, ROAD_LENGTH * 1.5, 90, 70);
    terrainGeo.rotateX(-Math.PI * 0.5);
    const pos = terrainGeo.attributes.position;

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Center corridor blends down into valley beneath elevated highway
      const corridorDist = Math.max(0, Math.abs(x) - (ROAD_WIDTH * 0.5 + 2.5));
      const blend = Math.min(corridorDist / 24, 1.0);

      // Rolling harmonic hills and gentle valley topography
      const hill1 = Math.sin(x * 0.022 + 0.8) * Math.cos(z * 0.016) * 9.5;
      const hill2 = Math.sin(x * 0.045 - z * 0.030) * 4.2;
      const valley = -5.5 * (1.0 - blend); // Valley drop directly under the elevated viaduct

      pos.setY(i, (hill1 + hill2) * blend + valley - 0.2);
    }
    terrainGeo.computeVertexNormals();

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x24542d, // Lush emerald grass
      roughness: 0.86,
      metalness: 0.06,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, grassMat);
    terrainMesh.position.set(0, 0, -ROAD_LENGTH * 0.4);
    terrainMesh.receiveShadow = true;
    this.environmentGroup.add(terrainMesh);

    // 2. Highway Viaduct Sculpted Support Piers (Elevated above valley floor)
    const pierGeo = new THREE.BoxGeometry(2.2, 16, 2.5);
    const pierMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9, // Clean architectural white concrete
      metalness: 0.4,
      roughness: 0.35,
    });
    for (let z = -ROAD_LENGTH * 0.85; z <= 20; z += 35) {
      const pier = new THREE.Mesh(pierGeo, pierMat);
      pier.position.set(0, -8.0, z);
      this.environmentGroup.add(pier);
    }

    // 3. Dense 3D Trees and Forest Canopy Flanking the Elevated Highway (image_f1cb117e.png)
    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x3d2714,
      roughness: 0.9,
      metalness: 0.05,
    });
    const foliageColors = [0x1e4a27, 0x286333, 0x347d40, 0x173e21, 0x20552b];
    const foliageMats = foliageColors.map((c) =>
      new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.82,
        metalness: 0.04,
      })
    );

    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 6);
    const treeCount = 68;

    for (let i = 0; i < treeCount; i++) {
      const isLeft = i % 2 === 0;
      const xDist = (ROAD_WIDTH * 0.5 + 4) + Math.random() * 58;
      const x = isLeft ? -xDist : xDist;
      const z = -10 - Math.random() * 300;

      // Calculate approximate ground height
      const hillH = Math.sin(x * 0.022 + 0.8) * Math.cos(z * 0.016) * 9.5;
      const groundY = Math.max(-4.5, hillH * 0.8 - 0.5);

      const treeGroup = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.6;
      treeGroup.add(trunk);

      // Layered conical & spherical foliage
      const folMat = foliageMats[i % foliageMats.length];
      const folScale = 0.8 + Math.random() * 0.5;

      const fol1Geo = new THREE.ConeGeometry(2.0 * folScale, 3.2 * folScale, 7);
      const fol1 = new THREE.Mesh(fol1Geo, folMat);
      fol1.position.y = 3.6 * folScale;
      fol1.castShadow = true;
      treeGroup.add(fol1);

      const fol2Geo = new THREE.ConeGeometry(1.5 * folScale, 2.6 * folScale, 7);
      const fol2 = new THREE.Mesh(fol2Geo, folMat);
      fol2.position.y = 5.0 * folScale;
      treeGroup.add(fol2);

      treeGroup.position.set(x, groundY, z);
      this.environmentGroup.add(treeGroup);

      this.scrollingScenery.push({
        object: treeGroup,
        speedRatio: 1.0,
        minZ: -315,
        maxZ: 25,
      });
    }

    // 4. Photoreal Modern Metropolis Skyline Rising Above the Green Hills
    const towerMat = new THREE.MeshStandardMaterial({
      color: 0x0c1b30,
      map: this.cityWindowTexture,
      roughness: 0.22,
      metalness: 0.80,
      envMapIntensity: 1.25,
    });
    const glassTowerMat = new THREE.MeshPhysicalMaterial({
      color: 0x1d3557,
      metalness: 0.90,
      roughness: 0.12,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 0.95,
      envMapIntensity: 1.4,
    });
    const towerAccentMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.35,
      metalness: 0.65,
    });
    const crownGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
    });

    const towerCount = 48;
    for (let i = 0; i < towerCount; i++) {
      const isLeft = i % 2 === 0;
      const xDist = (ROAD_WIDTH * 0.5 + 24) + Math.random() * 110;
      const x = isLeft ? -xDist : xDist;
      const z = -35 - Math.random() * 320;
      const width = 14 + Math.random() * 22;
      const depth = 14 + Math.random() * 22;
      const height = 45 + Math.random() * 115;

      const towerGroup = new THREE.Group();

      if (i % 3 === 0) {
        // Cylindrical curved glass skyscraper
        const cylRadius = width * 0.48;
        const cylGeo = new THREE.CylinderGeometry(cylRadius, cylRadius, height, 18);
        const cylTower = new THREE.Mesh(cylGeo, glassTowerMat);
        cylTower.position.y = height * 0.5;
        towerGroup.add(cylTower);

        // Angled architectural crown
        const crownGeo = new THREE.CylinderGeometry(cylRadius * 0.8, cylRadius, 6, 18);
        const crown = new THREE.Mesh(crownGeo, towerAccentMat);
        crown.position.y = height + 3;
        towerGroup.add(crown);
      } else {
        // Rectangular faceted tower with window grids
        const towerGeo = new THREE.BoxGeometry(width, height, depth);
        const tower = new THREE.Mesh(towerGeo, towerMat);
        tower.position.y = height * 0.5;
        towerGroup.add(tower);

        // Stepped crown
        const crownH = 4.0 + Math.random() * 6;
        const crownGeo = new THREE.BoxGeometry(width * 0.72, crownH, depth * 0.72);
        const crown = new THREE.Mesh(crownGeo, towerAccentMat);
        crown.position.y = height + crownH * 0.5;
        towerGroup.add(crown);

        // Glowing crown accent band
        const bandGeo = new THREE.BoxGeometry(width * 0.74, 0.4, depth * 0.74);
        const band = new THREE.Mesh(bandGeo, crownGlowMat);
        band.position.y = height + crownH;
        towerGroup.add(band);

        // Spire antenna
        const spireH = 10 + Math.random() * 18;
        const spireGeo = new THREE.CylinderGeometry(0.12, 0.35, spireH, 6);
        const spire = new THREE.Mesh(spireGeo, towerAccentMat);
        spire.position.y = height + crownH + spireH * 0.5;
        towerGroup.add(spire);
      }

      towerGroup.position.set(x, -5, z);
      this.environmentGroup.add(towerGroup);

      this.scrollingScenery.push({
        object: towerGroup,
        speedRatio: 0.10,
        minZ: -360,
        maxZ: -40,
      });
    }

    // 5. High-Altitude Futuristic Aerocars between Skyscraper Corridors
    const aerocars: { group: THREE.Group; speed: number; laneY: number; minZ: number; maxZ: number }[] = [];
    const carMat1 = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.2 });
    const carMat2 = new THREE.MeshStandardMaterial({ color: 0x38bdf8, metalness: 0.85, roughness: 0.2 });
    const glowTrailMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.8 });

    for (let i = 0; i < 7; i++) {
      const carGroup = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 3.8), i % 2 === 0 ? carMat1 : carMat2);
      carGroup.add(body);

      const trail = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 2.2), glowTrailMat);
      trail.position.set(0, 0, 2.6);
      carGroup.add(trail);

      const isRight = i % 2 === 0;
      const laneX = (isRight ? 1 : -1) * (32 + Math.random() * 45);
      const laneY = 22 + Math.random() * 18;
      const startZ = -40 - Math.random() * 260;
      const speed = 28 + Math.random() * 26;

      carGroup.position.set(laneX, laneY, startZ);
      this.environmentGroup.add(carGroup);

      aerocars.push({
        group: carGroup,
        speed,
        laneY,
        minZ: -320,
        maxZ: 40,
      });
    }

    this.animatedScenery.push((dt, time) => {
      aerocars.forEach((ac, idx) => {
        ac.group.position.z += dt * ac.speed;
        if (ac.group.position.z > ac.maxZ) {
          ac.group.position.z = ac.minZ;
        }
        ac.group.position.y = ac.laneY + Math.sin(time * 2.0 + idx) * 0.35;
      });
    });
  }

  /**
   * MOON — LUNAR FRONTIER (Directly matching image_6211f798.png)
   * High-density authentic crater field with circular bowl depressions and raised rims,
   * rolling lunar regolith, natural basalt boulders, continuous distant lunar mountain massifs,
   * and a photorealistic Earth in the starry black sky.
   */
  private buildMoonEnvironment() {
    if (!this.lunarRegolithTexture) {
      this.lunarRegolithTexture = this.createLunarRegolithTexture();
    }

    // 1. Crisp Starfield in Space Vacuum
    const starCount = 780;
    const starGeo = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 650;
      positions[i * 3 + 1] = 12 + Math.random() * 220;
      positions[i * 3 + 2] = -40 - Math.random() * 380;
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 1.3,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.95,
    });
    this.environmentGroup.add(new THREE.Points(starGeo, starMat));

    // 2. Photoreal Earth in Deep Space Sky (Crescent-lit Earth with Blue Corona)
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
    this.earthMesh.position.set(-82, 76, -260);
    this.earthMesh.rotation.z = 0.41; // 23.5° axial tilt
    this.earthMesh.rotation.y = 1.8;
    this.environmentGroup.add(this.earthMesh);

    // Atmospheric Blue Corona around Earth
    const glowGeo = new THREE.SphereGeometry(27.6, 32, 24);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.35,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const earthGlow = new THREE.Mesh(glowGeo, glowMat);
    earthGlow.position.copy(this.earthMesh.position);
    this.environmentGroup.add(earthGlow);

    this.animatedScenery.push((dt) => {
      if (this.earthMesh) {
        this.earthMesh.rotation.y += dt * 0.02;
      }
    });

    // 3. High-Density Procedural Lunar Crater Field (Directly matching image_6211f798.png)
    // The surface is sculpted with true circular/elliptical crater depressions and raised rims!
    const terrainGeo = new THREE.PlaneGeometry(380, ROAD_LENGTH * 1.5, 120, 90);
    terrainGeo.rotateX(-Math.PI * 0.5);
    const pos = terrainGeo.attributes.position;

    // 36 distinct craters: (cx, cz, radius, depth)
    const craters: { cx: number; cz: number; r: number; d: number }[] = [
      // Near roadside craters
      { cx: -24, cz: -35, r: 16, d: 7.5 },
      { cx:  28, cz: -55, r: 20, d: 9.0 },
      { cx: -32, cz: -80, r: 24, d: 11.0 },
      { cx:  25, cz: -110, r: 18, d: 8.5 },
      { cx: -26, cz: -145, r: 22, d: 10.0 },
      { cx:  30, cz: -175, r: 26, d: 12.0 },
      { cx: -28, cz: -210, r: 20, d: 9.5 },
      { cx:  26, cz: -240, r: 18, d: 8.0 },
      { cx: -25, cz: -275, r: 22, d: 10.0 },
      // Midground & large craters
      { cx: -58, cz: -45, r: 35, d: 16.0 },
      { cx:  65, cz: -90, r: 42, d: 19.0 },
      { cx: -70, cz: -130, r: 48, d: 21.0 },
      { cx:  62, cz: -160, r: 38, d: 17.0 },
      { cx: -64, cz: -200, r: 44, d: 20.0 },
      { cx:  72, cz: -230, r: 50, d: 22.0 },
      { cx: -55, cz: -265, r: 36, d: 16.0 },
      { cx:  58, cz: -290, r: 34, d: 15.0 },
      // Foreground small craters
      { cx: -18, cz: -20, r: 9, d: 4.2 },
      { cx:  19, cz: -40, r: 10, d: 4.8 },
      { cx: -20, cz: -95, r: 11, d: 5.2 },
      { cx:  21, cz: -130, r: 8, d: 3.8 },
      { cx: -19, cz: -165, r: 9, d: 4.5 },
      { cx:  20, cz: -195, r: 10, d: 4.8 },
      { cx: -21, cz: -235, r: 8, d: 4.0 },
      { cx:  19, cz: -260, r: 9, d: 4.5 },
      // Additional flanking craters
      { cx: -110, cz: -70, r: 55, d: 24.0 },
      { cx:  115, cz: -120, r: 58, d: 26.0 },
      { cx: -105, cz: -180, r: 50, d: 22.0 },
      { cx:  110, cz: -240, r: 52, d: 23.0 },
      { cx: -90, cz: -280, r: 46, d: 20.0 },
    ];

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);

      // Keep road corridor flat and driveable
      const roadDist = Math.max(0, Math.abs(x) - (ROAD_WIDTH * 0.5 + 2.0));
      const corridorBlend = Math.min(roadDist / 14, 1.0);

      // Broad rolling lunar swell
      const swell = Math.sin(x * 0.016 + 1.2) * Math.cos(z * 0.014) * 5.5;

      // Displace by all craters
      let craterDisp = 0;
      for (let c = 0; c < craters.length; c++) {
        const cr = craters[c];
        const dist = Math.hypot(x - cr.cx, z - cr.cz);
        if (dist < cr.r) {
          // Inner bowl depression
          const ratio = dist / cr.r;
          craterDisp -= cr.d * Math.cos(ratio * Math.PI * 0.5) * (1.0 - ratio * 0.2);
        } else if (dist < cr.r * 1.4) {
          // Raised ejecta rim lip
          const rimRatio = (dist - cr.r) / (cr.r * 0.4);
          craterDisp += (cr.d * 0.24) * Math.sin(rimRatio * Math.PI);
        }
      }

      pos.setY(i, (swell + craterDisp) * corridorBlend - 0.05);
    }
    terrainGeo.computeVertexNormals();

    const lunarTerrainMat = new THREE.MeshStandardMaterial({
      color: 0x9ba4b0,
      map: this.lunarRegolithTexture,
      roughness: 0.94,
      metalness: 0.06,
    });
    const terrainMesh = new THREE.Mesh(terrainGeo, lunarTerrainMat);
    terrainMesh.position.set(0, 0, -ROAD_LENGTH * 0.4);
    terrainMesh.receiveShadow = true;
    this.environmentGroup.add(terrainMesh);

    // 4. Distant Lunar Mountain Massifs (Undulating displaced geometry, NO cones!)
    const massifGeo = new THREE.PlaneGeometry(550, 75, 70, 24);
    const mPos = massifGeo.attributes.position;
    for (let i = 0; i < mPos.count; i++) {
      const u = (mPos.getX(i) + 275) / 550;
      const v = (mPos.getY(i) + 37.5) / 75;
      const ridge = Math.sin(u * Math.PI * 6.0) * 16 + Math.cos(u * Math.PI * 14.0) * 8;
      const height = Math.max(0, ridge * v * 1.4);
      mPos.setZ(i, (Math.sin(u * 12.0) - 0.5) * 15);
      mPos.setY(i, mPos.getY(i) + height);
    }
    massifGeo.computeVertexNormals();

    const massifMat = new THREE.MeshStandardMaterial({
      color: 0x181c24,
      roughness: 0.96,
      metalness: 0.04,
    });
    const massifMesh = new THREE.Mesh(massifGeo, massifMat);
    massifMesh.position.set(0, 24, -340);
    this.environmentGroup.add(massifMesh);

    this.scrollingScenery.push({
      object: massifMesh,
      speedRatio: 0.03,
      minZ: -380,
      maxZ: -100,
    });

    // 5. Roadside Basalt Impact Boulders (Clusters near crater rims)
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x3d4552,
      roughness: 0.92,
      metalness: 0.08,
    });

    for (let i = 0; i < 38; i++) {
      const isLeft = i % 2 === 0;
      const xDist = (ROAD_WIDTH * 0.5 + 4) + Math.random() * 60;
      const x = isLeft ? -xDist : xDist;
      const z = -15 - Math.random() * 295;
      const radius = 1.2 + Math.random() * 3.6;

      const rockGeo = new THREE.DodecahedronGeometry(radius, 0);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.scale.set(1.0 + Math.random() * 0.4, 0.65 + Math.random() * 0.4, 1.0 + Math.random() * 0.4);
      rock.position.set(x, radius * 0.32, z);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      this.environmentGroup.add(rock);

      this.scrollingScenery.push({
        object: rock,
        speedRatio: 1.0,
        minZ: -310,
        maxZ: 25,
      });
    }

    // 6. Lunar Research Station Base
    const habMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.28,
    });
    const outpostGroup = new THREE.Group();
    const domeGeo = new THREE.SphereGeometry(12, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const dome = new THREE.Mesh(domeGeo, habMat);
    outpostGroup.add(dome);

    outpostGroup.position.set(-45, 2.0, -140);
    this.environmentGroup.add(outpostGroup);

    this.scrollingScenery.push({
      object: outpostGroup,
      speedRatio: 0.30,
      minZ: -340,
      maxZ: 40,
    });
  }

  /**
   * MARS — RED FRONTIER (Directly matching image_7f8c85cf.png)
   * Elevated superhighway viaduct spanning an immense red rock canyon / rift valley.
   * Features stratified sedimentary canyon cliff walls with horizontal geological strata,
   * talus slopes, concrete bridge support piers, overhead arch gantries, and warm dusty twilight.
   */
  private buildMarsEnvironment() {
    if (!this.marsStrataTexture) {
      this.marsStrataTexture = this.createMarsStrataTexture();
    }

    // 1. Martian Twilight Sky, Pale Sun & Phobos
    const sunGeo = new THREE.SphereGeometry(8, 20, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffedd5 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(55, 52, -265);
    this.environmentGroup.add(sun);

    const coronaGeo = new THREE.RingGeometry(8, 22, 24);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xffa45c,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const corona = new THREE.Mesh(coronaGeo, coronaMat);
    corona.position.copy(sun.position);
    this.environmentGroup.add(corona);

    // Phobos moonlet
    const phobosGeo = new THREE.DodecahedronGeometry(3.8, 1);
    const phobosMat = new THREE.MeshStandardMaterial({
      color: 0x786458,
      roughness: 0.9,
      metalness: 0.1,
    });
    const phobos = new THREE.Mesh(phobosGeo, phobosMat);
    phobos.position.set(-65, 78, -235);
    phobos.scale.set(1.3, 0.85, 1.05);
    this.environmentGroup.add(phobos);

    this.animatedScenery.push((dt) => {
      phobos.rotation.x += dt * 0.04;
      phobos.rotation.y += dt * 0.06;
    });

    // 2. Canyon Floor Beneath the Viaduct (Deep canyon rift at Y = -22)
    const canyonFloorGeo = new THREE.PlaneGeometry(380, ROAD_LENGTH * 1.5, 1, 1);
    canyonFloorGeo.rotateX(-Math.PI * 0.5);
    const canyonFloorMat = new THREE.MeshStandardMaterial({
      color: 0x3d170e,
      roughness: 0.94,
      metalness: 0.08,
    });
    const canyonFloor = new THREE.Mesh(canyonFloorGeo, canyonFloorMat);
    canyonFloor.position.set(0, -22, -ROAD_LENGTH * 0.4);
    canyonFloor.receiveShadow = true;
    this.environmentGroup.add(canyonFloor);

    // 3. Viaduct Structural Concrete Piers
    const pierGeo = new THREE.BoxGeometry(2.4, 23, 2.8);
    const pierMat = new THREE.MeshStandardMaterial({
      color: 0x2e1814,
      metalness: 0.70,
      roughness: 0.42,
    });
    for (let z = -ROAD_LENGTH * 0.85; z <= 20; z += 38) {
      const pier = new THREE.Mesh(pierGeo, pierMat);
      pier.position.set(0, -11, z);
      this.environmentGroup.add(pier);
    }

    // 4. Towering Stratified Sedimentary Canyon Cliff Formations (image_7f8c85cf.png)
    // Horizontal rock strata texture applied with stepped geological ledges
    const cliffMat = new THREE.MeshStandardMaterial({
      color: 0xba5a34,
      map: this.marsStrataTexture,
      roughness: 0.88,
      metalness: 0.10,
    });

    const canyonConfigs = [
      { x: -44, z: -35, width: 28, height: 38, depth: 36 },
      { x:  48, z: -65, width: 32, height: 42, depth: 40 },
      { x: -52, z: -105, width: 36, height: 46, depth: 42 },
      { x:  50, z: -140, width: 30, height: 38, depth: 38 },
      { x: -46, z: -175, width: 34, height: 44, depth: 40 },
      { x:  54, z: -210, width: 38, height: 48, depth: 44 },
      { x: -56, z: -250, width: 40, height: 52, depth: 46 },
      { x:  46, z: -285, width: 30, height: 38, depth: 38 },
    ];

    canyonConfigs.forEach((m) => {
      const cliffGroup = new THREE.Group();

      // Lower stepped tier (talus base)
      const btmGeo = new THREE.BoxGeometry(m.width * 1.3, m.height * 0.4, m.depth * 1.3);
      const btmMesh = new THREE.Mesh(btmGeo, cliffMat);
      btmMesh.position.y = m.height * 0.2 - 20;
      btmMesh.castShadow = true;
      cliffGroup.add(btmMesh);

      // Main stratified cliff wall
      const mainGeo = new THREE.BoxGeometry(m.width, m.height * 0.7, m.depth);
      const mainMesh = new THREE.Mesh(mainGeo, cliffMat);
      mainMesh.position.y = m.height * 0.55 - 20;
      mainMesh.castShadow = true;
      cliffGroup.add(mainMesh);

      // Upper bluff ledge
      const topGeo = new THREE.BoxGeometry(m.width * 0.75, m.height * 0.35, m.depth * 0.75);
      const topMesh = new THREE.Mesh(topGeo, cliffMat);
      topMesh.position.y = m.height * 0.95 - 20;
      topMesh.castShadow = true;
      cliffGroup.add(topMesh);

      cliffGroup.position.set(m.x, 0, m.z);
      this.environmentGroup.add(cliffGroup);

      this.scrollingScenery.push({
        object: cliffGroup,
        speedRatio: 0.35,
        minZ: -340,
        maxZ: 30,
      });
    });

    // 5. Overhead Technical Arch Gantries Spanning the Viaduct
    const gantryMat = new THREE.MeshStandardMaterial({
      color: 0x3d2019,
      metalness: 0.85,
      roughness: 0.35,
    });
    for (let gz = -240; gz <= 20; gz += 60) {
      const gantryGroup = new THREE.Group();
      const beamGeo = new THREE.BoxGeometry(ROAD_WIDTH + 1.8, 0.16, 0.16);
      const beam = new THREE.Mesh(beamGeo, gantryMat);
      beam.position.y = 4.2;
      gantryGroup.add(beam);

      const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.2, 6);
      const lp = new THREE.Mesh(postGeo, gantryMat);
      lp.position.set(-ROAD_WIDTH * 0.5 - 0.8, 2.1, 0);
      gantryGroup.add(lp);

      const rp = new THREE.Mesh(postGeo, gantryMat);
      rp.position.set(ROAD_WIDTH * 0.5 + 0.8, 2.1, 0);
      gantryGroup.add(rp);

      gantryGroup.position.z = gz;
      this.environmentGroup.add(gantryGroup);

      this.scrollingScenery.push({
        object: gantryGroup,
        speedRatio: 1.0,
        minZ: -310,
        maxZ: 25,
      });
    }

    // 6. Fallen Basalt Scree & Canyon Debris Rocks
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x2e140d,
      roughness: 0.92,
      metalness: 0.08,
    });

    for (let i = 0; i < 42; i++) {
      const isLeft = i % 2 === 0;
      const xDist = (ROAD_WIDTH * 0.5 + 3.5) + Math.random() * 55;
      const x = isLeft ? -xDist : xDist;
      const z = -15 - Math.random() * 295;
      const radius = 1.2 + Math.random() * 3.4;

      const rockGeo = new THREE.DodecahedronGeometry(radius, 0);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.scale.set(1.0 + Math.random() * 0.4, 0.65 + Math.random() * 0.4, 1.0 + Math.random() * 0.4);
      rock.position.set(x, radius * 0.32, z);
      rock.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      rock.castShadow = true;
      this.environmentGroup.add(rock);

      this.scrollingScenery.push({
        object: rock,
        speedRatio: 1.0,
        minZ: -310,
        maxZ: 25,
      });
    }

    // 7. Distant Layered Horizon Ridge Formations (Smooth sinusoidal mesh, NO cones!)
    const distantRidgeGeo = new THREE.PlaneGeometry(550, 80, 60, 20);
    const rPos = distantRidgeGeo.attributes.position;
    for (let i = 0; i < rPos.count; i++) {
      const u = (rPos.getX(i) + 275) / 550;
      const v = (rPos.getY(i) + 40) / 80;
      const mesa = Math.sin(u * Math.PI * 5.0) * 18 + Math.cos(u * Math.PI * 11.0) * 8;
      const height = Math.max(0, mesa * v * 1.5);
      rPos.setZ(i, (Math.sin(u * 10.0) - 0.5) * 12);
      rPos.setY(i, rPos.getY(i) + height);
    }
    distantRidgeGeo.computeVertexNormals();

    const distantRidgeMat = new THREE.MeshStandardMaterial({
      color: 0x240d07,
      roughness: 0.95,
      metalness: 0.05,
    });
    const distantRidgeMesh = new THREE.Mesh(distantRidgeGeo, distantRidgeMat);
    distantRidgeMesh.position.set(0, 20, -340);
    this.environmentGroup.add(distantRidgeMesh);

    this.scrollingScenery.push({
      object: distantRidgeMesh,
      speedRatio: 0.04,
      minZ: -380,
      maxZ: -90,
    });

    // 8. Drifting Atmospheric Dust Gusts
    const dustCount = 55;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * 80;
      dustPos[i * 3 + 1] = 0.5 + Math.random() * 8.0;
      dustPos[i * 3 + 2] = -10 - Math.random() * 260;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dustParticleMat = new THREE.PointsMaterial({
      color: 0xdd6b20,
      size: 0.8,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
    });
    const dustCloud = new THREE.Points(dustGeo, dustParticleMat);
    this.environmentGroup.add(dustCloud);

    this.animatedScenery.push((dt) => {
      const posAttr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
      const arr = posAttr.array as Float32Array;
      for (let i = 0; i < dustCount; i++) {
        arr[i * 3] -= dt * 6.5;
        arr[i * 3 + 2] += dt * 18.0;
        if (arr[i * 3] < -45) arr[i * 3] += 90;
        if (arr[i * 3 + 2] > 20) arr[i * 3 + 2] -= 270;
      }
      posAttr.needsUpdate = true;
    });
  }

  /**
   * Procedural texture generator for Martian horizontal sedimentary rock strata
   */
  private createMarsStrataTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // Sedimentary horizontal bands of terracotta, ochre, rust, and basalt
    const strataColors = [
      '#7c2d12', '#9a3412', '#c2410c', '#ea580c', '#431407',
      '#78350f', '#92400e', '#b45309', '#d97706', '#54200d'
    ];

    let y = 0;
    while (y < 256) {
      const bandHeight = 4 + Math.floor(Math.random() * 18);
      const color = strataColors[Math.floor(Math.random() * strataColors.length)];
      ctx.fillStyle = color;
      ctx.fillRect(0, y, 256, bandHeight);
      y += bandHeight;
    }

    // Micro-rock grain and horizontal striations
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.14)';
      const gx = Math.random() * 256;
      const gy = Math.random() * 256;
      ctx.fillRect(gx, gy, 8 + Math.random() * 24, 1);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 4);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Procedural texture generator for Lunar regolith
   */
  private createLunarRegolithTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    ctx.fillStyle = '#8f98a5';
    ctx.fillRect(0, 0, 256, 256);

    // Micro-craters and fine dust noise
    for (let i = 0; i < 300; i++) {
      const cx = Math.random() * 256;
      const cy = Math.random() * 256;
      const r = 1.5 + Math.random() * 5.0;

      // Crater shadow pit
      ctx.fillStyle = 'rgba(20, 24, 30, 0.45)';
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Bright ejecta rim
      ctx.strokeStyle = 'rgba(220, 228, 240, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx - 0.5, cy - 0.5, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(8, 8);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  /**
   * Procedural texture generator for glowing skyscraper window grid
   */
  private createCityWindowTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return new THREE.CanvasTexture(canvas);
    }

    // Dark architectural facade
    ctx.fillStyle = '#080d1a';
    ctx.fillRect(0, 0, 256, 256);

    // Matrix of illuminated office windows
    const rows = 32;
    const cols = 32;
    const w = 4;
    const h = 5;
    const gapX = 4;
    const gapY = 3;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rand = Math.sin(r * 12.9898 + c * 78.233) * 43758.5453;
        const val = rand - Math.floor(rand);
        if (val > 0.48) {
          if (val > 0.88) {
            ctx.fillStyle = '#38bdf8'; // Electric cyan LED
          } else if (val > 0.70) {
            ctx.fillStyle = '#fef08a'; // Warm office light
          } else {
            ctx.fillStyle = '#e2e8f0'; // Crisp white
          }
          ctx.fillRect(c * (w + gapX) + 2, r * (h + gapY) + 2, w, h);
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 6);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
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

    // 1. Update Player Vehicle Kinematics, Suspension & Physical Flight
    const targetCarX = player.x * LANE_WIDTH;
    const isAirborne = player.altitude > 0.04;

    // Physical Altitude Lift
    const targetCarY = player.altitude * FLIGHT_ALTITUDE_HEIGHT;

    // Touchdown landing detection for suspension compression bounce
    if (this.prevAirborne && !isAirborne) {
      this.landingBounce = 0.32; // Trigger suspension compression on touchdown
    }
    this.prevAirborne = isAirborne;

    // Suspension dynamics
    if (this.landingBounce > 0) {
      this.landingBounce = Math.max(0, this.landingBounce - dt * 2.8);
      const progress = 1 - this.landingBounce / 0.32;
      this.currentSuspensionY = -0.055 * Math.sin(progress * Math.PI) * (1 - progress);
    } else if (!isAirborne) {
      // High-speed road surface micro-vibration
      const speedNorm = Math.min(player.speed / 180, 1.0);
      this.currentSuspensionY = Math.sin(this.time * 38) * 0.003 * speedNorm;
    } else {
      // Smooth organic floating drift in flight
      this.currentSuspensionY = Math.sin(this.time * 2.2) * 0.038;
    }

    this.carGroup.position.x = targetCarX;
    this.carGroup.position.y = targetCarY + this.currentSuspensionY;
    this.carGroup.position.z = 0;

    // Natural banking during lane changes (smooth roll + subtle yaw steering lead)
    const vDef = VEHICLE_DEFINITIONS[this.currentVehicleId];
    const bankMultiplier = vDef ? vDef.bankFactor : 1.0;
    const targetRoll = -player.bankAngle * 0.16 * bankMultiplier;
    const targetYaw = player.bankAngle * 0.045 * (this.currentVehicleId === 'NEON_CYCLE' ? 1.6 : 1.0);
    this.smoothRoll = THREE.MathUtils.damp(this.smoothRoll, targetRoll, 10, dt);
    this.smoothYaw = THREE.MathUtils.damp(this.smoothYaw, targetYaw, 8, dt);
    this.carGroup.rotation.z = this.smoothRoll;
    this.carGroup.rotation.y = this.smoothYaw;

    // Aerodynamic Pitch: slight nose pitch-up when taking off / flying + organic micro-pitch
    const flightPitch = isAirborne ? (-0.05 + Math.sin(this.time * 1.8) * 0.012) : 0;
    this.carGroup.rotation.x = THREE.MathUtils.damp(this.carGroup.rotation.x, flightPitch, 8, dt);

    // Call the vehicle's independent update controller (wheels, dynamic thrusters, light trail)
    this.currentVehicle.update(
      dt,
      player.speed,
      isAirborne,
      player.altitude,
      player.flightEnergy,
      player.bankAngle
    );

    // Emit thruster smoke & sparks when airborne (originating at vehicle thruster nozzles)
    if (dt > 0 && isAirborne && Math.random() > 0.35 && this.currentVehicle.thrusterPositions.length > 0) {
      const tPositions = this.currentVehicle.thrusterPositions;
      const noz = tPositions[Math.floor(Math.random() * tPositions.length)];
      const worldNozX = targetCarX + noz.x;
      const worldNozY = targetCarY + (noz.y || 0.2);
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
    if (dt > 0 && !isAirborne && (this.currentWorld === 'MOON' || this.currentWorld === 'MARS') && player.speed > 130 && Math.random() > 0.65) {
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

    // Invulnerability blink effect on vehicle
    if (player.invulnerableTimer > 0) {
      const blink = Math.floor(this.time * 24) % 2 === 0;
      this.carGroup.visible = blink;
    } else {
      this.carGroup.visible = true;
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

    // 3. Update Road Scrolling & Scenery Parallax
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

    // Parallax Scenery Scrolling (smoothly wraps objects in world coordinate space)
    if (!isMenu && roadSpeed > 0) {
      for (let i = 0; i < this.scrollingScenery.length; i++) {
        const item = this.scrollingScenery[i];
        item.object.position.z += roadSpeed * item.speedRatio * dt;
        if (item.object.position.z > item.maxZ) {
          item.object.position.z -= (item.maxZ - item.minZ);
        }
      }
    }

    // Dynamic Environmental Animations (runs in both menu preview and gameplay)
    for (let i = 0; i < this.animatedScenery.length; i++) {
      this.animatedScenery[i](dt, this.time);
    }

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
    this.scrollingScenery = [];
    this.animatedScenery = [];

    if (this.cityWindowTexture) {
      this.cityWindowTexture.dispose();
      this.cityWindowTexture = null;
    }

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

    if (this.currentVehicle) {
      this.currentVehicle.dispose();
    }

    // Dispose shared assets
    Object.values(this.sharedGeos).forEach((g) => g.dispose());
    Object.values(this.sharedMats).forEach((m) => m.dispose());
  }
}
