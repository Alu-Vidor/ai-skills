export const SCALE=[1/9,1/8,1/7,1/6,1/5,1/4,1/3,1/2,1,2,3,4,5,6,7,8,9];
export const RI={2:0,3:.52,4:.89,5:1.11,6:1.25,7:1.35,8:1.40,9:1.45,10:1.49};
export function fraction(s) {
  if(typeof s==='number') return s;
  const parts=String(s).split('/').map(Number);
  return parts.length===2?parts[0]/parts[1]:parts[0];
}
export function matrixFrom(records,n) {
  const a=Array.from({length:n},()=>Array(n).fill(1));
  for(const r of records) {const [i,j]=r.pair.split('').map(x=>+x-1);a[i][j]=fraction(r.value);a[j][i]=1/a[i][j];}
  return a;
}
export function validMatrix(a,n) {
  return Array.isArray(a)&&a.length===n&&a.every((r,i)=>Array.isArray(r)&&r.length===n&&r.every((x,j)=>Number.isFinite(x)&&x>=1/9-1e-10&&x<=9+1e-10&&Math.abs(x*a[j]?.[i]-1)<1e-8&&(i!==j||Math.abs(x-1)<1e-10)));
}
export function eigen(a,ri=RI[a.length],limit=a.length===3?.05:.1) {
  const n=a.length;
  if(!validMatrix(a,n)) throw Error('Некорректная матрица парных сравнений');
  let q=Array(n).fill(1/n);
  for(let t=0;t<10000;t++) {
    const v=a.map(r=>r.reduce((s,x,j)=>s+x*q[j],0)),sum=v.reduce((s,x)=>s+x,0);
    const next=v.map(x=>x/sum),diff=Math.max(...next.map((x,i)=>Math.abs(x-q[i])));q=next;
    if(diff<1e-14) break;
  }
  const lambda=a.map((r,i)=>r.reduce((s,x,j)=>s+x*q[j],0)/q[i]).reduce((s,x)=>s+x,0)/n;
  const ci=Math.max(0,(lambda-n)/(n-1)),cr=n===2?0:ci/ri;
  return {q,lambda,ci,cr,accepted:cr<=limit+1e-10};
}
export function normalize(a) {const sum=a.reduce((s,x)=>s+x,0);if(!a.every(x=>Number.isFinite(x)&&x>=0)||!Number.isFinite(sum)||sum<=0)throw Error('Нужен хотя бы один положительный вес в допустимом диапазоне');return a.map(x=>x/sum);}
export function synthesize(m,w) {return m.map(r=>r.reduce((s,x,j)=>s+x*w[j],0));}
export function changeWeight(w,j,u) {
  if(u<0||u>1||!Number.isFinite(u))throw Error('Вес должен быть от 0 до 1');
  const rest=w.reduce((s,x,i)=>s+(i===j?0:x),0);
  return w.map((x,i)=>i===j?u:rest>1e-12?x*(1-u)/rest:(1-u)/(w.length-1));
}
export function leaders(p) {const max=Math.max(...p);return p.map((x,i)=>max-x<1e-10?i:-1).filter(i=>i>=0);}
export function sensitivity(m,w,j,lo=.1,hi=.7) {
  const p0=synthesize(m,changeWeight(w,j,0)),p1=synthesize(m,changeWeight(w,j,1));
  const a=p1.map((x,i)=>x-p0[i]),knots=[lo,hi];
  for(let i=0;i<m.length;i++)for(let k=i+1;k<m.length;k++)if(Math.abs(a[i]-a[k])>1e-12){const u=(p0[k]-p0[i])/(a[i]-a[k]);if(u>lo&&u<hi)knots.push(u);}
  knots.sort((a,b)=>a-b);
  const unique=knots.filter((x,i)=>i===0||x-knots[i-1]>1e-10),intervals=[];
  for(let i=0;i<unique.length-1;i++){
    const from=unique[i],to=unique[i+1],ls=leaders(synthesize(m,changeWeight(w,j,(from+to)/2)));
    if(intervals.length&&String(intervals.at(-1).leaders)===String(ls)) intervals.at(-1).to=to;
    else intervals.push({from,to,leaders:ls});
  }
  return {intervals,switches:intervals.slice(1).map(x=>({u:x.from,leaders:leaders(synthesize(m,changeWeight(w,j,x.from)))}))};
}
// Reserve and minima are assigned first. Remaining units follow priorities, with caps.
export function allocate(p,total,reserve,step,minima,maxima) {
  if(![total,reserve,step,...minima,...maxima.filter(x=>x!==null)].every(Number.isFinite)||total<0||reserve<0||step<=0||reserve>total)throw Error('Проверьте общий объём, резерв и шаг');
  const n=p.length,budget=(total-reserve)/step;
  if(Math.abs(budget-Math.round(budget))>1e-8)throw Error('Объём без резерва должен делиться на шаг');
  const mins=minima.map(x=>x/step),caps=maxima.map(x=>x===null?Math.round(budget):x/step);
  if(mins.length!==n||caps.length!==n||mins.some((x,i)=>x<0||Math.abs(x-Math.round(x))>1e-8||caps[i]<x||Math.abs(caps[i]-Math.round(caps[i]))>1e-8))throw Error('Границы должны быть кратны шагу, максимум не меньше минимума');
  if(mins.reduce((s,x)=>s+x,0)>budget+1e-8)throw Error('На обязательный минимум не хватает часов');
  if(caps.reduce((s,x)=>s+x,0)<budget-1e-8)throw Error('Максимальные значения не вмещают весь объём');
  const result=[...mins];let remaining=Math.round(budget-mins.reduce((s,x)=>s+x,0));
  let active=p.map((_,i)=>i).filter(i=>caps[i]>result[i]);
  while(remaining>0&&active.length) {
    const sum=active.reduce((s,i)=>s+p[i],0),shares=active.map(i=>({i,share:remaining*(sum>0?p[i]/sum:1/active.length)}));
    const saturated=shares.filter(x=>x.share>=caps[x.i]-result[x.i]-1e-10);
    if(saturated.length) {for(const {i} of saturated){const d=caps[i]-result[i];result[i]+=d;remaining-=d;}active=active.filter(i=>!saturated.some(x=>x.i===i));continue;}
    const residues=[];for(const {i,share} of shares){const d=Math.floor(share);result[i]+=d;remaining-=d;residues.push({i,r:share-d});}
    residues.sort((a,b)=>b.r-a.r||a.i-b.i);
    for(const {i} of residues){if(!remaining)break;result[i]++;remaining--;}
  }
  if(remaining) throw Error('Не удалось распределить весь объём');
  return result.map(x=>x*step);
}
export function perturbation(criteria,locals) {
  const baseW=eigen(criteria).q,m=locals[0].map((_,i)=>locals.map(a=>eigen(a).q[i]));
  const base=leaders(synthesize(m,baseW));let tested=0,accepted=0,changed=0;
  for(const [k,a] of [criteria,...locals].entries())for(let i=0;i<a.length;i++)for(let j=i+1;j<a.length;j++){
    const ix=SCALE.findIndex(x=>Math.abs(x-a[i][j])<1e-9);if(ix<0)continue;
    for(const delta of [-1,1]){if(!SCALE[ix+delta])continue;tested++;const b=a.map(r=>[...r]);b[i][j]=SCALE[ix+delta];b[j][i]=1/b[i][j];const e=eigen(b);if(!e.accepted)continue;accepted++;
      const nextM=m.map(r=>[...r]);if(k>0)e.q.forEach((v,r)=>nextM[r][k-1]=v);
      if(String(leaders(synthesize(nextM,k===0?e.q:baseW)))!==String(base))changed++;
    }
  }
  return {tested,accepted,rejected:tested-accepted,changed};
}
