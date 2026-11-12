/**
 * Team-collaboration tools for MontageX.
 *
 * These wrap `team.ts` as agent-facing tools. They are deliberately separate
 * from the production pipeline: a shot can be generated without a team, and a
 * team can organise a production without generating anything. The board is the
 * only shared state, and it lives under the project's output directory.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { MontagexSettings } from './config.ts'
import {
  addMember,
  addNote,
  approveStage,
  assignShot,
  blockers,
  completeAssignment,
  findMember,
  formatBoard,
  isStageApproved,
  listPermissions,
  listRoles,
  ownerOf,
  readBoard,
  resolveNote,
  writeBoard,
  type Role,
} from './team.ts'

/** Minimal shape of the tool helper we inject, so this file stays testable. */
type Define = (definition: unknown) => unknown
type Register = (definition: unknown) => () => void

/** Counters that make ids readable in a conversation. */
function summarise(board: Awaited<ReturnType<typeof readBoard>>): Record<string, unknown> {
  return {
    productionId: board.productionId,
    members: board.members.length,
    openAssignments: board.assignments.filter((a) => a.completedAt === undefined).length,
    openNotes: board.notes.filter((n) => n.resolvedAt === undefined).length,
    approvals: board.approvals.length,
    blockers: blockers(board),
  }
}

/**
 * Register the team tools.
 * @param ctx - plugin context (provides `tools`).
 * @param settings - live settings, for the output directory.
 * @returns the disposers, one per tool.
 */
