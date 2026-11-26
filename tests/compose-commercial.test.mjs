import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { composeKindFromBriefType, composeProductionFlow, classifyRequestType } from '../lib/testing.js'

const NEW_KINDS = [
  ['数字人/口播人像', 'spoken-avatar', 'recipes/spoken-avatar.md'],
  ['译制/配音翻译', 'dub', 'recipes/localization-dub.md'],
  ['播客/访谈改造', 'podcast', 'recipes/podcast-repurpose.md'],
  ['屏幕演示/录屏', 'screen-demo', 'recipes/screen-demo.md'],
]

test('the four new commercial shapes map to their own recipes', () => {
  for (const [type, kind, file] of NEW_KINDS) {
    assert.equal(composeKindFromBriefType(type), kind, type)
    const flow = composeProductionFlow({ type, request: `做一个${type}的片子` })
    assert.equal(flow.kind, kind)
    assert.equal(flow.recipe, file)
    assert.ok(flow.stages.some(stage => stage.tools.includes('mont_propose')), kind)
    assert.ok(flow.stages.some(stage => stage.tools.includes('mont_confirm')), kind)
  }
})

test('every new recipe file exists and declares its name and gates', () => {
  for (const [, kind, file] of NEW_KINDS) {
    const text = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
    assert.match(text, /^name: /m, file)
    assert.match(text, /## 阶段序列/, file)
    assert.match(text, /## 门禁/, file)
    assert.ok(text.length > 600, `${file} is too thin`)
    assert.notEqual(kind, '', kind)
  }
})

test('数字人口播 ranks above the broad 口播/讲解 catch-all', () => {
  const classified = classifyRequestType('做一条数字人口播带货视频')
  assert.equal(classified.type, '数字人/口播人像')
})

test('a plain tutorial request still lands on 口播/讲解', () => {
  const classified = classifyRequestType('做一个软件使用教程讲解')
  assert.equal(classified.type, '口播/讲解')
})