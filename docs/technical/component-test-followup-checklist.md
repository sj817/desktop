# Component Test Follow-up Checklist

This document captures the remaining work after the first helper-layer pass on
the `component-test-layered-followup` branch.

## Current branch baseline

The following work is already done on this branch and should be treated as the
starting point for the remaining checklist below:

- shared helper additions in
  [app/test/helpers/component-test-utils.ts](../../app/test/helpers/component-test-utils.ts)
  for text-based button lookup and synthetic form submission
- initial helper adoption in
  [app/test/unit/ui/commit-conflicts-warning-actions-test.tsx](../../app/test/unit/ui/commit-conflicts-warning-actions-test.tsx)
- initial helper adoption in
  [app/test/unit/ui/confirm-commit-filtered-changes-test.tsx](../../app/test/unit/ui/confirm-commit-filtered-changes-test.tsx)
- initial helper adoption in
  [app/test/unit/ui/dialog-content-footer-test.tsx](../../app/test/unit/ui/dialog-content-footer-test.tsx)
- initial helper adoption in
  [app/test/unit/ui/dialog-test.tsx](../../app/test/unit/ui/dialog-test.tsx)
- initial helper adoption in
  [app/test/unit/ui/ok-cancel-button-group-test.tsx](../../app/test/unit/ui/ok-cancel-button-group-test.tsx)
- initial helper adoption in
  [app/test/unit/ui/oversized-files-warning-test.tsx](../../app/test/unit/ui/oversized-files-warning-test.tsx)

Everything below is still outstanding.

## Cross-cutting harness work

- [x] Eliminate the `HTMLFormElement.prototype.requestSubmit` warning that still
      appears during targeted UI test runs.
  - Investigate whether clicking submit buttons is taking a native `requestSubmit`
    path before the synthetic submit helper is involved.
  - Confirm whether the fix belongs in
    [app/test/globals.mts](../../app/test/globals.mts),
    [app/test/helpers/component-test-utils.ts](../../app/test/helpers/component-test-utils.ts),
    or both.
  - Re-run the currently passing targeted suites and confirm the warning is gone.
- [ ] Decide whether the shared `submit()` helper should prefer
      `form.requestSubmit()` when available and fall back to dispatching a
      cancelable `submit` event only when necessary.
- [x] Add a shared helper for typing into inputs and textareas so tests stop
      open-coding property-descriptor setters.
  - Replace local input helpers in tests such as
    [app/test/unit/ui/diff-search-input-test.tsx](../../app/test/unit/ui/diff-search-input-test.tsx)
    and
    [app/test/unit/ui/commit-message-test.tsx](../../app/test/unit/ui/commit-message-test.tsx).
- [ ] Add shared helpers for the remaining common interaction patterns that still
      show up repeatedly in UI tests.
  - [x] blur/focus helpers
  - [x] hover and mouseup helpers for drag/drop paths
  - a helper for temporary viewport or bounding-rect stubbing when layout is part
    of the behavior under test
  - optional text-based helpers for links, headings, and other common elements
- [x] Add a shared helper for dialog dismissal grace periods instead of
      re-declaring `waitForDismissGracePeriod()` in individual files.
- [ ] Audit all manual `dispatchEvent(new MouseEvent('click', ...))` usages in
      `app/test/unit/ui` and replace them with the shared click helper unless the
      lower-level event shape is itself what the test is proving.
- [ ] Decide whether to keep the helper layer intentionally CSS-selector-based or
      to add a very small semantic query layer without bringing in a second test
      framework.
  - If staying selector-based, document that decision explicitly.
  - If adding semantic queries, keep the scope small and purpose-built for this
    repo.

## Shared environment cleanup

- [x] Remove test-local dialog and `ResizeObserver` shims that duplicate the
      logic already present in
      [app/test/globals.mts](../../app/test/globals.mts).
  - [x] clean up
        [app/test/unit/ui/dialog-test.tsx](../../app/test/unit/ui/dialog-test.tsx)
  - [x] clean up
        [app/test/unit/ui/commit-conflicts-warning-test.tsx](../../app/test/unit/ui/commit-conflicts-warning-test.tsx)
- [ ] Evaluate whether any other repeated environment stubs should move into the
      shared test globals.
  - repeated `requestAnimationFrame` stubs
  - repeated `getBoundingClientRect` shape setup
  - any repeated platform toggles that are not core to a specific assertion
- [ ] Keep `app/test/globals.mts` as the only source of truth for broad DOM and
      Electron shims unless a test is explicitly checking behavior that depends
      on overriding those defaults.

## Helper-layer adoption checklist

