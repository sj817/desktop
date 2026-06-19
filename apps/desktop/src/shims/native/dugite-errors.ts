// Ported verbatim from dugite's errors.ts + parse-error.ts so the official
// lib/git layer gets real git-error categorization (it imports `GitError`,
// `parseError`, and `parseBadConfigValueErrorInfo` from 'dugite'). Without this
// every git failure is uncategorized, which breaks the many lib/git flows that
// branch on `result.gitError === DugiteError.X` (merge/rebase conflicts, HTTPS
// auth, "branch already exists", GPG sign failures, push protection, etc.).
//
// Keep this in sync with the installed dugite version if it changes.

/** The git errors which can be parsed from failed git commands. */
export const GitError = {
  BadConfigValue: 0,
  SSHKeyAuditUnverified: 1,
  SSHAuthenticationFailed: 2,
  SSHPermissionDenied: 3,
  HTTPSAuthenticationFailed: 4,
  RemoteDisconnection: 5,
  HostDown: 6,
  RebaseConflicts: 7,
  MergeConflicts: 8,
  HTTPSRepositoryNotFound: 9,
  SSHRepositoryNotFound: 10,
  PushNotFastForward: 11,
  BranchDeletionFailed: 12,
  DefaultBranchDeletionFailed: 13,
  RevertConflicts: 14,
  EmptyRebasePatch: 15,
  NoMatchingRemoteBranch: 16,
  NoExistingRemoteBranch: 17,
  NothingToCommit: 18,
  NoSubmoduleMapping: 19,
  SubmoduleRepositoryDoesNotExist: 20,
  InvalidSubmoduleSHA: 21,
  LocalPermissionDenied: 22,
  InvalidMerge: 23,
  InvalidRebase: 24,
  NonFastForwardMergeIntoEmptyHead: 25,
  PatchDoesNotApply: 26,
  BranchAlreadyExists: 27,
  BadRevision: 28,
  NotAGitRepository: 29,
  CannotMergeUnrelatedHistories: 30,
  LFSAttributeDoesNotMatch: 31,
  BranchRenameFailed: 32,
  PathDoesNotExist: 33,
  InvalidObjectName: 34,
  OutsideRepository: 35,
  LockFileAlreadyExists: 36,
  NoMergeToAbort: 37,
  LocalChangesOverwritten: 38,
  UnresolvedConflicts: 39,
  GPGFailedToSignData: 40,
  ConflictModifyDeletedInBranch: 41,
  // Start of GitHub-specific error codes
  PushWithFileSizeExceedingLimit: 42,
  HexBranchNameRejected: 43,
  ForcePushRejected: 44,
  InvalidRefLength: 45,
  ProtectedBranchRequiresReview: 46,
  ProtectedBranchForcePush: 47,
  ProtectedBranchDeleteRejected: 48,
  ProtectedBranchRequiredStatus: 49,
  PushWithPrivateEmail: 50,
  // End of GitHub-specific error codes
  ConfigLockFileAlreadyExists: 51,
  RemoteAlreadyExists: 52,
  TagAlreadyExists: 53,
  MergeWithLocalChanges: 54,
  RebaseWithLocalChanges: 55,
  MergeCommitNoMainlineOption: 56,
  UnsafeDirectory: 57,
  PathExistsButNotInRef: 58,
  PushWithSecretDetected: 59,
} as const

export type GitError = (typeof GitError)[keyof typeof GitError]

