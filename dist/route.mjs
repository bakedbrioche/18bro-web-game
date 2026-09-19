/** Continuous route coordinates. Distances share the opening's existing world axis. */
export const ROUTE = Object.freeze({start:240,intersectionStart:3000,intersectionEnd:3300,neonStart:3300,roadblock:5440,end:5560});
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const ramp=(s,a,b)=>smooth((s-a)/(b-a));
const mix=(a,b,t)=>a+(b-a)*t;

export const BRANCHES = Object.freeze([
 {id:'noodle-kitchen',start:860,end:1010,side:-1,label:'NOODLES',kind:'restaurant',offset:-8},
 {id:'electronics',start:1740,end:1890,side:1,label:'REPAIRS',kind:'shop',offset:8},
 {id:'corner-shop',start:2980,end:3270,side:1,label:'TEA HOUSE',kind:'restaurant',offset:24},
 {id:'crossing',start:3000,end:3270,side:-1,label:'CROSSING',kind:'crossing',offset:-10},
 {id:'van-cover',start:3090,end:3230,side:1,label:'DELIVERIES',kind:'cover',offset:5},
 {id:'restaurant',start:3720,end:3890,side:-1,label:'KITCHEN',kind:'restaurant',offset:-8},
 {id:'karaoke',start:4250,end:4480,side:1,label:'KARAOKE',kind:'stairs',offset:9,height:3},
 {id:'arcade-alley',start:4780,end:4930,side:-1,label:'GAMES',kind:'arcade',offset:-8},
].map(b=>Object.freeze({...b,entryLength:28,exitLength:30})));

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

export function getRouteProfile(s=0){
 const entered=ramp(s,ROUTE.start,ROUTE.start+160);
 const junction=ramp(s,2920,3080)*(1-ramp(s,3220,3360));
 const night=ramp(s,3300,4140);
 const arcade=ramp(s,5480,ROUTE.end);
 const id=s<ROUTE.start?'market':s<ROUTE.intersectionStart?'commercial':s<ROUTE.intersectionEnd?'intersection':s<ROUTE.end?'neon':'arcade';
 const range=id==='commercial'?[240,3000]:id==='intersection'?[3000,3300]:id==='neon'?[3300,5560]:id==='arcade'?[5560,5560]:[0,240];
 return {id,progress:range[1]===range[0]?1:clamp((s-range[0])/(range[1]-range[0])),night,arcade,
  market:1-ramp(s,240,540),roadHalfWidth:mix(mix(4.5,4.4,entered),18,junction),buildingEdge:mix(mix(7.2,6.8,entered),23,junction),
  trafficIntensity:mix(.32,.84,ramp(s,400,2800)),siren:ramp(s,2460,2940)*(.36+night*.64),curve:routeCenter(s),
  fogNear:mix(27,19,entered),fogFar:mix(106,82,entered)-night*8,speedLimit:mix(26,15,entered),
  offsetX:10*arcade,offsetY:0,branch:null,branchProgress:0,waiting:false};
}

/** Signals have clearance intervals. Cross traffic clears before the pedestrian green. */
export function getTrafficPhase(time=0){
 const duration=28,cycle=Math.floor(Math.max(0,time)/duration),t=((time%duration)+duration)%duration;
 const phases=[
  {end:8,id:'road-green',road:'green',cross:'red',pedestrian:'red'},
  {end:10,id:'road-amber',road:'amber',cross:'red',pedestrian:'red'},
  {end:11,id:'all-red',road:'red',cross:'red',pedestrian:'red'},
  {end:17,id:'cross-green',road:'red',cross:'green',pedestrian:'red'},
  {end:20,id:'cross-clearance',road:'red',cross:'amber',pedestrian:'red'},
  {end:22,id:'all-red',road:'red',cross:'red',pedestrian:'red'},
  {end:28,id:'pedestrian-green',road:'red',cross:'red',pedestrian:'green'},
 ];
 const p=phases.find(v=>t<v.end)||phases.at(-1);
 return {...p,remaining:p.end-t,cycle,time:t};
}

export const CROSS_STREETS=Object.freeze([{distance:3138,direction:1},{distance:3162,direction:-1}]);
export const PEDESTRIAN_STOP=3128;
