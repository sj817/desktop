# Test Harness Improvement Plan

This document outlines a plan to improve GitHub Desktop's test infrastructure so that AI coding agents can work on this repository with high confidence and minimal human oversight, and how to maintain test quality over time.

## Current State

- **Test runner**: Node.js built-in test runner (`node --test`), invoked via `yarn test`
- **~120 test files** in `app/test/unit/` covering git operations, stores, parsers, and utilities
- **Test helpers** in `app/test/helpers/`: repository scaffolding, fixture loading, mock stores, mock API/git/IPC
- **ESLint rule tests** in `eslint-rules/tests/`
- **CI**: GitHub Actions — lint on Ubuntu, build+test on macOS (arm64) and Windows (x64)
- **No UI/E2E tests**
- **No coverage enforcement**

## Coverage Gaps

### What's Tested

| Area | Coverage |
|---|---|
| Git operations (`lib/git/`) | 35 of 57 modules (61%) |
| Top-level lib modules | ~41 of ~101 (41%) |
| Stores (`lib/stores/`) | 6 of 24 (25%) |
| React UI components (`ui/`) | 0 of 70+ directories (0%) |
| Main process (`main-process/`) | 2 of 20 (10%) |
| Models (`models/`) | ~5 of 38 (13%) |

### Highest-Risk Untested Areas

**Critical — data loss or core functionality:**

- `app-store.ts` (8200 lines) — the central state machine orchestrating all app behavior, with zero tests
- `dispatcher.ts` (4500 lines) — action routing from UI to stores, with zero tests
- `sign-in-store.ts` — OAuth state machine for authentication *(test now exists)*
- `token-store.ts` — auth token management
- `lib/git/push.ts`, `lib/git/clone.ts`, `lib/git/rebase.ts` — destructive or complex git operations without dedicated tests

**High — silent corruption or UX breakage:**

- `pull-request-store.ts` — PR fetch/cache/dedup logic
- `ahead-behind-store.ts` — branch sync state calculations
- `commit-status-store.ts` — CI status tracking
- `notifications-store.ts` — desktop notification coordination
- `cloning-repositories-store.ts` — clone progress tracking
- All 70+ UI component directories — zero rendering tests

**Medium — security and IPC:**

- `token-store.ts` — token storage
- `lib/git/authentication.ts` — credential passing
- `lib/ssh/` — SSH key handling
- `main-process/trusted-ipc-sender.ts` — IPC sender validation

## Improvement Plan

### Phase 1: Foundation *(mostly complete)*

Infrastructure to make writing tests easy for agents and humans.

| Deliverable | Status | Files |
|---|---|---|
| Fix `TestStatsStore` hardcoded metric bug | Done | `app/test/helpers/test-stats-store.ts` |
| Create `mock-git.ts` helper | Done | `app/test/helpers/mock-git.ts` |
| Create `mock-api.ts` helper | Done | `app/test/helpers/mock-api.ts` |
| Create `mock-ipc.ts` helper | Done | `app/test/helpers/mock-ipc.ts` |
| Add testing requirements to copilot-instructions | Done | `.github/copilot-instructions.md` |

### Phase 2: High-Value Unit Tests

The most impactful tests to write, prioritized by risk.

**Store tests** — target: bring store coverage from 25% to 60%+:

1. `app/test/unit/sign-in-store-test.ts` — auth state machine *(done, 17 tests)*
2. `app/test/unit/token-store-test.ts` — token CRUD, expiration
3. `app/test/unit/pull-request-store-test.ts` — fetch dedup, cache, events
4. `app/test/unit/ahead-behind-store-test.ts` — calculation correctness
5. `app/test/unit/commit-status-store-test.ts` — CI status aggregation
6. `app/test/unit/notifications-store-test.ts` — event routing, dedup
7. `app/test/unit/cloning-repositories-store-test.ts` — progress, cancellation

**Git operation tests** — cover the untested destructive/complex operations:

1. `app/test/unit/git/push-test.ts` — push with/without force, errors
2. `app/test/unit/git/clone-test.ts` — clone with auth, progress, errors
3. `app/test/unit/git/rebase-full-test.ts` — start/continue/abort flows
4. `app/test/unit/git/revert-test.ts` — revert commit, conflicts
5. `app/test/unit/git/add-test.ts` — staging scenarios
6. `app/test/unit/git/init-test.ts` — repo initialization

