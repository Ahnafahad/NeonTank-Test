# Neon Tank Duel - Complete Documentation

## Project Overview

**Neon Tank Duel** is a multiplayer tank battle game built with Next.js and Socket.IO. It features real-time multiplayer combat, AI opponents, customizable game settings, and a modern neon-themed visual style.

### Key Highlights
- Real-time multiplayer with WebSocket connections (Socket.IO)
- Advanced AI opponents with pathfinding and aiming systems
- Rich game mechanics: charging shots, ammo system, power-ups, hazards, bullet ricochets
- Extensive customization: 30+ game settings including visual effects, gameplay mods, and accessibility options
- Mobile-friendly with touch controls (joystick + shoot button)
- Client-side prediction and server reconciliation for smooth online gameplay
- Matchmaking system for online battles
- Multiple map variants and weather effects

---

## Tech Stack

### Frontend
- **Next.js 16** (App Router)
- **React 19**
- **TypeScript 5**
- **Tailwind CSS 4**
- **Framer Motion** - Animations
- **Zustand** - State management
- **Howler.js** - Audio engine

### Backend
- **Socket.IO 4** - Real-time bidirectional communication
- **Node.js HTTP Server**
- **Redis Adapter** - For Socket.IO horizontal scaling (optional)

### Development Tools
- **ESLint** - Linting
- **tsx** - TypeScript execution
- **PostCSS** - CSS processing

---

## Architecture

### Project Structure

```
neon-tank-duel/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   │   ├── matchmaking/   # Matchmaking endpoints
│   │   │   └── socket/        # Socket.IO route handler
│   │   ├── test/              # Test page
│   │   ├── layout.tsx         # Root layout
│   │   ├── page.tsx           # Home page
│   │   └── globals.css        # Global styles
│   │
│   ├── components/            # React components
│   │   ├── GameCanvas.tsx     # Main canvas component
│   │   ├── hud/               # HUD components (health, score, timer)
│   │   ├── menus/             # Menu screens (main, options, game over, matchmaking)
│   │   ├── mobile/            # Mobile controls (joystick, shoot button)
│   │   └── ui/                # Reusable UI components (button, modal, slider, toggle)
│   │
│   ├── engine/                # Game engine (pure TypeScript, no React)
│   │   ├── core/              # Core game loop and input handling
│   │   │   ├── Game.ts        # Main game orchestrator
│   │   │   └── InputManager.ts # Keyboard/touch input handling
│   │   ├── entities/          # Game entities (tanks, bullets, power-ups, walls, hazards)
│   │   ├── ai/                # AI system
│   │   │   ├── TankAI.ts      # AI controller
│   │   │   └── behaviors/     # AI behaviors (pathfinding, aiming)
│   │   ├── map/               # Map generation and presets
│   │   ├── multiplayer/       # Network manager for online play
│   │   └── utils/             # Utilities (constants, vector math)
│   │
│   ├── hooks/                 # React hooks
│   │   ├── useMultiplayer.ts  # Multiplayer logic hook
│   │   └── useResponsiveCanvas.ts # Canvas sizing
│   │
│   ├── lib/                   # Libraries
│   │   └── socket/            # Socket.IO setup
│   │       ├── server.ts      # Server-side socket handler
│   │       ├── events.ts      # Event type definitions
│   │       └── index.ts       # Client-side socket connection
│   │
│   ├── store/                 # Zustand stores
│   │   ├── useGameStore.ts    # Game state
│   │   ├── useMultiplayerStore.ts # Multiplayer state
│   │   └── useSettingsStore.ts # Settings state
│   │
│   └── types/                 # TypeScript type definitions
│       ├── game.ts            # Game types
│       └── settings.ts        # Settings types
│
├── server.ts                  # Combined Next.js + Socket.IO server
├── socket-entry.ts            # Standalone Socket.IO server (for Render deployment)
├── package.json
├── tsconfig.json
└── DEPLOYMENT.md             # Deployment guide (Vercel + Render)
```

---

## Game Modes

### 1. Local Multiplayer
- Two players on the same device
- Player 1: WASD controls
- Player 2: Arrow keys
- Instant startup, no network latency

### 2. AI Battle
- Play against computer-controlled opponent
- AI difficulty levels: Easy, Medium, Hard, Expert
- AI features:
  - A* pathfinding for navigation
  - Predictive aiming system
  - Dynamic behavior based on health and ammo
  - Cover-seeking when low on health
  - Strategic power-up collection

