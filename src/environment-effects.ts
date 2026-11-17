import * as T from 'three';
import type { Simulation } from './physics';
import type { Graphics } from './graphics';
import { averageMud, cleanCondition, updateCondition, type SurfaceCondition } from './soiling';
import { v, q } from './dynamics/math';
export type ContactSample = {
  contact: boolean;
  load: number;
  omega: number;
  radius: number;
  speed: number;
  slip: number;
  lateral: number;
  surface: string;
  point: T.Vector3;
  normal: T.Vector3;
  axis: T.Vector3;
  width: number;
  water: boolean;
};
export function effectIntent(s: ContactSample) {
  const forward = s.axis.clone().cross(s.normal).normalize(),
    slipSpeed = s.omega * s.radius - s.speed;
  const loose = s.surface === 'Forest loam' || s.surface === 'Gravel' || s.surface === 'Mud',
    spin = s.contact && s.load > 0.2 && Math.abs(slipSpeed) > 0.035 && Math.abs(s.slip) > 0.12;
  const kind = s.water
    ? 'water'
    : s.surface === 'Mud'
      ? 'mud'
      : s.surface === 'Gravel'
        ? 'gravel'
        : 'dirt';
  const rate = s.water
    ? Math.min(70, (Math.abs(s.speed) + Math.abs(slipSpeed)) * 55)
    : spin && loose
      ? Math.min(
          140,
          (10 + Math.abs(slipSpeed) * 100) * (s.width / 0.044) * Math.min(2, s.load / 8),
        )
      : 0;
  const direction = forward
    .multiplyScalar(-Math.sign(slipSpeed || s.omega))
    .addScaledVector(s.axis, -s.lateral * 0.3)
    .addScaledVector(s.normal, 0.55)
    .normalize();
  return {
    rate,
    dustRate:
      !s.water && s.contact && (s.surface === 'Forest loam' || s.surface === 'Gravel')
        ? Math.min(45, Math.abs(s.speed) * 32 * Math.min(1.5, s.load / 8))
        : 0,
    kind,
    direction,
    track: s.contact && loose && !s.water,
    mud:
      s.contact && s.surface === 'Mud'
        ? Math.min(0.08, (Math.abs(s.omega * s.radius) + Math.abs(s.speed)) * 0.06)
        : 0,
    wash: s.water ? 0.08 : 0,
  };
}
export type Grain = {
  p: T.Vector3;
  velocity: T.Vector3;
  life: number;
  maxLife: number;
  size: number;
  kind: string;
  bounce: number;
};
export class ParticlePool {
  slots: Grain[];
  cursor = 0;
  emitted = 0;
  seed = 2187;
  constructor(public capacity = 900) {
    this.slots = Array.from({ length: capacity }, () => ({
      p: new T.Vector3(),
      velocity: new T.Vector3(),
      life: 0,
      maxLife: 1,
      size: 0,
      kind: 'dirt',
      bounce: 0,
    }));
  }
  random() {
    this.seed = (this.seed * 1664525 + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  emit(s: ContactSample, intent: ReturnType<typeof effectIntent>, dust = false) {
    const p = this.slots[this.cursor++ % this.capacity];
    p.p.copy(s.point).addScaledVector(s.normal, 0.005);
    const speed = Math.min(1.6, 0.1 + Math.abs(s.omega * s.radius - s.speed) * 1.5);
    p.velocity
      .copy(intent.direction)
      .multiplyScalar(speed * (0.5 + this.random() * 0.6))
      .addScaledVector(s.axis, (this.random() - 0.5) * speed * 0.6)
      .addScaledVector(s.normal, this.random() * 0.25);
    p.kind = dust ? 'dust' : intent.kind;
    p.maxLife = p.life = dust ? 1.4 + this.random() : 0.35 + this.random() * 0.55;
    p.size = dust ? 0.012 + this.random() * 0.025 : 0.0015 + this.random() * 0.0035;
    p.bounce = 0;
    this.emitted++;
  }
  update(dt: number, height: (x: number, z: number) => number) {
    for (const p of this.slots) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.kind === 'dust') {
        p.velocity.multiplyScalar(Math.exp(-dt * 2));
        p.velocity.y += dt * 0.05;
      } else p.velocity.y -= 9.81 * dt;
      p.p.addScaledVector(p.velocity, dt);
      const y = height(p.p.x, p.p.z) + p.size;
      if (p.kind !== 'dust' && p.p.y < y) {
        p.p.y = y;
        if (p.bounce++ < 2) {
          p.velocity.y = Math.abs(p.velocity.y) * 0.18;
          p.velocity.x *= 0.45;
          p.velocity.z *= 0.45;
        } else p.life = Math.min(p.life, 0.15);
      }
    }
  }
  get active() {
    return this.slots.filter((p) => p.life > 0).length;
  }
}
export type SoilUniforms = {
  soil: { value: number };
  wet: { value: number };
  zones: { value: Float32Array };
  dust: { value: number };
  wear: { value: number };
  wheelCentres: { value: T.Vector3[] };
  vehicleInverse: { value: T.Matrix4 };
};
export function weatherMaterial(material: T.MeshStandardMaterial, uniforms: SoilUniforms) {
  const original = material.onBeforeCompile.bind(material),
    key = material.customProgramCacheKey.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    original(shader, renderer);
    Object.assign(shader.uniforms, {
      vehicleSoil: uniforms.soil,
      vehicleWet: uniforms.wet,
      vehicleInverse: uniforms.vehicleInverse,
      mudZones: uniforms.zones,
      vehicleDust: uniforms.dust,
      vehicleWear: uniforms.wear,
      soilWheels: uniforms.wheelCentres,
    });
    shader.vertexShader =
      'varying vec3 soilLocal;uniform mat4 vehicleInverse;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n vec4 soilVertex=vec4(position,1.0);\n #ifdef USE_INSTANCING\n soilVertex=instanceMatrix*soilVertex;\n #endif\n soilLocal=(vehicleInverse*modelMatrix*soilVertex).xyz;',
    );
    shader.fragmentShader =
      'varying vec3 soilLocal;uniform float vehicleSoil;uniform float vehicleWet;uniform float mudZones[8];uniform vec3 soilWheels[4];uniform float vehicleDust;uniform float vehicleWear;float soilHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float soilNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(soilHash(i),soilHash(i+vec3(1,0,0)),f.x),mix(soilHash(i+vec3(0,1,0)),soilHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(soilHash(i+vec3(0,0,1)),soilHash(i+vec3(1,0,1)),f.x),mix(soilHash(i+vec3(0,1,1)),soilHash(i+vec3(1,1,1)),f.x),f.y),f.z); }\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
   float coatCoverage=0.0;float thickness=0.0;
   if(vehicleSoil+vehicleDust+vehicleWear>.0001){
   float coatLevel=0.0;float nearestWheel=100.0;
   for(int i=0;i<4;i++){float d=length(soilLocal-soilWheels[i]);nearestWheel=min(nearestWheel,d);float rubberMask=1.0-smoothstep(.065,.085,d);float sameSide=1.0-smoothstep(.035,.13,abs(soilLocal.x-soilWheels[i].x));float archMask=sameSide*exp(-pow((soilLocal.z-soilWheels[i].z)/.085,2.0))*smoothstep(.018,.08,abs(soilLocal.x))* (1.0-smoothstep(.11,.17,soilLocal.y));coatLevel=max(coatLevel,max(mudZones[i]*rubberMask,mudZones[i+4]*archMask));}
   float underside=(1.0-smoothstep(.015,.07,soilLocal.y))*smoothstep(.085,.105,nearestWheel);coatLevel=max(coatLevel,vehicleSoil*underside*.8);
   float blob=soilNoise(soilLocal*155.0)*.68+soilNoise(soilLocal*540.0)*.32;
   coatCoverage=smoothstep(.74-coatLevel*.62,.85-coatLevel*.45,blob)*smoothstep(0.0,.025,coatLevel);
   thickness=coatCoverage*(.45+soilNoise(soilLocal*310.0)*.55);
   vec3 mudColour=mix(vec3(.24,.18,.105),vec3(.065,.045,.024),vehicleWet);
   diffuseColor.rgb=mix(diffuseColor.rgb,mudColour,coatCoverage*.96);
   float dustMask=vehicleDust*(.25+soilNoise(soilLocal*80.0)*.6)*(1.0-vehicleWet*.85);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.32,.27,.18),dustMask*.55);
   float scratch=step(.987,soilHash(floor(soilLocal*vec3(60,3500,75))))*vehicleWear*smoothstep(.065,.102,abs(soilLocal.x));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.24,.22),scratch*.8);
   }
  `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n roughnessFactor=mix(roughnessFactor,mix(.96,.32,vehicleWet),coatCoverage);',
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      '#include <normal_fragment_maps>\n normal=normalize(normal+vec3(dFdx(thickness),dFdy(thickness),0.0)*.22);',
    );
  };
  material.customProgramCacheKey = () => key() + '-zoned-mud-v2';
  material.needsUpdate = true;
}
function instanceFade(mesh: T.InstancedMesh) {
  const alpha = new T.InstancedBufferAttribute(new Float32Array(mesh.instanceMatrix.count), 1);
  alpha.setUsage(T.DynamicDrawUsage);
  mesh.geometry.setAttribute('instanceOpacity', alpha);
  const material = mesh.material as T.MeshBasicMaterial;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      'attribute float instanceOpacity;varying float stampOpacity;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n stampOpacity=instanceOpacity;',
    );
    shader.fragmentShader = 'varying float stampOpacity;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.a*=stampOpacity;',
    );
  };
  material.customProgramCacheKey = () => 'fading-contact-stamp-v1';
  return alpha;
}
function trackMask() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 96;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(255,255,255,.18)';
  ctx.fillRect(6, 0, 52, 96);
  ctx.fillStyle = 'white';
  for (let y = 0; y < 96; y += 20) {
    ctx.save();
    ctx.translate(32, y + 10);
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * 0.35);
      ctx.fillRect(side < 0 ? -29 : 2, -3, 27, 7);
      ctx.restore();
    }
    ctx.restore();
  }
  return new T.CanvasTexture(canvas);
}
export class EnvironmentEffects {
  group = new T.Group();
  pool = new ParticlePool(1000);
  condition: SurfaceCondition = cleanCondition();
  get soil() {
    return averageMud(this.condition);
  }
  set soil(value: number) {
    this.condition.mud.fill(T.MathUtils.clamp(value, 0, 1));
  }
  get wet() {
    return this.condition.wet;
  }
  set wet(value: number) {
    this.condition.wet = value;
  }
  dustAmount = [0, 0, 0, 0];
  time = 0;
  amount = [0, 0, 0, 0];
  lastTracks = [
    new T.Vector3(1e3, 0, 0),
    new T.Vector3(1e3, 0, 0),
    new T.Vector3(1e3, 0, 0),
    new T.Vector3(1e3, 0, 0),
  ];
  lastRipple = [0, 0, 0, 0];
  rain: T.LineSegments;
  rainPositions = new Float32Array(512 * 6);
  rainDrops = Array.from({ length: 512 }, () => new T.Vector3());
  rainReady = false;
  positions = new Float32Array(3000);
  colors = new Float32Array(3000);
  sizes = new Float32Array(1000);
  alphas = new Float32Array(1000);
  particles: T.Points;
  clumps: T.InstancedMesh;
  tracks: T.InstancedMesh;
  ripples: T.InstancedMesh;
  trackCursor = 0;
  rippleCursor = 0;
  trackAlpha: T.InstancedBufferAttribute;
  rippleAlpha: T.InstancedBufferAttribute;
  trackData: {
    p: T.Vector3;
    rotation: T.Quaternion;
    width: number;
    birth: number;
    mud: boolean;
  }[] = [];
  rippleData: { p: T.Vector3; birth: number }[] = [];
  constructor(
    public height: (x: number, z: number) => number,
    public waterAt: (p: T.Vector3) => number | null,
  ) {
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.BufferAttribute(this.positions, 3));
    geometry.setAttribute('color', new T.BufferAttribute(this.colors, 3));
    geometry.setAttribute('size', new T.BufferAttribute(this.sizes, 1));
    geometry.setAttribute('alpha', new T.BufferAttribute(this.alphas, 1));
    const rainGeometry = new T.BufferGeometry();
    rainGeometry.setAttribute('position', new T.BufferAttribute(this.rainPositions, 3));
    this.rain = new T.LineSegments(
      rainGeometry,
      new T.LineBasicMaterial({
        color: '#a5b5b0',
        transparent: true,
        opacity: 0.38,
        depthWrite: false,
      }),
    );
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    this.group.add(this.rain);
    this.particles = new T.Points(
      geometry,
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        vertexShader:
          'attribute vec3 color;attribute float size;attribute float alpha;varying vec3 c;varying float a;void main(){c=color;a=alpha;vec4 p=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*p;gl_PointSize=clamp(size*700.0/-p.z,1.0,80.0);}',
        fragmentShader:
          'varying vec3 c;varying float a;void main(){float d=length(gl_PointCoord-vec2(.5));if(d>.5||a<=0.0)discard;gl_FragColor=vec4(c,a*smoothstep(.5,.20,d));}',
      }),
    );
    this.particles.frustumCulled = false;
    this.group.add(this.particles);
    this.clumps = new T.InstancedMesh(
      new T.IcosahedronGeometry(1, 0),
      new T.MeshStandardMaterial({ color: 'white', roughness: 0.96 }),
      240,
    );
    this.clumps.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.clumps.frustumCulled = false;
    this.clumps.count = 0;
    this.group.add(this.clumps);
    this.tracks = new T.InstancedMesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({
        color: '#382e1f',
        map: trackMask(),
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        side: T.DoubleSide,
      }),
      400,
    );
    this.tracks.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.tracks.frustumCulled = false;
    this.tracks.count = 0;
    this.group.add(this.tracks);
    this.ripples = new T.InstancedMesh(
      new T.RingGeometry(0.89, 1, 32),
      new T.MeshBasicMaterial({
        color: '#c8d9ce',
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        side: T.DoubleSide,
      }),
      48,
    );
    this.ripples.instanceMatrix.setUsage(T.DynamicDrawUsage);
    this.ripples.frustumCulled = false;
    this.ripples.count = 0;
    this.group.add(this.ripples);
    this.trackAlpha = instanceFade(this.tracks);
    this.rippleAlpha = instanceFade(this.ripples);
  }
  rainStep(
    dt: number,
    enabled: boolean,
    centre: { x: number; y: number; z: number },
    density: number,
  ) {
    this.rain.visible = enabled && density > 0;
    if (!enabled) {
      this.rainReady = false;
      return;
    }
    const count = Math.floor(512 * density);
    for (let i = 0; i < count; i++) {
      const p = this.rainDrops[i];
      if (
        !this.rainReady ||
        p.y < this.height(p.x, p.z) ||
        Math.abs(p.x - centre.x) > 3 ||
        Math.abs(p.z - centre.z) > 3
      )
        p.set(
          centre.x + (this.pool.random() - 0.5) * 5,
          centre.y + 0.4 + this.pool.random() * 1.6,
          centre.z + (this.pool.random() - 0.5) * 5,
        );
      p.y -= dt * 2.2;
      this.rainPositions.set([p.x, p.y, p.z, p.x - 0.002, p.y + 0.035, p.z + 0.002], i * 6);
    }
    this.rainReady = true;
    this.rain.geometry.setDrawRange(0, count * 2);
    this.rain.geometry.attributes.position.needsUpdate = true;
  }
  clean() {
    this.condition = cleanCondition();
  }
  sample(sim: Simulation, index: number): ContactSample {
    const w = sim.wheels[index],
      axis = new T.Vector3(1, 0, 0).applyQuaternion(q(w.carrier.rotation())),
      normal = w.normal.clone(),
      forward = axis.clone().cross(normal).normalize(),
      centre = v(w.body.translation()),
      waterLevel = this.waterAt(centre),
      water = waterLevel !== null && centre.y - sim.tune.radius < waterLevel;
    return {
      contact: w.contact,
      load: w.load,
      omega: w.omega,
      radius: sim.tune.radius,
      speed: v(w.body.linvel()).dot(forward),
      slip: w.slip,
      lateral: w.lateralSlip,
      surface: w.surface.name,
      point: water ? new T.Vector3(centre.x, waterLevel!, centre.z) : w.point.clone(),
      normal: water ? new T.Vector3(0, 1, 0) : normal,
      axis,
      width: sim.tune.tyreWidth,
      water,
    };
  }
  step(dt: number, sim: Simulation, graphics: Graphics) {
    this.time += dt;
    const samples: ContactSample[] = [];
    for (let i = 0; i < 4; i++) {
      const s = this.sample(sim, i),
        intent = effectIntent(s);
      samples.push(s);
      this.dustAmount[i] += intent.dustRate * graphics.particles * dt;
      while (this.dustAmount[i] >= 1) {
        this.pool.emit(s, intent, true);
        this.dustAmount[i]--;
      }

      this.amount[i] += intent.rate * graphics.particles * dt;
      let emitted = 0;
      while (this.amount[i] >= 1 && emitted++ < 12) {
        this.pool.emit(s, intent);
        if (intent.kind === 'dirt') this.pool.emit(s, intent, true);
        this.amount[i]--;
      }
      if (intent.track && s.normal.y > 0.4 && s.point.distanceTo(this.lastTracks[i]) > 0.025) {
        const normal = s.normal.clone(),
          forward = s.axis.clone().cross(normal).normalize(),
          right = forward.clone().cross(normal).normalize(),
          rotation = new T.Quaternion().setFromRotationMatrix(
            new T.Matrix4().makeBasis(right, forward, normal),
          );
        const item = {
          p: s.point.clone().addScaledVector(normal, 0.0012),
          rotation,
          width: s.width,
          birth: this.time,
          mud: s.surface === 'Mud',
        };
        this.trackData[this.trackCursor++ % 400] = item;
        this.lastTracks[i].copy(s.point);
      }
      if (
        s.water &&
        (Math.abs(s.speed) > 0.02 || Math.abs(s.omega * s.radius) > 0.05) &&
        this.time - this.lastRipple[i] > 0.18
      ) {
        this.rippleData[this.rippleCursor++ % 48] = {
          p: s.point.clone().add(new T.Vector3(0, 0.001, 0)),
          birth: this.time,
        };
        this.lastRipple[i] = this.time;
      }
    }
    updateCondition(this.condition, samples, dt, sim.bodyScrape);
    for (let t = 0; t < dt; t += 0.025) this.pool.update(Math.min(0.025, dt - t), this.height);
  }
  render(graphics: Graphics) {
    const grainPose = new T.Object3D();
    let grainCount = 0;
    const detail = graphics.particles >= 0.75;
    this.group.visible = true;
    for (let i = 0; i < this.pool.capacity; i++) {
      const p = this.pool.slots[i],
        alpha =
          p.life > 0 ? Math.min(1, p.life / p.maxLife) * (p.kind === 'dust' ? 0.17 : 0.85) : 0;
      this.positions.set(p.p.toArray(), i * 3);
      this.colors.set(
        p.kind === 'water'
          ? [0.65, 0.8, 0.82]
          : p.kind === 'mud'
            ? [0.2, 0.14, 0.075]
            : p.kind === 'gravel'
              ? [0.43, 0.42, 0.35]
              : [0.52, 0.4, 0.25],
        i * 3,
      );
      this.sizes[i] = p.size;
      const solid = detail && p.kind !== 'dust' && p.kind !== 'water';
      this.alphas[i] = solid ? 0 : alpha;
      if (solid && alpha > 0 && grainCount < 240) {
        grainPose.position.copy(p.p);
        grainPose.rotation.set(p.p.x * 12 + p.life * 3, p.p.z * 17, p.life * 5);
        grainPose.scale.set(p.size * 0.8, p.size * 0.65, p.size);
        grainPose.updateMatrix();
        this.clumps.setMatrixAt(grainCount, grainPose.matrix);
        this.clumps.setColorAt(
          grainCount,
          new T.Color(p.kind === 'mud' ? '#473521' : p.kind === 'gravel' ? '#918d7a' : '#82613a'),
        );
        grainCount++;
      }
    }
    this.clumps.count = grainCount;
    this.clumps.instanceMatrix.needsUpdate = true;
    if (this.clumps.instanceColor) this.clumps.instanceColor.needsUpdate = true;
    for (const name of ['position', 'color', 'size', 'alpha'])
      this.particles.geometry.attributes[name].needsUpdate = true;
    this.particles.visible = graphics.particles > 0;
    const dummy = new T.Object3D();
    let count = 0;
    const max = Math.min(400, graphics.tracks);
    for (const item of this.trackData) {
      if (!item || this.time - item.birth > 100) continue;
      if (count >= max) break;
      const fade = Math.max(0, 1 - (this.time - item.birth) / 100);
      dummy.position.copy(item.p);
      dummy.quaternion.copy(item.rotation);
      dummy.scale.set(item.width, 0.032, 1);
      this.trackAlpha.setX(count, fade);
      dummy.updateMatrix();
      this.tracks.setMatrixAt(count++, dummy.matrix);
    }
    this.tracks.count = count;
    this.tracks.instanceMatrix.needsUpdate = true;
    this.trackAlpha.needsUpdate = true;
    count = 0;
    for (const item of this.rippleData) {
      if (!item) continue;
      const age = this.time - item.birth;
      if (age > 1.5) continue;
      dummy.position.copy(item.p);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.setScalar(0.012 + age * 0.055);
      this.rippleAlpha.setX(count, 1 - age / 1.5);
      dummy.updateMatrix();
      this.ripples.setMatrixAt(count++, dummy.matrix);
    }
    this.ripples.count = count;
    this.ripples.visible = graphics.water;
    this.ripples.instanceMatrix.needsUpdate = true;
    this.rippleAlpha.needsUpdate = true;
  }
}
export function bendVegetation(material: T.MeshStandardMaterial) {
  const uniforms = {
    wheelCenters: { value: Array.from({ length: 4 }, () => new T.Vector3(1000, 0, 0)) },
  };
  const old = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader, renderer) => {
    old(shader, renderer);
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'uniform vec3 wheelCenters[4];\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `
 vec4 mvPosition=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 mvPosition=instanceMatrix*mvPosition;
 #endif
 vec3 grassWorld=(modelMatrix*mvPosition).xyz;for(int i=0;i<4;i++){vec2 delta=grassWorld.xz-wheelCenters[i].xz;float strength=(1.0-smoothstep(.03,.16,length(delta)))*smoothstep(-.04,.1,grassWorld.y-wheelCenters[i].y);grassWorld.xz+=normalize(delta+vec2(.0001))*.04*strength;}mvPosition=viewMatrix*vec4(grassWorld,1.0);gl_Position=projectionMatrix*mvPosition;`,
    );
  };
  material.customProgramCacheKey = () => 'rc-contact-plants-v1';
  return uniforms;
}
