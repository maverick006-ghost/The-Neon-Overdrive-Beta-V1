/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MODEL_URL = '/models/aero-x/tesla-roaster-multicolor.3mf';
const FOCUS_X = -0.55;

interface ModelStats {
  dimensions: THREE.Vector3;
  triangles: number;
  paintedTriangles: number;
  renderedTriangles: number;
  meshes: number;
  materials: number;
  distinctColors: number;
  colors: string[];
  loadMilliseconds: number;
  paintParsingMilliseconds: number;
}

interface PaintTreeRecord {
  triangleIndex: number;
  encoded: string;
}

interface PaintRecoveryData {
  triangleCount: number;
  paintedTriangles: number;
  statesByTriangle: Uint8Array;
  complexTrees: PaintTreeRecord[];
  leafCounts: number[];
  midpointCount: number;
  renderedTriangles: number;
  colors: string[];
  colorOpacities: number[];
  parsingMilliseconds: number;
}

type TriangleIndices = [number, number, number];
type PaintLeafVisitor = (state: number, triangle: TriangleIndices | null) => void;

function disposeModel(model: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();

  model.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return;
    const mesh = child as THREE.Mesh;
    geometries.add(mesh.geometry);

    const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    meshMaterials.forEach((material) => {
      materials.add(material);
      Object.values(material).forEach((value) => {
        if ((value as THREE.Texture)?.isTexture) textures.add(value as THREE.Texture);
      });
    });
  });

  geometries.forEach((geometry) => geometry.dispose());
  materials.forEach((material) => material.dispose());
  textures.forEach((texture) => texture.dispose());
}

function splitTriangle(
  triangle: TriangleIndices,
  splitSides: number,
  specialSide: number,
  addMidpoint: (a: number, b: number) => number
): TriangleIndices[] {
  if (specialSide < 0 || specialSide > 2) {
    throw new Error(`Unsupported 3MF paint side index ${specialSide}.`);
  }

  const vertices: TriangleIndices = [
    triangle[specialSide],
    triangle[(specialSide + 1) % 3],
    triangle[(specialSide + 2) % 3],
  ];

  if (splitSides === 1) {
    const midpoint = addMidpoint(vertices[2], vertices[1]);
    return [
      [vertices[0], vertices[1], midpoint],
      [midpoint, vertices[2], vertices[0]],
    ];
  }

  if (splitSides === 2) {
    const firstMidpoint = addMidpoint(vertices[0], vertices[1]);
    const secondMidpoint = addMidpoint(vertices[0], vertices[2]);
    return [
      [vertices[0], firstMidpoint, secondMidpoint],
      [firstMidpoint, vertices[1], secondMidpoint],
      [vertices[1], vertices[2], secondMidpoint],
    ];
  }

  if (splitSides === 3 && specialSide === 0) {
    const firstMidpoint = addMidpoint(vertices[0], vertices[1]);
    const secondMidpoint = addMidpoint(vertices[1], vertices[2]);
    const thirdMidpoint = addMidpoint(vertices[2], vertices[0]);
    return [
      [vertices[0], firstMidpoint, thirdMidpoint],
      [firstMidpoint, vertices[1], secondMidpoint],
      [secondMidpoint, vertices[2], thirdMidpoint],
      [firstMidpoint, secondMidpoint, thirdMidpoint],
    ];
  }

  throw new Error(`Unsupported 3MF paint subdivision (${splitSides}, ${specialSide}).`);
}

