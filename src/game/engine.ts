/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { sound } from './audio';
import { GameObject, GameStats, LaneIndex, PlayerCar, PowerupType } from './types';

export class GameEngine {
  public player: PlayerCar;
  public objects: GameObject[] = [];
  public roadScrollZ: number = 0;
  public roadCurvature: number = 0;
  public targetCurvature: number = 0;
  public curveTimer: number = 0;

  public score: number = 0;
  public highScore: number = 0;
  public totalCoins: number = 0;
  public distance: number = 0; // meters
  public topSpeed: number = 160;
  public coinsCollected: number = 0;
  public nearMisses: number = 0;
  public totalFlightTime: number = 0;

  public screenShake: number = 0;
  public screenShakeX: number = 0;
  public screenShakeY: number = 0;

  public isGameOver: boolean = false;
  public isPaused: boolean = false;
  public nearMissAlert: string | null = null;
  public nearMissTimer: number = 0;

  // Spawning & progression
  private spawnCooldown: number = 0;
  private powerupCooldown: number = 12.0; // first powerup arrives around 12-15s
  private nextObjectId: number = 1;
  private coinCombo: number = 0;
  private coinComboResetTimer: number = 0;
  private wasAirborne: boolean = false;

  public keyboardFlightActive: boolean = false;
  public touchFlightActive: boolean = false;

  constructor() {
    this.highScore = this.loadSafeNumber('neon_overdrive_high_score', 0);
    this.totalCoins = this.loadSafeNumber('neon_overdrive_total_coins', 0);
    this.player = this.createInitialPlayer();
  }

