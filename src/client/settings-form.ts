/**
 * Pure helper for the MontageX Settings page.
 *
 * `configForms.get()` is keyed by the Loader row id, and that id depends on
 * how the profile mounted the bundle: a direct row is `montagex`, while a row
 * inside the profile's include tree is `include:montagex`. Resolving the form
 * here keeps the page free of transport details and lets the mapping be
 * unit-tested without a browser.
 */

/** The `ctx.configForms` face this plugin uses (DSH 0.2.x settings domain). */
export interface ConfigFormSnapshot {
  status: 'loading' | 'ready' | 'unavailable'
  value: Record<string, unknown> | undefined
  base: unknown
  user: unknown
  revision: number | undefined
  writable: boolean
}

export interface ConfigPathOp {
  op: 'set' | 'unset'
  path: string[]
  value?: unknown
}

/** One Host entry's shared form: values plus revision-fenced writes. */
export interface ConfigFormFace {
  getSnapshot(): ConfigFormSnapshot
  subscribe(listener: () => void): () => void
  set(field: string, value: unknown): Promise<boolean>
  unset(field: string): Promise<boolean>
  mutate(ops: readonly ConfigPathOp[], expectedRevision?: number): Promise<boolean>
}

export interface ConfigFormsFace {
  get<T>(entryId: string): ConfigFormFace
}

export const SETTINGS_NAMESPACE = 'montagex'

/**
 * Loader row ids this package can appear under, in probe order.
 * Add a new topology here rather than guessing in the page.
 */
export const SETTINGS_NAMESPACE_CANDIDATES = ['montagex', 'include:montagex'] as const

/**
 * Pick the Host entry whose form backs this settings page.
 *
 * Probes the known ids first, then falls back to a listing when the service
 * exposes one, so a renamed row still resolves. A rejected id while probing
 * is expected and must not abort the search.
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
  if (!Array.isArray(rows)) return undefined
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
  return undefined
}