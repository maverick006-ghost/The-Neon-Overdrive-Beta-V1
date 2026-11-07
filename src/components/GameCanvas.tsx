/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine';
import { ThreeSceneManager } from '../game/threeScene';
import { GameStats, GameStatus, GameWorld, PlayerCar, TouchInputState, VehicleId } from '../game/types';
import { sound } from '../game/audio';

interface GameCanvasProps {
  engine: GameEngine;
  isPlaying: boolean;
  status: GameStatus;
  world: GameWorld;
  vehicle: VehicleId;
  onGameOver: (stats: GameStats) => void;
  onUpdateHUD: (player: PlayerCar, score: number, distance: number, alert: string | null) => void;
  onClearInput: () => void;
  touchInput: TouchInputState;
}

const SIMULATION_STEP = 1 / 60;
const MAX_FRAME_DELTA = 0.1;
const MAX_SIMULATION_STEPS_PER_FRAME = 5;
const MAX_ACCUMULATED_TIME = SIMULATION_STEP * MAX_SIMULATION_STEPS_PER_FRAME;
const SIMULATION_EPSILON = 1e-10;
const HUD_UPDATE_INTERVAL = 0.1;

export const GameCanvas: React.FC<GameCanvasProps> = ({
  engine,
  isPlaying,
  status,
  world,
  vehicle,
  onGameOver,
  onUpdateHUD,
  onClearInput,
  touchInput,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneManagerRef = useRef<ThreeSceneManager | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const simulationAccumulatorRef = useRef<number>(0);
  const hudAccumulatorRef = useRef<number>(0);
  const [contextLost, setContextLost] = useState(false);

  // Use refs for props so the render loop always accesses current values
  // WITHOUT re-triggering the useEffect or recreating the Three.js scene/context
  const isPlayingRef = useRef<boolean>(isPlaying);
  const isMenuRef = useRef<boolean>(status === 'MENU');
  const statusRef = useRef<GameStatus>(status);
  const runIdRef = useRef<number>(engine.runId);
  const onGameOverRef = useRef(onGameOver);
  const onUpdateHUDRef = useRef(onUpdateHUD);
  const onClearInputRef = useRef(onClearInput);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isMenuRef.current = status === 'MENU';
    statusRef.current = status;
    simulationAccumulatorRef.current = 0;
    hudAccumulatorRef.current = 0;
    lastTimeRef.current = performance.now();
    if (status !== 'PLAYING') onClearInputRef.current();
  }, [status]);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    onUpdateHUDRef.current = onUpdateHUD;
  }, [onUpdateHUD]);

  useEffect(() => {
    onClearInputRef.current = onClearInput;
  }, [onClearInput]);

  // Synchronize dynamic environment switching without remounting canvas or scene
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setWorld(world);
    }
  }, [world]);

  // Synchronize dynamic vehicle switching without remounting canvas or scene
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setVehicle(vehicle);
    }
  }, [vehicle]);

  // Keep touch flight input in sync with the authoritative engine state.
  useEffect(() => {
    engine.setTouchFlightInput(touchInput.fly);
  }, [engine, touchInput.fly]);

  // Initialize Three.js Scene ONCE on mount and run a SINGLE stable animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sceneManager = new ThreeSceneManager(canvas, world, vehicle);
    sceneManagerRef.current = sceneManager;

    const handleResize = () => {
      sceneManager.handleResize();
    };

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };

    const handleContextRestored = () => {
      setContextLost(false);
      lastTimeRef.current = performance.now();
      simulationAccumulatorRef.current = 0;
    };

    // Handle tab visibility changes: clear held inputs and reset the simulation clock.
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onClearInputRef.current();
        simulationAccumulatorRef.current = 0;
        hudAccumulatorRef.current = 0;
        lastTimeRef.current = performance.now();
        sound.stopLoops();
      } else {
        lastTimeRef.current = performance.now();
        simulationAccumulatorRef.current = 0;
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    let gameOverReported = false;
    const renderLoop = (currentTime: number) => {
      const observedRunId = engine.runId;
      if (observedRunId !== runIdRef.current) {
        runIdRef.current = observedRunId;
        simulationAccumulatorRef.current = 0;
        hudAccumulatorRef.current = 0;
        gameOverReported = false;
        lastTimeRef.current = currentTime;
      }

      if (document.hidden) {
        lastTimeRef.current = currentTime;
        animationFrameIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const rawDt = Math.max(0, (currentTime - lastTimeRef.current) / 1000);
      lastTimeRef.current = currentTime;
      const renderDt = Math.min(rawDt, 0.05);

      const canSimulate =
        isPlayingRef.current &&
        statusRef.current === 'PLAYING' &&
        !engine.isPaused &&
        !engine.isGameOver;
      if (canSimulate) {
        simulationAccumulatorRef.current = Math.min(
          simulationAccumulatorRef.current + Math.min(rawDt, MAX_FRAME_DELTA),
          MAX_ACCUMULATED_TIME
        );
        let steps = 0;
        while (
          simulationAccumulatorRef.current + SIMULATION_EPSILON >= SIMULATION_STEP &&
          steps < MAX_SIMULATION_STEPS_PER_FRAME
        ) {
          engine.update(SIMULATION_STEP);
          simulationAccumulatorRef.current = Math.max(
            0,
            simulationAccumulatorRef.current - SIMULATION_STEP
          );
          hudAccumulatorRef.current += SIMULATION_STEP;
          steps++;

          if (engine.isGameOver) {
            onClearInputRef.current();
            engine.persistHighScore();
            if (!gameOverReported) {
              gameOverReported = true;
              onUpdateHUDRef.current(
                { ...engine.player },
                engine.score,
                engine.distance,
                engine.nearMissAlert
              );
              onGameOverRef.current(engine.getStats());
            }
            simulationAccumulatorRef.current = 0;
            break;
          }
        }

        if (
          steps > 0 &&
          hudAccumulatorRef.current >= HUD_UPDATE_INTERVAL &&
          !engine.isGameOver
        ) {
          hudAccumulatorRef.current %= HUD_UPDATE_INTERVAL;
          onUpdateHUDRef.current(
            { ...engine.player },
            engine.score,
            engine.distance,
            engine.nearMissAlert
          );
        }
      } else {
        simulationAccumulatorRef.current = 0;
        hudAccumulatorRef.current = 0;
      }

      // Update 3D scene (Road, Car, Flight, Obstacles, Particles, Camera)
      if (!sceneManager.isContextLost) {
        sceneManager.update(
          canSimulate || statusRef.current === 'MENU' ? renderDt : 0,
          engine.player,
          engine.objects,
          engine.screenShake,
          engine.screenShakeX,
          engine.screenShakeY,
          isMenuRef.current
        );
      }

      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    lastTimeRef.current = performance.now();
    animationFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      engine.clearInputState();
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);

      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }

      sceneManager.dispose();
      sceneManagerRef.current = null;
    };
  }, [engine]); // Engine instance is stable (useRef in App.tsx)

  // Global Keyboard Controls (A/D or Left/Right for steering, Space for vertical flight)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (statusRef.current !== 'PLAYING') return;

      // Prevent browser scroll on game keys
      if (e.code === 'Space' || e.code === 'ArrowLeft' || e.code === 'ArrowRight' || e.code === 'ArrowUp' || e.code === 'ArrowDown') {
        e.preventDefault();
      }

      if (e.repeat && (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'ArrowRight' || e.code === 'KeyD')) {
        return;
      }

      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        engine.steerLeft();
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        engine.steerRight();
      } else if (e.code === 'Space') {
        engine.setFlightInput(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault();
        engine.setFlightInput(false);
      }
    };

    const handleBlur = () => {
      onClearInputRef.current();
      simulationAccumulatorRef.current = 0;
      lastTimeRef.current = performance.now();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [engine]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#02050e]">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block"
      />
      {contextLost && (
        <div className="absolute inset-0 bg-[#02050e]/95 flex flex-col items-center justify-center p-6 text-center z-50">
          <div className="text-cyan-400 font-mono text-sm tracking-wider uppercase mb-2">Graphics Context Suspended</div>
          <p className="text-slate-400 text-xs max-w-sm">WebGL context is recovering. Refocusing the browser tab will resume rendering.</p>
        </div>
      )}
    </div>
  );
};
