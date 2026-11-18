# Ridgebound RC

A browser RC crawler simulator using TypeScript, Three.js and Rapier. Four immediately available original hobby-grade rigs, separate selection garage and tuning workshop, five connected RC-scale locations and twenty courses, compliant tyre contacts and contact-driven environmental effects are implemented. The art is generated 3D geometry and PBR materials; the supplied reference images stay outside the game bundle. This remains a simulator under development, with reduced tyre/soil/water models and further production art work needed.

See [the power, map and interface rebuild report](docs/POWER_MAP_UI_REBUILD.md) for implemented systems, measurements and remaining work, and [the open-garage report](docs/OPEN_GARAGE_REALISM.md) for the previous reference audit.

## Run

Requires Node.js 22.12+ (validated with Node 24).

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

Vite serves on port 5173. Open the running app through your development environment's supported browser access. No API keys or backend services are required. All fonts and runtime dependencies are bundled; there are no runtime CDN requests.

```sh
npm test              # Physical regression and persistence checks
npm run build        # TypeScript check + static production bundle
npm run preview      # Preview the production build
npm run test:power-maps # Five motor setups, physical map traversal, mud and preserved progress
npm run test:mud     # Rendered-pixel regression for localized mud; dev server required
npm run test:realism # All free vehicles, new tuning, zoned mud, photo and graphics controls
npm run test:browser # Run with the dev server already running
npm run test:production # Run with preview already running on port 4173
npm run test:visual     # High-quality tyre/shadow rendering check; dev server required
```

The browser check uses `/usr/bin/chromium` on the cloud machine and writes screenshots to ignored `.artifacts/`. It checks actual movement, workshop tuning, body inspection, build persistence, map selection, photo mode and mobile controls. `TEST_URL` can point it at a production preview instead.

## Controls

| Input | Action |
| --- | --- |
| W / S or ↑ / ↓ | Proportional ramped throttle / reverse |
| A / D or ← / → | Steering servo |
| Space | Brake |
| R | Recover at current position |
| C | Chase / low RC / body / orbit / suspension / cinematic camera |
| G / M | Tuning workshop / pause menu |
| P | Pause for photo mode |
| Esc | Exit photo mode or toggle pause menu |
| Drag / wheel | Orbit / zoom in workshop, orbit camera and photo mode |
| Gamepad left stick / RT / LT | Analogue steering / forward / reverse |

Touch buttons are available on small screens. Audio is opt-in and synthesizes a load-dependent electric motor tone. Gamepad hardware and Mac trackpad behavior still need device testing.

## Physics overhaul

The R1 now uses **17 dynamic bodies, actual wheel collisions, two solid axles, eight suspension links and 26 physical joints**. The independent raycast controller was removed. Steering has hinged knuckles and Ackermann servo targets; motor torque comes from a DC-equivalent motor/battery/gearing model, with open/locked differential modes. Wheel load changes finite friction and reduced tyre compliance. Battery placement and wheel weights change mass/inertia. Rendering interpolates 240 Hz simulation snapshots.

The existing park, workshop, shell inspection, paint, saved builds, route gates, credits, gamepad input, photo export and graphics settings remain. Garage tuning now includes tyre width/foam, springs/damping/preload, voltage/capacity/pack location, motor winding/KV, gearing, portal housings, servo demand and transmitter response. Original saves are preserved.

Use the **trail map → Vehicle physics proving ground** for turning circles, articulation, inclines and surface lanes. **F2** toggles collision geometry and physical telemetry. **Shift** holds precision crawl mode. **Settings → Transmitter bindings** remaps driving controls. C now cycles six views, including suspension and cinematic cameras.

Read the [complete physics report](docs/PHYSICS_OVERHAUL.md) and [verification record](docs/VALIDATION.md). Important limits: radial tyre compliance is a reduced model, differential locking uses projected angular coupling rather than full meshed gears, and the servo's damping is not an exact electronic current limit. Alternate three-link/Panhard chassis and measured physical-crawler calibration still require development. Hollow Creek now includes a physical deformable soil patch. The procedural art remains short of the supplied photorealistic references. All four original rigs and every tuning part are free; purchase/sale restrictions were removed. A broad vehicle collection, full open world and online accounts require further work.

## Architecture and references

See [architecture](docs/ARCHITECTURE.md) and the [complete 130-image reference review](docs/REFERENCE_REVIEW.md). No reference screenshot is used as a vehicle texture or scene background. Original reference assets remain separate from the production runtime.

## Cloudflare

Run `npm ci` and `npm run build`; deploy **`dist/`** with Cloudflare Pages (build command `npm run build`, output `dist`). Alternatively `wrangler.toml` configures Worker static assets; use an authenticated Wrangler installation and run `wrangler deploy`. A push to the connected GitHub main branch lets Cloudflare run this build. A successful local build or Git push does not establish that Cloudflare has completed its deployment. The game runs entirely as static assets; no Cloudflare credentials are needed for development.

The large Rapier physics chunk includes its WASM payload. It is compressed by the host but is still a first-load cost. Geometry and materials are generated locally at launch and batched; neither the reference ZIP nor contact sheets enter the production bundle.
