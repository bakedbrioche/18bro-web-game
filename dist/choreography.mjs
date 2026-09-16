// Pure timeline shared by the renderer and regression tests. Coordinates are street space.
export const INTRO_DURATION = 7.2;
export const CAPTURE_DURATION = 4.6;
export const STORE = Object.freeze({ x: -7.2, z: -3, width: 10.6, depth: 8.2 });
export const smooth = (v) => { v = Math.max(0, Math.min(1, v)); return v * v * (3 - 2 * v); };
const lerp = (a, b, t) => a + (b - a) * t;
export function introPose(seconds = 0) {
  const reach = smooth(seconds / .95);
  const retract = smooth((seconds - 1.04) / .36);
  const dance = seconds >= 1.45 && seconds < 2.25 ? Math.sin((seconds - 1.45) / .8 * Math.PI * 4) : 0;
  const exit = smooth((seconds - 2.35) / 2.15);
  const join = smooth((seconds - 3.55) / 2.05);
  return {
    x: lerp(-10.35, 0, exit), z: lerp(-1.6, 0, exit) - Math.sin(Math.PI * exit) * 2.14,
    yaw: seconds < 1.35 ? lerp(.66, -Math.PI / 2, reach) : seconds < 2.35 ? lerp(-Math.PI / 2, .55, smooth((seconds - 1.35) / .3)) : lerp(.55, Math.PI / 2, smooth((seconds - 2.35) / .25)) + Math.PI / 2 * smooth((seconds - 3.6) / .9),
    arm: lerp(-.1, -1.32, reach) + retract * .9,
    packetHeld: seconds >= .95, dance, running: seconds >= 2.35,
    doors: smooth((seconds - 3.03) / .18),
    exterior: smooth((seconds - 1.65) / 1.35), chase: smooth((seconds - 4.1) / 3.1),
    officers: [-1, 1].map((side, i) => ({ x: lerp(-4.3 + i * .7, side * .88, join), z: lerp(3.5 + i * .6, 1.8 + i * .25, join) })),
  };
}
export function capturePose(progress) {
  return { fall: smooth(progress / .19), gather: smooth((progress - .12) / .23),
    lift: smooth((progress - .36) / .16), carry: smooth((progress - .57) / .43) };
}
