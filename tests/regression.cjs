const assert = require('node:assert/strict');
const test = require('node:test');
const {parseImmediate} = require('../.analysis-test-build/numeric.js');
const {parseInstructions, mnemonicInfo, inspectToken, splitOperands} = require('../.analysis-test-build/explainEngine.js');
const {guideInstruction} = require('../.analysis-test-build/instructionGuide.js');
const {analyzeValueFlow} = require('../.analysis-test-build/valueFlow.js');
const parse = text => parseInstructions(text);
const flow = text => analyzeValueFlow(parse(text));
const value = (result, name) => result.registers.find(r=>r.name===name)?.value;
const tests = [
  ['signed hex immediates',()=>assert.equal(parseImmediate('#-0x20'),-32n)],
  ['positive hex',()=>assert.equal(parseImmediate('#+0x20'),32n)],
  ['reject malformed immediate',()=>assert.equal(parseImmediate('#0xWRONG'),null)],
  ['memory operands stay grouped',()=>assert.deepEqual(splitOperands('W8, [X19, #0x200]'),['W8','[X19, #0x200]'])],
  ['unbalanced brackets rejected',()=>assert.throws(()=>splitOperands('W8, [X19, #8'))],
  ['mnemonic BIC explains',()=>assert.equal(mnemonicInfo('bic').title,'Bit Clear')],
  ['mnemonic LDRSB explains',()=>assert.match(mnemonicInfo('LDRSB').plain,/sign-extend/)],
  ['unknown mnemonic stays unknown',()=>assert.equal(mnemonicInfo('FICTIONAL'),null)],
  ['negative immediate inspector',()=>assert.match(inspectToken('#-0x20').detail,/-32 decimal/)],
  ['known arithmetic',()=>assert.match(value(flow('MOV W0, #4\nADD W1, W0, #8'),'X1'),/^12 \(/)],
  ['negative hex arithmetic',()=>assert.match(value(flow('MOV X0, #8\nADD X1, X0, #-0x2'),'X1'),/^6 \(/)],
  ['zero upper half W',()=>assert.match(value(flow('MOV X0, #-1\nMOV W0, #1'),'X0'),/^1 \(/)],
  ['MOVZ shifted halfword',()=>assert.match(value(flow('MOVZ X0, #0xABCD, LSL #16'),'X0'),/^2882338816 \(/)],
  ['MOVK combines halfwords',()=>assert.match(value(flow('MOVZ X0, #0x1234\nMOVK X0, #0xABCD, LSL #16'),'X0'),/^2882343476 \(/)],
  ['MOVK unknown original stays symbolic',()=>assert.match(value(flow('MOVK X0, #1, LSL #16'),'X0'),/replace bits/)],
  ['MOVZ invalid immediate stops',()=>assert.equal(flow('MOVZ W0, #0x10000').stoppedAt,0)],
  ['AND computes',()=>assert.match(value(flow('MOV W0, #15\nAND W1, W0, #3'),'X1'),/^3 \(/)],
  ['XOR computes',()=>assert.match(value(flow('MOV W0, #15\nEOR W1, W0, #10'),'X1'),/^5 \(/)],
  ['LSR computes',()=>assert.match(value(flow('MOV W0, #16\nLSR W1, W0, #2'),'X1'),/^4 \(/)],
  ['negative LSL shift never evaluated',()=>assert.match(value(flow('MOV W0, #2\nLSL W1, W0, #-1'),'X1'),/LSL\(/)],
  ['control flow stops safely',()=>assert.equal(flow('MOV W0, #1\nB.EQ stop\nADD W0, W0, #1').stoppedAt,1)],
  ['pre-index load stops value tracking safely',()=>assert.equal(flow('MOV SP, #4096\nLDR X0, [SP, #-16]!\nADD X1, SP, #8').stoppedAt,1)],
  ['post-index store stops value tracking safely',()=>assert.equal(flow('STR W0, [X1], #4\nADD X2, X1, #1').stoppedAt,0)],
  ['unknown memory stays symbolic',()=>assert.match(value(flow('LDR W8, [X19, #0x200]'),'X8'),/Memory/)],
  ['pre-index writeback explained',()=>assert.match(guideInstruction(parse('LDR X0, [SP, #-16]!')[0]).steps.join(' '),/Write the computed address back/)],
  ['post-index writeback explained',()=>assert.match(guideInstruction(parse('LDR X0, [SP], #16')[0]).steps.join(' '),/After the access/)],
  ['unknown instruction guide refuses to guess',()=>assert.match(guideInstruction(parse('CUSTOM X0, X1')[0]).heading,/Unmodeled/)],
];
for(const [name,fn] of tests) test(name,fn);
