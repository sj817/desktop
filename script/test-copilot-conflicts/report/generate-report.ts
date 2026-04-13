/**
 * Benchmark report generator.
 *
 * Takes benchmark results and produces a comprehensive markdown report
 * with tables, comparisons, and raw data.
 */

import { writeFileSync } from 'fs'
import { join } from 'path'
import {
  IBenchmarkRun,
  IBenchmarkResult,
  ApproachId,
} from '../types'

/**
 * Generate a complete markdown report from benchmark results.
 */
export function generateReport(run: IBenchmarkRun): string {
  const sections: Array<string> = []

  sections.push('# Copilot Conflict Resolution Benchmark Report')
  sections.push('')
  sections.push(`**Run ID:** ${run.id}`)
  sections.push(`**Start:** ${run.startTime}`)
  sections.push(`**End:** ${run.endTime}`)
  sections.push(`**Total scenarios:** ${run.results.length}`)
  sections.push('')

  sections.push(generateExecutiveSummary(run.results))
  sections.push(generateAccuracyMatrix(run.results))
  sections.push(generateCrossFileCoherence(run.results))
  sections.push(generateTokenUsage(run.results))
  sections.push(generateLatency(run.results))
  sections.push(generateScaleCeiling(run.results))
  sections.push(generateModelComparison(run.results))
  sections.push(generateRawData(run))

  return sections.join('\n')
}

/**
 * Write the report to a file.
 */
export function writeReport(run: IBenchmarkRun, outputDir: string): string {
  const report = generateReport(run)
  const filename = `report-${run.id}.md`
  const filepath = join(outputDir, filename)
  writeFileSync(filepath, report, 'utf8')
  return filepath
}

// ---------------------------------------------------------------------------
// Section generators
// ---------------------------------------------------------------------------

function generateExecutiveSummary(
  results: ReadonlyArray<IBenchmarkResult>
): string {
  const lines: Array<string> = []
  lines.push('## Executive Summary')
  lines.push('')

  const approaches = getUniqueApproaches(results)

  for (const approach of approaches) {
    const approachResults = results.filter(r => r.approach === approach)
    const avgScore = average(approachResults.map(r => r.accuracy.score))
    const successRate =
      (approachResults.filter(r => r.resolution.error === null).length /
        approachResults.length) *
      100
    const avgLatency = average(approachResults.map(r => r.resolution.latencyMs))
    const avgTokens = average(
      approachResults.map(
        r =>
          r.resolution.tokenUsage.totalInputTokens +
          r.resolution.tokenUsage.totalOutputTokens
      )
    )

    lines.push(`### ${formatApproach(approach)}`)
    lines.push(`- **Average accuracy score:** ${avgScore.toFixed(1)}/100`)
    lines.push(`- **Success rate:** ${successRate.toFixed(1)}%`)
    lines.push(`- **Average latency:** ${formatMs(avgLatency)}`)
    lines.push(`- **Average tokens:** ${formatNumber(avgTokens)}`)
    lines.push('')
  }

  // Winner determination
  if (approaches.length >= 2) {
    const scores = approaches.map(a => ({
      approach: a,
      score: average(
        results.filter(r => r.approach === a).map(r => r.accuracy.score)
      ),
    }))
    scores.sort((a, b) => b.score - a.score)
    lines.push(
      `**Overall winner:** ${formatApproach(scores[0].approach)} ` +
        `(${scores[0].score.toFixed(1)} vs ${scores[1].score.toFixed(1)} avg score)`
    )
    lines.push('')
  }

  return lines.join('\n')
}

function generateAccuracyMatrix(
  results: ReadonlyArray<IBenchmarkResult>
): string {
  const lines: Array<string> = []
  lines.push('## Accuracy Matrix')
  lines.push('')

  const approaches = getUniqueApproaches(results)
  const models = getUniqueModels(results)
  const scenarios = getUniqueScenarios(results)

  // Header
  const header = ['Scenario', ...approaches.flatMap(a =>
    models.map(m => `${formatApproach(a)} (${m})`)
  )]
  lines.push(`| ${header.join(' | ')} |`)
  lines.push(`| ${header.map(() => '---').join(' | ')} |`)

  // Rows
  for (const scenarioId of scenarios) {
    const cells = [scenarioId]
    for (const approach of approaches) {
      for (const model of models) {
        const r = results.find(
          x =>
            x.scenarioId === scenarioId &&
            x.approach === approach &&
            x.model === model
        )
        if (r) {
          const emoji = r.accuracy.score >= 80 ? '✅' : r.accuracy.score >= 50 ? '⚠️' : '❌'
          cells.push(`${emoji} ${r.accuracy.score}`)
        } else {
          cells.push('—')
        }
      }
    }
    lines.push(`| ${cells.join(' | ')} |`)
  }

  lines.push('')
  return lines.join('\n')
}

