// Stub for @github/copilot-sdk (a Node SDK using createRequire / node:net etc.).
// Copilot features are deferred; this keeps the bundle building until they are
// wired through Rust/HTTP.
export type AssistantMessageEvent = unknown
export type MessageOptions = Record<string, unknown>
export type ModelInfo = Record<string, unknown>
export type SessionConfig = Record<string, unknown>

export class CopilotSession {}

export class CopilotClient {
  constructor(..._args: ReadonlyArray<unknown>) {}
}
