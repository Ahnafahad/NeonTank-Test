# Neon Tank Duel: Transform to Riot Games/Valorant-Level Quality

## Implementation Status

**PHASE 1: Critical Bug Fixes** ✅ **COMPLETED**
- ✅ 1A: Fixed LAN Race Condition
- ✅ 1B: Sudden Death Rendering (already working)
- ✅ 1C: Fixed Settings System UI

**PHASE 2: Netcode Transformation** ✅ **COMPLETED**
- ✅ 2A: Increase Server Tick Rate to 60Hz
- ✅ 2B: Reduce Interpolation Delay (66ms → 20-30ms)
- ✅ 2C: Implement Lag Compensation (state history + rewind)
- ✅ 2D: Implement Bullet Prediction (instant local spawns)
- ✅ 2E: Smooth Reconciliation (5px threshold, 0.15 alpha)

**Last Updated:** January 30, 2026

---

## Executive Summary

**Current State:** Feature-complete multiplayer tank game with critical bugs and amateur code quality
**Goal:** Transform to professional Valorant-level netcode with sub-20ms perceived latency
**Timeline:** 3 weeks (15 days of focused development)
**Constraints:** Render (free tier) + Vercel deployment, no database

## Critical Issues Identified

### 1. Multiplayer Feels Laggy (100ms ping sensation)
**Root Causes:**
- Server tick: 30Hz (33ms baseline delay) - needs 60-128Hz
- Interpolation buffer: 66ms (too conservative) - needs 15-30ms
- No lag compensation for shooting
- No bullet prediction (bullets appear delayed)
- Reconciliation snaps cause rubber-banding
- Unoptimized packets (60-120KB/sec)

### 2. LAN Mode Broken (Race Condition)
**Root Causes:**
- Countdown starts before both players' callbacks registered
- No game start synchronization protocol
- Premature `isReady` flag
- No input queueing (early inputs dropped)
- Missing connection state validation

### 3. Sudden Death Doesn't Work
**Root Cause:** Server activates it but client never renders visual walls (rendering code not hooked up)

### 4. Settings System Completely Broken
**Root Cause:** OptionsMenu calls non-existent methods (`setGameplaySetting()`, etc.) - all UI changes are silent no-ops

### 5. Code Quality Issues
- Game.ts (1,356 lines) and server.ts (1,292 lines) - monolithic god-classes
- 10+ console.log statements in production
- 40+ magic numbers hardcoded
- Type safety issues (`any` types)
- No error handling
- Memory leaks (intervals, sessions not cleaned up)
- O(n²) collision detection on client

---

## Implementation Plan

### PHASE 1: Critical Bug Fixes (Days 1-2) ⚡

#### 1A: Fix LAN Race Condition (SHOW-STOPPER)
**Priority:** CRITICAL
**Complexity:** MODERATE

**Problem Analysis:**
- `src/components/menus/LANLobby.tsx:19-45` - Countdown starts immediately when `isReady && status === 'connected'`
- `src/hooks/useLANMultiplayer.ts:100-104` - Sets `isReady: true` immediately on connection
- BUT parent component hasn't set `onGameStart` callback yet
- Game launches with null/undefined references

**Solution: Implement Explicit Ready Protocol**

1. **Add Ready Handshake to Protocol**
   - File: `src/lib/socket/events.ts`
   - Add new message type: `READY_CONFIRMATION`
   ```typescript
   interface ReadyMessage {
     type: 'ready_confirmation';
     playerId: string;
   }
   ```

2. **Server: Track Ready State**
   - File: `src/lib/socket/localServer.ts`
   - Add `guestReady: boolean` flag
   - Add `onGuestReady()` callback
   - Only broadcast countdown when both ready

3. **Client: Send Ready After Setup**
   - File: `src/lib/socket/localClient.ts`
   - Add `sendReady()` method
   - Add input buffer queue (store inputs until ready)

4. **Hook: Explicit Ready Flow**
   - File: `src/hooks/useLANMultiplayer.ts`
   - Change: Don't set `isReady: true` on connection
   - Add: `readyUp()` function that calls `client.sendReady()`
   - Call `readyUp()` AFTER all callbacks registered

5. **UI: Ready After Callbacks Set**
   - File: `src/components/menus/LANLobby.tsx`
   - Call `readyUp()` in useEffect AFTER onGameStart set
   ```typescript
   useEffect(() => {
     if (state.status === 'connected' && onGameStart) {
       lanNetwork.readyUp(); // Signal ready to host
     }
   }, [state.status, onGameStart]);
   ```

**Files to Modify:**
- `src/lib/socket/events.ts` - Add ready message type
- `src/lib/socket/localServer.ts` - Track guest ready state
- `src/lib/socket/localClient.ts` - Add sendReady() + input queue
- `src/hooks/useLANMultiplayer.ts` - Add readyUp() function
- `src/components/menus/LANLobby.tsx` - Call readyUp() after setup

**Verification:**
1. Start LAN game as host
2. Join as guest from another device
3. Verify countdown only starts when BOTH ready
4. Verify game starts smoothly without null errors
5. Check console for no errors during countdown

---

#### 1B: Fix Sudden Death Rendering (FEATURE BROKEN)
**Priority:** HIGH
**Complexity:** SIMPLE

