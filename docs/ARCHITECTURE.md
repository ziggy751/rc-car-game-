# Implementation decisions

The input repository contained only a heading in README. There was no game to improve or asset pipeline to preserve. The selected architecture follows the main prompt's first-playable priorities: TypeScript, Three.js, Vite and Rapier. An imperative renderer keeps dynamic geometry and physical state explicit, and the UI does not require a second rendering framework.

## Physical scale

World coordinates are metres. R1 is an original scale crawler with a 0.324 m wheelbase, 0.256 m wheel track, 0.118 m default tyre diameter and a 3.25 kg compound rigid body. These are design parameters, not a claim of measurements taken from the concept images. The mesh body has deliberately exaggerated hobby accessories for legibility.

The lower chassis collider carries 2.8 kg and the upper shell collider carries 0.45 kg. Gravity is 9.81 m/s². The 120 Hz solver uses bounded render delta accumulation. Per-wheel rays query static colliders, excluding the dynamic chassis. Spring settings are a normalized UI scale mapped to controller stiffness (×4), not literal N/m. Damping follows Rapier's vehicle controller convention. All current test parts are compatible with this one chassis.

The body is fully dynamic. Visual suspension is reconstructed from each physical wheel's suspension length and rotation. Rod endpoints are recomputed rather than played as animation clips. However, the controller has four independent ray springs. The visible connecting axle is not the same thing as a dynamic solid axle, and the displayed links do not constrain those wheel paths. The next physics iteration should replace these with rigid axle bodies, real joint/link constraints, wheel colliders and a validated tyre force model, then compare the two on an articulation rig before extending the vehicle collection.

## Collision

The rendered ground and its triangle collider share vertex data. Selected authored rocks and nearby large rocks have triangle colliders derived from the exact rendered transform. The bridge's plank colliders follow each plank. Trunks use simpler cylinder colliders. Ferns, distant rocks, needle sprays, accessories, garage props and distant mountain silhouettes have no gameplay collision. The three map entries select trailheads in the same small park, not separate complete biomes.

## Rendering and assets

Vehicle parts use separate meshes before batching by material. Wheel assemblies, axles, shocks, steering and link rods remain independently updateable. Tread blocks, pine needle sprays and fern leaflets use instancing. Static batches reduce draw calls; there is not yet distance-based asset streaming or a true LOD hierarchy. Canvas-generated albedo/bump maps are deterministic and never derived from reference photos. Standard/physical materials provide metal/roughness shading, with environment-map illumination, sunlight and shadowing. The water is a transparent physical material with moving small-scale normals.

## State and deployment

A versioned save object contains normalized tuning, up to eight named builds, completed route IDs and credits. Malformed saves fall back to defaults. A rejected localStorage write produces a visible message. The `loadState`/`saveState` adapter boundary is the future hook for an account service; D1 is not implemented or advertised as present. Production output is static and needs no secrets.

## Next validation priorities

1. Constrained solid axles and wheel collisions on a known articulation fixture.
2. Measured grades, wheel loads and braking distances against a physical crawler.
3. Soft-tyre contact deformation and material-specific slip curves.
4. Authored high-resolution asset meshes, texture baking and distance LODs.
5. Safari/WebKit, Windows/Mac, analogue controller and trackpad testing.
6. GPU profiling at 1080p across all presets before claiming stable 60 FPS.
