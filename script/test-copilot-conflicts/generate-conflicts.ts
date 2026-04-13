/**
 * Conflict scenario orchestrator.
 *
 * Discovers all registered scenario factories and runs generation for
 * requested scenarios + scale factors.
 */

import { mkdtempSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

import { IGeneratedScenario, IScenarioFactory } from './types'
import { mergeScenarios } from './scenarios/merge-scenarios'
import { rebaseScenarios } from './scenarios/rebase-scenarios'
import { cherrypickScenarios } from './scenarios/cherrypick-scenarios'
import { adversarialScenarios } from './scenarios/adversarial-scenarios'
import { inflateScenario } from './scenarios/scale-inflator'

/** All registered scenario factories. */
const allFactories: ReadonlyArray<IScenarioFactory> = [
  ...mergeScenarios,
  ...rebaseScenarios,
  ...cherrypickScenarios,
  ...adversarialScenarios,
]

/**
 * List all available scenario IDs.
 */
export function listScenarioIds(): ReadonlyArray<string> {
  return allFactories.map(f => f.id)
}

/**
 * Generate scenarios matching the given filter and scale factors.
 *
 * @param scenarioFilter - Scenario IDs to include, or 'all'
 * @param scales - File counts to generate at (only applies to scalable scenarios)
 * @returns Array of generated scenarios with temp repo paths
 */
export async function generateScenarios(
  scenarioFilter: ReadonlyArray<string> | 'all',
  scales: ReadonlyArray<number>
): Promise<ReadonlyArray<IGeneratedScenario>> {
  const factories =
    scenarioFilter === 'all'
      ? allFactories
      : allFactories.filter(f => scenarioFilter.includes(f.id))

  if (factories.length === 0) {
    throw new Error(
      `No scenarios matched filter: ${JSON.stringify(scenarioFilter)}`
    )
  }

  const results: Array<IGeneratedScenario> = []

  for (const factory of factories) {
    // Generate the base scenario
    const tmpDir = mkdtempSync(join(tmpdir(), `copilot-bench-${factory.id}-`))
    const scenario = await factory.generate(tmpDir)
    results.push(scenario)

    // If the scenario supports scaling, generate inflated versions
    if (factory.tags.includes('scalable')) {
      for (const scale of scales) {
        // Skip scales that are smaller than the base file count
        if (scale <= scenario.fileCount) {
          continue
        }

        const scaleTmpDir = mkdtempSync(
          join(tmpdir(), `copilot-bench-${factory.id}-x${scale}-`)
        )
        const inflated = await inflateScenario(factory, scaleTmpDir, scale)
        results.push(inflated)
      }
    }
  }

  return results
}

/**
 * Clean up temporary directories from generated scenarios.
 */
export function cleanupScenarios(
  scenarios: ReadonlyArray<IGeneratedScenario>
): void {
  const { rmSync } = require('fs') as typeof import('fs')
  for (const scenario of scenarios) {
    try {
      rmSync(scenario.repoPath, { recursive: true, force: true })
    } catch {
      // Best effort cleanup
    }
  }
}