**AppStore integration tests** — test multi-step workflows through the Dispatcher:

1. `app/test/helpers/app-store-test-harness.ts` — wired-up harness with all mocks
2. `app/test/unit/app-store-workflows-test.ts` — commit, branch, merge flows
3. `app/test/unit/multi-commit-operation-test.ts` — rebase/squash/cherry-pick

**API and IPC tests:**

1. `app/test/unit/api-error-handling-test.ts` — error responses, rate limiting
2. `app/test/unit/ipc-contract-test.ts` — channel contract verification
3. `app/test/unit/database-migration-test.ts` — schema versioning

### Phase 3: Component Tests

Add React component rendering tests using jsdom (already available in the test environment).

**Prerequisite:** Install `@testing-library/react` v12 (last React 16-compatible version).

**Target components:**

| Component | What to Assert |
|---|---|
| `ui/diff/` | Line rendering, expand/collapse, selection |
| `ui/changes/` | File list, check/uncheck, filtering |
| `ui/commit-message/` | Input validation, summary/description, co-authors |
| `ui/branches/` | Search filtering, grouping, PR badges |
| `ui/merge-conflicts/` | Conflict list, resolution actions |
| `ui/dialog/` | Focus trap, Escape key, button states |
| `ui/repositories-list/` | Search, group headers, selection |

**Directory:** `app/test/unit/ui/`

### Phase 4: E2E Smoke Tests

A minimal set of committed E2E tests that run in CI to catch catastrophic breakage. These are not meant to be comprehensive — they verify that the app launches, renders, and can perform the most basic operations.

**Framework:** Playwright with `_electron.launch()` for Electron support.

**Smoke tests (5 max):**

1. App launches and renders the welcome/repository screen
2. Add a local repo → file list appears
3. Make a change → stage → commit succeeds
4. Create branch → switch back → working directory is clean
5. View a diff → diff content renders

These tests should be fast, stable, and narrowly scoped. They exist purely as a safety net — if any of them fail, something is fundamentally broken.

**Architecture:**
- Mock all API calls via Playwright's `page.route()`
- Reuse existing repo scaffolding helpers for git setup
- Use `data-testid` attributes for stable selectors
- Fresh app instance per test, temp directories with auto-cleanup
- No `waitForTimeout()` — use Playwright auto-waiting only

**Directory:** `app/test/e2e/`

### Agent-Driven UI Verification

