import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-tools'
import type {} from '@deepseek-ai/dsh-skill'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { MontagexSettings, SETTINGS_NS, type MontagexSettings as MontagexSettingsType } from './config.ts'
import { corpus } from './corpus.ts'
import { registerCanvasCraftRoute, registerCanvasIntentRoute, registerCanvasResetRoute, registerCanvasRestoreRoute, registerCanvasRoute, registerCanvasSnapshotsRoute, registerCharactersRoute, registerMediaEditsRoute, registerMediaListRoute, registerMediaRoute, registerMediaTasksRoute, registerProjectsRoute, registerProposalsRoute, registerProposalUpdateRoute, registerStudioRoute, registerVendorRoute } from './media-server.ts'
import { registerCanvasGenerateRoute } from './canvas-job.ts'
import { registerBundledSkills } from './skills.ts'
import { registerSettingsTestRoute } from './settings-test.ts'
import { registerMcpRoute } from './mcp.ts'
import { registerMontagexCommands } from './commands.ts'
import { registerSubagentSetup } from './subagents.ts'
import { registerSystemPrompt, syncTools } from './tools.ts'
import { registerStageRoutes } from './stage-server.ts'
import { registerEditRoutes } from './edit-server.ts'

import { registerAdaptersRoute } from './adapters-route.ts'
import type { AdapterCapability } from './providers/adapter-spec.ts'
import type { CapabilitySettings } from './config.ts'
import { readSettings, watchSettings, persistEntryConfig } from './settings-bridge.ts'

export { corpus, knowledgeProviders, registerKnowledgeProvider } from './corpus.ts'
export type { KnowledgeArticle, KnowledgeProvider, KnowledgeSearchHit, KnowledgeSearchOptions } from './corpus.ts'
export { runAudio, mockAudio } from './providers/audio.ts'
export { runImage, mockImage } from './providers/image.ts'
export { runVideo, mockVideo } from './providers/video.ts'
export { runVision, mockVision } from './providers/vision.ts'

export const name = 'montagex'
// `webServer` must be here: every register*Route helper looks it up with
// ctx.get('webServer') and returns a no-op disposer when it is absent. Without
// the injection the plugin applies before the HTTP service exists, so all
// /montagex/* routes are never registered and every browser request answers
// 404 with an empty body — which the client surfaces as "Unexpected end of
// JSON input" rather than a visible failure.
//
// `configEditor` belongs here too: persisting a settings change needs the
// profile's config editor, and its absence is what makes a save fail after the
// UI has already shown the new value. Injecting it guarantees the service is
// present before apply() runs, instead of racing the loader.
//
// `workspace` and `subagents` are deliberately NOT injected: both are optional
// integrations with documented fallbacks (disk scan / graceful degradation), and
// waiting on them would delay the plugin for features it can live without.
export const inject = ['tools', 'skills', 'systemPrompt', 'settings', 'llm', 'webServer', 'configEditor']

/**
 * The plugin's own Config. DSH 0.2.x resolves this from the Loader row and
 * hands the result to `apply(ctx, config)`; live fields arrive as
 * `cosmokit` volatile references (see `.volatile()` in `config.ts`), so the
 * plugin re-registers its tools when one changes instead of being remounted.
 */
export const Config = MontagexSettings