### 3. Online Battle (Multiplayer)
- Real-time networked gameplay via Socket.IO
- Matchmaking system with room codes
- Shareable invite links
- Client-side prediction for smooth movement
- Server reconciliation to prevent cheating
- Interpolation for remote player rendering

---

## Core Game Features

### Combat Mechanics
- **Charging System**: Hold to charge shots for increased damage and speed
- **Ammo System**: Limited ammo with reload mechanic
- **Bullet Ricochet**: Bullets bounce off walls (configurable bounce count)
- **Recoil**: Tanks are pushed back when firing
- **Friendly Fire**: Optional self-damage

### Map Elements
- **Walls**: Indestructible obstacles
- **Crates**: Destructible cover (blocks bullets, can be destroyed)
- **Hazards**: Radiation zones that damage tanks over time
- **Power-Ups**: Spawn periodically with various effects:
  - Health: Restore 30 HP
  - Ammo: Instant reload
  - Speed: Temporary movement boost
  - Shield: Temporary damage reduction
  - Rapid Fire: Increased fire rate

### Map Variants
- **Classic**: Balanced mix of walls and open space
- **Maze**: Dense corridor-based layout
- **Open**: Minimal cover, open combat
- **Fortress**: Symmetrical defensive structures
- **Random**: Procedurally generated each round

### Weather Effects
- **Rain**: Particle effect
- **Snow**: Falling snow particles
- **Fog**: Reduced visibility
- **None**: Clear weather

### Victory Conditions
- **Score Limit**: First to X kills wins (default: 5)
- **Time Limit**: Highest score when time expires
- **Sudden Death**: Hazards expand, shrinking safe zone

---

## Game Settings (30+ Customizable Options)

### Visual Effects
- Bullet Trails (with adjustable length)
- Screen Shake (with intensity control)
- Weather (rain, snow, fog)
- Particle Density (10-200%)
- Damage Numbers (floating damage text)
- Particle Effects toggle

### Gameplay Modifications
- Friendly Fire
- Game Speed (0.5x - 2.0x)
- Unlimited Ammo
- Low Gravity (bullet arcs)
- Max Bounces (0-5)
- Starting Health (50-200 HP)
- Charging System toggle
- Ammo System toggle
- Bullet Ricochet toggle
- Recoil toggle

### Map & Gameplay
- Map Variant selection
- Power-Up Spawn Rate (1-20 seconds)
- Time Limit (30-300 seconds)
- Score Limit (1-10 rounds)
- Power-Ups toggle
- Destructible Crates toggle
- Hazards toggle
- Sudden Death toggle

### Audio
- Sound Effects toggle
- Music toggle
- Music Volume (0-100%)
- SFX Volume (0-100%)

### Accessibility
- Colorblind Modes (deuteranopia, protanopia, tritanopia)
- Minimap (top-down mini view)
- Killcam (slow-mo on death)

---

## Networking Architecture

### Client-Side Prediction
The game implements client-side prediction to provide responsive controls in online mode:

1. **Input Processing**: Client immediately applies player input
2. **State Storage**: Client stores predicted states with sequence numbers
3. **Server Update**: Server receives input and sends authoritative state
4. **Reconciliation**: Client compares server state with predictions and corrects if needed

### Server Authority
- Server is the source of truth for all game state
- Physics calculations run on server
- Collision detection on server
- Bullet trajectories calculated server-side

### Interpolation
Remote players are rendered using interpolation between buffered server states for smooth movement:
- Server sends state snapshots at regular intervals
- Client buffers states and interpolates between them
- Reduces visual jitter from network irregularity

### Latency Compensation
- Input timestamp tracking
- Server processes inputs at their original timestamp
- Rewind-and-replay for hit detection (if needed)

---

## AI System

### Architecture
The AI system (`src/engine/ai/TankAI.ts`) uses a behavior-based approach:

**Decision Tree**:
1. Check if low health → Seek cover and health power-ups
2. Check if low ammo → Seek ammo power-ups
3. Check if power-up nearby → Navigate to power-up
4. Default → Engage enemy

### AI Behaviors

#### Pathfinding (`src/engine/ai/behaviors/PathFinding.ts`)
- A* algorithm implementation
- Grid-based navigation
- Dynamic obstacle avoidance
- Cost calculation includes:
  - Distance to goal
  - Obstacle penalties
  - Hazard avoidance

#### Aiming System (`src/engine/ai/behaviors/AimingSystem.ts`)
- Predictive targeting
- Calculates enemy future position based on velocity
- Bullet flight time estimation
- Accuracy scales with difficulty:
  - Easy: 50% accuracy, slow reaction
  - Medium: 70% accuracy, moderate reaction
  - Hard: 90% accuracy, fast reaction
  - Expert: 95% accuracy, instant reaction

