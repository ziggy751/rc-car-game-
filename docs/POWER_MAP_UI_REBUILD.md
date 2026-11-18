# Power, terrain, mud and interface rebuild

Implemented from the November 2026 power/physics/map/UI request. All vehicles, tuning parts and courses remain free. The existing `ridgebound.save.v1` key, named builds, per-vehicle tuning, paint, dirt, controls and progress are retained.

## Delivered

- Five selectable electrical setups: scale 540 brushed, torque 550 brushed, sensored brushless, performance brushless and competition sensored. Motor turns/KV, resistance, inductance, back-EMF, phase-current and battery-current limits, pack resistance/voltage sag, throttle slew, efficiency, charge use and temperature affect delivered wheel torque. Motor rotor inertia is reflected through the gearbox into the wheels. The electrical update includes mechanical inertia to avoid an unstable explicit current/torque feedback loop. Presets are representative engineering values, not manufacturer dyno measurements.
- Real wheel torque drives the constrained crawler. Driving never sets chassis velocity, lifts it over a rock or applies an upright helper. Existing 324 mm wheelbase, independent compliant tyre bands, four-link axles, differential coupling, Ackermann steering and servo dynamics remain. Narrow bumper and slider collision shapes add approach-angle and scrape contact. Larger tyres retain the same beadlock rim diameter visually.
- Five selectable locations within the connected 40 × 40 m park: Silver Pine forest, Granite Crown rock park, Hollow Creek rainforest, Redbank Quarry and Works Circuit. Twenty timed courses provide four difficulty levels per location. New terrain grades, exact render/collision rock geometry, timber/root obstacles, slabs, competition fixtures and scenery support open shoulders and alternate approaches. The original four forest course identifiers and saved records remain valid.
- Hollow Creek has a loaded-contact soil heightfield: tyre load/slip cut bounded ruts in both the rendered surface and the actual collider. Wetness and remaining soil depth affect resistance/grip. Soil updates use fixed simulation time across graphics presets. Rocks and logs supported above the mud do not stamp it.
- Mud spray depends on actual contact, slip, wetness, soil depth, tyre width, tread and load. A bounded ray-query budget lets selected clumps strike nearby geometry; impacts on a chassis, wheel or axle attach small pooled deposits to that assembly. Immersed deposits shrink/wash away. Existing directional wheel/arch dirt zones, drying, dust, scrape wear, water ripples and clean-vehicle controls remain.
- A charcoal/metal/amber interface with locally bundled Barlow Condensed and IBM Plex Mono, a compact open-garage roster, five-location course browser/route plan, separate tuning workshop and Electronics category. Drive, M pause/resume, minimal HUD, full HUD hide, saved builds and live proving-ground tests remain available.
- Distinct terrain material blends for granite, quarry, competition ground and wet forest; Low/Medium/High/Ultra/Auto/Custom controls retain the same physical simulation. Texture detail, wheel detail, shadows, vegetation, particles and deformation are rendering choices.

## Numerical checks

`npm test -- --maxWorkers=1` exercises 57 tests covering electrical limits/back-EMF/heating, five motor setups, slow/full throttle, voltage/gearing, a 45 mm ledge, a 20° slope and braking, finite traction/wheelspin, steering/reverse, parked stability, axle articulation, local tyre contact, airborne recovery, rollover, all four vehicle profiles, mud surface deformation and backward-compatible saves.

Representative flat-ground results with the preset stock chassis and 118 mm tyres:

| Power system | Speed at 5% input | Speed at full input |
| --- | ---: | ---: |
| Scale brushed | 0.007 m/s | 0.91 m/s |
| Torque brushed | 0.0003 m/s | 0.94 m/s |
| Sensored brushless | 0.031 m/s | 1.07 m/s |
| Performance brushless | 0.070 m/s | 2.30 m/s |
| Competition sensored | 0.016 m/s | 0.71 m/s |

These are measured test outcomes, not enforced vehicle speed caps. Low brushed input can remain near stall under load; sensored control compensates through the ESC. The standard rig climbed the 45 mm ledge at full input and the sensored rig at half input. A loaded soil test lowered actual support by approximately 22 mm in three simulated seconds. Stock parked vertical variation measured approximately 0.12 mm; very soft inserts approximately 0.29 mm. Different render frame rates and graphics presets give equivalent physics in deterministic scenarios.

`npm run test:power-maps` checks all five power selectors, Electronics tuning, five location tabs, physical relaxed-route traversal in the assembled world (including material queries, mud and water), preserved builds/progress and browser errors. Other browser suites cover garage/workshop, graphics changes, water/mud washing, cameras, photo download and mobile layout. Build with `npm run build`; Cloudflare Pages output remains `dist` at repository root.

Final verification: `npm run build`, 57/57 numerical tests, and all six browser suites (`test:power-maps`, `test:browser`, `test:production`, `test:realism`, `test:visual`, `test:mud`) passed. Browser error collections were empty. The rendered-pixel mud regression retained unchanged pixels on unexposed wheels. Graphics checks confirmed 2048-pixel Ultra shadow maps and AO/bloom, and lower preset resource settings; these are correctness measurements, not hardware FPS certification.

Actual game screenshots: [garage](screenshots/power-rebuild-garage.png), [workshop and tyre contact](screenshots/power-rebuild-workshop.png).

## Still requiring further work

- The four original R1/C2/W3/B4 models remain detailed procedural meshes. This change improves mechanics/material integration; it does not provide scanned production vehicle meshes or manufacturer CAD. Small-scale vehicles, six distinct vehicle classes, rear steering and three-link/Panhard variants are not implemented.
- The five locations are compact authored areas of one park, not five huge standalone photogrammetry levels. Further landscape art, varied natural line layouts, denser native vegetation and a complete human driving pass of every hard/extreme route are needed. Automated relaxed-route traversal does not establish that all twenty timed courses are optimally balanced.
- Tyres use a reduced three-band contact model plus local shader deformation, not a volumetric rubber/foam simulation. Soil is a bounded deformable heightfield, not fluid dynamics or a full terramechanics model. Loose quarry scenery is mostly static; not every pebble is a dynamic body.
- Particle/surface impacts are sampled within a fixed budget. Visual attached clumps are transient; saved eight-zone dirt/wetness is persistent. Mud is not simulated grain by grain and does not add sprung mass. Water uses immersion detection, wet grip, washing and ripple/splash effects; hydrodynamic drag and buoyancy are not implemented.
- Materials and foliage are generated game assets; they do not match the photorealism of the supplied reference photographs. Dedicated game-ready texture scans, vegetation and vehicle art would be the next major visual step. Reference photographs are not pasted onto vehicle meshes or used as backgrounds.
- Braking/contact and motor constants remain approximations that need hardware comparison. No representative gaming GPU was available in the cloud environment; software-rendered browser tests cannot certify a 60 FPS hardware target or maximum Ultra quality.
- A successful local build and GitHub push do not verify a successful Cloudflare deployment. Check the Cloudflare build for the new commit.