/** A mapping from regexes to the git error they identify. */
export const GitErrorRegexes: { [regexp: string]: GitError } = {
  "fatal: bad (?:numeric|boolean) config value '(.+)' for '(.+)'":
    GitError.BadConfigValue,
  'ERROR: ([\\s\\S]+?)\\n+\\[EPOLICYKEYAGE\\]\\n+fatal: Could not read from remote repository.':
    GitError.SSHKeyAuditUnverified,
  "fatal: Authentication failed for 'https?://":
    GitError.HTTPSAuthenticationFailed,
  'fatal: Authentication failed': GitError.SSHAuthenticationFailed,
  'fatal: Could not read from remote repository.': GitError.SSHPermissionDenied,
  'The requested URL returned error: 403': GitError.HTTPSAuthenticationFailed,
  'fatal: [Tt]he remote end hung up unexpectedly': GitError.RemoteDisconnection,
  "fatal: unable to access '(.+)': Failed to connect to (.+): Host is down":
    GitError.HostDown,
  "Cloning into '(.+)'...\nfatal: unable to access '(.+)': Could not resolve host: (.+)":
    GitError.HostDown,
  'Resolve all conflicts manually, mark them as resolved with':
    GitError.RebaseConflicts,
  '(Merge conflict|Automatic merge failed; fix conflicts and then commit the result)':
    GitError.MergeConflicts,
  "fatal: repository '(.+)' not found": GitError.HTTPSRepositoryNotFound,
  'ERROR: Repository not found': GitError.SSHRepositoryNotFound,
  "\\((non-fast-forward|fetch first)\\)\nerror: failed to push some refs to '.*'":
    GitError.PushNotFastForward,
  "error: unable to delete '(.+)': remote ref does not exist":
    GitError.BranchDeletionFailed,
  '\\[remote rejected\\] (.+) \\(deletion of the current branch prohibited\\)':
    GitError.DefaultBranchDeletionFailed,
  "error: could not revert .*\nhint: after resolving the conflicts, mark the corrected paths\nhint: with 'git add <paths>' or 'git rm <paths>'\nhint: and commit the result with 'git commit'":
    GitError.RevertConflicts,
  "Applying: .*\nNo changes - did you forget to use 'git add'\\?\nIf there is nothing left to stage, chances are that something else\n.*":
    GitError.EmptyRebasePatch,
  'There are no candidates for (rebasing|merging) among the refs that you just fetched.\nGenerally this means that you provided a wildcard refspec which had no\nmatches on the remote end.':
    GitError.NoMatchingRemoteBranch,
  "Your configuration specifies to merge with the ref '(.+)'\nfrom the remote, but no such ref was fetched.":
    GitError.NoExistingRemoteBranch,
  'nothing to commit': GitError.NothingToCommit,
  "[Nn]o submodule mapping found in .gitmodules for path '(.+)'":
    GitError.NoSubmoduleMapping,
  "fatal: repository '(.+)' does not exist\nfatal: clone of '.+' into submodule path '(.+)' failed":
    GitError.SubmoduleRepositoryDoesNotExist,
  "Fetched in submodule path '(.+)', but it did not contain (.+). Direct fetching of that commit failed.":
    GitError.InvalidSubmoduleSHA,
  "fatal: could not create work tree dir '(.+)'.*: Permission denied":
    GitError.LocalPermissionDenied,
  'merge: (.+) - not something we can merge': GitError.InvalidMerge,
  'invalid upstream (.+)': GitError.InvalidRebase,
  'fatal: Non-fast-forward commit does not make sense into an empty head':
    GitError.NonFastForwardMergeIntoEmptyHead,
  'error: (.+): (patch does not apply|already exists in working directory)':
    GitError.PatchDoesNotApply,
  "fatal: [Aa] branch named '(.+)' already exists.?":
    GitError.BranchAlreadyExists,
  "fatal: bad revision '(.*)'": GitError.BadRevision,
  'fatal: [Nn]ot a git repository \\(or any of the parent directories\\): (.*)':
    GitError.NotAGitRepository,
  'fatal: refusing to merge unrelated histories':
    GitError.CannotMergeUnrelatedHistories,
  'The .+ attribute should be .+ but is .+': GitError.LFSAttributeDoesNotMatch,
  'fatal: Branch rename failed': GitError.BranchRenameFailed,
  "fatal: path '(.+)' does not exist .+": GitError.PathDoesNotExist,
  "fatal: invalid object name '(.+)'.": GitError.InvalidObjectName,
  "fatal: .+: '(.+)' is outside repository": GitError.OutsideRepository,
  'Another git process seems to be running in this repository, e.g.':
    GitError.LockFileAlreadyExists,
  'fatal: There is no merge to abort': GitError.NoMergeToAbort,
  'error: (?:Your local changes to the following|The following untracked working tree) files would be overwritten by checkout:':
    GitError.LocalChangesOverwritten,
  'You must edit all merge conflicts and then\nmark them as resolved using git add|fatal: Exiting because of an unresolved conflict':
    GitError.UnresolvedConflicts,
  'error: gpg failed to sign the data': GitError.GPGFailedToSignData,
  'CONFLICT \\(modify/delete\\): (.+) deleted in (.+) and modified in (.+)':
    GitError.ConflictModifyDeletedInBranch,
  // GitHub-specific errors
  'error: GH001: ': GitError.PushWithFileSizeExceedingLimit,
  'error: GH002: ': GitError.HexBranchNameRejected,
  'error: GH003: Sorry, force-pushing to (.+) is not allowed.':
    GitError.ForcePushRejected,
  'error: GH005: Sorry, refs longer than (.+) bytes are not allowed':
    GitError.InvalidRefLength,
  'error: GH006: Protected branch update failed for (.+)\nremote: error: At least one approved review is required':
    GitError.ProtectedBranchRequiresReview,
  'error: GH006: Protected branch update failed for (.+)\nremote: error: Cannot force-push to a protected branch':
    GitError.ProtectedBranchForcePush,
  'error: GH006: Protected branch update failed for (.+)\nremote: error: Cannot delete a protected branch':
    GitError.ProtectedBranchDeleteRejected,
  'error: GH006: Protected branch update failed for (.+).\nremote: error: Required status check "(.+)" is expected':
    GitError.ProtectedBranchRequiredStatus,
  'error: GH007: Your push would publish a private email address.':
    GitError.PushWithPrivateEmail,
  'error: could not lock config file (.+): File exists':
    GitError.ConfigLockFileAlreadyExists,
  'error: remote (.+) already exists.': GitError.RemoteAlreadyExists,
  "fatal: tag '(.+)' already exists": GitError.TagAlreadyExists,
  'error: Your local changes to the following files would be overwritten by merge:\n':
    GitError.MergeWithLocalChanges,
  'error: cannot (pull with rebase|rebase): You have unstaged changes\\.\n\\s*error: [Pp]lease commit or stash them\\.':
    GitError.RebaseWithLocalChanges,
  'error: commit (.+) is a merge but no -m option was given':
    GitError.MergeCommitNoMainlineOption,
  'fatal: detected dubious ownership in repository at (.+)':
    GitError.UnsafeDirectory,
  "fatal: path '(.+)' exists on disk, but not in '(.+)'":
    GitError.PathExistsButNotInRef,
  'GITHUB PUSH PROTECTION[.\\s\\S]+Push cannot contain secrets':
    GitError.PushWithSecretDetected,
}

/** Try to parse an error type from stderr (first matching pattern wins). */
export const parseError = (stderr: string): GitError | null => {
  for (const [regexp, error] of Object.entries(GitErrorRegexes)) {
    if (new RegExp(regexp).test(stderr)) {
      return error
    }
  }
  return null
}

/** Extract the offending key/value from a BadConfigValue error, if present. */
export const parseBadConfigValueErrorInfo = (
  stderr: string
): { key: string; value: string } | null => {
  const entry = Object.entries(GitErrorRegexes).find(
    ([, value]) => value === GitError.BadConfigValue
  )
  if (entry === undefined) {
    return null
  }
  const match = stderr.match(entry[0])
  if (match === null || !match[1] || !match[2]) {
    return null
  }
  return { key: match[2], value: match[1] }
}
