import { MontagexSettingsSection } from './MontagexSettingsSection.tsx'
import { MontagexToolRow, MONT_TOOLVIEW_KEYS } from './MontagexToolRow.tsx'
import { EditorDock } from './EditorDock.tsx'
import { registerMontagexSlash } from './montagex-command.ts'
import { closeEditor, editorSnapshot, openCanvas, openDirectorStage, openEditor, setEditorTab } from './editor.ts'

interface LayoutFace {
  openDetails(): void
  closeDetails(): void
  toggleSidebar(): void
}

interface ClientContext {
  get(name: string): unknown
  inject?(deps: string[], callback: (ctx: ClientContext) => void): void
  slots: {
    inject(name: string, callback: () => (() => void) | void): void
    register(entry: {
      name: string
      id?: string
      key?: string
      order?: number
      label?: string
      priority?: number
      children?: Record<string, unknown>
      inject?: () => Record<string, unknown>
    }, component: unknown): () => void
  }
}

export const name = 'montagex-client'
// Scoped Remote namespaces are gated behind their own service names (reading
// `remote.session` without injecting it throws), and DSH 0.2.x provides the
// settings page seam through `configForms`/`settingsSchema`. `connection` is
// still injected because the media and editor endpoints ride the page origin.
export const inject = [
  'slots',
  'connection',
  'layout',
  'sessions',
  'remote',
  'remote.settings',
  'remote.session',
  'remote.workspace',
  'remote.commands',
  'configForms',
  'uiSession',
  'workspaces',
]

/** Settings namespace: the Loader row id, which is also the entry `configForms` keys on. */
export const SETTINGS_NAMESPACE = 'montagex'

/**
 * Loader row ids this package can appear under. A bundle mounted through the
 * profile's `include` tree is addressed as `include:montagex`; a direct row is
 * plain `montagex`. `configForms` keys on whichever id the Host actually used,
 * so read the first form that resolves instead of assuming one topology.
 */
const SETTINGS_NAMESPACE_CANDIDATES = ['montagex', 'include:montagex'] as const

/** The `ctx.configForms` face this plugin uses (DSH 0.2.x settings domain). */
interface ConfigFormSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: Record<string, unknown> | undefined
  base: unknown
  user: unknown
  revision: number | undefined
  writable: boolean
}

/** One Host entry's shared form: values plus revision-fenced writes. */
interface ConfigFormFace {
  getSnapshot(): ConfigFormSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
  unset(field: string): Promise<boolean>
  mutate(ops: readonly ConfigPathOp[], expectedRevision?: number): Promise<boolean>
}

interface ConfigPathOp {
  op: 'set' | 'unset'
  path: string[]
  value?: unknown
}

interface ConfigFormsFace {
  get<T>(entryId: string): ConfigFormFace
}

/**
 * Pick the Host entry whose form backs this settings page.
 *
 * `configForms.get()` is keyed by the Loader row id, which depends on how the
 * profile mounted the bundle (`montagex` for a direct row, `include:montagex`
 * inside the include tree). Try the known ids first, then fall back to a
 * listing when the service exposes one, so a renamed row still resolves.
 */
export function resolveSettingsForm(forms: ConfigFormsFace | undefined): ConfigFormFace | undefined {
  if (forms === undefined) return undefined
  for (const id of SETTINGS_NAMESPACE_CANDIDATES) {
    try {
      const form = forms.get<Record<string, unknown>>(id)
      if (form !== undefined && form !== null) return form
    } catch {
      // A rejected id is expected while probing; keep trying.
    }
  }
  const listing = forms as unknown as { list?: () => unknown; entries?: unknown }
  let rows: unknown
  try {
    rows = typeof listing.list === 'function' ? listing.list() : listing.entries
  } catch {
    rows = undefined
  }
  if (Array.isArray(rows)) {
    for (const row of rows) {
      if (row === null || typeof row !== 'object') continue
      const record = row as Record<string, unknown>
      const id = typeof record.id === 'string' ? record.id : typeof record.entryId === 'string' ? record.entryId : ''
      const name = typeof record.name === 'string' ? record.name : ''
      if (id === '') continue
      if (name !== 'dsh-montagex' && !id.endsWith(':montagex') && id !== 'montagex') continue
      try {
        const form = forms.get<Record<string, unknown>>(id)
        if (form !== undefined && form !== null) return form
      } catch {
        // Keep scanning.
      }
    }
  }
  return undefined
}

function optionalService(ctx: ClientContext, name: string): unknown {
  try {
    const rec = ctx as unknown as Record<string, unknown>
    return rec[name] ?? ctx.get(name)
  } catch {
    return undefined
  }
}

export function apply(ctx: ClientContext): void {
  const layout = (): LayoutFace | undefined => ctx.get('layout') as LayoutFace | undefined
  registerMontagexSlash(ctx)
  const uiSession = optionalService(ctx, 'uiSession') as { pendingInteractions?: unknown } | undefined
  const pending = uiSession?.pendingInteractions

  /**
   * One Settings page, reading and writing the `montagex` Host entry.
   *
   * DSH 0.2.x replaced the old browser settings mirror with `ctx.configForms`: a
   * live form per profile entry, derived from the settings service's describe
   * mirror, whose writes ride `remote.settings.mutate` with the namespace
   * revision as a fence. A page is a `settings.section` list entry; the former
   * Plugins-page item slot is gone, so the page registers here only.
   */
  const settingsCard = () => {
    const forms = optionalService(ctx, 'configForms') as ConfigFormsFace | undefined
    const form = resolveSettingsForm(forms)
    return ctx.slots.register({
      name: 'settings.section',
      id: 'montagex',
      order: 30,
      label: 'MontageX',
      inject: () => ({ form }),
    }, MontagexSettingsSection)
  }
  ctx.slots.inject('settings.section', () => settingsCard())

  // Keyed tool cards: each MontageX tool renders its own row in the chat
  // flow — the prompt/question while running, and the produced image/video/
  // audio (or the vision answer) inline once settled. Local media is served
  // by the host's `/montagex/media` route.
  ctx.slots.inject('tool.call.toolview', () => {
    const disposers = MONT_TOOLVIEW_KEYS.map(key =>
      ctx.slots.register({ name: 'tool.call.toolview', key }, MontagexToolRow),
    )
    return () => {
      for (const dispose of disposers) dispose()
    }
  })
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register({
      name: 'conversation.view',
      id: 'montagex-canvas',
      order: 40,
      label: 'MontageX 画布',
      inject: () => ({
        connection: optionalService(ctx, 'connection'),
        liveSessions: optionalService(ctx, 'sessions'),
        remote: optionalService(ctx, 'remote'),
        workspaces: optionalService(ctx, 'workspaces'),
        pending,
      }),
    }, EditorDock),
  )

  if (typeof window !== 'undefined' && window.__montagexEditor === undefined) {
    window.__montagexEditor = {
      open: (kind?: 'image' | 'video', path?: string) => {
        if (kind === 'image' || kind === 'video') openEditor(kind, path ?? '')
        else openCanvas()
      },
      openDirectorStage,
      close: () => { closeEditor() },
      setTab: (tab: 'image' | 'video' | 'canvas') => { setEditorTab(tab) },
      snapshot: () => {
        const current = editorSnapshot()
        return { open: current.open, tab: current.tab, kind: current.kind, path: current.path }
      },
      layoutKind: () => String(typeof layout()),
      openDetailsNow: () => layout()?.openDetails(),
      toggleSidebarNow: () => layout()?.toggleSidebar(),
    }
  }
}