**Problem Analysis:**
- `src/lib/socket/server.ts:1094-1101` - Server activates sudden death correctly
- `src/engine/core/Game.ts:497-498` - Client receives `suddenDeathActive` state
- `src/engine/core/Game.ts:1188-1203` - Rendering code EXISTS but never called in online mode
- Issue: Draw logic only renders for local sudden death, ignores server state

**Solution: Fix Rendering Logic**

1. **Remove Local-Only Conditional**
   - File: `src/engine/core/Game.ts`
   - Line: ~1188 (in draw method)
   - Current: Only renders if local sudden death check passes
   - Fix: Render based on `this.suddenDeathActive` (respects server state)

   ```typescript
   // BEFORE (local only):
   if (this.settings.suddenDeath && timeElapsed >= suddenDeathTime) {
     this.renderSuddenDeathWalls(...);
   }

   // AFTER (respects server):
   if (this.suddenDeathActive) {
     this.renderSuddenDeathWalls(
       this.ctx,
       this.settings.suddenDeathStartTime,
       this.suddenDeathInset
     );
   }
   ```

2. **Add Visual Notification**
   - Add screen pulse effect when sudden death first activates
   - Add audio cue (existing Howler.js integration)
   - Display "SUDDEN DEATH!" text overlay for 2 seconds

**Files to Modify:**
- `src/engine/core/Game.ts:1188` - Fix rendering conditional
- Add notification callback when `suddenDeathActive` changes

**Verification:**
1. Start online game with sudden death enabled
2. Wait for time limit to expire
3. Verify red walls appear on screen
4. Verify walls shrink progressively
5. Verify tanks take damage when touching walls

---

#### 1C: Fix Settings System (ALL UI BROKEN)
**Priority:** HIGH
**Complexity:** MODERATE

**Problem Analysis:**
- `src/components/menus/OptionsMenu.tsx` calls methods that don't exist:
  - Line 90: `settings.setGameplaySetting()` - DOES NOT EXIST
  - Line 164: `settings.setGraphicsSetting()` - DOES NOT EXIST
  - Lines 248, 292, 330: Similar non-existent methods
- `src/store/useSettingsStore.ts` only has: `updateSetting()`, `updateSettings()`, `resetToDefaults()`
- All slider/toggle changes are silent no-ops

**Solution: Fix UI to Match Store API**

**Mapping Table (UI → Store):**
| UI Property (OptionsMenu) | Actual Key (GameSettings) | Line |
|---------------------------|---------------------------|------|
| `gameplay.chargingEnabled` | `charging` | 89 |
| `gameplay.ammoLimit` | `ammoSystem` (boolean!) | 96 |
| `gameplay.tankSpeed` | NOT IN ENGINE | 109 |
| `gameplay.maxHealth` | `startingHealth` | 116 |
| `graphics.particlesEnabled` | `particleEffects` | 163 |
| `graphics.screenShakeEnabled` | `screenShake` | 173 |
| `graphics.bulletTrails` | `bulletTrails` ✓ | 184 |
| `graphics.colorblindMode` | `colorBlindMode` | 195 |

**Changes Required:**

1. **Replace All Method Calls**
   - File: `src/components/menus/OptionsMenu.tsx`
   - Find: `settings.setGameplaySetting('key', value)`
   - Replace: `settings.updateSetting('actualKey', value)`

   Example:
   ```typescript
   // BEFORE:
   settings.setGameplaySetting('chargingEnabled', value);

   // AFTER:
   settings.updateSetting('charging', value);
   ```

2. **Fix Property Access**
   - BEFORE: `settings.gameplay.chargingEnabled`
   - AFTER: `settings.charging`

