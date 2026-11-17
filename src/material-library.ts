import * as T from 'three';
export type MaterialKind = 'rock' | 'dirt' | 'moss' | 'mud' | 'rubber' | 'bark' | 'steel';
const cache = new Map<
  MaterialKind,
  { map: T.CanvasTexture; normalMap: T.CanvasTexture; roughnessMap: T.CanvasTexture }
>();
function hash(x: number, y: number) {
  let n = Math.imul(x + 8192, 374761393) ^ Math.imul(y + 8192, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number, period: number) {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    a = x - ix,
    b = y - iy,
    u = a * a * (3 - 2 * a),
    v = b * b * (3 - 2 * b),
    h = (dx: number, dy: number) => hash((ix + dx + period) % period, (iy + dy + period) % period);
  return T.MathUtils.lerp(
    T.MathUtils.lerp(h(0, 0), h(1, 0), u),
    T.MathUtils.lerp(h(0, 1), h(1, 1), u),
    v,
  );
}
export function pbrMaps(kind: MaterialKind) {
  if (cache.has(kind)) return cache.get(kind)!;
  const size = 1024,
    heights = new Float32Array(size * size),
    albedo = new Uint8ClampedArray(size * size * 4),
    rough = new Uint8ClampedArray(size * size * 4),
    normals = new Uint8ClampedArray(size * size * 4);
  const palettes: Record<MaterialKind, [number, number, number]> = {
    rock: [124, 125, 111],
    dirt: [103, 82, 54],
    moss: [66, 80, 38],
    mud: [56, 45, 30],
    rubber: [29, 32, 29],
    bark: [87, 76, 58],
    steel: [143, 150, 148],
  };
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let f = 0;
      for (let octave = 0; octave < 6; octave++) {
        const frequency = 4 << octave;
        f += noise((x / size) * frequency, (y / size) * frequency, frequency) / (2 << octave);
      }
      const grain = hash(x, y),
        base = palettes[kind];
      let h = f;
      if (kind === 'rock') {
        const crack = Math.pow(
          Math.max(0, 1 - Math.abs(noise((x / size) * 14, (y / size) * 14, 14) - 0.5) * 35),
          4,
        );
        h = f * 0.75 - crack * 0.16;
      }
      if (kind === 'rubber') h = f * 0.03 + grain * 0.035;
      if (kind === 'bark')
        h = f * 0.4 + Math.pow(noise((x / size) * 54, (y / size) * 4, 64), 4) * 0.5;
      if (kind === 'steel') h = f * 0.01 + Math.pow(grain, 25) * 0.025;
      if (kind === 'mud') h = f * 0.8;
      const i = y * size + x,
        idx = i * 4;
      heights[i] = h;
      const shade = 0.52 + h * 0.85 + grain * 0.15;
      for (let c = 0; c < 3; c++) albedo[idx + c] = base[c] * shade;
      albedo[idx + 3] = 255;
      const r =
        kind === 'mud'
          ? 95 + f * 60
          : kind === 'steel'
            ? 100 + grain * 60
            : kind === 'rubber'
              ? 210 + grain * 20
              : 210 + f * 40;
      rough[idx] = rough[idx + 1] = rough[idx + 2] = r;
      rough[idx + 3] = 255;
    }
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const sample = (a: number, b: number) =>
          heights[((b + size) % size) * size + ((a + size) % size)],
        dx = (sample(x - 1, y) - sample(x + 1, y)) * 4,
        dy = (sample(x, y - 1) - sample(x, y + 1)) * 4,
        n = new T.Vector3(dx, dy, 1).normalize(),
        i = (y * size + x) * 4;
      normals[i] = (n.x * 0.5 + 0.5) * 255;
      normals[i + 1] = (n.y * 0.5 + 0.5) * 255;
      normals[i + 2] = (n.z * 0.5 + 0.5) * 255;
      normals[i + 3] = 255;
    }
  const texture = (data: Uint8ClampedArray, srgb = false) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const image = ctx.createImageData(size, size);
    image.data.set(data);
    ctx.putImageData(image, 0, 0);
    const tex = new T.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.colorSpace = srgb ? T.SRGBColorSpace : T.NoColorSpace;
    tex.anisotropy = 8;
    tex.userData.sharedPBR = true;
    tex.userData.sourceCanvas = canvas;
    return tex;
  };
  const maps = {
    map: texture(albedo, true),
    normalMap: texture(normals),
    roughnessMap: texture(rough),
  };
  cache.set(kind, maps);
  return maps;
}
export function surfaceMaterial(kind: MaterialKind) {
  const maps = pbrMaps(kind);
  return new T.MeshStandardMaterial({
    ...maps,
    roughness: 1,
    metalness: kind === 'steel' ? 0.8 : 0,
    normalScale: new T.Vector2(kind === 'rubber' ? 0.25 : 0.65, kind === 'rubber' ? 0.25 : 0.65),
  });
}
export function terrainMaterial() {
  const mat = surfaceMaterial('dirt'),
    moss = pbrMaps('moss'),
    rock = pbrMaps('rock'),
    mud = pbrMaps('mud'),
    uniforms = { groundWet: { value: 0 } };
  mat.vertexColors = true;
  mat.normalMap!.repeat.set(280, 280);
  mat.roughnessMap!.repeat.set(280, 280);
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, {
      mossMap: { value: moss.map },
      rockMap: { value: rock.map },
      mudMap: { value: mud.map },
      ...uniforms,
    });
    shader.vertexShader =
      'varying vec3 groundPosition;varying vec3 groundNormal;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n groundPosition=(modelMatrix*vec4(position,1.0)).xyz;groundNormal=normalize(mat3(modelMatrix)*normal);',
    );
    shader.fragmentShader =
      'varying vec3 groundPosition;varying vec3 groundNormal;uniform sampler2D mossMap;uniform sampler2D rockMap;uniform sampler2D mudMap;uniform float groundWet;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `vec2 soilUV=groundPosition.xz*7.0;vec3 soil=texture2D(map,soilUV).rgb;vec3 moss=texture2D(mossMap,soilUV*.7).rgb;vec3 rock=texture2D(rockMap,soilUV*.5).rgb;float mossBlend=smoothstep(.40,.64,sin(groundPosition.x*2.7)*cos(groundPosition.z*2.1)*.5+.5);float slope=smoothstep(.18,.55,1.0-abs(groundNormal.y));diffuseColor.rgb*=mix(mix(soil,moss,mossBlend*.6),rock,slope);float mudPatch=(1.0-smoothstep(.52,.84,abs(groundPosition.x-.15)))*(1.0-smoothstep(.52,.76,abs(groundPosition.z-5.05)));diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(mudMap,soilUV*.7).rgb,mudPatch*.85);diffuseColor.rgb*=1.0-groundWet*.32;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      '#include <roughnessmap_fragment>\n float wetMud=(1.0-smoothstep(.52,.84,abs(groundPosition.x-.15)))*(1.0-smoothstep(.52,.76,abs(groundPosition.z-5.05)));roughnessFactor=mix(roughnessFactor,.28,max(groundWet,wetMud*.8));',
    );
  };
  mat.customProgramCacheKey = () => 'layered-ground-v1';
  return { material: mat, uniforms };
}
