/**
 * Team collaboration for MontageX.
 *
 * A production is rarely one person's work: a director sets intent, a
 * storyboarder cuts shots, a generator runs the expensive calls, and someone
 * else signs off. This module adds that layer on top of the existing pipeline
 * without touching it:
 *
 * - **Roles** decide who may do what.
 * - **Assignments** bind a person to a shot so two people never generate the
 *   same expensive clip.
 * - **Review notes** are comments anchored to a shot id, so feedback lands on
 *   the thing it is about rather than in a chat log.
 * - **Approval gates** stop a production from advancing until someone with the
 *   right role has signed.
 *
 * Everything is plain data written under the project's output directory, so a
 * team can share a folder (or a git repo) and see the same board.
 */
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

/** Roles a production member can hold. */
export const ROLES = ['director', 'storyboarder', 'generator', 'reviewer', 'viewer'] as const
export type Role = (typeof ROLES)[number]

/** What each role may do. Order is intentional: later roles are subsets. */
const ROLE_GRANTS: Record<Role, readonly Permission[]> = {
  director: ['plan', 'assign', 'generate', 'review', 'approve', 'deliver', 'manage'],
  storyboarder: ['plan', 'assign', 'review'],
  generator: ['generate', 'review'],
  reviewer: ['review', 'approve'],
  viewer: [],
}

/** A capability a member may exercise. */
export const PERMISSIONS = ['plan', 'assign', 'generate', 'review', 'approve', 'deliver', 'manage'] as const
export type Permission = (typeof PERMISSIONS)[number]

/** One person on a production. */
export interface Member {
  readonly id: string
  readonly name: string
  readonly role: Role
  readonly addedAt: number
}

/** A shot assigned to someone. */
export interface Assignment {
  readonly shotId: string
  readonly memberId: string
  readonly assignedAt: number
  /** Set once the assignee marks the shot done. */
  readonly completedAt?: number
}

/** A review comment anchored to a shot. */
export interface ReviewNote {
  readonly id: string
  readonly shotId: string
  readonly memberId: string
  readonly body: string
  readonly createdAt: number
  /** `request` asks for a change; `note` is informational. */
  readonly kind: 'request' | 'note' | 'approval'
  readonly resolvedAt?: number
}

/** The state that gates a stage for the whole production. */
export interface Approval {
  readonly stage: string
  readonly memberId: string
  readonly approvedAt: number
}

/** The whole collaboration record for one production. */
export interface TeamBoard {
  readonly productionId: string
  readonly members: readonly Member[]
  readonly assignments: readonly Assignment[]
  readonly notes: readonly ReviewNote[]
  readonly approvals: readonly Approval[]
  readonly updatedAt: number
}

/** Empty board for a new production. */
export function emptyBoard(productionId: string): TeamBoard {
  return { productionId, members: [], assignments: [], notes: [], approvals: [], updatedAt: Date.now() }
}

/**
 * Whether a role grants a permission.
 * @param role - the member's role.
 * @param permission - the action being attempted.
 * @returns true when the role may do it.
 */
export function roleCan(role: Role, permission: Permission): boolean {
  return ROLE_GRANTS[role]?.includes(permission) ?? false
}

/** Deterministic id from a prefix and a counter, so boards diff cleanly. */
export function nextId(prefix: string, existing: readonly { id: string }[]): string {
  const used = new Set(existing.map((e) => e.id))
  for (let i = 1; ; i += 1) {
    const candidate = `${prefix}-${String(i).padStart(3, '0')}`
    if (!used.has(candidate)) return candidate
  }
}

/** Raised when someone attempts an action their role forbids. */
export class PermissionError extends Error {
  constructor(memberId: string, permission: Permission) {
    super(`成员 ${memberId} 没有 ${permission} 权限`)
    this.name = 'PermissionError'
  }
}

/**
 * Add a member. Only a `manage` holder may do this.
 * @param board - current board.
 * @param actorId - who is acting.
 * @param input - the new member's name and role.
 * @returns a new board.
 */
