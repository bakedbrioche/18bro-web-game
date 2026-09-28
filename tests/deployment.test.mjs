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

test('shared Traefik edge owns public ports and discovers private services through labels',()=>{
 const proxy=read('docker-compose.proxy.yml'),game=read('docker-compose.prod.yml');
 assert.match(proxy,/image: traefik:v3[.]5/);
 assert.match(proxy,/--providers[.]docker[.]exposedbydefault=false/);
 assert.match(proxy,/--providers[.]docker[.]network=proxy/);
 assert.match(proxy,/--certificatesresolvers[.]letsencrypt[.]acme[.]httpchallenge[.]entrypoint=web/);
 assert.match(proxy,/"80:80"[\s\S]*"443:443"/);
 assert.match(proxy,/\/var\/run\/docker[.]sock:\/var\/run\/docker[.]sock:ro/);
 assert.match(proxy,/external: true/);
 assert.match(game,/image: \$\{IMAGE:\?Set IMAGE/);
 const gameSection=game.slice(game.indexOf('  game:'));
 assert.doesNotMatch(gameSection,/\n\s+ports:/);
 assert.match(game,/traefik[.]enable=true/);
 assert.match(game,/PathPrefix\(`\/game`\)/);
 assert.match(game,/Host\(`18bro[.]site`\).*Host\(`www[.]18bro[.]site`\)/);
 assert.match(game,/stripprefix[.]prefixes=\/game/);
 assert.match(game,/tls[.]certresolver=letsencrypt/);
 assert.match(game,/external: true/);
});

test('deployment workflow verifies first, pins SSH, and deploys SHA image at /game',()=>{
 const workflow=read('.github/workflows/deploy-production.yml');
 const verify=workflow.indexOf('npm run verify');
 const build=workflow.indexOf('docker/build-push-action@v6');
 assert.ok(verify>=0&&build>verify,'verification precedes image publication');
 assert.match(workflow,/sha-\$\{\{ github[.]sha \}\}/);
 assert.match(workflow,/VPS_KNOWN_HOSTS: \$\{\{ secrets[.]VPS_KNOWN_HOSTS \}\}/);
 assert.match(workflow,/StrictHostKeyChecking=yes/);
 assert.doesNotMatch(workflow,/ssh-keyscan|VPS_PASSWORD/);
 assert.match(workflow,/docker-compose[.]proxy[.]yml/);
 assert.match(workflow,/docker network inspect proxy/);
 assert.match(workflow,/docker logout ghcr[.]io/);
 assert.match(workflow,/http:\/\/\$VPS_HOST\/game\/healthz/);
});

test('deployment sources contain no local production values or retired Caddy edge',()=>{
 const inputs=['Dockerfile','.dockerignore','docker-compose.yml','docker-compose.prod.yml','docker-compose.proxy.yml','deploy/nginx.conf','.github/workflows/deploy-production.yml'];
 const joined=inputs.map(read).join('\n');
 assert.doesNotMatch(joined,/2[.]57[.]91[.]91|31[.]97[.]47[.]189|VPS_PASSWORD/);
 assert.doesNotMatch(read('docker-compose.prod.yml')+read('docker-compose.proxy.yml'),/caddy/i);
 assert.match(read('.gitignore'),/^\.env\*$/m,'local production environments stay ignored');
 assert.equal(fs.existsSync(new URL('../deploy/Caddyfile',import.meta.url)),false);
});
