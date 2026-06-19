//! Pure libgit2 helpers for read-only git operations.
//! No Tauri awareness — these are plain functions the command layer calls.

use git2::{BranchType, Repository, StatusOptions};
use serde::Serialize;

use crate::error::AppResult;

/// Check whether `path` is inside a git work-tree.
pub fn is_git_repo(path: &str) -> bool {
    Repository::open(path).is_ok()
}

/// Return the current branch name, or the short SHA if HEAD is detached.
pub fn current_branch(path: &str) -> AppResult<String> {
    let repo = Repository::open(path)?;
    let head = repo.head()?;

    if head.is_branch() {
        Ok(head
            .shorthand()
            .unwrap_or("HEAD")
            .to_string())
    } else {
        // Detached HEAD — return first 7 hex chars of the target OID.
        let oid = head.target().expect("HEAD has no target");
        Ok(format!("{}", oid)[..7].to_string())
    }
}

/// List local branch names.
pub fn local_branches(path: &str) -> AppResult<Vec<String>> {
    let repo = Repository::open(path)?;
    let branches = repo.branches(Some(BranchType::Local))?;

    let mut names = Vec::new();
    for branch in branches {
        let (branch, _) = branch?;
        if let Some(name) = branch.name()? {
            names.push(name.to_string());
        }
    }
    Ok(names)
}

/// Return porcelain-v1 style status entries: `(two-char code, path)`.
pub fn status_entries(path: &str) -> AppResult<Vec<(String, String)>> {
    let repo = Repository::open(path)?;

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut result = Vec::with_capacity(statuses.len());

    for entry in statuses.iter() {
        let st = entry.status();
        let file_path = entry.path().unwrap_or("").to_string();
        let code = status_to_porcelain(st);
        result.push((code, file_path));
    }
    Ok(result)
}

/// Map a `git2::Status` bitflag set to a two-character porcelain code.
fn status_to_porcelain(st: git2::Status) -> String {
    let index_char = if st.contains(git2::Status::INDEX_NEW) {
        'A'
    } else if st.contains(git2::Status::INDEX_MODIFIED) {
        'M'
    } else if st.contains(git2::Status::INDEX_DELETED) {
        'D'
    } else if st.contains(git2::Status::INDEX_RENAMED) {
        'R'
    } else if st.contains(git2::Status::INDEX_TYPECHANGE) {
        'T'
    } else {
        ' '
    };

    let wt_char = if st.contains(git2::Status::WT_NEW) {
        '?'
    } else if st.contains(git2::Status::WT_MODIFIED) {
        'M'
    } else if st.contains(git2::Status::WT_DELETED) {
        'D'
    } else if st.contains(git2::Status::WT_RENAMED) {
        'R'
    } else {
        ' '
    };

    // Pure untracked files should show as "??"
    if st == git2::Status::WT_NEW {
        return "??".to_string();
    }

    format!("{}{}", index_char, wt_char)
}

/// Lightweight commit data returned by [`recent_commits`].
#[derive(Serialize)]
pub struct CommitData {
    pub sha: String,
    pub short_sha: String,
    pub summary: String,
    pub author: String,
    pub date: String,
}

/// Walk the most recent `limit` commits from HEAD.
pub fn recent_commits(path: &str, limit: usize) -> AppResult<Vec<CommitData>> {
    let repo = Repository::open(path)?;
    let mut revwalk = repo.revwalk()?;
    revwalk.push_head()?;
    revwalk.set_sorting(git2::Sort::TIME)?;

    let mut commits = Vec::with_capacity(limit);

    for oid_result in revwalk.take(limit) {
        let oid = oid_result?;
        let commit = repo.find_commit(oid)?;
        let sha = oid.to_string();
        let short_sha = sha[..7].to_string();
        let summary = commit.summary().unwrap_or("").to_string();
        let author = commit.author().name().unwrap_or("").to_string();
        let date = epoch_to_date(commit.time().seconds());

        commits.push(CommitData {
            sha,
            short_sha,
            summary,
            author,
            date,
        });
    }
    Ok(commits)
}

/// Convert seconds-since-epoch to a `YYYY-MM-DD` string (UTC).
fn epoch_to_date(epoch: i64) -> String {
    // Days since 1970-01-01
    let mut days = (epoch / 86400) as i64;
    // Shift to March-based year for easier leap-year handling.
    // 1970-01-01 is 719468 days after 0000-03-01 in the proleptic Gregorian
    // calendar (the algorithm below uses the era-based approach from
    // Howard Hinnant's date algorithms).
    days += 719_468;

    let era = if days >= 0 { days } else { days - 146_096 } / 146_097;
    let doe = (days - era * 146_097) as u32; // day of era [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365; // year of era
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100); // day of year [0, 365]
    let mp = (5 * doy + 2) / 153; // month index [0, 11]
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };

    format!("{:04}-{:02}-{:02}", y, m, d)
}
