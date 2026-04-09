# Rework: Copilot Conflict Resolution UI → Replacement Mode

## Problem Statement

The current Copilot conflict resolution uses a popup dialog approach (separate from the
conflicts dialog). The new approach makes Copilot an alternative conflict resolution
*mode* that replaces the standard conflicts dialog, with Copilot suggestions appearing
as additional per-file options alongside ours/theirs.

**Before:** Conflicts dialog → popup → apply → back to conflicts dialog
**After:** Conflicts dialog → click "Resolve with Copilot" → Copilot mode replaces
dialog → "Continue merge/rebase" to proceed

## Proposed Approach

### Core Architecture

Copilot resolution becomes a **mode** within the existing `ShowConflicts` step.
State is tracked on `IMultiCommitOperationState` (not a popup). When in Copilot mode,
`BaseMultiCommitOperation` renders a `CopilotConflictResolutionDialog` instead of the
standard `ConflictsDialog`.

### State Design

Add `copilotConflictResolutionState` to `IMultiCommitOperationState`:

```typescript
type ICopilotConflictResolutionState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly response: ICopilotConflictResolutionResponse }
  | { readonly kind: 'error'; readonly error: string }
```

### "Always resolve with Copilot" Preference

Follow the `confirmCommitMessageOverride` pattern — `getBoolean`/`setBoolean` on
localStorage, private field on AppStore, dispatcher wrapper, checkbox in dialog.

## Files to Modify

### Remove popup approach
1. `app/src/models/popup.ts` — Remove `CopilotConflictResolution` popup type
2. `app/src/ui/app.tsx` — Remove popup rendering case + imports

### Add state
3. `app/src/lib/app-state.ts` — Add `ICopilotConflictResolutionState` + field on
   `IMultiCommitOperationState` + `alwaysResolveCopilotConflicts` on `IAppState`

### Rework store + dispatcher
4. `app/src/lib/stores/app-store.ts` — Rework `_startCopilotConflictResolution` to set
   state on multi-commit operation. Add preference. Expose in getAppState().
5. `app/src/ui/dispatcher/dispatcher.ts` — Update methods for mode-based approach.
   Add `setCopilotConflictResolutionState`, `setAlwaysResolveCopilotConflicts`.

### Rework multi-commit operation UI
6. `app/src/ui/multi-commit-operation/base-multi-commit-operation.tsx` — In ShowConflicts,
   check copilot state and render Copilot dialog when active.
7. `app/src/ui/multi-commit-operation/merge.tsx` — Update getOnResolveWithCopilot.

### Rewrite Copilot dialog
8. `app/src/ui/copilot-conflict-resolution/copilot-conflict-resolution-dialog.tsx` —
   Complete rewrite mirroring conflicts-dialog.tsx structure.
9. `app/src/ui/copilot-conflict-resolution/copilot-conflict-resolution-loading.tsx` —
   Keep but adapt for inline rendering.
10. `app/styles/ui/_copilot-conflict-resolution.scss` — Complete rewrite.

## Acceptance Criteria

- **Given** a merge with conflicts, **When** the user clicks "Resolve with Copilot",
  **Then** a loading state replaces the dialog and Copilot analyzes conflicts
- **Given** Copilot has returned suggestions, **When** the dialog renders,
  **Then** each file shows dropdown with "Use Copilot's suggestion", ours, theirs, editor
- **Given** user selects "Use Copilot's suggestion" for a file,
  **Then** resolved content is written to disk and file shows as resolved
- **Given** all conflicts resolved, **When** user clicks "Continue merge",
  **Then** `finishConflictedMerge()` is called
- **Given** "Always resolve with Copilot" is checked and persisted,
  **When** new conflicts arise, **Then** Copilot mode activates automatically

## Risk Assessment

**Risk tier**: Medium — UI + state changes, feature-flagged, no destructive git operations
