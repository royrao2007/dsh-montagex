import test from 'node:test'
import assert from 'node:assert/strict'
import { estimateCost, findPrice, parsePriceTable, preflight, roundCents } from '../lib/testing.js'

const prices = [
  { model: 'seedance-2', price: 0.8, unit: 'second', currency: 'CNY' },
  { model: 'kolors', price: 0.35, unit: '1k-image', currency: 'CNY' },
  { model: 'qwen3-tts', price: 0.02, unit: 'call', currency: 'CNY' },
]

test('per-second rows multiply by duration and count, rounded to cents', () => {
  const result = estimateCost({ prices, model: 'seedance-2', duration: 5, count: 2 })
  assert.equal(result.known, true)
  assert.equal(result.estimatedCost, 8)
  assert.equal(result.currency, 'CNY')
})

test('per-image and per-call rows do not need a duration', () => {
  assert.equal(estimateCost({ prices, model: 'kolors', count: 4 }).estimatedCost, 1.4)
  assert.equal(estimateCost({ prices, model: 'qwen3-tts' }).estimatedCost, 0.02)
})

test('model matching ignores case and surrounding spaces', () => {
  assert.equal(findPrice(prices, '  SEEdance-2 ')?.model, 'seedance-2')
})

test('an unknown model yields no number instead of a guess', () => {
  const result = estimateCost({ prices, model: 'not-priced-model', count: 3 })
  assert.equal(result.known, false)
  assert.equal(result.estimatedCost, null)
  assert.match(result.breakdown, /无法估算/)
})

test('per-second rows without a duration report a missing input, not an unknown model', () => {
  const result = estimateCost({ prices, model: 'seedance-2' })
  assert.equal(result.known, true)
  assert.equal(result.estimatedCost, null)
  assert.equal(result.missingInput, true)
})

test('roundCents is deterministic half-up', () => {
  assert.equal(roundCents(1.005), 1.01)
  assert.equal(roundCents(0.1 + 0.2), 0.3)
  assert.equal(roundCents(2.344), 2.34)
})

test('parsePriceTable drops invalid rows instead of guessing', () => {
  const rows = parsePriceTable({
    models: [
      { model: 'ok', price: 1, unit: 'call' },
      { model: '', price: 1, unit: 'call' },
      { model: 'bad-unit', price: 1, unit: 'minute' },
      { model: 'bad-price', price: 'x', unit: 'call' },
      { model: 'neg', price: -1, unit: 'call' },
    ],
  })
  assert.deepEqual(rows.map(row => row.model), ['ok'])
  assert.deepEqual(parsePriceTable('nonsense'), [])
})

test('preflight cost gate reports the estimate and passes once the budget is confirmed', () => {
  const base = {
    prompt: '一个女人在雨夜街头奔跑，逆光轮廓，电影感，写实风格，避免任何文字',
    type: 'video',
    model: 'seedance-2',
    duration: 5,
    size: '16:9',
    prices,
  }
  const first = preflight(base)
  assert.equal(first.cost.estimatedCost, 4)
  assert.equal(first.gates.cost.pass, false)
  assert.ok(first.gates.cost.notes.some(line => line.includes('4.00')))

  const confirmed = preflight({ ...base, userConfirmedBudget: true })
  assert.equal(confirmed.gates.cost.pass, true)
  assert.ok(confirmed.gates.cost.notes.includes('预算已经用户确认'))
})

test('preflight without a price table still blocks the cost gate', () => {
  const result = preflight({ prompt: '一个女人在雨夜街头奔跑，逆光，电影感，写实，避免文字', model: 'unknown-model' })
  assert.equal(result.cost.known, false)
  assert.equal(result.gates.cost.pass, false)
})