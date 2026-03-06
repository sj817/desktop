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

### Phase 1: Foundation *(complete)*

Infrastructure to make writing tests easy for agents and humans.

| Deliverable | Status | Files |
|---|---|---|
| Fix `TestStatsStore` hardcoded metric bug | Done | `app/test/helpers/test-stats-store.ts` |
| Create `mock-git.ts` helper | Done | `app/test/helpers/mock-git.ts` |
| Create `mock-api.ts` helper | Done | `app/test/helpers/mock-api.ts` |
| Create `mock-ipc.ts` helper | Done | `app/test/helpers/mock-ipc.ts` |
| Create `app-store-test-harness.ts` | Done | `app/test/helpers/app-store-test-harness.ts` |
| Add testing requirements to copilot-instructions | Done | `.github/copilot-instructions.md` |

### Phase 2: High-Value Unit Tests *(complete)*

The most impactful tests, prioritized by risk. All tests below are implemented, passing, and lint-clean.

**Store tests** (8 → 3 stores now tested):

1. `app/test/unit/sign-in-store-test.ts` — auth state machine *(17 tests)*
2. `app/test/unit/ahead-behind-store-test.ts` — cache, calculation, abort *(4 tests)*
3. `app/test/unit/cloning-repositories-store-test.ts` — remove, state, events *(7 tests)*
4. `app/test/unit/app-store-test-harness-test.ts` — harness validation *(6 tests)*

**Git operation tests** (4 previously untested operations now covered):

1. `app/test/unit/git/push-test.ts` — push, set-upstream, force-with-lease, progress *(4 tests)*
2. `app/test/unit/git/clone-test.ts` — clone, branch, progress, default branch *(4 tests)*
3. `app/test/unit/git/rebase-full-test.ts` — rebase, conflict detection, abort *(4 tests)*
4. `app/test/unit/git/revert-test.ts` — revert simple commit, revert file add *(2 tests)*
5. `app/test/unit/git/add-test.ts` — stage conflicted file after resolution *(1 test)*
6. `app/test/unit/git/init-test.ts` — create repo, default branch *(2 tests)*

**Multi-commit operation and model tests:**

1. `app/test/unit/multi-commit-operation-test.ts` — type guards, conflict steps, choose branch *(16 tests)*
2. `app/test/unit/model-type-guards-test.ts` — repository type guards *(11 tests)*

**API, IPC, and infrastructure tests:**

1. `app/test/unit/api-error-handling-test.ts` — APIError, getAbsoluteUrl *(9 tests)*
2. `app/test/unit/ipc-contract-test.ts` — channel registry, counts *(5 tests)*
3. `app/test/unit/database-migration-test.ts` — conditionalVersion schema logic *(3 tests)*

**Utility and lib tests:**

1. `app/test/unit/offset-from-test.ts` — time offset calculations *(12 tests)*
2. `app/test/unit/status-utils-test.ts` — mapStatus, isConflictedFile, hasConflictedFiles *(11 tests)*
3. `app/test/unit/file-system-test.ts` — getTempFilePath, readPartialFile *(6 tests)*

### Phase 3: Component Tests *(partially complete)*

React component rendering tests using jsdom (already in the test environment) and `ReactDOM.render` with `react-dom/test-utils`. Uses `app/test/helpers/component-test-utils.ts` for rendering, event simulation, and DOM querying.

**Directory:** `app/test/unit/ui/`

**Tests implemented:**

| Component | File | Tests | What's Asserted |
|---|---|---|---|
| Infrastructure | `component-infra-test.tsx` | 3 | React rendering, events work in jsdom |
| `Checkbox` | `checkbox-test.tsx` | 8 | On/Off/Mixed states, label, onChange, disabled |
| `Button` | `button-test.tsx` | 8 | Click, disabled, type, aria-disabled, className |
| `OkCancelButtonGroup` | `ok-cancel-button-group-test.tsx` | 9 | Ok/Cancel text, clicks, disabled, hidden, destructive |
| `DialogHeader` | `dialog-header-test.tsx` | 5 | Title text/JSX, titleId, close button |
| `TextBox` | `text-box-test.tsx` | 12 | Input rendering, label, placeholder, disabled, readOnly, clear button, className |
| `RadioButton` | `radio-button-test.tsx` | 7 | Checked/unchecked, label, onSelected, children as label |
| `LinkButton` | `link-button-test.tsx` | 10 | URI/href, onClick, disabled, role, aria-label, className |
| `DialogContent` | `dialog-content-footer-test.tsx` | 3 | Children rendering, className, onRef callback |
| `DialogFooter` | `dialog-content-footer-test.tsx` | 2 | Children rendering, composition with OkCancelButtonGroup |

