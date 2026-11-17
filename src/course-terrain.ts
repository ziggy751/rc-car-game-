import * as T from 'three';
import { courses } from './courses';
import { mesh, metal, rod, label } from './materials';
export function courseDistance(x: number, z: number) {
  let best = Infinity;
  for (const course of courses) {
    const points: [[number, number], ...[number, number][]] = [
      [course.x, course.z],
      ...course.gates,
    ];
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1],
        b = points[i],
        dx = b[0] - a[0],
        dz = b[1] - a[1],
        t = T.MathUtils.clamp(((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz), 0, 1);
      best = Math.min(best, Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t));
    }
  }
  return best;
}
/** Metres: obstacle crests stay proportionate to the 118 mm baseline tyre. */
export const courseRocks: number[][] = [
  [-0.12, 0.93, 0.1, 0.017, 0.1],
  [0.2, 1.72, 0.12, 0.024, 0.11],
  [-0.05, 2.5, 0.12, 0.02, 0.14],
  [0.46, 4.5, 0.15, 0.035, 0.14],
  [0.23, 5.06, 0.13, 0.042, 0.15],
  [-2.08, 5.9, 0.2, 0.053, 0.22],
  [-2.22, 6.58, 0.23, 0.065, 0.25],
  [-1.8, 7.32, 0.23, 0.062, 0.25],
  [-5.05, 1.95, 0.22, 0.078, 0.22],
  [-5.1, 2.78, 0.23, 0.088, 0.28],
  [-4.95, 3.58, 0.23, 0.093, 0.28],
];
export function buildCourseMarkers(group: T.Group, height: (x: number, z: number) => number) {
  for (const course of courses) {
    course.gates.forEach(([x, z], index) => {
      const previous = index ? course.gates[index - 1] : [course.x, course.z],
        angle = Math.atan2(x - previous[0], z - previous[1]);
      for (const side of [-1, 1]) {
        const px = x + ((Math.cos(angle) * course.gateWidth) / 2) * side,
          pz = z - ((Math.sin(angle) * course.gateWidth) / 2) * side,
          y = height(px, pz);
        const m = metal(course.color, 0.8, 0);
        mesh(new T.ConeGeometry(0.014, 0.035, 14), m, group, [px, y + 0.018, pz]);
        rod(group, m, [px, y + 0.03, pz], [px, y + 0.102, pz], 0.002);
        const flag = mesh(
          new T.PlaneGeometry(0.043, 0.025),
          label(String(index + 1), '#1b241f', course.color),
          group,
          [px, y + 0.087, pz],
        );
        flag.rotation.y = angle;
      }
    });
  }
}
