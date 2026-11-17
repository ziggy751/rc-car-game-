import type { Save } from './state';
import type { Tune } from './physics';
import { trails } from './world';
import { testStations } from './test-area';
import { isBindingCode } from './dynamics/controls';
import { defaultBindings, type Action } from './state';
export type Mode = 'trail' | 'garage' | 'map' | 'settings' | 'guide';
export class UI {
  mode: Mode = 'trail';
  activeTrail = 0;
  started = false;
  photo = false;
  onMode: (mode: Mode) => void = () => {};
  onTune: () => void = () => {};
  onRecover = () => {};
  onTeleport: (i: number) => void = () => {};
  onCamera = () => {};
  onStart = () => {};
  onSave = () => {};
  onPhoto = () => {};
  onSound = () => {};
  onChallenge = () => {};
  onTestStation: (i: number) => void = () => {};
  onDebug = () => {};
  constructor(public state: Save) {
    document.querySelector('#app')!.innerHTML = `
 <div id="scene"></div><div class="vignette"></div>
 <div id="loading"><span class="brand">△ RIDGEBOUND</span><span>Preparing the trail<span class="dots">…</span></span></div>
 <header><button class="logo" aria-label="Explore Ridgebound"><svg viewBox="0 0 44 35" aria-hidden="true"><path d="M2 30 17 4l9 16 5-9 11 19H2m9 0 9-15 9 15M17 4l5 11"/></svg><span>RIDGEBOUND<small>THE RC CRAWLING EXPERIENCE</small></span></button>
 <nav aria-label="Main navigation"><button data-mode="trail" class="active">Explore<span>01</span></button><button data-mode="garage">Workshop<span>02</span></button><button data-mode="map">Trail map<span>03</span></button></nav>
 <div class="header-tools"><span class="credits"><i></i> <b id="credits">0</b> TRAIL CREDITS</span><button class="icon" id="sound" aria-label="Toggle sound" title="Toggle sound">♫</button><button class="icon" data-mode="settings" aria-label="Settings" title="Settings">⚙</button></div></header>
 <aside class="location"><span class="live-dot"></span> SILVER PINE RESERVE <span class="divider">/</span> <span id="location-name">FERN CREEK</span><span class="weather">☀ 16°C · LATE AFTERNOON</span></aside>
 <main id="panel"></main>
 <div id="center-hint"></div>
 <div id="telemetry" class="telemetry"><div class="gear"><small>DRIVETRAIN</small><b>4WD <span>LOW</span></b></div><div class="speed"><b id="speed">0.0</b><span>km/h<small>GROUND SPEED</small></span></div><div><small>SURFACE</small><b id="surface">Dry granite</b></div><div class="contact"><small>WHEEL CONTACT</small><div id="contacts"><i></i><i></i><i></i><i></i></div></div><div><small>BODY ROLL</small><b id="roll">0°</b></div><div class="timer"><small>SESSION</small><b id="time">00:00</b></div></div>
 <footer><div class="controls"><span><kbd>W</kbd><kbd>S</kbd> Throttle</span><span><kbd>A</kbd><kbd>D</kbd> Steer</span><span><kbd>SPACE</kbd> Brake</span><button id="recover"><kbd>R</kbd> Recover</button></div><div class="view-controls"><button id="camera"><kbd>C</kbd> Chase camera</button><button id="photo"><kbd>P</kbd> Photo mode</button><button id="debug-toggle"><kbd>F2</kbd> Physics</button><span id="fps">— FPS</span></div></footer>
 <aside id="physics-debug" hidden><b>VEHICLE DYNAMICS / LIVE</b><p>F2 toggles telemetry and collision geometry</p><pre id="debug-data"></pre></aside><div id="toast" role="status"></div><div id="touch"><button data-key="KeyW" aria-label="Throttle forward">↑</button><button data-key="KeyS" aria-label="Reverse">↓</button><button data-key="KeyA" aria-label="Steer left">←</button><button data-key="KeyD" aria-label="Steer right">→</button></div>
 <div id="photo-tools"><span>PHOTO MODE · Drag to orbit · Scroll to zoom</span><button id="download-photo">Save photograph <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></button><button id="exit-photo">Exit <kbd>P</kbd></button></div>`;
    document
      .querySelectorAll<HTMLElement>('[data-mode]')
      .forEach((b) => (b.onclick = () => this.setMode(b.dataset.mode as Mode)));
    document.querySelector<HTMLButtonElement>('.logo')!.onclick = () => this.setMode('trail');
    this.click('debug-toggle', () => this.onDebug());
    this.click('sound', () => this.onSound());
    this.click('recover', () => this.onRecover());
    this.click('camera', () => this.onCamera());
    this.click('photo', () => this.onPhoto());
    this.click('exit-photo', () => this.onPhoto());
    this.render();
  }
  click(id: string, fn: () => void) {
    document.getElementById(id)!.onclick = fn;
  }
  setMode(mode: Mode) {
    this.mode = mode;
    document.body.dataset.mode = mode;
    document
      .querySelectorAll('[data-mode]')
      .forEach((e) => e.classList.toggle('active', (e as HTMLElement).dataset.mode === mode));
    this.onMode(mode);
    this.render();
  }
  render() {
    const t = this.state.tune,
      trail = trails[this.activeTrail];
    const panel = document.getElementById('panel')!;
    document.getElementById('credits')!.textContent = String(this.state.credits);
    if (this.mode === 'trail') {
      panel.innerHTML = `<div class="trail-panel ${this.started ? 'compact' : ''}"><div class="eyebrow"><span class="tiny-line"></span> FIND YOUR OWN LINE</div><h1>${this.started ? 'Out here,<br><em>every inch counts.</em>' : 'Small scale.<br><em>Wild terrain.</em>'}</h1><p class="intro">A little machine. A bigger adventure.<br>Slow down and take the difficult way.</p>
 <article class="trail-card"><div class="card-top"><span class="eyebrow">YOUR NEXT ADVENTURE</span><span class="trail-number">0${this.activeTrail + 1}</span></div><div class="trail-title"><div><small>${trail.type}</small><h2>${trail.name}</h2></div><svg viewBox="0 0 58 48"><path d="m2 42 17-29 12 20 9-16 16 25M19 13l8 13M8 42h44"/></svg></div><p>${trail.description}</p><div class="trail-meta"><span><i class="difficulty"></i> ${trail.grade}</span><span>↝ ${trail.distance}</span><span>☷ 4 gates</span></div><button id="start" class="primary">${this.started ? 'Restart trail' : 'Hit the trail'} <span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span></button><button class="text-button" id="select-trail">Explore all trails <span>→</span></button></article><button class="guide-link" id="guide">ⓘ New to crawling? Read the field guide</button></div>
 <div class="vehicle-tag"><span class="live-dot"></span><div><small>YOUR CRAWLER / 1:10 SCALE</small><b>R1 · Expedition</b><span>324 mm wheelbase · ${Math.round(t.radius * 2000)} mm tyres</span></div><button id="inspect" aria-label="Inspect crawler in workshop"><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></button></div>`;
      this.click('start', () => {
        this.started = true;
        this.onStart();
        this.render();
      });
      this.click('select-trail', () => this.setMode('map'));
      this.click('guide', () => this.setMode('guide'));
      this.click('inspect', () => this.setMode('garage'));
    } else if (this.mode === 'garage') {
      panel.innerHTML = `<section class="workshop-panel"><div class="eyebrow">RIDGEBOUND WORKS / BUILD 01</div><h1>The workshop<span>.</span></h1><p class="intro">Make it yours. Make it capable.</p><div class="workshop-card"><div class="build-name"><div><small>ORIGINAL SCALE CRAWLER</small><h2>R1 Expedition</h2></div><span class="badge">1:10</span></div><div class="tabs"><button class="active" id="tab-tune">Tuning</button><button id="tab-style">Appearance</button><button id="tab-builds">My builds</button></div><div id="garage-fields"></div><div class="spec-strip"><span><b id="mass-stat">—</b> kg</span><span><b>324</b> mm WB</span><span><b>4</b> driven wheels</span></div><button id="drive" class="primary">Test your setup <span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span></button><p class="autosave">● Changes saved on this device</p></div></section><div class="inspection-note"><span>360° INSPECTION</span><p>Drag to orbit · Scroll to inspect<br>Remove the shell to explore the mechanics</p></div>`;
      this.renderTune('tune');
      this.click('tab-tune', () => this.renderTune('tune'));
      this.click('tab-style', () => this.renderTune('style'));
      this.click('tab-builds', () => this.renderTune('builds'));
      this.click('drive', () => {
        this.setMode('trail');
        this.started = true;
        this.onStart();
        this.render();
      });
    } else if (this.mode === 'map') {
      panel.innerHTML = `<section class="map-panel"><div class="eyebrow">SILVER PINE RESERVE / TRAIL NETWORK</div><h1>Take the scenic route<span>.</span></h1><p class="intro">Connected trails and a dedicated vehicle proving ground.</p><div class="map-layout"><div class="map-art"><svg viewBox="0 0 800 560" aria-label="Park map with three selectable trailheads"><defs><pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#8a9b7a" stroke-opacity=".13"/></pattern></defs><rect width="800" height="560" fill="#26362c"/><rect width="800" height="560" fill="url(#grid)"/><g fill="none" stroke="#81906d" stroke-opacity=".25">${Array.from({ length: 16 }, (_, i) => `<ellipse cx="${420 + i * 7}" cy="${160 + i * 8}" rx="${80 + i * 14}" ry="${40 + i * 10}" transform="rotate(-28 420 230)"/>`).join('')}</g><path d="M0 345Q200 235 340 310T800 260" fill="none" stroke="#709294" stroke-width="20" opacity=".4"/><path d="M270 470Q320 420 400 355T370 190L315 110" fill="none" stroke="#d7bd6e" stroke-width="4" stroke-dasharray="8 6"/><path d="M315 110Q170 195 180 260T300 335" fill="none" stroke="#cd9272" stroke-width="3" stroke-dasharray="5 6"/><text x="510" y="100" class="map-label">GRANITE RIDGE</text><text x="70" y="390" class="map-label">FERN CREEK</text><text x="600" y="465" class="map-label">SILVER PINE</text><text x="725" y="55" class="north">N ↑</text>${[
        [270, 470],
        [315, 110],
        [400, 310],
      ]
        .map(
          ([x, y], i) =>
            `<g data-trail="${i}" class="map-pin" tabindex="0" role="button" aria-label="Select ${trails[i].name}"><circle cx="${x}" cy="${y}" r="21"/><text x="${x}" y="${y + 5}" text-anchor="middle">0${i + 1}</text></g>`,
        )
        .join(
          '',
        )}</svg><span>ILLUSTRATED TRAIL GUIDE · NOT TO SCALE</span></div><div class="trail-list">${trails.map((tr, i) => `<button data-trail="${i}" class="trail-option ${this.activeTrail === i ? 'selected' : ''}"><small>0${i + 1} / ${tr.type}</small><h2>${tr.name} <span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span></h2><p>${tr.description}</p><div>${tr.grade} <span>↝ ${tr.distance}</span></div></button>`).join('')}<details class="test-stations"><summary>Vehicle physics proving ground</summary>${testStations.map((station, i) => `<button data-station="${i}">${station.name} →</button>`).join('')}</details></div></div></section>`;
      panel.querySelectorAll<HTMLElement>('[data-trail]').forEach((e) => {
        const select = () => {
          this.activeTrail = Number(e.dataset.trail);
          this.onTeleport(this.activeTrail);
          this.setMode('trail');
          document.getElementById('location-name')!.textContent =
            trails[this.activeTrail].name.toUpperCase();
        };
        e.onclick = select;
        e.onkeydown = (event) => {
          if (event.key === 'Enter') select();
        };
      });
      panel
        .querySelectorAll<HTMLElement>('[data-station]')
        .forEach(
          (button) => (button.onclick = () => this.onTestStation(Number(button.dataset.station))),
        );
    } else if (this.mode === 'settings') {
      panel.innerHTML = `<section class="modal-card"><div class="eyebrow">MAKE YOURSELF AT HOME</div><h1>Trail settings<span>.</span></h1><label>Graphics preset<select id="quality">${['Low', 'Medium', 'High', 'Ultra'].map((q) => `<option ${t.quality === q ? 'selected' : ''}>${q}</option>`).join('')}</select></label><p>Presets adjust rendering resolution, shadows and forest vegetation. Ultra is best suited to a dedicated GPU.</p><label class="toggle-row">Electric motor audio<input type="checkbox" id="audio" ${t.audio ? 'checked' : ''}></label><p>Procedural electric motor and servo tones. Audio starts after an interaction.</p><div id="control-settings"></div><button id="back" class="primary">Back to the trail <span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span></button><small>Local saves stay in this browser. No account required.</small></section>`;
      this.renderControls();
      document.getElementById('quality')!.onchange = (e) => {
        t.quality = (e.target as HTMLSelectElement).value as Tune['quality'];
        this.onTune();
      };
      document.getElementById('audio')!.onchange = () => this.onSound();
      this.click('back', () => this.setMode('trail'));
    } else {
      panel.innerHTML = `<section class="modal-card guide"><div class="eyebrow">THE FIELD GUIDE / FIRST THINGS FIRST</div><h1>Slow is smooth<span>.</span></h1><p>Choose a line before you choose the throttle. This is a 1:10 scale electric crawler: small inputs make a big difference.</p><div class="guide-grid"><div><b>01 / Find traction</b><p>Try to keep all four tyres loaded. Wet creek stone gives less grip than dry granite. Soft tyres help on rock.</p></div><div><b>02 / Work the suspension</b><p>Approach ledges diagonally. Watch wheel contact in the lower display. Adjust springs and damping in the workshop.</p></div><div><b>03 / Take control</b><p>W/S or ↑/↓: throttle. A/D or ←/→: steering. Space: brake. R: recover. C: camera. G: workshop. M: map. P: photo. Esc: return.</p></div><div><b>04 / Make it your own</b><p>Drag to orbit in the workshop or photo mode. Scroll to zoom. Gamepads support analogue left-stick steering and triggers for throttle.</p></div></div><p class="disclosure">Constrained four-link axles, physical wheel collisions and torque-driven steering. Tyre compliance uses a reduced radial model, not a full soft-body carcass. F2 opens telemetry; Shift enables precision throttle. Use the proving ground on the trail map to compare setups.</p><button id="back" class="primary">Let's crawl <span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span></button></section>`;
      this.click('back', () => this.setMode('trail'));
    }
  }
  renderTune(tab: 'tune' | 'style' | 'builds') {
    const t = this.state.tune,
      el = document.getElementById('garage-fields')!;
    for (const [id, active] of [
      ['tab-tune', tab === 'tune'],
      ['tab-style', tab === 'style'],
      ['tab-builds', tab === 'builds'],
    ] as const)
      document.getElementById(id)!.classList.toggle('active', active);
    if (tab === 'tune') {
      const select = (key: keyof Tune, name: string, options: [string, string][]) =>
        `<label>${name}<select id="${key}">${options.map(([value, label]) => `<option value="${value}" ${String(t[key]) === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`;
      const ranges: [keyof Tune, string, number, number, number, string, number?][] = [
        ['radius', 'Tyre diameter', 104, 134, 2, 'mm', 2000],
        ['tyreWidth', 'Tyre width', 34, 55, 1, 'mm', 1000],
        ['foam', 'Foam radial stiffness', 1200, 6000, 200, 'N/m'],
        ['spring', 'Shock spring rate', 200, 760, 40, 'N/m', 8],
        ['damping', 'Compression damping', 5.4, 27, 1.35, 'N·s/m', 2.7],
        ['ride', 'Shock free length', 85, 120, 5, 'mm', 1000],
        ['preload', 'Spring preload', 0, 15, 1, 'mm', 1000],
        ['gearRatio', 'Transmission ratio', 12, 35, 1, ':1'],
        ['axleRatio', 'Axle reduction', 3, 6, 0.2, ':1'],
        ['dragBrake', 'ESC drag brake', 0, 1, 0.05, ''],
        ['voltage', 'Battery voltage', 6, 11.1, 0.1, 'V'],
        ['capacity', 'Battery capacity', 1, 4, 0.2, 'Ah'],
        ['batteryPosition', 'Battery fore / aft', -150, 120, 10, 'mm', 1000],
        ['batteryHeight', 'Battery mounting height', 45, 160, 5, 'mm', 1000],
        ['wheelWeight', 'Added weight per wheel', 0, 150, 10, 'g', 1000],
        ['servoRate', 'Servo target rate', 1, 10, 0.5, 'rad/s'],
        ['servoTorque', 'Servo torque limit', 0.05, 3, 0.05, 'N·m'],
        ['endpoint', 'Steering endpoint', 14, 39, 1, '°', 180 / Math.PI],
        ['steeringExpo', 'Steering exponential', 0, 0.8, 0.05, ''],
        ['throttleExpo', 'ESC exponential', 0, 0.85, 0.05, ''],
        ['sensitivity', 'Throttle sensitivity', 0.2, 1, 0.05, ''],
        ['turns', 'Brushed motor winding', 20, 55, 1, 'T'],
        ['kv', 'Brushless motor KV', 800, 2500, 100, 'RPM/V'],
      ];
      el.innerHTML =
        select('compound', 'Tyre compound', [
          ['soft', 'Canyon S1 · Soft rock'],
          ['trail', 'Ranger T2 · Trail'],
          ['hard', 'Summit H3 · Hard'],
        ]) +
        select('motor', 'Gearbox profile', [
          ['torque', 'Crawler · Low range'],
          ['trail', 'Trail · High range'],
        ]) +
        select('motorKind', 'Motor technology', [
          ['brushed', '540 brushed'],
          ['brushless', 'Sensored brushless'],
        ]) +
        select('differential', '4WD differentials', [
          ['locked', 'Locked front / rear / transfer'],
          ['open', 'Open front & rear'],
        ]) +
        select('axleType', 'Axle layout', [
          ['straight', 'Straight axle'],
          ['portal', 'Portal · raised housing / 1.4:1'],
        ]) +
        ranges
          .map(([key, name, min, max, step, unit, factor = 1]) =>
            this.range(
              key,
              name,
              Number(t[key]) * factor + (key === 'ride' ? 35 : 0),
              min,
              max,
              step,
              unit,
            ),
          )
          .join('') +
        `<label class="toggle-row">Precision crawl mode<input type="checkbox" id="precision" ${t.precision ? 'checked' : ''}></label><p class="part-info">Metric physical parameters. Reduced carcass compliance changes rolling radius and contact squash; these are not arbitrary performance scores.</p>`;
      for (const key of ['compound', 'motor', 'motorKind', 'differential', 'axleType'])
        document.getElementById(key)!.onchange = (e) => {
          (t as any)[key] = (e.target as HTMLSelectElement).value;
          this.onTune();
        };
      for (const [key, , , , , unit, factor = 1] of ranges)
        document.getElementById(key)!.oninput = (e) => {
          const value = Number((e.target as HTMLInputElement).value);
          (t as any)[key] = (value - (key === 'ride' ? 35 : 0)) / factor;
          document.getElementById(key + '-value')!.textContent =
            `${Math.round(value * 100) / 100} ${unit}`;
          this.onTune();
        };
      document.getElementById('precision')!.onchange = (e) => {
        t.precision = (e.target as HTMLInputElement).checked;
        this.onTune();
      };
    } else if (tab === 'style') {
      el.innerHTML = `<label>Expedition paint</label><div class="swatches">${['#c48745', '#b7bdad', '#3b675d', '#923d2d', '#42657b', '#222b2d'].map((c) => `<button aria-label="Paint ${c}" data-color="${c}" style="--swatch:${c}" class="${t.paint === c ? 'chosen' : ''}"></button>`).join('')}</div><label class="toggle-row">Body shell<input id="body" type="checkbox" ${t.body ? 'checked' : ''}></label><p class="part-info">Remove the shell to inspect the frame rails, motor, ESC, battery, driveshafts and working linkages.</p><div class="part-spec"><small>BEADLOCK WHEEL SET</small><h3>Forged bronze / 1.9”</h3><p>16-bolt rings · machined hubs<br>120 individual tread lugs per tyre</p></div><div class="part-spec"><small>EXPEDITION EQUIPMENT</small><h3>Ready for the long way</h3><p>Roof basket · recovery boards<br>Front winch model · warm LED lighting</p></div><p class="part-info">Winch and accessories are visual models in this release. The winch does not pull the vehicle.</p>`;
      el.querySelectorAll<HTMLElement>('[data-color]').forEach(
        (b) =>
          (b.onclick = () => {
            t.paint = b.dataset.color!;
            this.onTune();
            this.renderTune('style');
          }),
      );
      document.getElementById('body')!.onchange = (e) => {
        t.body = (e.target as HTMLInputElement).checked;
        this.onTune();
      };
    } else {
      el.innerHTML = `<label>Save current setup<input id="build-name" maxlength="40" placeholder="e.g. Creek expedition" aria-label="Build name"></label><button id="save-build" class="secondary">＋ Save this build</button><div class="saved-builds">${this.state.builds.length ? this.state.builds.map((b, i) => `<button data-build="${i}"><span></span><b></b><small>Load setup <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></small></button>`).join('') : '<p class="part-info">Your trail-ready builds will appear here. Paint, tyres, motor and suspension settings are saved together.</p>'}</div><p class="part-info">Up to 8 builds, stored on this device.</p>`;
      el.querySelectorAll<HTMLElement>('[data-build]').forEach((b) => {
        const build = this.state.builds[Number(b.dataset.build)];
        b.querySelector('b')!.textContent = build.name;
        (b.querySelector('span') as HTMLElement).style.background = build.tune.paint;
        b.onclick = () => {
          Object.assign(this.state.tune, build.tune);
          this.onTune();
          this.toast('Build loaded: ' + build.name);
          this.renderTune('builds');
        };
      });
      this.click('save-build', () => {
        const name = (document.getElementById('build-name') as HTMLInputElement).value.trim();
        if (!name) {
          this.toast('Give your build a name first.');
          return;
        }
        if (this.state.builds.length >= 8) {
          this.toast('Eight builds saved. Load an existing build to use it.');
          return;
        }
        this.state.builds.push({ name, tune: { ...t } });
        this.onSave();
        this.renderTune('builds');
        this.toast('Build saved on this device.');
      });
    }
  }
  renderControls() {
    const panel = document.getElementById('control-settings')!;
    panel.innerHTML =
      '<h3>Transmitter bindings</h3><div class="binding-grid">' +
      (Object.keys(defaultBindings) as Action[])
        .map(
          (action) =>
            `<button data-bind="${action}"><span>${action}</span><kbd>${this.state.bindings[action]}</kbd></button>`,
        )
        .join('') +
      '</div><p>Click an action, then press a key. Shift is the default precision crawl modifier. F2 opens physical telemetry.</p>';
    panel.querySelectorAll<HTMLElement>('[data-bind]').forEach(
      (button) =>
        (button.onclick = () => {
          button.querySelector('kbd')!.textContent = 'Press a key';
          button.focus();
          button.onkeydown = (event) => {
            event.preventDefault();
            event.stopPropagation();
            if (event.code === 'Escape') {
              this.renderControls();
              return;
            }
            if (!isBindingCode(event.code)) {
              this.toast('Choose an unused key. C, G, M and P are reserved for camera and menus.');
              return;
            }
            const action = button.dataset.bind as Action;
            const existing = (Object.keys(this.state.bindings) as Action[]).find(
              (other) => other !== action && this.state.bindings[other] === event.code,
            );
            if (existing) {
              this.toast('Already assigned to ' + existing);
              return;
            }
            this.state.bindings[action] = event.code;
            this.onSave();
            this.renderControls();
          };
        }),
    );
  }
  range(
    id: string,
    name: string,
    value: number,
    min: number,
    max: number,
    step: number,
    unit: string,
  ) {
    return `<label class="range-label">${name}<output id="${id}-value">${Math.round(value * 10) / 10} ${unit}</output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
  }
  toast(message: string) {
    const toast = document.getElementById('toast')!;
    toast.textContent = message;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 3500);
  }
}