function visitPaintTree(
  encoded: string,
  rootTriangle: TriangleIndices | null,
  addMidpoint: (a: number, b: number) => number,
  onLeaf: PaintLeafVisitor
): { leafCount: number; midpointCount: number } {
  // Creality serializes a depth-first nibble stream in reverse order.
  let encodedIndex = encoded.length - 1;
  let leafCount = 0;
  let midpointCount = 0;

  const readState = (code: number): number => {
    if ((code & 0b1100) !== 0b1100) return code >> 2;

    if (encodedIndex < 0) throw new Error('A 3MF paint state is missing its extended value.');
    let value = Number.parseInt(encoded[encodedIndex--], 16);
    let extensionCount = 0;
    while (value === 0b1111) {
      extensionCount++;
      if (encodedIndex < 0) throw new Error('A 3MF paint state has a truncated extended value.');
      value = Number.parseInt(encoded[encodedIndex--], 16);
    }
    return value + 15 * extensionCount + 3;
  };

  const visit = (triangle: TriangleIndices | null, depth: number): void => {
    if (depth > 64 || encodedIndex < 0) {
      throw new Error('The 3MF paint subdivision tree is invalid or too deep.');
    }

    const code = Number.parseInt(encoded[encodedIndex--], 16);
    const splitSides = code & 0b11;
    if (splitSides === 0) {
      const state = readState(code);
      leafCount++;
      onLeaf(state, triangle);
      return;
    }

    const specialSide = code >> 2;
    const childCount = splitSides + 1;
    const children = triangle
      ? splitTriangle(triangle, splitSides, specialSide, (a, b) => {
        midpointCount++;
        return addMidpoint(a, b);
      })
      : null;

    if (splitSides === 3) midpointCount += triangle ? 0 : splitSides;
    else if (!triangle) midpointCount += splitSides;

    for (let childIndex = childCount - 1; childIndex >= 0; childIndex--) {
      visit(children ? children[childIndex] : null, depth + 1);
    }
  };

  visit(rootTriangle, 0);
  if (encodedIndex !== -1) throw new Error('A 3MF paint tag contains unused subdivision data.');
  return { leafCount, midpointCount };
}

function parsePaintArchive(
  archive: Uint8Array,
  unzipSync: (data: Uint8Array) => Record<string, Uint8Array>
): PaintRecoveryData {
  const parsingStartedAt = performance.now();
  const files = unzipSync(archive);
  const objectBytes = files['3D/Objects/object_1.model'];
  const projectSettingsBytes = files['Metadata/project_settings.config'];
  if (!objectBytes || !projectSettingsBytes) {
    throw new Error('The 3MF archive is missing its model geometry or filament palette.');
  }

  const projectSettings: unknown = JSON.parse(new TextDecoder().decode(projectSettingsBytes));
  if (
    !projectSettings ||
    typeof projectSettings !== 'object' ||
    !('filament_colour' in projectSettings) ||
    !Array.isArray(projectSettings.filament_colour)
  ) {
    throw new Error('The 3MF archive does not contain a readable filament palette.');
  }

  const colorMatches = projectSettings.filament_colour.map((value: unknown) => {
    if (typeof value !== 'string' || !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value)) {
      throw new Error('The 3MF archive contains an unsupported filament color value.');
    }
    return {
      hex: value.slice(0, 7),
      opacity: value.length === 9 ? Number.parseInt(value.slice(7), 16) / 255 : 1,
    };
  });
  const objectModel = new TextDecoder().decode(objectBytes);
  let triangleCount = 0;
  for (const _match of objectModel.matchAll(/<triangle\b/g)) triangleCount++;

  const statesByTriangle = new Uint8Array(triangleCount);
  const leafCounts = Array.from({ length: colorMatches.length + 1 }, () => 0);
  const complexTrees: PaintTreeRecord[] = [];
  let midpointCount = 0;
  let renderedTriangles = 0;
  let paintedTriangles = 0;
  let triangleIndex = 0;

  for (const match of objectModel.matchAll(/<triangle\b([^>]*)>/g)) {
    const paintMatch = /\bpaint_color="([^"]*)"/.exec(match[1]);
    if (!paintMatch) {
      leafCounts[0]++;
      renderedTriangles++;
      triangleIndex++;
      continue;
    }

    const encoded = paintMatch[1];
    if (!encoded || !/^[\da-f]+$/i.test(encoded)) {
      throw new Error(`Triangle ${triangleIndex} has an invalid paint_color value.`);
    }
    paintedTriangles++;

    let uniformState = 0;
    const tree = visitPaintTree(encoded, null, () => 0, (state) => {
      if (state > colorMatches.length) {
        throw new Error(`Triangle ${triangleIndex} references missing filament ${state}.`);
      }
      leafCounts[state]++;
      uniformState = state;
    });

    renderedTriangles += tree.leafCount;
    midpointCount += tree.midpointCount;
    if (tree.leafCount === 1) {
      statesByTriangle[triangleIndex] = uniformState;
    } else {
      complexTrees.push({ triangleIndex, encoded });
    }
    triangleIndex++;
  }

  if (triangleIndex !== triangleCount) {
    throw new Error('The 3MF triangle paint data could not be aligned with its geometry.');
  }

  return {
    triangleCount,
    paintedTriangles,
    statesByTriangle,
    complexTrees,
    leafCounts,
    midpointCount,
    renderedTriangles,
    colors: colorMatches.map((color) => color.hex),
    colorOpacities: colorMatches.map((color) => color.opacity),
    parsingMilliseconds: performance.now() - parsingStartedAt,
  };
}

