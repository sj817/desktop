import * as Path from 'path'
import { writeFile } from 'fs/promises'

import { IFileResolution } from './copilot-conflict-resolution'

/**
 * Validate that a resolution file path is safe to write within the repository.
 *
 * Rejects absolute paths and path-traversal attempts (e.g., `../` escapes).
 * Returns the fully resolved path within the repository root.
 *
 * @throws if the path escapes the repository root
 */
function resolveAndValidatePath(
  repositoryPath: string,
  filePath: string
): string {
  // Reject absolute paths outright
  if (Path.isAbsolute(filePath)) {
    throw new Error(
      `Copilot resolution contains an absolute file path which is not allowed: ${filePath}`
    )
  }

  const resolved = Path.resolve(repositoryPath, filePath)
  const normalizedRoot = Path.normalize(repositoryPath + Path.sep)

  if (!resolved.startsWith(normalizedRoot)) {
    throw new Error(
      `Copilot resolution path escapes repository root: ${filePath}`
    )
  }

  return resolved
}

/**
 * Write accepted Copilot conflict resolutions to disk.
 *
 * Validates each file path stays within the repository root before writing.
 * Writes are performed sequentially so that partial failures leave the
 * repository in a deterministic state.
 *
 * @returns the number of files successfully written
 * @throws if any file path is invalid (fails fast, no partial writes for
 *         invalid paths) or if a write operation fails
 */
export async function applyCopilotResolutionsToWorkingDirectory(
  repositoryPath: string,
  resolutions: ReadonlyArray<IFileResolution>
): Promise<number> {
  // Pre-validate all paths before writing anything
  const resolvedPaths: string[] = []
  for (const resolution of resolutions) {
    resolvedPaths.push(resolveAndValidatePath(repositoryPath, resolution.path))
  }

  // Write files sequentially
  let written = 0
  for (let i = 0; i < resolutions.length; i++) {
    await writeFile(resolvedPaths[i], resolutions[i].resolvedContent, 'utf8')
    written++
  }

  return written
}