function generateCrossFileCoherence(
  results: ReadonlyArray<IBenchmarkResult>
): string {
  const lines: Array<string> = []
  lines.push('## Cross-File Coherence (Adversarial)')
  lines.push('')

  const adversarial = results.filter(r => r.tags.includes('adversarial'))

  if (adversarial.length === 0) {
    lines.push('_No adversarial scenarios in this run._')
    lines.push('')
    return lines.join('\n')
  }

  lines.push('| Scenario | Approach | Model | Coherent | Intent | Score | Notes |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')

  for (const r of adversarial) {
    const coherent =
      r.accuracy.crossFileCoherent === null
        ? '—'
        : r.accuracy.crossFileCoherent
          ? '✅'
          : '❌'
    const intent =
      r.accuracy.intentRespected === null
        ? '—'
        : r.accuracy.intentRespected
          ? '✅'
          : '❌'
    const notes = r.accuracy.notes.join('; ') || '—'
    lines.push(
      `| ${r.scenarioId} | ${formatApproach(r.approach)} | ${r.model} | ${coherent} | ${intent} | ${r.accuracy.score} | ${notes} |`
    )
  }

  lines.push('')
  return lines.join('\n')
}

function generateTokenUsage(
  results: ReadonlyArray<IBenchmarkResult>
): string {
  const lines: Array<string> = []
  lines.push('## Token Usage')
  lines.push('')

  lines.push(
    '| Approach | Model | Avg Files | Avg Input | Avg Output | Avg Total |'
  )
  lines.push('| --- | --- | --- | --- | --- | --- |')

  const approaches = getUniqueApproaches(results)
  const models = getUniqueModels(results)

  for (const approach of approaches) {
    for (const model of models) {
      const subset = results.filter(
        r => r.approach === approach && r.model === model
      )
      if (subset.length === 0) {
        continue
      }

      const avgFiles = average(subset.map(r => r.fileCount))
      const avgInput = average(
        subset.map(r => r.resolution.tokenUsage.totalInputTokens)
      )
      const avgOutput = average(
        subset.map(r => r.resolution.tokenUsage.totalOutputTokens)
      )

      lines.push(
        `| ${formatApproach(approach)} | ${model} | ${avgFiles.toFixed(1)} | ${formatNumber(avgInput)} | ${formatNumber(avgOutput)} | ${formatNumber(avgInput + avgOutput)} |`
      )
    }
  }

  lines.push('')

  // Scale tier breakdown
  const scaleTiers = [...new Set(results.map(r => r.fileCount))].sort(
    (a, b) => a - b
  )
  if (scaleTiers.length > 1) {
    lines.push('### Token Usage by Scale Tier')
    lines.push('')
    lines.push('| Scale (files) | Approach | Model | Avg Input | Avg Output |')
    lines.push('| --- | --- | --- | --- | --- |')

    for (const scale of scaleTiers) {
      for (const approach of approaches) {
        for (const model of models) {
          const subset = results.filter(
            r =>
              r.fileCount === scale &&
              r.approach === approach &&
              r.model === model
          )
          if (subset.length === 0) {
            continue
          }

          const avgInput = average(
            subset.map(r => r.resolution.tokenUsage.totalInputTokens)
          )
          const avgOutput = average(
            subset.map(r => r.resolution.tokenUsage.totalOutputTokens)
          )

          lines.push(
            `| ${scale} | ${formatApproach(approach)} | ${model} | ${formatNumber(avgInput)} | ${formatNumber(avgOutput)} |`
          )
        }
      }
    }

    lines.push('')
  }

  return lines.join('\n')
}

function generateLatency(
  results: ReadonlyArray<IBenchmarkResult>
): string {
  const lines: Array<string> = []
  lines.push('## Latency')
  lines.push('')

  lines.push('| Approach | Model | Avg Files | Avg Latency | Min | Max | P50 |')
  lines.push('| --- | --- | --- | --- | --- | --- | --- |')

  const approaches = getUniqueApproaches(results)
  const models = getUniqueModels(results)

  for (const approach of approaches) {
    for (const model of models) {
      const subset = results.filter(
        r => r.approach === approach && r.model === model
      )
      if (subset.length === 0) {
        continue
      }

      const latencies = subset.map(r => r.resolution.latencyMs)
      const avgFiles = average(subset.map(r => r.fileCount))
      const avg = average(latencies)
      const min = Math.min(...latencies)
      const max = Math.max(...latencies)
      const sorted = [...latencies].sort((a, b) => a - b)
      const p50 = sorted[Math.floor(sorted.length / 2)]

      lines.push(
        `| ${formatApproach(approach)} | ${model} | ${avgFiles.toFixed(1)} | ${formatMs(avg)} | ${formatMs(min)} | ${formatMs(max)} | ${formatMs(p50)} |`
      )
    }
  }

  lines.push('')
  return lines.join('\n')
}

