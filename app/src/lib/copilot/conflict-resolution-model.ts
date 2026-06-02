import type { ModelInfo } from '@github/copilot-sdk'
import {
  DefaultConflictResolutionReasoningEffort,
  getPreferredDefaultModel,
  getSupportedReasoningEffort,
  type ReasoningEffort,
} from '../stores/copilot-store'
import { IBYOKProvider, parseModelKey } from './byok'

/**
 * Friendly fallback name used when the Copilot model list hasn't loaded yet
 * (or is empty) so the loading dialog still shows a meaningful label. Matches
 * the display name of the default Copilot model (`gpt-5-mini`).
 */
const DefaultCopilotModelName = 'GPT-5 mini'

/** The model name and reasoning effort to display for conflict resolution. */
export interface IConflictResolutionModelDisplay {
  readonly modelName: string
  readonly reasoningEffort: ReasoningEffort | undefined
}

/**
 * Resolves the stored `conflict-resolution` model selection into the
 * human-readable model name and reasoning effort that will actually be used
 * when resolving conflicts with Copilot.
 *
 * This mirrors `CopilotStore.resolveSessionModelConfig` /
 * `AppStore.resolveCopilotModelRequest` so the loading dialog's header
 * accurately reflects the model the engine will use:
 *  - BYOK selections show the configured model name and its reasoning effort.
 *  - Built-in selections show the model's name and an effort clamped to one the
 *    model supports (preferring the conflict-resolution default).
 *  - When nothing is selected (or the selection can't be resolved) it falls
 *    back to the preferred default model and the default reasoning effort.
 */
export function getConflictResolutionModelDisplay(
  selection: string | null,
  copilotModels: ReadonlyArray<ModelInfo> | null,
  byokProviders: ReadonlyArray<IBYOKProvider>
): IConflictResolutionModelDisplay {
  const key = selection !== null ? parseModelKey(selection) : null

  if (key?.kind === 'byok') {
    const provider = byokProviders.find(p => p.id === key.providerId)
    const model = provider?.models.find(m => m.id === key.modelId)
    if (model !== undefined) {
      return buildDisplay(model.name, model.reasoningEffort)
    }
    // Selection points at a deleted provider/model; fall back to the default
    // built-in model below, matching the engine's resolution behaviour.
  }

  const requestedModelId =
    key?.kind === 'copilot' && key.modelId !== '' ? key.modelId : null

  const models = copilotModels ?? []
  const resolvedModel = requestedModelId
    ? models.find(m => m.id === requestedModelId) ?? null
    : getPreferredDefaultModel(models)

  if (resolvedModel !== null) {
    return buildDisplay(
      resolvedModel.name,
      getSupportedReasoningEffort(
        resolvedModel,
        DefaultConflictResolutionReasoningEffort
      )
    )
  }

  // No model metadata is available (the list hasn't loaded, or the selection
  // points at a model that's no longer offered). Mirror the engine's fallback:
  // use the explicitly requested model id when there is one, otherwise the
  // default model name, paired with the default reasoning effort.
  return buildDisplay(
    requestedModelId ?? DefaultCopilotModelName,
    DefaultConflictResolutionReasoningEffort
  )
}

/**
 * Builds the display info, normalizing the model name so every model renders
 * consistently as "Name · Effort". Some Copilot models embed the reasoning
 * level in their name, e.g. "Claude Opus 4.7 (High reasoning)(Internal only)" —
 * the reasoning parenthetical is stripped so the effort isn't duplicated, while
 * other markers like "(Internal only)" are preserved.
 */
function buildDisplay(
  modelName: string,
  reasoningEffort: ReasoningEffort | undefined
): IConflictResolutionModelDisplay {
  return { modelName: cleanModelName(modelName), reasoningEffort }
}

/**
 * Removes the redundant parenthetical "(... reasoning ...)" marker from a model
 * name (its reasoning level is shown separately) and collapses the resulting
 * whitespace. Other parentheticals (e.g. "(Internal only)" or version tags)
 * are left untouched.
 */
function cleanModelName(name: string): string {
  return name
    .replace(/\s*\([^)]*reasoning[^)]*\)/gi, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}
