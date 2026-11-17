# Ridgebound RC

A browser RC crawler simulator built from an empty repository using the supplied 130-image reference pack. **This is a first playable release, not the finished ultra-realistic simulator.** The original R1 Expedition has separate mechanical meshes, force-based wheel contact, an inspection workshop, tuning, and a small connected forest park.

## Run

Requires Node.js 22.12+ (validated with Node 24).

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Vite serves on port 5173. Open the running app through your development environment's supported browser access. No API keys or backend services are required. All fonts and runtime dependencies are bundled; there are no runtime CDN requests.

```sh
npm test              # Seven simulation and persistence checks
npm run build        # TypeScript check + static production bundle
npm run preview      # Preview the production build
npm run test:browser # Run with the dev server already running
npm run test:production # Run with preview already running on port 4173
```

The browser check uses `/usr/bin/chromium` on the cloud machine and writes screenshots to ignored `.artifacts/`. It checks actual movement, workshop tuning, body inspection, build persistence, map selection, photo mode and mobile controls. `TEST_URL` can point it at a production preview instead.

## Controls

| Input | Action |
| --- | --- |
| W / S or ↑ / ↓ | Proportional ramped throttle / reverse |
| A / D or ← / → | Steering servo |
| Space | Brake |
| R | Recover at current position |
| C | Chase / low RC / body / orbit camera |
| G / M | Workshop / map |
| P | Pause for photo mode |
| Esc | Exit photo mode or return to trail |
| Drag / wheel | Orbit / zoom in workshop, orbit camera and photo mode |
| Gamepad left stick / RT / LT | Analogue steering / forward / reverse |

Touch buttons are available on small screens. Audio is opt-in and synthesizes a load-dependent electric motor tone. Gamepad hardware and Mac trackpad behavior still need device testing.

## What works

- One original 324 mm wheelbase, 3.25 kg R1 Expedition; no licensed replica claims.
- Actual 3D ladder chassis, crossmembers, motor can, transmission housing, battery and straps, cooling fins, receiver, wiring, driveshaft rods, axle/differential housings, four-link rods, steering rod, coilovers, beadlock rings/bolts, machined-style hubs and 120 individual tread blocks per wheel.
- Extruded body panels with wheel cutouts; grille slots, headlight lenses, door handles, mirrors, dashboard, seats, steering wheel, roof basket and visual recovery accessories. Shell removal reveals the mechanics.
- Rapier dynamic rigid chassis, compound body colliders, gravity, collision, rollover, per-wheel contact forces and spring/damper suspension. The visuals use the physical contact lengths, not a canned articulation animation. Stable 120 Hz fixed steps with catch-up bounded to avoid a spiral under severe render stalls.
- Per-contact surface friction for wet creek bed, dry granite, roots and loam. Motor torque/speed curves, drag brake, service brake, servo response. Compound, tyre radius, motor reduction, spring stiffness, damping and rest length change simulation parameters.
- A 40 × 40 m continuous heightfield mesh with authored obstacles, rock garden, shallow creek, collidable plank bridge, tree trunks, fallen log and root detail. Three selectable trailheads in the same park; Fern Creek has four sequential gates and a one-time 150-credit reward.
- Workshop bench, mat, drawers, shelves, spare wheels, motor cans, tool panel and lights. Orbit inspection, paint, shell toggle, real tuning and eight locally saved builds.
- Four cameras, photo orbit/export, a trail map, field guide, local save recovery, responsive UI, opt-in motor audio and four render presets.

## What still needs work

**Physics is an engineering approximation.** Rapier's raycast vehicle controller applies real wheel forces to the chassis, but the wheels are rays rather than colliding tyre volumes. Visible axle housings and links follow those contact positions; they are not dynamically constrained solid axles or four-link mechanisms. There are no simulated universal joints or independently rotating motor gears. Spring limits are controller travel limits, not material bump stops. This distinction matters at sharp ledges, side contact, high-centering and when an axle should transfer load between wheels.

Tyres are rigid mesh assemblies. There is **no deformable carcass, finite contact patch, foam pressure, explicit wheel inertia / slip-ratio model or soil displacement**. Friction uses surface/compound coefficients rather than laboratory tyre data. Radius changes clearance and force-to-speed response through the controller; the selected motor's torque and speed limit are modeled separately, not derived from a complete electrical/gearing model. Gear/differential controls, battery state, mechanical damage and working winching remain unimplemented.

The procedural art is much more detailed than a block vehicle but is **not photogrammetry or reference-level photorealism**. The forest canopy, mountains, workshop props, UVs and material sets need professional asset work. Water has animated ripples, transparency and clearcoat, not planar reflections or hydrodynamic forces. No waterfalls, functioning mud, quarry/desert biomes, weather, mud accumulation, AO pipeline, streaming or measured LOD system yet.

Only one original crawler and a small connected park are implemented. No dealership, part economy, XP, multiple owned vehicles, broad competition progression, online accounts or D1 persistence yet. Test parts are openly available; the workshop does not claim to charge credits. The winch, rack and recovery boards are visible accessories, not working gameplay tools.

Graphics presets change pixel ratio, shadows and vegetation visibility. They are not a complete independent quality-settings suite. Cross-platform FPS, controller mappings, Safari/WebKit, real Mac/Windows hardware, touch driving and long-session stability still need testing. Software WebGL performance in cloud Chromium is not evidence of a stable gaming GPU frame rate.

## Architecture and references

- `src/vehicle.ts`: procedural vehicle meshes and suspension visualization.
- `src/physics.ts`: Rapier vehicle forces, fixed-step vehicle input and tuning.
- `src/world.ts`: connected terrain, scene/collision geometry, workshop, trailheads.
- `src/materials.ts`: deterministic procedural materials and reusable mesh builders.
- `src/optimize.ts`: static part batching; vegetation and tread instancing stay separate.
- `src/main.ts`: rendering, input, camera modes, audio and course progression.
- `src/ui.ts`, `src/style.css`: functional interface and responsive layouts.
- `src/state.ts`: validated versioned local persistence, replaceable storage adapter.

See [the complete reference review](docs/REFERENCE_REVIEW.md) for every image, contact sheets, dimensions and checksums. The supplied images are visual references only; they are not placed on vehicles or used as scene backgrounds. No external vehicle meshes were included in the upload.

## Cloudflare

Run `npm ci` and `npm run build`; deploy **`dist/`** with Cloudflare Pages (build command `npm run build`, output `dist`). Alternatively `wrangler.toml` configures Worker static assets; use an authenticated Wrangler installation and run `wrangler deploy`. Publication requires your Cloudflare account and was not performed here. The game runs entirely as static assets; no Cloudflare credentials are needed for development.

The large Rapier physics chunk includes its WASM payload. It is compressed by the host but is still a first-load cost. Geometry and materials are generated locally at launch and batched; neither the reference ZIP nor contact sheets enter the production bundle.