export function addMember(
  board: TeamBoard,
  actorId: string | undefined,
  input: { name: string; role: Role },
): TeamBoard {
  // A brand-new board has no one to authorise the first member.
  if (board.members.length > 0) requirePermission(board, actorId, 'manage')
  const name = input.name.trim()
  if (name === '') throw new Error('成员名字不能为空')
  if (board.members.some((m) => m.name === name)) throw new Error(`成员 ${name} 已存在`)
  const member: Member = { id: nextId('MEM', board.members), name, role: input.role, addedAt: Date.now() }
  return { ...board, members: [...board.members, member], updatedAt: Date.now() }
}

/** Look up a member, throwing a useful error when absent. */
export function findMember(board: TeamBoard, memberId: string): Member {
  const member = board.members.find((m) => m.id === memberId)
  if (member === undefined) throw new Error(`没有成员 ${memberId}`)
  return member
}

/** Throw unless the actor exists and their role grants the permission. */
function requirePermission(board: TeamBoard, actorId: string | undefined, permission: Permission): Member {
  if (actorId === undefined) throw new Error(`需要 ${permission} 权限，但未指定操作人`)
  const member = findMember(board, actorId)
  if (!roleCan(member.role, permission)) throw new PermissionError(member.id, permission)
  return member
}

/**
 * Assign a shot to a member.
 * @param board - current board.
 * @param actorId - who is acting.
 * @param shotId - the shot.
 * @param memberId - the assignee.
 * @returns a new board.
 */
export function assignShot(
  board: TeamBoard,
  actorId: string | undefined,
  shotId: string,
  memberId: string,
): TeamBoard {
  requirePermission(board, actorId, 'assign')
  findMember(board, memberId)
  if (board.assignments.some((a) => a.shotId === shotId && a.completedAt === undefined)) {
    throw new Error(`${shotId} 已经有未完成的负责人，先完成或改成未认领`)
  }
  const assignment: Assignment = { shotId, memberId, assignedAt: Date.now() }
  return { ...board, assignments: [...board.assignments, assignment], updatedAt: Date.now() }
}

/** Mark a shot's assignment complete. */
export function completeAssignment(board: TeamBoard, shotId: string, memberId: string): TeamBoard {
  let touched = false
  const assignments = board.assignments.map((a) => {
    if (a.shotId !== shotId || a.memberId !== memberId || a.completedAt !== undefined) return a
    touched = true
    return { ...a, completedAt: Date.now() }
  })
  if (!touched) throw new Error(`${shotId} 没有 ${memberId} 的未完成认领`)
  return { ...board, assignments, updatedAt: Date.now() }
}

/** Who currently owns a shot. */
export function ownerOf(board: TeamBoard, shotId: string): Member | undefined {
  const open = board.assignments.find((a) => a.shotId === shotId && a.completedAt === undefined)
  return open === undefined ? undefined : board.members.find((m) => m.id === open.memberId)
}

/**
 * Leave a review note on a shot.
 * @param board - current board.
 * @param actorId - who is commenting.
 * @param input - shot, body and note kind.
 * @returns a new board.
 */
export function addNote(
  board: TeamBoard,
  actorId: string | undefined,
  input: { shotId: string; body: string; kind?: 'request' | 'note' | 'approval' },
): TeamBoard {
  requirePermission(board, actorId, 'review')
  const body = input.body.trim()
  if (body === '') throw new Error('批注内容不能为空')
  if (board.notes.some((n) => n.shotId === input.shotId) === false && input.shotId.trim() === '') {
    throw new Error('批注必须挂在某个镜头上')
  }
  const note: ReviewNote = {
    id: nextId('NOTE', board.notes),
    shotId: input.shotId,
    memberId: actorId!,
    body,
    createdAt: Date.now(),
    kind: input.kind ?? 'note',
  }
  return { ...board, notes: [...board.notes, note], updatedAt: Date.now() }
}

/** Resolve a note. */
export function resolveNote(board: TeamBoard, actorId: string | undefined, noteId: string): TeamBoard {
  requirePermission(board, actorId, 'review')
  let touched = false
  const notes = board.notes.map((n) => {
    if (n.id !== noteId || n.resolvedAt !== undefined) return n
    touched = true
    return { ...n, resolvedAt: Date.now() }
  })
  if (!touched) throw new Error(`批注 ${noteId} 不存在或已解决`)
  return { ...board, notes, updatedAt: Date.now() }
}

/**
 * Sign off a stage. Blocked while any change request on that stage's shots is
 * still open — that is the whole point of having gates.
 * @param board - current board.
 * @param actorId - who approves.
 * @param stage - stage name being signed.
 * @param shotIds - shots the stage covers.
 * @returns a new board.
 */
