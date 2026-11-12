import test from 'node:test'
import assert from 'node:assert/strict'
import {
  addMember,
  addNote,
  approveStage,
  assignShot,
  blockers,
  completeAssignment,
  emptyBoard,
  formatBoard,
  isStageApproved,
  listPermissions,
  listRoles,
  ownerOf,
  readBoard,
  resolveNote,
  roleCan,
  writeBoard,
} from '../lib/testing.js'

test('the first member needs no authority, later members need manage', () => {
  let board = emptyBoard('p1')
  board = addMember(board, undefined, { name: '导演', role: 'director' })
  assert.equal(board.members.length, 1)
  assert.equal(board.members[0].id, 'MEM-001')

  // A viewer cannot add people; the director can.
  board = addMember(board, 'MEM-001', { name: '旁白', role: 'viewer' })
  assert.throws(() => addMember(board, 'MEM-002', { name: '剪辑', role: 'generator' }), /没有 manage 权限/)
  board = addMember(board, 'MEM-001', { name: '剪辑', role: 'generator' })
  assert.equal(board.members.length, 3)
})

test('role grants are what the matrix says', () => {
  assert.deepEqual(listRoles(), ['director', 'storyboarder', 'generator', 'reviewer', 'viewer'])
  assert.ok(roleCan('director', 'approve'))
  assert.ok(roleCan('reviewer', 'approve'))
  assert.ok(!roleCan('generator', 'approve'))
  assert.ok(roleCan('storyboarder', 'plan'))
  assert.ok(!roleCan('storyboarder', 'generate'))
  assert.ok(!roleCan('viewer', 'review'))
  // Every declared permission is granted to at least one role.
  for (const permission of listPermissions()) {
    assert.ok(listRoles().some((role) => roleCan(role, permission)), `${permission} 没有任何角色拥有`)
  }
})

test('duplicate names and empty names are refused', () => {
  let board = addMember(emptyBoard('p1'), undefined, { name: '导演', role: 'director' })
  assert.throws(() => addMember(board, 'MEM-001', { name: '导演', role: 'viewer' }), /已存在/)
  assert.throws(() => addMember(board, 'MEM-001', { name: '  ', role: 'viewer' }), /不能为空/)
})

test('a shot can only be claimed by one person at a time', () => {
  let board = emptyBoard('p1')
  board = addMember(board, undefined, { name: '导演', role: 'director' })
  board = addMember(board, 'MEM-001', { name: '剪辑', role: 'generator' })
  board = assignShot(board, 'MEM-001', 'SHOT-001', 'MEM-002')

  assert.equal(ownerOf(board, 'SHOT-001')?.name, '剪辑')
  // Second claim on the same shot is refused while the first is open.
  assert.throws(() => assignShot(board, 'MEM-001', 'SHOT-001', 'MEM-001'), /已经有未完成的负责人/)

  const done = completeAssignment(board, 'SHOT-001', 'MEM-002')
  assert.equal(ownerOf(done, 'SHOT-001'), undefined)
  // Once complete, the shot can be re-assigned.
  const again = assignShot(done, 'MEM-001', 'SHOT-001', 'MEM-001')
  assert.equal(ownerOf(again, 'SHOT-001')?.name, '导演')
})

test('a viewer cannot assign shots', () => {
  let board = emptyBoard('p1')
  board = addMember(board, undefined, { name: '导演', role: 'director' })
  board = addMember(board, 'MEM-001', { name: '路人', role: 'viewer' })
  assert.throws(() => assignShot(board, 'MEM-002', 'SHOT-001', 'MEM-001'), /没有 assign 权限/)
})

test('unresolved change requests block stage approval', () => {
  let board = emptyBoard('p1')
  board = addMember(board, undefined, { name: '导演', role: 'director' })
  board = addMember(board, 'MEM-001', { name: '审片', role: 'reviewer' })

  board = addNote(board, 'MEM-002', { shotId: 'SHOT-002', body: '这一镜曝光过了', kind: 'request' })
  assert.equal(board.notes[0].id, 'NOTE-001')

  // The gate refuses while the request is open.
  assert.throws(() => approveStage(board, 'MEM-002', 'storyboard', ['SHOT-002']), /未解决的修改要求/)

  const resolved = resolveNote(board, 'MEM-002', 'NOTE-001')
  const approved = approveStage(resolved, 'MEM-002', 'storyboard', ['SHOT-002'])
  assert.ok(isStageApproved(approved, 'storyboard'))
  // Approvals are per stage and do not leak to another stage.
  assert.ok(!isStageApproved(approved, 'deliver'))
})

test('an informational note does not block approval', () => {
  let board = emptyBoard('p1')
  board = addMember(board, undefined, { name: '导演', role: 'director' })
  board = addNote(board, 'MEM-001', { shotId: 'SHOT-001', body: '这一镜保留', kind: 'note' })
  const approved = approveStage(board, 'MEM-001', 'generate', ['SHOT-001'])
  assert.ok(isStageApproved(approved, 'generate'))
})

test('blockers list both open change requests and open claims', () => {
  let board = emptyBoard('p1')
  board = addMember(board, undefined, { name: '导演', role: 'director' })
  board = addMember(board, 'MEM-001', { name: '剪辑', role: 'generator' })
  board = assignShot(board, 'MEM-001', 'SHOT-001', 'MEM-002')
  board = addNote(board, 'MEM-001', { shotId: 'SHOT-002', body: '换一个景别', kind: 'request' })

  const list = blockers(board)
  assert.equal(list.length, 2)
  assert.ok(list.some((b) => b.includes('SHOT-001') && b.includes('等')))
  assert.ok(list.some((b) => b.includes('SHOT-002') && b.includes('要求修改')))
})

test('board text shows the matrix without throwing on any role', () => {
  let board = emptyBoard('p1')
  board = addMember(board, undefined, { name: '导演', role: 'director' })
  for (const role of listRoles()) {
    board = addMember(board, 'MEM-001', { name: `成员-${role}`, role })
  }
  const text = formatBoard(board)
  assert.match(text, /制作看板 · p1/)
  assert.match(text, /成员 6/)
  assert.match(text, /只读/)
})

test('a board round-trips through disk atomically', async () => {
  const { mkdtemp } = await import('node:fs/promises')
  const { tmpdir } = await import('node:os')
  const { join } = await import('node:path')
  const dir = await mkdtemp(join(tmpdir(), 'montagex-team-'))

  assert.deepEqual((await readBoard(dir, 'missing')).members, [])

  let board = emptyBoard('p1')
  board = addMember(board, undefined, { name: '导演', role: 'director' })
  const path = await writeBoard(dir, board)
  assert.match(path.replace(/\\/g, '/'), /\/team\/p1\.json$/)

  const back = await readBoard(dir, 'p1')
  assert.equal(back.members.length, 1)
  assert.equal(back.members[0].name, '导演')
})
