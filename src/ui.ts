import { maps, mapSpec, type MapId } from './map-definitions';
import { powerSystems, powerSpec, motorConstants } from './dynamics/powertrain';
import type { Save } from './state';
import type { Tune } from './physics';
import { vehicles, vehicleSpec, vehicleTune, tuningPresets, type VehicleId } from './catalogue';
import { graphicPresets, type Graphics } from './graphics';
import { trails } from './world';
import { testStations } from './test-area';
import { isBindingCode } from './dynamics/controls';
import { defaultBindings, type Action } from './state';
export type Mode = 'home' | 'trail' | 'garage' | 'workshop' | 'map' | 'settings' | 'guide' | 'menu';
export class UI {
  mode: Mode = 'home';
  previewVehicle: VehicleId;
  menuReturn: Mode = 'trail';
  tuningCategory = 'Tyres';
  onVehicle: (id: VehicleId) => void = () => {};
  onPreviewVehicle: (id: VehicleId) => void = () => {};
  onGraphics = () => {};
  onWeather = () => {};
  onClean = () => {};
  onTestDrive = () => {};
  onDirtPreview: (clean: boolean) => void = () => {};
  onFreeRoam = () => {};
  onPreviewPose: (pose: string) => void = () => {};
  onPreviewSteer: (value: number) => void = () => {};
  activeTrail = 0;
  started = false;
  photo = false;
  onMode: (mode: Mode) => void = () => {};
  onTune: () => void = () => {};
  onRecover = () => {};
  onCheckpoint = () => {};
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
    this.previewVehicle = state.tune.vehicle;
    document.querySelector('#app')!.innerHTML = `
 <div id="scene"></div><div class="vignette"></div>
 <div id="loading"><span class="brand">△ RIDGEBOUND</span><span>Preparing the trail<span class="dots">…</span></span></div>
 <header><button class="logo" aria-label="Explore Ridgebound"><svg viewBox="0 0 44 35" aria-hidden="true"><path d="M2 30 17 4l9 16 5-9 11 19H2m9 0 9-15 9 15M17 4l5 11"/></svg><span>RIDGEBOUND<small>THE RC CRAWLING EXPERIENCE</small></span></button>
 <nav aria-label="Main navigation"><button data-mode="home" class="active">Home</button><button data-mode="garage">Garage</button><button data-mode="workshop">Tuning</button><button data-mode="map">Trails</button></nav>
 <div class="header-tools"><span class="credits"><i></i> <b id="credits">0</b> CHALLENGE POINTS</span><button class="icon" id="sound" aria-label="Toggle sound" title="Toggle sound">♫</button><button class="icon" data-mode="settings" aria-label="Settings" title="Settings">⚙</button></div></header>
 <aside class="location"><span class="live-dot"></span> SILVER PINE RESERVE <span class="divider">/</span> <span id="location-name">FERN CREEK</span><span class="weather">☀ 16°C · LATE AFTERNOON</span></aside>
 <main id="panel"></main>
 <div id="center-hint"></div><div id="driving-hud"><div class="hud-speed"><b id="hud-speed">0.0</b><small>km/h</small></div><span class="hud-chip" id="hud-battery">100%</span><span class="hud-chip" id="hud-mode">4WD / LOW</span><span id="hud-course"></span><div class="hud-actions"><button id="hud-recover">R · Recover</button><button id="hud-checkpoint" title="Return to last course gate">Checkpoint</button><button id="hud-camera">C · Camera</button><button id="hud-photo">P · Photo</button><button id="hud-menu">M · Menu</button></div><small id="hud-fps"></small></div>
 <div id="telemetry" class="telemetry"><div class="gear"><small>DRIVETRAIN</small><b>4WD <span>LOW</span></b></div><div class="speed"><b id="speed">0.0</b><span>km/h<small>GROUND SPEED</small></span></div><div><small>SURFACE</small><b id="surface">Dry granite</b></div><div class="contact"><small>WHEEL CONTACT</small><div id="contacts"><i></i><i></i><i></i><i></i></div></div><div><small>BODY ROLL</small><b id="roll">0°</b></div><div class="timer"><small>SESSION</small><b id="time">00:00</b></div></div>
 <footer><div class="controls"><span><kbd>W</kbd><kbd>S</kbd> Throttle</span><span><kbd>A</kbd><kbd>D</kbd> Steer</span><span><kbd>SPACE</kbd> Brake</span><button id="recover"><kbd>R</kbd> Recover</button></div><div class="view-controls"><button id="camera"><kbd>C</kbd> Chase camera</button><button id="photo"><kbd>P</kbd> Photo mode</button><button id="debug-toggle"><kbd>F2</kbd> Physics</button><span id="fps">— FPS</span></div></footer>
 <aside id="physics-debug" hidden><b>VEHICLE DYNAMICS / LIVE</b><p>F2 toggles telemetry and collision geometry</p><pre id="debug-data"></pre></aside><div id="toast" role="status"></div><div id="touch"><button data-key="KeyW" aria-label="Throttle forward">↑</button><button data-key="KeyS" aria-label="Reverse">↓</button><button data-key="KeyA" aria-label="Steer left">←</button><button data-key="KeyD" aria-label="Steer right">→</button></div>
 <div id="photo-tools"><span>PHOTO MODE · Drag to orbit · Scroll to zoom</span><label>Light<select id="photo-weather">${['Clear', 'Overcast', 'Rain', 'Fog', 'Sunset', 'Night'].map((w) => `<option>${w}</option>`).join('')}</select></label><label>DoF<input type="checkbox" id="photo-dof"></label><label>Focus / m<input id="photo-focus" type="range" min=".15" max="2.5" step=".01" value="1"></label><button id="download-photo">Save photograph <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></button><button id="exit-photo">Exit <kbd>P</kbd></button></div>`;
    document
      .querySelectorAll<HTMLElement>('[data-mode]')
      .forEach((b) => (b.onclick = () => this.setMode(b.dataset.mode as Mode)));
    document.querySelector<HTMLButtonElement>('.logo')!.onclick = () => this.setMode('home');
    this.click('hud-menu', () => this.toggleMenu());
    this.click('hud-recover', () => this.onRecover());
    this.click('hud-checkpoint', () => this.onCheckpoint());
    this.click('hud-camera', () => this.onCamera());
    this.click('hud-photo', () => this.onPhoto());
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
    if (mode === 'garage') this.previewVehicle = this.state.tune.vehicle;
    document.body.dataset.mode = mode;
    document
      .querySelectorAll('[data-mode]')
      .forEach((e) => e.classList.toggle('active', (e as HTMLElement).dataset.mode === mode));
    this.onMode(mode);
    this.render();
  }
  toggleMenu() {
    if (!this.started) {
      this.setMode('home');
      return;
    }
    if (this.mode === 'menu') this.setMode(this.menuReturn);
    else {
      this.menuReturn = this.mode;
      this.setMode('menu');
    }
  }
  render() {
    const t = this.state.tune,
      trail = trails[this.activeTrail];
    const panel = document.getElementById('panel')!;
    document.getElementById('credits')!.textContent = String(this.state.credits);
    document.body.dataset.playing = String(this.mode === 'trail' && this.started);
    document.body.classList.toggle('hide-hud', this.state.graphics.hideHUD);
    if (this.mode === 'trail' && this.started) {
      panel.innerHTML = '';
      return;
    }
    if (this.mode === 'home' || this.mode === 'menu') {
      this.renderMenu(panel);
      return;
    }
    if (this.mode === 'garage') {
      this.renderGarage(panel);
      return;
    }
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
    } else if (this.mode === 'workshop') {
      panel.innerHTML = `<section class="workshop-panel"><div class="eyebrow">RIDGEBOUND WORKS / BUILD 01</div><h1>The workshop<span>.</span></h1><p class="intro">Measured settings. Immediate, physical feedback.</p><div class="workshop-card"><div class="build-name"><div><small>ORIGINAL SCALE CRAWLER</small><h2>${vehicleSpec(t.vehicle).name}</h2></div><span class="badge">1:10</span></div><div class="tabs"><button class="active" id="tab-tune">Tuning</button><button id="tab-style">Appearance</button><button id="tab-builds">My builds</button></div><div class="tune-categories">${['Tyres', 'Suspension', 'Motor', 'Drivetrain', 'Steering', 'Weight', 'Electronics'].map((category) => `<button data-category="${category}" class="${this.tuningCategory === category ? 'active' : ''}">${category === 'Drivetrain' ? 'Gearing' : category}</button>`).join('')}</div><div id="garage-fields"></div><div class="spec-strip"><span><b id="mass-stat">—</b> kg</span><span><b>324</b> mm WB</span><span><b>4</b> driven wheels</span></div><button id="drive" class="primary">Test your setup <span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span></button><p class="autosave">● Changes saved on this device</p></div></section><div class="inspection-note"><span>360° INSPECTION</span><p>Drag to orbit · Scroll to inspect<br>Physical bench preview · drag to inspect</p><div class="preview-poses"><button data-pose="flat">Flat</button><button data-pose="articulation">Articulation</button><button data-pose="rock">Tyre on rock</button></div></div>`;
      panel
        .querySelectorAll<HTMLElement>('[data-pose]')
        .forEach((button) => (button.onclick = () => this.onPreviewPose(button.dataset.pose!)));
      this.renderTune('tune');
      panel.querySelectorAll<HTMLElement>('[data-category]').forEach(
        (button) =>
          (button.onclick = () => {
            this.tuningCategory = button.dataset.category!;
            this.render();
          }),
      );
      this.click('tab-tune', () => this.renderTune('tune'));
      this.click('tab-style', () => this.renderTune('style'));
      this.click('tab-builds', () => this.renderTune('builds'));
      this.click('drive', () => this.onTestStation(1));
    } else if (this.mode === 'map') {
      const currentMap = mapSpec(trail.map ?? 'forest');
      const localCourses = trails
        .map((course, index) => ({ course, index }))
        .filter(({ course }) => course.map === currentMap.id);
      const mapPaths = localCourses
        .map(({ course }) => {
          const p = [[course.x, course.z], ...course.gates];
          return `<polyline points="${p.map(([x, z]) => `${150 + (x - currentMap.x) * 22},${150 - (z - currentMap.z) * 22}`).join(' ')}" fill="none" stroke="${course.id === trail.id ? '#e6a84f' : '#6c7378'}" stroke-width="${course.id === trail.id ? 3 : 1.5}"/>`;
        })
        .join('');
      panel.innerHTML = `<section class="map-panel"><div class="eyebrow">FIELD LOCATIONS / ALL ACCESS</div><div class="map-tabs">${maps.map((map, i) => `<button data-map="${map.id}" class="${currentMap.id === map.id ? 'selected' : ''}"><small>0${i + 1}</small>${map.name}</button>`).join('')}</div><div class="map-layout-new"><div class="location-brief"><small>${currentMap.subtitle}</small><h1>${currentMap.name}</h1><p>${currentMap.description}</p><svg class="route-plan" viewBox="0 0 300 300" aria-label="Course plan"><defs><pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#ffffff0b" stroke-width=".5"/></pattern></defs><rect width="300" height="300" fill="url(#grid)"/>${mapPaths}<text x="18" y="24">N ↑</text><text x="18" y="282">1:10 / ROUTE PLAN</text></svg></div><div class="route-browser"><div class="route-heading"><span>COURSE / DIFFICULTY</span><span>PERSONAL BEST</span></div><div class="course-grid">${localCourses
        .map(({ course, index }) => {
          const record = this.state.records[course.id];
          return `<button class="course-tile ${this.activeTrail === index ? 'selected' : ''}" data-trail="${index}"><span class="grade-tag ${course.grade.toLowerCase()}">${course.grade}</span><div><h2>${course.name}</h2><p>${course.description}</p><small>${course.distance} / ${Math.round(course.gateWidth * 1000)} mm gates</small></div><b>${record?.bestTime ? record.bestTime.toFixed(1) + ' s' : '—'}</b></button>`;
        })
        .join(
          '',
        )}</div><div class="course-actions"><button id="drive-course" class="primary">Start timed course</button><button id="free-roam" class="secondary">Explore freely</button></div><details class="test-stations"><summary>Engineering test ground</summary>${testStations.map((station, i) => `<button data-station="${i}">${station.name}</button>`).join('')}</details></div></div></section>`;
      panel.querySelectorAll<HTMLElement>('[data-map]').forEach(
        (button) =>
          (button.onclick = () => {
            this.activeTrail = trails.findIndex((c) => c.map === button.dataset.map);
            this.render();
          }),
      );
      panel.querySelectorAll<HTMLElement>('[data-trail]').forEach(
        (button) =>
          (button.onclick = () => {
            this.activeTrail = Number(button.dataset.trail);
            this.render();
          }),
      );
      panel
        .querySelectorAll<HTMLElement>('[data-station]')
        .forEach(
          (button) => (button.onclick = () => this.onTestStation(Number(button.dataset.station))),
        );
      this.click('drive-course', () => {
        this.started = true;
        this.onStart();
        this.setMode('trail');
      });
      this.click('free-roam', () => {
        this.started = true;
        this.onFreeRoam();
        this.setMode('trail');
      });
    } else if (this.mode === 'settings') {
      panel.innerHTML = `<section class="modal-card graphics-menu"><div class="eyebrow">RENDERING & TRANSMITTER</div><h1>Make it your own<span>.</span></h1><label>Graphics preset<select id="quality">${['Low', 'Medium', 'High', 'Ultra', 'Auto', 'Custom'].map((p) => `<option ${this.state.graphics.preset === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label><label>Environment<select id="weather">${['Clear', 'Overcast', 'Rain', 'Fog', 'Sunset', 'Night'].map((weather) => `<option ${this.state.weather === weather ? 'selected' : ''}>${weather}</option>`).join('')}</select></label><div id="graphics-fields"></div><label class="toggle-row">Electric motor audio<input type="checkbox" id="audio" ${t.audio ? 'checked' : ''}></label><label class="toggle-row">Visual scuffs & scratches<input type="checkbox" id="visual-wear" ${this.state.preferences.visualWear ? 'checked' : ''}></label><div id="control-settings"></div><button id="back" class="primary">${this.started ? 'Resume driving' : 'Return home'} →</button><small>Rendering changes preserve the same wheel and suspension simulation.</small></section>`;
      this.renderGraphics();
      document.getElementById('visual-wear')!.onchange = (e) => {
        this.state.preferences.visualWear = (e.target as HTMLInputElement).checked;
        this.onSave();
      };
      document.getElementById('weather')!.onchange = (e) => {
        this.state.weather = (e.target as HTMLSelectElement).value as Save['weather'];
        this.onWeather();
      };
      this.renderControls();
      document.getElementById('quality')!.onchange = (e) => {
        const selected = (e.target as HTMLSelectElement).value;
        if (selected !== 'Custom')
          Object.assign(
            this.state.graphics,
            graphicPresets[selected as 'Low'] ?? graphicPresets.Medium,
            { preset: selected },
          );
        else this.state.graphics.preset = 'Custom';
        if (['Low', 'Medium', 'High', 'Ultra'].includes(selected))
          t.quality = selected as Tune['quality'];
        this.onGraphics();
        this.render();
      };
      document.getElementById('audio')!.onchange = () => this.onSound();
      this.click('back', () => this.setMode(this.started ? 'trail' : 'home'));
    } else {
      panel.innerHTML = `<section class="modal-card guide"><div class="eyebrow">THE FIELD GUIDE / FIRST THINGS FIRST</div><h1>Slow is smooth<span>.</span></h1><p>Choose a line before you choose the throttle. This is a 1:10 scale electric crawler: small inputs make a big difference.</p><div class="guide-grid"><div><b>01 / Find traction</b><p>Try to keep all four tyres loaded. Wet creek stone gives less grip than dry granite. Soft tyres help on rock.</p></div><div><b>02 / Work the suspension</b><p>Approach ledges diagonally. Watch wheel contact in the lower display. Adjust springs and damping in the workshop.</p></div><div><b>03 / Take control</b><p>W/S or ↑/↓: throttle. A/D or ←/→: steering. Space: brake. R: recover. C: camera. G: tuning workshop. M: pause/menu. P: photo. Esc: return.</p></div><div><b>04 / Make it your own</b><p>Drag to orbit in the workshop or photo mode. Scroll to zoom. Gamepads support analogue left-stick steering and triggers for throttle.</p></div></div><p class="disclosure">Constrained four-link axles, physical wheel collisions and torque-driven steering. Tyre compliance uses a reduced radial model, not a full soft-body carcass. F2 opens telemetry; Shift enables precision throttle. Use the proving ground on the trail map to compare setups.</p><button id="back" class="primary">Let's crawl <span><svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></span></button></section>`;
      this.click('back', () => this.setMode(this.started ? 'trail' : 'home'));
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
    const categoryBar = document.querySelector('.tune-categories') as HTMLElement | null;
    if (categoryBar) categoryBar.style.display = tab === 'tune' ? 'grid' : 'none';
    if (tab === 'tune') {
      const select = (key: keyof Tune, name: string, options: [string, string][]) =>
        `<label>${name}<select id="${key}">${options.map(([value, label]) => `<option value="${value}" ${String(t[key]) === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>`;
      const ranges: [keyof Tune, string, number, number, number, string, number?][] = [
        ['radius', 'Tyre diameter', 104, 134, 2, 'mm', 2000],
        ['tyreWidth', 'Tyre width', 34, 55, 1, 'mm', 1000],
        ['foam', 'Carcass / insert stiffness', 400, 8000, 100, 'N/m'],
        ['sidewall', 'Sidewall stiffness', 400, 8000, 100, 'N/m'],
        ['spring', 'Shock spring rate', 200, 760, 40, 'N/m', 8],
        ['rearSpring', 'Rear spring rate', 200, 760, 40, 'N/m', 8],
        ['rearDamping', 'Rear compression damping', 5.4, 27, 1.35, 'N·s/m', 2.7],
        ['rebound', 'Rebound damping', 5, 40, 1, 'N·s/m'],
        ['travel', 'Front shock stroke', 40, 90, 1, 'mm', 1000],
        ['rearTravel', 'Rear shock stroke', 40, 90, 1, 'mm', 1000],
        ['damping', 'Compression damping', 5.4, 27, 1.35, 'N·s/m', 2.7],
        ['ride', 'Shock free length', 85, 120, 5, 'mm', 1000],
        ['preload', 'Spring preload', 0, 15, 1, 'mm', 1000],
        ['gearRatio', 'Transmission ratio', 12, 35, 1, ':1'],
        ['axleRatio', 'Axle reduction', 3, 6, 0.2, ':1'],
        ['frontOverdrive', 'Front overdrive', 0, 20, 1, '%', 100],
        ['rearUnderdrive', 'Rear underdrive', 0, 20, 1, '%', 100],
        ['ballast', 'Chassis ballast', 0, 300, 10, 'g', 1000],
        ['ballastPosition', 'Ballast fore / aft', -120, 120, 5, 'mm', 1000],
        ['linkHeight', 'Chassis link mount offset', -5, 5, 1, 'mm', 1000],
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
        ['escCurrent', 'ESC phase current limit', 10, 80, 1, 'A'],
        ['batteryCurrent', 'Battery current limit', 10, 60, 1, 'A'],
        ['batteryResistance', 'Pack resistance', 8, 80, 1, 'mΩ', 1000],
        ['escPunch', 'Throttle slew', 0.5, 5, 0.1, '/s'],
        ['drivetrainEfficiency', 'Drivetrain efficiency', 60, 95, 1, '%', 100],
      ];
      const groups: Record<string, string[]> = {
        Tyres: ['radius', 'tyreWidth', 'foam', 'sidewall'],
        Suspension: [
          'spring',
          'rearSpring',
          'damping',
          'rearDamping',
          'rebound',
          'ride',
          'preload',
          'travel',
          'rearTravel',
          'linkHeight',
        ],
        Motor: ['voltage', 'capacity', 'turns', 'kv', 'throttleExpo', 'sensitivity', 'dragBrake'],
        Drivetrain: ['gearRatio', 'axleRatio', 'frontOverdrive', 'rearUnderdrive'],
        Weight: ['batteryPosition', 'batteryHeight', 'wheelWeight', 'ballast', 'ballastPosition'],
        Steering: ['servoRate', 'servoTorque', 'endpoint', 'steeringExpo'],
        Electronics: [
          'escCurrent',
          'batteryCurrent',
          'batteryResistance',
          'escPunch',
          'drivetrainEfficiency',
          'dragBrake',
        ],
      };
      let fields = '';
      if (this.tuningCategory === 'Tyres')
        fields += select('tread', 'Tread pattern', [
          ['rock', 'Dense rock blocks'],
          ['trail', 'Open trail chevrons'],
        ]);
      if (this.tuningCategory === 'Tyres')
        fields += select('compound', 'Rubber compound', [
          ['soft', 'Soft crawler'],
          ['trail', 'Trail rubber'],
          ['hard', 'Hard compound'],
        ]);
      if (this.tuningCategory === 'Motor')
        fields += select(
          'powerSystem',
          'Power system',
          powerSystems.map((p) => [p.id, p.name]),
        );
      if (this.tuningCategory === 'Motor')
        fields += select('motorKind', 'Motor technology', [
          ['brushed', '540 brushed'],
          ['brushless', 'Sensored brushless'],
        ]);
      if (this.tuningCategory === 'Drivetrain')
        fields +=
          select('motor', 'Transmission mode', [
            ['torque', 'Low range'],
            ['trail', 'Trail range'],
          ]) +
          select('differential', 'Differentials', [
            ['locked', 'Locked'],
            ['open', 'Open'],
          ]) +
          select('axleType', 'Axle layout', [
            ['straight', 'Straight'],
            ['portal', 'Portal · 1.4:1'],
          ]);
      fields += ranges
        .filter(([key]) => groups[this.tuningCategory].includes(key))
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
        .join('');
      if (this.tuningCategory === 'Steering')
        fields += this.range('preview-steer', 'Live steering test', 0, -1, 1, 0.05, '');
      el.innerHTML =
        `<label>Setup recipe<select id="setup-preset"><option value="">Choose a physical preset…</option>${tuningPresets.map((preset, i) => `<option value="${i}">${preset.name}</option>`).join('')}</select></label>` +
        fields +
        `<label class="toggle-row">Precision crawl<input type="checkbox" id="precision" ${t.precision ? 'checked' : ''}></label><p class="part-info">${this.tuningCategory === 'Motor' ? `${Math.round(motorConstants(t).kv)} KV · ${(motorConstants(t).kt * 1000).toFixed(1)} mN·m/A · ${Math.round(motorConstants(t).kv * t.voltage).toLocaleString()} nominal no-load RPM. ${powerSpec(t).sensored ? 'Sensored ESC compensates for load at low shaft speeds.' : 'Brushed PWM responds directly to winding voltage and load.'}` : this.tuningCategory === 'Electronics' ? 'Phase current limits motor torque; battery current and pack resistance limit input power. F2 shows actual current, voltage and temperature.' : 'Physical settings change contact, articulation and the live test response.'}</p>`;
      if (document.getElementById('preview-steer'))
        document.getElementById('preview-steer')!.oninput = (e) => {
          const value = Number((e.target as HTMLInputElement).value);
          document.getElementById('preview-steer-value')!.textContent = String(value);
          this.onPreviewSteer(value);
        };
      document.getElementById('setup-preset')!.onchange = (e) => {
        const value = (e.target as HTMLSelectElement).value;
        if (value === '') return;
        Object.assign(t, tuningPresets[Number(value)].tune);
        this.onTune();
        this.renderTune('tune');
        this.toast(tuningPresets[Number(value)].description);
      };
      if (document.getElementById('powerSystem'))
        document.getElementById('powerSystem')!.onchange = (e) => {
          const id = (e.target as HTMLSelectElement).value as Tune['powerSystem'];
          Object.assign(t, powerSystems.find((p) => p.id === id)!.preset, { powerSystem: id });
          this.onTune();
          this.renderTune('tune');
        };
      for (const key of ['compound', 'tread', 'motor', 'motorKind', 'differential', 'axleType'])
        if (document.getElementById(key))
          document.getElementById(key)!.onchange = (e) => {
            (t as any)[key] = (e.target as HTMLSelectElement).value;
            if (key === 'motorKind')
              t.powerSystem = t.motorKind === 'brushed' ? 'scale' : 'sensored';
            this.onTune();
          };
      for (const [key, , , , , unit, factor = 1] of ranges)
        if (document.getElementById(key))
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
          if (this.state.tune.vehicle !== build.tune.vehicle) this.onVehicle(build.tune.vehicle);
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
  renderMenu(panel: HTMLElement) {
    const paused = this.mode === 'menu';
    panel.innerHTML = `<section class="main-menu ${paused ? 'pause-menu' : ''}"><div class="eyebrow">${paused ? 'TRANSMITTER PAUSED' : 'RIDGEBOUND / RC FIELD SIMULATOR'}</div><h1>${paused ? 'Take a breath.' : 'BUILT FOR<br>THE CLIMB.'}</h1><p>${paused ? 'Your vehicle and course clock are paused.' : 'Five locations. Four distinct rigs. One open garage.'}</p><div class="main-actions">${paused ? '<button id="resume" class="primary">Resume driving <kbd>M</kbd></button>' : ''}${paused ? '' : '<button id="quick-drive" class="primary">Drive <span>↗</span></button>'}<button data-go="map">Trails <span>01 — 05</span></button><button data-go="garage">Vehicle garage <span>02</span></button><button data-go="workshop">Tuning workshop <span>03</span></button><button data-go="settings">Settings <span>04</span></button>${paused ? '<button id="leave-trail">Leave trail / main menu</button>' : ''}</div><small>${vehicleSpec(this.state.tune.vehicle).name} · 1:10 scale · ${vehicles.length} vehicles · all available</small></section>`;
    panel
      .querySelectorAll<HTMLElement>('[data-go]')
      .forEach((button) => (button.onclick = () => this.setMode(button.dataset.go as Mode)));
    if (!paused)
      this.click('quick-drive', () => {
        this.started = true;
        this.onFreeRoam();
        this.setMode('trail');
      });
    if (paused) {
      this.click('resume', () => this.setMode('trail'));
      this.click('leave-trail', () => {
        this.started = false;
        this.setMode('home');
      });
    }
  }
  renderGarage(panel: HTMLElement) {
    const spec = vehicleSpec(this.previewVehicle),
      selected = this.state.tune.vehicle === spec.id,
      tune = selected
        ? this.state.tune
        : (this.state.vehicleTunes[spec.id] ?? vehicleTune(spec.id));
    const mass =
      3.16 +
      spec.chassisMass -
      1.05 +
      spec.bodyMass -
      0.32 +
      (((tune.capacity / 2.2) * tune.voltage) / 7.4 - 1) * 0.34 +
      tune.wheelWeight * 4 +
      tune.ballast;
    panel.innerHTML = `<section class="selection-panel"><div class="eyebrow">FIELD WORKS / OPEN GARAGE</div><h1>OPEN GARAGE<span>.</span></h1><p class="intro">Every crawler and every tuning part is available from the start.</p><button id="test-drive-vehicle" class="primary">Test-drive ${spec.name} <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18 18 6M6 6h12v12"/></svg></button><div class="vehicle-cards">${vehicles.map((v) => `<button data-vehicle="${v.id}" class="${spec.id === v.id ? 'selected' : ''}"><span class="paint-dot" style="background:${v.paint}"></span><div><small>READY TO DRIVE</small><b>${v.name}</b><span>${v.category}</span></div></button>`).join('')}</div><div class="vehicle-info"><small>${spec.category}</small><h2>${spec.name}</h2><p>${spec.description}</p><dl><div><dt>Scale / wheelbase</dt><dd>${spec.scale} / ${spec.wheelbase} mm</dd></div><div><dt>Configured mass</dt><dd>${mass.toFixed(2)} kg</dd></div><div><dt>Tyres / drive</dt><dd>${Math.round(tune.radius * 2000)} × ${Math.round(tune.tyreWidth * 1000)} mm / 4WD</dd></div><div><dt>Shock stroke F / R</dt><dd>${Math.round(tune.travel * 1000)} / ${Math.round(tune.rearTravel * 1000)} mm</dd></div><div><dt>Steering demand</dt><dd>${Math.round((tune.endpoint * 180) / Math.PI)}° / ${tune.servoTorque.toFixed(1)} N·m</dd></div><div><dt>Gearing / axles</dt><dd>${tune.gearRatio}:1 × ${tune.axleRatio}:1 / ${tune.axleType}</dd></div><div><dt>Motor / battery</dt><dd>${tune.motorKind === 'brushed' ? tune.turns + 'T' : tune.kv + 'KV'} / ${tune.voltage.toFixed(1)} V</dd></div><div><dt>Body COM mount</dt><dd>${Math.round(spec.bodyHeight * 1000)} mm above chassis origin</dd></div></dl><div class="swatches">${['#496d62', '#c4bca4', '#944d37', '#385d74', '#303936'].map((color) => `<button data-garage-paint="${color}" style="--swatch:${color}" aria-label="Paint ${color}"></button>`).join('')}</div><button id="select-vehicle" class="primary">${selected ? 'Take this rig to tuning' : 'Select ' + spec.name} ↗</button><button id="clean-vehicle" class="secondary">Clean & reset visual wear</button><div class="finish-comparison"><button id="show-current">Current finish</button><button id="show-clean">Clean preview</button></div><p class="part-info">All vehicles and parts are ready to use. Challenge points track optional progress.</p></div></section><div class="inspection-note"><span>${spec.scale} / ROTATE TO INSPECT</span><p>Drag to orbit · scroll to zoom<br>Models and components are real geometry</p></div>`;
    const select = () => {
      if (!selected) this.onVehicle(spec.id);
    };
    panel.querySelectorAll<HTMLElement>('[data-vehicle]').forEach(
      (button) =>
        (button.onclick = () => {
          this.previewVehicle = button.dataset.vehicle as VehicleId;
          this.onPreviewVehicle(this.previewVehicle);
          this.render();
        }),
    );
    panel.querySelectorAll<HTMLElement>('[data-garage-paint]').forEach(
      (button) =>
        (button.onclick = () => {
          select();
          this.state.tune.paint = button.dataset.garagePaint!;
          this.onTune();
        }),
    );
    this.click('select-vehicle', () => {
      select();
      this.setMode('workshop');
    });
    this.click('test-drive-vehicle', () => {
      select();
      this.onTestDrive();
    });
    this.click('show-current', () => this.onDirtPreview(false));
    this.click('show-clean', () => this.onDirtPreview(true));
    this.click('clean-vehicle', () => {
      select();
      this.onClean();
      this.toast('Vehicle cleaned.');
    });
  }
  renderGraphics() {
    const g = this.state.graphics,
      el = document.getElementById('graphics-fields')!;
    const sliders: [keyof Graphics, string, number, number, number][] = [
      ['scale', 'Resolution scale', 0.5, 1.5, 0.05],
      ['vegetation', 'Vegetation density', 0.1, 1, 0.05],
      ['particles', 'Contact particle density', 0, 1, 0.1],
      ['tracks', 'Maximum track marks', 0, 400, 20],
      ['exposure', 'Exposure', 0.65, 1.5, 0.05],
      ['anisotropy', 'Texture anisotropy', 1, 16, 1],
      ['drawDistance', 'Draw distance (metres)', 25, 160, 5],
    ];
    el.innerHTML =
      `<label>Material texture size<select id="texture-size">${[128, 256, 512, 1024].map((v) => `<option value="${v}" ${g.textureSize === v ? 'selected' : ''}>${v} px</option>`).join('')}</select></label><label>Wheel geometry detail<select id="wheel-detail">${['Low', 'Medium', 'High'].map((name, i) => `<option value="${i}" ${g.wheelDetail === i ? 'selected' : ''}>${name}</option>`).join('')}</select></label><label class="toggle-row">Visible tyre deformation<input id="tyre-deformation" type="checkbox" ${g.tyreDeformation ? 'checked' : ''}></label>` +
      sliders
        .map(([key, name, min, max, step]) =>
          this.range(key, name, Number(g[key]), min, max, step, ''),
        )
        .join('') +
      `<label>Shadow resolution<select id="shadow-quality">${['Off', '512', '1024', '2048'].map((value, i) => `<option value="${i}" ${g.shadows === i ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Frame limit<select id="fps-limit">${[0, 30, 60, 90, 120].map((value) => `<option value="${value}" ${g.fpsLimit === value ? 'selected' : ''}>${value || 'Unlimited'}</option>`).join('')}</select></label>` +
      (
        [
          'water',
          'accumulation',
          'ao',
          'bloom',
          'dof',
          'dynamicResolution',
          'showFPS',
          'hideHUD',
        ] as const
      )
        .map(
          (key) =>
            `<label class="toggle-row">${{ water: 'Detailed water & ripples', accumulation: 'Visible mud accumulation', ao: 'Screen-space ambient occlusion', bloom: 'Subtle LED bloom', dof: 'Macro depth of field', dynamicResolution: 'Dynamic resolution', showFPS: 'Show render FPS', hideHUD: 'Hide driving instruments' }[key]}<input type="checkbox" data-graphic="${key}" ${g[key] ? 'checked' : ''}></label>`,
        )
        .join('');
    const custom = () => {
      g.preset = 'Custom';
      (document.getElementById('quality') as HTMLSelectElement).value = 'Custom';
      this.onGraphics();
    };
    document.getElementById('texture-size')!.onchange = (e) => {
      g.textureSize = Number((e.target as HTMLSelectElement).value) as Graphics['textureSize'];
      custom();
    };
    document.getElementById('wheel-detail')!.onchange = (e) => {
      g.wheelDetail = Number((e.target as HTMLSelectElement).value) as Graphics['wheelDetail'];
      custom();
    };
    document.getElementById('tyre-deformation')!.onchange = (e) => {
      g.tyreDeformation = (e.target as HTMLInputElement).checked;
      custom();
    };
    for (const [key] of sliders)
      document.getElementById(key)!.oninput = (e) => {
        (g as any)[key] = Number((e.target as HTMLInputElement).value);
        g.preset = 'Custom';
        document.getElementById(key + '-value')!.textContent = String(g[key]);
        const preset = document.getElementById('quality') as HTMLSelectElement;
        if (preset) preset.value = g.preset;
        this.onGraphics();
      };
    document.getElementById('shadow-quality')!.onchange = (e) => {
      g.shadows = Number((e.target as HTMLSelectElement).value) as Graphics['shadows'];
      g.preset = 'Custom';
      const preset = document.getElementById('quality') as HTMLSelectElement;
      if (preset) preset.value = g.preset;
      this.onGraphics();
    };
    document.getElementById('fps-limit')!.onchange = (e) => {
      g.fpsLimit = Number((e.target as HTMLSelectElement).value) as Graphics['fpsLimit'];
      g.preset = 'Custom';
      const preset = document.getElementById('quality') as HTMLSelectElement;
      if (preset) preset.value = g.preset;
      this.onGraphics();
    };
    el.querySelectorAll<HTMLInputElement>('[data-graphic]').forEach(
      (input) =>
        (input.onchange = () => {
          (g as any)[input.dataset.graphic!] = input.checked;
          g.preset = 'Custom';
          (document.getElementById('quality') as HTMLSelectElement).value = 'Custom';
          this.onGraphics();
        }),
    );
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
