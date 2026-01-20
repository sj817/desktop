import { exec } from 'dugite'
import { Repository } from '../../src/models/repository'

export async function setupLocalConfig(
  repository: Repository,
  localConfig: Iterable<[string, string]>
) {
  for (const [key, value] of localConfig) {
    await exec(['config', key, value], repository.path)
  }
}
