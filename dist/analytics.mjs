export const ANALYTICS_EVENTS=Object.freeze(['page_view','run_start','run_end','setting_change','mission_complete','share_click']);
const EVENT_SET=new Set(ANALYTICS_EVENTS);
const CONSENT_SET=new Set(['unknown','granted','denied']);
const YANDEX_SRC='https://mc.yandex.ru/metrika/tag.js';
const META_SRC='https://connect.facebook.net/en_US/fbevents.js';

const cleanId=value=>/^\d{4,32}$/.test(String(value??'').trim())?String(value).trim():null;
const cleanText=(value,max=80)=>typeof value==='string'?value.slice(0,max):'';

export function normalizeAnalyticsConfig(value={}){
 const input=value&&typeof value==='object'?value:{};
 return Object.freeze({
  yandexTagId:cleanId(input.yandexTagId),
  metaPixelId:cleanId(input.metaPixelId),
  build:cleanText(input.build,40)||'dev',
  language:cleanText(input.language,16)||'en'
 });
}

function safeProperties(value){
 const result={};
 if(!value||typeof value!=='object')return result;
 for(const [key,raw] of Object.entries(value).slice(0,16)){
  if(!/^[a-z][a-z0-9_]{0,39}$/i.test(key))continue;
  if(typeof raw==='boolean'||typeof raw==='number'&&Number.isFinite(raw))result[key]=raw;
  else if(typeof raw==='string')result[key]=raw.slice(0,80);
 }
 return result;
}

function browserScriptLoader(document,src,id){
 if(!document?.createElement)return Promise.reject(new Error('Analytics scripts require a browser document.'));
 const existing=document.getElementById?.(id);
 if(existing)return existing.dataset?.loaded==='true'?Promise.resolve():new Promise((resolve,reject)=>{
  existing.addEventListener('load',resolve,{once:true});
  existing.addEventListener('error',()=>reject(new Error(`Failed to load ${src}`)),{once:true});
 });
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.id=id;script.async=true;script.src=src;
  script.addEventListener('load',()=>{script.dataset.loaded='true';resolve();},{once:true});
  script.addEventListener('error',()=>reject(new Error(`Failed to load ${src}`)),{once:true});
  (document.head||document.documentElement).append(script);
 });
}

function installYandexQueue(target){
 if(typeof target.ym==='function')return;
 const ym=(...args)=>(ym.a=ym.a||[]).push(args);
 ym.l=Date.now();target.ym=ym;
}

function installMetaQueue(target){
 if(typeof target.fbq==='function')return;
 const fbq=function(...args){fbq.callMethod?fbq.callMethod(...args):fbq.queue.push(args);};
 fbq.push=fbq;fbq.loaded=true;fbq.version='2.0';fbq.queue=[];
 target.fbq=fbq;target._fbq=fbq;
}

export function createAnalytics({config={},target=globalThis,document=target?.document,loadScript=(src,id)=>browserScriptLoader(document,src,id)}={}){
 const normalized=normalizeAnalyticsConfig(config);
 let consent='unknown',state='idle',startPromise=null;
 const configured=Boolean(normalized.yandexTagId||normalized.metaPixelId);

 async function start(){
  if(consent!=='granted'||!configured)return status();
  if(startPromise)return startPromise;
  state='loading';
  startPromise=(async()=>{
   const jobs=[];
   if(normalized.yandexTagId){
    installYandexQueue(target);
    target.ym(Number(normalized.yandexTagId),'init',{defer:true,clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:false,sendTitle:false});
    jobs.push(loadScript(YANDEX_SRC,'18bro-yandex-metrica'));
   }
   if(normalized.metaPixelId){
    installMetaQueue(target);
    target.fbq('init',normalized.metaPixelId);
    jobs.push(loadScript(META_SRC,'18bro-meta-pixel'));
   }
   const results=await Promise.allSettled(jobs);
   state=results.some(result=>result.status==='rejected')?'degraded':'ready';
   if(normalized.yandexTagId)target.ym(Number(normalized.yandexTagId),'hit',target.location?.href||'/',{title:'18Bro: Run for the Chips'});
   if(normalized.metaPixelId)target.fbq('track','PageView');
   return status();
  })();
  return startPromise;
 }

 async function setConsent(value){
  if(!CONSENT_SET.has(value))throw new TypeError('Analytics consent must be unknown, granted, or denied.');
  consent=value;
  if(value==='granted')await start();
  return status();
 }

 function track(event,properties={}){
  if(!EVENT_SET.has(event))throw new TypeError(`Unknown analytics event: ${event}`);
  if(consent!=='granted'||!configured||!['loading','ready','degraded'].includes(state))return false;
  const payload={...safeProperties(properties),language:normalized.language,build:normalized.build};
  if(normalized.yandexTagId&&typeof target.ym==='function')target.ym(Number(normalized.yandexTagId),'reachGoal',event,payload);
  if(normalized.metaPixelId&&typeof target.fbq==='function')target.fbq('trackCustom',event,payload);
  return true;
 }

 function status(){return Object.freeze({consent,state,configured,yandex:Boolean(normalized.yandexTagId),meta:Boolean(normalized.metaPixelId)});}
 return Object.freeze({config:normalized,setConsent,track,status});
}

export function createReleaseAnalytics(target=globalThis){
 return createAnalytics({target,document:target?.document,config:target?.__18BRO_ANALYTICS__});
}
