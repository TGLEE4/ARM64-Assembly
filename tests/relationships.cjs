const assert = require('node:assert/strict');
const test = require('node:test');
const { parseInstructions } = require('../.analysis-test-build/explainEngine.js');
const { analyzeRelationships } = require('../.analysis-test-build/relationships.js');
const analyze = (source) => analyzeRelationships(parseInstructions(source));
const last=(source)=>analyze(source).items.at(-1);
test('load to compare: linked source line',()=>{
  const result=analyze('LDR W8, [X19, #0x200]\nCMP W8, #0\nB.EQ target');
  assert.deepEqual(result.items[1].sources,[0]);
  assert.deepEqual(result.items[2].sources,[1]);
  assert.match(result.items[2].explanation,/not established/);
  assert.equal(result.stoppedAt,2);
});
test('known equality can be evaluated but is not observed',()=>{
  const result=analyze('MOV W0, #4\nADD W1, W0, #8\nCMP W1, #12\nB.EQ done');
  assert.deepEqual(result.items.map(item=>item.sources),[[],[0],[1],[2]]);
  assert.match(result.items[3].explanation,/would be true/);
  assert.match(result.items[3].detail,/not proof/);
});
test('known inequality B.NE true',()=>assert.match(last('MOV W0, #4\nCMP W0, #5\nB.NE done').explanation,/would be true/));
test('known equality B.NE false',()=>assert.match(last('MOV W0, #4\nCMP W0, #4\nB.NE done').explanation,/would be false/));
test('zero register is known',()=>assert.match(last('CMP WZR, #0\nB.EQ equal').explanation,/would be true/));
test('W-reg writes zero high half',()=>assert.match(last('MOV X0, #-1\nMOV W0, #1\nCMP X0, #1').explanation,/are equal/));
test('unknown sources remain unknown',()=>assert.match(last('ADD X1, X2, #3\nCMP X1, #5').explanation,/cannot be determined/));
test('call boundary stops',()=>assert.equal(analyze('MOV X0, #1\nBL target\nADD X1, X0, #1').stoppedAt,1));
test('unsupported instruction stops',()=>assert.equal(analyze('MOV X0, #1\nCUSTOM X0, X1\nCMP X0, #1').stoppedAt,1));
test('memory writeback stops',()=>assert.equal(analyze('LDR X0, [SP], #16\nCMP X0, #0').stoppedAt,0));
test('register zero test links origin',()=>assert.deepEqual(last('MOV W0, #0\nCBZ W0, target').sources,[0]));
test('shifted wide immediate and MOVK link',()=>assert.deepEqual(analyze('MOVZ X0, #0x1234\nMOVK X0, #0xABCD, LSL #16').items[1].sources,[0]));
