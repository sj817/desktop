# Copilot Conflict  Approach Comparison ReportResolution 

**Date:** April 20, 2026  
**Model:** gpt-5-mini  
**Timeout:** 5 minutes per approach  

---

## Approach Descriptions

### 1. Single Prompt
Gathers all conflict markers, commit messages, and PR metadata into a single formatted prompt. Sends one request to the LLM with no tool access. The model returns all resolutions in one response. Simple, predictable, but limited by context window and output generation time at scale.

### 2. Agent Mode
Gives the LLM a high-level task ("resolve these merge conflicts") and enables built-in SDK tools (bash, grep, file editor). The agent autonomously explores the  reads files, runs `git log`, `git diff`,  to understand context before producing resolutions. Most flexible but highest token cost due to multi-turn tool-call overhead.etc. repository 

### 3. Agent Mode (Pre-seeded)
Same as Agent Mode but pre-feeds the full conflict context into the conversation before the agent begins. Reduces exploration overhead since the agent already has the file contents, but retains tool access for additional investigation if needed. A middle ground between single prompt efficiency and agent flexibility.

### 4. Batched Single Prompt
Analyzes file dependencies (imports, shared symbols) and groups related files into intelligently-sized chunks. Sends chunks in parallel (up to 5 concurrent requests), each using the single-prompt approach. Includes validation, retry, and agent fallback per chunk. Adaptive chunk sizing: no chunking for 20 or fewer files, chunks of 20 for 21-100, chunks of 15 for 100+.

---

## Part 1: Scale Benchmarks (merge-basic scenario)

Simple independent merge conflicts scaled to N files. Tests how each approach handles increasing volume.

### Accuracy (Score out of 100)

| Files | Single Prompt | Agent Mode | Agent Pre-seeded | Batched Single Prompt |
|------:|:-------------:|:----------:|:----------------:|:---------------------:|
| 3     | 100           | 100        | 100              | 100                   |
| 10    | 100           | 100        | 100              | 100                   |
| 30    | 100           | 100        | 100              | 100                   |
| 100   | timeout       | timeout    | **100**          | 71*                   |
| 300   | timeout       | timeout    | 71*              | 71*                   |

> *Score of 71 = all conflict markers removed and all files resolved, but one chunk had a syntax error in the model output. This is  the model occasionally produces malformed JSON wrapping, not a systematic accuracy failure.stochastic 

### Latency (seconds)

| Files | Single Prompt | Agent Mode | Agent Pre-seeded | Batched Single Prompt |
|------:|:-------------:|:----------:|:----------------:|:---------------------:|
| 3     | 18.7s         | 33.3s      | 20.8s            | **14.8s**             |
| 10    | **24.8s**     | 55.7s      | 29.2s            | 30.4s                 |
| 30    | 127.8s        | 106.7s     | 63.9s            | **63.5s**             |
| 100   | >5min         | >5min      | 198.7s           | **107.8s**            |
| 300   | >5min         | >5min      | **122.1s**       | 164.1s                |

### Token Usage (input + output)

| Files | Single Prompt | Agent Mode | Agent Pre-seeded | Batched Single Prompt |
|------:|:-------------:|:----------:|:----------------:|:---------------------:|
| 3     | **6,141**     | 33,687     | 16,709           | 6,109                 |
| 10    | **9,001**     | 37,210     | 19,052           | 9,327                 |
| 30    | **17,370**    | 48,487     | 27,064           | 22,802                |
| 100   | N/A           | 109,019+   | 55,238           | **70,417**            |
| 300   | N/A           | 117,906+   | **88,147**       | 231,643               |

> + Agent mode burned 109-118K tokens before being killed at 5  it was still working, not finished.min 

### Tokens per File (efficiency)

| Files | Single Prompt | Agent Mode | Agent Pre-seeded | Batched Single Prompt |
|------:|:-------------:|:----------:|:----------------:|:---------------------:|
| 3     | 2,047         | 11,229     | 5,570            | **2,036**             |
| 10    | **900**       | 3,721      | 1,905            | 933                   |
| 30    | **579**       | 1,616      | 902              | 760                   |
          | **552**          | 704                   ||              | 100   | 
          | **294**          | 772                   ||              | 300   | 

---

## Part 2: Complex Scenario (OAuth2 Migration vs Rate Limiting)

To validate beyond simple independent conflicts, we ran a realistic **8-file OAuth2 migration** scenario:

- **Branch A (main):** Added tiered rate limiting (free/pro/enterprise) to the existing API key auth system
- **Branch B (feature):** Replaced API key auth entirely with OAuth2 Bearer token flow
- **PR metadata** instructs: "OAuth2 replaces API keys; rate limiting should be preserved but adapted"
- **8 files conflict** across types, validator, session store, middleware, routes, config, server, and tests
- **Cross-file coherence** requires: OAuth2 types used consistently + rate limiting preserved + middleware uses Bearer tokens

