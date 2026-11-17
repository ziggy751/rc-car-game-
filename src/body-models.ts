import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mesh, box, metal, rod, tube, label, noiseTexture } from './materials';
import type { VehicleId } from './catalogue';
function panel(parent: T.Object3D, material: T.Material, points: number[][]) {
  const g = new T.BufferGeometry(),
    p = points.flat(),
    indices = [];
  for (let i = 1; i < points.length - 1; i++) indices.push(0, i, i + 1);
  g.setAttribute('position', new T.Float32BufferAttribute(p, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return mesh(g, material, parent);
}
export function railGeometry(points: number[][]) {
  const curve = new T.CatmullRomCurve3(
      points.map((p) => new T.Vector3(...(p as [number, number, number]))),
    ),
    section = [
      [-0.003, -0.006],
      [0.003, -0.006],
      [0.003, -0.005],
      [-0.002, -0.005],
      [-0.002, 0.005],
      [0.003, 0.005],
      [0.003, 0.006],
      [-0.003, 0.006],
    ],
    verts: number[] = [],
    indices: number[] = [];
  for (let i = 0; i <= 64; i++) {
    const p = curve.getPoint(i / 64);
    for (const [x, y] of section) verts.push(p.x + x, p.y + y, p.z);
  }
  for (let i = 0; i < 64; i++)
    for (let j = 0; j < 8; j++) {
      const a = i * 8 + j,
        b = i * 8 + ((j + 1) % 8),
        c = a + 8,
        d = b + 8;
      indices.push(a, c, b, b, c, d);
    }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.Float32BufferAttribute(verts, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
export function buildBody(s: T.Group, paint: T.MeshPhysicalMaterial, id: VehicleId) {
  const black = metal('#252c29', 0.68, 0.35),
    steel = metal('#8d9896', 0.36, 0.82),
    red = metal('#a74529', 0.5, 0.45),
    carbon = new T.MeshStandardMaterial({
      color: '#1f2926',
      roughness: 0.78,
      metalness: 0.08,
      map: noiseTexture('rubber'),
    }),
    glass = new T.MeshPhysicalMaterial({
      color: '#78928b',
      roughness: 0.11,
      metalness: 0.05,
      transparent: true,
      opacity: 0.28,
      clearcoat: 1,
      side: T.DoubleSide,
    });
  const rounded = (size: number[], pos: number[], m: T.Material = paint, r = 0.003) =>
    mesh(new RoundedBoxGeometry(...(size as [number, number, number]), 3, r), m, s, pos);
  const bolt = (x: number, y: number, z: number) => {
    const b = mesh(new T.CylinderGeometry(0.0017, 0.0017, 0.0025, 6), steel, s, [x, y, z]);
    b.rotation.x = Math.PI / 2;
  };
  // Every shell is mounted on four real-looking miniature body posts and removable R-clips.
  for (const x of [-0.068, 0.068])
    for (const z of [-0.17, 0.14]) {
      rod(s, black, [x, 0.045, z], [x, 0.112, z], 0.002);
      mesh(new T.TorusGeometry(0.003, 0.00065, 5, 12), steel, s, [x, 0.115, z]);
    }
  if (id === 'r1' || id === 'w3') {
    // Thin hard-shell panels, open arches, short overhangs and a low two-seat cab.
    for (const side of [-1, 1]) {
      const shape = new T.Shape();
      shape.moveTo(-0.232, 0.112);
      shape.lineTo(0.224, 0.118);
      shape.lineTo(0.24, 0.058);
      for (let j = 0; j <= 32; j++) {
        const a = (Math.PI * j) / 32;
        shape.lineTo(0.162 + Math.cos(a) * 0.076, 0.014 + Math.sin(a) * 0.076);
      }
      shape.lineTo(0.077, 0.063);
      shape.lineTo(-0.077, 0.063);
      for (let j = 0; j <= 32; j++) {
        const a = (Math.PI * j) / 32;
        shape.lineTo(-0.162 + Math.cos(a) * 0.076, 0.014 + Math.sin(a) * 0.076);
      }
      shape.lineTo(-0.24, 0.057);
      shape.closePath();
      const lower = mesh(
        new T.ExtrudeGeometry(shape, {
          depth: 0.0018,
          bevelEnabled: true,
          bevelSize: 0.0008,
          bevelThickness: 0.0008,
          bevelSegments: 2,
        }),
        paint,
        s,
      );
      lower.rotation.y = -Math.PI / 2;
      lower.position.x = side * 0.101;
      // Door skin, glass and actual perimeter seals follow a sloping A-pillar.
      panel(s, paint, [
        [side * 0.101, 0.105, 0.057],
        [side * 0.098, 0.132, 0.04],
        [side * 0.096, 0.132, -0.125],
        [side * 0.101, 0.074, -0.125],
        [side * 0.101, 0.074, 0.045],
      ]);
      const window = [
        [side * 0.096, 0.132, 0.038],
        [side * 0.087, 0.174, 0.008],
        [side * 0.089, 0.174, -0.115],
        [side * 0.097, 0.132, -0.127],
      ];
      panel(s, glass, window);
      for (let j = 0; j < 4; j++) rod(s, black, window[j], window[(j + 1) % 4], 0.0015);
      rod(s, paint, [side * 0.101, 0.119, 0.053], [side * 0.088, 0.179, 0.01], 0.003);
      rod(s, paint, [side * 0.101, 0.12, -0.132], [side * 0.09, 0.179, -0.12], 0.003);
      box(s, black, [0.004, 0.005, 0.023], [side * 0.104, 0.12, -0.081]);
      for (const z of [0.023, -0.109]) box(s, steel, [0.003, 0.01, 0.006], [side * 0.104, 0.09, z]);
      rod(s, black, [side * 0.113, 0.055, -0.13], [side * 0.113, 0.055, 0.08], 0.004);
      // Fender lip is a thin curved extrusion rather than a decorative giant hoop.
      for (const z of [-0.162, 0.162]) {
        const arch = new T.Shape();
        for (let j = 0; j <= 32; j++) {
          const a = (j * Math.PI) / 32;
          const x = Math.cos(a) * 0.077,
            y = 0.014 + Math.sin(a) * 0.077;
          j ? arch.lineTo(x, y) : arch.moveTo(x, y);
        }
        for (let j = 32; j >= 0; j--) {
          const a = (j * Math.PI) / 32;
          arch.lineTo(Math.cos(a) * 0.083, 0.014 + Math.sin(a) * 0.083);
        }
        arch.closePath();
        const f = mesh(
          new T.ExtrudeGeometry(arch, { depth: 0.017, bevelEnabled: false }),
          black,
          s,
        );
        f.rotation.y = -Math.PI / 2;
        f.position.set(side < 0 ? -0.1 : 0.117, 0, z);
      }
      const decal = mesh(new T.PlaneGeometry(0.07, 0.013), label('FIELDCRAFT / R1', '#d8dcca'), s, [
        side * 0.1025,
        0.095,
        -0.041,
      ]);
      decal.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      box(s, black, [0.013, 0.018, 0.023], [side * 0.112, 0.144, 0.031]);
      rod(s, black, [side * 0.099, 0.137, 0.037], [side * 0.111, 0.144, 0.031], 0.0018);
    }
    // Low crowned hood: hand-authored cross sections and creases give the shell its shape.
    const hoodZ = [0.066, 0.12, 0.21],
      hoodW = [0.096, 0.099, 0.09],
      hoodY = [0.126, 0.126, 0.114];
    for (let j = 0; j < 2; j++)
      for (let k = 0; k < 4; k++) {
        const xa = [-1, -0.75, 0, 0.75, 1][k],
          xb = [-1, -0.75, 0, 0.75, 1][k + 1];
        const y = (i: number, x: number) => hoodY[i] + (1 - Math.abs(x)) * 0.004;
        panel(s, paint, [
          [xa * hoodW[j], y(j, xa), hoodZ[j]],
          [xb * hoodW[j], y(j, xb), hoodZ[j]],
          [xb * hoodW[j + 1], y(j + 1, xb), hoodZ[j + 1]],
          [xa * hoodW[j + 1], y(j + 1, xa), hoodZ[j + 1]],
        ]);
      }
    rounded([0.181, 0.005, 0.142], [0, 0.179, -0.055], paint, 0.004);
    panel(s, glass, [
      [-0.093, 0.133, 0.044],
      [0.093, 0.133, 0.044],
      [0.085, 0.174, 0.012],
      [-0.085, 0.174, 0.012],
    ]);
    rod(s, black, [-0.094, 0.132, 0.046], [0.094, 0.132, 0.046], 0.002);
    for (const x of [-0.053, 0.053])
      rod(s, black, [x, 0.137, 0.044], [x + 0.018, 0.143, 0.04], 0.001);
    panel(s, glass, [
      [-0.088, 0.139, -0.128],
      [-0.087, 0.173, -0.122],
      [0.087, 0.173, -0.122],
      [0.088, 0.139, -0.128],
    ]);
    rounded([0.186, 0.025, 0.005], [0, 0.127, -0.132], paint, 0.002);
    // Open miniature pickup bed with liner ribs, rear light housings and separate tailgate.
    box(s, carbon, [0.19, 0.002, 0.101], [0, 0.083, -0.18]);
    for (let j = 0; j < 9; j++)
      rod(s, black, [-0.08 + j * 0.02, 0.087, -0.135], [-0.08 + j * 0.02, 0.087, -0.225], 0.001);
    for (const x of [-0.098, 0.098]) box(s, paint, [0.004, 0.034, 0.107], [x, 0.096, -0.18]);
    rounded([0.195, 0.036, 0.004], [0, 0.095, -0.235]);
    for (const x of [-0.081, 0.081]) {
      box(s, black, [0.025, 0.022, 0.005], [x, 0.098, -0.239]);
      box(
        s,
        new T.MeshStandardMaterial({
          color: '#a52e21',
          emissive: '#5b1209',
          emissiveIntensity: 0.5,
          roughness: 0.3,
        }),
        [0.02, 0.016, 0.005],
        [x, 0.098, -0.242],
      );
    }
    // Low-profile rack; fasteners and a six-lens LED lightbar remain genuinely 3D.
    for (const x of [-0.079, 0.079])
      for (const y of [0.19, 0.202]) rod(s, black, [x, y, -0.12], [x, y, 0.012], 0.0018);
    for (let z = -0.12; z <= 0.012; z += 0.022)
      rod(s, black, [-0.079, 0.19, z], [0.079, 0.19, z], 0.0017);
    for (const z of [-0.12, 0.012]) rod(s, black, [-0.079, 0.202, z], [0.079, 0.202, z], 0.0018);
    box(s, red, [0.064, 0.008, 0.031], [0.035, 0.198, -0.08]);
    for (let j = 0; j < 10; j++)
      box(s, black, [0.003, 0.002, 0.022], [0.008 + j * 0.006, 0.203, -0.08]);
  } else {
    // Competition cage is an exposed triangulated structure, not a body-shaped box.
    for (const side of [-1, 1]) {
      tube(
        s,
        black,
        [
          [side * 0.073, 0.02, -0.19],
          [side * 0.071, 0.082, -0.15],
          [side * 0.057, 0.145, -0.075],
          [side * 0.055, 0.145, 0.035],
          [side * 0.08, 0.062, 0.13],
          [side * 0.075, 0.028, 0.21],
        ],
        0.0035,
      );
      rod(s, black, [side * 0.073, 0.028, -0.19], [side * 0.08, 0.062, 0.13], 0.003);
      rod(s, black, [side * 0.072, 0.038, -0.13], [side * 0.057, 0.145, -0.075], 0.003);
      rod(s, black, [side * 0.071, 0.05, -0.14], [side * 0.055, 0.145, 0.035], 0.0028);
      panel(s, paint, [
        [side * 0.077, 0.042, -0.12],
        [side * 0.069, 0.082, -0.12],
        [side * 0.068, 0.1, -0.043],
        [side * 0.077, 0.05, 0.035],
      ]);
      for (const z of [-0.1, -0.06, -0.02]) bolt(side * 0.078, 0.053, z);
    }
    for (const z of [-0.075, 0.035]) rod(s, black, [-0.056, 0.145, z], [0.056, 0.145, z], 0.0035);
    rod(s, black, [-0.07, 0.04, -0.14], [0.057, 0.145, -0.075], 0.0025);
    rod(s, black, [0.07, 0.04, -0.14], [-0.057, 0.145, -0.075], 0.0025);
    panel(s, carbon, [
      [-0.057, 0.149, -0.078],
      [0.057, 0.149, -0.078],
      [0.055, 0.149, 0.035],
      [-0.055, 0.149, 0.035],
    ]);
    panel(s, paint, [
      [-0.079, 0.064, 0.075],
      [0.079, 0.064, 0.075],
      [0.069, 0.08, 0.192],
      [-0.069, 0.08, 0.192],
    ]);
    for (const x of [-0.044, 0.044]) {
      box(s, black, [0.035, 0.009, 0.034], [x, 0.048, -0.02]);
      const seat = box(s, black, [0.035, 0.033, 0.008], [x, 0.066, -0.039]);
      seat.rotation.x = -0.15;
      box(s, red, [0.003, 0.029, 0.002], [x, 0.068, -0.033]);
    }
  }
  if (id === 'w3') buildWagon(s, paint, black, steel, glass);
  if (id === 'b4') buildBuggy(s, paint, black, steel, carbon);
  // Panel seams, hood hinges and radiator louvers remain visible up close.
  for (const side of [-1, 1]) {
    for (let j = 0; j < 6; j++)
      box(
        s,
        black,
        [0.022, 0.001, 0.002],
        [side * 0.054, id === 'r1' || id === 'w3' ? 0.13 : 0.084, 0.085 + j * 0.007],
      );
    for (const z of [0.09, 0.185])
      box(
        s,
        steel,
        [0.006, 0.002, 0.012],
        [side * 0.084, id === 'r1' || id === 'w3' ? 0.13 : 0.083, z],
      );
  }
  // Shared miniature grille, machined winch, shackles and LEDs.
  const grilleY = id === 'r1' || id === 'w3' ? 0.092 : 0.056,
    grilleZ = id === 'r1' || id === 'w3' ? 0.214 : 0.202;
  rounded(
    [id === 'r1' || id === 'w3' ? 0.181 : 0.152, 0.048, 0.005],
    [0, grilleY, grilleZ],
    paint,
    0.002,
  );
  for (let j = 0; j < 7; j++)
    rounded([0.006, 0.03, 0.003], [-0.042 + j * 0.014, grilleY, grilleZ + 0.004], black, 0.0015);
  for (const x of [-0.07, 0.07]) {
    const housing = mesh(new T.CylinderGeometry(0.0145, 0.0145, 0.005, 32), black, s, [
      x,
      grilleY + 0.006,
      grilleZ + 0.006,
    ]);
    housing.rotation.x = Math.PI / 2;
    const lens = mesh(
      new T.CylinderGeometry(0.0115, 0.0115, 0.0055, 32),
      new T.MeshPhysicalMaterial({
        color: '#e8ddbf',
        emissive: '#efdca7',
        emissiveIntensity: 0.5,
        roughness: 0.08,
        clearcoat: 1,
      }),
      s,
      [x, grilleY + 0.006, grilleZ + 0.009],
    );
    lens.rotation.x = Math.PI / 2;
    const halo = mesh(new T.TorusGeometry(0.01, 0.0008, 5, 32), steel, s, [
      x,
      grilleY + 0.006,
      grilleZ + 0.012,
    ]);
    halo.rotation.z = 0.2;
  }
  tube(
    s,
    black,
    [
      [-0.116, 0.049, 0.224],
      [-0.09, 0.053, 0.24],
      [0.09, 0.053, 0.24],
      [0.116, 0.049, 0.224],
    ],
    0.0045,
  );
  const drum = mesh(new T.CylinderGeometry(0.006, 0.006, 0.032, 20), steel, s, [0, 0.063, 0.233]);
  drum.rotation.z = Math.PI / 2;
  for (const x of [-0.022, 0.022]) box(s, black, [0.009, 0.023, 0.022], [x, 0.063, 0.233]);
  for (const x of [-0.068, 0.068]) {
    const shackle = mesh(new T.TorusGeometry(0.0055, 0.0014, 7, 18, Math.PI * 1.7), red, s, [
      x,
      0.042,
      0.239,
    ]);
    shackle.rotation.z = 0.4;
  }
  const lightY = id === 'r1' || id === 'w3' ? 0.189 : 0.143;
  box(s, black, [0.13, 0.009, 0.009], [0, lightY, 0.022]);
  for (let j = 0; j < 10; j++)
    box(
      s,
      new T.MeshStandardMaterial({ color: '#fff1d0', emissive: '#ffe2a7', emissiveIntensity: 0.7 }),
      [0.009, 0.005, 0.003],
      [-0.057 + j * 0.0127, lightY, 0.028],
    );
  // True interior details and 540-compatible service hardware, shared scale.
  if (id === 'r1' || id === 'w3') {
    box(s, black, [0.173, 0.013, 0.024], [0, 0.121, 0.027]);
    for (const x of [-0.044, 0.044]) {
      rounded([0.036, 0.009, 0.041], [x, 0.092, -0.035], black);
      rounded([0.036, 0.039, 0.008], [x, 0.112, -0.055], black);
      box(s, red, [0.003, 0.034, 0.002], [x, 0.112, -0.049]);
    }
    const steering = mesh(
      new T.TorusGeometry(0.011, 0.0015, 6, 24),
      black,
      s,
      [-0.045, 0.131, 0.012],
    );
    steering.rotation.x = -0.5;
  }
  for (const x of [-0.083, 0.083]) for (const z of [-0.157, 0.15]) bolt(x, 0.065, z);
  rod(s, black, [0.071, 0.089, -0.17], [0.072, 0.215, -0.17], 0.00065);
}

/** Full rear cabin, cargo glazing, ribbed roof and a treaded tailgate spare distinguish the expedition wagon. */
function buildWagon(
  s: T.Group,
  paint: T.MeshPhysicalMaterial,
  black: T.Material,
  steel: T.Material,
  glass: T.Material,
) {
  mesh(new RoundedBoxGeometry(0.19, 0.005, 0.16, 3, 0.003), paint, s, [0, 0.179, -0.175]);
  for (const side of [-1, 1]) {
    panel(s, paint, [
      [side * 0.099, 0.088, -0.133],
      [side * 0.099, 0.139, -0.133],
      [side * 0.095, 0.174, -0.134],
      [side * 0.095, 0.174, -0.242],
      [side * 0.099, 0.088, -0.242],
    ]);
    panel(s, glass, [
      [side * 0.0995, 0.138, -0.142],
      [side * 0.096, 0.17, -0.142],
      [side * 0.096, 0.17, -0.232],
      [side * 0.0995, 0.138, -0.232],
    ]);
    for (const z of [-0.14, -0.195, -0.239])
      rod(s, black, [side * 0.101, 0.134, z], [side * 0.096, 0.176, z], 0.0016);
    rod(s, black, [side * 0.102, 0.132, -0.14], [side * 0.102, 0.132, -0.24], 0.0018);
    box(s, black, [0.004, 0.004, 0.021], [side * 0.103, 0.12, -0.18]);
    for (let j = 0; j < 4; j++)
      rod(
        s,
        black,
        [side * (0.035 + j * 0.014), 0.184, -0.132],
        [side * (0.035 + j * 0.014), 0.184, -0.239],
        0.0013,
      );
  }
  panel(s, paint, [
    [-0.099, 0.09, -0.245],
    [0.099, 0.09, -0.245],
    [0.095, 0.175, -0.245],
    [-0.095, 0.175, -0.245],
  ]);
  panel(s, glass, [
    [-0.084, 0.136, -0.247],
    [0.084, 0.136, -0.247],
    [0.082, 0.168, -0.247],
    [-0.082, 0.168, -0.247],
  ]);
  const spare = new T.Group();
  spare.position.set(0.028, 0.121, -0.259);
  s.add(spare);
  const rubber = metal('#242824', 0.98, 0);
  mesh(new T.TorusGeometry(0.04, 0.013, 14, 48), rubber, spare);
  mesh(new T.CylinderGeometry(0.028, 0.028, 0.016, 32), steel, spare).rotation.x = Math.PI / 2;
  for (let j = 0; j < 36; j++) {
    const a = (j * Math.PI) / 18;
    const lug = box(
      spare,
      rubber,
      [0.009, 0.007, 0.022],
      [Math.cos(a) * 0.052, Math.sin(a) * 0.052, 0],
    );
    lug.rotation.z = a - Math.PI / 2;
  }
  for (let j = 0; j < 6; j++) {
    const a = (j * Math.PI) / 3;
    rod(
      spare,
      black,
      [Math.cos(a) * 0.009, Math.sin(a) * 0.009, -0.013],
      [Math.cos(a) * 0.026, Math.sin(a) * 0.026, -0.013],
      0.002,
    );
  }
  for (const x of [-0.072, 0.072]) rod(s, black, [x, 0.055, -0.248], [x, 0.055, -0.273], 0.003);
  rod(s, black, [-0.105, 0.055, -0.275], [0.105, 0.055, -0.275], 0.004);
}
/** A narrow one-seat cockpit and rear service hoop are independent geometry on the competition platform. */
function buildBuggy(
  s: T.Group,
  paint: T.MeshPhysicalMaterial,
  black: T.Material,
  steel: T.Material,
  carbon: T.Material,
) {
  // Replace the shared two-seat shell with this dedicated buggy cage.
  s.clear();
  for (const side of [-1, 1]) {
    tube(
      s,
      black,
      [
        [side * 0.075, 0.02, -0.22],
        [side * 0.07, 0.07, -0.16],
        [side * 0.042, 0.13, -0.06],
        [side * 0.041, 0.13, 0.025],
        [side * 0.068, 0.047, 0.16],
        [side * 0.06, 0.025, 0.23],
      ],
      0.0034,
    );
    rod(s, black, [side * 0.075, 0.02, -0.22], [side * 0.069, 0.045, 0.17], 0.003);
    rod(s, black, [side * 0.073, 0.04, -0.18], [side * 0.042, 0.13, -0.06], 0.0028);
    panel(s, paint, [
      [side * 0.068, 0.03, -0.12],
      [side * 0.055, 0.075, -0.08],
      [side * 0.05, 0.077, 0.028],
      [side * 0.068, 0.037, 0.09],
    ]);
    for (const z of [-0.09, -0.04, 0.01])
      mesh(new T.SphereGeometry(0.0017, 6, 5), steel, s, [side * 0.066, 0.047, z]);
  }
  for (const z of [-0.06, 0.025]) rod(s, black, [-0.042, 0.13, z], [0.042, 0.13, z], 0.0035);
  panel(s, carbon, [
    [-0.044, 0.134, -0.065],
    [0.044, 0.134, -0.065],
    [0.043, 0.134, 0.031],
    [-0.043, 0.134, 0.031],
  ]);
  panel(s, paint, [
    [-0.065, 0.049, 0.1],
    [0.065, 0.049, 0.1],
    [0.047, 0.055, 0.22],
    [-0.047, 0.055, 0.22],
  ]);
  mesh(new RoundedBoxGeometry(0.039, 0.012, 0.044, 3, 0.003), black, s, [0, 0.045, -0.015]);
  mesh(new RoundedBoxGeometry(0.041, 0.045, 0.01, 3, 0.003), black, s, [0, 0.072, -0.04]);
  for (const x of [-0.009, 0.009])
    box(s, metal('#b25e37', 0.8, 0), [0.004, 0.037, 0.003], [x, 0.074, -0.033]);
  rod(s, black, [-0.071, 0.055, -0.17], [0.071, 0.055, -0.17], 0.003);
  rod(s, black, [-0.071, 0.055, -0.17], [0.04, 0.13, -0.06], 0.0027);
  rod(s, black, [0.071, 0.055, -0.17], [-0.04, 0.13, -0.06], 0.0027);
  box(s, carbon, [0.105, 0.004, 0.061], [0, 0.03, -0.184]);
  for (let j = 0; j < 5; j++)
    rod(s, steel, [-0.045, 0.034, -0.21 + j * 0.01], [0.045, 0.034, -0.21 + j * 0.01], 0.0013);
}