  private loadSafeNumber(key: string, defaultValue: number): number {
    try {
      const val = localStorage.getItem(key);
      return val ? Number(val) || defaultValue : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  private saveSafeNumber(key: string, value: number) {
    try {
      localStorage.setItem(key, String(value));
    } catch {
      // Storage unavailable or quota exceeded
    }
  }

  private createInitialPlayer(): PlayerCar {
    return {
      lane: 1,
      targetLane: 1,
      x: 0,
      targetX: 0,
      y: 0,
      altitude: 0,
      targetAltitude: 0,
      isFlying: false,
      flightEnergy: 100, // Starts with full 100% fuel tank
      shields: 3,        // Three-hit survival system
      invulnerableTimer: 0,
      bankAngle: 0,
      speed: 160,
      distance: 0,
      totalFlightTime: 0,
      magnetTimer: 0,
      shieldTimer: 0,
      hasShield: false,
      multiplierTimer: 0,
      coinsCollected: 0,
    };
  }

  public reset() {
    this.player = this.createInitialPlayer();
    this.objects = [];
    this.roadScrollZ = 0;
    this.roadCurvature = 0;
    this.targetCurvature = 0;
    this.curveTimer = 0;

    this.score = 0;
    this.distance = 0;
    this.topSpeed = 160;
    this.coinsCollected = 0;
    this.nearMisses = 0;
    this.totalFlightTime = 0;

    this.screenShake = 0;
    this.screenShakeX = 0;
    this.screenShakeY = 0;
    this.isGameOver = false;
    this.isPaused = false;
    this.nearMissAlert = null;
    this.nearMissTimer = 0;
    this.spawnCooldown = 0.4;
    this.powerupCooldown = 12.0;
    this.keyboardFlightActive = false;
    this.touchFlightActive = false;
    this.coinCombo = 0;
    this.coinComboResetTimer = 0;
    this.wasAirborne = false;

    // Refresh from localStorage
    this.highScore = this.loadSafeNumber('neon_overdrive_high_score', 0);
    this.totalCoins = this.loadSafeNumber('neon_overdrive_total_coins', 0);
  }

  public steerLeft() {
    if (this.isGameOver || this.isPaused) return;
    if (this.player.targetLane > 0) {
      this.player.targetLane = (this.player.targetLane - 1) as LaneIndex;
      this.player.targetX = this.player.targetLane - 1;
      this.player.bankAngle = -1.0;
      sound.playLaneShift('left');
    }
  }

  public steerRight() {
    if (this.isGameOver || this.isPaused) return;
    if (this.player.targetLane < 2) {
      this.player.targetLane = (this.player.targetLane + 1) as LaneIndex;
      this.player.targetX = this.player.targetLane - 1;
      this.player.bankAngle = 1.0;
      sound.playLaneShift('right');
    }
  }

  public setFlightInput(wantFlight: boolean) {
    if (this.isGameOver || this.isPaused) return;
    this.keyboardFlightActive = wantFlight;
  }

  public setTouchFlightInput(wantFlight: boolean) {
    if (this.isGameOver || this.isPaused) return;
    this.touchFlightActive = wantFlight;
  }

  public update(dt: number) {
    if (this.isGameOver || this.isPaused) return;

    // 1. Authoritative Flight Decision
    // Consumes ~25 fuel units/sec, cannot activate when empty
    const wantFlight = this.keyboardFlightActive || this.touchFlightActive;

    if (wantFlight && this.player.flightEnergy > 0) {
      if (!this.player.isFlying) {
        sound.playFlightEngage();
        this.screenShake = 0.2;
      }
      this.player.isFlying = true;
      this.player.targetAltitude = 1.0;
    } else {
      if (this.player.isFlying) {
        this.player.isFlying = false;
      }
      this.player.targetAltitude = 0;
    }

    // Flight takeoff & landing detection
    const isCurrentlyAirborne = this.player.altitude > 0.08;
    if (!isCurrentlyAirborne && this.wasAirborne) {
      // Just touched down on the road
      sound.playLanding();
    }
    this.wasAirborne = isCurrentlyAirborne;

    // 2. Flight Fuel Mechanics
    if (this.player.isFlying) {
      // Burn ~25 units per second (gives 4.0s full continuous flight)
      this.player.flightEnergy = Math.max(0, this.player.flightEnergy - 25 * dt);
      this.totalFlightTime += dt;
      this.player.totalFlightTime = this.totalFlightTime;

      if (this.player.flightEnergy <= 0) {
        this.player.isFlying = false;
        this.player.targetAltitude = 0;
        sound.playLowFlightEnergyWarning();
      } else if (this.player.flightEnergy < 20) {
        if (Math.floor(this.player.flightEnergy) % 10 === 0) {
          sound.playLowFlightEnergyWarning();
        }
      }
    } else {
      // Ground fuel recharge: 7 units per second (STOPS WHILE AIRBORNE)
      if (this.player.altitude < 0.05) {
        this.player.flightEnergy = Math.min(100, this.player.flightEnergy + 7.0 * dt);
      }
    }

    // 3. Power-Up Timers & Perks
    if (this.player.magnetTimer > 0) {
      this.player.magnetTimer = Math.max(0, this.player.magnetTimer - dt);
    }

    if (this.player.multiplierTimer > 0) {
      this.player.multiplierTimer = Math.max(0, this.player.multiplierTimer - dt);
    }

    if (this.player.shieldTimer > 0) {
      this.player.shieldTimer = Math.max(0, this.player.shieldTimer - dt);
      if (this.player.shieldTimer <= 0) {
        this.player.hasShield = false;
      }
    }

    // 4. Progressive Speed Curve
    // Smooth, gradual progression from 160 km/h up to 340 km/h
    const baseSpeed = Math.min(340, 160 + Math.pow(this.distance / 100, 0.52) * 11);
    const flightBoost = this.player.isFlying ? 35 : 0;
    this.player.speed = baseSpeed + flightBoost;

    if (this.player.speed > this.topSpeed) {
      this.topSpeed = Math.floor(this.player.speed);
    }

    // Distance accumulation
    const speedMps = this.player.speed / 3.6;
    const distanceDelta = speedMps * dt;
    this.distance += distanceDelta;
    this.player.distance = this.distance;

    const roadScrollDelta = speedMps * 2.8 * dt;
    this.roadScrollZ += roadScrollDelta;

    // Score accumulation: distance + flight bonus + 2x multiplier
    const scoreMultiplier = this.player.multiplierTimer > 0 ? 2.0 : 1.0;
    const flightMultiplier = this.player.isFlying ? 1.5 : 1.0;
    this.score += Math.floor(distanceDelta * 3 * flightMultiplier * scoreMultiplier);

    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.saveSafeNumber('neon_overdrive_high_score', this.highScore);
    }

    // 5. Smooth Player Interpolation (Lane change and Altitude)
    const laneLerpSpeed = 14;
    this.player.x += (this.player.targetX - this.player.x) * Math.min(1, laneLerpSpeed * dt);

    // Altitude lerp: smooth vertical liftoff and touchdown
    const altitudeLerpSpeed = this.player.isFlying ? 8.5 : 6.0;
    this.player.altitude += (this.player.targetAltitude - this.player.altitude) * Math.min(1, altitudeLerpSpeed * dt);

    this.player.bankAngle *= Math.max(0, 1 - 7 * dt);

    // Invulnerability decay
    if (this.player.invulnerableTimer > 0) {
      this.player.invulnerableTimer = Math.max(0, this.player.invulnerableTimer - dt);
    }

    // Toast alert decay
    if (this.nearMissTimer > 0) {
      this.nearMissTimer = Math.max(0, this.nearMissTimer - dt);
      if (this.nearMissTimer <= 0) {
        this.nearMissAlert = null;
      }
    }

    // Coin combo decay
    if (this.coinComboResetTimer > 0) {
      this.coinComboResetTimer -= dt;
      if (this.coinComboResetTimer <= 0) {
        this.coinCombo = 0;
      }
    }

    // Road curvature
    this.curveTimer -= dt;
    if (this.curveTimer <= 0) {
      this.targetCurvature = (Math.random() - 0.5) * 1.3;
      this.curveTimer = 3.5 + Math.random() * 3.0;
    }
    this.roadCurvature += (this.targetCurvature - this.roadCurvature) * Math.min(1, 1.2 * dt);

    // Screen Shake
    if (this.screenShake > 0) {
      this.screenShakeX = (Math.random() - 0.5) * this.screenShake * 16;
      this.screenShakeY = (Math.random() - 0.5) * this.screenShake * 16;
      this.screenShake = Math.max(0, this.screenShake - 3.8 * dt);
    } else {
      this.screenShakeX = 0;
      this.screenShakeY = 0;
    }

    // 6. Spawning: Obstacles, Coins, and Power-Ups
    this.updateSpawning(dt);

    // 7. Update Objects (Traffic, Barriers, Gaps, Coins, Power-ups)
    this.updateGameObjects(dt, roadScrollDelta);

    // 8. Continuous Audio Loop update
    sound.updateEngine(this.player.speed, this.player.isFlying, !this.isGameOver && !this.isPaused);
  }

  /**
   * Spawns structured Subway Surfers style obstacle patterns and coin trails.
   * Fair design: Never blocks all 3 lanes simultaneously with ground walls!
   */
  private updateSpawning(dt: number) {
    this.spawnCooldown -= dt;
    this.powerupCooldown -= dt;

    if (this.spawnCooldown > 0) return;

    // Spacing scales naturally with vehicle speed to preserve fair reaction times
    const speedRatio = Math.max(0, Math.min(1, (this.player.speed - 160) / 180));
    const baseInterval = 1.3 - speedRatio * 0.45; // 1.3s down to ~0.85s
    this.spawnCooldown = baseInterval + Math.random() * 0.35;

    const spawnZ = 1250;

    // A. Check if it's time to spawn a Power-Up (every 25-35 seconds)
    if (this.powerupCooldown <= 0) {
      this.powerupCooldown = 26 + Math.random() * 10;
      const powerupTypes: PowerupType[] = ['magnet', 'fuel', 'shield', 'multiplier'];
      const chosenType = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
      const lane = Math.floor(Math.random() * 3) as LaneIndex;

      this.objects.push({
        id: `powerup_${this.nextObjectId++}`,
        type: 'powerup',
        powerupType: chosenType,
        lane,
        z: spawnZ,
        speed: 0,
        width: 1.0,
        height: 1.0,
        cleared: false,
      });
      return;
    }

    // B. Pick an arcade endless-runner pattern
    const patternRoll = Math.random();

    if (patternRoll < 0.22) {
      // PATTERN 1: Straight Coin Trail (6 coins along a single lane)
      const lane = Math.floor(Math.random() * 3) as LaneIndex;
      const coinCount = 6;
      for (let c = 0; c < coinCount; c++) {
        this.objects.push({
          id: `coin_${this.nextObjectId++}`,
          type: 'coin',
          lane,
          z: spawnZ + c * 55,
          speed: 0,
          width: 0.6,
          height: 0.6,
          cleared: false,
          isElevated: false,
        });
      }
    } else if (patternRoll < 0.40) {
      // PATTERN 2: Laser Barrier on Lane A, with diagonal coin trail guiding player to Lane B
      const barrierLane = Math.floor(Math.random() * 3) as LaneIndex;
      const targetLane = barrierLane === 1 ? (Math.random() > 0.5 ? 0 : 2) : 1;

      this.objects.push({
        id: `barrier_${this.nextObjectId++}`,
        type: 'barrier',
        lane: barrierLane,
        z: spawnZ + 120,
        speed: 0,
        width: 1,
        height: 1.5,
        cleared: false,
      });

      // Curved coin trail leading safely around the barrier
      const lanes = [barrierLane, targetLane, targetLane] as LaneIndex[];
      lanes.forEach((l, idx) => {
        this.objects.push({
          id: `coin_${this.nextObjectId++}`,
          type: 'coin',
          lane: l,
          z: spawnZ + idx * 60,
          speed: 0,
          width: 0.6,
          height: 0.6,
          cleared: false,
          isElevated: false,
        });
      });
    } else if (patternRoll < 0.58) {
      // PATTERN 3: Elevated Rocket Coin Arc over a Low Barrier (rewards Rocket Flight!)
      const lane = Math.floor(Math.random() * 3) as LaneIndex;

      this.objects.push({
        id: `barrier_${this.nextObjectId++}`,
        type: 'barrier',
        lane,
        z: spawnZ + 80,
        speed: 0,
        width: 1,
        height: 1.4,
        cleared: false,
      });

      // 5 elevated coins floating high over the barrier
      for (let c = 0; c < 5; c++) {
        this.objects.push({
          id: `coin_${this.nextObjectId++}`,
          type: 'coin',
          lane,
          z: spawnZ + c * 50,
          speed: 0,
          width: 0.6,
          height: 0.6,
          cleared: false,
          isElevated: true, // Requires flight!
        });
      }
    } else if (patternRoll < 0.74) {
      // PATTERN 4: Traffic Vehicle with coin trails in adjacent lane
      const trafficLane = Math.floor(Math.random() * 3) as LaneIndex;
      const coinLane = trafficLane === 1 ? (Math.random() > 0.5 ? 0 : 2) : 1;

      this.objects.push({
        id: `traffic_${this.nextObjectId++}`,
        type: 'traffic',
        lane: trafficLane,
        z: spawnZ,
        speed: -45, // Moves forward relative to road
        width: 1,
        height: 1,
        cleared: false,
        variant: Math.random() > 0.5 ? 1 : 0,
      });

      // 4 coins in the safe lane alongside the traffic
      for (let c = 0; c < 4; c++) {
        this.objects.push({
          id: `coin_${this.nextObjectId++}`,
          type: 'coin',
          lane: coinLane,
          z: spawnZ + c * 60,
          speed: 0,
          width: 0.6,
          height: 0.6,
          cleared: false,
          isElevated: false,
        });
      }
    } else if (patternRoll < 0.88) {
      // PATTERN 5: Road Gap with Fuel Cell / elevated coin arc
      const gapLane = Math.floor(Math.random() * 3) as LaneIndex;

      this.objects.push({
        id: `gap_${this.nextObjectId++}`,
        type: 'gap',
        lane: gapLane,
        z: spawnZ,
        speed: 0,
        width: 1,
        height: 0.6,
        cleared: false,
      });

      // Spawn a fuel cell or elevated coin right above the gap
      if (Math.random() > 0.45) {
        this.objects.push({
          id: `powerup_${this.nextObjectId++}`,
          type: 'powerup',
          powerupType: 'fuel',
          lane: gapLane,
          z: spawnZ + 40,
          speed: 0,
          width: 1,
          height: 1,
          cleared: false,
          isElevated: true,
        });
      } else {
        for (let c = 0; c < 4; c++) {
          this.objects.push({
            id: `coin_${this.nextObjectId++}`,
            type: 'coin',
            lane: gapLane,
            z: spawnZ + c * 45,
            speed: 0,
            width: 0.6,
            height: 0.6,
            cleared: false,
            isElevated: true,
          });
        }
      }
    } else {
      // PATTERN 6: Two Barriers with ONE clear center/side escape lane
      const clearLane = Math.floor(Math.random() * 3) as LaneIndex;
      ([0, 1, 2] as LaneIndex[]).forEach((lane) => {
        if (lane !== clearLane) {
          this.objects.push({
            id: `barrier_${this.nextObjectId++}`,
            type: 'barrier',
            lane,
            z: spawnZ,
            speed: 0,
            width: 1,
            height: 1.5,
            cleared: false,
          });
        } else {
          // Rewarding coins through the open lane
          for (let c = 0; c < 3; c++) {
            this.objects.push({
              id: `coin_${this.nextObjectId++}`,
              type: 'coin',
              lane,
              z: spawnZ + c * 50,
              speed: 0,
              width: 0.6,
              height: 0.6,
              cleared: false,
              isElevated: false,
            });
          }
        }
      });
    }
  }

  private updateGameObjects(dt: number, roadScrollDelta: number) {
    const playerZ = 60; // Player's fixed position along Z
    const laneMap = [-1, 0, 1];
    const isAirborne = this.player.altitude > 0.45;
    const isMagnetActive = this.player.magnetTimer > 0;
    const scoreMultiplier = this.player.multiplierTimer > 0 ? 2 : 1;

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];

      // Move object toward player
      const objMovement = roadScrollDelta - obj.speed * dt;
      obj.z -= objMovement;

      const distZ = obj.z - playerZ;
      const objLaneX = laneMap[obj.lane];
      const lateralDist = Math.abs(this.player.x - objLaneX);

      // A. COIN COLLECTION & MAGNET ATTRACTION
      if (obj.type === 'coin' && !obj.collected) {
        // Magnet effect: attract uncollected coins toward the vehicle
        if (isMagnetActive && distZ > -15 && distZ < 220) {
          obj.magnetized = true;
          // Smoothly pull lateral position toward player's actual X
          const playerLaneTarget = this.player.targetLane;
          if (distZ < 100) {
            obj.lane = playerLaneTarget;
          }
        }

        // Collection detection
        if (Math.abs(distZ) < 32 && lateralDist < 0.52) {
          // Height matching: Elevated coins need flight, Ground coins need driving
          const heightMatches = obj.isElevated ? isAirborne : (this.player.altitude < 0.42);

          // If magnet is active, allow gathering regardless of height
          if (heightMatches || isMagnetActive) {
            obj.collected = true;
            this.coinsCollected++;
            this.player.coinsCollected = this.coinsCollected;
            this.totalCoins++;
            this.saveSafeNumber('neon_overdrive_total_coins', this.totalCoins);

            this.coinCombo++;
            this.coinComboResetTimer = 1.8;

            this.score += 50 * scoreMultiplier;
            sound.playCoinCollect(this.coinCombo);
          }
        }
      }

      // B. POWER-UP PICKUPS
      else if (obj.type === 'powerup' && !obj.collected) {
        if (Math.abs(distZ) < 32 && lateralDist < 0.55) {
          const heightMatches = obj.isElevated ? isAirborne : (this.player.altitude < 0.45);
          if (heightMatches) {
            obj.collected = true;
            this.applyPowerup(obj.powerupType || 'fuel');
          }
        }
      }

      // C. GROUND OBSTACLES: Traffic, Barrier, Gap (Damaging)
      else if ((obj.type === 'traffic' || obj.type === 'barrier' || obj.type === 'gap') && !obj.cleared) {
        // Active collision zone along Z
        if (distZ >= -24 && distZ <= 24) {
          if (lateralDist < 0.44) {
            if (isAirborne) {
              // Successfully flying over the obstacle!
              obj.hasOverflown = true;
            } else {
              // On ground or descended onto obstacle!
              if (this.player.invulnerableTimer <= 0) {
                this.handleCollision(obj.type);
                obj.cleared = true;
              }
            }
          }
        }

        // Passed safely behind player
        if (distZ < -24) {
          if (obj.hasOverflown && !obj.cleared) {
            obj.cleared = true;
            this.score += 250 * scoreMultiplier;
            this.nearMissAlert = `FLIGHT OVERTAKE +${250 * scoreMultiplier}`;
            this.nearMissTimer = 1.0;
          } else if (!obj.cleared && lateralDist >= 0.42 && lateralDist <= 0.90 && this.player.altitude < 0.3) {
            // Near-miss on ground
            obj.cleared = true;
            this.nearMisses++;
            this.score += 150 * scoreMultiplier;
            this.nearMissAlert = `NEAR MISS +${150 * scoreMultiplier}`;
            this.nearMissTimer = 0.9;
            sound.playNearMiss();
          }
        }
      }

      // Remove objects that have scrolled far behind player
      if (obj.z < -80) {
        this.objects.splice(i, 1);
      }
    }
  }

  private applyPowerup(type: PowerupType) {
    sound.playPowerupPickup(type);

    if (type === 'fuel') {
      // Instantly restore 35 units of rocket fuel (capped at 100)
      this.player.flightEnergy = Math.min(100, this.player.flightEnergy + 35);
      this.nearMissAlert = 'FUEL +35 CELL';
      this.nearMissTimer = 1.4;
    } else if (type === 'shield') {
      // Defensive shield against 1 damaging hit (10s duration)
      this.player.hasShield = true;
      this.player.shieldTimer = 10.0;
      this.nearMissAlert = 'SHIELD ACTIVE (10s)';
      this.nearMissTimer = 1.4;
    } else if (type === 'magnet') {
      // Coin magnet for 8s
      this.player.magnetTimer = 8.0;
      this.nearMissAlert = 'COIN MAGNET (8s)';
      this.nearMissTimer = 1.4;
    } else if (type === 'multiplier') {
      // 2x Score multiplier for 8s
      this.player.multiplierTimer = 8.0;
      this.nearMissAlert = '2X MULTIPLIER (8s)';
      this.nearMissTimer = 1.4;
    }
  }

  private handleCollision(type: string) {
    // Check if defensive shield power-up absorbs the hit
    if (this.player.hasShield) {
      this.player.hasShield = false;
      this.player.shieldTimer = 0;
      this.player.invulnerableTimer = 1.2; // 1.2s damage immunity
      this.screenShake = 0.5;
      sound.playShieldDeflect();
      this.nearMissAlert = 'SHIELD DEFLECTED IMPACT!';
      this.nearMissTimer = 1.5;
      return;
    }

    // Three-hit survival system: Deduct 1 hit
    this.screenShake = 1.0;
    this.player.invulnerableTimer = 1.2; // 1.2s damage immunity
    this.player.shields = Math.max(0, this.player.shields - 1);

    sound.playCollision();

    if (this.player.shields <= 0) {
      // Game Over
      this.isGameOver = true;
      sound.playGameOver();
    } else {
      // Minor bounce-back / levitate if gap
      if (type === 'gap') {
        this.player.altitude = 0.35;
      }
      this.nearMissAlert = `HULL IMPACT! (${this.player.shields} HITS LEFT)`;
      this.nearMissTimer = 1.5;
    }
  }

  public getStats(): GameStats {
    return {
      score: this.score,
      highScore: this.highScore,
      distance: Math.floor(this.distance),
      topSpeed: this.topSpeed,
      coinsCollected: this.coinsCollected,
      totalCoins: this.totalCoins,
      nearMisses: this.nearMisses,
      flightTime: Math.floor(this.totalFlightTime),
    };
  }
}