function generateScaleCeiling(
  results: ReadonlyArray<IBenchmarkResult>
): string {
  const lines: Array<string> = []
  lines.push('## Scale Ceiling')
  lines.push('')
  lines.push(
    'At what file count does each approach start failing or degrading?'
  )
  lines.push('')

  const scaleTiers = [...new Set(results.map(r => r.fileCount))].sort(
    (a, b) => a - b
  )

  if (scaleTiers.length <= 1) {
    lines.push('_Only one scale tier tested — cannot determine ceiling._')
    lines.push('')
    return lines.join('\n')
  }

  const approaches = getUniqueApproaches(results)

  lines.push('| Scale (files) | ' + approaches.map(formatApproach).join(' | ') + ' |')
  lines.push('| --- | ' + approaches.map(() => '---').join(' | ') + ' |')

  for (const scale of scaleTiers) {
    const cells = [String(scale)]
    for (const approach of approaches) {
      const subset = results.filter(
        r => r.fileCount === scale && r.approach === approach
      )
      if (subset.length === 0) {
        cells.push('—')
        continue
      }

      const avgScore = average(subset.map(r => r.accuracy.score))
      const errorRate =
        (subset.filter(r => r.resolution.error !== null).length /
          subset.length) *
        100

      let status: string
      if (errorRate > 50) {
        status = `❌ ${avgScore.toFixed(0)} (${errorRate.toFixed(0)}% errors)`
      } else if (avgScore < 50) {
        status = `⚠️ ${avgScore.toFixed(0)}`
      } else {
        status = `✅ ${avgScore.toFixed(0)}`
      }
      cells.push(status)
    }
    lines.push(`| ${cells.join(' | ')} |`)
  }

  lines.push('')
  return lines.join('\n')
}

function generateModelComparison(
  results: ReadonlyArray<IBenchmarkResult>
): string {
  const lines: Array<string> = []
  lines.push('## Model Comparison')
  lines.push('')

  const models = getUniqueModels(results)
  const approaches = getUniqueApproaches(results)

  if (models.length <= 1) {
    lines.push('_Only one model tested._')
    lines.push('')
    return lines.join('\n')
  }

  lines.push('| Model | Approach | Avg Score | Avg Latency | Avg Tokens |')
  lines.push('| --- | --- | --- | --- | --- |')

  for (const model of models) {
    for (const approach of approaches) {
      const subset = results.filter(
        r => r.model === model && r.approach === approach
      )
      if (subset.length === 0) {
        continue
      }

      const avgScore = average(subset.map(r => r.accuracy.score))
      const avgLatency = average(subset.map(r => r.resolution.latencyMs))
      const avgTokens = average(
        subset.map(
          r =>
            r.resolution.tokenUsage.totalInputTokens +
            r.resolution.tokenUsage.totalOutputTokens
        )
      )

      lines.push(
        `| ${model} | ${formatApproach(approach)} | ${avgScore.toFixed(1)} | ${formatMs(avgLatency)} | ${formatNumber(avgTokens)} |`
      )
    }
  }

  lines.push('')
  return lines.join('\n')
}

function generateRawData(run: IBenchmarkRun): string {
  const lines: Array<string> = []
  lines.push('## Raw Data')
  lines.push('')
  lines.push('<details>')
  lines.push('<summary>Click to expand raw JSON results</summary>')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(run, null, 2))
  lines.push('```')
  lines.push('')
  lines.push('</details>')
  lines.push('')
  return lines.join('\n')
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getUniqueApproaches(
  results: ReadonlyArray<IBenchmarkResult>
): ReadonlyArray<ApproachId> {
  return [...new Set(results.map(r => r.approach))]
}

function getUniqueModels(
  results: ReadonlyArray<IBenchmarkResult>
): ReadonlyArray<string> {
  return [...new Set(results.map(r => r.model))]
}

function getUniqueScenarios(
  results: ReadonlyArray<IBenchmarkResult>
): ReadonlyArray<string> {
  return [...new Set(results.map(r => r.scenarioId))]
}

function average(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function formatMs(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

function formatNumber(n: number): string {
  return Math.round(n).toLocaleString()
}

function formatApproach(approach: ApproachId): string {
  switch (approach) {
    case 'single-prompt':
      return 'Single Prompt'
    case 'agent-mode':
      return 'Agent Mode'
  }
}
