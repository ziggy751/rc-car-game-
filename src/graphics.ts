export type Graphics = {
  preset: 'Low' | 'Medium' | 'High' | 'Ultra' | 'Auto' | 'Custom';
  scale: number;
  textureSize: 128 | 256 | 512 | 1024;
  wheelDetail: 0 | 1 | 2;
  tyreDeformation: boolean;
  shadows: 0 | 1 | 2 | 3;
  vegetation: number;
  particles: number;
  tracks: number;
  water: boolean;
  accumulation: boolean;
  ao: boolean;
  bloom: boolean;
  dof: boolean;
  exposure: number;
  anisotropy: number;
  drawDistance: number;
  fpsLimit: 0 | 30 | 60 | 90 | 120;
  dynamicResolution: boolean;
  showFPS: boolean;
  hideHUD: boolean;
};
export const graphicPresets: Record<'Low' | 'Medium' | 'High' | 'Ultra', Graphics> = {
  Low: {
    preset: 'Low',
    textureSize: 128,
    wheelDetail: 0,
    tyreDeformation: true,
    scale: 0.75,
    shadows: 0,
    vegetation: 0.35,
    particles: 0.2,
    tracks: 40,
    water: false,
    accumulation: false,
    ao: false,
    bloom: false,
    dof: false,
    exposure: 1,
    anisotropy: 2,
    drawDistance: 45,
    fpsLimit: 60,
    dynamicResolution: false,
    showFPS: false,
    hideHUD: false,
  },
  Medium: {
    preset: 'Medium',
    textureSize: 256,
    wheelDetail: 1,
    tyreDeformation: true,
    scale: 1,
    shadows: 1,
    vegetation: 0.6,
    particles: 0.5,
    tracks: 120,
    water: true,
    accumulation: true,
    ao: false,
    bloom: false,
    dof: false,
    exposure: 1,
    anisotropy: 4,
    drawDistance: 65,
    fpsLimit: 60,
    dynamicResolution: false,
    showFPS: false,
    hideHUD: false,
  },
  High: {
    preset: 'High',
    textureSize: 512,
    wheelDetail: 2,
    tyreDeformation: true,
    scale: 1,
    shadows: 2,
    vegetation: 0.85,
    particles: 0.75,
    tracks: 220,
    water: true,
    accumulation: true,
    ao: false,
    bloom: true,
    dof: false,
    exposure: 1,
    anisotropy: 8,
    drawDistance: 90,
    fpsLimit: 0,
    dynamicResolution: false,
    showFPS: false,
    hideHUD: false,
  },
  Ultra: {
    preset: 'Ultra',
    textureSize: 1024,
    wheelDetail: 2,
    tyreDeformation: true,
    scale: 1.25,
    shadows: 3,
    vegetation: 1,
    particles: 1,
    tracks: 400,
    water: true,
    accumulation: true,
    ao: true,
    bloom: true,
    dof: false,
    exposure: 1,
    anisotropy: 16,
    drawDistance: 130,
    fpsLimit: 0,
    dynamicResolution: false,
    showFPS: false,
    hideHUD: false,
  },
};
export function validateGraphics(raw: any, legacy = 'High'): Graphics {
  const selected = raw?.preset ?? legacy,
    base = graphicPresets[selected as keyof typeof graphicPresets] ?? graphicPresets.High;
  const g = { ...base };
  if (selected === 'Auto' || selected === 'Custom') g.preset = selected;
  for (const key of [
    'scale',
    'vegetation',
    'particles',
    'tracks',
    'exposure',
    'anisotropy',
    'drawDistance',
  ] as const) {
    const value = raw?.[key];
    if (typeof value === 'number' && Number.isFinite(value)) (g as any)[key] = value;
  }
  const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
  g.scale = clamp(g.scale, 0.5, 1.5);
  g.vegetation = clamp(g.vegetation, 0.1, 1);
  g.particles = clamp(g.particles, 0, 1);
  g.tracks = Math.round(clamp(g.tracks, 0, 400));
  g.exposure = clamp(g.exposure, 0.65, 1.5);
  g.anisotropy = clamp(g.anisotropy, 1, 16);
  g.drawDistance = clamp(g.drawDistance, 25, 160);
  if ([128, 256, 512, 1024].includes(raw?.textureSize)) g.textureSize = raw.textureSize;
  if ([0, 1, 2].includes(raw?.wheelDetail)) g.wheelDetail = raw.wheelDetail;
  if (typeof raw?.tyreDeformation === 'boolean') g.tyreDeformation = raw.tyreDeformation;
  if ([0, 1, 2, 3].includes(raw?.shadows)) g.shadows = raw.shadows;
  if ([0, 30, 60, 90, 120].includes(raw?.fpsLimit)) g.fpsLimit = raw.fpsLimit;
  for (const key of [
    'water',
    'accumulation',
    'ao',
    'bloom',
    'dof',
    'dynamicResolution',
    'showFPS',
    'hideHUD',
  ] as const)
    if (typeof raw?.[key] === 'boolean') g[key] = raw[key];
  return g;
}
