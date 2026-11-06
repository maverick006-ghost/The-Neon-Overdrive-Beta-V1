/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ArrowLeft, RotateCw, Eye, Grid } from 'lucide-react';
import { VehicleId, VEHICLE_CONFIGS } from '../game/types';
import { createVehicleModel } from '../game/vehicles/vehicleRegistry';
import { VehicleModelInstance } from '../game/vehicles/vehicleTypes';

interface ModelInspectorProps {
  vehicleId: VehicleId;
  onSelectVehicle?: (v: VehicleId) => void;
  onClose: () => void;
}

type CameraPreset = 'FRONT' | 'REAR' | 'SIDE' | 'FRONT_3_4' | 'REAR_3_4';

export const ModelInspector: React.FC<ModelInspectorProps> = ({
  vehicleId,
  onSelectVehicle,
  onClose,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [activePreset, setActivePreset] = useState<CameraPreset>('FRONT_3_4');
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);

  // Three.js instances ref
  const stateRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    vehicleInstance: VehicleModelInstance;
    targetLook: THREE.Vector3;
    targetCamPos: THREE.Vector3;
    orbitAngle: number;
    orbitPitch: number;
    orbitDist: number;
    isDragging: boolean;
    prevMouse: { x: number; y: number };
  } | null>(null);

  // Preset Camera Positions (relative to center of vehicle at 0, 0.45, 0)
  const PRESET_COORDS: Record<CameraPreset, { x: number; y: number; z: number }> = {
    FRONT: { x: 0, y: 0.65, z: -5.2 },
    REAR: { x: 0, y: 0.75, z: 5.2 },
    SIDE: { x: -5.4, y: 0.65, z: 0 },
    FRONT_3_4: { x: -3.8, y: 1.45, z: -4.2 },
    REAR_3_4: { x: 3.8, y: 1.35, z: 4.2 },
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // 1. Scene & Dark Studio Backdrop
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060709);
    scene.fog = new THREE.FogExp2(0x060709, 0.02);

    // 2. Camera
    const aspect = window.innerWidth / window.innerHeight;
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    camera.position.set(-3.8, 1.45, -4.2);

    // 3. Renderer with ACES Tone Mapping
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // 4. Studio Environment Lighting (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTexture;
    pmremGenerator.dispose();

    // 5. Studio Key & Rim Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(6, 12, 8);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    scene.add(keyLight);

    const rimLight1 = new THREE.DirectionalLight(0xa5c4ea, 1.6);
    rimLight1.position.set(-8, 6, -10);
    scene.add(rimLight1);

    const rimLight2 = new THREE.DirectionalLight(0xffe4cc, 1.2);
    rimLight2.position.set(8, 4, -8);
    scene.add(rimLight2);

    // 6. Circular Studio Turntable Ground Platform
    const platformGeo = new THREE.CylinderGeometry(4.2, 4.5, 0.1, 48);
    const platformMat = new THREE.MeshStandardMaterial({
      color: 0x0c0e12,
      metalness: 0.85,
      roughness: 0.25,
    });
    const platformMesh = new THREE.Mesh(platformGeo, platformMat);
    platformMesh.position.set(0, -0.05, 0);
    platformMesh.receiveShadow = true;
    scene.add(platformMesh);

    // Subtle radial grid lines on platform
    const gridHelper = new THREE.GridHelper(8, 16, 0x334155, 0x1e293b);
    gridHelper.position.set(0, 0.005, 0);
    scene.add(gridHelper);

    // 7. Instantiate Isolated Vehicle Model
    const vehicleInstance = createVehicleModel(vehicleId);
    scene.add(vehicleInstance.rootGroup);
    scene.add(vehicleInstance.contactShadow);

    const targetLook = new THREE.Vector3(0, 0.45, 0);
    const targetCamPos = new THREE.Vector3(-3.8, 1.45, -4.2);

    const state = {
      scene,
      camera,
      renderer,
      vehicleInstance,
      targetLook,
      targetCamPos,
      orbitAngle: Math.atan2(-4.2, -3.8),
      orbitPitch: 0.25,
      orbitDist: 5.6,
      isDragging: false,
      prevMouse: { x: 0, y: 0 },
    };
    stateRef.current = state;

    // Animation loop
    let animId: number;
    let lastT = performance.now();

    const animate = (t: number) => {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((t - lastT) * 0.001, 0.1);
      lastT = t;

      if (autoRotate && !state.isDragging) {
        state.orbitAngle += dt * 0.35;
        state.targetCamPos.x = Math.cos(state.orbitAngle) * state.orbitDist;
        state.targetCamPos.z = Math.sin(state.orbitAngle) * state.orbitDist;
        state.targetCamPos.y = Math.max(0.3, state.targetCamPos.y);
      }

      // Smooth camera position damping
      camera.position.lerp(state.targetCamPos, dt * 6);
      camera.lookAt(state.targetLook);

      // Rotate vehicle wheels gently for studio turntable feel
      vehicleInstance.update(dt, 20, false, 0, 0, 0);

      renderer.render(scene, camera);
    };
    animId = requestAnimationFrame(animate);

    // Handle resize
    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      vehicleInstance.dispose();
      envTexture.dispose();
      renderer.dispose();
      stateRef.current = null;
    };
  }, [vehicleId]);

  // Handle Preset Button Clicks
  const setPreset = (preset: CameraPreset) => {
    setActivePreset(preset);
    setAutoRotate(false);
    const coords = PRESET_COORDS[preset];
    if (stateRef.current) {
      stateRef.current.targetCamPos.set(coords.x, coords.y, coords.z);
      stateRef.current.orbitAngle = Math.atan2(coords.z, coords.x);
      stateRef.current.orbitDist = Math.sqrt(coords.x * coords.x + coords.z * coords.z);
    }
  };

  // Toggle wireframe mode
  useEffect(() => {
    if (stateRef.current) {
      stateRef.current.vehicleInstance.rootGroup.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => {
              if ('wireframe' in m) {
                (m as THREE.MeshStandardMaterial).wireframe = wireframe;
              }
            });
          } else if (mesh.material && 'wireframe' in mesh.material) {
            (mesh.material as THREE.MeshStandardMaterial).wireframe = wireframe;
          }
        }
      });
    }
  }, [wireframe]);

  // Interactive mouse/touch orbit handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!stateRef.current) return;
    stateRef.current.isDragging = true;
    stateRef.current.prevMouse = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!stateRef.current || !stateRef.current.isDragging) return;
    const dx = e.clientX - stateRef.current.prevMouse.x;
    const dy = e.clientY - stateRef.current.prevMouse.y;
    stateRef.current.prevMouse = { x: e.clientX, y: e.clientY };

    setAutoRotate(false);
    stateRef.current.orbitAngle -= dx * 0.008;
    stateRef.current.targetCamPos.y = Math.max(
      0.2,
      Math.min(3.2, stateRef.current.targetCamPos.y + dy * 0.012)
    );
    stateRef.current.targetCamPos.x =
      Math.cos(stateRef.current.orbitAngle) * stateRef.current.orbitDist;
    stateRef.current.targetCamPos.z =
      Math.sin(stateRef.current.orbitAngle) * stateRef.current.orbitDist;
  };

  const handlePointerUp = () => {
    if (stateRef.current) {
      stateRef.current.isDragging = false;
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!stateRef.current) return;
    stateRef.current.orbitDist = Math.max(
      2.8,
      Math.min(9.5, stateRef.current.orbitDist + e.deltaY * 0.005)
    );
    stateRef.current.targetCamPos.x =
      Math.cos(stateRef.current.orbitAngle) * stateRef.current.orbitDist;
    stateRef.current.targetCamPos.z =
      Math.sin(stateRef.current.orbitAngle) * stateRef.current.orbitDist;
  };

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-40 bg-[#060709] select-none font-sans overflow-hidden"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <canvas ref={canvasRef} className="w-full h-full block cursor-grab active:cursor-grabbing" />

      {/* Top Bar: Quality Gate Header & Back Button */}
      <div className="absolute top-0 inset-x-0 p-4 sm:p-6 flex items-center justify-between pointer-events-none bg-gradient-to-b from-[#060709]/90 to-transparent">
        <div className="flex flex-wrap items-center gap-3 pointer-events-auto">
          <button
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-sm bg-[#12161f]/90 hover:bg-[#1a202c] border border-[#2a3444] text-xs font-mono tracking-wider text-[#f5f5f3] uppercase transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>EXIT INSPECTOR</span>
          </button>

          {/* Vehicle Switcher in Quality Gate */}
          {onSelectVehicle && (
            <div className="flex items-center gap-1 p-0.5 rounded-sm bg-[#0a0d13]/90 border border-[#1e2533]">
              {(['AERO_X', 'CYBER_GT', 'NEON_CYCLE'] as VehicleId[]).map((vid) => {
                const isCur = vehicleId === vid;
                const vcfg = VEHICLE_CONFIGS[vid];
                return (
                  <button
                    key={vid}
                    onClick={() => onSelectVehicle(vid)}
                    className={`px-2.5 py-1 rounded-sm text-[10px] font-mono tracking-wider uppercase transition-colors cursor-pointer ${
                      isCur
                        ? 'bg-[#1e2736] text-[#38bdf8] border border-[#38bdf8]/80 font-semibold'
                        : 'text-[#858585] hover:text-[#f5f5f3]'
                    }`}
                  >
                    {vcfg?.name || vid}
                  </button>
                );
              })}
            </div>
          )}

          <div className="hidden md:flex items-center gap-2">
            <span className="text-[#444444]">/</span>
            <span className="text-[10px] font-mono tracking-[0.2em] text-[#94a3b8] uppercase font-semibold">
              {VEHICLE_CONFIGS[vehicleId]?.badge || 'QUALITY GATE'}
            </span>
          </div>
        </div>

        {/* View Controls: Auto-Rotate & Wireframe */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono tracking-wider uppercase transition-colors cursor-pointer border ${
              autoRotate
                ? 'bg-[#38bdf8]/15 border-[#38bdf8] text-[#38bdf8]'
                : 'bg-[#12161f]/80 border-[#2a3444] text-[#858585] hover:text-[#f5f5f3]'
            }`}
          >
            <RotateCw className="w-3 h-3" />
            <span>TURNTABLE {autoRotate ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={() => setWireframe(!wireframe)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[10px] font-mono tracking-wider uppercase transition-colors cursor-pointer border ${
              wireframe
                ? 'bg-[#38bdf8]/15 border-[#38bdf8] text-[#38bdf8]'
                : 'bg-[#12161f]/80 border-[#2a3444] text-[#858585] hover:text-[#f5f5f3]'
            }`}
          >
            <Grid className="w-3 h-3" />
            <span>TOPOLOGY</span>
          </button>
        </div>
      </div>

      {/* Bottom Center: Presets Toolbar */}
      <div className="absolute bottom-6 inset-x-0 flex flex-col items-center gap-2 pointer-events-none px-4">
        <div className="text-[9px] font-mono tracking-[0.22em] text-[#666666] uppercase">
          CAMERA PRESET VIEWS (INSPECT ALL ANGLES)
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 rounded-sm bg-[#0a0d13]/90 border border-[#1f2736] backdrop-blur-md pointer-events-auto shadow-2xl">
          {(
            [
              { id: 'FRONT', label: 'FRONT' },
              { id: 'FRONT_3_4', label: 'FRONT 3/4' },
              { id: 'SIDE', label: 'SIDE PROFILE' },
              { id: 'REAR_3_4', label: 'REAR 3/4' },
              { id: 'REAR', label: 'REAR' },
            ] as const
          ).map((p) => {
            const isSelected = activePreset === p.id && !autoRotate;
            return (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={`px-3 py-1.5 rounded-sm text-[10px] font-mono tracking-[0.18em] uppercase transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-[#1e2736] text-[#38bdf8] border border-[#38bdf8] font-semibold shadow-md'
                    : 'text-[#858585] hover:text-[#f5f5f3] border border-transparent hover:border-[#2a3444]'
                }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <div className="text-[9px] font-mono tracking-wider text-[#555555] uppercase mt-1">
          DRAG TO FREE-ORBIT · SCROLL TO ZOOM · CLICK PRESET FOR STRICT PROJECTION
        </div>
      </div>
    </div>
  );
};