- [ ] Finish the first consistency pass across tests that still use button text
      scans, manual submit dispatch, or local click helpers.
- [ ] Replace local ad hoc element lookup helpers where the shared helper can do
      the job without losing clarity.
- [ ] Replace direct `container.textContent?.includes(...)` assertions with more
      focused queries whenever the test can target a narrower element.
- [ ] Keep class-name assertions only where the class is the actual behavior or
      API surface under test.
- [ ] Prefer helper-driven interaction and state assertions over test-local DOM
      plumbing in all newly touched files.

## High-priority file-by-file work

These are the files that should be addressed next because they either carry the
most mocking, duplicate shared harness logic, or are central to the UI testing
approach we are trying to settle on.

- [ ] [app/test/unit/ui/branch-select-test.tsx](../../app/test/unit/ui/branch-select-test.tsx)
  - Keep the existing wrapper coverage, but add a companion test that exercises
    a less-mocked branch selection flow.
  - [x] Reduce reliance on broad `container.textContent` checks for popover and
    selected-branch assertions.
  - Decide whether the current amount of mocking around `BranchList` and
    `PopoverDropdown` is still justified once helper ergonomics improve.
- [ ] [app/test/unit/ui/branch-list-test.tsx](../../app/test/unit/ui/branch-list-test.tsx)
  - [x] Replace brittle platform-case string checks for group headings with either
    derived expectations or narrower structural assertions.
  - Reduce dependence on mocked `SectionFilterList` behavior where a more direct
    branch-list behavior check would provide better signal.
  - [x] Convert remaining direct `.click()` usage to shared helpers for consistency.
- [ ] [app/test/unit/ui/repositories-list-test.tsx](../../app/test/unit/ui/repositories-list-test.tsx)
  - [x] Replace the remaining raw mouse event dispatch with shared interaction
    helpers.
  - [x] Add one less-mocked behavior path that validates user-visible selection or
    click behavior rather than only the wrapper contract around
    `SectionFilterList`.
  - [x] Tighten grouped-repository text assertions so they are less dependent on the
    full flattened container text.
- [ ] [app/test/unit/ui/repositories-list-search-test.tsx](../../app/test/unit/ui/repositories-list-search-test.tsx)
  - [x] Reduce broad `textContent` assertions and switch to narrower lookups for
    visible repository rows and empty-state controls.
  - Reuse any shared search/filter helper patterns that come out of the main
    repositories list work.
- [ ] [app/test/unit/ui/filter-changes-list-test.tsx](../../app/test/unit/ui/filter-changes-list-test.tsx)
  - Split the current coverage into clearly labeled wrapper tests versus
    behavior-focused tests.
  - Add at least one less-mocked path for filter clearing or hidden-change
    adjustment.
  - [x] Replace string-heavy assertions with more targeted element-level checks.
  - Re-evaluate the breadth of mocked child components and keep only the ones
    that are true boundaries for the behavior under test.
- [ ] [app/test/unit/ui/commit-message-test.tsx](../../app/test/unit/ui/commit-message-test.tsx)
  - [x] Add shared input and textarea helpers so the test does not need local value
    mutation plumbing.
  - Revisit the current mocking breadth and identify one real-child path worth
    covering with less mocking.
  - Keep the co-author and submit-path coverage, but move the assertions toward
    visible behavior where possible.
- [ ] [app/test/unit/ui/commit-message-dialog-test.tsx](../../app/test/unit/ui/commit-message-dialog-test.tsx)
  - Keep the wrapper wiring test, but add a companion path with a more realistic
    child render if that can be done without making the test fragile.
  - Avoid JSON-string prop summaries once a clearer assertion shape is available.
  - Separate parent-managed state assertions from dispatcher-routing assertions
    if that improves readability.
- [ ] [app/test/unit/ui/dialog-test.tsx](../../app/test/unit/ui/dialog-test.tsx)
  - [x] Remove duplicated global shims.
  - [x] Replace the local dismiss-grace helper with a shared one.
  - Continue shifting assertions toward focused button and heading lookups.
- [ ] [app/test/unit/ui/dialog-backdrop-test.tsx](../../app/test/unit/ui/dialog-backdrop-test.tsx)
  - [x] Share the dismiss-grace helper with `dialog-test.tsx`.
  - Consider sharing backdrop-click setup if the same shape appears in more
    dialog tests.
- [ ] [app/test/unit/ui/commit-conflicts-warning-test.tsx](../../app/test/unit/ui/commit-conflicts-warning-test.tsx)
  - [x] Remove duplicated dialog shim logic that now belongs in shared globals.
  - [x] Replace local submit dispatch and button text scans with the shared helper
    API.
  - Consider extracting a shared helper for rendered conflicted-file path
    assertions if the same filename/dirname pattern continues to appear.

