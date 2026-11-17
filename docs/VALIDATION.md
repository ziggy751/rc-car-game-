# Physics overhaul verification

> Historical baseline report. The current two-vehicle, three-band tyre, graphics and environment upgrade is documented in [GRAPHICS_REALISM_UPGRADE.md](GRAPHICS_REALISM_UPGRADE.md).


Validated on 17 November 2026 with Node 24.22.1, npm 11.9.0, Rapier 0.19 and system Chromium on the managed Linux cloud machine. Existing reference assets, route progression, local build saves and static deployment remain intact.

## Automated physical regression

`npm test`: **22 tests executed; 22 passed; zero skipped** in the final complete run.

Coverage includes constrained assembly settling/load balance, progressive wheel-torque acceleration, service braking, precision control, force-driven Ackermann turning, reverse yaw, single-wheel articulation/link-length preservation, a 20° climb and downhill brake hold, finite-friction wheelspin, open/locked differential response, servo settings, battery COM/weight effects, rollover, foam/compound compliance, voltage/gearing, complete-assembly recovery, 30/60/120 render FPS equivalence, interpolation/stall handling, original save migration and remapped touch/arrow bindings and obstacle-aware recovery using actual static collision geometry.

Representative deterministic fixture results (not real-world RC calibration):

| Check | Observed result |
| --- | --- |
| Base assembly mass | 3.16 kg |
| Four seconds forward at 50% throttle/full steering | x +0.321 m, z +0.491 m, yaw +46.8° |
| Front steering under that load | outer 19.9°, inner 35.6° |
| Reverse steering | yaw −58.8° |
| 20° incline, three seconds at 80% input | +0.256 m uphill; downhill brake assertion passed |
| Deliberately low-friction stress fixture, μ = 0.08 | peak absolute slip 0.435 versus 0.201 dry during acceleration |
| Same throttle, 6 V versus 11.1 V | 0.251 versus 0.470 m/s after the test interval |
| 11.1 V, higher reduction | 0.269 m/s |
| 30/60/120 render FPS | final position differences below 0.01 mm for the same fixed-step input sequence |

Split-traction locked mode reduced the tested axle-speed difference from approximately 0.345 to 0.310 rad/s. This demonstrates a change in behavior but **does not validate a perfectly locked mechanical differential**. The projected coupling remains an approximation, and further gear-train calibration is needed.

## Application and production checks

- `npm run build`: TypeScript and static Vite production build passed.
- Full development browser smoke run: **11 checks passed**, no JavaScript or shader errors. Actual keyboard motion (over 0.25 m), physical tuning, body removal/paint, named builds, reload persistence, map travel, proving-ground travel, live diagnostics/collision wireframes, photo mode, key remapping and mobile control rendering.
- High-quality rendering check: standard and shadow tyre shaders compiled without console/page errors; normal park and exposed garage model inspected. Garage contact deformation is reset on entry, preventing stale contact planes distorting tyres at the workshop's translated location.
- Production preview checks: HTTP 200, bundled WASM/asset initialization, camera switching, real PNG download and workshop controls passed. Additional final checks cover reserved shortcut rejection, remapped touch throttle and the small-screen workshop action position.
- `git diff --check` passed.

## Performance evidence and limits

A 120-step benchmark of the full park scene measured **0.7 ms median**, **1.1 ms p95**, **1.5 ms maximum** per 240 Hz physics step in the measured run. The high-preset scene reported around **105 draw calls / 890k triangles**. These timings include the constrained assembly and actual park collisions; they are not an isolated empty-world benchmark.

Cloud Chromium uses software WebGL, and screenshots showed low software-rendering FPS. No physical gaming GPU frame-rate claim is made. A cross-platform GPU/controller/trackpad matrix, Safari/WebKit tests, long sessions and sustained completion of every trail/tuning combination remain necessary.

Rapier's compatibility package emits its upstream WASM initialization deprecation notice through the public `init()` API, but initialization/tests succeed. Vite warns about the large embedded-WASM physics vendor chunk; the application remains statically deployable. No secret or new backend requirement was introduced.

## Physical approximations

See `PHYSICS_OVERHAUL.md`: reduced radial tyre compliance rather than a full carcass/contact patch; projected differential coupling rather than meshed gears; implicit servo damping rather than an exact electronic current limiter; one four-link chassis rather than alternate Panhard/three-link variants; simplified battery/electrical/soil models. Residual contact creep and constraint deflection need physical calibration. The tests demonstrate the specific capabilities above, not equivalence to a commercial hobby crawler.

Generated application captures are in ignored `.artifacts/`. The complete reference inventory/contact sheets remain separately versioned, outside the production runtime.
