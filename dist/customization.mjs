export const FURS=Object.freeze([
 {id:'black',name:'MIDNIGHT',color:'#12151b',price:0},
 {id:'cream',name:'CREAM',color:'#e4d3ad',price:100},
 {id:'ginger',name:'GINGER',color:'#ba6f36',price:150},
 {id:'silver',name:'SILVER',color:'#929da3',price:200},
 {id:'pink',name:'STRAWBERRY',color:'#cf7e9f',price:300},
 {id:'gold',name:'GOLD',color:'#d4ad32',price:600},
]);
export const HATS=Object.freeze([
 {id:'cap',name:'CORNER SHOP CAP',price:0},
 {id:'none',name:'NO HAT',price:0},
 {id:'beanie',name:'BEANIE',price:100},
 {id:'sombrero',name:'SOMBRERO',price:250},
 {id:'bucket',name:'BUCKET HAT',price:175},
 {id:'crown',name:'SNACK KING',price:500},
]);
export function normalizeCustom(save){
 const old=save.unlockedSkins||[];
 const valid=(xs,defs,base)=>[...new Set([...base,...(Array.isArray(xs)?xs:[]).filter(id=>defs.some(d=>d.id===id))])];
 save.ownedFurs=valid(save.ownedFurs,FURS,['black',...(old.includes('gold')?['gold']:[]),...(old.includes('business')?['silver']:[])]);
 save.ownedHats=valid(save.ownedHats,HATS,['cap','none',...(old.includes('ceo')?['crown']:[]),...(old.includes('astronaut')?['bucket']:[]),...(old.includes('police')?['beanie']:[])]);
 save.fur=save.ownedFurs.includes(save.fur)?save.fur:save.equippedSkin==='gold'?'gold':save.equippedSkin==='business'?'silver':'black';
 if(!save.ownedFurs.includes(save.fur))save.fur='black';
 save.hat=save.ownedHats.includes(save.hat)?save.hat:'cap';
 return save;
}
export function equipCustom(save,kind,id){
 const defs=kind==='fur'?FURS:kind==='hat'?HATS:[],item=defs.find(x=>x.id===id);
 if(!item)return {ok:false,reason:'unknown'};
 normalizeCustom(save);const owned=kind==='fur'?save.ownedFurs:save.ownedHats;
 if(!owned.includes(id)){
  if(save.totalCoins<item.price)return {ok:false,missing:item.price-save.totalCoins};
  save.totalCoins-=item.price;owned.push(id);
 }
 save[kind]=id;return {ok:true};
}