#### Tactical Behaviors
- **Cover Seeking**: When health < 30%, AI seeks nearest wall for cover
- **Power-Up Priority**: Low ammo/health increases power-up seeking weight
- **Evasive Maneuvers**: Strafing and dodging when under fire
- **Charging**: Higher difficulty AI charges shots more frequently

---

## Key Components

### GameCanvas (`src/components/GameCanvas.tsx`)
Main game container that orchestrates the game engine and React state:
- Creates and manages Game instance
- Handles canvas sizing
- Bridges engine state to React components
- Manages game lifecycle (start, pause, end)

### Game Engine (`src/engine/core/Game.ts`)
Core game loop and entity management:
- Runs at 60 FPS
- Updates all entities (tanks, bullets, power-ups, hazards)
- Collision detection
- Physics simulation
- Rendering
- Input processing via InputManager

### NetworkManager (`src/engine/multiplayer/NetworkManager.ts`)
Handles all multiplayer networking:
- Socket.IO client connection
- Event emission and handling
- Client-side prediction
- Server state reconciliation
- Input buffering and replay

### InputManager (`src/engine/core/InputManager.ts`)
Unified input handling:
- Keyboard events (WASD, Arrow keys)
- Touch events (for mobile controls)
- Control scheme mapping
- Input state queries (isKeyPressed, etc.)

### Socket Server (`src/lib/socket/server.ts`)
Server-side game logic:
- Room management
- Player matchmaking
- Game state broadcast
- Input processing
- Collision and physics (authoritative)

---

## Development Setup

### Prerequisites
- Node.js 20+
- npm or pnpm

### Installation

```bash
# Clone repository
git clone <repository-url>
cd neon-tank-duel

# Install dependencies
npm install
```

### Running Locally

#### Option 1: Next.js Development Server (Frontend Only)
```bash
npm run dev
```
Opens at `http://localhost:3000`
- AI and Local modes work
- Online mode will NOT work (needs Socket.IO server)

#### Option 2: Combined Server (Recommended for Development)
```bash
npm run start:socket
```
Runs both Next.js and Socket.IO server together on port 3000.
- All game modes work
- WebSockets enabled

#### Option 3: Separate Servers (for testing deployment setup)
Terminal 1 (Frontend):
```bash
npm run dev
```

Terminal 2 (Socket Server):
```bash
npm run start:socket-only
```

Set `NEXT_PUBLIC_SOCKET_URL=http://localhost:3001` in `.env.local`

### Build for Production
```bash
npm run build
npm start
```

---

## Deployment

The game uses a **hybrid architecture** for free deployment:

### Architecture
- **Frontend (Next.js)**: Deployed on **Vercel** (Free Hobby Tier)
- **Backend (Socket.IO)**: Deployed on **Render** (Free Web Service)

### Step 1: Deploy Socket Server to Render
1. Create Web Service on Render
2. Connect GitHub repository
3. Configuration:
   - **Build Command**: `npm install`
   - **Start Command**: `npm run start:socket-only`
   - **Environment Variable**: `NEXT_PUBLIC_APP_URL` (set to Vercel URL or `*`)
4. Copy deployed URL (e.g., `https://neontank-socket.onrender.com`)

### Step 2: Deploy Frontend to Vercel
1. Import project from GitHub
2. Framework: Next.js (auto-detected)
3. Environment Variable:
   - `NEXT_PUBLIC_SOCKET_URL` = Render URL from Step 1
4. Deploy

### Step 3: Update Render CORS
Go back to Render and update `NEXT_PUBLIC_APP_URL` to match your Vercel URL exactly.

### Important Notes
- Render free tier spins down after 15 minutes of inactivity
- First connection after sleep takes ~50 seconds (cold start)
- Use a free cron service (e.g., cron-job.org) to ping Render every 14 minutes to keep it warm

**Full deployment guide**: See `DEPLOYMENT.md` in project root.

---

## Environment Variables

### Required for Production
- `NEXT_PUBLIC_SOCKET_URL`: Socket.IO server URL (e.g., `https://neontank-socket.onrender.com`)
- `NEXT_PUBLIC_APP_URL`: Allowed CORS origin (Vercel URL or `*` for development)
- `PORT`: Server port (default: 3000)

### Optional
- `NODE_ENV`: `development` or `production`
- `REDIS_URL`: Redis connection for Socket.IO scaling (optional)