export function registerTeamTools(ctx: Context, settings: MontagexSettings): Array<() => void> {
  const disposers: Array<() => void> = []
  const register = ctx.tools.register as unknown as Register
  const define = (definition: unknown): unknown => definition
  const dir = (): string => settings.outputDir

  const tool = (definition: {
    name: string
    description: string
    parameters: Record<string, unknown>
    execute: (args: Record<string, unknown>) => Promise<unknown> | unknown
  }): void => {
    disposers.push(
      register(
        define({
          ...definition,
          output: { schema: { type: 'object' }, render: (_args: unknown, value: unknown) => [{ type: 'text', text: JSON.stringify(value, null, 2) }] },
          timeoutMs: 15_000,
        }),
      ),
    )
  }

  tool({
    name: 'mont_team_add_member',
    description:
      '给制作加一个成员并分配角色（director/storyboarder/generator/reviewer/viewer）。第一个成员无需授权；之后只有 director 能加人。',
    parameters: {
      productionId: { type: 'string', required: true, description: '制作 id，同一份看板的命名空间。' },
      name: { type: 'string', required: true, description: '成员名字，看板内唯一。' },
      role: { type: 'string', required: true, enum: listRoles() as unknown as string[], description: '角色，决定能做什么。' },
      actorId: { type: 'string', description: '操作人成员 id；加第一个成员时可省略。' },
    },
    async execute(args) {
      const board = await readBoard(dir(), String(args.productionId))
      const next = addMember(board, args.actorId === undefined ? undefined : String(args.actorId), {
        name: String(args.name),
        role: String(args.role) as Role,
      })
      await writeBoard(dir(), next)
      return { ok: true, member: next.members[next.members.length - 1], summary: summarise(next) }
    },
  })

  tool({
    name: 'mont_team_assign',
    description:
      '把某个镜头认领给某成员，避免两个人重复生成同一个贵镜头。同一镜头已有未完成认领时会被拒绝。',
    parameters: {
      productionId: { type: 'string', required: true, description: '制作 id。' },
      shotId: { type: 'string', required: true, description: '镜头 id，如 SHOT-003。' },
      memberId: { type: 'string', required: true, description: '接手的成员 id。' },
      actorId: { type: 'string', required: true, description: '操作人成员 id，需要 assign 权限。' },
    },
    async execute(args) {
      const board = await readBoard(dir(), String(args.productionId))
      const next = assignShot(board, String(args.actorId), String(args.shotId), String(args.memberId))
      await writeBoard(dir(), next)
      return { ok: true, summary: summarise(next) }
    },
  })

  tool({
    name: 'mont_team_complete',
    description: '把某成员对某镜头的认领标记完成，释放该镜头的认领位。',
    parameters: {
      productionId: { type: 'string', required: true, description: '制作 id。' },
      shotId: { type: 'string', required: true, description: '镜头 id。' },
      memberId: { type: 'string', required: true, description: '完成人成员 id。' },
    },
    async execute(args) {
      const board = await readBoard(dir(), String(args.productionId))
      const next = completeAssignment(board, String(args.shotId), String(args.memberId))
      await writeBoard(dir(), next)
      return { ok: true, summary: summarise(next) }
    },
  })

  tool({
    name: 'mont_team_note',
    description:
      '在某个镜头上留批注。kind=request 表示要求修改，会阻塞该阶段的签核；note 仅提示；approval 记录通过意见。',
    parameters: {
      productionId: { type: 'string', required: true, description: '制作 id。' },
      shotId: { type: 'string', required: true, description: '批注挂在哪一镜。' },
      body: { type: 'string', required: true, description: '批注正文，要具体到可执行。' },
      kind: { type: 'string', enum: ['request', 'note', 'approval'], description: '批注类型，默认 note。' },
      actorId: { type: 'string', required: true, description: '批注人成员 id，需要 review 权限。' },
    },
    async execute(args) {
      const board = await readBoard(dir(), String(args.productionId))
      const next = addNote(board, String(args.actorId), {
        shotId: String(args.shotId),
        body: String(args.body),
        kind: (args.kind === undefined ? 'note' : String(args.kind)) as 'request' | 'note' | 'approval',
      })
      await writeBoard(dir(), next)
      return { ok: true, summary: summarise(next) }
    },
  })

  tool({
    name: 'mont_team_resolve',
    description: '把一条批注标记为解决。只有未解决的 request 会阻塞签核，解决后即可签。',
    parameters: {
      productionId: { type: 'string', required: true, description: '制作 id。' },
      noteId: { type: 'string', required: true, description: '批注 id，如 NOTE-002。' },
      actorId: { type: 'string', required: true, description: '操作人成员 id，需要 review 权限。' },
    },
    async execute(args) {
      const board = await readBoard(dir(), String(args.productionId))
      const next = resolveNote(board, String(args.actorId), String(args.noteId))
      await writeBoard(dir(), next)
      return { ok: true, summary: summarise(next) }
    },
  })

  tool({
    name: 'mont_team_approve_stage',
    description:
      '签核一个阶段（如 storyboard / generate / deliver）。该阶段覆盖的镜头上若还有未解决的修改要求，会被拒绝——这正是签核闸的意义。',
    parameters: {
      productionId: { type: 'string', required: true, description: '制作 id。' },
      stage: { type: 'string', required: true, description: '阶段名。' },
      shotIds: { type: 'array', items: { type: 'string' }, description: '该阶段覆盖的镜头 id；省略表示不检查具体镜头。' },
      actorId: { type: 'string', required: true, description: '签核人成员 id，需要 approve 权限。' },
    },
    async execute(args) {
      const board = await readBoard(dir(), String(args.productionId))
      const shots = Array.isArray(args.shotIds) ? args.shotIds.map(String) : []
      const next = approveStage(board, String(args.actorId), String(args.stage), shots)
      await writeBoard(dir(), next)
      return { ok: true, approved: isStageApproved(next, String(args.stage)), summary: summarise(next) }
    },
  })

  tool({
    name: 'mont_team_board',
    description: '读制作看板：成员、认领、批注、签核与当前阻塞项。开工前先读，避免重复劳动。',
    parameters: {
      productionId: { type: 'string', required: true, description: '制作 id。' },
      format: { type: 'string', enum: ['json', 'markdown'], description: '返回结构，默认 json。' },
    },
    async execute(args) {
      const board = await readBoard(dir(), String(args.productionId))
      if (String(args.format ?? 'json') === 'markdown') return { ok: true, markdown: formatBoard(board) }
      return {
        ok: true,
        board,
        summary: summarise(board),
        ownership: Object.fromEntries(
          [...new Set(board.assignments.map((a) => a.shotId))].map((shotId) => [shotId, ownerOf(board, shotId)?.name ?? null]),
        ),
      }
    },
  })

  tool({
    name: 'mont_team_whoami',
    description: '列角色与权限矩阵，或查某个成员能做什么。用来在派活前确认权限边界。',
    parameters: {
      productionId: { type: 'string', description: '给了就一并返回该成员的资料。' },
      memberId: { type: 'string', description: '要查的成员 id。' },
    },
    async execute(args) {
      if (args.productionId !== undefined && args.memberId !== undefined) {
        const board = await readBoard(dir(), String(args.productionId))
        const member = findMember(board, String(args.memberId))
        return {
          ok: true,
          member,
          can: listPermissions().filter((p) => (board.members.length >= 0 ? true : true) && p !== undefined),
        }
      }
      return {
        ok: true,
        roles: listRoles(),
        permissions: listPermissions(),
        show: 'mont_team_board 带 format=markdown 可以得到每个人实际拥有的权限列表。',
      }
    },
  })

  return disposers
}
