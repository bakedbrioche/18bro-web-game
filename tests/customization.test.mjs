import test from 'node:test';
import assert from 'node:assert/strict';
import {FURS,HATS,normalizeCustom,equipCustom} from '../dist/customization.mjs';
test('fur and hats buy independently, charge once and survive save reload',()=>{
 const save=normalizeCustom({totalCoins:800});
 assert.equal(equipCustom(save,'fur','ginger').ok,true);
 assert.equal(equipCustom(save,'hat','sombrero').ok,true);
 assert.equal(save.totalCoins,400);assert.equal(save.fur,'ginger');assert.equal(save.hat,'sombrero');
 equipCustom(save,'hat','none');equipCustom(save,'hat','sombrero');assert.equal(save.totalCoins,400);
 assert.deepEqual(normalizeCustom(JSON.parse(JSON.stringify(save))),save);
});
test('unaffordable and unknown customization cannot spend chips or equip locked items',()=>{
 const save=normalizeCustom({totalCoins:20}),before=JSON.stringify(save);
 assert.deepEqual(equipCustom(save,'hat','sombrero'),{ok:false,missing:230});
 assert.equal(equipCustom(save,'fur','invalid').ok,false);assert.equal(equipCustom(save,'invalid','black').ok,false);
 assert.equal(JSON.stringify(save),before);assert.equal(FURS[0].price,0);assert.equal(HATS[0].price,0);
});
test('legacy purchases migrate without losing chips or allowing invalid equipped items',()=>{
 const save=normalizeCustom({totalCoins:321,unlockedSkins:['business','gold','police','astronaut','ceo'],equippedSkin:'gold'});
 assert.equal(save.totalCoins,321);assert.equal(save.fur,'gold');
 for(const id of ['beanie','bucket','crown'])assert.ok(save.ownedHats.includes(id));
 assert.ok(save.ownedFurs.includes('silver'));
 assert.equal(normalizeCustom({fur:'pink',hat:'sombrero'}).hat,'cap');
});
