// A clear promenade between curb lamps (outer edge 4.17) and vendor counters (inner edge 5.2).
export const SIDEWALK = Object.freeze({ center: 4.65, sway: .075, pedestrianRadius: .34, vendorEdge: 5.2, lampEdge: 4.17 });
export function sidewalkPose(index, distance, time) {
  const side = index % 2 ? 1 : -1;
  const speed = .76 + (index % 5) * .065;
  const direction = side;
  const phase = time * speed * 5.2 + index * 1.37;
  const travel = distance + index * 6.15 + direction * speed * time;
  return { x: side * (SIDEWALK.center + Math.sin(time * .43 + index) * SIDEWALK.sway),
    z: ((travel + 100000) % 210) - 185, yaw: direction > 0 ? 0 : Math.PI,
    phase, speed, bob: (1 - Math.cos(phase * 2)) * .013 };
}
