'use strict';
// End-to-end campaign simulation. It calls the same model methods (`build`, `research`, `tick`,
// `startRitual`) used by the UI, advances with the same fixed 0.2 game-second step, and never
// grants resources/tech. Only meteor impact randomness is seeded to make the CI run repeatable.
global.window=global;global.SilLog={push(){}};const M=require('../model.js')&&global.SilModel,assert=require('node:assert/strict');Math.random=()=>.999;let s=M.fresh(),elapsed=0,actions=[];
function advance(seconds){let left=seconds;while(left>1e-8&&!s.won){let dt=Math.min(.2,left);M.tick(s,dt);left-=dt;elapsed+=dt}}
function waitFor(fn,what,limit=3600){let start=elapsed;while(!fn()&&elapsed-start<limit&&!s.won)advance(.2);assert(fn(),`timeout waiting for ${what}; t=${elapsed.toFixed(1)}, resources=${JSON.stringify(s.resources)}, phase=${M.getPhase(s)[0]}, nodes=${JSON.stringify(s.nodes.map(n=>({type:n.type,grow:n.grow.toFixed(1),heat:n.heat.toFixed(0),work:n.work.toFixed(1),link:M.connected(s,n)})))}, drones=${JSON.stringify(s.drones)}, items=${JSON.stringify(s.items.slice(-12))}, shardVeins=${s.deposits.filter(d=>d.type==='shard').map(d=>d.qty)}`)}
function place(type,x,y){let start=elapsed;for(let k=0;k<4000;k++){let result=M.build(s,type,{x,y});if(result.ok){actions.push(`build ${type} @ ${x},${y} t=${elapsed.toFixed(1)}`);advance(3);return result.node}if(!result.why.includes('Недостаточно ресурсов')){if(result.why.includes('Не подключено')){advance(1);continue}throw Error(`cannot place ${type} @ ${x},${y}: ${result.why}`)}advance(5)}throw Error(`build timeout ${type} after ${(elapsed-start).toFixed(0)}s; ${JSON.stringify(s.resources)}`)}
function research(id){let start=elapsed;waitFor(()=>s.resources.shards>=M.TECHS.find(t=>t.id===id).cost&&s.resources.energy>=M.TECHS.find(t=>t.id===id).energy,`research resources ${id}`,2400);let result=M.research(s,id);assert(result.ok,`research ${id}: ${result.why}`);actions.push(`research ${id} t=${elapsed.toFixed(1)}`);}
// Wake + first power; physically mine, transport and refine. Keep hot machinery in rad range.
place('resonator',70,0);let mainRes=s.nodes.at(-1);place('refinery',-55,95);place('relay',-90,-40);place('radiator',0,-120);place('radiator',-150,0);place('extractor',-205,-115);waitFor(()=>s.resources.sil>=75,'starter silicate shipments delivered',900);assert(s.items.some(i=>i.phase==='ground'||i.phase==='atFactory'||i.phase==='product'),'raw resources exist as separate cargo items');assert(s.stats.delivered>0,'physical product cargo reached the Matriarch');
// Extend to metal, build the memory lab and shard mine through a real live route.
place('relay',50,-145);place('extractor',30,-270);place('lab',120,75);place('relay',-200,0);place('radiator',-260,-50);place('extractor',-340,4);place('radiator',100,140);
// Replay investments from the actual earned shard inventory; the lab must process ore shipments.
research('morph');research('veins');research('thermal');research('harmonics');research('accord');research('autonomy');
place('nest',120,-145);research('swarm');research('memory');research('xeno');
// Upgrade the network: distinct high-frequency resonator, ward, storage, physical X crystal,
// then the Chamber. Costs are paid from delivered factory outputs only.
place('resonator',170,20);let highRes=s.nodes.at(-1);highRes.mode='high';place('radiator',130,-35);place('ward',80,-90);place('battery',80,105);place('crystallizer',180,-70);
waitFor(()=>s.resources.xeno>=1,'physical Ksenokvartz reaches the Matriarch',1800);place('chamber',250,-85);waitFor(()=>s.resources.energy>=160,'ritual reserve',900);s.freq=1200;highRes.mode='high';mainRes.mode='base';let start=M.startRitual(s);assert(start.ok,`ritual start: ${start.why}`);
let ritualStart=elapsed;waitFor(()=>s.won,'Body II chapter completion',900);assert(s.won&&s.ritualProgress>=1,'first chapter reaches its real victory state');assert(elapsed-ritualStart<=300,'ritual trial resolves in a reasonable timeframe');assert(s.stats.delivered>100,'campaign materially moved resources by courier');assert(s.stats.researched===9,'all nine real technology effects researched');
console.log(`PASS FULL CHAPTER: ${elapsed.toFixed(1)} simulated seconds; ${actions.length} construction/research actions; ${s.stats.delivered.toFixed(0)} delivered material units; ${s.stats.researched} technologies; Body II finale`);