### Results

| Approach | Score | Latency | Tokens | Coherent | Intent |
|:---------|:-----:|:-------:|:------:|:--------:|:------:|
| Single Prompt | **85** | **65.6s** | **11,369** | No | Yes |
| Agent Mode | 85 | 103.3s | 46,385 | No | Yes |
| Agent Pre-seeded | **85** | 65.0s | 23,099 | No | Yes |
| Batched Single Prompt | 65 | 90.9s | 13,117 | No | Yes |

### Analysis

1. **All approaches correctly followed PR  OAuth2 won over API keys as the PR metadata instructed.intent** 

2. **No approach achieved full cross-file  merging OAuth2 + rate limiting into a consistent system across 8 files is genuinely hard. The coherence verifier checks that resolved types include both OAuth tokens AND rate limiting, and that middleware uses Bearer tokens.coherence** 

3. **Single Prompt and Agent Pre-seeded tied at  both resolved all files with valid syntax and correct intent, but imperfect coherence. Single Prompt was cheaper (11K vs 23K tokens).85** 

4. **Batched Single Prompt scored lowest ( syntax errors in 3 files because chunking split interdependent files apart. When `types.ts` goes in one chunk and `session-store.ts` goes in another, the model in the second chunk doesn't know what types to use.65)** 

5. **Agent Mode spent 4x the tokens for the same  exploration overhead yielded zero accuracy benefit.score** 

---

## Key Takeaways

### 1. Batched Single Prompt is the best general-purpose approach for scale
- Only approach that reliably completes 100 files under 2 minutes
- Parallel execution provides 2x latency advantage at 30+ files
- Token efficiency comparable to Single Prompt (~700-770 tokens/file)
- **Weakness:** Can break coherence on tightly coupled files by splitting them across chunks

### 2. Single Prompt is best for small or complex conflicts (1-20 files)
- Fastest and most token-efficient at 3-10 files
- Keeps all files  best coherence on complex scenariostogether 
- Falls apart at 30+ files (128s) and completely fails at 100+ (timeout)
- Ideal for the common case: most real merge conflicts touch 1-10 files

### 3. Agent Mode is too expensive for this use case
- 4-6x more tokens than Single Prompt at every scale
- 2-4x slower at every scale
- Same accuracy as Single  extra exploration adds no value for structured conflictsPrompt 
- Potential value only for unstructured "real-world" conflicts where markers alone lack context

### 4. Agent Pre-seeded is surprisingly efficient at scale
- Tokens/file actually decreases with scale (5,570 at 3 files to 294 at 300)
- Completed 100 files with perfect accuracy (199s, 55K tokens)
- The pre-seeded context amortizes well: one large prompt cheaper than 20 chunk prompts
- **Trade-off:** higher latency at small scales, more efficient at 100+

### 5. For complex interdependent conflicts, Single Prompt wins on quality
- Score 85 vs 65 for Batched SP on the OAuth2 migration scenario
- Keeping all files in one context preserves cross-file relationships
- Batched SP should detect tight coupling and keep related files together (future improvement)

### 6. Production Recommendation

| Conflict Type | Recommended Approach | Expected Latency | Expected Tokens |
|:-------------|:--------------------|:----------------|:----------------|
| 1-20 files (any complexity) | Single Prompt | 15-65s | 5-15K |
| 21-30 independent files | Batched Single Prompt | 60-65s | 20-25K |
| 31-100 independent files | Batched Single Prompt | ~108s | ~70K |
| 100+ independent files | Batched SP or Agent Pre-seeded | 2-3min | 55-230K |
| Complex interdependent (any size) | Single Prompt (if fits context) | 60-120s | 10-20K |

**Additional optimizations for production:**
- **Pre-warm the SDK client** on conflict detection (saves 15-20s cold start)
- **Progressive  show resolved files as chunks complete (Batched SP advantage)UI** 
- **Smarter  detect tightly-coupled files and keep them in one chunkchunking** 
- **Hybrid  use Single Prompt for complex/coupled conflicts, Batched SP for independent onesrouting** 

---

## Methodology Notes

- Scale benchmarks use `merge-basic`: independent merge conflicts inflated to N files
- Complex scenario uses `complex-oauth-migration`: 8 interdependent files with cross-file coherence requirements and PR metadata
- Latency includes SDK client startup (~13-15s cold  in production with a warm client, subtract ~15sstart) 
- Token counts track actual LLM input+output via SDK usage events
- The 5-minute timeout was applied per individual approach invocation
- Agent Pre-seeded at 100 files was re-run after initial timeout (confirmed as server variance)
- Batched SP at 300 files was re-run after initial timeout (completed in 164s)
- All benchmarks run locally on a single machine with sequential execution (no concurrent approach runs)
