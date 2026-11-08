// Capture-time land ownership defines an isolated region. No sea routes or RNG.
export function isolatedRegions(state,atlas,capitalCell,nations){
 const result=[];
 for(const nation of nations){
  const seen=new Set(),capital=capitalCell(state,nation);
  for(const cell of state.cells){
   if(cell.owner!==nation||seen.has(cell.id))continue;
   const cells=[cell.id];seen.add(cell.id);
   for(let i=0;i<cells.length;i++)for(const id of atlas.cells[cells[i]].neighbors)if(state.cells[id].owner===nation&&!seen.has(id)){seen.add(id);cells.push(id);}
   if(cells.includes(capital))continue;
   const members=state.countries[nation].generals.filter(g=>g.active&&g.alive&&cells.includes(g.position)).map(g=>({general:g,from:g.position}));
   if(members.length)result.push({nation,cells,members});
  }
 }
 return result;
}
export class IsolatedEvacuation {
 constructor(ctx){this.ctx=ctx;this.pending=[];this.evacuated=new Map();}
 snapshot(nations){const {s,Atlas,helpers:h}=this.ctx;if(s.isolatedEvacuation)this.pending.push(...isolatedRegions(s,Atlas,h.capitalCell,nations));}
 has(g,battleIndex){return this.evacuated.get(g)===battleIndex;}
 finish(battle){
  const {s,rules,helpers:h,emit}=this.ctx,pending=this.pending;this.pending=[];
  for(const region of pending){
   if(region.cells.some(id=>s.cells[id].owner===region.nation))continue;
   const to=h.capitalCell(s,region.nation);if(!Number.isInteger(to)||s.cells[to]?.owner!==region.nation)continue;
   for(const {general:g,from} of region.members){
    if(this.has(g,battle.index)||!g.active||!g.alive||g.troops<=0||!region.cells.includes(g.position))continue;
    const before=g.troops,unit=rules.troopRounding==='ten-thousand'?1:10000,after=Math.floor((before*unit)/3+1e-9)/unit;
    g.troops=after;g.position=to;g.stranded=false;this.evacuated.set(g,battle.index);h.syncArmy(s.countries[region.nation]);
    const loss={before,after,amount:Number((before-after).toFixed(4))};
    emit('isolated_return',g.name+' · 고립지 철수',`고립 영토 전부 상실 · 잔여 ${before}만 중 ${after}만 귀환 · ${loss.amount}만 철수 손실`,{nation:region.nation,slot:g.slot,role:'general',battleIndex:battle.index,destination:to,reason:'isolated_loss',relocation:true,loss,moves:[{nation:region.nation,slot:g.slot,generation:g.generation,kind:'redeploy',from,to,path:[from,to]}]},true);
   }
  }
 }
}