---

## Code Architecture Patterns

### Separation of Concerns
- **Engine** (`src/engine`): Pure TypeScript game logic, no React dependencies
- **Components** (`src/components`): React UI layer, thin wrappers around engine
- **Stores** (`src/store`): Zustand for global state (settings, multiplayer, game state)

### Entity System
All game entities inherit from base classes:
- **Tank**: Player/AI controlled units
- **Bullet**: Projectiles with physics
- **PowerUp**: Collectible items
- **Wall**: Obstacles (destructible and indestructible)
- **Hazard**: Damage zones
- **Particle**: Visual effects

Each entity has:
- `update(deltaTime)`: Update logic
- `draw(ctx)`: Rendering
- `getBounds()`: Collision detection

### Game Loop
```typescript
// Simplified game loop structure
function gameLoop() {
  const deltaTime = calculateDeltaTime();

  // 1. Process input
  inputManager.update();

  // 2. Update entities
  tanks.forEach(tank => tank.update(deltaTime));
  bullets.forEach(bullet => bullet.update(deltaTime));
  powerups.forEach(powerup => powerup.update(deltaTime));

  // 3. Check collisions
  checkBulletCollisions();
  checkPowerUpCollisions();

  // 4. Render
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  render(ctx);

  requestAnimationFrame(gameLoop);
}
```

---

## Socket.IO Event Reference

### Client → Server Events
- `join_room`: Join matchmaking queue
- `create_room`: Create private room
- `player_input`: Send player controls
- `request_rematch`: Request new round
- `leave_room`: Exit game

### Server → Client Events
- `room_created`: Room successfully created
- `player_joined`: Another player joined
- `game_start`: Game begins
- `game_state`: Game state snapshot (30 FPS)
- `game_over`: Round ended
- `player_disconnected`: Opponent left
- `error`: Connection/game error

### Event Data Types
Defined in `src/lib/socket/events.ts`:
- `GameStateSnapshot`: Complete game state
- `PlayerInputData`: Control inputs with timestamp
- `SerializedTank`: Tank state for network transmission
- `SerializedBullet`: Bullet state
- `RoomData`: Room metadata

---

## Performance Optimizations

### Canvas Rendering
- Layered rendering (static elements cached)
- Only redraw changed regions (for static backgrounds)
- Hardware acceleration via CSS `transform: translateZ(0)`

### Network
- Delta compression for game state
- Input buffering (send inputs in batches)
- State interpolation (client-side smoothing)
- Dead reckoning for remote players

### Mobile
- Touch event throttling
- Lower particle density on mobile
- Reduced shadow quality
- Dynamic canvas resolution

---

## Browser Compatibility

### Supported Browsers
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Mobile Support
- iOS Safari 14+
- Chrome Mobile 90+
- Samsung Internet 14+

### Required Features
- Canvas API
- WebSocket/Socket.IO
- ES6+ JavaScript
- CSS Grid/Flexbox

---

## Future Enhancement Ideas

### Planned Features
- Power-up variety expansion
- Custom map editor
- Replay system
- Tournament mode
- Team battles (2v2)
- Spectator mode
- Ranked matchmaking
- Persistent player stats
- Custom tank skins
- Map voting system

### Technical Improvements
- WebRTC for peer-to-peer connections (reduced latency)
- WebGL rendering (better performance)
- Progressive Web App (PWA) support
- Offline AI practice mode
- Server-side replay storage

---

## Troubleshooting

### Common Issues

#### "Cannot connect to multiplayer"
- Check `NEXT_PUBLIC_SOCKET_URL` environment variable
- Verify Socket.IO server is running
- Check browser console for CORS errors
- If using Render free tier, wait 60s for cold start

#### "Game is laggy"
- Lower particle density in settings
- Disable bullet trails
- Reduce screen shake intensity
- Check network latency (multiplayer)
- Close other browser tabs

#### "Controls not responding"
- Check browser console for errors
- Ensure canvas has focus (click on game area)
- Try refreshing page
- Verify keyboard layout (QWERTY assumed)

#### "Build fails"
- Delete `node_modules` and `.next`
- Run `npm install` again
- Check Node.js version (20+ required)
- Clear npm cache: `npm cache clean --force`

---

## License

See project repository for license information.

---

## Credits

**Neon Tank Duel** - A real-time multiplayer tank battle game

Built with Next.js, Socket.IO, TypeScript, and Canvas API.

---

*This documentation is generated for Claude AI context. Last updated: January 2026*
