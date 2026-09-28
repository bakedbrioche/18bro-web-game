export const LOADING_MESSAGES=Object.freeze([
 'Getting chips ready…',
 'Cleaning the hat…',
 'Polishing claws…',
 'Checking every snack aisle…',
 'Warming up tiny paws…'
]);

export function loadingLetters(message=''){
 return Array.from(String(message),(character,index)=>({character,index}));
}

export function renderLoadingMessage(node,message){
 if(!node)return;
 const documentRef=node.ownerDocument;
 node.setAttribute('aria-label',message);
 node.replaceChildren(...loadingLetters(message).map(({character,index})=>{
  const letter=documentRef.createElement('span');
  letter.className=character===' '?'boot-loading-space':'';
  letter.style.setProperty('--letter-index',index);
  letter.setAttribute('aria-hidden','true');
  letter.textContent=character===' '?String.fromCharCode(160):character;
  return letter;
 }));
}

export function createLoadingScreen({
 documentRef=globalThis.document,
 globalRef=globalThis,
 messages=LOADING_MESSAGES,
 intervalMs=1800,
 minimumVisibleMs=650,
 now=()=>Date.now()
}={}){
 const root=documentRef?.getElementById?.('boot-loading');
 if(!root)return {finish:readiness=>Promise.resolve(readiness),cancel(){}};
 if(globalRef.__18BRO_BOOT_FAILED__){root.hidden=true;return {finish:readiness=>Promise.resolve(readiness),cancel(){}};}
 const copy=root.querySelector?.('.boot-loading-copy');
 const image=root.querySelector?.('.boot-loading-icon');
 const startedAt=now();
 let messageIndex=0,finished=false,cancelled=false;
 if(image){const embedded=globalRef.__18BRO_UI_IMAGES__?.['loading-icon'];if(embedded)image.src=embedded;}
 renderLoadingMessage(copy,messages[messageIndex]||'Loading…');
 root.hidden=false;root.classList.add('is-visible');documentRef.body?.classList.add('boot-loading-active');
 const rotate=globalRef.setInterval?.(()=>{
  messageIndex=(messageIndex+1)%messages.length;
  copy?.classList.remove('is-changing');
  renderLoadingMessage(copy,messages[messageIndex]);
  void copy?.offsetWidth;
  copy?.classList.add('is-changing');
 },intervalMs);
 const wait=milliseconds=>new Promise(resolve=>(globalRef.setTimeout||setTimeout)(resolve,milliseconds));
 async function finish(readiness){
  if(finished)return;
  finished=true;
  try{await readiness;}catch{}
  if(cancelled)return;
  await wait(Math.max(0,minimumVisibleMs-(now()-startedAt)));
  if(rotate!==undefined)globalRef.clearInterval?.(rotate);
  root.classList.add('is-leaving');documentRef.body?.classList.remove('boot-loading-active');
  await wait(480);root.hidden=true;root.classList.remove('is-visible','is-leaving');
 }
 function cancel(){cancelled=true;finished=true;if(rotate!==undefined)globalRef.clearInterval?.(rotate);root.hidden=true;root.classList.remove('is-visible','is-leaving');documentRef.body?.classList.remove('boot-loading-active');}
 return {root,finish,cancel};
}

if(globalThis.document){
 globalThis.__18BRO_BOOT_SCREEN__=createLoadingScreen();
 if(globalThis.__18BRO_ASSETS_READY__)globalThis.__18BRO_BOOT_SCREEN__.finish(globalThis.__18BRO_ASSETS_READY__);
}
