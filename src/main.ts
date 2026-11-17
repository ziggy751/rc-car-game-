import '@fontsource/dm-sans/latin-400.css';
import '@fontsource/dm-sans/latin-500.css';
import '@fontsource/dm-sans/latin-700.css';
import '@fontsource/manrope/latin-400.css';
import '@fontsource/manrope/latin-500.css';
import '@fontsource/manrope/latin-800.css';
import * as T from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Crawler } from './vehicle';
import { Park, groundHeight, trails } from './world';
import { Simulation } from './physics';
import { loadState, saveState } from './state';
import { UI } from './ui';
import { FixedClock } from './dynamics/clock';
import { TestArea, testStations } from './test-area';
import { type Action } from './state';
import { recoverySupport } from './dynamics/collision';
import { bindingDown, touchBinding } from './dynamics/controls';
import { batchStatic } from './optimize';
import './style.css';

async function boot() {
  const state = loadState();
  const ui = new UI(state);
  await RAPIER.init();
  const renderer = new T.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: true,
  });
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  document.getElementById('scene')!.append(renderer.domElement);
  const scene = new T.Scene();
  const pmrem = new T.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.4;
  pmrem.dispose();
  const camera = new T.PerspectiveCamera(40, innerWidth / innerHeight, 0.008, 240);
  camera.position.set(0.95, 0.55, 1.15);
  const orbit = new OrbitControls(camera, renderer.domElement);
  orbit.enableDamping = true;
  orbit.dampingFactor = 0.08;
  orbit.minDistance = 0.28;
  orbit.maxDistance = 3;
  orbit.maxPolarAngle = Math.PI * 0.47;
  orbit.target.set(0, 0.13, 0);
  orbit.enabled = false;
  const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
  const park = new Park(scene, world);
  const car = new Crawler();
  scene.add(car.root);
  batchStatic(car.shell);
  batchStatic(car.mechanics);
  for (const w of car.wheels) batchStatic(w.children[0]);
  for (const a of car.axles) batchStatic(a);
  for (const s of car.springs) batchStatic(s);
  // Keep the vegetation branch independently visible for quality presets.
  batchStatic(park.vegetation);
  park.vegetation.removeFromParent();
  batchStatic(park.group);
  park.group.add(park.vegetation);
  batchStatic(park.garage);
  const testArea = new TestArea(world);
  scene.add(testArea.group);
  batchStatic(testArea.group);
  const heightAt = (x: number, z: number) =>
    x > 6 && x < 16 && z > -13 && z < -1 ? 0 : groundHeight(x, z);
  const sim = new Simulation(world, state.tune, {
    heightAt,
    surfaceAt: (p, c) => park.materialSurfaces.get(c.handle) ?? testArea.surfaceAt(p, c),
  });
  sim.applyTune();
  const clock = new FixedClock();
  let debugVisible = false;
  const debugLines = new T.LineSegments(
    new T.BufferGeometry(),
    new T.LineBasicMaterial({ color: '#e8cc7b', depthTest: false }),
  );
  debugLines.renderOrder = 10;
  scene.add(debugLines);
  let camMode = 0,
    previous = performance.now(),
    fpsTime = 0,
    frames = 0,
    gate = 0,
    challenge = false,
    sessionStarted = false;
  let garageYaw = 0;
  const keys = new Set<string>();
  const target = new T.Vector3(),
    desired = new T.Vector3(),
    offset = new T.Vector3();
  let audio: AudioContext | null = null,
    osc: OscillatorNode | null = null,
    gain: GainNode | null = null;
  const persist = () => {
    if (!saveState(state))
      ui.toast('Storage unavailable. Changes will last for this session only.');
  };
  let activeQuality = '';
  function quality() {
    const q = state.tune.quality;
    if (activeQuality === q) return;
    activeQuality = q;
    const ratio =
      q === 'Low'
        ? 0.8
        : q === 'Medium'
          ? 1
          : q === 'High'
            ? Math.min(devicePixelRatio, 1.5)
            : Math.min(devicePixelRatio, 2);
    renderer.setPixelRatio(ratio);
    renderer.shadowMap.enabled = q !== 'Low';
    park.sun.castShadow = q !== 'Low';
    park.vegetation.visible = q !== 'Low';
    renderer.setSize(innerWidth, innerHeight);
  }
  function applyTune() {
    sim.applyTune();
    car.battery.position.set(
      0,
      state.tune.batteryHeight - 0.066,
      state.tune.batteryPosition + 0.119,
    );
    car.setTyres(state.tune.radius);
    car.paint.color.set(state.tune.paint);
    car.shell.visible = state.tune.body;
    quality();
    persist();
  }
  applyTune();
  ui.onTune = applyTune;
  ui.onSave = persist;
  function startAudio() {
    if (!audio) {
      audio = new AudioContext();
      osc = audio.createOscillator();
      osc.type = 'triangle';
      gain = audio.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(audio.destination);
      osc.start();
    }
    void audio.resume();
  }
  ui.onSound = () => {
    state.tune.audio = !state.tune.audio;
    if (state.tune.audio) startAudio();
    document.getElementById('sound')!.setAttribute('aria-pressed', String(state.tune.audio));
    if (ui.mode === 'settings') ui.render();
    persist();
    ui.toast(state.tune.audio ? 'Electric motor audio on' : 'Audio off');
  };
  ui.onMode = (mode) => {
    sim.paused = mode !== 'trail';
    clock.reset();
    keys.clear();
    orbit.enabled = mode === 'garage';
    if (mode === 'garage') {
      car.sync(sim, sim.pose(1));
      const lowest = Math.min(...car.wheels.map((w) => w.position.y - state.tune.radius));
      car.root.position.set(60, 0.326 - lowest, 0);
      car.root.quaternion.identity();
      for (const d of car.deformations) d.uniforms.tyreDeflection.value = 0;
      orbit.target.set(60, 0.53, 0);
      camera.position.set(60.82, 0.83, 1.02);
      orbit.minDistance = 0.25;
      orbit.maxDistance = 2.2;
      orbit.update();
    } else if (mode === 'trail') {
      camera.position.copy(
        car.root.position.x > 50
          ? new T.Vector3(
              sim.body.translation().x + 0.8,
              sim.body.translation().y + 0.5,
              sim.body.translation().z + 1,
            )
          : camera.position,
      );
    }
  };
  ui.onRecover = () => {
    const p = sim.body.translation();
    const support = recoverySupport(
      world,
      p.x,
      p.z,
      p.y + 1,
      new Set(sim.parts.map((b) => b.handle)),
      heightAt(p.x, p.z),
    );
    sim.reset(p.x, p.z, support);
    ui.toast('Crawler recovered. Find your next line.');
  };
  ui.onStart = () => {
    const tr = trails[ui.activeTrail];
    sim.reset(tr.x, tr.z);
    sessionStarted = true;
    challenge = ui.activeTrail === 0;
    gate = 0;
    sim.elapsed = 0;
    ui.toast(
      challenge ? 'Fern Creek · pass all 4 numbered gates' : 'Free crawl · explore your line',
    );
  };
  ui.onTeleport = (i) => {
    const tr = trails[i];
    sim.reset(tr.x, tr.z);
    challenge = false;
    gate = 0;
    sessionStarted = true;
    ui.started = true;
    ui.toast('Travelled to ' + tr.name);
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
    if (ui.mode === 'garage') {
      ui.toast('Drag or scroll to inspect in the workshop.');
      return;
    }
    camMode = (camMode + 1) % cameraNames.length;
    orbit.enabled = camMode === 3;
    if (camMode === 3) {
      orbit.target.copy(car.root.position).add(new T.Vector3(0, 0.1, 0));
      orbit.minDistance = 0.3;
      orbit.maxDistance = 3;
    }
    document.getElementById('camera')!.innerHTML = '<kbd>C</kbd> ' + cameraNames[camMode];
  };
  ui.onPhoto = () => {
    if (ui.mode !== 'trail' && ui.mode !== 'garage') return;
    ui.photo = !ui.photo;
    document.body.classList.toggle('photo', ui.photo);
    sim.paused = ui.photo || ui.mode !== 'trail';
    orbit.enabled = ui.photo || ui.mode === 'garage' || camMode === 3;
    orbit.target.copy(car.root.position).add(new T.Vector3(sessionStarted ? 0 : -0.17, 0.13, 0));
    keys.clear();
  };
  document.getElementById('download-photo')!.onclick = () => {
    renderer.render(scene, camera);
    const a = document.createElement('a');
    a.download = 'ridgebound-' + Date.now() + '.png';
    a.href = renderer.domElement.toDataURL('image/png');
    a.click();
  };
  const pressed = (action: Action) => bindingDown(action, keys, state.bindings);
  ui.onTestStation = (index) => {
    const station = testStations[index];
    sim.reset(station.x, station.z);
    sessionStarted = true;
    ui.started = true;
    challenge = false;
    clock.reset();
    ui.setMode('trail');
    ui.toast(station.name + ' · F2 for physics telemetry');
  };
  ui.onDebug = () => {
    debugVisible = !debugVisible;
    document.getElementById('physics-debug')!.hidden = !debugVisible;
  };
  renderer.domElement.addEventListener('pointerdown', () => {
    if (ui.mode === 'trail' && !ui.photo && camMode !== 2) {
      camMode = 3;
      orbit.enabled = true;
      orbit.target.copy(car.root.position).add(new T.Vector3(0, 0.12, 0));
    }
  });
  const blocked = (e: KeyboardEvent) =>
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLSelectElement ||
    e.target instanceof HTMLTextAreaElement;
  window.addEventListener('keydown', (e) => {
    if (blocked(e)) return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code))
      e.preventDefault();
    keys.add(e.code);
    if (e.repeat) return;
    if (ui.photo && e.code !== 'KeyP' && e.code !== 'Escape') return;
    if (e.code === state.bindings.recover && ui.mode === 'trail') ui.onRecover();
    if (e.code === 'KeyC' && ui.mode === 'trail') ui.onCamera();
    if (e.code === 'KeyG') ui.setMode(ui.mode === 'garage' ? 'trail' : 'garage');
    if (e.code === 'KeyM') ui.setMode(ui.mode === 'map' ? 'trail' : 'map');
    if (e.code === 'KeyP') ui.onPhoto();
    if (e.code === 'F2' || e.code === 'Backquote') {
      e.preventDefault();
      ui.onDebug();
    }
    if (e.code === 'Escape') {
      if (ui.photo) ui.onPhoto();
      else ui.setMode('trail');
    }
    if (state.tune.audio) startAudio();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  document.addEventListener('visibilitychange', () => {
    keys.clear();
    previous = performance.now();
    clock.reset();
  });
  document.querySelectorAll<HTMLElement>('[data-key]').forEach((b) => {
    b.onpointerdown = (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      b.dataset.activeKey = touchBinding(b.dataset.key!, state.bindings);
      keys.add(b.dataset.activeKey);
    };
    b.onpointerup = b.onpointercancel = () =>
      keys.delete(b.dataset.activeKey || touchBinding(b.dataset.key!, state.bindings));
  });
  renderer.domElement.addEventListener(
    'wheel',
    () => {
      if (ui.mode === 'trail' && !ui.photo && camMode !== 2) {
        camMode = 3;
        orbit.enabled = true;
        orbit.target.copy(car.root.position).add(new T.Vector3(0, 0.12, 0));
      }
    },
    { passive: true },
  );
  window.addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  const axisAngle = () => {
    const up = new T.Vector3(0, 1, 0).applyQuaternion(car.root.quaternion);
    const right = new T.Vector3(1, 0, 0).applyQuaternion(car.root.quaternion);
    return (Math.atan2(right.y, up.y) * 180) / Math.PI;
  };
  function animate(now: number) {
    requestAnimationFrame(animate);
    const frameDt = (now - previous) / 1000,
      dt = Math.min(frameDt, 0.25);
    previous = now;
    fpsTime += dt;
    frames++;
    let throttle = (pressed('forward') ? 1 : 0) - (pressed('reverse') ? 1 : 0),
      steer = (pressed('left') ? 1 : 0) - (pressed('right') ? 1 : 0);
    const pad = navigator.getGamepads?.()[0];
    if (pad) {
      if (Math.abs(pad.axes[0]) > 0.09) steer = -pad.axes[0];
      const trigger = (pad.buttons[7]?.value || 0) - (pad.buttons[6]?.value || 0);
      if (Math.abs(trigger) > 0.02) throttle = trigger;
    }
    if ((throttle || steer) && !sessionStarted && ui.mode === 'trail') {
      sessionStarted = true;
      ui.started = true;
      ui.render();
    }
    const alpha = sim.paused
      ? (clock.reset(), 1)
      : clock.advance(frameDt, (step) =>
          sim.step(step, {
            throttle,
            steer,
            brake: pressed('brake'),
            precision: pressed('precision'),
          }),
        );
    if (!sessionStarted) sim.elapsed = 0;
    if (ui.mode !== 'garage') car.sync(sim, sim.pose(alpha));
    if (ui.mode === 'garage' || ui.photo || camMode === 3) {
      if (camMode === 3 && ui.mode === 'trail' && !ui.photo) {
        const nextTarget = car.root.position.clone().add(new T.Vector3(0, 0.12, 0)),
          delta = nextTarget.clone().sub(orbit.target);
        camera.position.add(delta);
        orbit.target.copy(nextTarget);
      }
      orbit.update();
      if (ui.mode === 'trail' && camMode !== 2) {
        const direction = camera.position.clone().sub(orbit.target),
          length = direction.length();
        direction.normalize();
        const hit = world.castRay(
          new RAPIER.Ray(orbit.target, direction),
          length,
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          (c) => !c.parent() || !sim.parts.some((b) => b.handle === c.parent()!.handle),
        );
        if (hit)
          camera.position
            .copy(orbit.target)
            .addScaledVector(direction, Math.max(0.18, hit.timeOfImpact - 0.04));
        camera.position.y = Math.max(
          camera.position.y,
          heightAt(camera.position.x, camera.position.z) + 0.04,
        );
      }
    } else if (ui.mode === 'trail') {
      target.copy(car.root.position).add(new T.Vector3(sessionStarted ? 0 : -0.17, 0.13, 0));
      if (!sessionStarted) {
        garageYaw += dt * 0.025;
        offset.set(0.54 + Math.sin(garageYaw) * 0.03, 0.29, 0.71);
      } else if (camMode === 0)
        offset
          .set(0.57, 0.46, -0.86)
          .applyAxisAngle(
            new T.Vector3(0, 1, 0),
            Math.atan2(
              new T.Vector3(0, 0, 1).applyQuaternion(car.root.quaternion).x,
              new T.Vector3(0, 0, 1).applyQuaternion(car.root.quaternion).z,
            ),
          );
      else if (camMode === 1)
        offset
          .set(0.4, 0.18, -0.55)
          .applyAxisAngle(
            new T.Vector3(0, 1, 0),
            Math.atan2(
              new T.Vector3(0, 0, 1).applyQuaternion(car.root.quaternion).x,
              new T.Vector3(0, 0, 1).applyQuaternion(car.root.quaternion).z,
            ),
          );
      else if (camMode === 4) offset.set(0.36, 0.1, 0.25).applyQuaternion(car.root.quaternion);
      else if (camMode === 5)
        offset.set(Math.sin(now * 0.00008) * 0.85, 0.4, Math.cos(now * 0.00008) * 0.85);
      else offset.set(0, 0.235, 0.055).applyQuaternion(car.root.quaternion);
      desired.copy(car.root.position).add(offset);
      desired.y = Math.max(desired.y, heightAt(desired.x, desired.z) + 0.06);
      if (camMode !== 2) {
        const rayDirection = desired.clone().sub(target),
          length = rayDirection.length();
        rayDirection.normalize();
        const hit = world.castRay(
          new RAPIER.Ray(target, rayDirection),
          length,
          true,
          undefined,
          undefined,
          undefined,
          undefined,
          (c) => !c.parent() || !sim.parts.some((b) => b.handle === c.parent()!.handle),
        );
        if (hit)
          desired
            .copy(target)
            .addScaledVector(rayDirection, Math.max(0.18, hit.timeOfImpact - 0.06));
      }
      camera.position.lerp(desired, 1 - Math.exp(-dt * 4));
      if (camMode === 2) {
        target
          .copy(car.root.position)
          .add(new T.Vector3(0, 0.19, 1).applyQuaternion(car.root.quaternion));
        camera.position.copy(desired);
      }
      camera.lookAt(target);
    }
    if (challenge && ui.mode === 'trail' && gate < 4) {
      const z = 0.8 + gate * 2.05,
        x = Math.sin(z * 0.42) * 0.65;
      const p = sim.body.translation();
      if (Math.hypot(p.x - x, p.z - z) < 0.34) {
        gate++;
        if (gate === 4) {
          challenge = false;
          const first = !state.completed.includes(0);
          if (first) {
            state.completed.push(0);
            state.credits += 150;
            persist();
            ui.render();
          }
          ui.toast(
            first
              ? 'Fern Creek complete · +150 trail credits'
              : 'Fern Creek complete · trail already rewarded',
          );
        } else ui.toast('Gate ' + gate + ' / 4 · keep finding your line');
      }
    }
    document.getElementById('center-hint')!.textContent = challenge
      ? 'FERN CREEK / GATE ' + (gate + 1) + ' OF 4'
      : ui.photo
        ? ''
        : sim.contacts === 0 && sessionStarted
          ? 'NO WHEEL CONTACT · R TO RECOVER'
          : '';
    if (audio && osc && gain) {
      const volume =
        state.tune.audio && ui.mode === 'trail'
          ? Math.min(0.028, 0.004 + sim.motorCurrent * 0.006) *
            Math.min(1, Math.abs(sim.throttle) * 8)
          : 0;
      gain.gain.setTargetAtTime(volume, audio.currentTime, 0.08);
      osc.frequency.setTargetAtTime(
        90 + Math.abs(sim.motorRPM) * 0.045 + sim.motorCurrent * 4,
        audio.currentTime,
        0.08,
      );
    }
    const p = car.root.position;
    park.update(now / 1000, p.x > 50 ? new T.Vector3() : p);
    renderer.render(scene, camera);
    if (fpsTime > 0.25) {
      document.getElementById('speed')!.textContent = (
        Math.hypot(sim.body.linvel().x, sim.body.linvel().z) * 3.6
      ).toFixed(1);
      document.getElementById('surface')!.textContent = sim.surface;
      document.querySelector('.gear b span')!.textContent =
        state.tune.motor === 'trail' ? 'TRAIL' : 'LOW';
      document.getElementById('roll')!.textContent = Math.round(axisAngle()) + '°';
      document.getElementById('time')!.textContent =
        String(Math.floor(sim.elapsed / 60)).padStart(2, '0') +
        ':' +
        String(Math.floor(sim.elapsed % 60)).padStart(2, '0');
      const massStat = document.getElementById('mass-stat');
      if (massStat) massStat.textContent = sim.mass.toFixed(2);
      document
        .querySelectorAll('#contacts i')
        .forEach((el, i) => el.classList.toggle('off', !sim.wheels[i].contact));
      if (debugVisible) {
        document.getElementById('debug-data')!.textContent = JSON.stringify(
          { ...sim.debug(), droppedTime: clock.droppedTime },
          null,
          2,
        );
        const buffers = world.debugRender();
        debugLines.geometry.dispose();
        debugLines.geometry = new T.BufferGeometry();
        debugLines.geometry.setAttribute('position', new T.BufferAttribute(buffers.vertices, 3));
      }
      debugLines.visible = debugVisible && ui.mode === 'trail';
      document.getElementById('fps')!.textContent = Math.round(frames / fpsTime) + ' FPS';
      fpsTime = 0;
      frames = 0;
    }
  }
  (window as any).__RIDGEBOUND__ = {
    sim,
    car,
    park,
    ui,
    state,
    renderer,
    scene,
    camera,
    clock,
    testArea,
  };
  document.getElementById('loading')!.classList.add('done');
  requestAnimationFrame(animate);
}
boot().catch((error) => {
  console.error(error);
  const loading = document.getElementById('loading');
  if (loading) {
    loading.innerHTML =
      '<span class="brand">RIDGEBOUND</span><span>Could not start the renderer. Check WebGL 2 support and reload.</span>';
  }
});
