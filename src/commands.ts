import type { Context } from '@deepseek-ai/cordis'
import { formatProductionBoard, formatProposalList } from './board.ts'
import { MontagexCanvasStore } from './canvas.ts'
import { ProposalStore } from './proposals.ts'
import { formatCanvasShotlist } from './shotlist.ts'

/**
 * DSH human command plane (`ctx.commands`). `/montagex` is a direct UI
 * action: it does not become a model message and spends no tokens. Web slash
 * menu and TUI both list host commands via the official registry.
 */

export type MontagexCommandKind = 'board' | 'shotlist' | 'proposals' | 'next' | 'help'

export interface CommandResult {
  kind: 'success' | 'error'
  text: string
}

const USAGE = 'Usage: /montagex [shotlist|proposals|next]'

export function parseMontagexCommand(rawInput: string): MontagexCommandKind {
  const token = rawInput.trim().split(/\s+/)[0]?.toLowerCase() ?? ''
  if (token === '' || token === 'board') return 'board'
  if (token === 'shotlist') return 'shotlist'
  if (token === 'proposals') return 'proposals'
  if (token === 'next') return 'next'
  return 'help'
}

export async function runMontagexCommand(rawInput: string, outputDir: string): Promise<CommandResult> {
  const kind = parseMontagexCommand(rawInput)
  if (kind === 'help') {
    return { kind: 'error', text: `Unknown /montagex argument.\n${USAGE}` }
  }
  const canvas = new MontagexCanvasStore(outputDir)
  const store = new ProposalStore(outputDir)
  const [doc, proposals, next] = await Promise.all([canvas.read(), store.list(), store.next()])
  const shotlist = formatCanvasShotlist(doc)
  if (kind === 'shotlist') {
    return { kind: 'success', text: shotlist.markdown }
  }
  if (kind === 'proposals') {
    return { kind: 'success', text: formatProposalList(proposals) }
  }
  if (kind === 'next') {
    if (next === null) return { kind: 'success', text: 'No pending proposal. Queue one with mont_propose, then /montagex next.' }
    const spec = [next.model, next.size, next.duration === undefined ? '' : `${next.duration}s`].filter(part => part !== '').join(' · ')
    return {
      kind: 'success',
      text: [
        `${next.id} · ${next.status} · ${next.kind}`,
        spec,
        next.prompt,
        next.note ?? '',
        'Approve in the canvas or call mont_confirm.',
      ].filter(line => line !== '').join('\n'),
    }
  }
  const board = formatProductionBoard({ shotlist, proposals, next })
  return { kind: 'success', text: board.markdown }
}

export function registerMontagexCommands(ctx: Context, getOutputDir: () => string): () => void {
  ctx.inject(['commands'], (commandCtx) => {
    const commands = commandCtx.commands
    if (commands === undefined) throw new Error('montagex commands inject ran without ctx.commands')
    commands.register({
      name: 'montagex',
      description: 'MontageX production board (shot list + proposal queue). Direct UI, no model tokens.',
      input: { hint: '[shotlist|proposals|next]' },
      handler: async ({ rawInput }) => runMontagexCommand(rawInput, getOutputDir()),
    })
  })
  return () => {}
}
