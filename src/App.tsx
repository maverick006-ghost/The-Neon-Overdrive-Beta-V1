/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GameEngine } from './game/engine';
import { sound } from './game/audio';
import { GameStats, GameStatus, GameWorld, PlayerCar, TouchInputState } from './game/types';
import { GameCanvas } from './components/GameCanvas';
import { HUD } from './components/HUD';
import { StartScreen } from './components/StartScreen';
import { GameOverModal } from './components/GameOverModal';
import { PauseModal } from './components/PauseModal';
import { TouchControls } from './components/TouchControls';

export default function App() {
  const engineRef = useRef<GameEngine>(new GameEngine());
  const [status, setStatus] = useState<GameStatus>('MENU');

  // Persistent World Selection (MOON, EARTH, MARS) with safe localStorage fallback
  const [selectedWorld, setSelectedWorld] = useState<GameWorld>(() => {
    try {
      const saved = localStorage.getItem('neon_overdrive_world');
      if (saved === 'MOON' || saved === 'EARTH' || saved === 'MARS') {
        return saved;
      }
    } catch {
      // Safe fallback if localStorage is unavailable
    }
    return 'EARTH';
  });

  const [score, setScore] = useState<number>(0);
  const [highScore, setHighScore] = useState<number>(() => {
    return Number(localStorage.getItem('neon_overdrive_high_score') || '0');
  });
  const [distance, setDistance] = useState<number>(0);
  const [nearMissAlert, setNearMissAlert] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(() => sound.getMuted());
  const [playerState, setPlayerState] = useState<PlayerCar>(() => engineRef.current.player);
  const [finalStats, setFinalStats] = useState<GameStats | null>(null);
  const [isNewRecord, setIsNewRecord] = useState<boolean>(false);
  const [touchInput, setTouchInput] = useState<TouchInputState>({
    left: false,
    right: false,
    fly: false,
  });

  const handleSelectWorld = useCallback((world: GameWorld) => {
    sound.init();
    sound.playUiClick();
    setSelectedWorld(world);
    try {
      localStorage.setItem('neon_overdrive_world', world);
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }, []);

  const toggleMute = useCallback(() => {
    sound.init();
    sound.playUiClick();
    const nextMuted = !isMuted;
    sound.setMuted(nextMuted);
    setIsMuted(nextMuted);
  }, [isMuted]);

  const handleStartGame = useCallback(() => {
    sound.init();
    sound.playUiClick();
    engineRef.current.reset();
    setStatus('PLAYING');
    setIsNewRecord(false);
  }, []);

  const handlePauseGame = useCallback(() => {
    if (status !== 'PLAYING') return;
    sound.init();
    sound.playUiClick();
    sound.stopLoops();
    engineRef.current.isPaused = true;
    setStatus('PAUSED');
  }, [status]);

  const handleResumeGame = useCallback(() => {
    if (status !== 'PAUSED') return;
    sound.init();
    sound.playUiClick();
    engineRef.current.isPaused = false;
    setStatus('PLAYING');
  }, [status]);

  const handleRestartGame = useCallback(() => {
    sound.init();
    sound.playUiClick();
    engineRef.current.reset();
    setStatus('PLAYING');
    setIsNewRecord(false);
  }, []);

  const handleReturnToMenu = useCallback(() => {
    sound.init();
    sound.playUiClick();
    sound.stopLoops();
    engineRef.current.reset();
    setStatus('MENU');
    setIsNewRecord(false);
  }, []);

  const handleGameOver = useCallback((stats: GameStats) => {
    const prevHighScore = Number(localStorage.getItem('neon_overdrive_high_score') || '0');
    if (stats.score > prevHighScore) {
      setIsNewRecord(true);
      setHighScore(stats.score);
    }
    setFinalStats(stats);
    setStatus('GAMEOVER');
  }, []);

  const handleUpdateHUD = useCallback(
    (player: PlayerCar, currentScore: number, currentDistance: number, alert: string | null) => {
      setPlayerState(player);
      setScore(currentScore);
      setDistance(currentDistance);
      setNearMissAlert(alert);
      if (currentScore > highScore) {
        setHighScore(currentScore);
      }
    },
    [highScore]
  );

  // Global key listener for Start, Pause, Resume
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status === 'MENU' && (e.code === 'Space' || e.code === 'Enter')) {
        e.preventDefault();
        handleStartGame();
      } else if (status === 'PLAYING' && (e.code === 'KeyP' || e.code === 'Escape')) {
        e.preventDefault();
        handlePauseGame();
      } else if (status === 'PAUSED' && (e.code === 'KeyP' || e.code === 'Escape')) {
        e.preventDefault();
        handleResumeGame();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, handleStartGame, handlePauseGame, handleResumeGame]);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#080808] select-none font-sans">
      {/* 1. Underlying 3D Canvas Viewport */}
      <GameCanvas
        engine={engineRef.current}
        isPlaying={status === 'PLAYING'}
        status={status}
        world={selectedWorld}
        onGameOver={handleGameOver}
        onUpdateHUD={handleUpdateHUD}
        touchInput={touchInput}
      />

      {/* 2. Interactive Head-Up Display (Visible during Playing and Paused) */}
      {(status === 'PLAYING' || status === 'PAUSED') && (
        <HUD
          score={score}
          highScore={highScore}
          distance={distance}
          player={playerState}
          world={selectedWorld}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onPause={handlePauseGame}
          nearMissAlert={nearMissAlert}
        />
      )}

      {/* 3. Mobile / Tablet On-Screen Touch Controls */}
      {status === 'PLAYING' && (
        <TouchControls
          onSteerLeft={() => engineRef.current.steerLeft()}
          onSteerRight={() => engineRef.current.steerRight()}
          onTouchFlightChange={(flying) => {
            engineRef.current.setTouchFlightInput(flying);
            setTouchInput((prev) => ({ ...prev, fly: flying }));
          }}
          onTouchStateChange={setTouchInput}
        />
      )}

      {/* 4. Start Screen Overlay with World Selector */}
      {status === 'MENU' && (
        <StartScreen
          highScore={highScore}
          selectedWorld={selectedWorld}
          onSelectWorld={handleSelectWorld}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onStart={handleStartGame}
        />
      )}

      {/* 5. Pause Screen Overlay */}
      {status === 'PAUSED' && (
        <PauseModal
          world={selectedWorld}
          onResume={handleResumeGame}
          onRestart={handleRestartGame}
          onReturnToMenu={handleReturnToMenu}
          isMuted={isMuted}
          onToggleMute={toggleMute}
        />
      )}

      {/* 6. Game Over Screen Overlay */}
      {status === 'GAMEOVER' && finalStats && (
        <GameOverModal
          stats={finalStats}
          isNewRecord={isNewRecord}
          world={selectedWorld}
          onRestart={handleRestartGame}
          onReturnToMenu={handleReturnToMenu}
        />
      )}
    </div>
  );
}
