// Fixed flow spacing prevents overtaking, including across the recycled street seam.
export const CROWD_COUNT=72;
export const SIDEWALK=Object.freeze({center:4.695,sway:.002,pedestrianRadius:.52,vendorEdge:5.22,lampEdge:4.17});
export function sidewalkPose(index,distance,time){
  const side=index%2?1:-1,slot=Math.floor(index/2),spacing=210/(CROWD_COUNT/2);
  const wave=Math.sin(time*.45+slot*.7)*.28,speed=.92+Math.cos(time*.45+slot*.7)*.126;
  const travel=distance+slot*spacing+side*(.92*time+wave)+(side>0?spacing*.5:0);
  const phase=time*4.9+index*1.37;
  return {x:side*(SIDEWALK.center+Math.sin(time*.43+index)*SIDEWALK.sway),
    z:((travel%210)+210)%210-185,yaw:side>0?0:Math.PI,phase,speed,bob:(1-Math.cos(phase*2))*.013};
}
