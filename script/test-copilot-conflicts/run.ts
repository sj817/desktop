/**
 * CLI entry point for the Copilot conflict resolution benchmark.
 *
 * Usage:
 *   # Full matrix run
 *   npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts
 *
 *   # Specific filters
 *   npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts \
 *     --scenario merge-basic --approach single-prompt --scale 5,15 --model gpt-5-mini
 *
 *   # List available scenarios
 *   npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts --list
 *
 *   # Report only from cached results
 *   npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts --report-only
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { join } from 'path'

import {
  ApproachId,
  IBenchmarkConfig,
  IBenchmarkResult,
  IBenchmarkRun,
  DEFAULT_CONFIG,
  IGeneratedScenario,
} from './types'
import {
  generateScenarios,
  cleanupScenarios,
  listScenarioIds,
} from './generate-conflicts'
import { createCopilotClient, getGitHubToken, stopClient, ICopilotClientInstance } from './approaches/shared'
import { resolveSinglePrompt } from './approaches/single-prompt'
import { resolveAgentMode } from './approaches/agent-mode'
import { checkAccuracy } from './metrics/accuracy-checker'
import { TokenTracker } from './metrics/token-tracker'
import { LatencyTracker } from './metrics/latency-tracker'
import { generateReport, writeReport } from './report/generate-report'

// ---------------------------------------------------------------------------
// CLI argument parsing (no external deps)
// ---------------------------------------------------------------------------

interface IParsedArgs {
  scenario: ReadonlyArray<string> | 'all'
  approach: ReadonlyArray<ApproachId> | 'all'
  scale: ReadonlyArray<number>
  model: ReadonlyArray<string>
  reportOnly: boolean
  list: boolean
  help: boolean
}

function parseArgs(argv: ReadonlyArray<string>): IParsedArgs {
  const args: IParsedArgs = {
    scenario: 'all',
    approach: 'all',
    scale: DEFAULT_CONFIG.scales as number[],
    model: DEFAULT_CONFIG.models as string[],
    reportOnly: false,
    list: false,
    help: false,
  }

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    const next = argv[i + 1]

    switch (arg) {
      case '--scenario':
        if (next) {
          args.scenario = next.split(',').map(s => s.trim())
          i++
        }
        break
      case '--approach':
        if (next) {
          const validApproaches = new Set<string>(['single-prompt', 'agent-mode'])
          const parsed = next.split(',').map(s => s.trim())
          const invalid = parsed.filter(a => !validApproaches.has(a))
          if (invalid.length > 0) {
            console.error(`Invalid approach(es): ${invalid.join(', ')}`)
            console.error('Valid approaches: single-prompt, agent-mode')
            process.exit(1)
          }
          args.approach = parsed as ApproachId[]
          i++
        }
        break
      case '--scale':
        if (next) {
          args.scale = next.split(',').map(s => parseInt(s.trim(), 10))
          i++
        }
        break
      case '--model':
        if (next) {
          args.model = next.split(',').map(s => s.trim())
          i++
        }
        break
      case '--report-only':
        args.reportOnly = true
        break
      case '--list':
        args.list = true
        break
      case '--help':
      case '-h':
        args.help = true
        break
    }
  }

  return args
}

function printHelp(): void {
  console.log(`
Copilot Conflict Resolution Benchmark
======================================

Usage:
  npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts [options]

Options:
  --scenario <ids>     Comma-separated scenario IDs (default: all)
  --approach <ids>     Comma-separated approaches: single-prompt,agent-mode (default: all)
  --scale <counts>     Comma-separated file counts for scaling (default: 5,15,30)
  --model <models>     Comma-separated model IDs (default: gpt-5-mini)
  --report-only        Generate report from cached results only
  --list               List available scenario IDs
  --help, -h           Show this help

Environment:
  GITHUB_TOKEN         Required. GitHub personal access token with Copilot access.

Examples:
  # Run everything
  npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts

  # Just merge scenarios with single prompt
  npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts \\
    --scenario merge-basic,merge-multifile --approach single-prompt

  # Scale test with specific model
  npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts \\
    --scenario merge-basic --scale 5,15,30,50 --model gpt-5-mini
  `)
}

// ---------------------------------------------------------------------------
// Result caching
// ---------------------------------------------------------------------------

function ensureResultsDir(dir: string): void {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

function saveRunResults(run: IBenchmarkRun, dir: string): string {
  ensureResultsDir(dir)
  const filename = `run-${run.id}.json`
  const filepath = join(dir, filename)
  writeFileSync(filepath, JSON.stringify(run, null, 2), 'utf8')
  return filepath
}

function loadCachedRuns(dir: string): ReadonlyArray<IBenchmarkRun> {
  if (!existsSync(dir)) {
    return []
  }

  const files = readdirSync(dir).filter(f => f.startsWith('run-') && f.endsWith('.json'))
  const runs: Array<IBenchmarkRun> = []

  for (const file of files) {
    try {
      const content = readFileSync(join(dir, file), 'utf8')
      runs.push(JSON.parse(content) as IBenchmarkRun)
    } catch {
      console.warn(`Warning: Could not load cached run ${file}`)
    }
  }

  return runs
}

// ---------------------------------------------------------------------------
// Benchmark orchestration
// ---------------------------------------------------------------------------

async function runBenchmark(config: IBenchmarkConfig): Promise<IBenchmarkRun> {
  const runId = `${new Date().toISOString().replace(/[:.]/g, '-')}`
  const startTime = new Date().toISOString()

  console.log('🚀 Starting benchmark run:', runId)
  console.log('   Scenarios:', config.scenarios === 'all' ? 'all' : config.scenarios)
  console.log('   Approaches:', config.approaches === 'all' ? 'all' : config.approaches)
  console.log('   Scales:', config.scales)
  console.log('   Models:', config.models)
  console.log('')

  // Step 1: Generate scenarios
  console.log('📦 Generating conflict scenarios...')
  const scenarios = await generateScenarios(config.scenarios, config.scales)
  console.log(`   Generated ${scenarios.length} scenario(s)`)
  console.log('')

  try {
    // Step 2: Determine which approaches to run
    const approaches: ReadonlyArray<ApproachId> =
      config.approaches === 'all'
        ? ['single-prompt', 'agent-mode']
        : config.approaches

    // Step 3: Get GitHub token and create client
    const token = getGitHubToken()

    // Step 4: Run each combination
    const results: Array<IBenchmarkResult> = []

    for (const scenario of scenarios) {
      for (const approach of approaches) {
        for (const model of config.models) {
          console.log(
            `🔬 Running: ${scenario.id} × ${approach} × ${model} (${scenario.fileCount} files)...`
          )

          const tokenTracker = new TokenTracker()
          const latencyTracker = new LatencyTracker()

          let resolution
          try {
            const client = await createCopilotClient(scenario.repoPath, token)
            try {
              resolution = await runApproach(
                approach,
                client,
                model,
                scenario,
                tokenTracker,
                latencyTracker
              )
            } finally {
              await stopClient(client)
            }
          } catch (e) {
            // Client creation failed
            resolution = {
              approach,
              scenarioId: scenario.id,
              model,
              response: null,
              error: e instanceof Error ? e.message : String(e),
              tokenUsage: tokenTracker.getUsage(),
              latencyMs: latencyTracker.getElapsedMs(),
              toolCallCount: 0,
            }
          }

          const accuracy = checkAccuracy(scenario, resolution.response)

          const result: IBenchmarkResult = {
            scenarioId: scenario.id,
            scenarioDescription: scenario.description,
            approach,
            model,
            fileCount: scenario.fileCount,
            tags: [...scenario.tags],
            resolution,
            accuracy,
            timestamp: new Date().toISOString(),
          }

          results.push(result)

          // Print inline result
          const emoji = accuracy.score >= 80 ? '✅' : accuracy.score >= 50 ? '⚠️' : '❌'
          console.log(
            `   ${emoji} Score: ${accuracy.score}/100 | Latency: ${formatMs(resolution.latencyMs)} | ` +
              `Tokens: ${resolution.tokenUsage.totalInputTokens + resolution.tokenUsage.totalOutputTokens}`
          )
          if (resolution.error) {
            console.log(`   ⚡ Error: ${resolution.error}`)
          }
          console.log('')
        }
      }
    }

    const run: IBenchmarkRun = {
      id: runId,
      startTime,
      endTime: new Date().toISOString(),
      results,
      config,
    }

    return run
  } finally {
    // Always clean up scenario repos, even if benchmark fails
    console.log('🧹 Cleaning up temporary repos...')
    cleanupScenarios(scenarios)
  }
}

async function runApproach(
  approach: ApproachId,
  client: ICopilotClientInstance,
  model: string,
  scenario: IGeneratedScenario,
  tokenTracker: TokenTracker,
  latencyTracker: LatencyTracker
) {
  switch (approach) {
    case 'single-prompt':
      return resolveSinglePrompt(client, model, scenario, tokenTracker, latencyTracker)
    case 'agent-mode':
      return resolveAgentMode(client, model, scenario, tokenTracker, latencyTracker)
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`
  }
  return `${(ms / 1000).toFixed(1)}s`
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = parseArgs(process.argv)

  if (args.help) {
    printHelp()
    process.exit(0)
  }

  if (args.list) {
    console.log('Available scenarios:')
    for (const id of listScenarioIds()) {
      console.log(`  - ${id}`)
    }
    process.exit(0)
  }

  const resultsDir = DEFAULT_CONFIG.resultsDir

  if (args.reportOnly) {
    console.log('📊 Generating report from cached results...')
    const runs = loadCachedRuns(resultsDir)
    if (runs.length === 0) {
      console.error('No cached results found in', resultsDir)
      process.exit(1)
    }

    // Merge all cached runs into one for reporting
    const merged: IBenchmarkRun = {
      id: 'merged',
      startTime: runs[0].startTime,
      endTime: runs[runs.length - 1].endTime,
      results: runs.flatMap(r => [...r.results]),
      config: runs[runs.length - 1].config,
    }

    const reportPath = writeReport(merged, resultsDir)
    console.log(`📝 Report written to: ${reportPath}`)
    process.exit(0)
  }

  const config: IBenchmarkConfig = {
    scenarios: args.scenario,
    approaches: args.approach,
    scales: [...args.scale],
    models: [...args.model],
    reportOnly: false,
    resultsDir,
    timeout: DEFAULT_CONFIG.timeout,
  }

  try {
    const run = await runBenchmark(config)

    // Save results
    const resultPath = saveRunResults(run, resultsDir)
    console.log(`💾 Results saved to: ${resultPath}`)

    // Generate report
    const reportPath = writeReport(run, resultsDir)
    console.log(`📝 Report written to: ${reportPath}`)

    // Print summary
    console.log('')
    console.log(generateReport(run))
  } catch (e) {
    console.error('❌ Benchmark failed:', e instanceof Error ? e.message : e)
    process.exit(1)
  }
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
