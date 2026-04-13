/**
 * Token usage tracker for Copilot SDK interactions.
 *
 * Subscribes to SDK `assistant.usage` events and aggregates token counts
 * across all interactions in a single benchmark run.
 */

import { IAggregateTokenUsage, ITokenUsage } from '../types'

/**
 * Tracks token usage from Copilot SDK sessions.
 *
 * Usage:
 * ```
 * const tracker = new TokenTracker()
 * session.on('assistant.usage', tracker.handleUsageEvent)
 * // ... run approach ...
 * const usage = tracker.getUsage()
 * ```
 */
export class TokenTracker {
  private readonly interactions: Array<ITokenUsage> = []

  /**
   * Event handler for SDK `assistant.usage` events.
   * Bind this to the session event emitter.
   */
  public readonly handleUsageEvent = (...args: unknown[]): void => {
    const event = args[0] as {
      data: {
        inputTokens?: number
        outputTokens?: number
        cacheReadTokens?: number
        cacheWriteTokens?: number
        model?: string
      }
    }
    this.interactions.push({
      inputTokens: event.data.inputTokens ?? 0,
      outputTokens: event.data.outputTokens ?? 0,
      cacheReadTokens: event.data.cacheReadTokens ?? 0,
      cacheWriteTokens: event.data.cacheWriteTokens ?? 0,
      model: event.data.model ?? 'unknown',
    })
  }

  /**
   * Manually record a usage data point (for approaches that extract
   * usage differently).
   */
  public recordUsage(usage: ITokenUsage): void {
    this.interactions.push(usage)
  }

  /**
   * Get the aggregate token usage across all recorded interactions.
   */
  public getUsage(): IAggregateTokenUsage {
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCacheReadTokens = 0
    let totalCacheWriteTokens = 0

    for (const interaction of this.interactions) {
      totalInputTokens += interaction.inputTokens
      totalOutputTokens += interaction.outputTokens
      totalCacheReadTokens += interaction.cacheReadTokens
      totalCacheWriteTokens += interaction.cacheWriteTokens
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheWriteTokens,
      interactions: [...this.interactions],
    }
  }

  /**
   * Reset the tracker for a new run.
   */
  public reset(): void {
    this.interactions.length = 0
  }
}