export function approveStage(
  board: TeamBoard,
  actorId: string | undefined,
  stage: string,
  shotIds: readonly string[],
): TeamBoard {
  requirePermission(board, actorId, 'approve')
  const open = board.notes.filter(
    (n) => n.kind === 'request' && n.resolvedAt === undefined && shotIds.includes(n.shotId),
  )
  if (open.length > 0) {
    throw new Error(
      `${stage} 不能签核：还有 ${open.length} 条未解决的修改要求（${open.map((n) => n.id).join(', ')}）`,
    )
  }
  const approvals = board.approvals.filter((a) => a.stage !== stage)
  approvals.push({ stage, memberId: actorId!, approvedAt: Date.now() })
  return { ...board, approvals, updatedAt: Date.now() }
}

/** Whether a stage has been signed. */
export function isStageApproved(board: TeamBoard, stage: string): boolean {
  return board.approvals.some((a) => a.stage === stage)
}

/**
 * Everything blocking progress, in the order it should be handled.
 * @param board - current board.
 * @returns human-readable blockers; empty means the board is clear.
 */
export function blockers(board: TeamBoard): readonly string[] {
  const out: string[] = []
  for (const note of board.notes) {
    if (note.kind === 'request' && note.resolvedAt === undefined) {
      const member = board.members.find((m) => m.id === note.memberId)
      out.push(`${note.shotId}: ${member?.name ?? note.memberId} 要求修改 —— ${note.body}`)
    }
  }
  for (const assignment of board.assignments) {
    if (assignment.completedAt !== undefined) continue
    const member = board.members.find((m) => m.id === assignment.memberId)
    out.push(`${assignment.shotId}: 等 ${member?.name ?? assignment.memberId} 完成`)
  }
  return out
}

/** The board as a readable table for the agent to show a human. */
export function formatBoard(board: TeamBoard): string {
  const memberRows = board.members.map(
    (m) => `| ${m.id} | ${m.name} | ${m.role} | ${Object.entries(ROLE_GRANTS).length >= 0 ? PERMISSIONS.filter((p) => roleCan(m.role, p)).join(', ') || '只读' : ''} |`,
  )
  const openNotes = board.notes.filter((n) => n.resolvedAt === undefined)
  return [
    `# 制作看板 · ${board.productionId}`,
    '',
    `成员 ${board.members.length} · 认领 ${board.assignments.filter((a) => a.completedAt === undefined).length} 进行中 · 未解决批注 ${openNotes.length} · 已签核阶段 ${board.approvals.length}`,
    '',
    '## 成员',
    '| id | 名字 | 角色 | 权限 |',
    '| --- | --- | --- | --- |',
    ...memberRows,
    '',
    '## 待办',
    ...(blockers(board).length === 0 ? ['（无阻塞）'] : blockers(board).map((b) => `- ${b}`)),
  ].join('\n')
}

/** Where a board lives inside a project. */
export function boardPath(outputDir: string, productionId: string): string {
  return join(resolve(outputDir), 'team', `${productionId}.json`)
}

/**
 * Read a production's board, or an empty one when it does not exist yet.
 * @param outputDir - the media output directory.
 * @param productionId - which production.
 * @returns the board.
 */
export async function readBoard(outputDir: string, productionId: string): Promise<TeamBoard> {
  const path = boardPath(outputDir, productionId)
  try {
    const raw = await readFile(path, 'utf8')
    return JSON.parse(raw) as TeamBoard
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyBoard(productionId)
    throw error
  }
}

/**
 * Write a board atomically: a reader never sees a half-written file.
 * @param outputDir - the media output directory.
 * @param board - the board to persist.
 * @returns the path written.
 */
export async function writeBoard(outputDir: string, board: TeamBoard): Promise<string> {
  const path = boardPath(outputDir, board.productionId)
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.tmp`
  await writeFile(temp, JSON.stringify({ ...board, updatedAt: Date.now() }, null, 2), 'utf8')
  await rename(temp, path)
  return path
}

/** Every role we accept. */
export function listRoles(): readonly Role[] {
  return ROLES
}

/** Every permission we recognise. */
export function listPermissions(): readonly Permission[] {
  return PERMISSIONS
}
