# Validation record

Validated in the managed Linux cloud environment on 17 November 2026 using Node 24.22.1, npm 11.9.0 and headless system Chromium with SwiftShader software WebGL.

## Passed

- Clean `npm ci --cache /workspace/.npm-cache --no-audit --no-fund` from the saved lockfile.
- `npm test`: **7 tests executed, 7 passed**, none skipped. Covers four-contact settling, acceleration and braking, asymmetric suspension loading/body tilt, effective tuning changes, recovery, malformed-save handling and named-build persistence.
- `npm run build`: strict TypeScript checking and a complete static production bundle in `dist/`.
- Development-browser smoke run: **9 checks passed** with zero JavaScript page errors. Renderer/physics startup; actual keyboard movement (0.155 m); body removal/paint; live tuning; build save; map travel; photo mode; reload persistence; mobile layout/touch-button visibility.
- Production preview checks passed: HTTP 200, bundled assets and WASM startup, camera switch, real PNG download, workshop controls and zero page errors. Reproduce with `npm run preview -- --port 4173` followed by `npm run test:production`.
- All **130 reference images** decoded; six complete contact sheets examined. Full path/dimension/size/checksum inventory is in `reference-manifest.json`.
- `git diff --check`.

## Warnings and limits

- Rapier 0.19 emits an internal WASM initialization deprecation warning even through its public `init()` API; initialization and physical tests succeed.
- Vite reports large vendor chunks: Three.js about 523 kB and embedded-WASM Rapier about 2.24 MB before gzip. The app chunk is about 84 kB. This is a startup-download cost, not a failed build.
- One high-preset development capture reported about 98 draw calls and 1.0 million rendered triangles, and approximately 17 FPS in software WebGL at 1280 × 900. This is **not** a validated 60 FPS claim. A physical GPU performance matrix remains required; lower presets reduce resolution, shadows and vegetation.
- Mobile checks verify layout and control presence, not physical-device touch handling. No Safari/WebKit, physical Mac/Windows, trackpad or real gamepad session has been performed.
- The smoke test exercises driving and route selection; it does not prove every trail can be completed with every tune. The full four-gate route needs sustained playtesting.
- Cloudflare has not been published. The diagnosed remote `main` was still the README-only initial commit; local builds cannot repair a deployment until the new application files are committed/pushed to the configured branch.

Screenshots are generated under ignored `.artifacts/` (trail, garage, exposed mechanics, map and mobile). The reference contact sheets are separately versioned in `docs/reference-sheets/` and never included in the game runtime.

Reusable cloud `install_script` and `start_skill` were saved as a configuration draft. This does not publish the environment snapshot or the website.