## Medium-priority file-by-file work

- [ ] [app/test/unit/ui/changes-list-filter-options-test.tsx](../../app/test/unit/ui/changes-list-filter-options-test.tsx)
  - Replace text-heavy popover assertions with narrower label or control lookups.
  - Reduce CSS-only popover visibility checks where a more direct state assertion
    is available.
- [ ] [app/test/unit/ui/diff-options-test.tsx](../../app/test/unit/ui/diff-options-test.tsx)
  - Add shared helper usage for radio and checkbox lookup.
  - Replace broad container text assertions for option labels where practical.
- [ ] [app/test/unit/ui/diff-header-test.tsx](../../app/test/unit/ui/diff-header-test.tsx)
  - Tighten path, status, and options assertions around specific elements rather
    than container-wide text.
  - Reuse any diff-options helper patterns created above.
- [ ] [app/test/unit/ui/diff-search-input-test.tsx](../../app/test/unit/ui/diff-search-input-test.tsx)
  - [x] Replace the local `setInputValue` helper with the shared input helper.
  - [x] Consider adding a shared blur helper if the same pattern shows up elsewhere.
- [ ] [app/test/unit/ui/continue-rebase-test.tsx](../../app/test/unit/ui/continue-rebase-test.tsx)
  - [x] Replace remaining raw mouse event dispatch with shared click helpers.
  - Tighten the “Rebasing” state assertion around the button itself rather than
    general container text.
- [ ] [app/test/unit/ui/pull-request-list-item-test.tsx](../../app/test/unit/ui/pull-request-list-item-test.tsx)
  - [x] Consider a shared drag/drop helper for mouseover and mouseup-based drop
    flows.
  - Replace broad row-text assertions with narrower title and subtitle element
    checks.
- [ ] [app/test/unit/ui/branch-list-item-test.tsx](../../app/test/unit/ui/branch-list-item-test.tsx)
  - [x] Reuse the same drag/drop helper approach chosen for pull-request list items.
  - Tighten text assertions around the title and description elements.
- [ ] [app/test/unit/ui/pull-request-badge-test.tsx](../../app/test/unit/ui/pull-request-badge-test.tsx)
  - Prefer narrower queries for badge state and CI-status rendering rather than
    CSS-only existence checks.
- [ ] [app/test/unit/ui/ci-status-test.tsx](../../app/test/unit/ui/ci-status-test.tsx)
  - Revisit whether status icon assertions can be made less dependent on the
    full CSS selector chain.
- [ ] [app/test/unit/ui/no-branches-test.tsx](../../app/test/unit/ui/no-branches-test.tsx)
  - [x] Replace broad empty-state text checks with narrower text or element lookup
    helpers.
  - Decide whether keyboard shortcut assertions should be derived from shared
    platform expectations instead of repeated literal arrays.
- [ ] [app/test/unit/ui/no-pull-requests-test.tsx](../../app/test/unit/ui/no-pull-requests-test.tsx)
  - [x] Apply the same narrower empty-state assertion style as `no-branches-test`.
  - Replace the remaining link selector assertions with text-based helpers if a
    shared link helper is added.
- [ ] [app/test/unit/ui/repository-list-item-test.tsx](../../app/test/unit/ui/repository-list-item-test.tsx)
  - Revisit icon and indicator assertions to make sure they are not over-coupled
    to internal markup.
- [ ] [app/test/unit/ui/changed-file-test.tsx](../../app/test/unit/ui/changed-file-test.tsx)
  - Consider a shared helper for path-label assertions where dirname and filename
    are split across child nodes.
- [ ] [app/test/unit/ui/commit-warning-test.tsx](../../app/test/unit/ui/commit-warning-test.tsx)
  - Revisit whether icon assertions should stay CSS-only or move toward a more
    explicit warning-type contract.
- [ ] [app/test/unit/ui/dialog-alertdialog-test.tsx](../../app/test/unit/ui/dialog-alertdialog-test.tsx)
  - Share any dialog focus helper utilities that come out of the main dialog
    cleanup.
- [ ] [app/test/unit/ui/dialog-resize-test.tsx](../../app/test/unit/ui/dialog-resize-test.tsx)
  - Consider centralizing viewport and `requestAnimationFrame` setup if more
    resize-related tests are added.
- [ ] [app/test/unit/ui/dialog-header-test.tsx](../../app/test/unit/ui/dialog-header-test.tsx)
  - Tighten heading and close-button assertions if a shared heading or button
    helper is added.

## Lower-priority opportunistic cleanup

These files are generally acceptable as lightweight leaf tests, but they still
have consistency cleanup available if they are touched again.

