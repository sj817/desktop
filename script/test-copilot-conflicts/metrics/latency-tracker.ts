/**
 * Latency tracker for benchmark runs.
 *
 * Simple wall-clock timing using performance.now() for high-resolution
 * measurements.
 */

/**
 * Tracks wall-clock latency for a single operation.
 *
 * Usage:
 * ```
 * const tracker = new LatencyTracker()
 * tracker.start()
 * // ... run approach ...
 * tracker.stop()
 * const ms = tracker.getElapsedMs()
 * ```
 */
export class LatencyTracker {
  private startTime: number | null = null
  private endTime: number | null = null

  /**
   * Start the timer. Resets any previous measurement.
   */
  public start(): void {
    this.startTime = performance.now()
    this.endTime = null
  }

  /**
   * Stop the timer.
   */
  public stop(): void {
    if (this.startTime === null) {
      throw new Error('LatencyTracker: start() must be called before stop()')
    }
    this.endTime = performance.now()
  }

  /**
   * Get the elapsed time in milliseconds.
   * Can be called while the timer is still running (returns time since start).
   */
  public getElapsedMs(): number {
    if (this.startTime === null) {
      return 0
    }
    const end = this.endTime ?? performance.now()
    return Math.round(end - this.startTime)
  }

  /**
   * Reset the tracker.
   */
  public reset(): void {
    this.startTime = null
    this.endTime = null
  }

  /**
   * Convenience: run an async function and return its result along with
   * the elapsed time.
   */
  public async measure<T>(fn: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
    this.start()
    try {
      const result = await fn()
      this.stop()
      return { result, elapsedMs: this.getElapsedMs() }
    } catch (e) {
      this.stop()
      throw e
    }
  }
}
