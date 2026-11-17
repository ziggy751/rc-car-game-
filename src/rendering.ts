import * as T from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { graphicPresets, type Graphics } from './graphics';
import type { Park } from './world';
export type Weather = 'Clear' | 'Overcast' | 'Rain' | 'Fog' | 'Sunset' | 'Night';
export class Rendering {
  composer: EffectComposer;
  ao: SSAOPass;
  bloom: UnrealBloomPass;
  dof: BokehPass;
  lastKey = '';
  dynamicScale = 1;
  averageDt = 1 / 60;
  autoLevel = 'Medium';
  elapsed = 0;
  roomEnv: T.Texture;
  outsideEnv: T.Texture | null = null;
  outsideTarget: T.WebGLRenderTarget | null = null;
  constructor(
    public renderer: T.WebGLRenderer,
    public scene: T.Scene,
    public camera: T.PerspectiveCamera,
    public park: Park,
    environment: T.Texture,
  ) {
    this.roomEnv = environment;
    this.renderer.info.autoReset = false;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    this.ao = new SSAOPass(scene, camera, innerWidth, innerHeight);
    this.ao.kernelRadius = 0.06;
    this.ao.minDistance = 0.001;
    this.ao.maxDistance = 0.09;
    this.composer.addPass(this.ao);
    this.bloom = new UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), 0.15, 0.35, 1.15);
    this.composer.addPass(this.bloom);
    this.dof = new BokehPass(scene, camera, { focus: 1, aperture: 0.00015, maxblur: 0.006 });
    this.composer.addPass(this.dof);
    this.composer.addPass(new OutputPass());
    this.weather('Clear');
  }
  effective(g: Graphics): Graphics {
    return g.preset === 'Auto'
      ? {
          ...graphicPresets[this.autoLevel as 'Low' | 'Medium' | 'High'],
          preset: 'Auto',
          fpsLimit: g.fpsLimit,
          hideHUD: g.hideHUD,
          showFPS: g.showFPS,
          dynamicResolution: g.dynamicResolution,
        }
      : g;
  }
  observe(dt: number, g: Graphics) {
    if (dt <= 0 || dt > 1) return;
    this.averageDt += (dt - this.averageDt) * 0.03;
    this.elapsed += dt;
    if (g.preset === 'Auto' && this.elapsed > 4) {
      this.autoLevel =
        this.averageDt > 1 / 32 ? 'Low' : this.averageDt > 1 / 53 ? 'Medium' : 'High';
      this.elapsed = 0;
    }
    if (g.dynamicResolution) {
      const target = g.fpsLimit || 60,
        next =
          this.averageDt > (1 / target) * 1.2
            ? Math.max(0.65, this.dynamicScale - 0.004)
            : this.averageDt < (1 / target) * 0.9
              ? Math.min(1, this.dynamicScale + 0.002)
              : this.dynamicScale;
      if (Math.abs(next - this.dynamicScale) > 0.001) this.dynamicScale = next;
    } else this.dynamicScale = 1;
  }
  apply(raw: Graphics, indoor: boolean) {
    const g = this.effective(raw),
      key = JSON.stringify({ ...g, indoor, dynamic: Math.round(this.dynamicScale * 20) });
    if (key === this.lastKey) return;
    this.lastKey = key;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5) * g.scale * this.dynamicScale);
    this.renderer.setSize(innerWidth, innerHeight);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(innerWidth, innerHeight);
    this.ao.setSize(Math.round(innerWidth / 2), Math.round(innerHeight / 2));
    this.renderer.shadowMap.enabled = g.shadows > 0;
    this.renderer.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer.toneMappingExposure = g.exposure;
    this.camera.far = indoor ? 8 : g.drawDistance;
    this.camera.updateProjectionMatrix();
    this.ao.enabled = g.ao;
    this.bloom.enabled = g.bloom;
    this.dof.enabled = g.dof;
    const size = [256, 512, 1024, 2048][g.shadows];
    this.scene.traverse((o) => {
      if (o instanceof T.DirectionalLight || o instanceof T.SpotLight) {
        const l = o as T.SpotLight | T.DirectionalLight;
        l.castShadow = g.shadows > 0;
        if (l.shadow.mapSize.x !== size) {
          l.shadow.map?.dispose();
          l.shadow.map = null;
          l.shadow.mapSize.set(size, size);
        }
      }
    });
    this.park.vegetation.visible = true;
    this.park.vegetation.traverse((o) => {
      if (o instanceof T.InstancedMesh) {
        o.userData.fullCount ??= o.count;
        o.count = Math.floor(o.userData.fullCount * g.vegetation);
      }
    });
    const water = this.park.water.material as T.MeshPhysicalMaterial;
    water.roughness = g.water ? 0.18 : 0.75;
    water.normalScale.setScalar(g.water ? 0.09 : 0);
    water.clearcoat = g.water ? 1 : 0;
    const visited = new Set<T.Texture>();
    this.scene.traverse((o) => {
      if (!(o instanceof T.Mesh)) return;
      for (const material of Array.isArray(o.material) ? o.material : [o.material]) {
        for (const key of ['map', 'normalMap', 'roughnessMap', 'bumpMap']) {
          const t = (material as any)[key] as T.Texture | null;
          if (t && !visited.has(t)) {
            visited.add(t);
            if (t.userData.sourceCanvas && t.image.width !== g.textureSize) {
              const canvas = document.createElement('canvas');
              canvas.width = canvas.height = g.textureSize;
              canvas
                .getContext('2d')!
                .drawImage(t.userData.sourceCanvas, 0, 0, g.textureSize, g.textureSize);
              t.image = canvas;
            }

            t.anisotropy = Math.min(g.anisotropy, this.renderer.capabilities.getMaxAnisotropy());
            t.needsUpdate = true;
          }
        }
      }
    });
    this.scene.environment = indoor ? this.roomEnv : (this.outsideEnv ?? this.roomEnv);
    this.park.sky.visible = !indoor;
    if (this.scene.fog instanceof T.FogExp2)
      this.scene.fog.density = indoor
        ? 0
        : (this.currentWeather === 'Fog' ? 0.16 : this.currentWeather === 'Rain' ? 0.055 : 0.015) +
          0.5 / g.drawDistance;
  }
  currentWeather: Weather = 'Clear';
  weather(value: Weather) {
    this.currentWeather = value;
    const sun = this.park.sun,
      hemi = this.park.hemisphere,
      sky = this.park.sky.material.uniforms;
    const params = {
      Clear: [3, 1.15, '#ffe6bd', '#a0afa0'],
      Overcast: [0.9, 1.5, '#dce1dd', '#9da9a5'],
      Rain: [0.6, 1.0, '#c3d2da', '#7c908e'],
      Fog: [0.65, 1.1, '#e0e6df', '#a5b0aa'],
      Sunset: [2.6, 0.8, '#f3b26c', '#a5a18b'],
      Night: [0.05, 0.12, '#7991ae', '#111e26'],
    }[value];
    sun.intensity = params[0] as number;
    sun.color.set(params[2] as string);
    hemi.intensity = params[1] as number;
    if (this.scene.fog instanceof T.FogExp2) this.scene.fog.color.set(params[3] as string);
    const position =
      value === 'Sunset'
        ? new T.Vector3(-50, 6, -15)
        : value === 'Night'
          ? new T.Vector3(0, -15, 50)
          : new T.Vector3(-25, 35, -15);
    sky.sunPosition.value.copy(position);
    this.park.sunOffset.copy(
      value === 'Sunset' ? new T.Vector3(-16, 4, -8) : new T.Vector3(-10, 16, -8),
    );
    sky.turbidity.value = value === 'Overcast' || value === 'Rain' ? 12 : 5;
    sky.rayleigh.value = value === 'Night' ? 0.1 : 1.8;
    this.park.terrainWet.value = value === 'Rain' ? 1 : 0;
    const pmrem = new T.PMREMGenerator(this.renderer),
      skyScene = new T.Scene(),
      clone = this.park.sky.clone();
    clone.visible = true;
    skyScene.add(clone);
    const result = pmrem.fromScene(skyScene, 0.04, 0.1, 1000);
    this.outsideTarget?.dispose();
    this.outsideTarget = result;
    this.outsideEnv = result.texture;
    pmrem.dispose();
    this.lastKey = '';
  }
  render(focus: number) {
    (this.dof as any).uniforms.focus.value = Math.max(0.15, focus);
    this.renderer.info.reset();
    this.composer.render();
  }
  resize() {
    this.lastKey = '';
  }
}
