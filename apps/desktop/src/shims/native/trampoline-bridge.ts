// Bridges the Rust trampoline server (commands/trampoline.rs) to the renderer's
// existing, account-aware trampoline command handlers. The Rust server receives a
// connection from the `git-credential-desktop` helper, emits a `trampoline-command`
// event; we run the matching handler and send its output back via the
// `trampoline_response` command. This keeps the official credential/askpass logic
// (createCredentialHelperTrampolineHandler / createAskpassTrampolineHandler) intact.
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

/** Mirrors the renderer's ITrampolineCommand (lib/trampoline/trampoline-command). */
interface TrampolineCommand {
  readonly identifier: string
  readonly trampolineToken: string
  readonly parameters: ReadonlyArray<string>
  readonly environmentVariables: ReadonlyMap<string, string>
  readonly stdin: string
}

type TrampolineCommandHandler = (
  command: TrampolineCommand
) => Promise<string | undefined>

interface TrampolineCommandEvent {
  readonly id: number
  readonly identifier: string
  readonly parameters: ReadonlyArray<string>
  readonly stdin: string
  readonly environmentVariables: Record<string, string>
}

/**
 * Wire the Rust trampoline server to the given handlers (keyed by command
 * identifier, e.g. 'CREDENTIALHELPER' / 'ASKPASS').
 */
export function initTrampolineBridge(
  handlers: Record<string, TrampolineCommandHandler>,
  token: string
) {
  void listen<TrampolineCommandEvent>('trampoline-command', async event => {
    const { id, identifier, parameters, stdin, environmentVariables } =
      event.payload

    let output = ''
    const handler = handlers[identifier]
    if (handler) {
      try {
        const result = await handler({
          identifier,
          trampolineToken: token,
          parameters,
          environmentVariables: new Map(
            Object.entries(environmentVariables ?? {})
          ),
          stdin,
        })
        output = result ?? ''
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(`[trampoline] handler ${identifier} failed`, e)
      }
    }

    await invoke('trampoline_response', { id, output })
  })
}
