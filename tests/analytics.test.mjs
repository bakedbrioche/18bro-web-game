import test from 'node:test';
import assert from 'node:assert/strict';
import {ANALYTICS_EVENTS,createAnalytics,normalizeAnalyticsConfig} from '../dist/analytics.mjs';

test('analytics config accepts only public numeric vendor IDs',()=>{
 assert.deepEqual(normalizeAnalyticsConfig({yandexTagId:'12345',metaPixelId:'987654',build:'release-1',language:'yue-Hant'}),{
  yandexTagId:'12345',metaPixelId:'987654',build:'release-1',language:'yue-Hant'
 });
 assert.deepEqual(normalizeAnalyticsConfig({yandexTagId:'TBU',metaPixelId:'<script>',build:4}),{
  yandexTagId:null,metaPixelId:null,build:'dev',language:'en'
 });
 assert.ok(ANALYTICS_EVENTS.includes('run_start'));
});

test('analytics never loads or emits before explicit consent',async()=>{
 const target={location:{href:'https://18bro.fun/'}};const loads=[];
 const analytics=createAnalytics({target,config:{yandexTagId:'12345',metaPixelId:'98765'},loadScript:async src=>loads.push(src)});
 assert.equal(analytics.track('run_start',{score:5}),false);
 await analytics.setConsent('denied');
 assert.equal(loads.length,0);assert.equal(target.ym,undefined);assert.equal(target.fbq,undefined);
});

test('granted consent initializes each configured vendor once and maps safe events',async()=>{
 const target={location:{href:'https://18bro.fun/'}};const loads=[];
 const analytics=createAnalytics({target,config:{yandexTagId:'12345',metaPixelId:'98765',build:'test',language:'zh-Hant'},loadScript:async(src,id)=>loads.push([src,id])});
 await analytics.setConsent('granted');await analytics.setConsent('granted');
 assert.equal(loads.length,2);assert.equal(analytics.status().state,'ready');
 assert.equal(analytics.track('run_end',{distance_band:'500-999',unsafe_object:{secret:true},oversized:'x'.repeat(200)}),true);
 const yandexCalls=target.ym.a;const metaCalls=target.fbq.queue;
 assert.equal(yandexCalls.filter(call=>call[1]==='init').length,1);
 assert.equal(yandexCalls.at(-1)[1],'reachGoal');assert.equal(yandexCalls.at(-1)[2],'run_end');
 assert.equal(yandexCalls.at(-1)[3].unsafe_object,undefined);assert.equal(yandexCalls.at(-1)[3].oversized.length,80);
 assert.deepEqual(metaCalls.at(-1).slice(0,2),['trackCustom','run_end']);
});

test('unknown analytics events are rejected while unconfigured analytics stays offline',async()=>{
 const analytics=createAnalytics({config:{},target:{},loadScript:async()=>{throw new Error('must not load');}});
 await analytics.setConsent('granted');
 assert.equal(analytics.status().configured,false);assert.equal(analytics.status().state,'idle');
 assert.throws(()=>analytics.track('player_email',{email:'nope'}),/Unknown analytics event/);
});
