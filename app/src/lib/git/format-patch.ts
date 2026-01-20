import { git } from '.'
import { Repository } from '../../models/repository'
import { revRange } from './rev-list'

/**
 * Generate a patch representing the changes associated with a range of commits
 *
 * @param repository where to generate path from
 * @param base starting commit in range
 * @param head ending commit in rage
 * @returns patch generated
 */
export function formatPatch({ path }: Repository, base: string, head: string) {
  const range = revRange(base, head)
  const args = ['format-patch', '--unified=1', '--minimal', '--stdout', range]
  return git(args, path, 'formatPatch').then(x => x.stdout)
}
