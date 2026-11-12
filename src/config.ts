import z from '@deepseek-ai/schemastery'

export const SETTINGS_NS = 'montagex'

export type CapabilityMode =
  | 'deepseek-chat'
  | 'openai-chat'
  | 'openai-images'
  | 'openai-videos'
  | 'modelverse-tasks'
  | 'openai-tts'
  | 'kling'
  | 'runway'
  | 'minimax-h3'
  | 'kling-v3'
  | 'vidu'
  | 'veo'
  | 'generic-rest'
  | 'mock'

export interface CapabilitySettings {
  /** Master switch. The matching MontageX tool is only registered when true. */
  enabled: boolean
  /** Protocol/configuration mode. */
  mode: CapabilityMode
  /** OpenAI-compatible API base URL, including the version segment when applicable. */
  baseURL: string
  /** API key. Kept in the DSH credential/settings store; also falls back to env. */
  apiKey: string
  /** Model id used by this capability. */
  model: string
  /** Provider-specific output tier, e.g. 2K for MiniMax-H3 video tasks. */
  resolution: string
  /** Mode-specific credentials and options (per-provider auth schemes). */
  auth: ModeAuth
}

/** Per-mode credential/option bag; every field defaults empty and stays secret where it names a credential. */
export interface ModeAuth {
  /** Kling (可灵) AccessKey for JWT signing. */
  klingAk: string
  /** Kling (可灵) SecretKey for JWT signing. */
  klingSk: string
  /** Runway API version header value, e.g. `2024-11-06`; empty = omit the header. */
  runwayVersion: string
}

export type InitiativeMode = '严格' | '自动' | '协同'

export interface MontagexSettings {
  outputDir: string
  timeoutMs: number
  pollIntervalMs: number
  maxPollAttempts: number
  /** Dedicated 成片 persona — analysis is from a 导演角度. */
  persona: '成片'
  /** Initiative: 严格 / 自动 / 协同. */
  initiative: InitiativeMode
  vision: CapabilitySettings
  image: CapabilitySettings
  video: CapabilitySettings
  audio: CapabilitySettings
}

export const VISION_MODES = ['deepseek-chat', 'openai-chat', 'mock'] as const
export const IMAGE_MODES = ['openai-images', 'modelverse-tasks', 'generic-rest', 'mock'] as const
export const VIDEO_MODES = ['openai-videos', 'modelverse-tasks', 'kling', 'kling-v3', 'runway', 'minimax-h3', 'vidu', 'veo', 'generic-rest', 'mock'] as const
export const AUDIO_MODES = ['openai-tts', 'generic-rest', 'mock'] as const

/**
 * Mark a schema node live-editable, when the installed Schemastery supports it.
 *
 * `.volatile()` exists from Schemastery 3.19 (which DSH 0.2.2 ships). It is what
 * makes a capability live-editable from the Settings page: the loader commits a
 * volatile-only config change straight into the reference, so running tools see
 * the new values without remounting the plugin, and `settings.describe` projects
 * a form for the node so a browser page can read and write it.
 *
 * An older Schemastery resolves the plugin's own copy instead of the host's. In
 * that case the plugin must still activate — it just loses live reload and the
 * settings form, so configuration comes from the row's `config:` block only.
 * The probe is a property test on the live schema object, and the cast keeps a
 * single code path across both type generations.
 * @param schema - node to mark volatile.
 * @returns the same node, marked when the runtime supports it.
 */
const VOLATILE_SUPPORTED = typeof (z.string() as unknown as { volatile?: unknown }).volatile === 'function'

function live<T>(schema: T): T {
  if (!VOLATILE_SUPPORTED) return schema
  return (schema as unknown as { volatile(): T }).volatile()
}

function modeAuth() {
  return z.object({
    klingAk: z.string().role('secret').default('').description('Kling 可灵 AccessKey（JWT 签名用，仅 kling 模式需要）。'),
    klingSk: z.string().role('secret').default('').description('Kling 可灵 SecretKey（JWT 签名用，仅 kling 模式需要）。'),
    runwayVersion: z.string().default('').description('Runway API 版本头（如 2024-11-06），留空则不发送该头。'),
  })
}

function capability(modes: readonly string[], mode: string, baseURL: string, model: string, resolution = '1K') {
  return live(z.object({
    enabled: z.boolean().default(true).description('Register and expose this capability to the agent.'),
    mode: z.union(modes as unknown as string[]).default(mode).description('Protocol used to reach the provider.'),
    baseURL: z.string().default(baseURL).description('Base URL, e.g. https://api.openai.com/v1/'),
    apiKey: z.string().role('secret').default('').description('API key; empty means local endpoint or env fallback.'),
    model: z.string().default(model).description('Model id.'),
    resolution: z.string().default(resolution).description('Provider-specific output tier.'),
    auth: modeAuth(),
  }))
}

export const MontagexSettings = z.object({
  outputDir: z.string().default('mont_output').description('Directory under the current working directory for downloaded media.'),
  timeoutMs: z.number().step(1).min(1_000).max(3_600_000).default(120_000).description('HTTP timeout for one provider request.'),
  pollIntervalMs: z.number().step(1).min(500).max(60_000).default(5_000).description('Async task polling interval.'),
  maxPollAttempts: z.number().step(1).min(1).max(2_000).default(360).description('Maximum async task polling attempts.'),
  // Scalar live fields the Settings page edits in place. A volatile scalar is
  // legal anywhere; only a volatile *object* is restricted to a fixed path.
  persona: live(z.union(['成片']).default('成片')).description('成片 persona：导演角度分析，积极调用知识库与 skill。'),
  initiative: live(z.union(['严格', '自动', '协同']).default('协同')).description('严格：多确认、不生成、二到四个提示词。自动：预算内直接执行生成。协同：提示词和占位，用户审阅后执行生成。'),
  vision: capability(VISION_MODES, 'deepseek-chat', 'https://api.deepseek.com', 'deepseek-v4-flash-vision-exp'),
  image: capability(IMAGE_MODES, 'openai-images', 'https://api.modelverse.cn/v1', 'gpt-image-2'),
  video: capability(VIDEO_MODES, 'modelverse-tasks', 'https://api.modelverse.cn/v1', 'doubao-seedance-2-0-260128', '2K'),
  audio: capability(AUDIO_MODES, 'openai-tts', 'https://api.modelverse.cn/v1', 'qwen3-tts-flash'),
})