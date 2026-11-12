// Minimal structural typings for the DSH services this plugin consumes.
// At runtime the services are provided by the DSH host profile; these
// declarations keep `npm run typecheck` self-contained without depending on
// private DSH workspace packages.
//
// Target: DeepSeek Harness 0.2.2-rc.2. Names that no longer exist there are
// recorded in the comments so a future reader does not reintroduce them:
// `settings.register` (removed 0.2.0), `subagents.registerContinuableSetup`
// (removed 0.1.5), the browser-side `settingsScope` service (removed 0.2.x).
declare module '@deepseek-ai/cordis' {
  interface Fiber {
    /** Loader row backing this plugin instance; also its settings namespace. */
    entry?: {
      options?: {
        id?: string
        config?: Record<string, unknown>
      }
    }
  }

  interface Context {
    fiber: Fiber
    tools: {
      register(definition: unknown): () => void
    }
    skills: {
      register(skill: unknown): () => void
    }
    systemPrompt: {
      section(section: { name: string; order?: number; text: string }): () => void
    }
    /**
     * DSH 0.2.x settings service. It no longer registers plugin namespaces:
     * a plugin declares `Config`, and reads/writes its own values through the
     * resolved Config and `configEditor`.
     */
    settings: {
      describe(options?: { redactSecrets?: boolean }): unknown[]
      mutate(ns: string, ops: readonly unknown[], expectedRevision?: number): Promise<void>
    }
    /** Persists complete raw configs through the Loader; owns profile layering. */
    configEditor?: {
      edit(
        entry: unknown,
        change: (current: Record<string, unknown>, inherited: Record<string, unknown>) => Record<string, unknown>,
      ): Promise<void>
    }
    get<T = any>(name: string): T
    on(event: string, listener: (...args: any[]) => void): () => void
    inject(deps: string[], callback: (ctx: Context) => (() => void) | void): () => void
    effect(callback: () => (() => void) | void, label?: string): () => void
    logger?: {
      error(...args: unknown[]): void
      warn(...args: unknown[]): void
    }
    commands?: {
      register(definition: {
        name: string
        description: string
        input?: { hint: string; images?: boolean }
        recordInput?: boolean
        handler: (invocation: {
          rawInput: string
          signal?: AbortSignal
          attachments?: readonly unknown[]
        }) =>
          | { kind: 'success' | 'error'; text?: string }
          | Promise<{ kind: 'success' | 'error'; text?: string }>
      }): () => void
    }
    /** DSH 0.2.x ask seam. */
    userQuestions?: {
      ask(request: {
        questions: Array<{
          id: string
          question: string
          header?: string
          detail?: string
          options?: Array<{ label: string; description?: string }>
          multiSelect?: boolean
        }>
        agent?: unknown
        signal?: AbortSignal
      }): Promise<{ answers: Array<{ id: string; selected: string[]; custom?: string }> }>
    }
    workspace?: {
      list(): Array<{ path: string; title: string; sessionIds?: string[] }>
    }
    /** Present only in profiles that run the DSH web server. */
    webServer?: {
      register(route: {
        kind: 'exact' | 'prefix'
        path: string
        handler: (request: unknown, response: unknown) => void | Promise<void>
      }): () => void
    }
  }
}

declare module '@deepseek-ai/dsh-tools' {
  export function defineTool(options: unknown): any
}

declare module '@deepseek-ai/dsh-settings' {
  export type SettingsNamespace = string
  interface Events {
    /**
     * One profile entry's form values changed. Emitted by the settings service
     * from `describe()`, which it runs after every accepted write.
     */
    'settings/document-updated'(ns: SettingsNamespace, revision: number): void
  }
}

declare module '@deepseek-ai/dsh-skill' {}

declare module '@deepseek-ai/dsh-system-prompt' {}

declare module 'react-dom' {
  import type { ReactNode } from 'react'
  export function createPortal(children: ReactNode, container: Element | DocumentFragment): ReactNode
}

declare module '@deepseek-ai/dsh-llm' {}

interface Window {
  /** Debug/automation hook driving the MontageX editor dock (see src/client/index.ts). */
  __montagexEditor?: {
    open(kind?: 'image' | 'video', path?: string): void
    openDirectorStage(): void
    close(): void
    setTab(tab: 'canvas' | 'image' | 'video'): void
    snapshot(): { open: boolean; tab: 'canvas' | 'image' | 'video'; kind: 'image' | 'video' | null; path: string | null }
    layoutKind(): string
    openDetailsNow(): void
    toggleSidebarNow(): void
  }
}
