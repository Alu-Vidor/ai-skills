import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {matrixFrom,eigen,synthesize,allocate,sensitivity,changeWeight,normalize,perturbation,validMatrix} from '../src/math.js';
const inputs=JSON.parse(await readFile(new URL('../data/dissertation.json',import.meta.url)));
const reference=JSON.parse(await readFile(new URL('../data/reference-results.json',import.meta.url)));
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const criteria=matrixFrom(inputs.criterion_comparisons,3),w=eigen(criteria).q;
test('all three dissertation scenarios reproduce independent reference eigenvectors and priorities',()=>{
  near(eigen(criteria).cr,reference.criteria.CR);
  inputs.scenarios.forEach((s,k)=>{
    const local=inputs.criteria_order.map(key=>eigen(matrixFrom(s.judgments[key],5)));
    const m=Array.from({length:5},(_,i)=>local.map(e=>e.q[i]));
    const p=synthesize(m,w);p.forEach((x,i)=>near(x,reference.scenarios[k].P[i]));
    local.forEach((e,j)=>{near(e.cr,reference.scenarios[k].locals[j].CR);assert.equal(e.accepted,true);});
    near(p.reduce((a,b)=>a+b,0),1);
  });
});
test('analytical sensitivity matches all reference leader switches',()=>{
  inputs.scenarios.forEach((s,k)=>{
    const local=inputs.criteria_order.map(key=>eigen(matrixFrom(s.judgments[key],5)));
    const m=Array.from({length:5},(_,i)=>local.map(e=>e.q[i]));
    for(let j=0;j<3;j++) {
      const computed=sensitivity(m,w,j).switches,expected=reference.scenarios[k].weight_sensitivity[j].leader_switches;
      assert.equal(computed.length,expected.length);computed.forEach((v,i)=>near(v.u,expected[i].u));
    }
  });
});
test('one-step baseline perturbations reproduce 66 / 63 / 3 / 0 per scenario',()=>{
  inputs.scenarios.forEach(s=>assert.deepEqual(perturbation(criteria,inputs.criteria_order.map(k=>matrixFrom(s.judgments[k],5))),{tested:66,accepted:63,rejected:3,changed:0}));
});
test('thesis example yields the original 34 + 2 hour plan with two-hour units',()=>{
  const m=[[.12,.22,.10,.06,.14],[.16,.18,.20,.12,.30],[.24,.14,.16,.38,.16],[.26,.24,.16,.28,.18],[.14,.14,.10,.10,.12],[.08,.08,.28,.06,.10]];
  const p=synthesize(m,[.28,.18,.22,.24,.08]);
  assert.deepEqual(allocate(p,36,2,2,Array(6).fill(0),Array(6).fill(null)),[4,6,8,8,4,4]);
});
test('allocation respects minima, caps, fractional units, zero weights and ties',()=>{
  assert.deepEqual(allocate([.8,.1,.1],12,2,2,[2,2,2],[4,null,null]),[4,4,2]);
  assert.deepEqual(allocate([1,0,0],10,0,1,[0,0,0],[2,4,4]),[2,4,4]);
  assert.deepEqual(allocate([.5,.5],3,0,.5,[.5,.5],[null,null]),[1.5,1.5]);
  assert.deepEqual(allocate([.5,.5],0,0,1,[0,0],[null,null]),[0,0]);
  assert.deepEqual(allocate([.5,.5],1,0,1,[0,0],[null,null]),[1,0]);
});
test('infeasible plans are rejected instead of silently changing constraints',()=>{
  assert.throws(()=>allocate([.5,.5],4,0,1,[3,3],[null,null]),/минимум/);
  assert.throws(()=>allocate([.5,.5],10,0,1,[0,0],[2,2]),/Максимальные/);
  assert.throws(()=>allocate([.5,.5],5,0,2,[0,0],[null,null]),/делиться/);
  assert.throws(()=>allocate([.5,.5],5,8,1,[0,0],[null,null]));
  assert.throws(()=>allocate([.5,.5],8,0,2,[1,0],[null,null]),/кратны/);
});
test('allocation maintains exact budget and bounds across deterministic generated cases',()=>{
  for(let n=2;n<=10;n++)for(let budget=n;budget<80;budget++){
    const weights=normalize(Array.from({length:n},(_,i)=>(i+1)*(budget%5+1))),mins=Array(n).fill(1),caps=Array(n).fill(null);
    caps[0]=1;
    const result=allocate(weights,budget,0,1,mins,caps);
    assert.equal(result.reduce((s,x)=>s+x,0),budget);assert.equal(result[0],1);assert.ok(result.every(Number.isInteger));assert.ok(result.every(x=>x>=1));
  }
});
test('zero-rest sensitivity stays normalized, two-way AHP has CR zero, bad matrices reject',()=>{
  assert.deepEqual(changeWeight([1,0,0],0,.4),[.4,.3,.3]);
  near(changeWeight([.2,.3,.5],1,.7).reduce((s,x)=>s+x,0),1);
  assert.equal(eigen([[1,3],[1/3,1]]).cr,0);
  assert.equal(validMatrix([[1,3],[1,1]],2),false);
  assert.throws(()=>eigen([[1,-3],[-1/3,1]]));
  assert.throws(()=>normalize([0,0]));
});
