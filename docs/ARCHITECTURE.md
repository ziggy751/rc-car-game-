# Runtime architecture

The game retains its existing imperative Three.js renderer and Vite/TypeScript application. The vehicle no longer uses Rapier's raycast controller.

- `src/physics.ts`: constrained multi-body assembly, steering joint actuation, electric motor/drivetrain torques, shock forces, contact telemetry and pose snapshots.
- `src/dynamics/tuning.ts`: physical configuration defaults and typed tuning values, including the original save fields.
- `src/dynamics/math.ts`: Ackermann steering and transform helpers.
- `src/dynamics/clock.ts`: 240 Hz fixed accumulation, bounded stalls and interpolation fraction.
- `src/dynamics/surfaces.ts`: contact materials and surface query contract.
- `src/dynamics/collision.ts`: obstacle-aware recovery support sampling.
- `src/dynamics/controls.ts`: remappable keyboard/arrow/touch bindings and shortcut conflict handling.
- `src/dynamics/deformation.ts`: load-driven rubber/tread and matching shadow deformation shaders.
- `src/vehicle.ts`: original procedural model, now synchronized to actual chassis, wheel, carrier and axle transforms; battery visuals follow placement.
- `src/world.ts`: retained park/garage/collision meshes, contact surface tags and reserved test pad footprint.
- `src/test-area.ts`: measured physical test fixtures and material lanes.
- `src/main.ts`: fixed stepping, visual interpolation, cameras, controls, debug drawing, audio, existing route progression and scene lifecycle.
- `src/ui.ts`: retained garage/map/settings/build UI with physical tuning, proving-ground travel, bindings and optional diagnostics.
- `src/state.ts`: backward-compatible version-1 save normalization. Existing builds/paint/credits/progress remain; new fields receive defaults.

The save key remains `ridgebound.save.v1`; no destructive save reset or migration is required. Production output remains static `dist/`, with no new external runtime service, secret or cloud database requirement.

See [the physics overhaul report](PHYSICS_OVERHAUL.md) for the exact physical model, original defects, approximations and remaining work.
