import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { MontagexCanvasStore } from '../lib/testing.js'

async function newStore() {
  return new MontagexCanvasStore(await mkdtemp(join(tmpdir(), 'canvas-lock-')))
}

async function seedLocked(store) {
  const first = await store.addNode({ kind: 'text', label: '参考', x: 0, y: 0 })
  const text = first.nodes.find(node => node.label === '参考')
  const second = await store.addNode({ kind: 'image', label: '主角定妆', x: 10, y: 20, path: 'face.png' })
  const shot = second.nodes.find(node => node.label === '主角定妆')
  await store.addEdge({ from: text.id, to: shot.id })
  await store.update(shot.id, { locked: true })
  return { text, shot }
}

test('a locked node survives a full replace that omits it, wiring included', async () => {
  const store = await newStore()
  const { text, shot } = await seedLocked(store)
  const current = await store.read()
  const kept = current.nodes.find(node => node.id === text.id)
  const saved = await store.write({ version: 1, updatedAt: 0, nodes: [kept], edges: [] }, current.updatedAt)
  const restored = saved.nodes.find(node => node.id === shot.id)
  assert.ok(restored, 'locked node must be resurrected')
  assert.equal(restored.locked, true)
  assert.equal(restored.label, '主角定妆')
  assert.equal(restored.x, 10)
  assert.equal(restored.path, 'face.png')
  assert.ok(saved.edges.some(edge => edge.from === text.id && edge.to === shot.id), 'its edge must come back')
})

test('while locked, incoming edits to the node lose to the stored values', async () => {
  const store = await newStore()
  const { shot } = await seedLocked(store)
  const current = await store.read()
  const tampered = current.nodes.map(node => node.id === shot.id
    ? { ...node, label: '智能体改名', x: 999, y: 999, path: 'other.png' }
    : node)
  const saved = await store.write({ version: 1, updatedAt: 0, nodes: tampered, edges: current.edges }, current.updatedAt)
  const kept = saved.nodes.find(node => node.id === shot.id)
  assert.equal(kept.label, '主角定妆')
  assert.equal(kept.x, 10)
  assert.equal(kept.y, 20)
  assert.equal(kept.path, 'face.png')
  assert.equal(kept.locked, true)
})

test('locked=false in the incoming document is the explicit unlock and applies', async () => {
  const store = await newStore()
  const { shot } = await seedLocked(store)
  const current = await store.read()
  const incoming = current.nodes.map(node => node.id === shot.id ? { ...node, locked: false, label: '解锁改名' } : node)
  const unlocked = await store.write({ version: 1, updatedAt: 0, nodes: incoming, edges: current.edges }, current.updatedAt)
  const changed = unlocked.nodes.find(node => node.id === shot.id)
  assert.equal(changed.locked, undefined)
  assert.equal(changed.label, '解锁改名')
  // Once unlocked, a later replace may delete it.
  const later = await store.read()
  const gone = await store.write({ version: 1, updatedAt: 0, nodes: later.nodes.filter(node => node.id !== shot.id), edges: later.edges }, later.updatedAt)
  assert.equal(gone.nodes.some(node => node.id === shot.id), false)
})

test('arrange does not move locked cards but still lays out the rest', async () => {
  const store = await newStore()
  const { shot } = await seedLocked(store)
  const after = await store.addNode({ kind: 'image', label: '自由镜头', x: 700, y: 500 })
  const free = after.nodes.find(node => node.label === '自由镜头')
  const arranged = await store.arrange('row')
  const locked = arranged.nodes.find(node => node.id === shot.id)
  const moved = arranged.nodes.find(node => node.id === free.id)
  assert.equal(locked.x, 10)
  assert.equal(locked.y, 20)
  assert.notEqual(moved.x, 700)
})

test('reset and snapshot restore are explicit user actions and may drop locked nodes', async () => {
  const store = await newStore()
  const { shot } = await seedLocked(store)
  await store.snapshot('before reset')
  const reset = await store.reset()
  assert.deepEqual(reset.nodes, [])
  // Restore puts the snapshot back, then reset again clears it regardless of lock.
  const restored = await store.restoreSnapshot((await store.readSnapshotsIndex())[0].id)
  assert.ok(restored.nodes.some(node => node.id === shot.id))
  const cleared = await store.reset()
  assert.deepEqual(cleared.nodes, [])
})