# Resolve with Copilot UI — Implementation Plan

## Problem Statement

GitHub Desktop needs a user-facing UI for Copilot-powered merge conflict resolution. The backend infrastructure (feature flag, context building, response parsing, telemetry) is being built in PRs #21917-#21921. This PR builds the complete UI layer that ties them all together.

## Proposed Approach

Use the **dialog-based flow** (POC 1 from UX spike): a new popup type that progresses through loading → review → apply states. This follows existing patterns like the Generate Commit Message feature (popup-based, loading state, then result).

### Key design decisions:
1. **Popup-based** (not inline in conflicts dialog) — keeps the resolution review in a focused modal
2. **State managed via popup props** — loading/response/error passed through popup discriminated union
3. **File writes via Dispatcher** — resolved content written to disk through proper state management
4. **React class components** — consistent with existing codebase (no hooks)

## Files to Create/Modify

### New Files
1. `app/src/ui/copilot-conflict-resolution/copilot-conflict-resolution-dialog.tsx` — Main resolution review dialog
2. `app/src/ui/copilot-conflict-resolution/copilot-conflict-resolution-loading.tsx` — Loading state dialog
3. `app/src/ui/copilot-conflict-resolution/index.ts` — Barrel exports
4. `app/styles/ui/_copilot-conflict-resolution.scss` — Component styles

### Modified Files
5. `app/src/models/popup.ts` — Add `PopupType.CopilotConflictResolution` and `PopupType.CopilotConflictResolutionLoading`
6. `app/src/ui/app.tsx` — Render new popup types in switch
7. `app/src/ui/multi-commit-operation/dialog/conflicts-dialog.tsx` — Add "Resolve with Copilot" button
8. `app/src/ui/dispatcher/dispatcher.ts` — Add `startCopilotConflictResolution()` and `applyCopilotConflictResolutions()`
9. `app/src/lib/stores/app-store.ts` — Add `_startCopilotConflictResolution()` and `_applyCopilotConflictResolutions()`
10. `app/styles/_ui.scss` — Import new stylesheet

## Risk Assessment

**Risk tier**: Medium
- New UI surface only, follows established dialog patterns
- No destructive git operations — writes resolved content to working directory files only
- Feature-flagged behind `enableCopilotConflictResolution()` (dev-only for now)
- Depends on unmerged PRs — import errors expected until dependencies land

## Acceptance Criteria

- **Given** the feature flag is enabled and a merge conflict exists, **When** the conflicts dialog opens, **Then** a "Resolve with Copilot" button is visible
- **Given** the user clicks "Resolve with Copilot", **When** the loading dialog shows, **Then** a spinner and cancel button are visible
- **Given** Copilot returns resolutions, **When** the review dialog opens, **Then** each file shows path, reasoning, confidence, and accept/reject buttons
- **Given** the user accepts some files and rejects others, **When** they click "Apply", **Then** only accepted files' content is written to disk
- **Given** more than 5 files are shown, **When** the user types in the filter box, **Then** the list filters by file path
