import { mapAnchor } from '../model/cartography-geometry.js';
import { neighbors } from '../model/world.js';
import { esc } from './icons.js';
const observerMapCache=new WeakMap();
export function observerLandmarks(world){
 if(observerMapCache.has(world))return observerMapCache.get(world);
 const capitals=new Set(world.countries.map(c=>c.capitalId)),frontier=new Set(world.territories.filter(t=>neighbors(world,t).some(n=>n.ownerId!==t.ownerId)).map(t=>t.id));
 const cards=[...world.countries.map(c=>mapAnchor(world,c.capitalId,'label')),...world.people.filter(p=>p.role==='general'&&p.active&&p.alive).map(p=>mapAnchor(world,p.positionId||p.stationId,'label'))].filter(Boolean).map(p=>[p[0],p[1]-56]);
 const countries=world.countries.flatMap(country=>{const own=world.territories.filter(t=>t.ownerId===country.id);if(!own.length)return [];const points=own.map(t=>mapAnchor(world,t.id,'label')),center=points.reduce((p,q)=>[p[0]+q[0]/points.length,p[1]+q[1]/points.length],[0,0]);
  const half=country.name.length*14,clear=points.filter(p=>!cards.some(c=>Math.abs(p[0]-c[0])<half+26&&p[1]-22>c[1]-38&&p[1]-55<c[1]+44)),candidates=clear.length?clear:points,anchor=candidates.reduce((a,b)=>Math.hypot(...a.map((v,i)=>v-center[i]))<Math.hypot(...b.map((v,i)=>v-center[i]))?a:b);return [{country,point:anchor}];});
 const value={capitals,frontier,countries};observerMapCache.set(world,value);return value;
}
export function incidentTerritories(world,scene,battle){
 const ids=new Set();if(battle)ids.add(battle.territoryId);
 for(const move of scene?.moves||[]){ids.add(move.fromId);ids.add(move.toId);}
 for(const p of world.people)if(p.role==='general'&&battle&&((p.countryId===battle.actorId&&p.slot===battle.slot)||(p.countryId===battle.defenderId&&p.slot===battle.defenseSlot)))ids.add(p.positionId||p.stationId);
 if(!battle&&scene?.event?.nationId){const c=world.countries.find(c=>c.id===scene.event.nationId),person=world.people.find(p=>p.role==='general'&&p.countryId===c?.id&&p.slot===scene.event.slot);if(person)ids.add(person.positionId||person.stationId);else if(c)ids.add(c.capitalId);}
 return ids;
}
export function renderCountryLabels(landmarks){return `<g class="observer-country-labels" pointer-events="none">${landmarks.countries.map(({country,point})=>`<text text-anchor="middle" x="${point[0]}" y="${point[1]-23}" data-country-label="${esc(country.id)}">${esc(country.name)}</text>`).join('')}</g>`;}
export function observerDetail(mode,scale,zoom=scale){return mode==='all'?'all':zoom<1.2||scale<.95?'wide':scale<1.55?'regional':'battle';}
