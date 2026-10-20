/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameEngine } from '../game/engine';
import { ThreeSceneManager } from '../game/threeScene';
import { GameStats, GameStatus, GameWorld, PlayerCar, TouchInputState } from '../game/types';
import { sound } from '../game/audio';

interface GameCanvasProps {
  engine: GameEngine;
  isPlaying: boolean;
  status: GameStatus;
  world: GameWorld;
  onGameOver: (stats: GameStats) => void;
  onUpdateHUD: (player: PlayerCar, score: number, distance: number, alert: string | null) => void;
  touchInput: TouchInputState;
}

export const GameCanvas: React.FC<GameCanvasProps> = ({
  engine,
  isPlaying,
  status,
  world,
  onGameOver,
  onUpdateHUD,
  touchInput,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneManagerRef = useRef<ThreeSceneManager | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const [contextLost, setContextLost] = useState(false);

  // Use refs for props so the render loop always accesses current values
  // WITHOUT re-triggering the useEffect or recreating the Three.js scene/context
  const isPlayingRef = useRef<boolean>(isPlaying);
  const isMenuRef = useRef<boolean>(status === 'MENU');
  const onGameOverRef = useRef(onGameOver);
  const onUpdateHUDRef = useRef(onUpdateHUD);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    isMenuRef.current = status === 'MENU';
  }, [status]);

  useEffect(() => {
    onGameOverRef.current = onGameOver;
  }, [onGameOver]);

  useEffect(() => {
    onUpdateHUDRef.current = onUpdateHUD;
  }, [onUpdateHUD]);

  // Synchronize dynamic environment switching without remounting canvas or scene
  useEffect(() => {
    if (sceneManagerRef.current) {
      sceneManagerRef.current.setWorld(world);
    }
  }, [world]);

  // Keep touch flight input in sync with engine
  useEffect(() => {
    engine.setTouchFlightInput(touchInput.fly);
  }, [engine, touchInput.fly]);

  // Initialize Three.js Scene ONCE on mount and run a SINGLE stable animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const sceneManager = new ThreeSceneManager(canvas, world);
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
    };

    // Handle tab visibility changes: pause simulation & audio; reset frame time on return
    const handleVisibilityChange = () => {
      if (document.hidden) {
        sound.stopLoops();
      } else {
        // Reset frame-time baseline so car does not jump forward
        lastTimeRef.current = performance.now();
      }
    };

    window.addEventListener('resize', handleResize);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    // Main 60fps single animation loop
    const renderLoop = (currentTime: number) => {
      // If tab was hidden, reset baseline and skip step
      if (document.hidden) {
        lastTimeRef.current = currentTime;
        animationFrameIdRef.current = requestAnimationFrame(renderLoop);
        return;
      }

      const rawDt = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      // Strict delta-time clamping (max 50ms) to prevent physics jumps
      const dt = Math.min(Math.max(rawDt, 0), 0.05);

      if (isPlayingRef.current && !engine.isPaused) {
        engine.update(dt);

        onUpdateHUDRef.current(
          { ...engine.player },
          engine.score,
          engine.distance,
          engine.nearMissAlert
        );

        if (engine.isGameOver) {
          onGameOverRef.current(engine.getStats());
        }
      }

      // Update 3D scene (Road, Car, Flight, Obstacles, Particles, Camera)
      if (!sceneManager.isContextLost) {
        sceneManager.update(
          dt,
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
      engine.setFlightInput(false);
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
