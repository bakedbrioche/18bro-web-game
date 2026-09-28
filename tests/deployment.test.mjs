import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=(name)=>fs.readFileSync(new URL(`../${name}`,import.meta.url),'utf8');

test('container image contains only the verified static game and health configuration',()=>{
 const dockerfile=read('Dockerfile'),ignore=read('.dockerignore'),nginx=read('deploy/nginx.conf');
 assert.match(dockerfile,/^FROM nginx:stable-alpine/m);
 assert.match(dockerfile,/COPY dist\/ \/usr\/share\/nginx\/html\//);
 assert.match(dockerfile,/HEALTHCHECK[\s\S]*127[.]0[.]0[.]1\/healthz/);
 assert.match(ignore,/^\*$/m);
 assert.match(ignore,/^!dist\/\*\*$/m);
 assert.doesNotMatch(ignore,/env[.]production/i);
 assert.match(nginx,/location = \/healthz/);
 assert.match(nginx,/location ~\* \\.mjs\$/);
 assert.match(nginx,/default_type application\/javascript/);
 assert.match(nginx,/location ~\* \\.glb\$/);
 assert.match(nginx,/default_type model\/gltf-binary/);
});

test('production compose exposes only Caddy and keeps immutable game image configurable',()=>{
 const compose=read('docker-compose.prod.yml'),caddy=read('deploy/Caddyfile');
 assert.match(compose,/image: \$\{IMAGE:\?Set IMAGE/);
 assert.match(compose,/game:[\s\S]*expose:\s*\n\s*- "80"/);
 const gameSection=compose.slice(compose.indexOf('  game:'),compose.indexOf('  caddy:'));
 assert.doesNotMatch(gameSection,/ports:/);
 assert.match(compose,/caddy:[\s\S]*?ports:[\s\S]*?"80:80"[\s\S]*?"443:443"/);
 assert.match(compose,/caddy_data:\/data/);
 assert.match(caddy,/:80\s*\{[\s\S]*import common/);
 assert.match(caddy,/18bro[.]site, www[.]18bro[.]site/);
 assert.match(caddy,/http:\/\/18bro[.]site, http:\/\/www[.]18bro[.]site[\s\S]*redir https:\/\//);
});

test('deployment workflow verifies first, pins SSH, and deploys a SHA image without password secrets',()=>{
 const workflow=read('.github/workflows/deploy-production.yml');
 const verify=workflow.indexOf('npm run verify');
 const build=workflow.indexOf('docker/build-push-action@v6');
 assert.ok(verify>=0&&build>verify,'verification precedes image publication');
 assert.match(workflow,/sha-\$\{\{ github[.]sha \}\}/);
 assert.match(workflow,/VPS_KNOWN_HOSTS: \$\{\{ secrets[.]VPS_KNOWN_HOSTS \}\}/);
 assert.match(workflow,/StrictHostKeyChecking=yes/);
 assert.doesNotMatch(workflow,/ssh-keyscan|VPS_PASSWORD/);
 assert.match(workflow,/docker logout ghcr[.]io/);
 assert.match(workflow,/http:\/\/\$VPS_HOST\/healthz/);
});

test('deployment sources never contain local production environment values',()=>{
 const inputs=['Dockerfile','.dockerignore','docker-compose.yml','docker-compose.prod.yml','deploy/nginx.conf','deploy/Caddyfile','.github/workflows/deploy-production.yml'];
 const joined=inputs.map(read).join('\n');
 assert.doesNotMatch(joined,/2[.]57[.]91[.]91|31[.]97[.]47[.]189/);
 assert.match(read('.gitignore'),/^\.env\*$/m,'local production environments stay ignored');
});
