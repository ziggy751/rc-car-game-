import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-800.css';
import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { ContactAudio } from './contact-audio';
import { validateCondition, averageMud } from './soiling';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Crawler } from './vehicle';
import { Park, groundHeight, trails } from './world';
import { Simulation, type Input } from './physics';
import { loadState, saveState, selectVehicle, type Action } from './state';
import { UI, type Mode } from './ui';
import { FixedClock } from './dynamics/clock';
import { TestArea, testStations } from './test-area';
import { recoverySupport } from './dynamics/collision';
import { bindingDown, touchBinding } from './dynamics/controls';
import { surfaces } from './dynamics/surfaces';
import { batchStatic } from './optimize';
import { Showroom } from './showroom';
import { vehicleTune, vehicleSpec, type VehicleId } from './catalogue';
import { CourseRun } from './courses';
import { EnvironmentEffects } from './environment-effects';
import { Rendering } from './rendering';
import { surfaceMaterial } from './material-library';
import './style.css';
import './upgrade.css';

async function boot() {
  const state = loadState(),
    ui = new UI(state);
  await RAPIER.init();
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  document.getElementById('scene')!.append(renderer.domElement);
  const scene = new T.Scene(),
    camera = new T.PerspectiveCamera(38, innerWidth / innerHeight, 0.008, 150);
  const pmrem = new T.PMREMGenerator(renderer),
    roomEnv = pmrem.fromScene(new RoomEnvironment(), 0.04);
  pmrem.dispose();
  scene.environmentIntensity = 0.65;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 }),
    park = new Park(scene, world),
    testArea = new TestArea(world),
    showroom = new Showroom();
  scene.add(testArea.group, showroom.group);
  batchStatic(park.vegetation);
  park.vegetation.removeFromParent();
  batchStatic(park.group);
  park.group.add(park.vegetation);
  batchStatic(park.garage);
  batchStatic(testArea.group);
  batchStatic(showroom.group);
  const render = new Rendering(renderer, scene, camera, park, roomEnv.texture);
  render.weather(state.weather);
  const heightAt = (x: number, z: number) =>
    x > 6 && x < 16 && z > -13 && z < -1 ? 0 : groundHeight(x, z);
  const surfaceAt = (p: RAPIER.Vector, c: RAPIER.Collider) => {
    const known = park.materialSurfaces.get(c.handle) ?? testArea.materials.get(c.handle);
    const poolLevel = testArea.waterLevel(p.x, p.z);
    if (poolLevel !== null && p.y < poolLevel) return surfaces['Wet rock'];
    let surface =
      known ??
      (Math.abs(p.z - 3.7) < 0.43
        ? surfaces['Wet rock']
        : p.x > -0.6 && p.x < 0.9 && p.z > 4.4 && p.z < 5.7
          ? surfaces.Mud
          : surfaces['Forest loam']);
    if (state.weather === 'Rain') {
      if (surface.name === 'Dry granite') surface = { ...surfaces['Wet rock'] };
      else if (surface.name === 'Forest loam') surface = { ...surfaces.Mud };
    }
    return surface;
  };
  let sim = new Simulation(world, state.tune, { heightAt, surfaceAt }),
    car: Crawler,
    carId: VehicleId = state.tune.vehicle;
  const previewWorld = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  previewWorld.createCollider(
    RAPIER.ColliderDesc.cuboid(2, 0.05, 2).setTranslation(0, -0.05, 0).setFriction(1),
  );
  let preview = new Simulation(previewWorld, state.tune),
    previewObstacle: RAPIER.Collider | null = null;
  const fixture: T.Mesh<T.BufferGeometry> = new T.Mesh(
    new T.SphereGeometry(0.045, 32, 20),
    surfaceMaterial('rock'),
  );
  fixture.visible = false;
  fixture.castShadow = true;
  fixture.receiveShadow = true;
  scene.add(fixture);
  const effects = new EnvironmentEffects(
    heightAt,
    (p) =>
      testArea.waterLevel(p.x, p.z) ??
      (Math.abs(p.z - 3.7) < 0.39 && Math.abs(p.x) < 12.5 ? park.water.position.y : null),
  );
  effects.condition = validateCondition(
    state.condition[state.tune.vehicle],
    state.dirt[state.tune.vehicle] ?? 0,
  );
  scene.add(effects.group);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.085;
  orbit.minDistance = 0.23;
  orbit.maxDistance = 2.2;
  orbit.maxPolarAngle = Math.PI * 0.84;
  const clock = new FixedClock(),
    previewClock = new FixedClock(),
    keys = new Set<string>();
  let sceneMode: 'trail' | 'garage' | 'workshop' = 'garage',
    run: CourseRun | null = null,
    camMode = state.preferences.camera,
    debug = false,
    previewSteer = 0,
    last = performance.now(),
    lastRender = 0,
    fpsTime = 0,
    renderFrames = 0,
    saveTime = 0,
    cleanPreview = false;
  const debugLines = new T.LineSegments(
    new T.BufferGeometry(),
    new T.LineBasicMaterial({ color: '#d8c087', depthTest: false }),
  );
  debugLines.visible = false;
  debugLines.renderOrder = 10;
  scene.add(debugLines);
  const lamps: T.SpotLight[] = [];
  function buildCar(id: VehicleId) {
    if (car) car.dispose();
    lamps.length = 0;
    car = new Crawler(id);
    carId = id;
    scene.add(car.root);
    batchStatic(car.shell);
    batchStatic(car.mechanics);
    batchStatic(car.battery);
    car.wheels.forEach((w) => batchStatic(w.children[0]));
    car.axles.forEach(batchStatic);
    car.springs.forEach(batchStatic);
    for (const x of [-0.07, 0.07]) {
      const lamp = new T.SpotLight('#ffe1a0', 0.28, 2.5, 0.48, 0.5, 2);
      lamp.position.set(x, id === 'r1' || id === 'w3' ? 0.098 : 0.064, 0.23);
      lamp.target.position.set(x, 0.01, 1.4);
      lamp.castShadow = true;
      lamp.shadow.mapSize.set(512, 512);
      car.root.add(lamp, lamp.target);
      lamps.push(lamp);
    }
    render.lastKey = '';
  }
  function previewFor(id: VehicleId) {
    preview.dispose();
    if (previewObstacle) {
      previewWorld.removeCollider(previewObstacle, true);
      previewObstacle = null;
    }
    fixture.visible = false;
    const tune =
      id === state.tune.vehicle ? state.tune : (state.vehicleTunes[id] ?? vehicleTune(id));
    preview = new Simulation(previewWorld, tune);
    for (let i = 0; i < 120; i++) preview.step(1 / 240, { throttle: 0, steer: 0, brake: true });
    previewClock.reset();
  }
  function persist() {
    state.vehicleTunes[state.tune.vehicle] = { ...state.tune };
    state.dirt[sim.tune.vehicle] = effects.soil;
    state.condition[sim.tune.vehicle] = validateCondition(effects.condition);
    if (!saveState(state)) ui.toast('Storage is unavailable. Changes last for this session only.');
  }
  function applyTune() {
    sim.applyTune();
    if (preview.tune.vehicle === state.tune.vehicle) preview.applyTune();
    const tune = preview.tune;
    car.paint.color.set(tune.paint);
    car.shell.visible = tune.body;
    car.setTyres(tune.radius);
    car.battery.position.set(0, tune.batteryHeight - 0.066, tune.batteryPosition + 0.119);
    persist();
  }
  function studio(mode: 'garage' | 'workshop', id = state.tune.vehicle) {
    sceneMode = mode;
    if (carId !== id) buildCar(id);
    previewFor(id);
    const x = mode === 'garage' ? 100 : 60;
    orbit.enabled = true;
    orbit.target.set(x - 0.115, 0.2 + (mode === 'garage' ? 0.106 : 0.326), 0.095);
    camera.position.set(x + 0.68, 0.54 + (mode === 'garage' ? 0.106 : 0.326), 0.79);
    orbit.minDistance = 0.22;
    orbit.maxDistance = 1.65;
    orbit.update();
    car.paint.color.set(preview.tune.paint);
    car.shell.visible = preview.tune.body;
  }
  buildCar(state.tune.vehicle);
  ui.onTune = applyTune;
  ui.onSave = persist;
  ui.onGraphics = () => {
    render.lastKey = '';
    document.body.classList.toggle('hide-hud', state.graphics.hideHUD);
    persist();
  };
  ui.onWeather = () => {
    render.weather(state.weather);
    persist();
  };
  ui.onVehicle = (id) => {
    persist();
    selectVehicle(state, id);
    const p = sim.body.translation();
    sim.dispose();
    sim = new Simulation(world, state.tune, { heightAt, surfaceAt });
    sim.reset(p.x, p.z);
    sim.paused = ui.mode !== 'trail';
    effects.condition = validateCondition(state.condition[id], state.dirt[id] ?? 0);
    run = null;
    buildCar(id);
    studio(ui.mode === 'workshop' ? 'workshop' : 'garage', id);
    applyTune();
  };
  ui.onTestDrive = () => ui.onTestStation(0);
  ui.onPreviewVehicle = (id) => {
    studio('garage', id);
  };
  ui.onDirtPreview = (clean) => {
    cleanPreview = clean;
  };
  ui.onClean = () => {
    cleanPreview = false;
    effects.clean();
    state.dirt[state.tune.vehicle] = 0;
    persist();
  };
  ui.onMode = (mode) => {
    cleanPreview = false;
    sim.paused = mode !== 'trail';
    clock.reset();
    previewClock.reset();
    keys.clear();
    if (mode === 'home' || mode === 'garage') studio('garage', state.tune.vehicle);
    else if (mode === 'workshop') studio('workshop', state.tune.vehicle);
    else if (mode === 'trail') {
      const previousScene = sceneMode;
      sceneMode = 'trail';
      if (carId !== state.tune.vehicle) buildCar(state.tune.vehicle);
      car.paint.color.set(state.tune.paint);
      car.shell.visible = state.tune.body;
      car.sync(sim, sim.pose(1));
      if (previousScene !== 'trail') {
        camera.position.copy(car.root.position).add(new T.Vector3(0.5, 0.35, -0.8));
        orbit.target.copy(car.root.position).add(new T.Vector3(0, 0.12, 0));
      }
      orbit.enabled = camMode === 3;
    }
    if (mode === 'menu' || mode === 'map' || mode === 'settings' || mode === 'guide')
      orbit.enabled = false;
    render.lastKey = '';
  };
  ui.onStart = () => {
    const course = trails[ui.activeTrail];
    sim.reset(course.x, course.z);
    sim.elapsed = 0;
    run = new CourseRun(course);
    ui.started = true;
    ui.toast(course.grade + ' · ' + course.name + ' · ' + course.gates.length + ' gates');
  };
  ui.onFreeRoam = () => {
    const course = trails[ui.activeTrail];
    sim.reset(course.x, course.z);
    run = null;
    ui.started = true;
    ui.toast('Free roam · no timer, no gates required.');
  };
  ui.onTeleport = (i) => {
    ui.activeTrail = i;
    ui.onFreeRoam();
    ui.setMode('trail');
  };
  ui.onTestStation = (index) => {
    const station = testStations[index];
    sim.reset(station.x, station.z);
    run = null;
    ui.started = true;
    ui.setMode('trail');
    ui.toast(station.name + ' · G returns to tuning, M opens the menu.');
  };
  ui.onRecover = () => {
    if (ui.mode !== 'trail') return;
    const p = sim.body.translation(),
      support = recoverySupport(
        world,
        p.x,
        p.z,
        p.y + 1,
        new Set(sim.parts.map((b) => b.handle)),
        heightAt(p.x, p.z),
      );
    sim.reset(p.x, p.z, support);
    run?.recover();
    run?.reposition(p.x, p.z);
    ui.toast(run ? 'Recovered · +20 seconds and a precision penalty.' : 'Vehicle recovered.');
  };
  ui.onCheckpoint = () => {
    if (ui.mode !== 'trail') return;
    const p = run?.checkpoint() ?? { x: trails[ui.activeTrail].x, z: trails[ui.activeTrail].z };
    sim.reset(p.x, p.z);
    if (run) {
      run.recover();
      run.reposition(p.x, p.z);
    }
    ui.toast(run ? 'Returned to last gate · +20 seconds.' : 'Returned to trailhead · free roam.');
  };
  ui.onPreviewSteer = (value) => {
    previewSteer = value;
  };
  ui.onPreviewPose = (pose) => {
    if (previewObstacle) {
      previewWorld.removeCollider(previewObstacle, true);
      previewObstacle = null;
    }
    preview.reset();
    fixture.visible = pose !== 'flat';
    if (pose === 'rock') {
      previewObstacle = previewWorld.createCollider(
        RAPIER.ColliderDesc.ball(0.045).setTranslation(-0.128, 0.025, 0.162).setFriction(1),
      );
      fixture.geometry.dispose();
      fixture.geometry = new T.SphereGeometry(0.045, 32, 20);
      fixture.position.set(60 - 0.128, 0.326 + 0.025, 0.162);
    } else if (pose === 'articulation') {
      previewObstacle = previewWorld.createCollider(
        RAPIER.ColliderDesc.cuboid(0.04, 0.022, 0.055)
          .setTranslation(-0.128, 0.022, 0.162)
          .setFriction(1),
      );
      fixture.geometry.dispose();
      fixture.geometry = new T.BoxGeometry(0.08, 0.044, 0.11);
      fixture.position.set(60 - 0.128, 0.326 + 0.022, 0.162);
    }
  };
  const cameraNames = [
    'Chase camera',
    'Low RC camera',
    'Body camera',
    'Orbit camera',
    'Suspension camera',
    'Cinematic camera',
  ];
  ui.onCamera = () => {
    if (ui.mode !== 'trail') return;
    camMode = (camMode + 1) % 6;
    state.preferences.camera = camMode;
    persist();
    orbit.enabled = camMode === 3;
    orbit.target.copy(car.root.position).add(new T.Vector3(0, 0.12, 0));
    document.getElementById('camera')!.innerHTML = '<kbd>C</kbd> ' + cameraNames[camMode];
  };
  ui.onPhoto = () => {
    if (!['trail', 'garage', 'workshop'].includes(ui.mode)) return;
    ui.photo = !ui.photo;
    (document.getElementById('photo-weather') as HTMLSelectElement).value = state.weather;
    (document.getElementById('photo-dof') as HTMLInputElement).checked = state.graphics.dof;
    photoFocus = camera.position.distanceTo(car.root.position);
    (document.getElementById('photo-focus') as HTMLInputElement).value = String(photoFocus);
    document.body.classList.toggle('photo', ui.photo);
    sim.paused = ui.photo || ui.mode !== 'trail';
    clock.reset();
    orbit.enabled = ui.photo || ui.mode !== 'trail' || camMode === 3;
    orbit.target.copy(car.root.position).add(new T.Vector3(0, 0.12, 0));
    keys.clear();
  };
  document.getElementById('photo-weather')!.onchange = (e) => {
    state.weather = (e.target as HTMLSelectElement).value as typeof state.weather;
    ui.onWeather();
  };
  document.getElementById('photo-dof')!.onchange = (e) => {
    state.graphics.dof = (e.target as HTMLInputElement).checked;
    state.graphics.preset = 'Custom';
    ui.onGraphics();
  };
  document.getElementById('photo-focus')!.oninput = (e) => {
    photoFocus = Number((e.target as HTMLInputElement).value);
  };
  ui.onDebug = () => {
    debug = !debug;
    document.getElementById('physics-debug')!.hidden = !debug;
  };
  document.getElementById('download-photo')!.onclick = () => {
    render.render(ui.photo ? photoFocus : camera.position.distanceTo(orbit.target));
    const a = document.createElement('a');
    a.download = 'ridgebound-' + Date.now() + '.png';
    a.href = renderer.domElement.toDataURL('image/png');
    a.click();
  };
  let contactAudio: ContactAudio | null = null;
  let photoFocus = 1;
  let audio: AudioContext | null = null,
    osc: OscillatorNode | null = null,
    gain: GainNode | null = null,
    servoOsc: OscillatorNode | null = null,
    servoGain: GainNode | null = null;
  function sound() {
    if (!audio) {
      audio = new AudioContext();
      contactAudio = new ContactAudio(audio);
      osc = audio.createOscillator();
      osc.type = 'triangle';
      gain = audio.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(audio.destination);
      osc.start();
      servoOsc = audio.createOscillator();
      servoOsc.type = 'sine';
      servoOsc.frequency.value = 820;
      servoGain = audio.createGain();
      servoGain.gain.value = 0;
      servoOsc.connect(servoGain).connect(audio.destination);
      servoOsc.start();
    }
    void audio.resume();
  }
  ui.onSound = () => {
    state.tune.audio = !state.tune.audio;
    if (state.tune.audio) sound();
    persist();
    if (ui.mode === 'settings') ui.render();
  };
  const pressed = (action: Action) => bindingDown(action, keys, state.bindings),
    blocked = (event: KeyboardEvent) =>
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      event.target instanceof HTMLTextAreaElement;
  window.addEventListener('keydown', (event) => {
    if (blocked(event)) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'F2'].includes(event.code))
      event.preventDefault();
    keys.add(event.code);
    if (event.repeat) return;
    if (ui.photo && event.code !== 'KeyP' && event.code !== 'Escape') return;
    if (event.code === 'KeyM') ui.toggleMenu();
    else if (event.code === 'Escape') {
      if (ui.photo) ui.onPhoto();
      else ui.toggleMenu();
    } else if (event.code === 'KeyG') ui.setMode('workshop');
    else if (event.code === 'KeyC') ui.onCamera();
    else if (event.code === 'KeyP') ui.onPhoto();
    else if (event.code === state.bindings.recover) ui.onRecover();
    else if (event.code === 'F2' || event.code === 'Backquote') ui.onDebug();
    if (state.tune.audio) sound();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => {
    keys.clear();
    last = performance.now();
    clock.reset();
    previewClock.reset();
  });
  document.querySelectorAll<HTMLElement>('[data-key]').forEach((button) => {
    button.onpointerdown = (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      button.dataset.activeKey = touchBinding(button.dataset.key!, state.bindings);
      keys.add(button.dataset.activeKey);
    };
    button.onpointerup = button.onpointercancel = () =>
      keys.delete(button.dataset.activeKey || touchBinding(button.dataset.key!, state.bindings));
  });
  const orbitInput = () => {
    if (ui.mode === 'trail' && !ui.photo && camMode !== 2) {
      camMode = 3;
      orbit.enabled = true;
      orbit.target.copy(car.root.position).add(new T.Vector3(0, 0.12, 0));
    }
  };
  renderer.domElement.addEventListener('pointerdown', orbitInput);
  renderer.domElement.addEventListener('wheel', orbitInput, { passive: true });
  renderer.domElement.addEventListener('dblclick', () => {
    if (ui.started && !ui.photo) ui.toggleMenu();
  });
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    render.resize();
  });
  const target = new T.Vector3(),
    desired = new T.Vector3();
  function cameraCollision(from: T.Vector3, to: T.Vector3) {
    const delta = to.clone().sub(from),
      length = delta.length();
    if (length < 0.01) return;
    delta.normalize();
    const hit = world.castRay(
      new RAPIER.Ray(from, delta),
      length,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (c) => !c.parent() || !sim.parts.some((b) => b.handle === c.parent()!.handle),
    );
    if (hit) to.copy(from).addScaledVector(delta, Math.max(0.17, hit.timeOfImpact - 0.04));
    to.y = Math.max(to.y, heightAt(to.x, to.z) + 0.045);
  }
  function courseStep(dt: number) {
    if (!run || run.finished) return;
    const oldGate = run.gate,
      p = sim.body.translation();
    if (run.update(p.x, p.z, dt)) {
      const course = run.course,
        first = !state.completed.includes(course.legacy),
        reward = first ? course.reward : Math.round(course.reward * 0.2),
        old = state.records[course.id];
      state.credits += reward;
      if (first) state.completed.push(course.legacy);
      state.records[course.id] = {
        bestTime: old?.bestTime ? Math.min(old.bestTime, run.time) : run.time,
        bestScore: Math.max(old?.bestScore ?? 0, run.score),
        completions: (old?.completions ?? 0) + 1,
        recoveries: run.recoveries,
      };
      persist();
      ui.toast(
        `${course.name} complete · ${run.time.toFixed(1)} s · ${run.score} points · +${reward} challenge points`,
      );
    } else if (run.gate !== oldGate) ui.toast('Gate ' + run.gate + ' / ' + run.course.gates.length);
  }
  ui.setMode('home');
  applyTune();
  sim.paused = true;
  document.getElementById('loading')!.classList.add('done');
  function animate(now: number) {
    requestAnimationFrame(animate);
    const frameDt = Math.max(0, (now - last) / 1000),
      dt = Math.min(frameDt, 0.25);
    last = now;
    fpsTime += frameDt;
    saveTime += dt;
    const graphics = render.effective(state.graphics),
      indoor = sceneMode !== 'trail';
    let throttle = (pressed('forward') ? 1 : 0) - (pressed('reverse') ? 1 : 0),
      steer = (pressed('left') ? 1 : 0) - (pressed('right') ? 1 : 0);
    const pad = navigator.getGamepads?.().find((p) => p?.connected);
    if (pad) {
      if (Math.abs(pad.axes[0]) > 0.09) steer = -pad.axes[0];
      const t = (pad.buttons[7]?.value || 0) - (pad.buttons[6]?.value || 0);
      if (Math.abs(t) > 0.02) throttle = t;
    }
    const input: Input = {
      throttle,
      steer,
      brake: pressed('brake'),
      precision: pressed('precision'),
    };
    const alpha = sim.paused
      ? (clock.reset(), 1)
      : clock.advance(frameDt, (step) => {
          sim.step(step, input);
          effects.step(step, sim, graphics);
          courseStep(step);
        });
    const studioActive = ['home', 'garage', 'workshop'].includes(ui.mode) && !ui.photo;
    if (indoor) {
      const a = studioActive
        ? previewClock.advance(frameDt, (step) =>
            preview.step(step, { throttle: 0, steer: previewSteer, brake: true }),
          )
        : 1;
      car.sync(preview, preview.pose(a));
      const offset = new T.Vector3(
        sceneMode === 'garage' ? 100 : 60,
        sceneMode === 'garage' ? 0.106 : 0.326,
        0,
      );
      car.root.position.add(offset);
      for (const d of car.deformations) {
        d.uniforms.tyrePoint.value.add(offset);
        d.uniforms.tyreCentre.value.add(offset);
        d.uniforms.patchPoints.value.forEach((p) => p.add(offset));
      }
    } else car.sync(sim, sim.pose(alpha));
    car.root.updateMatrixWorld(true);
    car.soilUniforms.vehicleInverse.value.copy(car.root.matrixWorld).invert();
    car.setVisualDetail(graphics.wheelDetail);
    if (!graphics.tyreDeformation)
      car.deformations.forEach((d) => (d.uniforms.tyreDeflection.value = 0));
    const active = indoor ? preview : sim;
    car.paint.color.set(active.tune.paint);
    car.shell.visible = active.tune.body;
    car.battery.position.set(
      0,
      active.tune.batteryHeight - 0.066,
      active.tune.batteryPosition + 0.119,
    );
    const finish =
      carId === state.tune.vehicle
        ? effects.condition
        : validateCondition(state.condition[carId], state.dirt[carId] ?? 0);
    const showDirt = graphics.accumulation && !cleanPreview;
    car.soilUniforms.soil.value = showDirt ? averageMud(finish) : 0;
    car.soilUniforms.wet.value = showDirt ? finish.wet : 0;
    car.soilUniforms.zones.value.set(showDirt ? finish.mud : Array(8).fill(0));
    car.soilUniforms.dust.value = showDirt ? finish.dust : 0;
    car.soilUniforms.wear.value = state.preferences.visualWear && !cleanPreview ? finish.scuffs : 0;
    park.group.visible = !indoor;
    testArea.group.visible = !indoor;
    showroom.group.visible = sceneMode === 'garage';
    park.garage.visible = sceneMode === 'workshop';
    fixture.visible = !!previewObstacle && sceneMode === 'workshop';
    effects.group.visible = !indoor;
    if (indoor || ui.photo || camMode === 3) {
      if (camMode === 3 && !indoor && !ui.photo && ui.mode === 'trail') {
        const next = car.root.position.clone().add(new T.Vector3(0, 0.11, 0));
        camera.position.add(next.clone().sub(orbit.target));
        orbit.target.copy(next);
      }
      orbit.update();
      if (!indoor) cameraCollision(orbit.target, camera.position);
    } else if (ui.mode === 'trail') {
      target.copy(car.root.position).add(new T.Vector3(0, 0.1, 0));
      const forward = new T.Vector3(0, 0, 1).applyQuaternion(car.root.quaternion),
        yaw = Math.atan2(forward.x, forward.z),
        offset =
          camMode === 0
            ? new T.Vector3(0.45, 0.3, -0.68)
            : camMode === 1
              ? new T.Vector3(0.28, 0.14, -0.48)
              : camMode === 4
                ? new T.Vector3(0.28, 0.08, 0.2)
                : camMode === 5
                  ? new T.Vector3(Math.sin(now * 0.00008) * 0.7, 0.3, Math.cos(now * 0.00008) * 0.7)
                  : new T.Vector3(0, 0.16, 0.057);
      if (camMode !== 5) offset.applyAxisAngle(new T.Vector3(0, 1, 0), yaw);
      desired.copy(car.root.position).add(offset);
      if (camMode !== 2) cameraCollision(target, desired);
      camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
      if (camMode === 2) {
        camera.position.copy(desired);
        target
          .copy(car.root.position)
          .add(new T.Vector3(0, 0.16, 1).applyQuaternion(car.root.quaternion));
      }
      camera.lookAt(target);
    }
    if (park.plantUniforms)
      sim.wheels.forEach((w, i) =>
        park.plantUniforms!.wheelCenters.value[i].lerp(
          new T.Vector3(w.body.translation().x, w.body.translation().y, w.body.translation().z),
          1 - Math.exp(-dt * 10),
        ),
      );
    effects.rainStep(
      dt,
      state.weather === 'Rain' && !indoor,
      sim.body.translation(),
      graphics.particles,
    );
    effects.render(graphics);
    effects.group.visible = !indoor;
    lamps.forEach((l) => (l.visible = state.weather === 'Night' && !indoor));
    park.update(now / 1000, indoor ? new T.Vector3() : car.root.position);
    render.apply(state.graphics, indoor);
    if (!graphics.fpsLimit || now - lastRender >= 1000 / graphics.fpsLimit - 0.5) {
      render.observe((now - lastRender) / 1000 || dt, state.graphics);
      render.render(
        ui.photo
          ? photoFocus
          : camera.position.distanceTo(indoor || camMode === 3 ? orbit.target : target),
      );
      lastRender = now;
      renderFrames++;
    }
    if (audio && osc && gain && servoGain) {
      const enabled = state.tune.audio && ui.mode === 'trail' && !ui.photo;
      contactAudio?.update(
        [0, 1, 2, 3].map((i) => effects.sample(sim, i)),
        sim.bodyScrape,
        enabled,
        !indoor,
      );
      gain.gain.setTargetAtTime(
        enabled
          ? Math.min(0.025, 0.003 + sim.motorCurrent * 0.006) *
              Math.min(1, Math.abs(sim.throttle) * 8)
          : 0,
        audio.currentTime,
        0.08,
      );
      osc.frequency.setTargetAtTime(
        90 + Math.abs(sim.motorRPM) * 0.045 + sim.motorCurrent * 4,
        audio.currentTime,
        0.08,
      );
      servoGain.gain.setTargetAtTime(
        enabled ? Math.min(0.008, Math.abs(sim.steer - sim.wheels[0].steering) * 0.015) : 0,
        audio.currentTime,
        0.04,
      );
    }
    if (fpsTime > 0.25) {
      const speed = (sim.speed * 3.6).toFixed(1),
        battery = Math.max(0, 100 * (1 - sim.usedAh / state.tune.capacity));
      document.getElementById('hud-speed')!.textContent = speed;
      document.getElementById('hud-battery')!.textContent = battery.toFixed(0) + '%';
      document.getElementById('hud-mode')!.textContent =
        '4WD / ' + (state.tune.motor === 'trail' ? 'TRAIL' : 'LOW');
      document.getElementById('hud-course')!.textContent = run
        ? run.finished
          ? 'Course complete'
          : run.course.name + ' · ' + run.gate + '/' + run.course.gates.length
        : 'Free roam';
      document.getElementById('hud-fps')!.textContent = state.graphics.showFPS
        ? Math.round(renderFrames / fpsTime) + ' FPS'
        : '';
      document.getElementById('fps')!.textContent = Math.round(renderFrames / fpsTime) + ' FPS';
      document.getElementById('speed')!.textContent = speed;
      document.getElementById('surface')!.textContent = sim.surface;
      document.getElementById('roll')!.textContent = Math.round(active.roll) + '°';
      document.getElementById('time')!.textContent =
        Math.floor(sim.elapsed / 60)
          .toString()
          .padStart(2, '0') +
        ':' +
        Math.floor(sim.elapsed % 60)
          .toString()
          .padStart(2, '0');
      document
        .querySelectorAll('#contacts i')
        .forEach((el, i) => el.classList.toggle('off', !sim.wheels[i].contact));
      const mass = document.getElementById('mass-stat');
      if (mass) mass.textContent = active.mass.toFixed(2);
      if (debug) {
        document.getElementById('debug-data')!.textContent = JSON.stringify(
          {
            ...active.debug(),
            particles: effects.pool.active,
            particleCapacity: effects.pool.capacity,
            droppedTime: clock.droppedTime,
          },
          null,
          2,
        );
        const data = world.debugRender();
        debugLines.geometry.dispose();
        debugLines.geometry = new T.BufferGeometry();
        debugLines.geometry.setAttribute('position', new T.BufferAttribute(data.vertices, 3));
      }
      debugLines.visible = debug && ui.mode === 'trail';
      renderFrames = 0;
      fpsTime = 0;
    }
    if (saveTime > 5) {
      if (ui.started) persist();
      saveTime = 0;
    }
  }
  (window as any).__RIDGEBOUND__ = {
    get sim() {
      return sim;
    },
    get car() {
      return car;
    },
    get preview() {
      return preview;
    },
    park,
    testArea,
    ui,
    state,
    renderer,
    scene,
    camera,
    clock,
    effects,
    render,
    get run() {
      return run;
    },
  };
  requestAnimationFrame(animate);
}
boot().catch((error) => {
  console.error(error);
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML =
      '<span class="brand">RIDGEBOUND</span><span>Could not initialize. Check the console and WebGL 2 support, then reload.</span>';
  }
});
