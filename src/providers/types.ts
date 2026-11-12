import type { CapabilitySettings, MontagexSettings } from '../config.ts'
import type { MontagexTaskLedger } from '../tasks.ts'
import type { AdapterSpec } from './adapter-spec.ts'

export interface ProviderContext {
  settings: MontagexSettings
  capability: CapabilitySettings
  signal: AbortSignal
  /** Optional append-only task ledger; async modes record their transitions here. */
  ledger?: MontagexTaskLedger
  /** Present when this call is bound to a user-onboarded adapter. */
  adapter?: AdapterSpec
}

export interface MediaFile {
  path?: string
  url?: string
  mimeType?: string
}

export interface VisionResult {
  model: string
  question: string
  answer: string
  source: string
}

export interface ImageResult {
  model: string
  prompt: string
  files: MediaFile[]
  mode: string
}

export interface VideoResult {
  model: string
  prompt: string
  taskId?: string
  status: string
  files: MediaFile[]
  mode: string
  /** When the host timed out after submit, the agent should poll this tool. */
  next?: string
}

export interface AudioResult {
  model: string
  text: string
  files: MediaFile[]
  mode: string
}