3. **Remove Non-Existent Settings**
   - Remove UI for `tankSpeed` (doesn't exist in engine)
   - Document which settings are available

4. **Add Settings Persistence**
   - Settings already use localStorage in store
   - Verify they're loaded on game start
   - File: `src/components/GameCanvas.tsx` - Pass settings from store to Game

**Files to Modify:**
- `src/components/menus/OptionsMenu.tsx` - Fix all method calls (~35 instances)
- Verify settings flow to Game instance

**Verification:**
1. Open Options Menu
2. Change charging enabled → Verify game uses setting
3. Change particle effects → Verify particles appear/disappear
4. Change screen shake → Verify shake works
5. Refresh page → Verify settings persist

---

### PHASE 2: Netcode Transformation (Days 3-7) 🚀

#### 2A: Increase Server Tick Rate (30Hz → 60Hz)
**Priority:** CRITICAL
**Complexity:** SIMPLE

**Current:** 30Hz = 33.3ms per tick
**Target:** 60Hz = 16.7ms per tick (halves baseline latency)

**Implementation:**
1. **Change Tick Rate Constant**
   - File: `src/lib/socket/server.ts:104`
   - Change: `tickRate: 30` → `tickRate: 60`

2. **Adjust Bandwidth (Already Optimized)**
   - Existing delta compression handles bandwidth
   - Monitor CPU usage on Render

3. **Send Tick Rate to Clients**
   - Include in game state broadcast
   - Clients adjust interpolation based on tick rate

**Files to Modify:**
- `src/lib/socket/server.ts:104` - Change tick rate constant
- `src/lib/socket/events.ts` - Add tickRate to GameState
- `src/engine/core/Game.ts` - Receive and use tickRate

**Verification:**
1. Start online game
2. Monitor server logs for tick frequency
3. Measure client interpolation delay
4. Verify feels more responsive than before

---

#### 2B: Reduce Interpolation Delay (66ms → 20-30ms)
**Priority:** CRITICAL
**Complexity:** SIMPLE

**Current:** 66ms buffer (double the tick period)
**Target:** 20-30ms adaptive buffer

**Implementation:**
1. **Reduce Constants**
   - File: `src/engine/core/Game.ts:142-144`
   ```typescript
   // BEFORE:
   private readonly MIN_INTERPOLATION_DELAY = 50;
   private readonly MAX_INTERPOLATION_DELAY = 150;
   private interpolationDelay = 66;

   // AFTER:
   private readonly MIN_INTERPOLATION_DELAY = 15;
   private readonly MAX_INTERPOLATION_DELAY = 50;
   private interpolationDelay = 20; // Start with 1.5 ticks at 60Hz
   ```

2. **Retune Adaptive Algorithm**
   - File: `src/engine/core/Game.ts:730-745`
   - Change target from 3x jitter to 2x tick period
   - Add RTT awareness (increase buffer on high ping)

**Files to Modify:**
- `src/engine/core/Game.ts:142-144` - Reduce delay constants
- `src/engine/core/Game.ts:730-745` - Retune adaptive algorithm

**Verification:**
1. Check interpolation delay in console (temp debug)
2. Verify smooth remote player movement
3. Test with artificial latency (50ms, 100ms)
4. Confirm no jitter or stuttering

---

#### 2C: Implement Lag Compensation (MISSING)
**Priority:** HIGH
**Complexity:** COMPLEX

**Problem:** Shots hit current position, not where player aimed
**Solution:** Server rewinds world state for hit detection

**Implementation:**

1. **Add State History Buffer**
   - File: `src/lib/socket/server.ts`
   - Store last 60 game states (1 second at 60Hz)
   ```typescript
   interface HistoricalState {
     timestamp: number;
     tankPositions: Map<number, {x: number, y: number}>;
   }

   const stateHistory: HistoricalState[] = [];
   const MAX_HISTORY = 60; // 1 second
   ```

2. **Send Timestamp with Bullets**
   - File: `src/lib/socket/events.ts`
   - Add `shootTimestamp` to PlayerInput
   - Client sends local time when shot fired

3. **Rewind Logic**
   - File: `src/lib/socket/server.ts:1024-1060`
   - Find state at (shootTimestamp - playerLatency/2)
   - Check bullet collision against historical positions
   ```typescript
   function checkBulletHitWithCompensation(bullet, targetTank, shootTimestamp, shooterLatency) {
     const rewindTime = shootTimestamp - (shooterLatency / 2);
     const historicalState = stateHistory.find(s => s.timestamp <= rewindTime);

     if (historicalState) {
       const historicalPos = historicalState.tankPositions.get(targetTank.id);
       return checkCollision(bullet, historicalPos);
     }

     // Fallback to current state
     return checkCollision(bullet, targetTank.pos);
   }
   ```

4. **Track Player Latency**
   - Already implemented via ping/pong (server.ts:463-476)
   - Use `player.latency` in hit detection

**Files to Modify:**
- `src/lib/socket/server.ts` - Add state history + rewind logic
- `src/lib/socket/events.ts` - Add shootTimestamp to PlayerInput
- `src/engine/multiplayer/NetworkManager.ts` - Send shoot timestamp

**Verification:**
1. Add 100ms artificial latency
2. Shoot at moving target where they appear
3. Verify hits register correctly (not behind target)
4. Compare before/after hit accuracy

---

#### 2D: Implement Bullet Prediction (MISSING)
**Priority:** MEDIUM
**Complexity:** MODERATE

**Problem:** Bullets only appear when server confirms (33ms+ delay)
**Solution:** Spawn bullets immediately client-side

**Implementation:**

1. **Immediate Bullet Spawn**
   - File: `src/engine/core/Game.ts:906-917`
   - When player shoots, spawn bullet immediately (don't wait for server)
   - Tag bullet as "predicted"
   ```typescript
   if (this.isOnlineMultiplayer && isLocalTank) {
     // Spawn predicted bullet immediately
     const predictedBullet = new Bullet(
       tank.pos.x + Math.cos(tank.angle) * 30,
       tank.pos.y + Math.sin(tank.angle) * 30,
       tank.angle,
       tank.id,
       this.settings
     );
     predictedBullet.isPredicted = true;
     predictedBullet.predictionId = generateId();
     this.bullets.push(predictedBullet);
   }
   ```

2. **Reconcile with Server Bullets**
   - File: `src/engine/core/Game.ts:437-470`
   - When server state arrives with bullet:
     - Find matching predicted bullet (by predictionId)
     - If positions match (within 10px): keep predicted bullet
     - If mismatch: smoothly blend to server position over 100ms
     - If no predicted bullet: spawn server bullet normally

3. **Add Bullet Properties**
   - File: `src/engine/entities/Bullet.ts`
   - Add: `isPredicted: boolean`
   - Add: `predictionId: string`

**Files to Modify:**
- `src/engine/core/Game.ts:906-917` - Immediate spawn logic
- `src/engine/core/Game.ts:437-470` - Reconciliation logic
- `src/engine/entities/Bullet.ts` - Add prediction properties

**Verification:**
1. Fire bullets in online mode
2. Verify bullets appear instantly (no delay)
3. Check bullets match server position (reconcile correctly)
4. Verify no "duplicate bullets" bug

---

#### 2E: Smooth Reconciliation (Eliminate Rubber-Banding)
**Priority:** MEDIUM
**Complexity:** SIMPLE

**Problem:** Position corrections >100px cause instant teleport (snap)
**Solution:** Use tighter thresholds + exponential smoothing

**Implementation:**

1. **Adjust Thresholds**
   - File: `src/engine/core/Game.ts:150-151`
   ```typescript
   // BEFORE:
   private readonly RECONCILIATION_THRESHOLD_SMOOTH = 15;
   private readonly RECONCILIATION_THRESHOLD_SNAP = 100;

   // AFTER:
   private readonly RECONCILIATION_THRESHOLD_SMOOTH = 5;  // pixels
   private readonly RECONCILIATION_THRESHOLD_SNAP = 200;   // only for major desync
   ```

2. **Use Exponential Smoothing**
   - File: `src/engine/core/Game.ts:624`
   ```typescript
   // BEFORE:
   const alpha = 0.8; // Too aggressive

   // AFTER:
   const alpha = 0.15; // Smooth correction over ~7 frames (100ms)
   ```

3. **Add Velocity Blending**
   - Don't snap velocity, blend it smoothly
   - Prevents movement stutters

**Files to Modify:**
- `src/engine/core/Game.ts:150-151` - Adjust thresholds
- `src/engine/core/Game.ts:620-632` - Use exponential smoothing

**Verification:**
1. Add packet loss simulation (drop 10% packets)
2. Move tank rapidly
3. Verify no visible snapping/teleportation
4. Corrections should be imperceptible

---

#### 2F: Optimize Packet Size (OPTIONAL)
**Priority:** LOW
**Complexity:** MODERATE

**Current:** 60-120KB/sec with delta compression
**Target:** 20-40KB/sec with aggressive optimization

**Implementation:**
1. Skip unchanged entities entirely (not just deltas)
2. Binary encoding for positions (Float32 instead of JSON)
3. Quantize positions to 0.1 pixel precision

**Files to Modify:**
- `src/lib/socket/server.ts:769-856` - More aggressive delta compression

**Skip if:** Render bandwidth is sufficient at 60Hz

---

### PHASE 3: Architecture Refactor (Days 8-10) 🏗️

#### 3A: Split Monolithic Game.ts (1,356 Lines → Modular)
**Priority:** MEDIUM
**Complexity:** COMPLEX (HIGH RISK)

**Strategy: Incremental Extraction**

**Target Structure:**
```
src/engine/
  systems/
    PhysicsSystem.ts        - Collision detection (lines 874-1134)
    RenderSystem.ts         - Canvas drawing (lines 1136-1230)
    NetworkSystem.ts        - Prediction, reconciliation (lines 355-873)
    EntitySystem.ts         - Entity lifecycle (lines 231-354)
    GameRulesSystem.ts      - Win conditions (lines 1016-1052)
  core/
    Game.ts                 - Orchestrator only (< 300 lines)
```

**Extraction Order:**
1. **GameRulesSystem** (safest, least dependencies)
2. **RenderSystem** (isolated, pure functions)
3. **EntitySystem** (moderate coupling)
4. **PhysicsSystem** (moderate coupling)
5. **NetworkSystem** (highest coupling, do last)

**Process for Each System:**
1. Create new file with system class
2. Copy methods from Game.ts
3. Update references in Game.ts
4. Test thoroughly before next extraction
5. Keep old code commented until verified

**Risk Mitigation:**
- Do ONE system at a time (not all at once)
- Test after each extraction
- Use feature flag to switch between old/new
- Keep full Git history for rollback

**Files to Create:**
- `src/engine/systems/GameRulesSystem.ts`
- `src/engine/systems/RenderSystem.ts`
- `src/engine/systems/EntitySystem.ts`
- `src/engine/systems/PhysicsSystem.ts`
- `src/engine/systems/NetworkSystem.ts`

**Files to Modify:**
- `src/engine/core/Game.ts` - Reduce to orchestration

**Verification After Each Extraction:**
1. Run local game (AI mode)
2. Run LAN game
3. Run online game
4. Verify no regressions

**TIME ESTIMATE:** 2-3 days (careful, incremental work)

---

#### 3B: Split Monolithic server.ts (1,292 Lines → Modular)
**Priority:** MEDIUM
**Complexity:** COMPLEX

**Target Structure:**
```
src/lib/socket/
  services/
    SessionService.ts       - Session CRUD (lines 92-212)
    GameTickService.ts      - Physics simulation (lines 883-1205)
    SerializationService.ts - State packing (lines 584-654)
    NetworkService.ts       - Socket events (lines 225-457)
  server.ts                 - Initialization only (< 200 lines)
```

**Extraction Order:**
1. SerializationService (pure functions)
2. SessionService (data structure)
3. NetworkService (socket handlers)
4. GameTickService (complex logic)

**Files to Create:**
- `src/lib/socket/services/SessionService.ts`
- `src/lib/socket/services/GameTickService.ts`
- `src/lib/socket/services/SerializationService.ts`
- `src/lib/socket/services/NetworkService.ts`

**Verification:**
- Same as 3A (test all game modes after each extraction)

**TIME ESTIMATE:** 2-3 days

---

#### 3C: Extract Magic Numbers to Constants
**Priority:** LOW
**Complexity:** SIMPLE

**Implementation:**
1. Create `src/engine/utils/NetworkConstants.ts`
   - All interpolation/prediction values
   - Tick rates, buffer sizes

2. Create `src/engine/utils/PhysicsConstants.ts`
   - Collision radii
   - Movement speeds
   - Damage values

3. Replace all hardcoded numbers with named constants

**Files to Create:**
- `src/engine/utils/NetworkConstants.ts`
- `src/engine/utils/PhysicsConstants.ts`

**TIME ESTIMATE:** 0.5 day (tedious but straightforward)

---

### PHASE 4: Production Quality (Days 11-13) 💎

#### 4A: Remove Debug Code
**Priority:** HIGH
**Complexity:** SIMPLE

**Implementation:**

1. **Create Logger System**
   - File: `src/lib/logging/Logger.ts`
   ```typescript
   class Logger {
     static debug(msg: string, ...args: any[]) {
       if (process.env.NODE_ENV === 'development') {
         console.log(`[DEBUG] ${msg}`, ...args);
       }
     }

     static error(msg: string, ...args: any[]) {
       console.error(`[ERROR] ${msg}`, ...args);
       // TODO: Send to error tracking service
     }
   }
   ```

2. **Replace Console Statements**
   - Find: `console.log(`
   - Replace: `Logger.debug(`
   - Files with console.log (10 statements):
     - `src/engine/core/Game.ts:598,622,1330`
     - `src/lib/socket/server.ts:227,254,268,358,393,441,454`

**Files to Create:**
- `src/lib/logging/Logger.ts`

**Files to Modify:**
- All files with console.log statements

**Verification:**
- Production build has no console output
- Development mode shows logs

**TIME ESTIMATE:** 0.5 day

---

#### 4B: Add Error Handling
**Priority:** HIGH
**Complexity:** MODERATE

**Critical Areas:**

1. **Network Errors**
   - File: `src/engine/multiplayer/NetworkManager.ts`
   - Add try-catch around socket operations
   - Add reconnection logic (3 retries with exponential backoff)
   - Show user-friendly error messages

2. **Null Safety**
   - Add null checks before entity access
   - File: `src/engine/core/Game.ts:576-577,751-753`

3. **Graceful Degradation**
   - If server drops, fall back to local physics
   - If connection unstable, increase interpolation buffer

**Files to Modify:**
- `src/engine/multiplayer/NetworkManager.ts` - Add reconnection
- `src/lib/socket/server.ts` - Add error recovery
- `src/components/menus/*.tsx` - Show error states

**TIME ESTIMATE:** 1 day

---

#### 4C: Fix Memory Leaks
**Priority:** MEDIUM
**Complexity:** SIMPLE

**Identified Leaks:**

1. **Server Intervals**
   - File: `src/lib/socket/server.ts`
   - Ensure all intervals cleared on session end
   - Add session TTL enforcement (line 198)

2. **Game Instance Cleanup**
   - File: `src/engine/core/Game.ts:1317-1321`
   - Add comprehensive cleanup:
     - Clear bullets array
     - Clear particles array
     - Clear walls/crates
     - Unregister event listeners

3. **Bounded Arrays**
   - Prediction history already bounded (line 139)
   - Verify input buffer bounded (line 378)

**Files to Modify:**
- `src/lib/socket/server.ts:198-211` - Enforce cleanup
- `src/engine/core/Game.ts:1317-1321` - Complete destroy()

**TIME ESTIMATE:** 0.5 day

---

#### 4D: Optimize Client Collision (O(n²) → O(n log n))
**Priority:** MEDIUM
**Complexity:** SIMPLE

**Problem:** Nested loops for bullet-tank collision
**Solution:** Use existing SpatialGrid (already used server-side)

**Implementation:**
- File: `src/engine/core/Game.ts:1084-1125`
- Add spatial grid for bullets (rebuild each frame)
- Query grid instead of checking all bullets

**Files to Modify:**
- `src/engine/core/Game.ts:1084-1125` - Use spatial grid

**TIME ESTIMATE:** 0.5 day

---

### PHASE 5: Security & Monitoring (Days 14-15) 🔒

#### 5A: Input Validation & Anti-Cheat
**Priority:** MEDIUM
**Complexity:** MODERATE

**Implementation:**

1. **Validate Input Ranges**
   - File: `src/lib/socket/server.ts:367-384`
   - Check movement speed (max 1.0)
   - Check shoot cooldown (min time between shots)
   - Reject impossible positions

2. **Rate Limiting**
   - Max 60 inputs/second per player
   - Kick players exceeding limit

**Files to Modify:**
- `src/lib/socket/server.ts:367-384` - Add validation

**TIME ESTIMATE:** 0.5 day

---

#### 5B: Performance Monitoring (OPTIONAL)
**Priority:** LOW
**Complexity:** SIMPLE

**Implementation:**
- Create PerformanceMonitor class
- Track FPS, RTT, packet loss
- HUD overlay in dev mode

**Files to Create:**
- `src/engine/utils/PerformanceMonitor.ts`

**TIME ESTIMATE:** 0.5 day (optional)

---

## Critical Files Summary

**Top 5 Files to Modify:**

1. **`src/engine/core/Game.ts`** (1,356 lines)
   - Sudden death rendering fix (line 1188)
   - Interpolation delays (lines 142-144)
   - Reconciliation smoothing (lines 596-624)
   - Bullet prediction (lines 906-917)
   - System extraction (Phase 3A)

2. **`src/lib/socket/server.ts`** (1,292 lines)
   - Tick rate increase (line 104)
   - Lag compensation (lines 1024-1060)
   - State history buffer
   - Service extraction (Phase 3B)

3. **`src/hooks/useLANMultiplayer.ts`** (228 lines)
   - Fix race condition (lines 98-104)
   - Add explicit ready protocol
   - Input queueing

4. **`src/components/menus/OptionsMenu.tsx`** (453 lines)
   - Fix all method calls (lines 89-369)
   - Map UI to actual settings
   - ~35 method call fixes

5. **`src/store/useSettingsStore.ts`** (382 lines)
   - Verify settings persistence
   - Document correct API usage

---

## Verification & Testing Protocol

**CRITICAL: After EVERY phase, run the full audit checklist below to ensure no regressions or new bugs introduced.**

### PHASE 1 AUDIT: Critical Bug Fixes
**Run after completing 1A, 1B, and 1C**

#### Regression Tests (No New Bugs):
- [ ] **Local 2-player mode** - Both tanks controllable, game works end-to-end
- [ ] **AI mode** - AI opponent moves, shoots, takes damage correctly
- [ ] **Existing online multiplayer** - Still connects, game playable
- [ ] **Main menu navigation** - All buttons work, no crashes
- [ ] **Game over screen** - Displays correctly, rematch works
- [ ] **PowerUps** - Still spawn, apply effects correctly
- [ ] **Bullet collisions** - Bullets still hit tanks and walls
- [ ] **Canvas rendering** - No visual glitches introduced

#### New Feature Verification:
- [ ] **LAN mode connects successfully** - No race condition
- [ ] **Countdown synchronizes** - Both players see same countdown
- [ ] **Game starts cleanly** - No null reference errors in console
- [ ] **Sudden death walls appear** - Red walls render and shrink
- [ ] **Sudden death damage** - Tanks take damage from walls
- [ ] **Settings UI responds** - Sliders/toggles update values
- [ ] **Settings apply to game** - Changed settings affect gameplay
- [ ] **Settings persist** - Refresh page, settings still applied

#### Performance Check:
- [ ] Client FPS: 60fps stable (no drops below 55fps)
- [ ] Memory usage: No growth over 5 minutes of gameplay
- [ ] Console errors: Zero errors during normal gameplay

#### Audit Commands:
```bash
# Check for console.log statements introduced
grep -r "console.log" src/components src/engine src/lib --include="*.ts" --include="*.tsx"

# Verify no TypeScript errors
npm run build

# Check bundle size (should not increase significantly)
npm run build && ls -lh .next/static/chunks
```

---

### PHASE 2 AUDIT: Netcode Transformation
**Run after completing 2A through 2F**

#### Regression Tests (Everything from Phase 1 still works):
- [ ] Re-run all Phase 1 tests (local, AI, LAN, online, sudden death, settings)
- [ ] Verify no visual glitches introduced by netcode changes
- [ ] Confirm game rules unchanged (score limits, win conditions)
- [ ] Check powerups still work correctly

#### Netcode Verification:
- [ ] **Server tick rate** - Verify 60Hz (log actual tick times)
- [ ] **Interpolation delay** - Measure actual delay (should be 20-30ms)
- [ ] **Lag compensation** - Shots hit where aimed (test at 80ms ping)
- [ ] **Bullet prediction** - Bullets appear instantly, no delay
- [ ] **Smooth reconciliation** - No rubber-banding visible
- [ ] **Packet optimization** - Bandwidth reduced (measure KB/sec)

#### Latency Testing Matrix:
Test all scenarios with artificial latency:

| Latency | Jitter | Packet Loss | Expected Feel | Pass/Fail |
|---------|--------|-------------|---------------|-----------|
| 0ms     | 0ms    | 0%          | Instant       | [ ]       |
| 30ms    | ±5ms   | 0%          | Smooth        | [ ]       |
| 60ms    | ±10ms  | 1%          | Playable      | [ ]       |
| 100ms   | ±20ms  | 3%          | Noticeable    | [ ]       |
| 150ms   | ±30ms  | 5%          | Sluggish      | [ ]       |

Tools: Chrome DevTools Network throttling, `tc` on Linux, Network Link Conditioner on macOS

#### Performance Benchmarks:
- [ ] Client FPS: 60fps stable at 0ms, 100ms latency
- [ ] Server CPU: <50% on Render free tier with 2 concurrent games
- [ ] Memory: No leaks over 10 minutes of continuous play
- [ ] Bandwidth: <40KB/sec per player at 60Hz

#### Audit Commands:
```bash
# Monitor server tick rate
# Add temporary logging in server.ts tick function
# Expected: 60 ticks/second ± 2

# Measure client interpolation delay
# Add temporary logging in Game.ts
# Expected: 20-30ms adaptive

# Check packet size
# Use browser DevTools Network tab
# Expected: 200-600 bytes per packet at 60Hz
```

---

### PHASE 3 AUDIT: Architecture Refactor
**Run after EACH system extraction (5 separate audits)**

#### After Each System Extraction:
**Test immediately after extracting each system (don't wait until all 5 done):**

1. **After GameRulesSystem extraction:**
   - [ ] Win conditions work (score limit, time limit)
   - [ ] Sudden death triggers correctly
   - [ ] Game over screen appears correctly

2. **After RenderSystem extraction:**
   - [ ] All entities render (tanks, bullets, walls, powerups)
   - [ ] Sudden death walls render
   - [ ] HUD displays correctly
   - [ ] No visual glitches

3. **After EntitySystem extraction:**
   - [ ] Entities spawn/despawn correctly
   - [ ] Powerups appear and can be collected
   - [ ] Bullets fire and travel correctly

4. **After PhysicsSystem extraction:**
   - [ ] Collision detection works (bullets hit tanks)
   - [ ] Wall collisions work
   - [ ] Movement physics unchanged

5. **After NetworkSystem extraction:**
   - [ ] Online multiplayer still works
   - [ ] Prediction/reconciliation unchanged
   - [ ] LAN mode still works

#### Comprehensive Regression Test (After ALL extractions):
- [ ] **Every game mode works**: Local, AI, LAN, Online
- [ ] **All Phase 1 features work**: Settings, sudden death, LAN sync
- [ ] **All Phase 2 features work**: 60Hz tick, lag comp, prediction
- [ ] **No performance degradation**: Still 60fps, same bandwidth
- [ ] **Code quality improved**: Files <500 lines each
- [ ] **TypeScript compiles**: No new errors introduced

#### Code Quality Audit:
```bash
# Count lines per file (should be <500)
find src/engine/systems -name "*.ts" -exec wc -l {} \;

# Verify no circular dependencies
npm run build

# Check for broken imports
grep -r "from.*Game" src/engine/systems

# Verify all game modes still work
npm run build && npm run start
```

---

### PHASE 4 AUDIT: Production Quality
**Run after completing 4A through 4D**

#### Regression Tests:
- [ ] Re-run all Phase 1, 2, 3 tests
- [ ] Verify error handling doesn't break happy path
- [ ] Confirm performance unchanged by logging/error handling

#### Production Readiness Checks:
- [ ] **No console.log in build** - Production bundle has zero console statements
- [ ] **All errors caught** - Try breaking things intentionally:
  - [ ] Disconnect internet mid-game → Graceful error
  - [ ] Close server → Client shows error message
  - [ ] Invalid room code → Clear error message
  - [ ] WebRTC fails → Fallback or clear message
- [ ] **Memory leak test** - Run game for 30 minutes:
  - [ ] Client memory stable (<200MB)
  - [ ] Server memory stable (<300MB per session)
  - [ ] No interval leaks (check with `setInterval` count)
- [ ] **Performance optimized**:
  - [ ] Collision detection using spatial grid
  - [ ] 60fps stable with 100 bullets on screen
  - [ ] No frame drops during intense gameplay

#### Error Handling Stress Tests:
- [ ] Kill server mid-game → Client recovers or shows error
- [ ] Rapid connect/disconnect 10 times → No crashes
- [ ] Invalid input values → Rejected gracefully
- [ ] Malformed network packets → Handled safely

#### Audit Commands:
```bash
# Production build check
npm run build
grep -r "console.log" .next/static/chunks || echo "✓ No console.log found"

# Memory leak check (run game for 30 min, check memory)
# Chrome DevTools: Memory Profiler → Take snapshot before/after

# Check for uncleared intervals
# In browser console during game:
# window.setInterval.length should not grow over time
```

---

### PHASE 5 AUDIT: Security & Monitoring
**Run after completing 5A and 5B**

#### Regression Tests:
- [ ] Re-run all previous phase tests
- [ ] Verify input validation doesn't break normal gameplay

#### Security Verification:
- [ ] **Input validation** - Try to cheat:
  - [ ] Send impossible movement speed → Rejected
  - [ ] Send shoot input faster than cooldown → Rate limited
  - [ ] Send position outside map bounds → Rejected or clamped
  - [ ] Send negative health values → Rejected
- [ ] **Rate limiting** - Spam inputs:
  - [ ] 100 inputs/second → Player warned or kicked
  - [ ] Normal 60 inputs/second → Works fine
- [ ] **No exploits**:
  - [ ] Can't shoot through walls by faking position
  - [ ] Can't teleport by sending large position changes
  - [ ] Can't give self infinite ammo

#### Monitoring Verification (if implemented):
- [ ] Performance metrics display correctly
- [ ] FPS counter accurate
- [ ] Latency display matches actual RTT
- [ ] Packet loss calculation correct

#### Penetration Testing:
```bash
# Test input validation (send invalid data)
# Use browser console or curl to send malformed packets

# Test rate limiting
# Send 200 inputs in 1 second, verify rejection

# Test SQL injection (if using database)
# N/A for this project (no database)
```

---

## FINAL PRE-DEPLOYMENT AUDIT

**Before deploying to production, run this comprehensive checklist:**

### Functional Testing (30 minutes):
- [ ] **Local mode** - Play full game, 5 kills, verify winner
- [ ] **AI mode (Easy)** - Defeat AI, verify AI shoots back
- [ ] **AI mode (Hard)** - AI is challenging, uses strategy
- [ ] **LAN mode** - Connect 2 devices, play full game
- [ ] **Online mode** - Connect from 2 locations, play full game
- [ ] **Settings** - Change all settings, verify they apply
- [ ] **Sudden death** - Let timer expire, walls appear
- [ ] **All powerups** - Collect health, ammo, speed, shield, rapid fire, shotgun, laser
- [ ] **All map features** - Walls block, crates break, hazards damage

### Performance Testing (10 minutes):
- [ ] **60fps sustained** - 5 minutes of continuous gameplay
- [ ] **No memory leaks** - Memory stable over 10 minutes
- [ ] **Network stable** - No disconnects during normal gameplay
- [ ] **Fast loading** - Game loads in <3 seconds

### Code Quality (5 minutes):
- [ ] **TypeScript compiles** - `npm run build` succeeds
- [ ] **No linter errors** - `npm run lint` passes
- [ ] **No console.log** - Production bundle clean
- [ ] **Bundle size reasonable** - <500KB gzipped

### Browser Compatibility (15 minutes):
Test in:
- [ ] Chrome/Edge (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Mobile Safari (iOS)
- [ ] Mobile Chrome (Android)

### Network Conditions (20 minutes):
Test online mode with:
- [ ] Good connection (30ms, 0% loss) - Smooth
- [ ] Poor connection (100ms, 3% loss) - Playable
- [ ] Terrible connection (200ms, 10% loss) - Degraded but stable
- [ ] Connection drop mid-game - Error shown or reconnects

### Total Audit Time: ~90 minutes

---

## Regression Prevention

**After ANY code change, run these quick smoke tests:**

### 5-Minute Smoke Test:
```bash
# 1. Compile check (30 sec)
npm run build

# 2. Start game (30 sec)
npm run start

# 3. Play local mode (2 min)
# - Both tanks move and shoot
# - Bullets hit and deal damage
# - Game ends at 5 kills

# 4. Check console (1 min)
# - Zero errors during gameplay
# - No warnings (except expected React ones)

# 5. Test one game mode (1 min)
# - If you changed netcode → test online mode
# - If you changed LAN → test LAN mode
# - If you changed settings → test settings menu
```

### When to Run Full Audit:
- After completing any phase
- Before merging to main branch
- Before deploying to production
- After fixing a bug (verify no new bugs introduced)
- Weekly during active development

---

## Bug Tracking Template

**If ANY audit fails, document the issue:**

```markdown
## Bug Report: [Short Description]

**Introduced in:** Phase X, Task Y
**Severity:** Critical / High / Medium / Low
**Affects:** Local / AI / LAN / Online / All modes

**Steps to Reproduce:**
1.
2.
3.

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Error Messages:**
[Console errors, if any]

**Fix Required:**
[What needs to change]

**Regression Test:**
[How to verify the fix]
```

---

This audit protocol ensures that every phase is verified before moving forward, preventing the accumulation of technical debt and hidden bugs.

---

## Success Metrics

### Before (Current State) ❌
- Multiplayer latency feel: ~100ms
- Server tick: 30Hz (33ms)
- Interpolation delay: 66ms
- Rubber-banding: Visible snaps
- Packet size: 60-120KB/sec
- **LAN mode: BROKEN**
- **Sudden death: BROKEN**
- **Settings UI: ALL CHANGES IGNORED**
- Code: 2,648 lines in 2 god-classes
- Debug code: 10+ console.logs

### After (Valorant-Level) ✅
- Multiplayer latency feel: **<20ms** (perceived)
- Server tick: **60Hz** (16.7ms)
- Interpolation delay: **20-30ms** (adaptive)
- Rubber-banding: **Imperceptible** (<5px smooth)
- Packet size: **20-40KB/sec** (optimized)
- **LAN mode: <5ms latency, zero interpolation**
- **Sudden death: WORKING with visual feedback**
- **Settings UI: ALL CHANGES APPLIED**
- Code: Modular systems, <300 lines per file
- Debug code: **Zero** (structured logging only)

---

## Risk Assessment

### High-Risk Changes
1. **Architecture Refactor (Phase 3)** - Could break functionality
   - Mitigation: Incremental extraction, test after each step
   - Rollback: Keep old code until verified

2. **Lag Compensation (Phase 2C)** - Complex state management
   - Mitigation: Feature flag, extensive testing
   - Rollback: Disable via config

3. **Tick Rate Increase (Phase 2A)** - May overload Render free tier
   - Mitigation: Monitor CPU, adaptive scaling
   - Rollback: Revert to 30Hz if needed

### Medium-Risk Changes
- Bullet prediction (Phase 2D) - May cause duplicate bullets
- Settings system rewrite (Phase 1C) - Many UI changes

### Low-Risk Changes
- Sudden death fix (Phase 1B) - Isolated change
- Interpolation tuning (Phase 2B) - Just constants
- Debug code removal (Phase 4A) - No logic changes

---

## Execution Timeline

**Week 1: Critical Fixes + Core Netcode**
- Days 1-2: Phase 1 (Fix LAN, sudden death, settings)
- Days 3-5: Phase 2A-2C (Tick rate, interpolation, lag comp)

**Week 2: Advanced Netcode + Architecture Start**
- Days 6-7: Phase 2D-2F (Bullet prediction, smoothing)
- Days 8-10: Phase 3 (Begin architecture refactor)

**Week 3: Architecture Complete + Polish**
- Days 11-12: Phase 3 (Complete refactor) + Phase 4
- Days 13-15: Phase 4-5 (Polish, security, testing)

**Total: 15 days of focused development**

---

## Final Notes

This plan addresses every identified issue systematically:
- **Fixes all critical bugs** (LAN, sudden death, settings)
- **Achieves Valorant-level netcode** (sub-20ms latency feel)
- **Transforms architecture** (maintainable, professional)
- **Adds production polish** (error handling, monitoring, security)

The phased approach allows for:
- Early wins (critical bugs fixed first)
- Iterative testing (verify after each phase)
- Risk mitigation (incremental changes, rollback points)
- Clear success metrics (before/after comparison)

The game will go from "ambitious prototype" to "production-ready professional multiplayer experience" that Riot Games would approve of.
