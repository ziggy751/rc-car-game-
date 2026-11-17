# Ridgebound RC

A browser RC crawler simulator built from an empty repository using the supplied 130-image reference pack. **This is a playable simulator under development, not a claim of laboratory-calibrated realism.** The original R1 Expedition has separate mechanical meshes, force-based wheel contact, an inspection workshop, tuning, and a small connected forest park.

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
| G / M | Workshop / map |
| P | Pause for photo mode |
| Esc | Exit photo mode or return to trail |
| Drag / wheel | Orbit / zoom in workshop, orbit camera and photo mode |
| Gamepad left stick / RT / LT | Analogue steering / forward / reverse |

Touch buttons are available on small screens. Audio is opt-in and synthesizes a load-dependent electric motor tone. Gamepad hardware and Mac trackpad behavior still need device testing.

## Physics overhaul

The R1 now uses **17 dynamic bodies, actual wheel collisions, two solid axles, eight suspension links and 26 physical joints**. The independent raycast controller was removed. Steering has hinged knuckles and Ackermann servo targets; motor torque comes from a DC-equivalent motor/battery/gearing model, with open/locked differential modes. Wheel load changes finite friction and reduced tyre compliance. Battery placement and wheel weights change mass/inertia. Rendering interpolates 240 Hz simulation snapshots.

The existing park, workshop, shell inspection, paint, saved builds, route gates, credits, gamepad input, photo export and graphics settings remain. Garage tuning now includes tyre width/foam, springs/damping/preload, voltage/capacity/pack location, motor winding/KV, gearing, portal housings, servo demand and transmitter response. Original saves are preserved.

Use the **trail map → Vehicle physics proving ground** for turning circles, articulation, inclines and surface lanes. **F2** toggles collision geometry and physical telemetry. **Shift** holds precision crawl mode. **Settings → Transmitter bindings** remaps driving controls. C now cycles six views, including suspension and cinematic cameras.

Read the [complete physics report](docs/PHYSICS_OVERHAUL.md) and [verification record](docs/VALIDATION.md). Important limits: radial tyre compliance is a reduced model, differential locking uses projected angular coupling rather than full meshed gears, and the servo's damping is not an exact electronic current limit. Alternate three-link/Panhard chassis, soil deformation and measured physical-crawler calibration still require development. The procedural art remains short of the supplied photorealistic references. A dealership, broad vehicle collection, full open world and online accounts are not implemented.

## Architecture and references

See [architecture](docs/ARCHITECTURE.md) and the [complete 130-image reference review](docs/REFERENCE_REVIEW.md). No reference screenshot is used as a vehicle texture or scene background. Original reference assets remain separate from the production runtime.

## Cloudflare

Run `npm ci` and `npm run build`; deploy **`dist/`** with Cloudflare Pages (build command `npm run build`, output `dist`). Alternatively `wrangler.toml` configures Worker static assets; use an authenticated Wrangler installation and run `wrangler deploy`. Publication requires your Cloudflare account and was not performed here. The game runs entirely as static assets; no Cloudflare credentials are needed for development.

The large Rapier physics chunk includes its WASM payload. It is compressed by the host but is still a first-load cost. Geometry and materials are generated locally at launch and batched; neither the reference ZIP nor contact sheets enter the production bundle.
