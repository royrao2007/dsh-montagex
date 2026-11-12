import type { MontagexSettings } from './config.ts'
import { syncTools } from './tools.ts'

export interface CollectedTool {
  name: string
  description: string
  parameters: Record<string, { required?: boolean; description?: string; type?: string }>
  output?: { render?: (args: unknown, value: unknown) => unknown }
}

export function defaultContractSettings(overrides: Partial<MontagexSettings> = {}): MontagexSettings {
  const capability = (enabled = true) => ({
    enabled,
    mode: 'mock' as const,
    baseURL: '',
    apiKey: '',
    model: 'mock',
    resolution: '1K',
    auth: { klingAk: '', klingSk: '', runwayVersion: '' },
  })
  return {
    outputDir: '/tmp/montagex-tool-contract',
    timeoutMs: 1000,
    pollIntervalMs: 100,
    maxPollAttempts: 1,
    persona: '成片',
    initiative: '自动',
    vision: capability(),
    image: capability(),
    video: capability(),
    audio: capability(),
    ...overrides,
  }
}

export function collectToolSpecs(settings: MontagexSettings = defaultContractSettings()): CollectedTool[] {
  const tools: CollectedTool[] = []
  const ctx = {
    tools: {
      register(def: CollectedTool) {
        tools.push(def)
        return () => {}
      },
    },
    get() {
      return undefined
    },
  }
  const dispose = syncTools(ctx as never, settings)
  dispose()
  return tools
}
