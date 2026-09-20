/** Continuous route coordinates. Distances share the opening's existing world axis. */
export const ROUTE = Object.freeze({start:240,cycleLength:1080,intersectionStart:660,intersectionEnd:900,neonStart:900,end:Infinity});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const ramp=(s,a,b)=>smooth((s-a)/(b-a));
const mix=(a,b,t)=>a+(b-a)*t;

const orders=[['commercial','intersection','neon'],['commercial','neon','intersection'],['intersection','commercial','neon'],['intersection','neon','commercial'],['neon','commercial','intersection'],['neon','intersection','commercial']];
const lengths={commercial:420,intersection:240,neon:420};
function hash(n,seed){n=Math.imul((n^seed)>>>0,0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;}
function order(cycle,seed){return orders[cycle===0?0:hash(cycle,seed)%orders.length];}
export function routeSection(s,seed=18){
 if(s<ROUTE.start)return {id:'market',start:0,end:ROUTE.start,index:-1,previous:'market',cycle:0};
 const cycle=Math.floor((s-ROUTE.start)/ROUTE.cycleLength),sequence=order(cycle,seed);
 let start=ROUTE.start+cycle*ROUTE.cycleLength;
 for(let i=0;i<3;i++){const id=sequence[i],end=start+lengths[id];if(s<end||i===2)return {id,start,end,index:cycle*3+i,previous:i?sequence[i-1]:cycle?order(cycle-1,seed)[2]:'market',cycle};start=end;}
}
// Dodge positions remain on the open street; no automatic hallway detours.
export const BRANCHES = Object.freeze([]);

export function branchOffset(branch,s){
 const b=typeof branch==='string'?BRANCHES.find(v=>v.id===branch):branch;
 if(!b||s<=b.start||s>=b.end)return {x:0,y:0};
 const blend=ramp(s,b.start,b.start+b.entryLength)*(1-ramp(s,b.end-b.exitLength,b.end));
 const y=b.height?ramp(s,b.start+34,b.start+67)*(1-ramp(s,b.end-70,b.end-34))*b.height:0;
 return {x:b.offset*blend,y};
}

/** Broad, continuous curves obscure sightlines without rotating the controls. */
export function routeCenter(s){
 const start=ramp(s,ROUTE.start,ROUTE.start+100);
 return start*(Math.sin((s-ROUTE.start)/175)*3.4+Math.sin((s-ROUTE.start)/430)*2.2);
}

export function getRouteProfile(s=0,seed=18){
 const section=routeSection(s,seed),entered=ramp(s,240,380),junction=section.id==='intersection'?ramp(s,section.start,section.start+70)*(1-ramp(s,section.end-70,section.end)):0;
 const darkness={market:0,commercial:0,intersection:.24,neon:1};
 const night=mix(darkness[section.previous],darkness[section.id],ramp(s,section.start,section.start+100));
 return {id:section.id,seed,sectionStart:section.start,sectionEnd:section.end,sectionIndex:section.index,cycle:section.cycle,
  junctionCenter:section.id==='intersection'?(section.start+section.end)/2:null,
  progress:clamp((s-section.start)/(section.end-section.start)),night,arcade:0,
  market:1-ramp(s,240,380),roadHalfWidth:mix(mix(4.2,4.4,entered),18,junction),buildingEdge:mix(mix(7.2,6.8,entered),23,junction),
  trafficIntensity:mix(.32,.84,ramp(s,240,900)),siren:ramp(s,420,720)*(.36+night*.64),curve:routeCenter(s),
  fogNear:mix(27,19,entered),fogFar:mix(106,82,entered)-night*8,speedLimit:mix(26,15,entered),
  offsetX:0,offsetY:0,branch:null,branchProgress:0,waiting:false};
}

/** Signals have clearance intervals. Cross traffic clears before the pedestrian green. */
export function getTrafficPhase(time=0){
 const duration=56,cycle=Math.floor(Math.max(0,time)/duration),t=((time%duration)+duration)%duration;
 const phases=[
  {end:8,id:'road-green',road:'green',cross:'red',pedestrian:'red'},
  {end:10,id:'road-amber',road:'amber',cross:'red',pedestrian:'red'},
  {end:11,id:'all-red',road:'red',cross:'red',pedestrian:'red'},
  {end:17,id:'cross-green',road:'red',cross:'green',pedestrian:'red'},
  {end:20,id:'cross-clearance',road:'red',cross:'amber',pedestrian:'red'},
  {end:22,id:'all-red',road:'red',cross:'red',pedestrian:'red'},
  {end:54,id:'pedestrian-green',road:'red',cross:'red',pedestrian:'green'},
  {end:56,id:'all-red',road:'red',cross:'red',pedestrian:'red'},
 ];
 const p=phases.find(v=>t<v.end)||phases.at(-1);
 return {...p,remaining:p.end-t,cycle,time:t};
}

export function crossStreetsAt(s,seed=18){const center=getRouteProfile(s,seed).junctionCenter;return center===null?[]:[{distance:center-12,direction:1},{distance:center+12,direction:-1}];}