function createPaintMaterial(source: THREE.Material, hex: string, opacity: number): THREE.Material {
  const material = source.clone();
  if (!('color' in material) || !(material.color instanceof THREE.Color)) {
    throw new Error('The 3MF loader material cannot display recovered filament colors.');
  }
  material.color.set(hex);
  if ('opacity' in material && typeof material.opacity === 'number') {
    material.opacity *= opacity;
    if (opacity < 1) material.transparent = true;
  }
  return material;
}

function applyPaintRecovery(model: THREE.Group, paint: PaintRecoveryData): number {
  const meshes: THREE.Mesh[] = [];
  model.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) meshes.push(child as THREE.Mesh);
  });
  if (meshes.length !== 1) {
    throw new Error(`Expected one source mesh for paint recovery, but found ${meshes.length}.`);
  }

  const mesh = meshes[0];
  const sourceGeometry = mesh.geometry;
  const sourcePosition = sourceGeometry.getAttribute('position');
  const sourceIndex = sourceGeometry.getIndex();
  if (!sourcePosition || sourcePosition.itemSize !== 3) {
    throw new Error('The Three.js loader returned unsupported 3MF vertex geometry.');
  }

  const sourceTriangleCount = sourceIndex
    ? sourceIndex.count / 3
    : sourcePosition.count / 3;
  if (!Number.isInteger(sourceTriangleCount) || sourceTriangleCount !== paint.triangleCount) {
    throw new Error(
      `Paint recovery found ${paint.triangleCount.toLocaleString()} source triangles, but the loader returned ${sourceTriangleCount.toLocaleString()}.`
    );
  }

  const defaultMaterial = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const originalMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const whiteIndex = paint.colors.findIndex((color) => color.toUpperCase() === '#FFFFFF');
  const defaultMaterialIndex = whiteIndex >= 0 ? whiteIndex : paint.colors.length;
  const materials = paint.colors.map((color, index) =>
    createPaintMaterial(
      defaultMaterial,
      color,
      paint.colorOpacities[index]
    )
  );
  if (whiteIndex < 0) materials.push(defaultMaterial.clone());

  const materialIndexForState = (state: number): number => {
    // Encoded physical filament IDs are 1-based; state 0 uses the default white.
    if (state === 0) return defaultMaterialIndex;
    return state - 1;
  };
  const materialTriangleCounts = Array.from({ length: materials.length }, () => 0);
  paint.leafCounts.forEach((count, state) => {
    materialTriangleCounts[materialIndexForState(state)] += count;
  });

  const materialStarts = new Uint32Array(materials.length);
  const writePositions = new Uint32Array(materials.length);
  let indexCount = 0;
  for (let materialIndex = 0; materialIndex < materials.length; materialIndex++) {
    materialStarts[materialIndex] = indexCount;
    writePositions[materialIndex] = indexCount;
    indexCount += materialTriangleCounts[materialIndex] * 3;
  }

  const positions = new Float32Array((sourcePosition.count + paint.midpointCount) * 3);
  for (let i = 0; i < sourcePosition.count; i++) {
    positions[i * 3] = sourcePosition.getX(i);
    positions[i * 3 + 1] = sourcePosition.getY(i);
    positions[i * 3 + 2] = sourcePosition.getZ(i);
  }
  const indices = new Uint32Array(indexCount);
  let nextVertex = sourcePosition.count;
  let complexTreeIndex = 0;

  const addMidpoint = (a: number, b: number): number => {
    const index = nextVertex++;
    positions[index * 3] = (positions[a * 3] + positions[b * 3]) * 0.5;
    positions[index * 3 + 1] = (positions[a * 3 + 1] + positions[b * 3 + 1]) * 0.5;
    positions[index * 3 + 2] = (positions[a * 3 + 2] + positions[b * 3 + 2]) * 0.5;
    return index;
  };
  const emitTriangle: PaintLeafVisitor = (state, triangle) => {
    if (!triangle) throw new Error('A decoded 3MF paint leaf is missing its geometry.');
    const materialIndex = materialIndexForState(state);
    let index = writePositions[materialIndex];
    indices[index++] = triangle[0];
    indices[index++] = triangle[1];
    indices[index++] = triangle[2];
    writePositions[materialIndex] = index;
  };

  for (let triangleIndex = 0; triangleIndex < paint.triangleCount; triangleIndex++) {
    const sourceIndexOffset = triangleIndex * 3;
    const triangle: TriangleIndices = sourceIndex
      ? [
        sourceIndex.getX(sourceIndexOffset),
        sourceIndex.getX(sourceIndexOffset + 1),
        sourceIndex.getX(sourceIndexOffset + 2),
      ]
      : [sourceIndexOffset, sourceIndexOffset + 1, sourceIndexOffset + 2];
    const complexTree = paint.complexTrees[complexTreeIndex];
    if (complexTree?.triangleIndex === triangleIndex) {
      visitPaintTree(complexTree.encoded, triangle, addMidpoint, emitTriangle);
      complexTreeIndex++;
    } else {
      emitTriangle(paint.statesByTriangle[triangleIndex], triangle);
    }
  }

  if (nextVertex !== sourcePosition.count + paint.midpointCount || complexTreeIndex !== paint.complexTrees.length) {
    throw new Error('The recovered paint subdivisions do not match the source geometry.');
  }
  materials.forEach((_material, materialIndex) => {
    if (writePositions[materialIndex] !== materialStarts[materialIndex] + materialTriangleCounts[materialIndex] * 3) {
      throw new Error('The recovered paint material groups have an inconsistent triangle count.');
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  materials.forEach((_material, materialIndex) => {
    const count = materialTriangleCounts[materialIndex] * 3;
    if (count > 0) geometry.addGroup(materialStarts[materialIndex], count, materialIndex);
  });

  mesh.geometry = geometry;
  mesh.material = materials;
  sourceGeometry.dispose();
  originalMaterials.forEach((material) => material.dispose());

  return paint.leafCounts.reduce(
    (count, leafCount, state) => count + (state > 0 && leafCount > 0 ? 1 : 0),
    0
  );
}

async function readArchiveResponse(
  response: Response,
  onProgress: (progress: number) => void
): Promise<ArrayBuffer> {
  const reader = response.body?.getReader();
  if (!reader) return response.arrayBuffer();

  const totalBytes = Number(response.headers.get('content-length'));
  const chunks: Uint8Array[] = [];
  let loadedBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    chunks.push(value);
    loadedBytes += value.byteLength;
    if (totalBytes > 0) onProgress(loadedBytes / totalBytes);
  }

  const archive = new Uint8Array(loadedBytes);
  let offset = 0;
  chunks.forEach((chunk) => {
    archive.set(chunk, offset);
    offset += chunk.byteLength;
  });
  return archive.buffer;
}

export function ThreeMFPrototype(): React.JSX.Element {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const fittedHeightRef = useRef(1);
  const [loadMessage, setLoadMessage] = useState('Loading 3MF model…');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stats, setStats] = useState<ModelStats | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [framesPerSecond, setFramesPerSecond] = useState<number | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const canvas = canvasRef.current;
    if (!viewport || !canvas) return;

    let disposed = false;
    let animationFrame = 0;
    let loadedModel: THREE.Group | null = null;
    const loadAbortController = new AbortController();
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080b12);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.01, 1000);
    camera.position.set(4.6, 2.8, 5.2);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    scene.add(new THREE.HemisphereLight(0xdce9ff, 0x242a34, 2));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3);
    keyLight.position.set(5, 8, 6);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0x9bbdff, 1.5);
    fillLight.position.set(-6, 3, -5);
    scene.add(fillLight);

    const grid = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
    grid.position.y = -0.008;
    scene.add(grid);
    const axes = new THREE.AxesHelper(0.55);
    axes.position.set(-2.2, 0.01, -2.2);
    scene.add(axes);

    cameraRef.current = camera;
    let controls: OrbitControls | null = null;

    const resize = () => {
      const { width, height } = viewport.getBoundingClientRect();
      if (width <= 0 || height <= 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(viewport);
    resize();

    let frameCount = 0;
    let fpsWindowStart = performance.now();
    const resetFpsWindow = () => {
      frameCount = 0;
      fpsWindowStart = performance.now();
    };
    document.addEventListener('visibilitychange', resetFpsWindow);
    const render = (now: number) => {
      animationFrame = requestAnimationFrame(render);
      controls?.update();
      renderer.render(scene, camera);
      if (document.visibilityState === 'visible') {
        frameCount++;
        const elapsed = now - fpsWindowStart;
        if (elapsed >= 1000) {
          setFramesPerSecond(Math.round((frameCount * 1000) / elapsed));
          frameCount = 0;
          fpsWindowStart = now;
        }
      }
    };
    animationFrame = requestAnimationFrame(render);

    const loadStartedAt = performance.now();
    void Promise.all([
      import('three/addons/loaders/3MFLoader.js'),
      import('three/addons/controls/OrbitControls.js'),
      import('three/addons/libs/fflate.module.js'),
    ]).then(async ([loaderModule, controlsModule, zipModule]) => {
      if (disposed) return;

      const orbitControls = new controlsModule.OrbitControls(camera, renderer.domElement);
      controls = orbitControls;
      orbitControls.enableDamping = true;
      orbitControls.dampingFactor = 0.07;
      orbitControls.minDistance = 1.5;
      orbitControls.maxDistance = 16;
      orbitControls.target.set(FOCUS_X, 0.5, 0);
      controlsRef.current = orbitControls;

      try {
        setLoadMessage('Downloading 3MF archive…');
        const response = await fetch(MODEL_URL, { signal: loadAbortController.signal });
        if (!response.ok) {
          throw new Error(`The 3MF asset request failed with HTTP ${response.status}.`);
        }
        const archive = await readArchiveResponse(response, (value) => {
          if (!disposed) setProgress(value);
        });
        if (disposed) return;

        setLoadMessage('Recovering original filament assignments…');
        const paint = parsePaintArchive(new Uint8Array(archive), zipModule.unzipSync);
        if (disposed) return;

        setLoadMessage('Building 3MF geometry…');
        const loader = new loaderModule.ThreeMFLoader();
        const model = loader.parse(archive);
        loadedModel = model;
        if (disposed) {
          disposeModel(model);
          loadedModel = null;
          return;
        }

        const paintApplicationStartedAt = performance.now();
        const distinctColors = applyPaintRecovery(model, paint);
        const paintProcessingMilliseconds =
          paint.parsingMilliseconds + performance.now() - paintApplicationStartedAt;

        model.rotation.z = Math.PI;
        model.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(model);
        if (bounds.isEmpty()) {
          throw new Error('The 3MF loader returned an empty model.');
        }

        const dimensions = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const fitScale = 4.4 / Math.max(dimensions.x, dimensions.y, dimensions.z);
        model.scale.setScalar(fitScale);
        model.position.set(
          -center.x * fitScale,
          -bounds.min.y * fitScale,
          -center.z * fitScale
        );

        let meshes = 0;
        let renderedTriangles = 0;
        const uniqueMaterials = new Set<THREE.Material>();
        model.traverse((child) => {
          if (!(child as THREE.Mesh).isMesh) return;
          const mesh = child as THREE.Mesh;
          const position = mesh.geometry.getAttribute('position');
          if (position) {
            renderedTriangles += mesh.geometry.index
              ? mesh.geometry.index.count / 3
              : position.count / 3;
          }
          meshes++;

          const meshMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          meshMaterials.forEach((material) => uniqueMaterials.add(material));
          mesh.castShadow = false;
          mesh.receiveShadow = false;
        });
        if (renderedTriangles !== paint.renderedTriangles) {
          throw new Error(
            `Recovered ${paint.renderedTriangles.toLocaleString()} painted triangles, but the model contains ${renderedTriangles.toLocaleString()}.`
          );
        }

        const fittedHeight = dimensions.y * fitScale;
        fittedHeightRef.current = fittedHeight;
        orbitControls.target.set(FOCUS_X, fittedHeight / 2, 0);
        camera.position.set(FOCUS_X + 4.6, fittedHeight * 0.8 + 0.4, 5.2);
        orbitControls.update();
        scene.add(model);

        setStats({
          dimensions,
          triangles: paint.triangleCount,
          paintedTriangles: paint.paintedTriangles,
          renderedTriangles,
          meshes,
          materials: uniqueMaterials.size,
          distinctColors,
          colors: paint.colors,
          loadMilliseconds: performance.now() - loadStartedAt - paintProcessingMilliseconds,
          paintParsingMilliseconds: paintProcessingMilliseconds,
        });
        setProgress(1);
        setLoadMessage('Model loaded with recovered multicolor paint. Drag to orbit; scroll to zoom.');
      } catch (error: unknown) {
        if (loadedModel) {
          scene.remove(loadedModel);
          disposeModel(loadedModel);
          loadedModel = null;
        }
        if (disposed) return;
        const message = error instanceof Error ? error.message : String(error);
        setLoadError(message);
        setLoadMessage('Model loading or paint recovery failed.');
      }
    }).catch((error: unknown) => {
      if (disposed) return;
      const message = error instanceof Error ? error.message : String(error);
      setLoadError(message);
      setLoadMessage('Model loading or paint recovery failed.');
    });

    return () => {
      disposed = true;
      loadAbortController.abort();
      cancelAnimationFrame(animationFrame);
      document.removeEventListener('visibilitychange', resetFpsWindow);
      resizeObserver.disconnect();
      controls?.dispose();
      controlsRef.current = null;
      cameraRef.current = null;
      if (loadedModel) {
        disposeModel(loadedModel);
        loadedModel = null;
      }
      renderer.dispose();
    };
  }, []);

  const setEndView = (z: -1 | 1) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    controls.target.set(FOCUS_X, fittedHeightRef.current / 2, 0);
    camera.position.set(FOCUS_X, fittedHeightRef.current * 0.7 + 0.5, z * 6.5);
    controls.update();
  };

  const setSideView = () => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!camera || !controls) return;
    controls.target.set(FOCUS_X, fittedHeightRef.current / 2, 0);
    camera.position.set(FOCUS_X + 6.5, fittedHeightRef.current * 0.75 + 0.5, 0);
    controls.update();
  };

  const progressPercent = progress === null ? null : Math.round(progress * 100);

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#080b12] font-mono text-slate-100">
      <div ref={viewportRef} className="absolute inset-0">
        <canvas ref={canvasRef} className="block h-full w-full" aria-label="3MF model viewer" />
      </div>

      <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#080b12]/80 px-5 py-4 backdrop-blur-md">
        <div>
          <div className="text-xs tracking-[0.3em] text-cyan-300">NEON OVERDRIVE / ISOLATED TEST</div>
          <h1 className="mt-1 text-lg font-semibold tracking-widest">DIRECT 3MF IMPORT</h1>
        </div>
        <div className="pointer-events-auto flex flex-wrap gap-2">
          <button onClick={setSideView} className="rounded border border-slate-600 px-3 py-2 text-[10px] tracking-wider hover:border-cyan-300">SIDE</button>
          <button onClick={() => setEndView(1)} className="rounded border border-slate-600 px-3 py-2 text-[10px] tracking-wider hover:border-cyan-300">FRONT +Z</button>
          <button onClick={() => setEndView(-1)} className="rounded border border-slate-600 px-3 py-2 text-[10px] tracking-wider hover:border-cyan-300">REAR −Z</button>
        </div>
        <a
          href="/"
          className="pointer-events-auto rounded border border-slate-500 px-4 py-2 text-xs tracking-widest text-slate-200 hover:border-cyan-300 hover:text-cyan-200"
        >
          EXIT TEST
        </a>
      </header>

      <section className="pointer-events-auto absolute left-5 top-28 z-10 max-h-[calc(100vh-8rem)] w-[min(25rem,calc(100vw-2.5rem))] overflow-y-auto pr-1">
        <div className="rounded border border-white/10 bg-[#080b12]/85 p-4 shadow-xl backdrop-blur-md">
          <div className="text-xs tracking-wider text-slate-300">{loadMessage}</div>
          {stats && (
            <div className="mt-3 rounded border border-emerald-300/50 bg-[#081811]/90 p-3">
              <div className="text-[10px] font-semibold tracking-widest text-emerald-200">COLOR FIDELITY: RECOVERED</div>
              <p className="mt-2 text-[10px] leading-relaxed text-emerald-100/80">
                The slicer’s encoded <code>paint_color</code> trees were decoded and matched to the
                filament palette embedded in the 3MF archive.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.colors.map((color) => (
                  <span key={color} className="inline-flex items-center gap-1.5 rounded border border-white/10 px-2 py-1 text-[9px]">
                    <span className="h-3 w-3 rounded-sm border border-white/30" style={{ backgroundColor: color }} />
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}
          {progressPercent !== null && !stats && (
            <div className="mt-3 h-1.5 overflow-hidden rounded bg-slate-700">
              <div className="h-full bg-cyan-300 transition-[width]" style={{ width: `${progressPercent}%` }} />
            </div>
          )}
          {loadError && <p className="mt-3 break-words text-xs text-red-300">{loadError}</p>}
          {stats && (
            <dl className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 text-[11px]">
              <div><dt className="text-slate-400">Loaded dimensions</dt><dd className="mt-1">{stats.dimensions.x.toFixed(2)} × {stats.dimensions.y.toFixed(2)} × {stats.dimensions.z.toFixed(2)} mm</dd></div>
              <div><dt className="text-slate-400">Source geometry</dt><dd className="mt-1">{stats.triangles.toLocaleString()} triangles</dd></div>
              <div><dt className="text-slate-400">Painted source faces</dt><dd className="mt-1">{stats.paintedTriangles.toLocaleString()}</dd></div>
              <div><dt className="text-slate-400">Rendered geometry</dt><dd className="mt-1">{stats.renderedTriangles.toLocaleString()} triangles</dd></div>
              <div><dt className="text-slate-400">Mesh objects</dt><dd className="mt-1">{stats.meshes}</dd></div>
              <div><dt className="text-slate-400">Recovered colors</dt><dd className="mt-1">{stats.distinctColors}</dd></div>
              <div><dt className="text-slate-400">Materials</dt><dd className="mt-1">{stats.materials}</dd></div>
              <div><dt className="text-slate-400">Archive load + 3MF parse</dt><dd className="mt-1">{(stats.loadMilliseconds / 1000).toFixed(2)} s</dd></div>
              <div><dt className="text-slate-400">Paint decode + geometry</dt><dd className="mt-1">{(stats.paintParsingMilliseconds / 1000).toFixed(2)} s</dd></div>
              <div><dt className="text-slate-400">Render frame rate</dt><dd className="mt-1">{framesPerSecond === null ? 'Measuring…' : `${framesPerSecond} FPS`}</dd></div>
              <div><dt className="text-slate-400">Orientation</dt><dd className="mt-1">Y-up; wheels down</dd></div>
              <div><dt className="text-slate-400">Forward</dt><dd className="mt-1">Front +Z; rear −Z</dd></div>
            </dl>
          )}
          {stats && (
            <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
              Source build was inverted; preview rotates it 180° around Z, then centers and grounds it.
            </p>
          )}
        </div>
      </section>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 bg-gradient-to-t from-[#080b12]/90 to-transparent px-5 pb-5 pt-12 text-[10px] tracking-wider text-slate-300">
        <span>{stats ? loadMessage : '3MFLoader / Three.js r186'}</span>
        <span>LEFT DRAG: ORBIT · WHEEL: ZOOM · RIGHT DRAG: PAN</span>
      </footer>
    </main>
  );
}
