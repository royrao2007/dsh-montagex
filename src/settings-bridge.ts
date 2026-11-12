import type { Context } from '@deepseek-ai/cordis'
import type { MontagexSettings } from './config.ts'

/**
 * Bridge between DSH 0.2.x volatile Config references and the plain
 * `MontagexSettings` snapshot the rest of the plugin consumes.
 *
 * DSH 0.2.x removed `ctx.settings.register`. A plugin's own configuration now
 * arrives as the resolved Config handed to `apply(ctx, config)`; fields
 * declared `.volatile()` arrive as `cosmokit` references (`{ get() }`) that
 * the Loader rewrites in place when the Settings page saves, so no remount
 * happens and no tool registrations are dropped. Fields left plain stay plain
 * values and can only change by remounting the plugin.
 *
 * These helpers keep the seam in one place: everything downstream still sees
 * an immutable `MontagexSettings`.
 */

/** A `cosmokit` volatile reference: a readable snapshot the Loader rewrites. */
interface VolatileRef<T = unknown> {
  get(): T
}

function isVolatileRef(value: unknown): value is VolatileRef {
  return typeof value === 'object' && value !== null && typeof (value as { get?: unknown }).get === 'function'
}

/** Unwrap one config node, whether the Loader turned it into a reference or not. */
function unwrap<T>(value: T | VolatileRef<T>): T {
  return isVolatileRef(value) ? value.get() : (value as T)
}

/** Capability keys, in the order the Settings page presents them. */
export const CAPABILITY_KEYS = ['vision', 'image', 'video', 'audio'] as const

/** Every field `readSettings` copies, for callers that need an explicit list. */
export type MontagexSettingsShape = MontagexSettings

/**
 * Fold the live Config references into one plain, immutable snapshot.
 * @param config - the resolved Config DSH passed to `apply`.
 * @returns a detached settings value safe to hand to tools and routes.
 */
export function readSettings(config: MontagexSettings): MontagexSettings {
  return {
    outputDir: unwrap(config.outputDir),
    timeoutMs: unwrap(config.timeoutMs),
    pollIntervalMs: unwrap(config.pollIntervalMs),
    maxPollAttempts: unwrap(config.maxPollAttempts),
    persona: unwrap(config.persona),
    initiative: unwrap(config.initiative),
    vision: structuredClone(unwrap(config.vision)),
    image: structuredClone(unwrap(config.image)),
    video: structuredClone(unwrap(config.video)),
    audio: structuredClone(unwrap(config.audio)),
  }
}

/**
 * Identity of a settings snapshot, for cheap change detection. The tool set and
 * the system prompt are derived from these values, so this signature decides
 * whether a re-registration is actually required.
 * @param settings - snapshot to fingerprint.
 * @returns a stable string that changes exactly when the snapshot does.
 */
export function settingsSignature(settings: MontagexSettings): string {
  return JSON.stringify(settings)
}

/**
 * Re-derive the tool set and system prompt whenever the Settings page saves a
 * change (or the profile patch is edited by any other means).
 *
 * `settings/document-updated` is DSH's own notification that a profile entry's
 * form values changed; the Settings service emits it from `describe()`, which
 * it calls after every accepted write. We filter on our own entry id and only
 * re-register when a value we actually consume moved, so an unrelated entry's
 * edit costs one string compare.
 *
 * @param ctx - plugin context, used for the event subscription and the entry id.
 * @param config - live Config references to re-read.
 * @param onChange - installs the tools and prompt for a new snapshot.
 * @returns the disposer that ends the subscription.
 */
export function watchSettings(
  ctx: Context,
  config: MontagexSettings,
  onChange: (settings: MontagexSettings) => void,
): () => void {
  const entryId = currentEntryId(ctx)
  let last = settingsSignature(readSettings(config))
  const listener = (namespace: unknown): void => {
    if (entryId !== undefined && String(namespace) !== entryId) return
    const next = readSettings(config)
    const signature = settingsSignature(next)
    if (signature === last) return
    last = signature
    onChange(next)
  }
  // Cordis types `ctx.on` through the Events registry; the event is declared by
  // @deepseek-ai/dsh-settings, which this plugin does not depend on for types.
  const on = ctx.on as unknown as (event: string, listener: (namespace: unknown, revision: number) => void) => () => void
  return on.call(ctx, 'settings/document-updated', listener)
}

/**
 * The Loader row id backing this plugin instance, which is also the settings
 * namespace `settings.describe` reports.
 * @param ctx - plugin context.
 * @returns the entry id, or undefined when the context carries no Loader row.
 */
export function currentEntryId(ctx: Context): string | undefined {
  const entry = (ctx as unknown as { fiber?: { entry?: { options?: { id?: unknown } } } }).fiber?.entry
  const id = entry?.options?.id
  return typeof id === 'string' && id !== '' ? id : undefined
}

/**
 * Persist this plugin row's own configuration through DSH's configuration
 * editor, which owns schema validation, write serialization and profile
 * layering (a home patch or command-line overlay still wins).
 * @param ctx - plugin context whose fiber identifies the Loader row to edit.
 * @param change - receives the row's complete current config, returns the next.
 * @returns fulfillment once the profile write settled.
 */
export async function persistEntryConfig(
  ctx: Context,
  change: (current: Record<string, unknown>) => Record<string, unknown>,
): Promise<void> {
  const entry = (ctx as unknown as { fiber?: { entry?: unknown } }).fiber?.entry
  const editor = ctx.get('configEditor') as
    | { edit(entry: unknown, change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>): Promise<void> }
    | undefined
  if (entry === undefined || editor === undefined) {
    throw new Error('MontageX 无法保存配置：当前 profile 没有可写的配置编辑器（需要 configEditor 服务）。')
  }
  await editor.edit(entry, current => change(current))
}