- [ ] [app/test/unit/ui/avatar-test.tsx](../../app/test/unit/ui/avatar-test.tsx)
  - Optional cleanup around CSS-selector-only assertions.
- [ ] [app/test/unit/ui/button-test.tsx](../../app/test/unit/ui/button-test.tsx)
  - Optional conversion of remaining class and text assertions to shared helper
    style where it improves readability.
- [ ] [app/test/unit/ui/checkbox-test.tsx](../../app/test/unit/ui/checkbox-test.tsx)
  - Optional helper-driven label lookup cleanup.
- [ ] [app/test/unit/ui/files-changed-badge-test.tsx](../../app/test/unit/ui/files-changed-badge-test.tsx)
  - Low priority unless helper additions make the assertions clearer.
- [ ] [app/test/unit/ui/link-button-test.tsx](../../app/test/unit/ui/link-button-test.tsx)
  - Optional follow-up if a shared link-by-text helper is added.
- [ ] [app/test/unit/ui/multiple-selection-test.tsx](../../app/test/unit/ui/multiple-selection-test.tsx)
  - Optional cleanup for text and class assertions.
- [ ] [app/test/unit/ui/radio-button-test.tsx](../../app/test/unit/ui/radio-button-test.tsx)
  - Optional label lookup cleanup.
- [ ] [app/test/unit/ui/text-box-test.tsx](../../app/test/unit/ui/text-box-test.tsx)
  - Optional cleanup if a shared input helper lands.
- [ ] [app/test/unit/ui/undo-commit-test.tsx](../../app/test/unit/ui/undo-commit-test.tsx)
  - Optional narrowing of container-text assertions.

## Focused follow-up for files already touched on this branch

- [ ] [app/test/helpers/component-test-utils.ts](../../app/test/helpers/component-test-utils.ts)
  - Finish the first round of shared helpers before expanding test coverage any
    further.
  - Keep the API small enough that tests remain explicit and readable.
- [ ] [app/test/globals.mts](../../app/test/globals.mts)
  - [x] Resolve the outstanding `requestSubmit` warning.
  - Avoid growing this file with per-test behavior unless the behavior is truly
    cross-cutting.
- [ ] [app/test/unit/ui/commit-conflicts-warning-actions-test.tsx](../../app/test/unit/ui/commit-conflicts-warning-actions-test.tsx)
  - Revisit only if further shared button or dialog helpers are added.
- [ ] [app/test/unit/ui/confirm-commit-filtered-changes-test.tsx](../../app/test/unit/ui/confirm-commit-filtered-changes-test.tsx)
  - Revisit only if submit or link helpers change again.
- [ ] [app/test/unit/ui/dialog-content-footer-test.tsx](../../app/test/unit/ui/dialog-content-footer-test.tsx)
  - Tighten remaining content assertions if new shared text helpers land.
- [ ] [app/test/unit/ui/dialog-test.tsx](../../app/test/unit/ui/dialog-test.tsx)
  - See remaining high-priority dialog cleanup items above.
- [ ] [app/test/unit/ui/ok-cancel-button-group-test.tsx](../../app/test/unit/ui/ok-cancel-button-group-test.tsx)
  - Revisit only if a clearer group-level helper or shared button-group pattern
    emerges.
- [ ] [app/test/unit/ui/oversized-files-warning-test.tsx](../../app/test/unit/ui/oversized-files-warning-test.tsx)
  - Revisit file-list assertions if a shared split-path helper is introduced.

## Explicit “keep as-is unless touched” files

These files do not need immediate work. They are listed here to make the audit
of `app/test/unit/ui` exhaustive.

- [app/test/unit/ui/component-infra-test.tsx](../../app/test/unit/ui/component-infra-test.tsx)
  - No immediate follow-up. Only revisit if we decide the explicit infrastructure
    smoke test is redundant once the helper layer is mature.

## Validation and process checklist

- [ ] After each helper-layer change, rerun the smallest affected subset of UI
      tests before widening scope.
- [ ] Once the next major batch lands, run the full UI component suite under
      `app/test/unit/ui`.
- [ ] Before considering the branch complete, run the broader unit test suite to
      confirm no shared harness changes regress unrelated tests.
- [ ] Keep PR notes or a short design comment up to date with the testing-tier
      decisions made during this follow-up.
  - wrapper tests that intentionally mock child components
  - behavior tests that should render more of the real subtree
  - leaf tests that are intentionally lightweight and mostly isolated
- [ ] Decide whether any of the conclusions from this branch should be folded
      into [docs/technical/adding-tests.md](./adding-tests.md) once the approach
      is stable.
