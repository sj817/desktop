# Copilot Conflict Resolution Benchmark

Benchmark harness for comparing two Copilot conflict resolution approaches in GitHub Desktop.

Part of [github/gh-cli-and-desktop#87](https://github.com/github/gh-cli-and-desktop/issues/87) — [Epic] Copilot Conflict Resolution

## Overview

This tool:
1. Generates real git repositories with controlled conflict scenarios
2. Runs two resolution approaches against each scenario at varying file counts
3. Measures accuracy, token usage, and latency
4. Generates a comparison report

## Two Approaches

### Approach 1: Single Prompt
Gathers all context (conflict markers + commit messages + PR metadata) into one formatted prompt. Sends to the Copilot SDK with no tool access. Same pattern as PR #21921.

### Approach 2: Agent Mode
Gives the SDK a high-level task prompt and enables all built-in tools (bash, grep, file editor). The agent explores the repo itself — reads files, runs `git log`, `git diff`, etc.

Both approaches produce the same JSON output format with per-file resolutions.

## Prerequisites

- Node.js 20+
- `yarn install` completed (for `@github/copilot-sdk`)
- `GITHUB_TOKEN` environment variable set to a GitHub.com token with Copilot access

## Usage

```bash
# Full matrix run
npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts

# List available scenarios
npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts --list

# Run specific scenarios
npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts \
  --scenario merge-basic,adversarial-rename

# Filter by approach
npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts \
  --approach single-prompt

# Scale test with specific file counts
npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts \
  --scenario merge-basic --scale 5,15,30,50,100

# Use specific model
npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts \
  --model gpt-5-mini

# Generate report from cached results
npx ts-node -P script/tsconfig.json script/test-copilot-conflicts/run.ts --report-only
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--scenario <ids>` | Comma-separated scenario IDs | `all` |
| `--approach <ids>` | `single-prompt`, `agent-mode`, or both | `all` |
| `--scale <counts>` | Comma-separated file counts for scaling | `5,15,30` |
| `--model <models>` | Comma-separated model IDs | `gpt-5-mini` |
| `--report-only` | Generate report from cached results only | — |
| `--list` | List available scenario IDs | — |
| `--help` | Show help | — |

## Scenarios

### Merge Scenarios

| ID | Description | Tags |
|----|-------------|------|
| `merge-basic` | Single-file conflict between two modifications | basic, scalable |
| `merge-multifile` | Same pattern across 3 files | basic, scalable |
| `merge-crossfile` | Variable rename in types.ts must propagate to consumers | adversarial |
| `merge-adddelete` | One branch deletes, other modifies | basic |
| `merge-with-pr` | Includes PR metadata guiding OAuth2 over legacy auth | basic, intent |

### Rebase Scenarios

| ID | Description | Tags |
|----|-------------|------|
| `rebase-basic` | 3-commit branch, conflict at commit 2 | basic |
| `rebase-multi-round` | 5-commit branch, conflicts at commits 2, 3, 5 | basic |

### Cherry-pick Scenarios

| ID | Description | Tags |
|----|-------------|------|
| `cherrypick-basic` | Single cherry-pick conflict | basic |
| `cherrypick-multi` | Multi-file cherry-pick conflict | basic |

### Adversarial Scenarios

These are the critical accuracy tests:

| ID | Description | Verifier |
|----|-------------|----------|
| `adversarial-rename` | userId→id rename must be consistent across 5 files | Coherence |
| `adversarial-interface` | Both branches add different fields; must include both | Coherence |
| `adversarial-import` | Same import added in both branches; must deduplicate | Coherence |
| `adversarial-pr-intent` | PR says "replace legacy auth with OAuth2" | Intent |
| `adversarial-delete-modify` | Planned deprecation vs bug fix; deletion should win | Coherence |
| `adversarial-config` | DB host change must be consistent across config files | Coherence |

## Accuracy Scoring

Each resolution is scored on a 100-point scale:

| Check | Points | Description |
|-------|--------|-------------|
| Markers removed | 30 | No conflict markers remain |
| All files resolved | 20 | Every conflicted file has a resolution |
| Syntax valid | 20 | Resolved content parses correctly |
| Cross-file coherence | 15 | Adversarial consistency checks pass |
| Intent respected | 15 | PR/commit guidance was followed |

## Report Output

Reports are saved to `script/test-copilot-conflicts/results/` and include:

1. **Executive Summary** — which approach wins overall
2. **Accuracy Matrix** — scenario × approach × model with scores
3. **Cross-File Coherence** — adversarial case results
4. **Token Usage** — comparison by approach, scale, and model
5. **Latency** — wall clock timing
6. **Scale Ceiling** — at what file count does each approach degrade?
7. **Model Comparison** — which model performs best?
8. **Raw Data** — complete JSON results

## Directory Structure

```
script/test-copilot-conflicts/
├── run.ts                        # CLI entry point
├── types.ts                      # Shared types
├── generate-conflicts.ts         # Conflict repo generator
├── scenarios/
│   ├── merge-scenarios.ts        # Merge conflict generators
│   ├── rebase-scenarios.ts       # Rebase conflict generators
│   ├── cherrypick-scenarios.ts   # Cherry-pick conflict generators
│   ├── adversarial-scenarios.ts  # Cross-file coherence tests
│   └── scale-inflator.ts        # Inflate scenarios to N files
├── approaches/
│   ├── shared.ts                 # Shared SDK client setup
│   ├── single-prompt.ts          # Approach 1
│   └── agent-mode.ts            # Approach 2
├── metrics/
│   ├── accuracy-checker.ts       # Compile check, marker check, coherence
│   ├── token-tracker.ts          # SDK usage event tracking
│   └── latency-tracker.ts       # Wall clock timing
├── report/
│   └── generate-report.ts       # Results → markdown report
├── results/                      # Cached run data (gitignored)
└── README.md
```