Beyond the minimal smoke tests above, AI agents should use browser automation tools (e.g., Playwright via MCP, or VS Code's built-in browser tools) during development to interactively verify their UI changes. This is ad-hoc and exploratory — nothing is committed as a test.

When an agent is asked to implement a feature or fix a bug that touches UI:

1. Run `yarn build:dev` to build the app
2. Launch the app with `yarn start`
3. Use browser automation to interact with the UI and verify the change works
4. Take screenshots if needed to confirm visual correctness
5. Iterate on the code if something doesn't look right

This approach gives agents confidence in UI changes without the maintenance burden of a large E2E test suite.

### Phase 5: Agent Automation

Codify testing rules so agents maintain and improve the harness automatically.

- Update `.github/copilot-instructions.md` with mandatory test requirements *(done)*
- Create PR template testing checklist
- Document test writing conventions in this file

## Test Helpers Reference

### Available Helpers

| Helper | Location | Purpose |
|---|---|---|
| `setupEmptyRepository()` | `app/test/helpers/repositories.ts` | Create a temp git repo |
| `setupFixtureRepository()` | `app/test/helpers/repositories.ts` | Clone a fixture repo |
| `setupConflictedRepo()` | `app/test/helpers/repositories.ts` | Repo with merge conflicts |
| `makeCommit()` | `app/test/helpers/repository-scaffolding.ts` | Create a commit with files |
| `createBranch()` | `app/test/helpers/repository-scaffolding.ts` | Create and optionally switch to a branch |
| `switchTo()` | `app/test/helpers/repository-scaffolding.ts` | Switch branches |
| `createMockGitResult()` | `app/test/helpers/mock-git.ts` | Mock `IGitStringResult` |
| `createMockGitError()` | `app/test/helpers/mock-git.ts` | Mock a git failure |
| `createMockStatusResult()` | `app/test/helpers/mock-git.ts` | Mock `IStatusResult` |
| `createMockFileChange()` | `app/test/helpers/mock-git.ts` | Mock `WorkingDirectoryFileChange` |
| `createMockAPI()` | `app/test/helpers/mock-api.ts` | Mock GitHub API client with method overrides |
| `createMockAPIRepository()` | `app/test/helpers/mock-api.ts` | Fixture `IAPIRepository` |
| `MockIPC` | `app/test/helpers/mock-ipc.ts` | Records send/invoke calls for assertion |
| `TestStatsStore` | `app/test/helpers/test-stats-store.ts` | In-memory stats metrics |
| `InMemoryDispatcher` | `app/test/helpers/in-memory-dispatcher.ts` | Dispatcher with no-op init |
| `InMemoryStore` | `app/test/helpers/stores/in-memory-store.ts` | Sync key-value store |
| `AsyncInMemoryStore` | `app/test/helpers/stores/async-in-memory-store.ts` | Async key-value store |

### Helpers Still Needed

| Helper | Purpose |
|---|---|
| `app/test/helpers/app-store-test-harness.ts` | Wire up AppStore with all mocks, return `{ appStore, dispatcher, mocks }` |
| `app/test/helpers/component-test-utils.ts` | Render React components with required context providers |

## Writing Tests

### Structure

Use the Arrange/Act/Assert pattern with Node.js built-in test runner:

```typescript
import { describe, it } from 'node:test'
import assert from 'node:assert'

describe('ModuleName', () => {
  describe('methodName', () => {
    it('should handle the happy path', async () => {
      // Arrange — set up preconditions
      const repo = await setupEmptyRepository(t)

      // Act — call the function under test
      const result = await getStatus(repo)

      // Assert — verify the result
      assert.equal(result.currentBranch, 'main')
    })

    it('should handle error cases', async () => {
      // Test edge cases and error paths
    })
  })
})
```

### Conventions

- Test files go in `app/test/unit/` with suffix `-test.ts` or `-test.tsx`
- Use `async` tests — `it('description', async () => { ... })`
- No `setTimeout` or `sleep` — use proper async waiting
- No shared mutable state between tests
- Tests must pass on both macOS and Windows (no unguarded platform-specific paths)
- Use existing helpers rather than reimplementing setup logic

### Running Tests

```bash
# Run all unit tests
yarn test

# Run a specific test file
yarn test app/test/unit/sign-in-store-test.ts

# Run tests in a directory
yarn test app/test/unit/git/

# Run script tests
yarn test:script

# Run ESLint rule tests
yarn test:eslint
```

## Mandatory Test Requirements for Contributors

These rules apply to both human and AI contributors:

1. **Every new function** in `app/src/lib/` must have a corresponding unit test in `app/test/unit/`
2. **Every bug fix** must include a regression test that fails without the fix and passes with it
3. **Every new store method** must have a test verifying its state transition
4. **Every new git operation** must have a test using helpers from `app/test/helpers/repositories.ts`
5. **New React components** should have at least one rendering test verifying basic render and key interaction

## Review Checklist

When reviewing test PRs (human or agent):

- [ ] New/modified functions have corresponding tests
- [ ] Tests cover the happy path and at least one error/edge case
- [ ] Tests are deterministic — no timing dependencies, no shared mutable state
- [ ] Test names clearly describe the scenario being tested
- [ ] Tests reuse existing helpers rather than reimplementing setup
- [ ] No `setTimeout`/`sleep` — proper async waiting only
- [ ] Tests pass on both macOS and Windows
- [ ] Existing tests still pass (`yarn test`)

## Anti-Flakiness Rules

1. **No `page.waitForTimeout()` or `setTimeout`** — use proper async waiting and assertions
2. **Deterministic setup** — every test creates its own state from scratch
3. **Cleanup** — `afterEach`/`after` removes temp directories and resets state
4. **No shared state** — tests must not depend on execution order
5. **CI isolation** — each test gets a fresh environment
6. **Generous timeouts** — 30s per test for Electron-based tests, fail fast for hangs