**Remaining (not yet implemented):**

| Component | What to Assert |
|---|---|
| `ui/diff/` | Line rendering, expand/collapse, selection (may need virtualization mocking) |
| `ui/changes/` | File list, check/uncheck, filtering |
| `ui/commit-message/` | Input validation, summary/description, co-authors |
| `ui/branches/` | Search filtering, grouping, PR badges |
| `ui/merge-conflicts/` | Conflict list, resolution actions |
| `ui/dialog/` (full Dialog) | Focus trap, Escape key dismiss, backdrop click |
| `ui/repositories-list/` | Search, group headers, selection |

**ESLint config:** `react/jsx-no-bind` is disabled for `app/test/**/*` to allow arrow function callbacks in test JSX.

### Phase 4: E2E Smoke Tests *(partially complete)*

A minimal set of committed E2E tests that run in CI (`yarn test:e2e`) to catch catastrophic breakage. These are not meant to be comprehensive — they verify that the app launches, renders, and can perform the most basic operations.

**Framework:** WebDriverIO with `@wdio/electron-service` for native Electron integration.

Why WebDriverIO over Playwright:
- Playwright is reserved for agent-driven interactive verification during development (see below)
- WebDriverIO's Electron service provides first-class support for launching and controlling the Electron app, accessing `BrowserWindow` APIs, and running in CI headless
- Keeps the two use cases (CI regression suite vs. agent exploration) cleanly separated with different tools

**Smoke tests (5 max):**

1. App launches and renders the welcome/repository screen
2. Add a local repo → file list appears
3. Make a change → stage → commit succeeds
4. Create branch → switch back → working directory is clean
5. View a diff → diff content renders

These tests should be fast, stable, and narrowly scoped. They exist purely as a safety net — if any of them fail, something is fundamentally broken.

**Architecture:**
- Mock API calls by pre-seeding test state or intercepting network requests
- Reuse existing repo scaffolding helpers for git setup
- Use `data-testid` attributes for stable selectors
- Fresh app instance per test, temp directories with auto-cleanup
- No `browser.pause()` — use WebDriverIO's built-in `waitForExist`/`waitForDisplayed`

**Directory:** `app/test/e2e/`

### Agent-Driven UI Verification

Separately from the CI smoke tests, AI agents use Playwright to interactively verify their UI changes during development. This is ad-hoc and exploratory — nothing from this process gets committed as a test.

When an agent is asked to implement a feature or fix a bug that touches UI:

1. Run `yarn build:dev` to build the app
2. Launch the app with `yarn start`
3. Use Playwright (via MCP tools, or VS Code's built-in browser automation) to interact with the UI and verify the change works
4. Take screenshots if needed to confirm visual correctness
5. Iterate on the code if something doesn't look right

This approach gives agents confidence in UI changes without the maintenance burden of a large E2E test suite. The CI smoke tests (WebDriverIO) catch regressions; the agent's Playwright exploration catches implementation issues before code is even committed.

### Phase 5: Agent Automation *(complete)*

Codify testing rules so agents maintain and improve the harness automatically.

- Update `.github/copilot-instructions.md` with mandatory test requirements *(done)*
- Create PR template testing checklist *(done)*
- Document test writing conventions in this file *(done)*

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
| `createTestStores()` | `app/test/helpers/app-store-test-harness.ts` | Create all stores wired together with test dependencies |
| `createTestAccountsStore()` | `app/test/helpers/app-store-test-harness.ts` | AccountsStore with in-memory storage |
| `createTestSignInStore()` | `app/test/helpers/app-store-test-harness.ts` | SignInStore with test AccountsStore |
| `createTestRepositoriesStore()` | `app/test/helpers/app-store-test-harness.ts` | RepositoriesStore with test database |
| `createTestRepositoryStateCache()` | `app/test/helpers/app-store-test-harness.ts` | RepositoryStateCache with TestStatsStore |
| `renderComponent()` | `app/test/helpers/component-test-utils.ts` | Render React component, return container + unmount |
| `click()` | `app/test/helpers/component-test-utils.ts` | Simulate click in `act()` block |
| `change()` | `app/test/helpers/component-test-utils.ts` | Simulate input change |
| `keyDown()` | `app/test/helpers/component-test-utils.ts` | Simulate keyboard event |
| `queryOrThrow()` | `app/test/helpers/component-test-utils.ts` | Query DOM and assert element exists |

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
