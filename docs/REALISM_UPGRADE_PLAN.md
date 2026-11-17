# Current improvement scope

The retained stack is TypeScript, Three.js, Vite and Rapier. The current game has one original vehicle, a physical four-link/solid-axle assembly, three trailheads, a proving ground, shared garage/tuning UI and version-1 local saves. The principal art problems are the tall box-like cabin, sparse/oversized trail dressing, and workshop props. The principal interaction problems are a persistent driving overlay and no separate selection garage. Tyres currently use one uniformly shrinking cylinder and one visual contact plane.

Implementation order:

1. Add a minimal driving HUD, M pause/menu flow, distinct vehicle garage and tuning workshop, preserving settings/photo/builds/progression.
2. Add two original 1/10-scale vehicle identities on the verified 324 mm physical rig; redesign the body meshes and make chassis/body mass/CG differences real. Implement vehicle ownership and honest purchasing/selling rules.
3. Upgrade tyre contact to three independently compliant collision ribs with local contact patches and sidewall response; keep graphics presets independent of physical correctness. Retain and test the constrained suspension.
4. Author four miniature courses with measured obstacles/gates, easy/medium/hard/extreme geometry, records and recovery penalties. Keep the existing park and proving ground accessible.
5. Group physical tuning into usable categories, add front/rear damping/spring parameters and real workshop preview/test transitions; verify saves, performance and the production bundle.

The new `RC_Crawler_Realism_Upgrade_Reference_Pack.zip` could not be transferred: the attachment tool enforces a 32 MiB maximum. Its 135 images have **not** been extracted or examined. They must be supplied in smaller archives before a complete new-pack review can be performed. The previously extracted/reviewed 130-image pack remains available; its inventory and reference sheets are under docs/. No new-pack inspection is claimed.

This pass prioritizes a small finished set of working systems over ten vehicle names or five unfinished maps. Further vehicle scales/rig dimensions, full soft-body rubber, physically displaced soil and a complete five-biome world require additional work and calibration. No reference photos will be used as vehicle billboards or scene backgrounds.

## Completed implementation

The split graphics archives subsequently transferred successfully: all 32 PNG files were extracted and examined, and their included instructions were read. The separate 135-image realism archive remains unavailable. See [the implemented features, reference audit and remaining limits](GRAPHICS_REALISM_UPGRADE.md) for the resulting scope.
