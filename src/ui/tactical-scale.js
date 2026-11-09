// A common scale for both countries. Largest remainders preserve the total;
// commanders do not each receive a separate minimum army of eight sprites.
export function tacticalScale(units,{largeSideBudget=480,totalBudget=960}={}){
 const totals={attack:0,defense:0};for(const u of units)totals[u.side]+=u.visualArmy??u.startArmy;const largest=Math.max(...Object.values(totals),.0001),scale=Math.min(largeSideBudget/largest,totalBudget/Math.max(.0001,totals.attack+totals.defense)),allocations=new Map(),diagnostics=[];
 for(const side of ['attack','defense']){const list=units.filter(u=>u.side===side),target=Math.round(totals[side]*scale),rows=list.map(u=>{const exact=(u.visualArmy??u.startArmy)*scale;return {id:u.id,exact,n:Math.floor(exact),remainder:exact%1};}),left=target-rows.reduce((n,r)=>n+r.n,0);[...rows].sort((a,b)=>b.remainder-a.remainder||a.id.localeCompare(b.id)).slice(0,left).forEach(r=>r.n++);for(const r of rows){allocations.set(r.id,r.n);if(Math.abs(r.n-r.exact)>.01)diagnostics.push({type:'figure-rounding',id:r.id,expected:r.exact,actual:r.n});}}
 const groups=[];for(const u of units){const n=allocations.get(u.id),count=Math.max(1,Math.ceil(n/32));for(let i=0;i<count;i++){const figures=Math.floor(n/count)+(i<n%count?1:0);groups.push({id:u.id+':section:'+i,parentId:u.id,index:i,count,figures,weight:n?figures/n:1,columns:Math.min(8,Math.max(1,Math.ceil(Math.sqrt(figures*1.5)))),side:u.side});}}
 return {scale,totals,allocations:Object.fromEntries(allocations),groups,diagnostics};
}
