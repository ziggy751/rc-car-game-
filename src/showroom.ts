import * as T from 'three';
import { box, mesh, metal, rod, label, noiseTexture } from './materials';
export class Showroom {
  group = new T.Group();
  constructor() {
    const g = this.group;
    g.position.x = 100;
    const dark = metal('#263332', 0.72, 0.25),
      steel = metal('#5d6c6b', 0.42, 0.65),
      wood = metal('#695941', 0.84, 0);
    wood.map = noiseTexture('wood');
    const floor = new T.MeshStandardMaterial({
      color: '#454d47',
      roughness: 0.7,
      metalness: 0.12,
      map: noiseTexture('rock', 512),
    });
    floor.map!.repeat.set(9, 9);
    box(g, floor, [3, 0.04, 3], [0, -0.025, 0]);
    box(g, dark, [3, 1.5, 0.04], [0, 0.73, -0.94]);
    box(g, dark, [0.04, 1.5, 2.3], [-1.48, 0.73, 0.18]);
    const stand = mesh(new T.CylinderGeometry(0.39, 0.41, 0.1, 96), steel, g, [0, 0.05, 0]);
    stand.receiveShadow = true;
    mesh(
      new T.CylinderGeometry(0.38, 0.38, 0.005, 96),
      metal('#182321', 0.82, 0.1),
      g,
      [0, 0.103, 0],
    );
    const rim = mesh(
      new T.TorusGeometry(0.39, 0.002, 6, 128),
      new T.MeshStandardMaterial({ color: '#b99a63', emissive: '#b88c48', emissiveIntensity: 0.7 }),
      g,
      [0, 0.1, 0],
    );
    rim.rotation.x = Math.PI / 2;
    for (const side of [-1, 1]) {
      const x = side * 0.9;
      box(g, wood, [0.65, 0.04, 0.38], [x, 0.36, -0.63]);
      for (const z of [-0.77, -0.5]) box(g, steel, [0.035, 0.35, 0.035], [x, 0.17, z]);
      box(g, dark, [0.45, 0.28, 0.31], [x, 0.17, -0.63]);
      for (let j = 0; j < 4; j++) {
        box(g, steel, [0.39, 0.003, 0.003], [x, 0.07 + j * 0.06, -0.472]);
        box(g, steel, [0.13, 0.009, 0.014], [x, 0.09 + j * 0.06, -0.464]);
      }
      for (let shelf = 0; shelf < 2; shelf++) {
        const y = 0.64 + shelf * 0.25;
        box(g, wood, [0.65, 0.022, 0.22], [x, y, -0.8]);
        for (let j = 0; j < 4; j++) {
          const px = x - 0.23 + j * 0.15;
          if (shelf === 0) {
            const tyre = mesh(
              new T.TorusGeometry(0.045, 0.019, 12, 32),
              metal('#202824', 0.96, 0),
              g,
              [px, y + 0.07, -0.77],
            );
            mesh(new T.TorusGeometry(0.025, 0.003, 8, 24), steel, g, [px, y + 0.07, -0.749]);
            tyre.castShadow = true;
          } else {
            box(g, metal('#8d5f3f', 0.8, 0), [0.12, 0.08, 0.13], [px, y + 0.052, -0.79]);
            mesh(new T.PlaneGeometry(0.105, 0.035), label(j % 2 ? 'R1 PARTS' : 'C2 WORKS'), g, [
              px,
              y + 0.055,
              -0.721,
            ]);
          }
        }
      }
      // Chargers, charging leads and miniature battery packs.
      box(g, dark, [0.12, 0.025, 0.09], [x, 0.397, -0.61]);
      box(g, metal('#173b3e', 0.45, 0.25), [0.07, 0.002, 0.034], [x, 0.411, -0.61]);
      for (let j = 0; j < 3; j++)
        box(g, metal('#a8b4a1'), [0.009, 0.003, 0.008], [x - 0.026 + j * 0.026, 0.413, -0.58]);
      rod(g, metal('#ab4a31'), [x + 0.04, 0.41, -0.58], [x + 0.17, 0.4, -0.49], 0.0015);
      box(g, dark, [0.08, 0.02, 0.045], [x + 0.17, 0.395, -0.49]);
    }
    mesh(
      new T.PlaneGeometry(0.85, 0.18),
      label('RIDGEBOUND / FIELD WORKS', '#dad7bd'),
      g,
      [0, 1.04, -0.916],
    );
    mesh(
      new T.PlaneGeometry(0.55, 0.08),
      label('1:10  /  BUILT FOR THE LINE', '#9caa96'),
      g,
      [0, 0.88, -0.916],
    );
    for (const x of [-0.8, 0, 0.8]) {
      box(g, dark, [0.52, 0.025, 0.05], [x, 1.34, -0.25]);
      box(
        g,
        new T.MeshStandardMaterial({ color: '#fff1d2', emissive: '#fff1d2', emissiveIntensity: 2 }),
        [0.48, 0.005, 0.045],
        [x, 1.323, -0.25],
      );
    }
    const key = new T.SpotLight('#ffdfac', 16, 4, Math.PI / 4, 0.5, 2);
    key.position.set(0.65, 1.3, 0.6);
    key.target.position.set(0, 0.15, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0002;
    g.add(key, key.target);
    const fill = new T.PointLight('#a5c6d5', 2, 3, 2);
    fill.position.set(-0.7, 0.8, 0.5);
    g.add(fill);
  }
}
