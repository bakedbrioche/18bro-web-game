// Pure timelines in street coordinates, shared with the simulation and tests.
export const INTRO_DURATION=5.1;
export const CAPTURE_DURATION=4;
export const STORE=Object.freeze({x:-7.2,z:-5,width:15,depth:10.6});
export const smooth=v=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v);};
const lerp=(a,b,t)=>a+(b-a)*t;
function hermite(a,b,va,vb,t,duration){
  t=Math.max(0,Math.min(1,t));
  return (2*t**3-3*t*t+1)*a+(t**3-2*t*t+t)*va*duration+(-2*t**3+3*t*t)*b+(t**3-t*t)*vb*duration;
}
function route(t){
  if(t<2.15)return {x:-11.6,z:-3.4+.3*smooth((t-1.02)/.38)};
  if(t<3.15){const u=t-2.15;return {x:hermite(-11.6,-6.6,0,7,u,1),z:hermite(-3.1,-5,0,-.8,u,1)};}
  if(t<4.25){const u=(t-3.15)/1.1;return {x:hermite(-6.6,0,7,0,u,1.1),z:hermite(-5,-10,-.8,-10.4,u,1.1)};}
  return {x:0,z:-10-(t-4.25)*10.4};
}
export function introPose(seconds=0){
  const p=route(seconds),next=route(seconds+.001),reach=smooth(seconds/.95),retract=smooth((seconds-1.04)/.36);
  const distance=seconds<2.15?0:seconds<4.25?hermite(0,10,0,10.4,(seconds-2.15)/2.1,2.1):10+(seconds-4.25)*10.4;
  const heading=Math.atan2(Math.max(0,next.x-p.x),next.z-p.z);
  const turn=smooth((seconds-1.91)/.24);
  return {x:p.x,z:p.z+distance,distance,
    yaw:seconds<1.4?lerp(Math.PI,.55,smooth((seconds-1.04)/.36))-(1-reach)*(Math.PI-.55):seconds<2.15?lerp(.55,2.120356340321276,turn):heading,
    arm:lerp(-.1,-1.32,reach)+retract*.9,
    packetHeld:seconds>=.95,dance:seconds>=1.45&&seconds<2.05?Math.sin((seconds-1.45)/.6*Math.PI*4):0,
    turnStep:seconds<.95?Math.sin(reach*Math.PI):seconds<1.4?Math.sin(retract*Math.PI):0,
    burst:smooth((seconds-2.83)/.16)*(1-smooth((seconds-3.18)/.38)),
    running:seconds>=2.15,doors:smooth((seconds-2.91)/.12),
    exterior:smooth((seconds-1.8)/1.4),chase:smooth((seconds-3.15)/1.95),
    officers:[-1,1].map((side,i)=>({x:lerp(-4.3+i*.7,side*.88,smooth((seconds-3.15)/1.1)),z:lerp(3.5+i*.6,2.825+i*.26,smooth((seconds-3.15)/1.1))})),
    clerk:smooth((seconds-1.1)/.4),
  };
}
export function capturePose(progress){
  return {phase:progress,fall:smooth(progress/.15),gather:smooth(progress/.35),lift:smooth((progress-.36)/.16),turn:smooth((progress-.51)/.16),carry:smooth((progress-.67)/.33)};
}

// Ease into the crouch and rise before the action finishes, without pose snapping.
export function slidePose(remaining,duration=.72){
  if(remaining<=0)return 0;
  return smooth((duration-remaining)/.14)*smooth(remaining/.18);
}