export function apply(ctx: Context, config: MontagexSettingsType): void {
  corpus.setRoot(fileURLToPath(new URL('../knowledge/', import.meta.url)))

  // `readSettings` folds the volatile references into a plain snapshot; every
  // consumer below keeps taking an immutable MontagexSettings, exactly as
  // before the settings seam changed.
  const current = (): MontagexSettingsType => readSettings(config)

  // The four capability profiles stay declared as configurable providers so
  // the Models page can address the same `montagex` namespace.
  const llm = ctx.get('llm') as
    | {
        registerConfigurableProviders(entries: Array<{
          provider: string
          displayName: string
          settingsNs: string
          settingsPath: readonly string[]
          declared?: boolean
        }>): unknown
      }
    | undefined
  llm?.registerConfigurableProviders([
    { provider: 'montagex-vision', displayName: 'MontageX Vision', settingsNs: SETTINGS_NS, settingsPath: ['vision'], declared: true },
    { provider: 'montagex-image', displayName: 'MontageX Image', settingsNs: SETTINGS_NS, settingsPath: ['image'], declared: true },
    { provider: 'montagex-video', displayName: 'MontageX Video', settingsNs: SETTINGS_NS, settingsPath: ['video'], declared: true },
    { provider: 'montagex-audio', displayName: 'MontageX Audio', settingsNs: SETTINGS_NS, settingsPath: ['audio'], declared: true },
  ])

  let disposeTools: (() => void) | undefined
  let disposePrompt: (() => void) | undefined

  /**
   * Persist a capability patch through DSH's configuration editor. The write
   * goes to the profile patch for this very Loader row, then the loader
   * commits the volatile values into our live references.
   */
  const applyCapability = async (capability: AdapterCapability, patch: Partial<CapabilitySettings>): Promise<void> => {
    const previous = current()[capability]
    const next: CapabilitySettings = {
      ...previous,
      ...patch,
      auth: { ...previous.auth, ...(patch.auth ?? {}) },
    }
    await persistEntryConfig(ctx, (row) => {
      const existing = row[capability]
      const base = existing !== null && typeof existing === 'object' ? existing as Record<string, unknown> : {}
      return { ...row, [capability]: { ...base, ...next } }
    })
  }

  const sync = (settings: MontagexSettingsType): void => {
    disposeTools?.()
    disposePrompt?.()
    disposeTools = syncTools(ctx, settings, applyCapability, defineTool)
    disposePrompt = registerSystemPrompt(ctx, settings)
  }

  sync(current())
  ctx.effect(() => registerStageRoutes(ctx, current), 'montagex director stage route')
  ctx.effect(() => registerEditRoutes(ctx), 'montagex edit stage route')
  ctx.effect(() => watchSettings(ctx, config, sync), 'montagex settings watch')
  ctx.effect(() => registerMediaRoute(ctx, () => current().outputDir), 'montagex media route')
  ctx.effect(() => registerMediaEditsRoute(ctx, () => current().outputDir), 'montagex media edits route')
  ctx.effect(() => registerMediaTasksRoute(ctx, () => current().outputDir), 'montagex media tasks route')
  ctx.effect(() => registerMediaListRoute(ctx, () => current().outputDir), 'montagex media list route')
  ctx.effect(() => registerProjectsRoute(ctx), 'montagex projects route')
  ctx.effect(() => registerCanvasRoute(ctx, () => current().outputDir), 'montagex canvas route')
  ctx.effect(() => registerCanvasResetRoute(ctx, () => current().outputDir), 'montagex canvas reset route')
  ctx.effect(() => registerCanvasSnapshotsRoute(ctx, () => current().outputDir), 'montagex canvas snapshots route')
  ctx.effect(() => registerCanvasRestoreRoute(ctx, () => current().outputDir), 'montagex canvas restore route')
  ctx.effect(() => registerCanvasIntentRoute(ctx, () => current().outputDir), 'montagex canvas intent route')
  ctx.effect(() => registerCanvasCraftRoute(ctx, () => current().outputDir), 'montagex canvas craft route')
  ctx.effect(() => registerCanvasGenerateRoute(ctx, current), 'montagex canvas generate route')
  ctx.effect(() => registerCharactersRoute(ctx, () => current().outputDir), 'montagex characters route')
  ctx.effect(() => registerStudioRoute(ctx, () => current().outputDir), 'montagex studio route')
  ctx.effect(() => registerVendorRoute(ctx), 'montagex vendor assets route')
  ctx.effect(() => registerProposalsRoute(ctx, () => current().outputDir), 'montagex proposals route')
  ctx.effect(() => registerProposalUpdateRoute(ctx, () => current().outputDir), 'montagex proposal update route')
  ctx.effect(() => registerSettingsTestRoute(ctx, current), 'montagex settings test route')
  ctx.effect(() => registerAdaptersRoute(ctx, () => current().outputDir), 'montagex adapters route')
  ctx.effect(() => registerMcpRoute(ctx, current), 'montagex mcp route')
  ctx.effect(() => registerSubagentSetup(ctx), 'montagex subagent setup')
  ctx.effect(() => registerMontagexCommands(ctx, () => current().outputDir), 'montagex commands')

  // System prompt and child-agent guidance are installed through DSH's native seams.
  // registerSubagentSetup consumes the same runtime preset as registerSystemPrompt;
  // this keeps the host's agent loop authoritative and avoids a second orchestrator.
  void registerBundledSkills(ctx).catch(error => {
    ctx.logger?.error('montagex: failed to register bundled skills: %s', error instanceof Error ? error.message : String(error))
  })
}
